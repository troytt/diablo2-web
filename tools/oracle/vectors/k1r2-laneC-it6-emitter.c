/*
 * k1r2-laneC-it6-emitter.c
 *
 * 32-bit MinGW executable that loads the real D2Common.dll v1.13c at its
 * preferred image base 0x6FD50000 (along with real D2CMP.dll and Fog.dll)
 * under Wine and emits differential test vectors (NDJSON) for Lane C Iteration 6:
 *   - B034 (12 functions across preset.ts, drlg-grid.ts) -> b034-vectors.ndjson
 *   - B037 (11 functions in drlg-room.ts)                -> b037-vectors.ndjson
 *   - B042 (12 functions in path.ts)                     -> b042-vectors.ndjson
 *
 * Build:
 *   i686-w64-mingw32-gcc-win32 -O2 -o k1r2-laneC-it6-emitter.exe \
 *     tools/oracle/vectors/k1r2-laneC-it6-emitter.c
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

static u32 g_mock_time_sec = 0;
static u32 g_mock_tick_count = 0;

#define RVA(va) (g_base - EXPECTED_BASE + (u32)(va))
#define PTR(off) ((u32)(ARENA_ADDR + (u32)(off)))
#define MEM(off) (g_arena + (u32)(off))
#define U32_AT(off) (*(u32 *)MEM(off))
#define S32_AT(off) (*(s32 *)MEM(off))
#define U16_AT(off) (*(u16 *)MEM(off))
#define S16_AT(off) (*(s16 *)MEM(off))
#define U8_AT(off)  (*(u8 *)MEM(off))

/* =========================================================================
 * DETERMINISTIC FOG / D2CMP / KERNEL32 IAT HOOKS
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

/* Fog.#10042 (0x6FDD90D0) & Fog.#10045 (0x6FDD90AC) */
static u32 __attribute__((fastcall)) stub_fog_10045(
  u32 ecx, u32 edx, u32 file, u32 line, u32 zero
) {
  (void)ecx; (void)file; (void)line; (void)zero;
  return bump_alloc(edx);
}

/* Fog.#10043 (0x6FDD90CC) & Fog.#10046 (0x6FDD90A8) */
static void __attribute__((fastcall)) stub_fog_10046(
  u32 ecx, u32 edx, u32 file, u32 line, u32 zero
) {
  (void)ecx; (void)file; (void)line; (void)zero;
  if (edx != 0 && g_num_frees < 32) {
    g_frees[g_num_frees++] = edx;
  }
}

/* Fog.#10004 (0x6FDD90C8): __fastcall(ecx=pFree, edx=file, line, zero), ret 8 */
static void __attribute__((fastcall)) stub_fog_10004(
  u32 ecx, u32 edx, u32 line, u32 zero
) {
  (void)edx; (void)line; (void)zero;
  if (ecx != 0 && g_num_frees < 32) {
    g_frees[g_num_frees++] = ecx;
  }
}

/* Fog.#10104 (0x6FDD90DC): __fastcall(ecx=hFile, edx=pBuf, nSize, pdwRead, file, line, 0), ret 0x14 */
static u32 __attribute__((fastcall)) stub_fog_10104(
  u32 ecx_hFile, u32 edx_pBuf, u32 nSize, u32 pdwRead, u32 file, u32 line, u32 zero
) {
  (void)file; (void)line; (void)zero;
  if (ecx_hFile != 0 && edx_pBuf != 0 && nSize > 0) {
    memcpy((void *)(uintptr_t)edx_pBuf, (const void *)(uintptr_t)ecx_hFile, nSize);
  }
  if (pdwRead != 0) {
    *(u32 *)(uintptr_t)pdwRead = nSize;
  }
  return 1;
}

/* Fog.#10105 (0x6FDD90F0): __fastcall(ecx=hFile, edx=pHigh) -> eax, ret */
static u32 __attribute__((fastcall)) stub_fog_10105(
  u32 ecx_hFile, u32 edx_pHigh
) {
  u32 low = *(const u32 *)(uintptr_t)ecx_hFile;
  if (edx_pHigh != 0) {
    *(u32 *)(uintptr_t)edx_pHigh = *(const u32 *)(uintptr_t)(ecx_hFile + 4u);
  }
  return low;
}

/* KERNEL32.GetSystemTimeAsFileTime (0x6FDD91D4) for _time(0) at 0x6FD5265D */
static void __stdcall stub_get_filetime(FILETIME *lpFileTime) {
  uint64_t val = (uint64_t)g_mock_time_sec * 10000000ULL + 116444736000000000ULL;
  lpFileTime->dwLowDateTime = (DWORD)(val & 0xFFFFFFFFULL);
  lpFileTime->dwHighDateTime = (DWORD)(val >> 32);
}

/* KERNEL32.GetTickCount (0x6FDD91FC) */
static DWORD __stdcall stub_get_tick_count(void) {
  return (DWORD)g_mock_tick_count;
}

/* D2CMP.#10085 (0x6FDD9018): __stdcall(ppTiles, szFile), ret 8 */
static void __stdcall stub_d2cmp_10085(u32 *ppTiles, const char *szFile) {
  u32 h = *ppTiles;
  for (const u8 *s = (const u8 *)szFile; *s != 0; s++) {
    h = h * 33u + (u32)(*s);
  }
  *ppTiles = h;
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

#define MAX_BLOCKS 64
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

static void write_dword_kv(FILE *fp, int *first, u32 addr, u32 val) {
  if (!*first) fputc(',', fp);
  *first = 0;
  fprintf(fp, "\"0x%08x\":%u", addr, val);
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
    const u32 *words = (const u32 *)b->pre;
    u32 count = b->len / 4;
    for (u32 k = 0; k < count; k++) {
      write_dword_kv(fp, &first_in, b->addr + k * 4, words[k]);
    }
  }
  fprintf(fp, "}},\"out\":{\"eax\":%u,\"mem\":{", eax);
  int first_out = 1;
  for (int i = 0; i < g_num_blocks; i++) {
    TrackedBlock *b = &g_blocks[i];
    const u32 *pre_w = (const u32 *)b->pre;
    const u32 *post_w = (const u32 *)b->post;
    u32 count = b->len / 4;
    for (u32 k = 0; k < count; k++) {
      if (post_w[k] != pre_w[k]) {
        write_dword_kv(fp, &first_out, b->addr + k * 4, post_w[k]);
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

typedef void (__stdcall *fn_std1_void_t)(u32);
typedef u32  (__stdcall *fn_std1_u32_t)(u32);
typedef void (__stdcall *fn_std2_void_t)(u32, u32);
typedef u32  (__stdcall *fn_std2_u32_t)(u32, u32);
typedef void (__stdcall *fn_std3_void_t)(u32, u32, u32);

/* =========================================================================
 * B034 REGISTER-ONLY INLINE ASM WRAPPERS (12 FUNCTIONS)
 * ========================================================================= */

/* 1. 0x6FD59610: esi = hFile, edi = nSize, [esp+4] = pBuffer -> void, ret 4 */
static __attribute__((noinline)) void call_6FD59610(u32 hFile, u32 nSize, u32 pBuffer) {
  u32 r_eax = (u32)RVA(0x6FD59610);
  u32 r_esi = hFile;
  u32 r_edi = nSize;
  u32 r_ecx = pBuffer;
  __asm__ volatile (
    "push %3\n\t"
    "call *%0\n\t"
    : "+a"(r_eax), "+S"(r_esi), "+D"(r_edi), "+c"(r_ecx)
    :
    : "edx", "ebx", "cc", "memory"
  );
}

/* 2. 0x6FD59700: esi = hFile, [esp+4] = lpFileSizeHigh -> eax, ret 4 */
static __attribute__((noinline)) u32 call_6FD59700(u32 hFile, u32 lpFileSizeHigh) {
  u32 r_eax = (u32)RVA(0x6FD59700);
  u32 r_esi = hFile;
  u32 r_ecx = lpFileSizeHigh;
  __asm__ volatile (
    "push %2\n\t"
    "call *%0\n\t"
    : "+a"(r_eax), "+S"(r_esi), "+c"(r_ecx)
    :
    : "edx", "ebx", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 3. 0x6FD59D90: __fastcall(ecx = pMemPool, edx = pBlock) -> void, ret */
static __attribute__((noinline)) void call_6FD59D90(u32 pMemPool, u32 pBlock) {
  u32 r_eax = (u32)RVA(0x6FD59D90);
  u32 r_ecx = pMemPool;
  u32 r_edx = pBlock;
  __asm__ volatile (
    "call *%0\n\t"
    : "+a"(r_eax), "+c"(r_ecx), "+d"(r_edx)
    :
    : "ebx", "esi", "edi", "cc", "memory"
  );
}

/* 4. 0x6FD59DE0: __fastcall(ecx = pMemPool, edx = pSrcBlock) -> eax, ret */
static __attribute__((noinline)) u32 call_6FD59DE0(u32 pMemPool, u32 pSrcBlock) {
  u32 r_eax = (u32)RVA(0x6FD59DE0);
  u32 r_ecx = pMemPool;
  u32 r_edx = pSrcBlock;
  __asm__ volatile (
    "call *%0\n\t"
    : "+a"(r_eax), "+c"(r_ecx), "+d"(r_edx)
    :
    : "ebx", "esi", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 6. 0x6FD5A440: eax = pRoomEx, ebx = pMemPool -> void, ret */
static __attribute__((noinline)) void call_6FD5A440(u32 pRoomEx, u32 pMemPool) {
  u32 r_eax = pRoomEx;
  u32 r_ebx = pMemPool;
  u32 r_ecx = (u32)RVA(0x6FD5A440);
  __asm__ volatile (
    "call *%2\n\t"
    : "+a"(r_eax), "+b"(r_ebx), "+c"(r_ecx)
    :
    : "edx", "esi", "edi", "cc", "memory"
  );
}

/* 8. 0x6FD5BC60: ebx = pSeed, [esp+4] = pLevel, [esp+8] = nLvlPrestId, [esp+0xC] = pBox -> eax, ret 0xC */
static __attribute__((noinline)) u32 call_6FD5BC60(
  u32 pSeed, u32 pLevel, s32 nLvlPrestId, u32 pBox
) {
  u32 r_eax = (u32)RVA(0x6FD5BC60);
  u32 r_ebx = pSeed;
  u32 r_ecx = pLevel;
  u32 r_edx = (u32)nLvlPrestId;
  u32 r_esi = pBox;
  __asm__ volatile (
    "push %4\n\t"
    "push %3\n\t"
    "push %2\n\t"
    "call *%0\n\t"
    : "+a"(r_eax), "+b"(r_ebx), "+c"(r_ecx), "+d"(r_edx), "+S"(r_esi)
    :
    : "edi", "cc", "memory"
  );
  return r_eax;
}

/* 9. 0x6FD86760: ecx = nSalt -> eax, ret */
static __attribute__((noinline)) u32 call_6FD86760(s32 nSalt) {
  u32 r_eax = (u32)RVA(0x6FD86760);
  u32 r_ecx = (u32)nSalt;
  __asm__ volatile (
    "call *%0\n\t"
    : "+a"(r_eax), "+c"(r_ecx)
    :
    : "edx", "ebx", "esi", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 10. 0x6FD86840: edi = pOutGrid, esi = pWindowBox, ebx = nRowStride, [esp+4] = pMemPool, [esp+8] = pBaseCells, ret 8 */
static __attribute__((noinline)) void call_6FD86840(
  u32 pOutGrid, u32 pWindowBox, s32 nRowStride, u32 pMemPool, u32 pBaseCells
) {
  u32 r_eax = (u32)RVA(0x6FD86840);
  u32 r_edi = pOutGrid;
  u32 r_esi = pWindowBox;
  u32 r_ebx = (u32)nRowStride;
  u32 r_ecx = pMemPool;
  u32 r_edx = pBaseCells;
  __asm__ volatile (
    "push %5\n\t"
    "push %4\n\t"
    "call *%0\n\t"
    : "+a"(r_eax), "+D"(r_edi), "+S"(r_esi), "+b"(r_ebx), "+c"(r_ecx), "+d"(r_edx)
    :
    : "cc", "memory"
  );
}

/* 11. 0x6FD86950: ebx = pOutGrid, ecx = pMemPool, [esp+4] = nWidth, [esp+8] = nHeight, ret 8 */
static __attribute__((noinline)) void call_6FD86950(
  u32 pOutGrid, u32 pMemPool, s32 nWidth, s32 nHeight
) {
  u32 r_eax = (u32)RVA(0x6FD86950);
  u32 r_ebx = pOutGrid;
  u32 r_ecx = pMemPool;
  u32 r_edx = (u32)nWidth;
  u32 r_esi = (u32)nHeight;
  __asm__ volatile (
    "push %4\n\t"
    "push %3\n\t"
    "call *%0\n\t"
    : "+a"(r_eax), "+b"(r_ebx), "+c"(r_ecx), "+d"(r_edx), "+S"(r_esi)
    :
    : "edi", "cc", "memory"
  );
}

/* =========================================================================
 * B037 REGISTER-ONLY INLINE ASM WRAPPERS (11 FUNCTIONS)
 * ========================================================================= */

/* 1. 0x6FD5AF20: esi = pDrlgMap, [esp+4] = pMemPool, ret 4 */
static __attribute__((noinline)) void call_6FD5AF20(u32 pDrlgMap, u32 pMemPool) {
  u32 r_eax = (u32)RVA(0x6FD5AF20);
  u32 r_esi = pDrlgMap;
  u32 r_ecx = pMemPool;
  __asm__ volatile (
    "push %2\n\t"
    "call *%0\n\t"
    : "+a"(r_eax), "+S"(r_esi), "+c"(r_ecx)
    :
    : "edx", "ebx", "edi", "cc", "memory"
  );
}

/* 2. 0x6FD5AFD0: esi = pDrlgMap, [esp+4] = pMemPool, [esp+8] = nLocalX, [esp+0xC] = pOrientationGrid, ret 0xC */
static __attribute__((noinline)) void call_6FD5AFD0(
  u32 pDrlgMap, u32 pMemPool, s32 nLocalX, u32 pOrientationGrid
) {
  u32 r_eax = (u32)RVA(0x6FD5AFD0);
  u32 r_esi = pDrlgMap;
  u32 r_ecx = pMemPool;
  u32 r_edx = (u32)nLocalX;
  u32 r_ebx = pOrientationGrid;
  __asm__ volatile (
    "push %4\n\t"
    "push %3\n\t"
    "push %2\n\t"
    "call *%0\n\t"
    : "+a"(r_eax), "+S"(r_esi), "+c"(r_ecx), "+d"(r_edx), "+b"(r_ebx)
    :
    : "edi", "cc", "memory"
  );
}

/* 3. 0x6FD5B290: eax = nWorldY, ecx = nWorldX, edi = pDrlgMap, [esp+4] = pMemPool, ret 4 */
static __attribute__((noinline)) void call_6FD5B290(
  s32 nWorldY, s32 nWorldX, u32 pDrlgMap, u32 pMemPool
) {
  u32 r_eax = (u32)nWorldY;
  u32 r_ecx = (u32)nWorldX;
  u32 r_edi = pDrlgMap;
  u32 r_edx = pMemPool;
  u32 r_ebx = (u32)RVA(0x6FD5B290);
  __asm__ volatile (
    "push %3\n\t"
    "call *%4\n\t"
    : "+a"(r_eax), "+c"(r_ecx), "+D"(r_edi), "+d"(r_edx), "+b"(r_ebx)
    :
    : "esi", "cc", "memory"
  );
}

/* 4. 0x6FD94480: ecx = pMemPool, esi = pRoomEx, [esp+4..0x14] = (nUnitType, nTxtFileNo, nMode, nXpos, nYpos) -> eax, ret 0x14 */
static __attribute__((noinline)) u32 call_6FD94480(
  u32 pMemPool, u32 pRoomEx, s32 nUnitType, s32 nTxtFileNo, s32 nMode, s32 nXpos, s32 nYpos
) {
  u32 stk[5] = { (u32)nUnitType, (u32)nTxtFileNo, (u32)nMode, (u32)nXpos, (u32)nYpos };
  u32 r_eax = (u32)RVA(0x6FD94480);
  u32 r_ecx = pMemPool;
  u32 r_esi = pRoomEx;
  u32 r_edx = (u32)(uintptr_t)stk;
  __asm__ volatile (
    "push 16(%3)\n\t"
    "push 12(%3)\n\t"
    "push 8(%3)\n\t"
    "push 4(%3)\n\t"
    "push 0(%3)\n\t"
    "call *%0\n\t"
    : "+a"(r_eax), "+c"(r_ecx), "+S"(r_esi), "+d"(r_edx)
    :
    : "ebx", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 5. 0x6FD94950: eax = pRoomExAdj, esi = pRoomEx, [esp+4] = nDirection, ret 4 */
static __attribute__((noinline)) void call_6FD94950(
  u32 pRoomExAdj, u32 pRoomEx, s32 nDirection
) {
  u32 r_eax = pRoomExAdj;
  u32 r_esi = pRoomEx;
  u32 r_ecx = (u32)nDirection;
  u32 r_edx = (u32)RVA(0x6FD94950);
  __asm__ volatile (
    "push %2\n\t"
    "call *%3\n\t"
    : "+a"(r_eax), "+S"(r_esi), "+c"(r_ecx), "+d"(r_edx)
    :
    : "ebx", "edi", "cc", "memory"
  );
}

/* 6. 0x6FD94BD0: ebx = pLevel, [esp+4] = nRoomType -> eax, ret 4 */
static __attribute__((noinline)) u32 call_6FD94BD0(u32 pLevel, s32 nRoomType) {
  u32 r_eax = (u32)RVA(0x6FD94BD0);
  u32 r_ebx = pLevel;
  u32 r_ecx = (u32)nRoomType;
  __asm__ volatile (
    "push %2\n\t"
    "call *%0\n\t"
    : "+a"(r_eax), "+b"(r_ebx), "+c"(r_ecx)
    :
    : "edx", "esi", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 7. 0x6FD94CE0: eax = pRoomEx, edx = nLevelId -> eax, ret */
static __attribute__((noinline)) u32 call_6FD94CE0(u32 pRoomEx, s32 nLevelId) {
  u32 r_eax = pRoomEx;
  u32 r_edx = (u32)nLevelId;
  u32 r_ecx = (u32)RVA(0x6FD94CE0);
  __asm__ volatile (
    "call *%2\n\t"
    : "+a"(r_eax), "+d"(r_edx), "+c"(r_ecx)
    :
    : "ebx", "esi", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 8. 0x6FD958C0: ecx = pBase, edx = nGroup, eax = nIndex -> eax, ret */
static __attribute__((noinline)) u32 call_6FD958C0(u32 pBase, u32 nGroup, u32 nIndex) {
  u32 r_ecx = pBase;
  u32 r_edx = nGroup;
  u32 r_eax = nIndex;
  u32 r_ebx = (u32)RVA(0x6FD958C0);
  __asm__ volatile (
    "call *%3\n\t"
    : "+a"(r_eax), "+c"(r_ecx), "+d"(r_edx), "+b"(r_ebx)
    :
    : "esi", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 9. 0x6FD963F0: eax = nMax, ecx = nMin, edx = pUnit -> eax, ret */
static __attribute__((noinline)) u32 call_6FD963F0(s32 nMax, s32 nMin, u32 pUnit) {
  u32 r_eax = (u32)nMax;
  u32 r_ecx = (u32)nMin;
  u32 r_edx = pUnit;
  u32 r_ebx = (u32)RVA(0x6FD963F0);
  __asm__ volatile (
    "call *%3\n\t"
    : "+a"(r_eax), "+c"(r_ecx), "+d"(r_edx), "+b"(r_ebx)
    :
    : "esi", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 10. 0x6FD964D0: eax = nMax, ecx = nMin, edx = pUnit -> eax, ret */
static __attribute__((noinline)) u32 call_6FD964D0(s32 nMax, s32 nMin, u32 pUnit) {
  u32 r_eax = (u32)nMax;
  u32 r_ecx = (u32)nMin;
  u32 r_edx = pUnit;
  u32 r_ebx = (u32)RVA(0x6FD964D0);
  __asm__ volatile (
    "call *%3\n\t"
    : "+a"(r_eax), "+c"(r_ecx), "+d"(r_edx), "+b"(r_ebx)
    :
    : "esi", "edi", "cc", "memory"
  );
  return r_eax;
}

/* 11. 0x6FDB8400: esi = pRoomEx -> void, ret */
static __attribute__((noinline)) void call_6FDB8400(u32 pRoomEx) {
  u32 r_eax = (u32)RVA(0x6FDB8400);
  u32 r_esi = pRoomEx;
  __asm__ volatile (
    "call *%0\n\t"
    : "+a"(r_eax), "+S"(r_esi)
    :
    : "ecx", "edx", "ebx", "edi", "cc", "memory"
  );
}

/* =========================================================================
 * B042 REGISTER-ONLY INLINE ASM WRAPPERS (12 FUNCTIONS)
 * ========================================================================= */

/* 1. 0x6FD68400: eax = nInsertIdx, ecx = pSubPath, ebx = pnTotalPoints, [esp+4] = pPointsBuf, [esp+8] = pnCurIdx, ret 8 */
static __attribute__((noinline)) void call_6FD68400(
  s32 nInsertIdx, u32 pSubPath, u32 pnTotalPoints, u32 pPointsBuf, u32 pnCurIdx
) {
  u32 r_eax = (u32)nInsertIdx;
  u32 r_ecx = pSubPath;
  u32 r_ebx = pnTotalPoints;
  u32 r_edx = pPointsBuf;
  u32 r_esi = pnCurIdx;
  u32 r_edi = (u32)RVA(0x6FD68400);
  __asm__ volatile (
    "push %4\n\t"
    "push %3\n\t"
    "call *%5\n\t"
    : "+a"(r_eax), "+c"(r_ecx), "+b"(r_ebx), "+d"(r_edx), "+S"(r_esi), "+D"(r_edi)
    :
    : "cc", "memory"
  );
}

/* 9. 0x6FD85160: eax = pContext -> void, ret */
static __attribute__((noinline)) void call_6FD85160(u32 pContext) {
  u32 r_eax = pContext;
  u32 r_ecx = (u32)RVA(0x6FD85160);
  __asm__ volatile (
    "call *%1\n\t"
    : "+a"(r_eax), "+c"(r_ecx)
    :
    : "edx", "ebx", "esi", "edi", "cc", "memory"
  );
}

/* 11. 0x6FD8E080: esi = pPath -> void, ret */
static __attribute__((noinline)) void call_6FD8E080(u32 pPath) {
  u32 r_eax = (u32)RVA(0x6FD8E080);
  u32 r_esi = pPath;
  __asm__ volatile (
    "call *%0\n\t"
    : "+a"(r_eax), "+S"(r_esi)
    :
    : "ecx", "edx", "ebx", "edi", "cc", "memory"
  );
}

/* =========================================================================
 * B034 VECTOR EMISSION (12 FUNCTIONS)
 * ========================================================================= */

static void emit_b034(FILE *fp) {
  /* -----------------------------------------------------------------------
   * 1. 0x6FD59610: DRLGPRESET_ReadFileData113c (4 cases)
   *    (esi = hFile, edi = nSize, [esp+4] = pBuffer)
   * ----------------------------------------------------------------------- */
  {
    u32 sizes[4] = { 0, 4, 12, 24 };
    const char *notes[4] = {
      "zero_size_read",
      "read_4_bytes",
      "read_12_bytes",
      "read_24_bytes",
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 hFile   = PTR(0x100);
      u32 pBuffer = PTR(0x200);
      for (u32 i = 0; i < 32; i++) {
        U8_AT(0x100 + i) = (u8)(0xA0u + c * 17u + i * 3u);
      }
      if (sizes[c] > 0) {
        track_dwords(hFile, (sizes[c] + 3u) & ~3u);
        track_dwords(pBuffer, (sizes[c] + 3u) & ~3u);
      }
      u32 args[3] = { hFile, sizes[c], pBuffer };
      call_6FD59610(hFile, sizes[c], pBuffer);
      emit_case(fp, 0x6FD59610u, c, notes[c], args, 3, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 2. 0x6FD59700: DRLGPRESET_GetFileSize113c (4 cases)
   *    (esi = hFile, [esp+4] = lpFileSizeHigh -> eax)
   * ----------------------------------------------------------------------- */
  {
    struct {
      u32 low, high;
      int useHighPtr;
      const char *note;
    } cases[4] = {
      { 128u, 0u, 0, "size_128_null_high_ptr" },
      { 4096u, 0u, 1, "size_4096_with_high_ptr_0" },
      { 0x12345678u, 0x00000005u, 1, "size_0x12345678_with_high_ptr_5" },
      { 0x80000001u, 0xABCDEF01u, 0, "size_0x80000001_null_high_ptr" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 hFile  = PTR(0x100);
      u32 lpHigh = cases[c].useHighPtr ? PTR(0x200) : 0u;
      U32_AT(0x100 + 0x00) = cases[c].low;
      U32_AT(0x100 + 0x04) = cases[c].high;
      if (cases[c].useHighPtr) {
        U32_AT(0x200) = 0xDEADBEEFu;
        track_dwords(hFile, 8);
        track_dwords(lpHigh, 4);
      } else {
        track_dwords(hFile, 4);
      }
      u32 args[2] = { hFile, lpHigh };
      u32 eax = call_6FD59700(hFile, lpHigh);
      emit_case(fp, 0x6FD59700u, c, cases[c].note, args, 2, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 3. 0x6FD59D90: DRLGPRESET_FreeSaveHeaderBlock113c (4 cases)
   *    (__fastcall(ecx = pMemPool, edx = pBlock))
   * ----------------------------------------------------------------------- */
  {
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pBlock = PTR(0x100 + (u32)c * 0x20);
      u32 off = pBlock - ARENA_ADDR;
      const char *note = "";
      if (c == 0) {
        U32_AT(off + 0x04) = 0;
        note = "block_with_null_pData_frees_only_block";
      } else if (c == 1) {
        U32_AT(off + 0x04) = PTR(0x300);
        note = "block_with_valid_pData_frees_pData_then_block";
      } else if (c == 2) {
        U32_AT(off + 0x04) = PTR(0x340);
        note = "second_block_with_valid_pData";
      } else {
        U32_AT(off + 0x04) = PTR(0x380);
        note = "third_block_with_valid_pData";
      }
      track_dwords(PTR(off + 0x04), 4);
      u32 args[2] = { 0xCAFE0000u, pBlock };
      call_6FD59D90(0xCAFE0000u, pBlock);
      emit_case(fp, 0x6FD59D90u, c, note, args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 4. 0x6FD59DE0: DRLGPRESET_CloneSaveHeaderBlock113c (4 cases)
   *    (__fastcall(ecx = pMemPool, edx = pSrcBlock) -> eax)
   * ----------------------------------------------------------------------- */
  {
    u32 counts[4] = { 0u, 1u, 2u, 4u };
    const char *notes[4] = {
      "clone_0_entries_0_bytes",
      "clone_1_entry_12_bytes",
      "clone_2_entries_24_bytes",
      "clone_4_entries_48_bytes",
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pSrcBlock = PTR(0x100);
      u32 pSrcData  = PTR(0x200);
      u32 nCount    = counts[c];
      U32_AT(0x100 + 0x00) = nCount;
      U32_AT(0x100 + 0x04) = pSrcData;
      for (u32 k = 0; k < nCount * 3u; k++) {
        U32_AT(0x200 + k * 4) = 0x55000000u + (u32)c * 0x100u + k;
      }
      track_dwords(pSrcBlock, 8);
      if (nCount > 0) {
        track_dwords(pSrcData, nCount * 12u);
      }
      u32 args[2] = { 0xCAFE0000u, pSrcBlock };
      u32 eax = call_6FD59DE0(0xCAFE0000u, pSrcBlock);
      emit_case(fp, 0x6FD59DE0u, c, notes[c], args, 2, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 5. 0x6FD59FA0: DRLGPRESET_FreeDrlgFile113c (4 cases)
   *    (__stdcall(pDrlgFile), ret 4)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_void_t fn = (fn_std1_void_t)RVA(0x6FD59FA0);
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pFile = PTR(0x100);
      const char *note = "";
      if (c == 0) {
        U32_AT(0x100 + 0x04) = 0;
        U32_AT(0x100 + 0x50) = 0;
        U32_AT(0x100 + 0x54) = 0;
        note = "empty_drlg_file_frees_only_file_struct";
      } else if (c == 1) {
        U32_AT(0x100 + 0x04) = PTR(0x300); /* pBuffer freed via Fog.#10004 */
        U32_AT(0x100 + 0x50) = PTR(0x340); /* pTileData freed via Fog.#10046 */
        U32_AT(0x100 + 0x54) = 0;
        note = "buffer_and_tileData_freed_no_preset_units";
      } else if (c == 2) {
        u32 pUnit1 = PTR(0x400);
        U32_AT(0x100 + 0x04) = 0;
        U32_AT(0x100 + 0x50) = 0;
        U32_AT(0x100 + 0x54) = pUnit1;
        U32_AT(0x400 + 0x0C) = 0;
        U32_AT(0x400 + 0x10) = 0; /* pSaveChain == 0 */
        track_dwords(PTR(0x400 + 0x0C), 8);
        note = "single_preset_unit_without_save_chain";
      } else {
        u32 pUnit1     = PTR(0x400);
        u32 pUnit2     = PTR(0x440);
        u32 pSaveChain = PTR(0x500);
        U32_AT(0x100 + 0x04) = PTR(0x300);
        U32_AT(0x100 + 0x50) = PTR(0x340);
        U32_AT(0x100 + 0x54) = pUnit1;
        U32_AT(0x400 + 0x0C) = pUnit2;
        U32_AT(0x400 + 0x10) = pSaveChain;
        U32_AT(0x500 + 0x04) = PTR(0x600);
        U32_AT(0x440 + 0x0C) = 0;
        U32_AT(0x440 + 0x10) = 0;
        track_dwords(PTR(0x400 + 0x0C), 8);
        track_dwords(PTR(0x440 + 0x0C), 8);
        track_dwords(PTR(0x500 + 0x04), 4);
        note = "two_preset_units_with_save_chain_and_buffers";
      }
      track_dwords(PTR(0x100 + 0x04), 4);
      track_dwords(PTR(0x100 + 0x50), 8);
      u32 args[1] = { pFile };
      fn(pFile);
      emit_case(fp, 0x6FD59FA0u, c, note, args, 1, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 6. 0x6FD5A440: DRLGPRESET_FreePresetRoomGrids113c (4 cases)
   *    (eax = pRoomEx, ebx = pMemPool)
   * ----------------------------------------------------------------------- */
  {
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx     = PTR(0x100);
      u32 pPresetRoom = PTR(0x200);
      u32 pDrlgMap    = PTR(0x340);
      u32 pDrlgFile   = PTR(0x3C0);

      U32_AT(0x100 + 0x20) = pPresetRoom;
      U32_AT(0x200 + 0x08) = pDrlgMap;
      U32_AT(0x340 + 0x0C) = pDrlgFile;

      const char *note = "";
      if (c == 0) {
        U32_AT(0x3C0 + 0x14) = 0;
        U32_AT(0x3C0 + 0x18) = 0;
        U32_AT(0x200 + 0xD8) = 0x9999u;
        U32_AT(0x200 + 0xDC) = 0;
        note = "zero_walls_zero_floors_null_shadow";
      } else if (c == 1) {
        U32_AT(0x3C0 + 0x14) = 2; /* nWalls */
        U32_AT(0x3C0 + 0x18) = 1; /* nFloors */
        U32_AT(0x200 + 0x10) = 0xAA01u;
        U32_AT(0x200 + 0x14) = PTR(0x500);
        U32_AT(0x200 + 0x24) = 0xAA02u;
        U32_AT(0x200 + 0x28) = 0;
        U32_AT(0x200 + 0x60) = 0xBB01u;
        U32_AT(0x200 + 0x64) = PTR(0x510);
        U32_AT(0x200 + 0x74) = 0xBB02u;
        U32_AT(0x200 + 0x78) = PTR(0x520);
        U32_AT(0x200 + 0xB0) = 0xCC01u;
        U32_AT(0x200 + 0xB4) = PTR(0x530);
        U32_AT(0x200 + 0xD8) = 0xDD01u;
        U32_AT(0x200 + 0xDC) = PTR(0x540);
        note = "two_walls_one_floor_and_shadow_freed";
      } else if (c == 2) {
        U32_AT(0x3C0 + 0x14) = 1;
        U32_AT(0x3C0 + 0x18) = 2;
        U32_AT(0x200 + 0x10) = 0xAA10u;
        U32_AT(0x200 + 0x14) = PTR(0x600);
        U32_AT(0x200 + 0x60) = 0xBB10u;
        U32_AT(0x200 + 0x64) = 0;
        U32_AT(0x200 + 0xB0) = 0xCC10u;
        U32_AT(0x200 + 0xB4) = PTR(0x610);
        U32_AT(0x200 + 0xC4) = 0xCC20u;
        U32_AT(0x200 + 0xC8) = PTR(0x620);
        U32_AT(0x200 + 0xD8) = 0xDD10u;
        U32_AT(0x200 + 0xDC) = 0;
        note = "one_wall_two_floors_null_shadow";
      } else {
        U32_AT(0x3C0 + 0x14) = 3;
        U32_AT(0x3C0 + 0x18) = 2;
        for (int i = 0; i < 3; i++) {
          U32_AT(0x200 + 0x10 + i * 0x14) = 0x1000u + (u32)i;
          U32_AT(0x200 + 0x14 + i * 0x14) = PTR(0x700 + i * 0x10);
          U32_AT(0x200 + 0x60 + i * 0x14) = 0x2000u + (u32)i;
          U32_AT(0x200 + 0x64 + i * 0x14) = PTR(0x740 + i * 0x10);
        }
        for (int i = 0; i < 2; i++) {
          U32_AT(0x200 + 0xB0 + i * 0x14) = 0x3000u + (u32)i;
          U32_AT(0x200 + 0xB4 + i * 0x14) = PTR(0x780 + i * 0x10);
        }
        U32_AT(0x200 + 0xD8) = 0x4000u;
        U32_AT(0x200 + 0xDC) = PTR(0x7C0);
        note = "three_walls_two_floors_and_shadow_freed";
      }

      track_dwords(pRoomEx, 0x340);
      u32 args[2] = { pRoomEx, 0xCAFE0000u };
      call_6FD5A440(pRoomEx, 0xCAFE0000u);
      emit_case(fp, 0x6FD5A440u, c, note, args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 7. 0x6FD5AA80: DRLGPRESET_BuildRoomTombCoords113c (4 cases)
   *    (__stdcall(pRoomEx), ret 4)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_void_t fn = (fn_std1_void_t)RVA(0x6FD5AA80);
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx     = PTR(0x100);
      u32 pPresetRoom = PTR(0x200);
      u32 pRowOffsets = PTR(0x340);
      u32 pCells      = PTR(0x400);

      U32_AT(0x100 + 0x20) = pPresetRoom;
      S32_AT(0x100 + 0x34) = 10; /* nTileXPos */
      S32_AT(0x100 + 0x38) = 20; /* nTileYPos */
      S32_AT(0x100 + 0x3C) = 3;  /* nTileWidth */
      S32_AT(0x100 + 0x40) = 2;  /* nTileHeight */

      U32_AT(0x200 + 0x10) = pCells;
      U32_AT(0x200 + 0x14) = pRowOffsets;
      U32_AT(0x340 + 0x00) = 0;
      U32_AT(0x340 + 0x04) = 3;

      const char *note = "";
      if (c == 0) {
        U32_AT(0x200 + 0xF0) = PTR(0x800); /* already allocated -> early return */
        note = "already_allocated_pTombCoords_early_return";
      } else if (c == 1) {
        U32_AT(0x400 + 0 * 4) = (9u << 20) | (24u << 8);
        U32_AT(0x400 + 1 * 4) = (10u << 20) | (22u << 8);
        U32_AT(0x400 + 2 * 4) = (10u << 20) | (28u << 8);
        note = "no_matching_tomb_tiles_count_0";
      } else if (c == 2) {
        U32_AT(0x400 + 1 * 4) = (10u << 20) | (23u << 8);
        U32_AT(0x400 + 5 * 4) = (10u << 20) | (27u << 8);
        note = "two_matching_tomb_tiles_recorded";
      } else {
        S32_AT(0x100 + 0x3C) = 4;
        S32_AT(0x100 + 0x40) = 2;
        U32_AT(0x340 + 0x04) = 4;
        for (int i = 0; i < 7; i++) {
          U32_AT(0x400 + i * 4) = (10u << 20) | ((23u + (u32)(i % 5)) << 8);
        }
        note = "seven_matching_tomb_tiles_capped_at_6";
      }

      track_dwords(pRoomEx, 0x340);
      u32 args[1] = { pRoomEx };
      fn(pRoomEx);
      emit_case(fp, 0x6FD5AA80u, c, note, args, 1, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 8. 0x6FD5BC60: DRLGPRESET_AllocDrlgMap113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pSeed   = PTR(0x100);
      u32 pLevel  = PTR(0x200);
      u32 pDrlg   = PTR(0x400);
      u32 pBox    = PTR(0x900);
      u32 pSgpt   = PTR(0xA00);
      u32 pPrests = PTR(0x2000);

      U32_AT(0x100 + 0x00) = 0x12345678u;
      U32_AT(0x100 + 0x04) = 0x9ABCDEF0u;
      U32_AT(0x200 + 0x1B0) = (c == 3) ? PTR(0x880) : 0;
      U32_AT(0x200 + 0x1B4) = pDrlg;
      U32_AT(0x400 + 0x478) = 0xCAFE0000u;

      S32_AT(0x900 + 0x00) = 15;
      S32_AT(0x900 + 0x04) = 25;
      S32_AT(0x900 + 0x08) = 8;
      S32_AT(0x900 + 0x0C) = 12;

      *(u32 *)RVA(0x6FDE9E1C) = pSgpt;
      *(u32 *)RVA(0x6FDF0B3C) = pPrests;
      S32_AT(0xA00 + 0xC68) = 10;

      s32 nLvlPrestId = (c == 0) ? 1 : (c == 1) ? 2 : (c == 2) ? 3 : 0;
      u32 recOff = 0x2000u + (u32)nLvlPrestId * 0x1B0u;
      const char *note = "";
      if (c == 0) {
        S32_AT(recOff + 0x40) = 0; /* nFiles <= 0 -> picked = 0 */
        S32_AT(recOff + 0x28) = 20;
        S32_AT(recOff + 0x2C) = 30;
        note = "nFiles_0_uses_prest_size";
      } else if (c == 1) {
        S32_AT(recOff + 0x40) = 4; /* power-of-two nFiles */
        S32_AT(recOff + 0x28) = 0; /* sizeX == 0 -> uses pBox size */
        S32_AT(recOff + 0x2C) = 30;
        note = "power_of_two_nFiles_4_and_sizeX_0_uses_box_size";
      } else if (c == 2) {
        S32_AT(recOff + 0x40) = 3; /* non-power-of-two nFiles */
        S32_AT(recOff + 0x28) = 20;
        S32_AT(recOff + 0x2C) = 0; /* sizeY == 0 -> uses pBox size */
        note = "non_pow2_nFiles_3_and_sizeY_0_uses_box_size";
      } else {
        S32_AT(recOff + 0x40) = 6;
        S32_AT(recOff + 0x28) = 16;
        S32_AT(recOff + 0x2C) = 24;
        note = "prepends_to_existing_pMap_head";
      }

      track_dwords(pSeed, 8);
      track_dwords(PTR(0x200 + 0x1B0), 8);
      track_dwords(PTR(0x400 + 0x478), 4);
      track_dwords(pBox, 0x10);
      track_dwords(PTR(0xA00 + 0xC68), 4);
      track_dwords(PTR(recOff), 0x48);
      track_dwords((u32)RVA(0x6FDE9E1C), 4);
      track_dwords((u32)RVA(0x6FDF0B3C), 4);

      u32 args[4] = { pSeed, pLevel, (u32)nLvlPrestId, pBox };
      u32 eax = call_6FD5BC60(pSeed, pLevel, nLvlPrestId, pBox);
      emit_case(fp, 0x6FD5BC60u, c, note, args, 4, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 9. 0x6FD86760: SEED_GenerateLoopSeed113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      u32 time_sec;
      u32 ticks;
      s32 salt;
      const char *note;
    } cases[4] = {
      { 0u, 0u, 0, "zero_time_ticks_salt" },
      { 1700000000u, 12345678u, 42, "standard_time_ticks_and_salt" },
      { 987654321u, 0xABCDEF01u, -100, "negative_salt_and_high_ticks" },
      { 0x7FFFFFFFu, 0x13579BDFu, 0x2468ACE0, "large_inputs_masked_31bit_seed" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      g_mock_time_sec = cases[c].time_sec;
      g_mock_tick_count = cases[c].ticks;

      *(u32 *)RVA(0x6FDD91D4) = g_mock_time_sec;
      *(u32 *)RVA(0x6FDD91FC) = g_mock_tick_count;
      track_dwords((u32)RVA(0x6FDD91D4), 4);
      track_dwords((u32)RVA(0x6FDD91FC), 4);

      *(uintptr_t *)RVA(0x6FDD91D4) = (uintptr_t)stub_get_filetime;
      *(uintptr_t *)RVA(0x6FDD91FC) = (uintptr_t)stub_get_tick_count;
      u32 args[1] = { (u32)cases[c].salt };
      u32 eax = call_6FD86760(cases[c].salt);
      *(u32 *)RVA(0x6FDD91D4) = g_mock_time_sec;
      *(u32 *)RVA(0x6FDD91FC) = g_mock_tick_count;

      emit_case(fp, 0x6FD86760u, c, cases[c].note, args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 10. 0x6FD86840: DRLGGRID_AllocGridWindowRowOffsets113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      s32 posX, posY, width, height, stride;
      u32 baseCells;
      const char *note;
    } cases[4] = {
      { 0, 0, 4, 0, 8, 0x20000000u, "zero_height_window" },
      { 2, 3, 5, 1, 10, 0x20000000u, "single_row_window_with_offset" },
      { 1, 2, 6, 4, 12, 0x20000100u, "four_row_window_stride_12" },
      { 0, 4, 8, 6, 16, 0x20000200u, "six_row_window_stride_16" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pOutGrid   = PTR(0x100);
      u32 pWindowBox = PTR(0x200);
      S32_AT(0x200 + 0x00) = cases[c].posX;
      S32_AT(0x200 + 0x04) = cases[c].posY;
      S32_AT(0x200 + 0x08) = cases[c].width;
      S32_AT(0x200 + 0x0C) = cases[c].height;
      track_dwords(pOutGrid, 0x14);
      track_dwords(pWindowBox, 0x10);
      u32 args[5] = { pOutGrid, pWindowBox, (u32)cases[c].stride, 0, cases[c].baseCells };
      call_6FD86840(pOutGrid, pWindowBox, cases[c].stride, 0, cases[c].baseCells);
      emit_case(fp, 0x6FD86840u, c, cases[c].note, args, 5, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 11. 0x6FD86950: DRLGGRID_AllocAndInitGridCells113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      s32 w, h;
      const char *note;
    } cases[4] = {
      { 4, 0, "zero_height_grid" },
      { 3, 1, "single_row_grid_3x1" },
      { 4, 3, "grid_4x3" },
      { 6, 4, "grid_6x4" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pOutGrid = PTR(0x100);
      U32_AT(0x100 + 0x10) = 1; /* verify bInitialized is cleared to 0 */
      track_dwords(pOutGrid, 0x14);
      u32 args[4] = { pOutGrid, 0, (u32)cases[c].w, (u32)cases[c].h };
      call_6FD86950(pOutGrid, 0, cases[c].w, cases[c].h);
      emit_case(fp, 0x6FD86950u, c, cases[c].note, args, 4, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 12. 0x6FDD0F70: DRLGLOGIC_FreeRoomLogicalInfo113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_void_t fn = (fn_std1_void_t)RVA(0x6FDD0F70);
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx = PTR(0x100);
      u32 pLevel  = PTR(0x200);
      u32 pDrlg   = PTR(0x400);
      U32_AT(0x100 + 0x58) = pLevel;
      U32_AT(0x200 + 0x1B4) = pDrlg;
      U32_AT(0x400 + 0x478) = 0xCAFE0000u;

      const char *note = "";
      if (c == 0) {
        U32_AT(0x100 + 0x64) = 0;
        note = "null_logical_info_noop";
      } else if (c == 1) {
        u32 pLogic = PTR(0x900);
        U32_AT(0x100 + 0x64) = pLogic;
        U32_AT(0x900 + 0x00) = 0x00; /* bit 0x02 clear */
        U32_AT(0x900 + 0x08) = 0x1111u;
        U32_AT(0x900 + 0x0C) = PTR(0xA00);
        U32_AT(0x900 + 0x30) = 0;
        track_dwords(pLogic, 0x34);
        note = "flag_0x02_clear_no_list_frees_only_logic_struct";
      } else if (c == 2) {
        u32 pLogic = PTR(0x900);
        U32_AT(0x100 + 0x64) = pLogic;
        U32_AT(0x900 + 0x00) = 0x02; /* bit 0x02 set */
        U32_AT(0x900 + 0x08) = 0x1111u;
        U32_AT(0x900 + 0x0C) = PTR(0xA00);
        U32_AT(0x900 + 0x1C) = 0x2222u;
        U32_AT(0x900 + 0x20) = PTR(0xA40);
        U32_AT(0x900 + 0x30) = 0;
        track_dwords(pLogic, 0x34);
        note = "flag_0x02_set_frees_both_grids_and_logic_struct";
      } else {
        u32 pLogic = PTR(0x900);
        u32 pNode1 = PTR(0xB00);
        u32 pNode2 = PTR(0xB40);
        U32_AT(0x100 + 0x64) = pLogic;
        U32_AT(0x900 + 0x00) = 0x02;
        U32_AT(0x900 + 0x08) = 0x3333u;
        U32_AT(0x900 + 0x0C) = 0;
        U32_AT(0x900 + 0x1C) = 0x4444u;
        U32_AT(0x900 + 0x20) = PTR(0xA80);
        U32_AT(0x900 + 0x30) = pNode1;
        U32_AT(0xB00 + 0x2C) = pNode2;
        U32_AT(0xB40 + 0x2C) = 0;
        track_dwords(pLogic, 0x34);
        track_dwords(pNode1, 0x80);
        note = "flag_0x02_and_two_coord_list_nodes_freed";
      }

      track_dwords(PTR(0x100 + 0x58), 0x10);
      track_dwords(PTR(0x200 + 0x1B4), 4);
      track_dwords(PTR(0x400 + 0x478), 4);
      u32 args[1] = { pRoomEx };
      fn(pRoomEx);
      emit_case(fp, 0x6FDD0F70u, c, note, args, 1, 0);
    }
  }
}

/* =========================================================================
 * B037 VECTOR EMISSION (11 FUNCTIONS)
 * ========================================================================= */

static void emit_b037(FILE *fp) {
  /* -----------------------------------------------------------------------
   * 1. 0x6FD5AF20: DRLGPRESET_SpawnHoradricOrifice113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      s32 posX, posY, sizeX, sizeY;
      s32 nObjects;
      u32 existingHead;
      const char *note;
    } cases[4] = {
      { 10, 20, 8, 12, 300, 0, "even_sizes_nObjects_gt_266_spawns_266" },
      { 5, 7, 9, 11, 266, 0, "odd_sizes_nObjects_eq_266_spawns_minus1" },
      { -4, -6, -5, -3, 500, PTR(0x500), "negative_coords_prepends_to_existing_head" },
      { 0, 0, 1, 1, 100, PTR(0x600), "small_1x1_nObjects_lt_266_spawns_minus1" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pDrlgMap = PTR(0x100);
      u32 pSgpt    = PTR(0x200);
      S32_AT(0x100 + 0x10) = cases[c].posX;
      S32_AT(0x100 + 0x14) = cases[c].posY;
      S32_AT(0x100 + 0x18) = cases[c].sizeX;
      S32_AT(0x100 + 0x1C) = cases[c].sizeY;
      U32_AT(0x100 + 0x38) = cases[c].existingHead;

      *(u32 *)RVA(0x6FDE9E1C) = pSgpt;
      S32_AT(0x200 + 0xA80) = cases[c].nObjects;

      track_dwords(pDrlgMap, 0x40);
      track_dwords(PTR(0x200 + 0xA80), 4);
      track_dwords((u32)RVA(0x6FDE9E1C), 4);

      u32 args[2] = { pDrlgMap, 0 };
      call_6FD5AF20(pDrlgMap, 0);
      emit_case(fp, 0x6FD5AF20u, c, cases[c].note, args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 2. 0x6FD5AFD0: DRLGPRESET_SpawnMapAIPathPresets113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pDrlgMap    = PTR(0x100);
      u32 pOrientGrid = PTR(0x200);
      u32 pRowOffsets = PTR(0x300);
      u32 pCells      = PTR(0x400);

      S32_AT(0x100 + 0x10) = 10; /* nPosX */
      S32_AT(0x100 + 0x14) = 20; /* nPosY */
      S32_AT(0x100 + 0x18) = 8;  /* nSizeX */
      U32_AT(0x200 + 0x00) = pCells;
      U32_AT(0x200 + 0x04) = pRowOffsets;
      for (int r = 0; r < 6; r++) {
        U32_AT(0x300 + r * 4) = (u32)(r * 4);
      }

      s32 nLocalX = 2;
      const char *note = "";
      if (c == 0) {
        S32_AT(0x100 + 0x1C) = 0; /* nSizeY <= 0 */
        note = "sizeY_0_noop";
      } else if (c == 1) {
        S32_AT(0x100 + 0x1C) = 2; /* 2 rows, non-matching style */
        U32_AT(0x400 + (0 * 4 + 2) * 4) = (3u << 20) | (4u << 8);
        U32_AT(0x400 + (1 * 4 + 2) * 4) = (4u << 20) | (5u << 8);
        note = "two_rows_no_skip_spawns_10_nodes";
      } else if (c == 2) {
        S32_AT(0x100 + 0x1C) = 5; /* row 0 matches style=4, seq=4 -> skips +3 to row 4 */
        U32_AT(0x400 + (0 * 4 + 2) * 4) = (4u << 20) | (4u << 8);
        U32_AT(0x400 + (4 * 4 + 2) * 4) = (4u << 20) | (0x28u << 8);
        note = "style_4_seq_4_skips_3_rows_spawns_rows_0_and_4";
      } else {
        S32_AT(0x100 + 0x1C) = 5;
        nLocalX = -2;
        U32_AT(0x400 + (0 * 4 + 0) * 4) = (4u << 20) | (0x27u << 8);
        U32_AT(0x400 + (4 * 4 + 0) * 4) = (4u << 20) | (0x1Du << 8);
        note = "negative_localX_clamps_grid_lookup_and_seq_39_29_skip";
      }

      track_dwords(pDrlgMap, 0x40);
      track_dwords(pOrientGrid, 0x14);
      track_dwords(pRowOffsets, 0x18);
      track_dwords(pCells, 0x60);
      track_dwords((u32)RVA(0x6FD5B260), 0x28);

      u32 args[4] = { pDrlgMap, 0, (u32)nLocalX, pOrientGrid };
      call_6FD5AFD0(pDrlgMap, 0, nLocalX, pOrientGrid);
      emit_case(fp, 0x6FD5AFD0u, c, note, args, 4, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 3. 0x6FD5B290: DRLGPRESET_SpawnFortressWall2Presets113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      s32 worldY, worldX, fileWidth;
      u32 head;
      const char *note;
    } cases[4] = {
      { 10, 20, 0, 0, "zero_width_noop" },
      { 10, 20, -4, 0, "negative_width_noop" },
      { 6, 4, 8, 0, "width_8_spawns_1_preset_node" },
      { 12, 10, 20, PTR(0x500), "width_20_spawns_3_preset_nodes_step_40" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pDrlgMap  = PTR(0x100);
      u32 pDrlgFile = PTR(0x200);
      U32_AT(0x100 + 0x0C) = pDrlgFile;
      U32_AT(0x100 + 0x38) = cases[c].head;
      S32_AT(0x200 + 0x10) = cases[c].fileWidth;

      track_dwords(pDrlgMap, 0x40);
      track_dwords(pDrlgFile, 0x20);

      u32 args[4] = { (u32)cases[c].worldY, (u32)cases[c].worldX, pDrlgMap, 0 };
      call_6FD5B290(cases[c].worldY, cases[c].worldX, pDrlgMap, 0);
      emit_case(fp, 0x6FD5B290u, c, cases[c].note, args, 4, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 4. 0x6FD94480: DRLGROOM_AllocPresetUnit113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx = (c == 0) ? 0 : PTR(0x100);
      if (c == 1) {
        U32_AT(0x100 + 0x5C) = 0;
        track_dwords(pRoomEx, 0x64);
      } else if (c >= 2) {
        U32_AT(0x100 + 0x5C) = PTR(0x300 + (u32)c * 0x20);
        track_dwords(pRoomEx, 0x64);
      }
      s32 nUnitType  = 1 + c;
      s32 nTxtFileNo = 100 + c * 10;
      s32 nMode      = c % 3;
      s32 nXpos      = 15 + c * 5;
      s32 nYpos      = 25 + c * 5;
      const char *note = (c == 0)
        ? "null_roomEx_returns_standalone_node"
        : (c == 1)
          ? "valid_roomEx_empty_list_links_head"
          : (c == 2)
            ? "valid_roomEx_prepends_to_existing_head"
            : "valid_roomEx_second_prepend";
      u32 args[7] = {
        0, pRoomEx, (u32)nUnitType, (u32)nTxtFileNo, (u32)nMode, (u32)nXpos, (u32)nYpos
      };
      u32 eax = call_6FD94480(0, pRoomEx, nUnitType, nTxtFileNo, nMode, nXpos, nYpos);
      emit_case(fp, 0x6FD94480u, c, note, args, 7, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 5. 0x6FD94950: DRLGROOM_AddOrthRoomData113c (4 cases)
   *    (args: pRoomExAdj, pRoomEx, nDirection)
   * ----------------------------------------------------------------------- */
  {
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx    = PTR(0x100);
      u32 pAdjRoomEx = PTR(0x200);
      u32 pLevel     = PTR(0x300);
      u32 pDrlg      = PTR(0x500);
      U32_AT(0x100 + 0x58) = pLevel;
      U32_AT(0x300 + 0x1B4) = pDrlg;
      U32_AT(0x500 + 0x478) = 0xCAFE0000u;

      const char *note = "";
      if (c == 0) {
        U32_AT(0x100 + 0x00) = 0;
        note = "empty_orth_list_allocates_and_links";
      } else if (c == 1) {
        u32 pNode1 = PTR(0xA00);
        U32_AT(0x100 + 0x00) = pNode1;
        U32_AT(0xA00 + 0x00) = pAdjRoomEx; /* duplicate at head */
        U32_AT(0xA00 + 0x14) = 0;
        track_dwords(pNode1, 0x18);
        note = "duplicate_at_head_returns_without_alloc";
      } else if (c == 2) {
        u32 pNode1 = PTR(0xA00);
        u32 pNode2 = PTR(0xA40);
        U32_AT(0x100 + 0x00) = pNode1;
        U32_AT(0xA00 + 0x00) = PTR(0x280);
        U32_AT(0xA00 + 0x14) = pNode2;
        U32_AT(0xA40 + 0x00) = pAdjRoomEx; /* duplicate at second node */
        U32_AT(0xA40 + 0x14) = 0;
        track_dwords(pNode1, 0x58);
        note = "duplicate_at_second_node_returns_without_alloc";
      } else {
        u32 pNode1 = PTR(0xA00);
        U32_AT(0x100 + 0x00) = pNode1;
        U32_AT(0xA00 + 0x00) = PTR(0x280);
        U32_AT(0xA00 + 0x14) = 0;
        track_dwords(pNode1, 0x18);
        note = "non_matching_existing_node_allocates_and_prepends";
      }

      track_dwords(pRoomEx, 0x60);
      track_dwords(PTR(0x300 + 0x1B4), 4);
      track_dwords(PTR(0x500 + 0x478), 4);

      u32 args[3] = { pAdjRoomEx, pRoomEx, (u32)(c & 3) };
      call_6FD94950(pAdjRoomEx, pRoomEx, c & 3);
      emit_case(fp, 0x6FD94950u, c, note, args, 3, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 6. 0x6FD94BD0: DRLGROOM_AllocRoomEx113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      u32 lvlFlags;
      s32 roomType;
      u32 seedLo, seedHi;
      const char *note;
    } cases[4] = {
      { 0x00u, 1, 0x12345678u, 0x9ABCDEF0u, "type_1_maze_room_no_flag_0x10" },
      { 0x10u, 2, 0xCAFEBABEu, 0x0000029Au, "type_2_preset_room_with_flag_0x10_sets_0x40000" },
      { 0x10u, 1, 0x00000001u, 0x00000002u, "type_1_maze_room_with_flag_0x10" },
      { 0x00u, 3, 0x87654321u, 0x11223344u, "type_3_neither_maze_nor_preset" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pLevel = PTR(0x100);
      u32 pDrlg  = PTR(0x400);
      U32_AT(0x100 + 0x04) = cases[c].lvlFlags;
      U32_AT(0x100 + 0x1B4) = pDrlg;
      U32_AT(0x100 + 0x1C4) = cases[c].seedLo;
      U32_AT(0x100 + 0x1C8) = cases[c].seedHi;
      U32_AT(0x400 + 0x478) = 0xCAFE0000u;

      track_dwords(pLevel, 0x1D0);
      track_dwords(PTR(0x400 + 0x478), 4);

      u32 args[2] = { pLevel, (u32)cases[c].roomType };
      u32 eax = call_6FD94BD0(pLevel, cases[c].roomType);
      emit_case(fp, 0x6FD94BD0u, c, cases[c].note, args, 2, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 7. 0x6FD94CE0: DRLGWARP_GetWarpDstAdjustData113c (4 cases)
   *    (eax = pRoomEx, edx = nLevelId -> eax)
   * ----------------------------------------------------------------------- */
  {
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx    = PTR(0x100);
      u32 pWarpNode1 = PTR(0x200);
      u32 pWarpNode2 = PTR(0x260);
      u32 pSgpt      = PTR(0x400);
      u32 pLevelsTxt = PTR(0x2000);

      *(u32 *)RVA(0x6FDE9E1C) = pSgpt;
      *(u32 *)RVA(0x6FDF0B38) = pLevelsTxt;
      S32_AT(0x400 + 0xC5C) = 136;

      s32 nLevelId = 10;
      const char *note = "";
      if (c == 0) {
        U32_AT(0x100 + 0x90) = pWarpNode1;
        S32_AT(0x200 + 0x00) = 10;
        U32_AT(0x200 + 0x44) = 0;
        track_dwords(PTR(0x100 + 0x90), 4);
        track_dwords(pWarpNode1, 0x48);
        note = "matches_first_warp_node_returns_pWarp_plus_4";
      } else if (c == 1) {
        U32_AT(0x100 + 0x90) = pWarpNode1;
        S32_AT(0x200 + 0x00) = 5;
        U32_AT(0x200 + 0x44) = pWarpNode2;
        S32_AT(0x260 + 0x00) = 10;
        U32_AT(0x260 + 0x44) = 0;
        track_dwords(PTR(0x100 + 0x90), 4);
        track_dwords(pWarpNode1, 0xA8);
        note = "matches_second_warp_node_returns_pWarp2_plus_4";
      } else if (c == 2) {
        U32_AT(0x100 + 0x90) = 0;
        nLevelId = 12;
        track_dwords(PTR(0x100 + 0x90), 4);
        track_dwords(PTR(0x400 + 0xC5C), 4);
        track_dwords((u32)RVA(0x6FDE9E1C), 4);
        track_dwords((u32)RVA(0x6FDF0B38), 4);
        note = "no_warp_node_falls_back_to_levelsTxt_record_plus_0x48";
      } else {
        U32_AT(0x100 + 0x90) = 0;
        nLevelId = 200; /* >= 136 -> returns 0x48 */
        track_dwords(PTR(0x100 + 0x90), 4);
        track_dwords(PTR(0x400 + 0xC5C), 4);
        track_dwords((u32)RVA(0x6FDE9E1C), 4);
        note = "out_of_range_levelId_returns_0x48";
      }

      u32 args[2] = { pRoomEx, (u32)nLevelId };
      u32 eax = call_6FD94CE0(pRoomEx, nLevelId);
      emit_case(fp, 0x6FD94CE0u, c, note, args, 2, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 8. 0x6FD958C0: DRLG_GetAutomapCoordSlotPtr113c (4 cases)
   *    (ecx = pBase, edx = nGroup, eax = nIndex -> eax)
   * ----------------------------------------------------------------------- */
  {
    struct {
      u32 pBase, nGroup, nIndex;
      const char *note;
    } cases[4] = {
      { 0x10000100u, 0u, 0u, "group_0_index_0" },
      { 0x10000100u, 1u, 2u, "group_1_index_2" },
      { 0x10000200u, 2u, 1u, "group_2_index_1" },
      { 0x10000400u, 2u, 2u, "group_2_index_2_max" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 args[3] = { cases[c].pBase, cases[c].nGroup, cases[c].nIndex };
      u32 eax = call_6FD958C0(cases[c].pBase, cases[c].nGroup, cases[c].nIndex);
      emit_case(fp, 0x6FD958C0u, c, cases[c].note, args, 3, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 9. 0x6FD963F0: DRLGROOM_RollItemCoordinate113c (4 cases)
   *    (eax = nMax, ecx = nMin, edx = pUnit -> eax)
   * ----------------------------------------------------------------------- */
  {
    struct {
      s32 nMax, nMin;
      u16 flag30;
      u32 seedLo, seedHi;
      const char *note;
    } cases[4] = {
      { 50, 50, 0u, 0x11111111u, 0x22222222u, "max_equals_min_returns_min_without_touching_unit" },
      { 100, 116, 0u, 0x12345678u, 0x9ABCDEF0u, "max_lt_min_swaps_pow2_range_16_flag30_0" },
      { 250, 200, 1u, 0xCAFEBABEu, 0x13579BDFu, "flag30_1_adds_1_to_range_51_modulo_branch" },
      { 131, 100, 2u, 0x87654321u, 0x2468ACE0u, "flag30_2_makes_range_32_pow2_branch" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pUnit     = PTR(0x100);
      u32 pItemData = PTR(0x200);
      if (c > 0) {
        U32_AT(0x100 + 0x00) = 4u; /* UNIT_ITEM */
        U32_AT(0x100 + 0x14) = pItemData;
        U32_AT(0x200 + 0x04) = cases[c].seedLo;
        U32_AT(0x200 + 0x08) = cases[c].seedHi;
        U16_AT(0x200 + 0x30) = cases[c].flag30;
        track_dwords(pUnit, 0x18);
        track_dwords(pItemData, 0x34);
      }
      u32 args[3] = { (u32)cases[c].nMax, (u32)cases[c].nMin, pUnit };
      u32 eax = call_6FD963F0(cases[c].nMax, cases[c].nMin, pUnit);
      emit_case(fp, 0x6FD963F0u, c, cases[c].note, args, 3, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 10. 0x6FD964D0: DRLGROOM_RollItemCoordinateAlt113c (4 cases)
   *     (eax = nMax, ecx = nMin, edx = pUnit -> eax)
   * ----------------------------------------------------------------------- */
  {
    struct {
      s32 nMax, nMin;
      u16 flag30;
      u32 seedLo, seedHi;
      const char *note;
    } cases[4] = {
      { 75, 75, 0u, 0x33333333u, 0x44444444u, "max_equals_min_returns_min_without_touching_unit" },
      { 300, 332, 0u, 0x12345678u, 0x9ABCDEF0u, "max_lt_min_swaps_pow2_range_32_flag30_0" },
      { 440, 400, 1u, 0xCAFEBABEu, 0x13579BDFu, "flag30_1_adds_1_to_range_41_modulo_branch" },
      { 115, 100, 1u, 0x87654321u, 0x2468ACE0u, "flag30_1_makes_range_16_pow2_branch" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pUnit     = PTR(0x100);
      u32 pItemData = PTR(0x200);
      if (c > 0) {
        U32_AT(0x100 + 0x00) = 4u;
        U32_AT(0x100 + 0x14) = pItemData;
        U32_AT(0x200 + 0x04) = cases[c].seedLo;
        U32_AT(0x200 + 0x08) = cases[c].seedHi;
        U16_AT(0x200 + 0x30) = cases[c].flag30;
        track_dwords(pUnit, 0x18);
        track_dwords(pItemData, 0x34);
      }
      u32 args[3] = { (u32)cases[c].nMax, (u32)cases[c].nMin, pUnit };
      u32 eax = call_6FD964D0(cases[c].nMax, cases[c].nMin, pUnit);
      emit_case(fp, 0x6FD964D0u, c, cases[c].note, args, 3, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 11. 0x6FDB8400: DRLGROOM_LoadDt1Files113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    struct {
      u32 mask;
      s32 drlgType;
      u32 initTiles;
      u32 initFlags;
      const char *note;
    } cases[4] = {
      { 0x00000000u, 0, 0u, 0x00000004u, "zero_mask_loads_only_3_universal_dt1s" },
      { 0x00000005u, 0, 0x1234u, 0x00000000u, "bits_0_and_2_plus_3_universal_dt1s" },
      { 0x0000000Au, 1, 0x9999u, 0x00020000u, "drlgType_1_bits_1_and_3_plus_3_universal_dt1s" },
      { 0x80000001u, 0, 0u, 0x01000000u, "bit_0_and_bit_31_full_32bit_loop" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx  = PTR(0x100);
      u32 pLevel   = PTR(0x200);
      u32 pLvlType = PTR(0x1000);

      U32_AT(0x100 + 0x28) = cases[c].initFlags;
      U32_AT(0x100 + 0x50) = cases[c].mask;
      U32_AT(0x100 + 0x58) = pLevel;
      U32_AT(0x100 + 0x68) = cases[c].initTiles;
      S32_AT(0x200 + 0x1C0) = cases[c].drlgType;

      *(u32 *)RVA(0x6FDF141C) = pLvlType;
      for (int t = 0; t < 2; t++) {
        for (int b = 0; b < 32; b++) {
          char *dst = (char *)MEM(0x1000 + t * 0x788 + b * 0x3C);
          sprintf(dst, "Act%d\\Tile_%02d.dt1", t + 1, b);
        }
      }

      track_dwords(pRoomEx, 0x70);
      track_dwords(PTR(0x200 + 0x1C0), 4);
      track_dwords(pLvlType, 0x788 * 2);
      track_dwords((u32)RVA(0x6FDF141C), 4);
      track_dwords((u32)RVA(0x6FDDAD5C), 12);
      track_dwords((u32)RVA(0x6FDDFF70), 0x68);

      u32 args[1] = { pRoomEx };
      call_6FDB8400(pRoomEx);
      emit_case(fp, 0x6FDB8400u, c, cases[c].note, args, 1, 0);
    }
  }
}

/* =========================================================================
 * B042 VECTOR EMISSION (12 FUNCTIONS)
 * ========================================================================= */

static void emit_b042(FILE *fp) {
  /* -----------------------------------------------------------------------
   * 1. 0x6FD68400: PATH_SpliceSegmentPoints113c (4 cases)
   *    (args: nInsertIdx, pSubPath, pnTotalPoints, pPointsBuf, pnCurIdx)
   * ----------------------------------------------------------------------- */
  {
    struct {
      s32 insertIdx;
      s32 totalPts;
      s32 curIdx;
      s32 nNewPts;
      const char *note;
    } cases[4] = {
      { 2, 6, 1, 3, "expand_segment_1_to_2_with_3_new_points" },
      { 3, 7, 1, 2, "shrink_segment_1_to_3_with_2_new_points" },
      { 2, 5, 1, 2, "same_length_splice_1_to_2_with_2_new_points" },
      { 4, 8, 2, 4, "splice_4_new_points_at_idx_2" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pnTotalPoints = PTR(0x100);
      u32 pnCurIdx      = PTR(0x110);
      u32 pSubPath      = PTR(0x200);
      u32 pPointsBuf    = PTR(0x400);

      S32_AT(0x100) = cases[c].totalPts;
      S32_AT(0x110) = cases[c].curIdx;
      S32_AT(0x200 + 0x04) = cases[c].nNewPts;
      for (int i = 0; i < 8; i++) {
        U32_AT(0x200 + 0x24 + i * 4) = 0xAA000010u + (u32)i;
      }
      for (int i = 0; i < 12; i++) {
        U32_AT(0x400 + i * 4) = 0xBB000000u + (u32)i;
      }

      track_dwords(pnTotalPoints, 0x20);
      track_dwords(pSubPath, 0x50);
      track_dwords(pPointsBuf, 0x40);

      u32 args[5] = {
        (u32)cases[c].insertIdx, pSubPath, pnTotalPoints, pPointsBuf, pnCurIdx
      };
      call_6FD68400(cases[c].insertIdx, pSubPath, pnTotalPoints, pPointsBuf, pnCurIdx);
      emit_case(fp, 0x6FD68400u, c, cases[c].note, args, 5, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 2. 0x6FD84630: PATH_SetStepDistance113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std2_void_t fn = (fn_std2_void_t)RVA(0x6FD84630);
    s32 dists[4] = { 0, 1, 127, 255 };
    const char *notes[4] = {
      "distance_0_min_boundary",
      "distance_1",
      "distance_127_mid",
      "distance_255_max_boundary",
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pDynPath = PTR(0x100);
      U32_AT(0x100 + 0x94) = 0xAABBCCDDu;
      track_dwords(PTR(0x100 + 0x94), 4);
      u32 args[2] = { pDynPath, (u32)dists[c] };
      fn(pDynPath, (u32)dists[c]);
      emit_case(fp, 0x6FD84630u, c, notes[c], args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 3. 0x6FD847C0: PATH_GetSavedSteps113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std2_u32_t fn = (fn_std2_u32_t)RVA(0x6FD847C0);
    u32 counts[4] = { 0u, 1u, 5u, 7u };
    const char *notes[4] = {
      "saved_steps_count_0",
      "saved_steps_count_1",
      "saved_steps_count_5",
      "saved_steps_count_7",
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pDynPath     = PTR(0x100 + (u32)c * 0x10);
      u32 ppSavedSteps = PTR(0x400);
      U32_AT((pDynPath - ARENA_ADDR) + 0x34)  = 0x00020000u | (u32)c;
      U32_AT((pDynPath - ARENA_ADDR) + 0x1D4) = counts[c];
      track_dwords(pDynPath, 0x1DC);
      track_dwords(ppSavedSteps, 4);
      u32 args[2] = { pDynPath, ppSavedSteps };
      u32 eax = fn(pDynPath, ppSavedSteps);
      emit_case(fp, 0x6FD847C0u, c, notes[c], args, 2, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 4. 0x6FD84910: PATH_GetTargetTypeAndId113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std3_void_t fn = (fn_std3_void_t)RVA(0x6FD84910);
    struct {
      u32 targetUnit, targetType, targetId;
      const char *note;
    } cases[4] = {
      { PTR(0x500), 0u, 101u, "player_target_type_0_id_101" },
      { PTR(0x510), 1u, 202u, "monster_target_type_1_id_202" },
      { PTR(0x520), 2u, 303u, "object_target_type_2_id_303" },
      { PTR(0x530), 4u, 999u, "item_target_type_4_id_999" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pDynPath    = PTR(0x100);
      u32 pTargetType = PTR(0x200);
      u32 pTargetId   = PTR(0x204);
      U32_AT(0x100 + 0x58) = cases[c].targetUnit;
      U32_AT(0x100 + 0x5C) = cases[c].targetType;
      U32_AT(0x100 + 0x60) = cases[c].targetId;
      track_dwords(PTR(0x100 + 0x58), 0x0C);
      track_dwords(pTargetType, 8);
      u32 args[3] = { pDynPath, pTargetType, pTargetId };
      fn(pDynPath, pTargetType, pTargetId);
      emit_case(fp, 0x6FD84910u, c, cases[c].note, args, 3, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 5. 0x6FD84B80: PATH_GetPosY113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD84B80);
    u16 vals[4] = { 0u, 250u, 5123u, 65535u };
    const char *notes[4] = {
      "posY_0",
      "posY_250",
      "posY_5123",
      "posY_65535_max_u16",
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pDynPath = PTR(0x100);
      U16_AT(0x100 + 0x04) = 0x1122u;
      U16_AT(0x100 + 0x06) = vals[c];
      track_dwords(PTR(0x100 + 0x04), 4);
      u32 args[1] = { pDynPath };
      u32 eax = fn(pDynPath);
      emit_case(fp, 0x6FD84B80u, c, notes[c], args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 6. 0x6FD84BB0: PATH_GetPosX113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD84BB0);
    u16 vals[4] = { 0u, 320u, 6400u, 65535u };
    const char *notes[4] = {
      "posX_0",
      "posX_320",
      "posX_6400",
      "posX_65535_max_u16",
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pDynPath = PTR(0x100);
      U16_AT(0x100 + 0x00) = 0x3344u;
      U16_AT(0x100 + 0x02) = vals[c];
      track_dwords(PTR(0x100 + 0x00), 4);
      u32 args[1] = { pDynPath };
      u32 eax = fn(pDynPath);
      emit_case(fp, 0x6FD84BB0u, c, notes[c], args, 1, eax);
    }
  }

  /* -----------------------------------------------------------------------
   * 7. 0x6FD84DC0: PATH_FreeDynamicPath113c (4 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std2_void_t fn = (fn_std2_void_t)RVA(0x6FD84DC0);
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pDynPath = PTR(0x100 + (u32)c * 0x20);
      u32 args[2] = { 0xCAFE0000u, pDynPath };
      const char *note = (c == 0)
        ? "free_dynamic_path_slot_0"
        : (c == 1)
          ? "free_dynamic_path_slot_1"
          : (c == 2)
            ? "free_dynamic_path_slot_2"
            : "free_dynamic_path_slot_3";
      fn(0xCAFE0000u, pDynPath);
      emit_case(fp, 0x6FD84DC0u, c, note, args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 8. 0x6FD84F80: PATH_SetType113c (5 cases)
   * ----------------------------------------------------------------------- */
  {
    fn_std2_void_t fn = (fn_std2_void_t)RVA(0x6FD84F80);
    struct {
      u32 pUnit;
      u32 unitType;
      u32 initFlags;
      u32 oldPathType;
      u32 oldPrevType;
      u32 oldVel;
      u32 oldPrevVel;
      u8  stepNum;
      s32 newPathType;
      const char *note;
    } cases[5] = {
      { 0, 0, 0x12300055u, 2, 1, 0x800, 0x400, 10, 0, "type_0_basic_flags_preserves_prevType_and_prevVel" },
      { PTR(0x300), 1, 0x00000011u, 5, 1, 0x800, 0x400, 77, 4, "type_4_knockback_saves_prevType_and_checks_stepNum_77" },
      { PTR(0x300), 1, 0x00004011u, 9, 3, 0x800, 0x400, 0, 4, "type_4_with_0x4000_already_set_keeps_existing_prevType" },
      { 0, 0, 0x00000022u, 2, 2, 0x1200, 0x300, 5, 8, "type_8_saves_prevVelocity_when_0x10000_clear" },
      { 0, 0, 0x00010022u, 2, 2, 0x1200, 0x300, 5, 8, "type_8_with_0x10000_already_set_keeps_existing_prevVel" },
    };
    for (int c = 0; c < 5; c++) {
      reset_case();
      u32 pDynPath = PTR(0x100);
      U32_AT(0x100 + 0x30) = cases[c].pUnit;
      U32_AT(0x100 + 0x34) = cases[c].initFlags;
      U32_AT(0x100 + 0x3C) = cases[c].oldPathType;
      U32_AT(0x100 + 0x40) = cases[c].oldPrevType;
      U32_AT(0x100 + 0x7C) = cases[c].oldVel;
      U32_AT(0x100 + 0x80) = cases[c].oldPrevVel;
      U8_AT(0x100 + 0x91)  = cases[c].stepNum;
      U32_AT(0x100 + 0x98) = 0xDEADBEEFu;
      if (cases[c].pUnit != 0) {
        U32_AT(0x300) = cases[c].unitType;
        track_dwords(PTR(0x300), 4);
      }
      track_dwords(pDynPath, 0xA0);
      track_dwords((u32)RVA(0x6FDE4138), 0x48 * 2);

      u32 args[2] = { pDynPath, (u32)cases[c].newPathType };
      fn(pDynPath, (u32)cases[c].newPathType);
      emit_case(fp, 0x6FD84F80u, c, cases[c].note, args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 9. 0x6FD85160: PATH_AdjustTargetForDoorObject113c (4 cases)
   *    (eax = pContext -> void)
   * ----------------------------------------------------------------------- */
  {
    struct {
      u8  flag13C;
      u16 posX, posY, targetX, targetY;
      u32 doorX, doorY;
      const char *note;
    } cases[4] = {
      { 1u, 100u, 200u, 120u, 220u, 100u, 250u, "flag13C_1_posY_lt_doorY_subtracts_2_from_targetY" },
      { 1u, 100u, 260u, 120u, 220u, 100u, 250u, "flag13C_1_posY_ge_doorY_adds_2_to_targetY" },
      { 0u, 100u, 200u, 120u, 220u, 150u, 200u, "flag13C_0_posX_lt_doorX_subtracts_2_from_targetX" },
      { 2u, 180u, 200u, 120u, 220u, 150u, 200u, "flag13C_2_posX_ge_doorX_adds_2_to_targetX" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pContext    = PTR(0x100);
      u32 pPath       = PTR(0x200);
      u32 pTargetUnit = PTR(0x300);
      u32 pObjectData = PTR(0x400);
      u32 pObjectTxt  = PTR(0x500);
      u32 pStaticPath = PTR(0x700);

      U32_AT(0x100 + 0x30) = pPath;
      U16_AT(0x200 + 0x02) = cases[c].posX;
      U16_AT(0x200 + 0x06) = cases[c].posY;
      U16_AT(0x200 + 0x10) = cases[c].targetX;
      U16_AT(0x200 + 0x12) = cases[c].targetY;
      U32_AT(0x200 + 0x58) = pTargetUnit;

      U32_AT(0x300 + 0x00) = 2u; /* UNIT_OBJECT */
      U32_AT(0x300 + 0x14) = pObjectData;
      U32_AT(0x300 + 0x2C) = pStaticPath;
      U32_AT(0x400 + 0x00) = pObjectTxt;
      U8_AT(0x500 + 0x13A) = 1u; /* nSubClass != 0 (door) */
      U8_AT(0x500 + 0x13C) = cases[c].flag13C;

      U32_AT(0x700 + 0x0C) = cases[c].doorX;
      U32_AT(0x700 + 0x10) = cases[c].doorY;

      track_dwords(PTR(0x100 + 0x30), 4);
      track_dwords(pPath, 0x60);
      track_dwords(pTargetUnit, 0x30);
      track_dwords(pObjectData, 4);
      track_dwords(PTR(0x500 + 0x138), 8);
      track_dwords(PTR(0x700 + 0x0C), 8);

      u32 args[1] = { pContext };
      call_6FD85160(pContext);
      emit_case(fp, 0x6FD85160u, c, cases[c].note, args, 1, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 10. 0x6FD85270: PATH_SetNewDirection113c (6 cases)
   *     (__stdcall(pPath, nNewDir), ret 8)
   * ----------------------------------------------------------------------- */
  {
    fn_std2_void_t fn = (fn_std2_void_t)RVA(0x6FD85270);
    struct {
      u32 pUnit;
      u32 unitType;
      u8  flagsByte;
      u8  oldDir, oldNewDir, oldDiffDir;
      u8  newDir;
      const char *note;
    } cases[6] = {
      /* case 0: unitType 2 (OBJECT) -> sets nDirection (+0x64) directly */
      { PTR(0x300), 2u, 0x00u, 5u, 5u, 0u, 20u, "unit_type_2_object_sets_nDirection_directly" },
      /* case 1: unitType 4 (ITEM) -> sets nDirection (+0x64) directly */
      { PTR(0x300), 4u, 0x00u, 8u, 8u, 0u, 45u, "unit_type_4_item_sets_nDirection_directly" },
      /* case 2: unitType 3 (MISSILE) with flag 0x40 clear -> sets nDirection (+0x64) */
      { PTR(0x300), 3u, 0x00u, 3u, 3u, 0u, 33u, "unit_type_3_missile_flag_0x40_clear_sets_nDirection" },
      /* case 3: unitType 3 (MISSILE) with flag 0x40 set -> no-op */
      { PTR(0x300), 3u, 0x40u, 3u, 3u, 0u, 33u, "unit_type_3_missile_flag_0x40_set_noop" },
      /* case 4: unitType 0 (PLAYER) with newDir != oldNewDir -> updates nNewDirection (+0x65) and nDiffDirection (+0x66) from 0x6FDE41C8 */
      { PTR(0x300), 0u, 0x00u, 10u, 12u, 0u, 25u, "unit_type_0_player_updates_nNewDirection_and_nDiffDirection" },
      /* case 5: pUnit == 0 (uType 6) with newDir == oldNewDir -> no-op */
      { 0u, 0u, 0x00u, 10u, 25u, 7u, 25u, "null_pUnit_same_nNewDirection_noop" },
    };
    for (int c = 0; c < 6; c++) {
      reset_case();
      u32 pPath = PTR(0x100);
      U32_AT(0x100 + 0x30) = cases[c].pUnit;
      U8_AT(0x100 + 0x34)  = cases[c].flagsByte;
      U8_AT(0x100 + 0x64)  = cases[c].oldDir;
      U8_AT(0x100 + 0x65)  = cases[c].oldNewDir;
      U8_AT(0x100 + 0x66)  = cases[c].oldDiffDir;
      if (cases[c].pUnit != 0) {
        U32_AT(0x300) = cases[c].unitType;
        track_dwords(PTR(0x300), 4);
      }
      track_dwords(PTR(0x100 + 0x30), 8);
      track_dwords(PTR(0x100 + 0x64), 4);
      track_dwords((u32)RVA(0x6FDE41C8), 0x100);

      u32 args[2] = { pPath, (u32)cases[c].newDir };
      fn(pPath, (u32)cases[c].newDir);
      emit_case(fp, 0x6FD85270u, c, cases[c].note, args, 2, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 11. 0x6FD8E080: PATH_OffsetTargetByUnitRadius113c (4 cases)
   *     (esi = pPath -> void)
   * ----------------------------------------------------------------------- */
  {
    struct {
      int hasTargetPath;
      u8  targetDir;
      u8  offsetParam;
      u16 targetX, targetY;
      const char *note;
    } cases[4] = {
      { 0, 0u, 0u, 100u, 200u, "null_target_path_offset_0" },
      { 1, 16u, 5u, 100u, 200u, "target_dir_16_offset_5" },
      { 1, 32u, 10u, 250u, 300u, "target_dir_32_offset_10" },
      { 1, 48u, 7u, 500u, 600u, "target_dir_48_offset_7" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pPath       = PTR(0x100);
      u32 pTargetUnit = PTR(0x200);
      u32 pTargetPath = cases[c].hasTargetPath ? PTR(0x300) : 0u;

      U16_AT(0x100 + 0x10) = cases[c].targetX;
      U16_AT(0x100 + 0x12) = cases[c].targetY;
      U32_AT(0x100 + 0x58) = pTargetUnit;
      U8_AT(0x100 + 0x68)  = cases[c].offsetParam;
      U32_AT(0x200 + 0x2C) = pTargetPath;
      if (pTargetPath != 0) {
        U8_AT(0x300 + 0x64) = cases[c].targetDir;
        track_dwords(PTR(0x300 + 0x64), 4);
      }

      u32 lutIdx = (((u32)cases[c].targetDir - ((u32)cases[c].offsetParam << 5)) << 3) & 0x1FFu;
      u32 cosIdx = (lutIdx + 0x80u) & 0x1FFu;
      u32 sinIdx = lutIdx & 0x1FFu;

      track_dwords(PTR(0x100 + 0x10), 4);
      track_dwords(PTR(0x100 + 0x58), 4);
      track_dwords(PTR(0x100 + 0x68), 4);
      track_dwords(PTR(0x200 + 0x2C), 4);
      track_dwords(0x6FF7F470u + cosIdx * 4u, 4);
      track_dwords(0x6FF7F470u + sinIdx * 4u, 4);

      u32 args[1] = { pPath };
      call_6FD8E080(pPath);
      emit_case(fp, 0x6FD8E080u, c, cases[c].note, args, 1, 0);
    }
  }

  /* -----------------------------------------------------------------------
   * 12. 0x6FDB6920: PATH_BuildSpiralPath77Points113c (4 cases)
   *     (__stdcall(pPath), ret 4)
   * ----------------------------------------------------------------------- */
  {
    fn_std1_void_t fn = (fn_std1_void_t)RVA(0x6FDB6920);
    struct {
      u32 originX, originY;
      const char *note;
    } cases[4] = {
      { 0x00640000u, 0x00640000u, "origin_100_100_exact_subtile" },
      { 0x00FA8000u, 0x012C8000u, "origin_250_5_300_5_half_subtile" },
      { 0x04001234u, 0x08005678u, "origin_1024_2048_fractional" },
      { 0x1388C000u, 0x17704000u, "origin_5000_6000_large_coords" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pPath = PTR(0x100);
      U32_AT(0x100 + 0x00) = cases[c].originX;
      U32_AT(0x100 + 0x04) = cases[c].originY;

      track_dwords(pPath, 0x1D4);
      for (u32 k = 0; k < 32; k++) {
        track_dwords(0x6FF7F470u + k * 64u, 4);
      }

      u32 args[1] = { pPath };
      fn(pPath);
      emit_case(fp, 0x6FDB6920u, c, cases[c].note, args, 1, 0);
    }
  }
}

int main(int argc, char **argv) {
  const char *b034_out = (argc > 1) ? argv[1] : "tests/fixtures/oracle/k1/b034-vectors.ndjson";
  const char *b037_out = (argc > 2) ? argv[2] : "tests/fixtures/oracle/k1/b037-vectors.ndjson";
  const char *b042_out = (argc > 3) ? argv[3] : "tests/fixtures/oracle/k1/b042-vectors.ndjson";

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
  VirtualProtect((void *)RVA(0x6FDD9000), 0x400, PAGE_READWRITE, &oldProt);
  *(uintptr_t *)RVA(0x6FDD90D0) = (uintptr_t)stub_fog_10045;
  *(uintptr_t *)RVA(0x6FDD90AC) = (uintptr_t)stub_fog_10045;
  *(uintptr_t *)RVA(0x6FDD90CC) = (uintptr_t)stub_fog_10046;
  *(uintptr_t *)RVA(0x6FDD90A8) = (uintptr_t)stub_fog_10046;
  *(uintptr_t *)RVA(0x6FDD90C8) = (uintptr_t)stub_fog_10004;
  *(uintptr_t *)RVA(0x6FDD90DC) = (uintptr_t)stub_fog_10104;
  *(uintptr_t *)RVA(0x6FDD90F0) = (uintptr_t)stub_fog_10105;
  *(uintptr_t *)RVA(0x6FDD9018) = (uintptr_t)stub_d2cmp_10085;

  DWORD oldDataProt = 0;
  VirtualProtect((void *)RVA(0x6FDE9E1C), 0x8000, PAGE_READWRITE, &oldDataProt);

  FILE *fp34 = fopen(b034_out, "wb");
  if (!fp34) {
    fprintf(stderr, "Cannot open %s\n", b034_out);
    return 4;
  }
  emit_b034(fp34);
  fclose(fp34);

  FILE *fp37 = fopen(b037_out, "wb");
  if (!fp37) {
    fprintf(stderr, "Cannot open %s\n", b037_out);
    return 5;
  }
  emit_b037(fp37);
  fclose(fp37);

  FILE *fp42 = fopen(b042_out, "wb");
  if (!fp42) {
    fprintf(stderr, "Cannot open %s\n", b042_out);
    return 6;
  }
  emit_b042(fp42);
  fclose(fp42);

  return 0;
}
