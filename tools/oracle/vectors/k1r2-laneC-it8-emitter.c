/*
 * k1r2-laneC-it8-emitter.c
 *
 * 32-bit MinGW executable that loads the real D2Common.dll v1.13c at its
 * preferred image base 0x6FD50000 (along with real D2CMP.dll and Fog.dll)
 * under Wine and emits differential test vectors (NDJSON) for Lane C Iteration 8:
 *   - B050 (12 hostImport functions) -> b050-vectors.ndjson
 *   - B053 (22 net-new internalComposite functions) -> b053-vectors.ndjson
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef uint32_t  u32;
typedef int32_t   s32;
typedef uint16_t  u16;
typedef int16_t   s16;
typedef uint8_t   u8;
typedef uintptr_t usize;

#define EXPECTED_BASE 0x6FD50000u
#define ARENA_ADDR    0x10000000u
#define ARENA_SIZE    0x00080000u
#define HEAP_ADDR     0x40000000u
#define HEAP_SIZE     0x00080000u

static u8 *g_arena = NULL;
static u8 *g_heap = NULL;
static u32 g_arena_off = 0;
static u32 g_heap_off = 0;

static u32 g_frees[64];
static int g_num_frees = 0;

static u32 bump_alloc(u32 size) {
  if (size == 0u) {
    return 0u;
  }
  u32 aligned = (g_heap_off + 3u) & ~3u;
  if (aligned + size > HEAP_SIZE) {
    fprintf(stderr, "Out of deterministic heap\n");
    ExitProcess(4);
  }
  u32 p = HEAP_ADDR + aligned;
  memset(g_heap + aligned, 0, size);
  g_heap_off = aligned + size;
  return p;
}

static void record_free(u32 ptr) {
  if (ptr != 0u && g_num_frees < 64) {
    g_frees[g_num_frees++] = ptr;
  }
}

/* Fog.#10042: SMemAlloc(__fastcall ecx=size, edx=szFile, nLine, 0) */
static u32 __attribute__((fastcall)) stub_fog_10042(
  u32 ecx_size, u32 edx_file, u32 line, u32 zero
) {
  (void)edx_file; (void)line; (void)zero;
  return bump_alloc(ecx_size);
}

/* Fog.#10043: SMemFree(__fastcall ecx=ptr, edx=szFile, nLine, 0) */
static void __attribute__((fastcall)) stub_fog_10043(
  u32 ecx_ptr, u32 edx_file, u32 line, u32 zero
) {
  (void)edx_file; (void)line; (void)zero;
  record_free(ecx_ptr);
}

/* Fog.#10045: SMemPoolAlloc(__fastcall ecx=pMemPool, edx=size, szFile, nLine, 0) */
static u32 __attribute__((fastcall)) stub_fog_10045(
  u32 ecx_pool, u32 edx_size, u32 file, u32 line, u32 zero
) {
  (void)ecx_pool; (void)file; (void)line; (void)zero;
  return bump_alloc(edx_size);
}

/* Fog.#10046: SMemPoolFree(__fastcall ecx=pMemPool, edx=ptr, szFile, nLine, 0) */
static void __attribute__((fastcall)) stub_fog_10046(
  u32 ecx_pool, u32 edx_ptr, u32 file, u32 line, u32 zero
) {
  (void)ecx_pool; (void)file; (void)line; (void)zero;
  record_free(edx_ptr);
}

/* Fog.#10102: SFileOpenFile(__fastcall ecx=szFileName, edx=phFile) -> BOOL */
static u32 __attribute__((fastcall)) stub_fog_10102(
  u32 ecx_name, u32 edx_phFile
) {
  if (ecx_name == 0u) {
    return 0u;
  }
  u32 h = *(const u32 *)(uintptr_t)(ecx_name + 0x10u);
  if (edx_phFile != 0u) {
    *(u32 *)(uintptr_t)edx_phFile = h;
  }
  return h != 0u ? 1u : 0u;
}

/* Fog.#10103: SFileCloseFile(__fastcall ecx=hFile) -> BOOL */
static u32 __attribute__((fastcall)) stub_fog_10103(u32 ecx_hFile) {
  (void)ecx_hFile;
  return 1u;
}

/* Fog.#10104: SFileReadFile(__fastcall ecx=hFile, edx=pBuf, nSize, pdwRead, a5, a6, a7) -> BOOL */
static u32 __attribute__((fastcall)) stub_fog_10104(
  u32 ecx_hFile, u32 edx_pBuf, u32 nSize, u32 pdwRead, u32 a5, u32 a6, u32 a7
) {
  (void)a5; (void)a6; (void)a7;
  if (ecx_hFile == 0u || edx_pBuf == 0u || (s32)nSize < 0) {
    return 0u;
  }
  memcpy((void *)(uintptr_t)(edx_pBuf), (const void *)(uintptr_t)(ecx_hFile), nSize);
  if (pdwRead != 0u) {
    *(u32 *)(uintptr_t)pdwRead = nSize;
  }
  return 1u;
}

/* Fog.#10105: SFileGetFileSize(__fastcall ecx=hFile, edx=lpFileSizeHigh) -> u32 */
static u32 __attribute__((fastcall)) stub_fog_10105(
  u32 ecx_hFile, u32 edx_lpHigh
) {
  if (ecx_hFile == 0u) {
    return 0u;
  }
  u32 low = *(const u32 *)(uintptr_t)ecx_hFile;
  if (edx_lpHigh != 0u) {
    *(u32 *)(uintptr_t)edx_lpHigh = *(const u32 *)(uintptr_t)(ecx_hFile + 4u);
  }
  return low;
}

/* Fog.#10029: Fog_Trace(__cdecl fmt, ...) */
static void __cdecl stub_fog_10029(const char *fmt, ...) {
  (void)fmt;
}

typedef struct {
  u32 addr;
  u32 len;
  u8 *pre;
  u8 *post;
} TrackedBlock;

#define MAX_BLOCKS 64
static TrackedBlock g_blocks[MAX_BLOCKS];
static int g_num_blocks = 0;

static void reset_heap(void) {
  if (g_arena_off > 0) {
    memset(g_arena, 0, (g_arena_off + 15u) & ~15u);
  }
  if (g_heap_off > 0) {
    memset(g_heap, 0, (g_heap_off + 3u) & ~3u);
  }
  g_arena_off = 0x100u;
  g_heap_off = 0;
  g_num_frees = 0;
  for (int i = 0; i < g_num_blocks; i++) {
    free(g_blocks[i].pre);
    free(g_blocks[i].post);
  }
  g_num_blocks = 0;
}

static u32 heap_alloc(u32 size) {
  u32 aligned = (g_arena_off + 15u) & ~15u;
  u32 alloc_sz = (size == 0u) ? 4u : size;
  if (aligned + alloc_sz > ARENA_SIZE) {
    fprintf(stderr, "Out of arena\n");
    ExitProcess(4);
  }
  u32 p = ARENA_ADDR + aligned;
  memset(g_arena + aligned, 0, alloc_sz);
  g_arena_off = aligned + alloc_sz;
  return p;
}

static void track_region(u32 addr, u32 byte_len) {
  if (g_num_blocks >= MAX_BLOCKS) {
    fprintf(stderr, "Too many tracked blocks\n");
    ExitProcess(5);
  }
  TrackedBlock *b = &g_blocks[g_num_blocks++];
  b->addr = addr;
  b->len  = (byte_len + 3u) & ~3u;
  b->pre  = (u8 *)malloc(b->len);
  b->post = (u8 *)malloc(b->len);
}

static void snapshot_pre(void) {
  for (int i = 0; i < g_num_blocks; i++) {
    memcpy(g_blocks[i].pre, (const void *)(uintptr_t)g_blocks[i].addr, g_blocks[i].len);
  }
}

static void snapshot_post(void) {
  for (int i = 0; i < g_num_blocks; i++) {
    memcpy(g_blocks[i].post, (const void *)(uintptr_t)g_blocks[i].addr, g_blocks[i].len);
  }
}

static void emit_vector(
  FILE *fp, const char *vaStr, const char *fnName, int case_idx,
  const char *argsJson, u32 eax_out, int has_ret
) {
  snapshot_post();
  fprintf(fp, "{\"va\":\"%s\",\"name\":\"%s\",\"case\":%d,\"in\":{\"args\":%s,\"mem\":{",
          vaStr, fnName, case_idx, argsJson);
  int first = 1;
  for (int b = 0; b < g_num_blocks; b++) {
    const u32 *words = (const u32 *)g_blocks[b].pre;
    u32 count = g_blocks[b].len / 4u;
    for (u32 w = 0; w < count; w++) {
      fprintf(fp, "%s\"0x%08X\":%u", first ? "" : ",", g_blocks[b].addr + w * 4u, words[w]);
      first = 0;
    }
  }
  fprintf(fp, "}},\"out\":{\"eax\":%u,\"hasRet\":%d,\"mem\":{", has_ret ? eax_out : 0u, has_ret);
  first = 1;
  for (int b = 0; b < g_num_blocks; b++) {
    const u32 *pre_w  = (const u32 *)g_blocks[b].pre;
    const u32 *post_w = (const u32 *)g_blocks[b].post;
    u32 count = g_blocks[b].len / 4u;
    for (u32 w = 0; w < count; w++) {
      if (post_w[w] != pre_w[w]) {
        fprintf(fp, "%s\"0x%08X\":%u", first ? "" : ",", g_blocks[b].addr + w * 4u, post_w[w]);
        first = 0;
      }
    }
  }
  u32 heap_words = ((g_heap_off + 3u) & ~3u) / 4u;
  const u32 *hw = (const u32 *)g_heap;
  for (u32 w = 0; w < heap_words; w++) {
    fprintf(fp, "%s\"0x%08X\":%u", first ? "" : ",", HEAP_ADDR + w * 4u, hw[w]);
    first = 0;
  }
  fprintf(fp, "},\"allocBytes\":%u,\"frees\":[", g_heap_off);
  for (int i = 0; i < g_num_frees; i++) {
    fprintf(fp, "%s%u", (i > 0) ? "," : "", g_frees[i]);
  }
  fprintf(fp, "]}}\n");
}

/* Standard stdcall function pointer typedefs */
typedef void (__stdcall *fn_std1_void_t)(u32);
typedef u32  (__stdcall *fn_std1_u32_t)(u32);
typedef void (__stdcall *fn_std2_void_t)(u32, u32);
typedef u32  (__stdcall *fn_std2_u32_t)(u32, u32);
typedef void (__stdcall *fn_std4_void_t)(u32, u32, u32, u32);
typedef u32  (__stdcall *fn_std4_u32_t)(u32, u32, u32, u32);
typedef u32  (__stdcall *fn_std5_u32_t)(u32, u32, u32, u32, u32);

/* Register-only custom ABI wrappers (register constraints only) */
static __attribute__((noinline)) u32 call_eax_stk2_u32(u32 fn, u32 a_eax, u32 s1, u32 s2) {
  u32 pack[3] = { fn, s1, s2 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "=a"(out), "+d"(p)
    : "a"(a_eax)
    : "ecx", "ebx", "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_eax_ebx_stk2_u32(u32 fn, u32 a_eax, u32 a_ebx, u32 s1, u32 s2) {
  u32 pack[3] = { fn, s1, s2 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "=a"(out), "+b"(a_ebx), "+d"(p)
    : "a"(a_eax)
    : "ecx", "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) void call_esi_void(u32 fn, u32 a_esi) {
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "+S"(a_esi), "+c"(fn)
    :
    : "eax", "edx", "ebx", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_ebx_stk1_u32(u32 fn, u32 a_ebx, u32 s1) {
  u32 out;
  __asm__ volatile(
    "pushl %%edx\n\t"
    "call *%%ecx\n\t"
    : "=a"(out), "+b"(a_ebx), "+c"(fn), "+d"(s1)
    :
    : "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_eax_ebx_stk1_u32(u32 fn, u32 a_eax, u32 a_ebx, u32 s1) {
  u32 out;
  __asm__ volatile(
    "pushl %%edx\n\t"
    "call *%%ecx\n\t"
    : "=a"(out), "+b"(a_ebx), "+c"(fn), "+d"(s1)
    : "a"(a_eax)
    : "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) void call_eax_ecx_stk3_void(u32 fn, u32 a_eax, u32 a_ecx, u32 s1, u32 s2, u32 s3) {
  u32 pack[4] = { fn, s1, s2, s3 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 12(%%edx)\n\t"
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "+a"(a_eax), "+c"(a_ecx), "+d"(p)
    :
    : "ebx", "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) void call_eax_esi_void(u32 fn, u32 a_eax, u32 a_esi) {
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "+a"(a_eax), "+S"(a_esi), "+c"(fn)
    :
    : "edx", "ebx", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_fastcall_stk1_u32(u32 fn, u32 a_ecx, u32 a_edx, u32 s1) {
  u32 pack[2] = { fn, s1 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 4(%%eax)\n\t"
    "call *0(%%eax)\n\t"
    : "=a"(out), "+c"(a_ecx), "+d"(a_edx)
    : "a"(p)
    : "ebx", "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_eax_ecx_edx_stk1_u32(u32 fn, u32 a_eax, u32 a_ecx, u32 a_edx, u32 s1) {
  u32 pack[2] = { fn, s1 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 4(%%esi)\n\t"
    "call *0(%%esi)\n\t"
    : "=a"(out), "+c"(a_ecx), "+d"(a_edx), "+S"(p)
    : "a"(a_eax)
    : "ebx", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) void call_esi_stk3_void(u32 fn, u32 a_esi, u32 s1, u32 s2, u32 s3) {
  u32 pack[4] = { fn, s1, s2, s3 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 12(%%edx)\n\t"
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "+S"(a_esi), "+d"(p)
    :
    : "eax", "ecx", "ebx", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_eax_ecx_edx_edi_u32(u32 fn, u32 a_eax, u32 a_ecx, u32 a_edx, u32 a_edi) {
  u32 pack[2] = { fn, a_edi };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "movl 4(%%esi), %%edi\n\t"
    "call *0(%%esi)\n\t"
    : "=a"(out), "+c"(a_ecx), "+d"(a_edx), "+S"(p)
    : "a"(a_eax)
    : "ebx", "edi", "memory", "cc"
  );
  return out;
}

typedef u32  (__stdcall *fn_std3_u32_t)(u32, u32, u32);

static __attribute__((noinline)) u32 call_esi_stk2_u32(u32 fn, u32 a_esi, u32 s1, u32 s2) {
  u32 pack[3] = { fn, s1, s2 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "=a"(out), "+S"(a_esi), "+d"(p)
    :
    : "ecx", "ebx", "edi", "memory", "cc"
  );
  return out;
}

static void emit_b050(FILE *fp) {
  /* 1. 0x6FD59900 DRLGPRESET_LoadFileFromArchive113c */
  for (int v = 0; v < 4; v++) {
    reset_heap();
    u32 szFile = heap_alloc(0x20);
    u32 hFile = heap_alloc(0x80);
    u32 fsize = (v == 0) ? 24u : (v == 1) ? 16u : (v == 2) ? 48u : 12u;
    *(u32*)(usize)(hFile + 0x00) = fsize;
    *(u32*)(usize)(hFile + 0x04) = 0;
    for (u32 i = 0; i < fsize; i++) {
      *(u8*)(usize)(hFile + 8 + i) = (u8)(0x30 + v * 17 + i);
    }
    *(u32*)(usize)(szFile + 0x10) = (v == 3) ? 0u : hFile;
    u32 pdwSize = (v == 1) ? 0u : heap_alloc(8);
    if (pdwSize) *(u32*)(usize)pdwSize = 0xDEADBEEFu;
    track_region(szFile, 0x20);
    track_region(hFile, 0x80);
    if (pdwSize) track_region(pdwSize, 8);
    snapshot_pre();
    u32 ret = call_eax_stk2_u32(0x6FD59900u, szFile, 0u, pdwSize);
    char args[128];
    snprintf(args, sizeof(args), "[%u,0,%u]", szFile, pdwSize);
    emit_vector(fp, "0x6FD59900", "DRLGPRESET_LoadFileFromArchive113c", v, args, ret, 1);
  }

  /* 2. 0x6FD59EA0 DRLGPRESET_CopyMapPresetUnitNode113c */
  /* Case 4: non-NULL save header with count 0. */
  for (int v = 0; v < 5; v++) {
    reset_heap();
    u32 pSrc = heap_alloc(0x20);
    *(u32*)(usize)(pSrc + 0x00) = 1u + (u32)v;
    *(u32*)(usize)(pSrc + 0x04) = 100u + (u32)v;
    *(u32*)(usize)(pSrc + 0x08) = 20u + (u32)v * 5u;
    *(u32*)(usize)(pSrc + 0x14) = 2u;
    *(u32*)(usize)(pSrc + 0x18) = 30u + (u32)v * 7u;
    *(u32*)(usize)(pSrc + 0x1C) = 0x55u;
    if (v == 0) {
      *(u32*)(usize)(pSrc + 0x10) = 0u;
    } else {
      u32 pHdr = heap_alloc(8);
      u32 cnt = (v == 4) ? 0u : (u32)v;
      u32 pData = heap_alloc((cnt == 0u) ? 12u : cnt * 12u);
      *(u32*)(usize)(pHdr + 0x00) = cnt;
      *(u32*)(usize)(pHdr + 0x04) = pData;
      for (u32 i = 0; i < cnt; i++) {
        *(u32*)(usize)(pData + i * 12u + 0x00) = 0x10u + i;
        *(u32*)(usize)(pData + i * 12u + 0x04) = 50u + i * 3u;
        *(u32*)(usize)(pData + i * 12u + 0x08) = 60u + i * 4u;
      }
      *(u32*)(usize)(pSrc + 0x10) = pHdr;
      track_region(pHdr, 8);
      track_region(pData, (cnt == 0u) ? 12u : cnt * 12u);
    }
    track_region(pSrc, 0x20);
    snapshot_pre();
    u32 offY = 10u + (u32)v * 2u;
    u32 offX = 5u + (u32)v * 3u;
    u32 ret = call_eax_ebx_stk2_u32(0x6FD59EA0u, pSrc, offY, 0u, offX);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u,0,%u]", pSrc, offY, offX);
    emit_vector(fp, "0x6FD59EA0", "DRLGPRESET_CopyMapPresetUnitNode113c", v, args, ret, 1);
  }

  /* 3. 0x6FD5A5B0 DRLGPRESET_ReleaseCachedPresetFile113c */
  for (int v = 0; v < 5; v++) {
    reset_heap();
    u32 ppFileData = heap_alloc(8);
    u32 pFile1 = heap_alloc(0x60);
    u32 pFile2 = heap_alloc(0x60);
    u32 pNode1 = heap_alloc(0x110);
    u32 pNode2 = heap_alloc(0x110);
    *(u32*)(usize)(pNode1 + 0x104) = (v == 1) ? 2u : 1u;
    *(u32*)(usize)(pNode1 + 0x108) = pFile1;
    *(u32*)(usize)(pNode1 + 0x10C) = pNode2;
    *(u32*)(usize)(pNode2 + 0x104) = (v == 3) ? 2u : 1u;
    *(u32*)(usize)(pNode2 + 0x108) = pFile2;
    *(u32*)(usize)(pNode2 + 0x10C) = 0u;
    *(u32*)(usize)0x6FDF1480u = 0u;
    *(u32*)(usize)0x6FDF147Cu = pNode1;
    if (v == 0) {
      *(u32*)(usize)ppFileData = 0u;
    } else if (v == 1 || v == 2) {
      *(u32*)(usize)ppFileData = pFile1;
    } else {
      *(u32*)(usize)ppFileData = pFile2;
    }
    track_region(0x6FDF147Cu, 8);
    track_region(ppFileData, 8);
    track_region(pFile1, 0x60);
    track_region(pFile2, 0x60);
    track_region(pNode1, 0x110);
    track_region(pNode2, 0x110);
    snapshot_pre();
    ((fn_std1_void_t)(usize)0x6FD5A5B0u)(ppFileData);
    char args[64];
    snprintf(args, sizeof(args), "[%u]", ppFileData);
    emit_vector(fp, "0x6FD5A5B0", "DRLGPRESET_ReleaseCachedPresetFile113c", v, args, 0, 0);
  }

  /* 4. 0x6FD5AB50 DRLGPRESET_BuildPresetRoomGridsFromFile113c */
  for (int v = 0; v < 5; v++) {
    reset_heap();
    u32 pRoomEx = heap_alloc(0x80);
    u32 pPreset = heap_alloc(0x100);
    u32 pMap = heap_alloc(0x50);
    u32 pFile = heap_alloc(0x60);
    u32 pLevel = heap_alloc(0x200);
    u32 pDrlg = heap_alloc(0x490);
    *(u32*)(usize)(pRoomEx + 0x20) = pPreset;
    *(u32*)(usize)(pRoomEx + 0x34) = 1u;
    *(u32*)(usize)(pRoomEx + 0x38) = 1u;
    *(u32*)(usize)(pRoomEx + 0x3C) = (v == 0) ? 0u : 2u;
    *(u32*)(usize)(pRoomEx + 0x40) = (v == 0) ? 0u : 2u;
    *(u32*)(usize)(pRoomEx + 0x58) = pLevel;
    *(u32*)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32*)(usize)(pDrlg + 0x478) = 0u;
    *(u32*)(usize)(pPreset + 0x08) = pMap;
    *(u32*)(usize)(pMap + 0x0C) = pFile;
    *(u32*)(usize)(pMap + 0x10) = 0u;
    *(u32*)(usize)(pMap + 0x14) = 0u;
    *(u32*)(usize)(pMap + 0x18) = 4u;
    *(u32*)(usize)(pMap + 0x1C) = 4u;
    *(u32*)(usize)(pMap + 0x38) = 0u;
    u32 nWalls = (v == 0) ? 0u : (v == 1) ? 1u : (v == 2) ? 2u : (v == 3) ? 3u : 0u;
    u32 nFloors = (v == 0) ? 0u : (v == 1) ? 1u : (v == 2) ? 2u : (v == 3) ? 0u : 2u;
    *(u32*)(usize)(pFile + 0x14) = nWalls;
    *(u32*)(usize)(pFile + 0x18) = nFloors;
    for (u32 i = 0; i < 4; i++) {
      u32 oBuf = heap_alloc(0x80);
      u32 wBuf = heap_alloc(0x80);
      for (u32 k = 0; k < 25; k++) {
        *(u32*)(usize)(oBuf + k * 4) = i + 1u;
        *(u32*)(usize)(wBuf + k * 4) = (k + 1u) * 0x10u;
      }
      *(u32*)(usize)(pFile + 0x1C + i * 4) = oBuf;
      *(u32*)(usize)(pFile + 0x2C + i * 4) = wBuf;
      track_region(oBuf, 0x80);
      track_region(wBuf, 0x80);
    }
    for (u32 i = 0; i < 2; i++) {
      u32 fBuf = heap_alloc(0x80);
      for (u32 k = 0; k < 25; k++) *(u32*)(usize)(fBuf + k * 4) = (k + 1u) * 0x20u;
      *(u32*)(usize)(pFile + 0x3C + i * 4) = fBuf;
      track_region(fBuf, 0x80);
    }
    u32 sBuf = heap_alloc(0x80);
    for (u32 k = 0; k < 25; k++) *(u32*)(usize)(sBuf + k * 4) = (k + 1u) * 0x40u;
    *(u32*)(usize)(pFile + 0x44) = sBuf;
    track_region(sBuf, 0x80);
    track_region(pRoomEx, 0x80);
    track_region(pPreset, 0x100);
    track_region(pMap, 0x50);
    track_region(pFile, 0x60);
    track_region(pLevel, 0x200);
    track_region(pDrlg, 0x490);
    snapshot_pre();
    ((fn_std1_void_t)(usize)0x6FD5AB50u)(pRoomEx);
    char args[64];
    snprintf(args, sizeof(args), "[%u]", pRoomEx);
    emit_vector(fp, "0x6FD5AB50", "DRLGPRESET_BuildPresetRoomGridsFromFile113c", v, args, 0, 0);
  }
  /* 5. 0x6FD5AEC0 DRLGPRESET_FreePresetRoomData113c */
  for (int v = 0; v < 4; v++) {
    reset_heap();
    u32 pRoomEx = heap_alloc(0x80);
    u32 pLevel = heap_alloc(0x200);
    u32 pDrlg = heap_alloc(0x490);
    *(u32*)(usize)(pRoomEx + 0x58) = pLevel;
    *(u32*)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32*)(usize)(pDrlg + 0x478) = 0u;
    if (v == 0) {
      *(u32*)(usize)(pRoomEx + 0x20) = 0u;
    } else {
      u32 pPreset = heap_alloc(0x100);
      u32 pRow = heap_alloc(0x20);
      u32 pMaze = (v >= 2) ? heap_alloc(0x20) : 0u;
      *(u32*)(usize)(pPreset + 0x14) = pRow;
      *(u32*)(usize)(pPreset + 0xF0) = pMaze;
      *(u32*)(usize)(pRoomEx + 0x20) = pPreset;
      track_region(pPreset, 0x100);
      track_region(pRow, 0x20);
      if (pMaze) track_region(pMaze, 0x20);
    }
    track_region(pRoomEx, 0x80);
    track_region(pLevel, 0x200);
    track_region(pDrlg, 0x490);
    snapshot_pre();
    call_esi_void(0x6FD5AEC0u, pRoomEx);
    char args[64];
    snprintf(args, sizeof(args), "[%u]", pRoomEx);
    emit_vector(fp, "0x6FD5AEC0", "DRLGPRESET_FreePresetRoomData113c", v, args, 0, 0);
  }

  /* 6. 0x6FD5E490 DRLGMAZE_AssignMazeRoomPrestId113c */
  {
    static const u32 kTypes[22] = {
      3, 4, 7, 8, 10, 13, 14, 15, 15, 17, 18, 19, 22, 23, 23, 24, 25, 28, 32, 33, 34, 35
    };
    for (int v = 0; v < 22; v++) {
      reset_heap();
      u32 pRoomEx = heap_alloc(0x80);
      u32 pPreset = heap_alloc(0x40);
      u32 pLevel = heap_alloc(0x200);
      u32 pDrlg = heap_alloc(0x490);
      u32 pMaze = heap_alloc(0x40);
      *(u32*)(usize)(pRoomEx + 0x20) = pPreset;
      *(u32*)(usize)(pRoomEx + 0x58) = pLevel;
      *(u32*)(usize)(pLevel + 0x14) = pMaze;
      *(u32*)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32*)(usize)(pLevel + 0x1C0) = kTypes[v];
      *(u32*)(usize)(pLevel + 0x1D0) = (v == 7) ? 0x34u : (v == 8) ? 0x36u : (v == 13) ? 0x54u : (v == 14) ? 0x55u : 10u;
      *(u32*)(usize)(pDrlg + 0x47C) = 0u;
      *(u32*)(usize)(pMaze + 0x04) = (v & 1) ? 0u : 1u;
      *(u32*)(usize)(pPreset + 0x0C) = 0x12u;
      /* Build pOrth list for directions so esi=5 (dirs 0 and 2) or esi=9 (dirs 0 and 1) */
      if (v > 0) {
        u32 n1 = heap_alloc(0x20);
        u32 n2 = heap_alloc(0x20);
        u32 n3 = heap_alloc(0x20);
        *(u32*)(usize)(n1 + 0x04) = 0u;
        *(u32*)(usize)(n1 + 0x14) = n2;
        *(u32*)(usize)(n2 + 0x04) = (v % 3 == 0) ? 2u : (v % 3 == 1) ? 1u : 3u;
        *(u32*)(usize)(n2 + 0x14) = (v == 2) ? n3 : 0u;
        *(u32*)(usize)(n3 + 0x04) = 4u;
        *(u32*)(usize)(n3 + 0x14) = 0u;
        *(u32*)(usize)(pRoomEx + 0x00) = n1;
        track_region(n1, 0x20);
        track_region(n2, 0x20);
        track_region(n3, 0x20);
      }
      u32 bClear = (u32)(v & 1);
      track_region(pRoomEx, 0x80);
      track_region(pPreset, 0x40);
      track_region(pLevel, 0x200);
      track_region(pDrlg, 0x490);
      track_region(pMaze, 0x40);
      snapshot_pre();
      u32 ret = call_ebx_stk1_u32(0x6FD5E490u, pRoomEx, bClear);
      char args[128];
      snprintf(args, sizeof(args), "[%u,%u]", pRoomEx, bClear);
      emit_vector(fp, "0x6FD5E490", "DRLGMAZE_AssignMazeRoomPrestId113c", v, args, ret, 1);
    }
  }

  /* 7. 0x6FD5ECB0 DRLGMAZE_PickSequentialSpecialPresetFileIndex113c */
  {
    /* Cases 18..21: type 3 (baseDef 0x34) with nDef = baseDef+16 (upper bound, rejected) and
     * baseDef+15 (last accepted); type 36 (switch idx 33 > 32) and type 2 (idx wraps unsigned). */
    static const u32 kTypes[22] = {
      3, 3, 4, 7, 8, 10, 13, 17, 18, 22, 24, 25, 28, 33, 34, 35, 5, 40, 3, 3, 36, 2
    };
    static const u32 kBaseDefs[22] = {
      0x34, 0x35, 0x6D, 0xA8, 0xCE, 0x102, 0x12E, 0x19E, 0x1E2, 0x2F2, 0x299, 0x2C1, 0x345, 0x3EB, 0x423, 0x41D, 0x35, 0x35,
      0x44, 0x43, 0x35, 0x35
    };
    for (int v = 0; v < 22; v++) {
      reset_heap();
      u32 pLevel = heap_alloc(0x200);
      u32 pDrlg = heap_alloc(0x490);
      u32 pMap = heap_alloc(0x20);
      u32 pPrestTxt = heap_alloc(0x60);
      *(u32*)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32*)(usize)(pDrlg + 0x478) = 0u;
      *(u32*)(usize)(pLevel + 0x1C0) = kTypes[v];
      *(u32*)(usize)(pLevel + 0x1C4) = 0x12345678u + (u32)v;
      *(u32*)(usize)(pLevel + 0x1C8) = 0x9ABCDEF0u;
      *(u32*)(usize)(pMap + 0x04) = 99u;
      *(u32*)(usize)(pMap + 0x08) = pPrestTxt;
      *(u32*)(usize)(pPrestTxt + 0x00) = (v == 2) ? (kBaseDefs[v] + 20u) : kBaseDefs[v];
      *(u32*)(usize)(pPrestTxt + 0x40) = 4u;
      if (v == 3) {
        u32 pExisting = heap_alloc(0x10);
        u32 pOther = heap_alloc(0x10);
        *(u32*)(usize)(pOther + 0x00) = 9999u;
        *(u32*)(usize)(pOther + 0x04) = 4u;
        *(u32*)(usize)(pOther + 0x08) = 1u;
        *(u32*)(usize)(pOther + 0x0C) = pExisting;
        *(u32*)(usize)(pExisting + 0x00) = kBaseDefs[v];
        *(u32*)(usize)(pExisting + 0x04) = 4u;
        *(u32*)(usize)(pExisting + 0x08) = 2u;
        *(u32*)(usize)(pExisting + 0x0C) = 0u;
        *(u32*)(usize)(pLevel + 0x1CC) = pOther;
        track_region(pExisting, 0x10);
        track_region(pOther, 0x10);
      } else if (v == 4) {
        u32 pOther = heap_alloc(0x10);
        *(u32*)(usize)(pOther + 0x00) = 8888u;
        *(u32*)(usize)(pOther + 0x04) = 4u;
        *(u32*)(usize)(pOther + 0x08) = 1u;
        *(u32*)(usize)(pOther + 0x0C) = 0u;
        *(u32*)(usize)(pLevel + 0x1CC) = pOther;
        track_region(pOther, 0x10);
      }
      u32 nPicked = (v == 0) ? 3u : 0xFFFFFFFFu;
      track_region(pLevel, 0x200);
      track_region(pDrlg, 0x490);
      track_region(pMap, 0x20);
      track_region(pPrestTxt, 0x60);
      snapshot_pre();
      (void)call_eax_ebx_stk1_u32(0x6FD5ECB0u, nPicked, pLevel, pMap);
      char args[128];
      snprintf(args, sizeof(args), "[%u,%u,%u]", nPicked, pLevel, pMap);
      emit_vector(fp, "0x6FD5ECB0", "DRLGMAZE_PickSequentialSpecialPresetFileIndex113c", v, args, 0, 0);
    }
  }

  /* 8. 0x6FD6B6E0 DRLGVER_BuildAndLocalizeRoomVertices113c */
  for (int v = 0; v < 4; v++) {
    reset_heap();
    u32 pCoord = heap_alloc(0x10);
    *(u32*)(usize)(pCoord + 0x00) = 10u + (u32)v;
    *(u32*)(usize)(pCoord + 0x04) = 20u + (u32)v;
    *(u32*)(usize)(pCoord + 0x08) = 8u;
    *(u32*)(usize)(pCoord + 0x0C) = 6u;
    u32 ppVertices = heap_alloc(8);
    u32 pOrthHead = 0u;
    if (v >= 1) {
      u32 o1 = heap_alloc(0x20);
      u32 b1 = heap_alloc(0x10);
      *(u32*)(usize)(b1 + 0x00) = 12u;
      *(u32*)(usize)(b1 + 0x04) = 20u;
      *(u32*)(usize)(b1 + 0x08) = 4u;
      *(u32*)(usize)(b1 + 0x0C) = 4u;
      *(u32*)(usize)(o1 + 0x04) = (u32)(v - 1);
      *(u32*)(usize)(o1 + 0x10) = b1;
      *(u32*)(usize)(o1 + 0x14) = 0u;
      pOrthHead = o1;
      track_region(o1, 0x20);
      track_region(b1, 0x10);
    }
    u32 nFlag = (u32)(v & 1);
    track_region(pCoord, 0x10);
    track_region(ppVertices, 8);
    snapshot_pre();
    call_eax_ecx_stk3_void(0x6FD6B6E0u, nFlag, pCoord, 0u, ppVertices, pOrthHead);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u,0,%u,%u]", nFlag, pCoord, ppVertices, pOrthHead);
    emit_vector(fp, "0x6FD6B6E0", "DRLGVER_BuildAndLocalizeRoomVertices113c", v, args, 0, 0);
  }

  /* 9. 0x6FD80050 PATH_GetTargetTypeAndPosition113c */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    u32 pUnit = heap_alloc(0x40);
    u32 pPath = heap_alloc(0x40);
    u32 pOut = heap_alloc(8);
    static const u32 kUTypes[6] = { 0, 1, 2, 3, 4, 5 };
    *(u32*)(usize)(pUnit + 0x00) = kUTypes[v];
    *(u32*)(usize)(pUnit + 0x2C) = (v == 1) ? 0u : pPath;
    *(u16*)(usize)(pPath + 0x02) = (u16)(111 + v * 10);
    *(u16*)(usize)(pPath + 0x06) = (u16)(222 + v * 10);
    *(u32*)(usize)(pPath + 0x0C) = 333u + (u32)v * 10u;
    *(u32*)(usize)(pPath + 0x10) = 444u + (u32)v * 10u;
    track_region(pUnit, 0x40);
    track_region(pPath, 0x40);
    track_region(pOut, 8);
    snapshot_pre();
    ((fn_std2_void_t)(usize)0x6FD80050u)(pUnit, pOut);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u]", pUnit, pOut);
    emit_vector(fp, "0x6FD80050", "PATH_GetTargetTypeAndPosition113c", v, args, 0, 0);
  }

  /* 10. 0x6FD85210 PATH_ResetToDefaultType113c */
  for (int v = 0; v < 4; v++) {
    reset_heap();
    u32 pPath = heap_alloc(0xA0);
    u32 pUnit = heap_alloc(0x40);
    *(u32*)(usize)(pUnit + 0x00) = (v < 2) ? 0u : 1u;
    *(u32*)(usize)(pPath + 0x30) = pUnit;
    *(u32*)(usize)(pPath + 0x34) = (v == 0) ? 0x8000u : (v == 1) ? 0u : (v == 2) ? 0xA000u : 0u;
    *(u32*)(usize)(pPath + 0x3C) = 1u;
    *(u32*)(usize)(pPath + 0x40) = 2u;
    *(u32*)(usize)(pPath + 0x7C) = 10u;
    *(u32*)(usize)(pPath + 0x80) = 25u;
    track_region(0x6FDE4100u, 0x200);
    track_region(pPath, 0xA0);
    track_region(pUnit, 0x40);
    snapshot_pre();
    ((fn_std1_void_t)(usize)0x6FD85210u)(pPath);
    char args[64];
    snprintf(args, sizeof(args), "[%u]", pPath);
    emit_vector(fp, "0x6FD85210", "PATH_ResetToDefaultType113c", v, args, 0, 0);
  }

  /* 11. 0x6FD920E0 DRLGOUTDOORS_FreeOutdoorLevelData113c */
  for (int v = 0; v < 4; v++) {
    reset_heap();
    u32 pLevel = heap_alloc(0x200);
    u32 pDrlg = heap_alloc(0x490);
    u32 pOutdoors = heap_alloc(0x280);
    *(u32*)(usize)(pLevel + 0x14) = pOutdoors;
    *(u32*)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32*)(usize)(pDrlg + 0x478) = 0u;
    *(u32*)(usize)(pOutdoors + 0x00) = (v & 1) ? 0x65u : 0x05u;
    if (v >= 1) {
      for (int g = 0; g < 4; g++) {
        u32 rBuf = heap_alloc(0x10);
        *(u32*)(usize)(pOutdoors + 0x04 + g * 0x14 + 0x00) = rBuf;
        *(u32*)(usize)(pOutdoors + 0x04 + g * 0x14 + 0x04) = rBuf;
        track_region(rBuf, 0x10);
      }
      u32 n1 = heap_alloc(0x20);
      u32 n2 = heap_alloc(0x20);
      *(u32*)(usize)(n1 + 0x14) = n2;
      *(u32*)(usize)(n2 + 0x14) = 0u;
      *(u32*)(usize)(pOutdoors + 0x264) = n1;
      track_region(n1, 0x20);
      track_region(n2, 0x20);
    }
    *(u32*)(usize)(pOutdoors + 0x80) = 0xAABBCCDDu;
    *(u32*)(usize)(pOutdoors + 0x260) = 5u;
    u32 bKeep = (u32)(v & 1);
    track_region(pLevel, 0x200);
    track_region(pDrlg, 0x490);
    track_region(pOutdoors, 0x280);
    snapshot_pre();
    ((fn_std2_void_t)(usize)0x6FD920E0u)(pLevel, bKeep);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u]", pLevel, bKeep);
    emit_vector(fp, "0x6FD920E0", "DRLGOUTDOORS_FreeOutdoorLevelData113c", v, args, 0, 0);
  }

  /* 12. 0x6FD9A4D0 DRLGOUTROOM_FreeOutdoorRoomData113c */
  for (int v = 0; v < 4; v++) {
    reset_heap();
    u32 pOutRoom = heap_alloc(0x60);
    if (v >= 1) {
      for (int g = 0; g < 4; g++) {
        u32 rBuf = heap_alloc(0x10);
        *(u32*)(usize)(pOutRoom + g * 0x14 + 0x00) = rBuf;
        *(u32*)(usize)(pOutRoom + g * 0x14 + 0x04) = rBuf;
        track_region(rBuf, 0x10);
      }
    }
    track_region(pOutRoom, 0x60);
    snapshot_pre();
    call_eax_esi_void(0x6FD9A4D0u, 0u, pOutRoom);
    char args[128];
    snprintf(args, sizeof(args), "[0,%u]", pOutRoom);
    emit_vector(fp, "0x6FD9A4D0", "DRLGOUTROOM_FreeOutdoorRoomData113c", v, args, 0, 0);
  }
}
/* D2CMP.#10011: D2CMP_10011_GetTileSubtileFlags(__stdcall pTileLibraryEntry) -> u8* */
static u32 __stdcall stub_d2cmp_10011(u32 pEntry) {
  return pEntry != 0u ? (pEntry + 0x28u) : 0u;
}

/* Helper: build 2 adjacent rooms (room0: subtile [100..110)x[100..110), room1: [110..120)x[100..110)) */
static void setup_two_rooms(u32 *outRoom0, u32 *outRoom1, u32 *outGrid0, u32 *outGrid1, u32 *outMap0, u32 *outMap1) {
  u32 r0 = heap_alloc(0x80);
  u32 r1 = heap_alloc(0x80);
  u32 g0 = heap_alloc(0x30);
  u32 g1 = heap_alloc(0x30);
  u32 m0 = heap_alloc(200);
  u32 m1 = heap_alloc(200);
  u32 near0 = heap_alloc(8);
  u32 near1 = heap_alloc(8);
  *(u32*)(usize)(near0 + 0) = r0;
  *(u32*)(usize)(near0 + 4) = r1;
  *(u32*)(usize)(near1 + 0) = r1;
  *(u32*)(usize)(near1 + 4) = r0;

  *(u32*)(usize)(r0 + 0x00) = near0;
  *(u32*)(usize)(r0 + 0x20) = g0;
  *(u32*)(usize)(r0 + 0x24) = 2u;
  *(u32*)(usize)(r0 + 0x4C) = 100u;
  *(u32*)(usize)(r0 + 0x50) = 100u;
  *(u32*)(usize)(r0 + 0x54) = 10u;
  *(u32*)(usize)(r0 + 0x58) = 10u;
  *(u32*)(usize)(r0 + 0x5C) = 20u;
  *(u32*)(usize)(r0 + 0x60) = 20u;
  *(u32*)(usize)(r0 + 0x64) = 2u;
  *(u32*)(usize)(r0 + 0x68) = 2u;

  *(u32*)(usize)(r1 + 0x00) = near1;
  *(u32*)(usize)(r1 + 0x20) = g1;
  *(u32*)(usize)(r1 + 0x24) = 2u;
  *(u32*)(usize)(r1 + 0x4C) = 110u;
  *(u32*)(usize)(r1 + 0x50) = 100u;
  *(u32*)(usize)(r1 + 0x54) = 10u;
  *(u32*)(usize)(r1 + 0x58) = 10u;
  *(u32*)(usize)(r1 + 0x5C) = 22u;
  *(u32*)(usize)(r1 + 0x60) = 20u;
  *(u32*)(usize)(r1 + 0x64) = 2u;
  *(u32*)(usize)(r1 + 0x68) = 2u;

  *(u32*)(usize)(g0 + 0x00) = 100u;
  *(u32*)(usize)(g0 + 0x04) = 100u;
  *(u32*)(usize)(g0 + 0x08) = 10u;
  *(u32*)(usize)(g0 + 0x0C) = 10u;
  *(u32*)(usize)(g0 + 0x10) = 20u;
  *(u32*)(usize)(g0 + 0x14) = 20u;
  *(u32*)(usize)(g0 + 0x18) = 2u;
  *(u32*)(usize)(g0 + 0x1C) = 2u;
  *(u32*)(usize)(g0 + 0x20) = m0;

  *(u32*)(usize)(g1 + 0x00) = 110u;
  *(u32*)(usize)(g1 + 0x04) = 100u;
  *(u32*)(usize)(g1 + 0x08) = 10u;
  *(u32*)(usize)(g1 + 0x0C) = 10u;
  *(u32*)(usize)(g1 + 0x10) = 22u;
  *(u32*)(usize)(g1 + 0x14) = 20u;
  *(u32*)(usize)(g1 + 0x18) = 2u;
  *(u32*)(usize)(g1 + 0x1C) = 2u;
  *(u32*)(usize)(g1 + 0x20) = m1;

  track_region(r0, 0x80);
  track_region(r1, 0x80);
  track_region(g0, 0x30);
  track_region(g1, 0x30);
  track_region(m0, 200);
  track_region(m1, 200);
  track_region(near0, 8);
  track_region(near1, 8);

  *outRoom0 = r0;
  *outRoom1 = r1;
  *outGrid0 = g0;
  *outGrid1 = g1;
  *outMap0 = m0;
  *outMap1 = m1;
}

/* Helper: build nRooms (2 or 4) mutually-near rooms of 10 x h subtiles laid out 2x2:
 * room0 [100..110)x[100..100+h), room1 [110..120)x[100..100+h),
 * room2 [100..110)x[100+h..100+2h), room3 [110..120)x[100+h..100+2h).
 * Every room's ppRoomsNear lists all nRooms rooms (self first). h != 10 gives a
 * non-square collision grid, so stride (+0x08) and height (+0x0C) differ. */
static void setup_room_grid(int nRooms, u32 h, u32 *rooms, u32 *grids, u32 *maps) {
  u32 nearLists[4];
  for (int i = 0; i < nRooms; i++) {
    rooms[i] = heap_alloc(0x80);
    grids[i] = heap_alloc(0x30);
    maps[i] = heap_alloc(200);
    nearLists[i] = heap_alloc(16);
  }
  for (int i = 0; i < nRooms; i++) {
    u32 sx = 100u + (u32)(i & 1) * 10u;
    u32 sy = 100u + (u32)(i >> 1) * h;
    u32 r = rooms[i], g = grids[i];
    for (int j = 0; j < nRooms; j++) {
      *(u32*)(usize)(nearLists[i] + (u32)j * 4u) = rooms[(i + j) % nRooms];
    }
    *(u32*)(usize)(r + 0x00) = nearLists[i];
    *(u32*)(usize)(r + 0x20) = g;
    *(u32*)(usize)(r + 0x24) = (u32)nRooms;
    *(u32*)(usize)(r + 0x4C) = sx;
    *(u32*)(usize)(r + 0x50) = sy;
    *(u32*)(usize)(r + 0x54) = 10u;
    *(u32*)(usize)(r + 0x58) = h;
    *(u32*)(usize)(r + 0x5C) = sx / 5u;
    *(u32*)(usize)(r + 0x60) = sy / 5u;
    *(u32*)(usize)(r + 0x64) = 2u;
    *(u32*)(usize)(r + 0x68) = (h >= 5u) ? (h / 5u) : 1u;
    *(u32*)(usize)(g + 0x00) = sx;
    *(u32*)(usize)(g + 0x04) = sy;
    *(u32*)(usize)(g + 0x08) = 10u;
    *(u32*)(usize)(g + 0x0C) = h;
    *(u32*)(usize)(g + 0x10) = sx / 5u;
    *(u32*)(usize)(g + 0x14) = sy / 5u;
    *(u32*)(usize)(g + 0x18) = 2u;
    *(u32*)(usize)(g + 0x1C) = (h >= 5u) ? (h / 5u) : 1u;
    *(u32*)(usize)(g + 0x20) = maps[i];
  }
  for (int i = 0; i < nRooms; i++) {
    track_region(rooms[i], 0x80);
    track_region(grids[i], 0x30);
    track_region(maps[i], 200);
    track_region(nearLists[i], 16);
  }
}

/* Set collision cell (x, y) (absolute subtile coords) in the 10-wide room grid at sx/sy. */
static void set_cell(u32 map, u32 sx, u32 sy, u32 x, u32 y, u16 val) {
  *(u16*)(usize)(map + ((y - sy) * 10u + (x - sx)) * 2u) = val;
}

/* Set collision cell (x, y) in whichever setup_room_grid room contains it. */
static void set_cell_grid(const u32 *maps, u32 h, u32 x, u32 y, u16 val) {
  int i = ((x >= 110u) ? 1 : 0) + ((y >= 100u + h) ? 2 : 0);
  set_cell(maps[i], 100u + (u32)(i & 1) * 10u, 100u + (u32)(i >> 1) * h, x, y, val);
}

static void emit_b053(FILE *fp) {
  /* 1. 0x6FD9AD20 COLLISION_RayTrace113c */
  {
    static const u32 kX0[12] = { 102, 102, 102, 102, 102, 108, 112, 102, 106, 102, 106, 101 };
    static const u32 kY0[12] = { 102, 102, 102, 102, 106, 102, 102, 102, 108, 102, 106, 102 };
    static const u32 kX1[12] = { 102, 102, 102, 108, 108, 102, 105, 105, 102, 106, 102, 95  };
    static const u32 kY1[12] = { 102, 102, 102, 105, 102, 105, 105, 108, 102, 106, 102, 102 };
    for (int v = 0; v < 12; v++) {
      reset_heap();
      u32 r0, r1, g0, g1, m0, m1;
      setup_two_rooms(&r0, &r1, &g0, &g1, &m0, &m1);
      if (v == 2) *(u16*)(usize)(m0 + (2 * 10 + 2) * 2) = 0x0004u;
      if (v == 4) *(u16*)(usize)(m0 + (4 * 10 + 5) * 2) = 0x0004u;
      if (v == 8) *(u16*)(usize)(m0 + (5 * 10 + 4) * 2) = 0x0004u;
      if (v == 10) *(u16*)(usize)(m0 + (4 * 10 + 4) * 2) = 0x0004u;
      u32 pCoord = heap_alloc(16);
      u32 pPt1 = pCoord;
      u32 pPt2 = pCoord + 8u;
      *(u32*)(usize)(pPt1 + 0) = kX0[v];
      *(u32*)(usize)(pPt1 + 4) = kY0[v];
      *(u32*)(usize)(pPt2 + 0) = kX1[v];
      *(u32*)(usize)(pPt2 + 4) = kY1[v];
      track_region(pCoord, 16);
      u32 pRoomArg = (v == 0) ? 0u : (v == 6) ? r1 : r0;
      snapshot_pre();
      u32 ret = ((fn_std4_u32_t)(usize)0x6FD9AD20u)(pRoomArg, pPt1, pPt2, 0x0004u);
      char args[128];
      snprintf(args, sizeof(args), "[%u,%u,%u,4]", pRoomArg, pPt1, pPt2);
      emit_vector(fp, "0x6FD9AD20", "COLLISION_RayTrace113c", v, args, ret, 1);
    }
    /* Extended cases: vertical rays, room transitions, rays leaving the room set,
     * non-square (h=5) grids. Columns: nRooms, h, startRoom, x0, y0, x1, y1, hitX, hitY
     * (hitX == 0: no collision cell). */
    static const u32 kExt[16][9] = {
      { 4, 10, 0, 104, 101, 104, 108, 104, 106 }, /* vertical down, hit inside room0 */
      { 4, 10, 0, 104, 108, 104, 101,   0,   0 }, /* vertical up, clear */
      { 4, 10, 0, 104, 105, 104, 115,   0,   0 }, /* vertical down room0 -> room2, clear */
      { 4, 10, 0, 104, 105, 104, 115, 104, 113 }, /* vertical down room0 -> room2, hit in room2 */
      { 4, 10, 2, 104, 115, 104, 103, 104, 104 }, /* vertical up room2 -> room0, hit in room0 */
      { 4, 10, 0, 105, 104, 115, 104,   0,   0 }, /* horizontal right room0 -> room1, clear */
      { 4, 10, 1, 115, 104, 103, 104, 106, 104 }, /* horizontal left room1 -> room0, hit */
      { 4, 10, 0, 102, 102, 105, 115,   0,   0 }, /* steep diagonal room0 -> room2, clear */
      { 4, 10, 0, 102, 102, 115, 105,   0,   0 }, /* shallow diagonal room0 -> room1, clear */
      { 4, 10, 0, 105, 105, 115, 115,   0,   0 }, /* 45-degree diagonal into room3 */
      { 4, 10, 3, 117, 116, 103, 102, 108, 104 }, /* diagonal up-left room3 -> room0, hit */
      { 2, 10, 0, 104, 105, 104, 113,   0,   0 }, /* vertical down leaves the room set */
      { 2, 10, 0, 102, 102, 104, 113,   0,   0 }, /* steep diagonal leaves the room set */
      { 4,  5, 0, 103, 101, 103, 108, 103, 107 }, /* h=5 vertical down, hit in room2 */
      { 4,  5, 0, 101, 101, 108, 108, 106, 106 }, /* h=5 diagonal, hit in room2 */
      { 4,  5, 0, 103, 103, 103, 103, 103, 103 }  /* h=5 single point, hit (dx == dy == 0) */
    };
    for (int e = 0; e < 16; e++) {
      reset_heap();
      u32 rooms[4], grids[4], maps[4];
      setup_room_grid((int)kExt[e][0], kExt[e][1], rooms, grids, maps);
      if (kExt[e][7] != 0u) set_cell_grid(maps, kExt[e][1], kExt[e][7], kExt[e][8], 0x0004u);
      u32 pCoord = heap_alloc(16);
      u32 pPt1 = pCoord;
      u32 pPt2 = pCoord + 8u;
      *(u32*)(usize)(pPt1 + 0) = kExt[e][3];
      *(u32*)(usize)(pPt1 + 4) = kExt[e][4];
      *(u32*)(usize)(pPt2 + 0) = kExt[e][5];
      *(u32*)(usize)(pPt2 + 4) = kExt[e][6];
      track_region(pCoord, 16);
      u32 pRoomArg = rooms[kExt[e][2]];
      snapshot_pre();
      u32 ret = ((fn_std4_u32_t)(usize)0x6FD9AD20u)(pRoomArg, pPt1, pPt2, 0x0004u);
      char args[128];
      snprintf(args, sizeof(args), "[%u,%u,%u,4]", pRoomArg, pPt1, pPt2);
      emit_vector(fp, "0x6FD9AD20", "COLLISION_RayTrace113c", 12 + e, args, ret, 1);
    }
  }

  /* 2. 0x6FD9B280 COLLISION_SetMaskForBoundingBoxRecursively113c */
  for (int v = 0; v < 4; v++) {
    reset_heap();
    u32 r0, r1, g0, g1, m0, m1;
    setup_two_rooms(&r0, &r1, &g0, &g1, &m0, &m1);
    u32 pBox = heap_alloc(16);
    *(u32*)(usize)(pBox + 0) = (v == 0) ? 102u : (v == 1) ? 108u : (v == 2) ? 98u : 80u;
    *(u32*)(usize)(pBox + 4) = 102u;
    *(u32*)(usize)(pBox + 8) = (v == 0) ? 105u : (v == 1) ? 113u : (v == 2) ? 103u : 85u;
    *(u32*)(usize)(pBox + 12) = 105u;
    track_region(pBox, 16);
    snapshot_pre();
    (void)call_fastcall_stk1_u32(0x6FD9B280u, r0, pBox, 0x0010u);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u,16]", r0, pBox);
    emit_vector(fp, "0x6FD9B280", "COLLISION_SetMaskForBoundingBoxRecursively113c", v, args, 0, 0);
  }

  /* 3. 0x6FD9B2F0 COLLISION_ClearMaskForBoundingBoxRecursively113c */
  for (int v = 0; v < 4; v++) {
    reset_heap();
    u32 r0, r1, g0, g1, m0, m1;
    setup_two_rooms(&r0, &r1, &g0, &g1, &m0, &m1);
    for (int i = 0; i < 100; i++) {
      *(u16*)(usize)(m0 + i * 2) = 0x00FFu;
      *(u16*)(usize)(m1 + i * 2) = 0x00FFu;
    }
    u32 pBox = heap_alloc(16);
    *(u32*)(usize)(pBox + 0) = (v == 0) ? 102u : (v == 1) ? 108u : (v == 2) ? 98u : 80u;
    *(u32*)(usize)(pBox + 4) = 102u;
    *(u32*)(usize)(pBox + 8) = (v == 0) ? 105u : (v == 1) ? 113u : (v == 2) ? 103u : 85u;
    *(u32*)(usize)(pBox + 12) = 105u;
    track_region(pBox, 16);
    snapshot_pre();
    (void)call_fastcall_stk1_u32(0x6FD9B2F0u, r0, pBox, 0x0008u);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u,8]", r0, pBox);
    emit_vector(fp, "0x6FD9B2F0", "COLLISION_ClearMaskForBoundingBoxRecursively113c", v, args, 0, 0);
  }

  /* 4. 0x6FD9B360 COLLISION_CheckAnyCollisionWithBoxRecursively113c */
  for (int v = 0; v < 4; v++) {
    reset_heap();
    u32 r0, r1, g0, g1, m0, m1;
    setup_two_rooms(&r0, &r1, &g0, &g1, &m0, &m1);
    if (v == 1) *(u16*)(usize)(m1 + (3 * 10 + 1) * 2) = 0x0004u;
    u32 pBox = heap_alloc(16);
    *(u32*)(usize)(pBox + 0) = (v == 0) ? 102u : (v == 1) ? 108u : (v == 2) ? 98u : 80u;
    *(u32*)(usize)(pBox + 4) = 102u;
    *(u32*)(usize)(pBox + 8) = (v == 0) ? 105u : (v == 1) ? 113u : (v == 2) ? 103u : 85u;
    *(u32*)(usize)(pBox + 12) = 105u;
    track_region(pBox, 16);
    snapshot_pre();
    u32 ret = call_fastcall_stk1_u32(0x6FD9B360u, r0, pBox, 0x0004u);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u,4]", r0, pBox);
    emit_vector(fp, "0x6FD9B360", "COLLISION_CheckAnyCollisionWithBoxRecursively113c", v, args, ret, 1);
  }

  /* 5. 0x6FD9B3F0 COLLISION_GetCombinedMaskForBoxRecursively113c */
  for (int v = 0; v < 4; v++) {
    reset_heap();
    u32 r0, r1, g0, g1, m0, m1;
    setup_two_rooms(&r0, &r1, &g0, &g1, &m0, &m1);
    *(u16*)(usize)(m0 + (3 * 10 + 3) * 2) = 0x0002u;
    *(u16*)(usize)(m1 + (3 * 10 + 1) * 2) = 0x0008u;
    u32 pBox = heap_alloc(16);
    *(u32*)(usize)(pBox + 0) = (v == 0) ? 102u : (v == 1) ? 108u : (v == 2) ? 98u : 80u;
    *(u32*)(usize)(pBox + 4) = 102u;
    *(u32*)(usize)(pBox + 8) = (v == 0) ? 105u : (v == 1) ? 113u : (v == 2) ? 103u : 85u;
    *(u32*)(usize)(pBox + 12) = 105u;
    track_region(pBox, 16);
    snapshot_pre();
    u32 ret = call_fastcall_stk1_u32(0x6FD9B3F0u, r0, pBox, 0x00FFu) & 0xFFFFu;
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u,255]", r0, pBox);
    emit_vector(fp, "0x6FD9B3F0", "COLLISION_GetCombinedMaskForBoxRecursively113c", v, args, ret, 1);
  }

  /* 2..5 extended: clip rects spanning 2 and 4 rooms (multi-level split recursion),
   * non-square h=5 grids. Columns: h, x1, y1, x2, y2, hitCell (CheckAny only). */
  {
    static const u32 kBoxFns[4] = { 0x6FD9B280u, 0x6FD9B2F0u, 0x6FD9B360u, 0x6FD9B3F0u };
    static const char *kBoxNames[4] = {
      "COLLISION_SetMaskForBoundingBoxRecursively113c",
      "COLLISION_ClearMaskForBoundingBoxRecursively113c",
      "COLLISION_CheckAnyCollisionWithBoxRecursively113c",
      "COLLISION_GetCombinedMaskForBoxRecursively113c"
    };
    static const u32 kBoxMask[4] = { 0x0010u, 0x0008u, 0x0004u, 0x00FFu };
    static const u32 kBox[7][6] = {
      { 10, 105, 105, 115, 115, 0 }, /* all four rooms */
      { 10, 108, 102, 113, 105, 0 }, /* room0 | room1 */
      { 10, 103, 108, 106, 113, 0 }, /* room0 / room2 */
      { 10, 101, 101, 118, 118, 0 }, /* nearly the whole 2x2 block */
      {  5, 103, 103, 114, 108, 0 }, /* h=5, all four rooms */
      { 10, 105, 105, 115, 115, 1 }, /* all four rooms, collision in room3 */
      {  5, 103, 103, 114, 108, 1 }  /* h=5, collision in room3 */
    };
    for (int f = 0; f < 4; f++) {
      for (int c = 0; c < 7; c++) {
        reset_heap();
        u32 h = kBox[c][0];
        u32 rooms[4], grids[4], maps[4];
        setup_room_grid(4, h, rooms, grids, maps);
        if (f == 1) {
          for (int r = 0; r < 4; r++) {
            for (int i = 0; i < 100; i++) *(u16*)(usize)(maps[r] + (u32)i * 2u) = 0x00FFu;
          }
        }
        if (f == 2 && kBox[c][5] != 0u) {
          if (h == 10u) set_cell_grid(maps, h, 114u, 114u, 0x0004u);
          else set_cell_grid(maps, h, 112u, 106u, 0x0004u);
        }
        if (f == 3) {
          if (h == 10u) {
            set_cell_grid(maps, h, 106u, 106u, 0x0001u);
            set_cell_grid(maps, h, 112u, 106u, 0x0002u);
            set_cell_grid(maps, h, 106u, 112u, 0x0010u);
            set_cell_grid(maps, h, 113u, 113u, 0x0040u);
          } else {
            set_cell_grid(maps, h, 104u, 104u, 0x0001u);
            set_cell_grid(maps, h, 112u, 103u, 0x0002u);
            set_cell_grid(maps, h, 104u, 107u, 0x0010u);
            set_cell_grid(maps, h, 113u, 108u, 0x0040u);
          }
        }
        u32 pBox = heap_alloc(16);
        *(u32*)(usize)(pBox + 0) = kBox[c][1];
        *(u32*)(usize)(pBox + 4) = kBox[c][2];
        *(u32*)(usize)(pBox + 8) = kBox[c][3];
        *(u32*)(usize)(pBox + 12) = kBox[c][4];
        track_region(pBox, 16);
        snapshot_pre();
        u32 ret = call_fastcall_stk1_u32(kBoxFns[f], rooms[0], pBox, kBoxMask[f]);
        if (f == 3) ret &= 0xFFFFu;
        char vaStr[16], args[128];
        snprintf(vaStr, sizeof(vaStr), "0x%08X", kBoxFns[f]);
        snprintf(args, sizeof(args), "[%u,%u,%u]", rooms[0], pBox, kBoxMask[f]);
        emit_vector(fp, vaStr, kBoxNames[f], 4 + c, args, (f >= 2) ? ret : 0u, (f >= 2) ? 1 : 0);
      }
    }
  }

  /* 6..12. Subtile mask helpers */
  {
    static const u32 kSubFns[7] = {
      0x6FD9B4D0u, 0x6FD9B930u, 0x6FD9BB70u, 0x6FD9C570u, 0x6FD9C940u, 0x6FD9C990u, 0x6FD9C9D0u
    };
    static const char *kSubNames[7] = {
      "COLLISION_ClearSubtileMaskInRoom113c",
      "COLLISION_SetSubtileMaskInRoom113c",
      "COLLISION_ClearSubtileMaskInRoom_6FD9BB70_113c",
      "COLLISION_CheckSubtileMaskInRoomFast113c",
      "COLLISION_ClearSubtileMask113c",
      "COLLISION_SetSubtileMask113c",
      "COLLISION_CheckSubtileMask113c"
    };
    static const int kHasRet[7] = { 0, 0, 0, 1, 0, 0, 1 };
    for (int f = 0; f < 7; f++) {
      for (int v = 0; v < 4; v++) {
        reset_heap();
        u32 r0, r1, g0, g1, m0, m1;
        setup_two_rooms(&r0, &r1, &g0, &g1, &m0, &m1);
        for (int i = 0; i < 100; i++) {
          *(u16*)(usize)(m0 + i * 2) = 0x001Fu;
          *(u16*)(usize)(m1 + i * 2) = 0x003Fu;
        }
        u32 pRoomArg = (v == 3) ? 0u : r0;
        u32 sx = (v == 0) ? 103u : (v == 1) ? 112u : 80u;
        u32 sy = 104u;
        snapshot_pre();
        u32 ret = 0u;
        char vaStr[16], args[128];
        snprintf(vaStr, sizeof(vaStr), "0x%08X", kSubFns[f]);
        if (f == 0 || f == 2) {
          /* eax=pRoom, ecx=wMask, edx=nY, [esp+4]=nX */
          (void)call_eax_ecx_edx_stk1_u32(kSubFns[f], pRoomArg, 0x0008u, sy, sx);
          snprintf(args, sizeof(args), "[%u,8,%u,%u]", pRoomArg, sy, sx);
        } else if (f == 1) {
          /* eax=pRoom, ecx=nY, edx=nX, [esp+4]=wMask */
          (void)call_eax_ecx_edx_stk1_u32(kSubFns[f], pRoomArg, sy, sx, 0x0008u);
          snprintf(args, sizeof(args), "[%u,%u,%u,8]", pRoomArg, sy, sx);
        } else if (f == 3) {
          /* eax=pRoom, ecx=nY, edx=nX, [esp+4]=wMask -> uint16 */
          ret = call_eax_ecx_edx_stk1_u32(kSubFns[f], pRoomArg, sy, sx, 0x0008u) & 0xFFFFu;
          snprintf(args, sizeof(args), "[%u,%u,%u,8]", pRoomArg, sy, sx);
        } else {
          /* __stdcall(pRoom, nX, nY, wMask) */
          ret = ((fn_std4_u32_t)(usize)kSubFns[f])(pRoomArg, sx, sy, 0x0008u);
          if (f == 6) ret &= 0xFFFFu;
          snprintf(args, sizeof(args), "[%u,%u,%u,8]", pRoomArg, sx, sy);
        }
        emit_vector(fp, vaStr, kSubNames[f], v, args, kHasRet[f] ? ret : 0u, kHasRet[f]);
      }
    }
    /* Extended cases (non-degenerate): 2x2 rooms with h=5 (non-square grid, stride 10 !=
     * height 5), a varied cell pattern in which bits 3 and 8 are always clear and bit 0
     * varies, and wMask = 0x0109, so Set / Clear / Check all observably change or read
     * the target cell. Columns: x, y, nullMode (0 none, 1 room0 grid NULL, 2 room0 map NULL). */
    static const u32 kSubExt[8][3] = {
      { 103, 102, 0 }, /* room0, rx=3 ry=2, cell 0x00D6 (bit0 clear) */
      { 104, 102, 0 }, /* room0, rx=4 ry=2, cell 0x00E1 (bit0 set) */
      { 114, 103, 0 }, /* room1 via ppRoomsNear */
      { 106, 107, 0 }, /* room2 via ppRoomsNear */
      { 110, 104, 0 }, /* x == room0 end -> room1 column 0 */
      { 109, 104, 0 }, /* last column of room0 */
      { 103, 102, 1 }, /* room0 found, collision grid NULL */
      { 103, 102, 2 }  /* room0 found, grid map NULL */
    };
    for (int f = 0; f < 7; f++) {
      for (int c = 0; c < 8; c++) {
        reset_heap();
        u32 rooms[4], grids[4], maps[4];
        setup_room_grid(4, 5u, rooms, grids, maps);
        for (int r = 0; r < 4; r++) {
          for (int i = 0; i < 50; i++) {
            *(u16*)(usize)(maps[r] + (u32)i * 2u) = (u16)((0x0021u + (u32)(i + r * 7) * 0x0013u) & 0x00F7u);
          }
        }
        if (kSubExt[c][2] == 1u) *(u32*)(usize)(rooms[0] + 0x20) = 0u;
        if (kSubExt[c][2] == 2u) *(u32*)(usize)(grids[0] + 0x20) = 0u;
        u32 pRoomArg = rooms[0];
        u32 sx = kSubExt[c][0];
        u32 sy = kSubExt[c][1];
        snapshot_pre();
        u32 ret = 0u;
        char vaStr[16], args[128];
        snprintf(vaStr, sizeof(vaStr), "0x%08X", kSubFns[f]);
        if (f == 0 || f == 2) {
          (void)call_eax_ecx_edx_stk1_u32(kSubFns[f], pRoomArg, 0x0109u, sy, sx);
          snprintf(args, sizeof(args), "[%u,265,%u,%u]", pRoomArg, sy, sx);
        } else if (f == 1) {
          (void)call_eax_ecx_edx_stk1_u32(kSubFns[f], pRoomArg, sy, sx, 0x0109u);
          snprintf(args, sizeof(args), "[%u,%u,%u,265]", pRoomArg, sy, sx);
        } else if (f == 3) {
          ret = call_eax_ecx_edx_stk1_u32(kSubFns[f], pRoomArg, sy, sx, 0x0109u) & 0xFFFFu;
          snprintf(args, sizeof(args), "[%u,%u,%u,265]", pRoomArg, sy, sx);
        } else {
          ret = ((fn_std4_u32_t)(usize)kSubFns[f])(pRoomArg, sx, sy, 0x0109u);
          if (f == 6) ret &= 0xFFFFu;
          snprintf(args, sizeof(args), "[%u,%u,%u,265]", pRoomArg, sx, sy);
        }
        emit_vector(fp, vaStr, kSubNames[f], 4 + c, args, kHasRet[f] ? ret : 0u, kHasRet[f]);
      }
    }
  }

  /* 13..14. CrossPatternMask (0x6FD9B970, 0x6FD9BBB0) */
  for (int f = 0; f < 2; f++) {
    u32 fnVa = (f == 0) ? 0x6FD9B970u : 0x6FD9BBB0u;
    const char *fnName = (f == 0) ? "COLLISION_SetCrossPatternMask113c" : "COLLISION_ClearCrossPatternMask113c";
    for (int v = 0; v < 4; v++) {
      reset_heap();
      u32 r0, r1, g0, g1, m0, m1;
      setup_two_rooms(&r0, &r1, &g0, &g1, &m0, &m1);
      if (f == 1) {
        for (int i = 0; i < 100; i++) {
          *(u16*)(usize)(m0 + i * 2) = 0x00FFu;
          *(u16*)(usize)(m1 + i * 2) = 0x00FFu;
        }
      }
      u32 pRoomArg = (v == 3) ? 0u : r0;
      u32 sx = (v == 0) ? 104u : (v == 1) ? 109u : 80u;
      u32 sy = (v == 1) ? 100u : 104u;
      snapshot_pre();
      call_esi_stk3_void(fnVa, sy, pRoomArg, sx, 0x0020u);
      char vaStr[16], args[128];
      snprintf(vaStr, sizeof(vaStr), "0x%08X", fnVa);
      snprintf(args, sizeof(args), "[%u,%u,%u,32]", sy, pRoomArg, sx);
      emit_vector(fp, vaStr, fnName, v, args, 0, 0);
    }
    /* Extended: 2x2 rooms, h=5. Columns: x, y, nullMode (1 room0 grid NULL, 2 room1 map NULL). */
    static const u32 kCrossExt[5][3] = {
      { 110, 105, 0 }, /* junction: arms land in room0/room1/room3 */
      { 109, 104, 0 }, /* room0 corner cell: right arm room1, down arm room2 */
      { 100, 100, 0 }, /* top-left corner: left/up arms outside every room */
      { 110, 104, 1 }, /* room0 grid NULL: left arm skipped */
      { 110, 104, 2 }  /* room1 map NULL: centre/right/up arms skipped */
    };
    for (int c = 0; c < 5; c++) {
      reset_heap();
      u32 rooms[4], grids[4], maps[4];
      setup_room_grid(4, 5u, rooms, grids, maps);
      for (int r = 0; r < 4; r++) {
        for (int i = 0; i < 50; i++) {
          *(u16*)(usize)(maps[r] + (u32)i * 2u) = (u16)((f == 1) ? (0x0031u + (u32)(i + r) * 0x0007u) & 0x00FFu : (u32)(i + r) & 0x0003u);
        }
      }
      if (kCrossExt[c][2] == 1u) *(u32*)(usize)(rooms[0] + 0x20) = 0u;
      if (kCrossExt[c][2] == 2u) *(u32*)(usize)(grids[1] + 0x20) = 0u;
      u32 sx = kCrossExt[c][0];
      u32 sy = kCrossExt[c][1];
      snapshot_pre();
      call_esi_stk3_void(fnVa, sy, rooms[0], sx, 0x0030u);
      char vaStr[16], args[128];
      snprintf(vaStr, sizeof(vaStr), "0x%08X", fnVa);
      snprintf(args, sizeof(args), "[%u,%u,%u,48]", sy, rooms[0], sx);
      emit_vector(fp, vaStr, fnName, 4 + c, args, 0, 0);
    }
  }

  /* 15. 0x6FD9CA20 COLLISION_ReplaceTileSubtileFlagsInRoom113c */
  for (int v = 0; v < 5; v++) {
    reset_heap();
    u32 r0, r1, g0, g1, m0, m1;
    setup_two_rooms(&r0, &r1, &g0, &g1, &m0, &m1);
    for (int i = 0; i < 100; i++) {
      *(u16*)(usize)(m0 + i * 2) = 0x003Fu;
      *(u16*)(usize)(m1 + i * 2) = 0x003Fu;
    }
    if (v == 1) *(u32*)(usize)(r0 + 0x20) = 0u;
    u32 pOldLib = heap_alloc(0x48);
    u32 pNewLib = heap_alloc(0x48);
    for (int i = 0; i < 25; i++) {
      *(u8*)(usize)(pOldLib + 0x28 + i) = 0x08u;
      *(u8*)(usize)(pNewLib + 0x28 + i) = 0x80u;
    }
    u32 pTile = heap_alloc(0x20);
    *(u32*)(usize)(pTile + 0x08) = (v == 2) ? 0u : (v == 3) ? 2u : 0xFFFFFFFCu;
    *(u32*)(usize)(pTile + 0x0C) = 0u;
    *(u32*)(usize)(pTile + 0x18) = pOldLib;
    track_region(pOldLib, 0x48);
    track_region(pNewLib, 0x48);
    track_region(pTile, 0x20);
    u32 pRoomArg = (v == 0) ? 0u : r0;
    u32 pNewLibArg = (v == 2) ? 0u : pNewLib;
    snapshot_pre();
    (void)call_eax_stk2_u32(0x6FD9CA20u, pRoomArg, pTile, pNewLibArg);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u,%u]", pRoomArg, pTile, pNewLibArg);
    emit_vector(fp, "0x6FD9CA20", "COLLISION_ReplaceTileSubtileFlagsInRoom113c", v, args, 0, 0);
  }
  /* 15 extended: 2x2 rooms (h=10), non-zero tile Y offsets. Columns: tileDX, tileDY. */
  {
    static const s32 kTileExt[3][2] = { { 0, 1 }, { 1, 2 }, { 2, -1 } };
    for (int c = 0; c < 3; c++) {
      reset_heap();
      u32 rooms[4], grids[4], maps[4];
      setup_room_grid(4, 10u, rooms, grids, maps);
      for (int r = 0; r < 4; r++) {
        for (int i = 0; i < 100; i++) *(u16*)(usize)(maps[r] + (u32)i * 2u) = (u16)(0x0030u | ((u32)(i + r) & 0x000Fu));
      }
      u32 pOldLib = heap_alloc(0x48);
      u32 pNewLib = heap_alloc(0x48);
      for (int i = 0; i < 25; i++) {
        *(u8*)(usize)(pOldLib + 0x28 + i) = (u8)(1u << (i & 3));
        *(u8*)(usize)(pNewLib + 0x28 + i) = (u8)(0x40u | (u32)i);
      }
      u32 pTile = heap_alloc(0x20);
      *(s32*)(usize)(pTile + 0x08) = kTileExt[c][0];
      *(s32*)(usize)(pTile + 0x0C) = kTileExt[c][1];
      *(u32*)(usize)(pTile + 0x18) = pOldLib;
      track_region(pOldLib, 0x48);
      track_region(pNewLib, 0x48);
      track_region(pTile, 0x20);
      snapshot_pre();
      (void)call_eax_stk2_u32(0x6FD9CA20u, rooms[0], pTile, pNewLib);
      char args[128];
      snprintf(args, sizeof(args), "[%u,%u,%u]", rooms[0], pTile, pNewLib);
      emit_vector(fp, "0x6FD9CA20", "COLLISION_ReplaceTileSubtileFlagsInRoom113c", 5 + c, args, 0, 0);
    }
  }

  /* 16. 0x6FDCE6C0 COLLISION_TraceFieldCollision113c */
  for (int v = 0; v < 9; v++) {
    reset_heap();
    u32 r0, r1, g0, g1, m0, m1;
    setup_two_rooms(&r0, &r1, &g0, &g1, &m0, &m1);
    if (v == 2) *(u32*)(usize)(r0 + 0x20) = 0u;
    if (v == 3) *(u32*)(usize)(g0 + 0x20) = 0u;
    if (v == 4) *(u16*)(usize)(m0 + (2 * 10 + 2) * 2) = 0x0004u;
    if (v == 7) *(u16*)(usize)(m0 + (3 * 10 + 3) * 2) = 0x0004u;
    u32 pFieldData = heap_alloc(0x200);
    memset((void *)(usize)pFieldData, 8, 0x200);
    if (v >= 6) {
      *(u8*)(usize)(pFieldData + 0) = 4u;
      *(u8*)(usize)(pFieldData + 0x101) = (v == 8) ? 0u : 8u;
    }
    *(s32*)(usize)(0x6FDE9BA0u + 0 * 4) = -50;
    *(s32*)(usize)(0x6FDE9BC4u + 0 * 4) = 0;
    *(s32*)(usize)(0x6FDE9BA0u + 4 * 4) = 1;
    *(s32*)(usize)(0x6FDE9BC4u + 4 * 4) = 1;
    *(u32*)(usize)0x6FDF1404u = pFieldData;
    *(u32*)(usize)0x6FDF1414u = 0u;
    *(u32*)(usize)0x6FDF1418u = 0u;
    u32 pField = heap_alloc(0x10);
    *(u32*)(usize)(pField + 0x00) = 102u;
    *(u32*)(usize)(pField + 0x04) = 102u;
    track_region(0x6FDE9BA0u, 72);
    track_region(0x6FDF1404u, 24);
    track_region(pFieldData, 0x200);
    track_region(pField, 0x10);
    u32 pRoomArg = (v == 0) ? 0u : r0;
    u32 sx = (v == 1) ? 80u : 102u;
    u32 sy = 102u;
    snapshot_pre();
    u32 ret = ((fn_std5_u32_t)(usize)0x6FDCE6C0u)(pField, pRoomArg, sx, sy, 0x0004u);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,4]", pField, pRoomArg, sx, sy);
    emit_vector(fp, "0x6FDCE6C0", "COLLISION_TraceFieldCollision113c", v, args, ret, 1);
  }
  /* 16 extended: 2x2 rooms with h=5 (stride 10 != height 5). The field data walks a diagonal:
   * byte [k*0x101] = 4 (dir (+1,+1)) for k < nSteps, then 8 (stop), so FIELD_StepFieldCoords
   * keeps returning 1 and every stepped cell (102+k, 102+k) is collision-checked.
   * Columns: nSteps, hitX, hitY (0: none). */
  {
    static const u32 kFieldExt[5][3] = {
      { 2, 103, 103 }, /* hit on the first stepped cell (row offset 1) */
      { 4,   0,   0 }, /* walk (103,103)..(105,105) into room2, clear */
      { 4, 105, 105 }, /* hit in room2 after the room transition */
      { 3, 104, 104 }, /* hit at row offset 4 of room0 */
      { 1, 103, 103 }  /* collision cell exists but the walk stops before reaching it */
    };
    for (int c = 0; c < 5; c++) {
      reset_heap();
      u32 rooms[4], grids[4], maps[4];
      setup_room_grid(4, 5u, rooms, grids, maps);
      if (kFieldExt[c][1] != 0u) set_cell_grid(maps, 5u, kFieldExt[c][1], kFieldExt[c][2], 0x0004u);
      u32 pFieldData = heap_alloc(0x500);
      memset((void *)(usize)pFieldData, 8, 0x500);
      for (u32 k = 0; k < kFieldExt[c][0]; k++) *(u8*)(usize)(pFieldData + k * 0x101u) = 4u;
      *(s32*)(usize)(0x6FDE9BA0u + 0 * 4) = -50;
      *(s32*)(usize)(0x6FDE9BC4u + 0 * 4) = 0;
      *(s32*)(usize)(0x6FDE9BA0u + 4 * 4) = 1;
      *(s32*)(usize)(0x6FDE9BC4u + 4 * 4) = 1;
      *(u32*)(usize)0x6FDF1404u = pFieldData;
      *(u32*)(usize)0x6FDF1414u = 0u;
      *(u32*)(usize)0x6FDF1418u = 0u;
      u32 pField = heap_alloc(0x10);
      *(u32*)(usize)(pField + 0x00) = 102u;
      *(u32*)(usize)(pField + 0x04) = 102u;
      track_region(0x6FDE9BA0u, 72);
      track_region(0x6FDF1404u, 24);
      track_region(pFieldData, 0x500);
      track_region(pField, 0x10);
      snapshot_pre();
      u32 ret = ((fn_std5_u32_t)(usize)0x6FDCE6C0u)(pField, rooms[0], 102u, 102u, 0x0004u);
      char args[128];
      snprintf(args, sizeof(args), "[%u,%u,102,102,4]", pField, rooms[0]);
      emit_vector(fp, "0x6FDCE6C0", "COLLISION_TraceFieldCollision113c", 9 + c, args, ret, 1);
    }
  }

  /* 17. 0x6FDCF490 COLLISION_IsPointWithinRoomMargin113c */
  {
    static const u32 kX[6] = { 105, 95, 115, 105, 105, 99 };
    static const u32 kY[6] = { 105, 105, 105, 95, 115, 105 };
    for (int v = 0; v < 6; v++) {
      reset_heap();
      u32 r0, r1, g0, g1, m0, m1;
      setup_two_rooms(&r0, &r1, &g0, &g1, &m0, &m1);
      snapshot_pre();
      u32 ret = call_eax_ecx_edx_edi_u32(0x6FDCF490u, kY[v], r0, kX[v], 2u);
      char args[128];
      snprintf(args, sizeof(args), "[%u,%u,%u,2]", kY[v], r0, kX[v]);
      emit_vector(fp, "0x6FDCF490", "COLLISION_IsPointWithinRoomMargin113c", v, args, ret, 1);
    }
    /* Extended: the DLL can only return 0 for a negative margin (edi), so cover negative
     * margins with inside / edge / outside points on both axes, an asymmetric room (room1,
     * X=110 Y=100), margin 0 edge/outside points, INT_MIN and a NULL room.
     * Columns: room (0 room0, 1 room1, 2 NULL), x, y, margin. */
    static const u32 kMarg[12][4] = {
      { 0, 105, 105, 0xFFFFFFFAu }, /* x+m < X and x-m > X+W */
      { 0, 104, 107, 0xFFFFFFFAu }, /* x-m == X+W, y+m >= Y */
      { 0, 104, 105, 0xFFFFFFFAu }, /* x-m == X+W, y+m < Y, y-m > Y+H */
      { 0, 107, 104, 0xFFFFFFFAu }, /* x+m >= X, y-m == Y+H */
      { 0, 107, 105, 0xFFFFFFFAu }, /* x+m >= X, y-m > Y+H */
      { 1, 115, 105, 0xFFFFFFFAu }, /* room1: x+m < X and x-m > X+W */
      { 1, 116, 107, 0xFFFFFFFAu }, /* room1: x+m == X (x branch not taken), y+m >= Y */
      { 1, 117, 104, 0xFFFFFFFAu }, /* room1: y-m == Y+H */
      { 0, 100, 100, 0u },          /* margin 0, room origin */
      { 0,  50,  50, 0u },          /* margin 0, far outside */
      { 0, 105, 105, 0x80000000u }, /* INT_MIN margin (32-bit wrap) */
      { 2,   5,   5, 0xFFFFFFFAu }  /* NULL room: coords zeroed */
    };
    for (int c = 0; c < 12; c++) {
      reset_heap();
      u32 r0, r1, g0, g1, m0, m1;
      setup_two_rooms(&r0, &r1, &g0, &g1, &m0, &m1);
      u32 pRoomArg = (kMarg[c][0] == 0u) ? r0 : (kMarg[c][0] == 1u) ? r1 : 0u;
      snapshot_pre();
      u32 ret = call_eax_ecx_edx_edi_u32(0x6FDCF490u, kMarg[c][2], pRoomArg, kMarg[c][1], kMarg[c][3]);
      char args[128];
      snprintf(args, sizeof(args), "[%u,%u,%u,%u]", kMarg[c][2], pRoomArg, kMarg[c][1], kMarg[c][3]);
      emit_vector(fp, "0x6FDCF490", "COLLISION_IsPointWithinRoomMargin113c", 6 + c, args, ret, 1);
    }
  }

  /* 18. 0x6FDD16C0 DRLGLOGIC_LinkAdjacentRoomCoordListsAtSubtile113c */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    u32 r1 = heap_alloc(0x80), r2 = heap_alloc(0x80);
    u32 l1 = heap_alloc(0x200), l2 = heap_alloc(0x200);
    u32 log1 = heap_alloc(0x40), log2 = heap_alloc(0x40);
    u32 c1 = heap_alloc(0x38), c2 = heap_alloc(0x38);
    u32 cells1 = heap_alloc(0x20), cells2 = heap_alloc(0x20);
    u32 rows1 = heap_alloc(0x20), rows2 = heap_alloc(0x20);
    for (int i = 0; i < 4; i++) {
      *(u32*)(usize)(rows1 + i * 4) = (u32)(i * 2);
      *(u32*)(usize)(rows2 + i * 4) = (u32)(i * 2);
    }
    *(u32*)(usize)(cells1 + 0) = c1;
    *(u32*)(usize)(cells2 + 0) = c2;
    *(u32*)(usize)(log1 + 0x1C) = cells1;
    *(u32*)(usize)(log1 + 0x20) = rows1;
    *(u32*)(usize)(log1 + 0x30) = c1;
    *(u32*)(usize)(log2 + 0x1C) = cells2;
    *(u32*)(usize)(log2 + 0x20) = rows2;
    *(u32*)(usize)(log2 + 0x30) = c2;
    *(u32*)(usize)(c1 + 0x20) = 1u;
    *(u32*)(usize)(c1 + 0x28) = (v == 2) ? 0u : 1u;
    *(u32*)(usize)(c2 + 0x20) = (v == 6) ? 0u : 1u;
    *(u32*)(usize)(c2 + 0x28) = (v == 3) ? 0u : (v == 5) ? 1u : 2u;
    *(u32*)(usize)(l1 + 0x1D0) = 5u;
    *(u32*)(usize)(l2 + 0x1D0) = (v == 4) ? 6u : 5u;
    *(u32*)(usize)(r1 + 0x34) = 10u; *(u32*)(usize)(r1 + 0x38) = 10u;
    *(u32*)(usize)(r1 + 0x3C) = 2u;  *(u32*)(usize)(r1 + 0x40) = 2u;
    *(u32*)(usize)(r1 + 0x58) = l1;  *(u32*)(usize)(r1 + 0x64) = log1;
    *(u32*)(usize)(r2 + 0x34) = 10u; *(u32*)(usize)(r2 + 0x38) = 10u;
    *(u32*)(usize)(r2 + 0x3C) = 2u;  *(u32*)(usize)(r2 + 0x40) = 2u;
    *(u32*)(usize)(r2 + 0x58) = l2;  *(u32*)(usize)(r2 + 0x64) = log2;
    u32 sx = (v == 0) ? 8u : (v == 1) ? 14u : 10u;
    u32 sy = 10u;
    track_region(r1, 0x80); track_region(r2, 0x80);
    track_region(l1, 0x200); track_region(l2, 0x200);
    track_region(log1, 0x40); track_region(log2, 0x40);
    track_region(c1, 0x38); track_region(c2, 0x38);
    track_region(cells1, 0x20); track_region(cells2, 0x20);
    track_region(rows1, 0x20); track_region(rows2, 0x20);
    snapshot_pre();
    (void)call_eax_ecx_edx_stk1_u32(0x6FDD16C0u, sy, sx, r1, r2);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", sy, sx, r1, r2);
    emit_vector(fp, "0x6FDD16C0", "DRLGLOGIC_LinkAdjacentRoomCoordListsAtSubtile113c", v, args, 0, 0);
  }

  /* 19. 0x6FDD1BC0 DRLGLOGIC_AssignCoordListIndicesAcrossGrid113c */
  /* Cases 4..6: width 0 (one column), width 0 + height 0, height 0 with a wall flag. */
  for (int v = 0; v < 7; v++) {
    reset_heap();
    u32 ctx = heap_alloc(0x30);
    u32 r0 = heap_alloc(0x80);
    u32 gIdx = heap_alloc(0x18), gFloor = heap_alloc(0x18), gWall = heap_alloc(0x18);
    u32 cIdx = heap_alloc(0x40), cFloor = heap_alloc(0x40), cWall = heap_alloc(0x40);
    u32 rows = heap_alloc(0x20);
    for (int i = 0; i < 4; i++) *(u32*)(usize)(rows + i * 4) = (u32)(i * 2);
    *(u32*)(usize)(r0 + 0x3C) = (v == 4 || v == 5) ? 0u : 1u;
    *(u32*)(usize)(r0 + 0x40) = (v == 0) ? 0xFFFFFFFFu : (v == 5 || v == 6) ? 0u : 1u;
    *(u32*)(usize)(gIdx + 0x00) = cIdx;   *(u32*)(usize)(gIdx + 0x04) = rows;   *(u32*)(usize)(gIdx + 0x08) = 2u; *(u32*)(usize)(gIdx + 0x0C) = 2u;
    *(u32*)(usize)(gFloor + 0x00) = cFloor; *(u32*)(usize)(gFloor + 0x04) = rows; *(u32*)(usize)(gFloor + 0x08) = 2u; *(u32*)(usize)(gFloor + 0x0C) = 2u;
    *(u32*)(usize)(gWall + 0x00) = cWall;  *(u32*)(usize)(gWall + 0x04) = rows;  *(u32*)(usize)(gWall + 0x08) = 2u; *(u32*)(usize)(gWall + 0x0C) = 2u;
    if (v == 1) *(u32*)(usize)(cIdx + 0) = 0x10000001u;
    if (v == 2) *(u32*)(usize)(cWall + 0) = 0x01E00000u;
    if (v == 3 || v == 6) *(u32*)(usize)(cWall + 0) = 0x80000000u;
    *(u32*)(usize)(ctx + 0x00) = r0;
    *(u32*)(usize)(ctx + 0x04) = gIdx;
    *(u32*)(usize)(ctx + 0x08) = gFloor;
    *(u32*)(usize)(ctx + 0x0C) = gWall;
    *(u32*)(usize)(ctx + 0x10) = gWall;
    *(u32*)(usize)(ctx + 0x14) = gFloor;
    *(u32*)(usize)(ctx + 0x18) = 0u;
    track_region(ctx, 0x30); track_region(r0, 0x80);
    track_region(gIdx, 0x18); track_region(gFloor, 0x18); track_region(gWall, 0x18);
    track_region(cIdx, 0x40); track_region(cFloor, 0x40); track_region(cWall, 0x40);
    track_region(rows, 0x20);
    snapshot_pre();
    call_esi_void(0x6FDD1BC0u, ctx);
    char args[64];
    snprintf(args, sizeof(args), "[%u]", ctx);
    emit_vector(fp, "0x6FDD1BC0", "DRLGLOGIC_AssignCoordListIndicesAcrossGrid113c", v, args, 0, 0);
  }

  /* 20. 0x6FDD3740 DRLGTILESUB_RollSubThemeMask113c */
  /* Cases 5/6: rem < prob boundary. Seed (12345, 67890) -> first roll rem = 11 (input design),
   * so prob = 11 (equal, not taken) and prob = 12 (taken). */
  for (int v = 0; v < 7; v++) {
    reset_heap();
    u32 pLevel = heap_alloc(0x80);
    u32 pTbl = heap_alloc(0x300);
    u32 pIdx = heap_alloc(0x20);
    *(u32*)(usize)0x6FDF143Cu = pTbl;
    *(u32*)(usize)0x6FDF1444u = pIdx;
    *(u32*)(usize)(pIdx + 4) = 0u;
    *(u32*)(usize)(pTbl + 0x00) = (v == 2) ? 99u : 1u;
    *(u32*)(usize)(pTbl + 0x48) = 0x04u;
    *(u32*)(usize)(pTbl + 0x11C) = (v == 3) ? 100u : (v == 5) ? 11u : (v == 6) ? 12u : 0u;
    *(u32*)(usize)(pTbl + 0x15C + 0x00) = (v == 4) ? 1u : 2u;
    *(u32*)(usize)(pTbl + 0x15C + 0x48) = 0x08u;
    *(u32*)(usize)(pTbl + 0x15C + 0x11C) = 100u;
    *(u32*)(usize)(pLevel + 0x14) = 12345u;
    *(u32*)(usize)(pLevel + 0x18) = 67890u;
    *(u32*)(usize)(pLevel + 0x50) = 1u;
    u32 subType = (v == 0) ? 0xFFFFFFFFu : 1u;
    u32 subTheme = (v == 1) ? 0xFFFFFFFFu : 0u;
    track_region(0x6FDF143Cu, 12);
    track_region(pLevel, 0x80);
    track_region(pTbl, 0x300);
    track_region(pIdx, 0x20);
    snapshot_pre();
    u32 ret = call_esi_stk2_u32(0x6FDD3740u, pLevel, subType, subTheme);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u,%u]", pLevel, subType, subTheme);
    emit_vector(fp, "0x6FDD3740", "DRLGTILESUB_RollSubThemeMask113c", v, args, ret, 1);
  }

  /* 21. 0x6FDD3E20 DRLGTILESUB_ApplyNonPresetSubTheme113c */
  /* Cases 5..8: mode 1, Act-1 outdoor level 3, xBias +1 -> spanX = coordW, spanY = coordH:
   * 6x3 (two seeds) and 3x6 sit on the bSkipCenter2x2 `< 6` boundary; 5x5 has the skip active. */
  static const u32 kSpanW[4] = { 6, 6, 3, 5 };
  static const u32 kSpanH[4] = { 3, 3, 6, 5 };
  for (int v = 0; v < 9; v++) {
    reset_heap();
    u32 ctx = heap_alloc(0x40);
    u32 pCoord = heap_alloc(0x10);
    u32 pLevel = heap_alloc(0x200);
    u32 pOut = heap_alloc(0x280);
    u32 lvlSub = heap_alloc(0x160);
    u32 subGrp = heap_alloc(0x20);
    u32 pDs1 = heap_alloc(0x60);
    u32 outCells0 = heap_alloc(0x100), outCells1 = heap_alloc(0x100), outCells2 = heap_alloc(0x100);
    u32 outRows = heap_alloc(0x20);
    for (int i = 0; i < 8; i++) *(u32*)(usize)(outRows + i * 4) = (u32)(i * 8);
    *(u32*)(usize)(pOut + 0x00) = (v == 1) ? 0x04u : 0u;
    *(u32*)(usize)(pOut + 0x04) = outCells0;
    *(u32*)(usize)(pOut + 0x08) = outRows;
    *(u32*)(usize)(pOut + 0x0C) = 8u;
    *(u32*)(usize)(pOut + 0x10) = 8u;
    *(u32*)(usize)(pOut + 0x18) = outCells1;
    *(u32*)(usize)(pOut + 0x1C) = outRows;
    *(u32*)(usize)(pOut + 0x20) = 8u;
    *(u32*)(usize)(pOut + 0x24) = 8u;
    *(u32*)(usize)(pOut + 0x2C) = outCells2;
    *(u32*)(usize)(pOut + 0x30) = outRows;
    *(u32*)(usize)(pOut + 0x34) = 8u;
    *(u32*)(usize)(pOut + 0x38) = 8u;
    *(u32*)(usize)(pOut + 0x58) = 8u;
    *(u32*)(usize)(pOut + 0x5C) = 8u;
    *(u32*)(usize)(ctx + 0x00) = pLevel;
    *(u32*)(usize)(ctx + 0x04) = pCoord;
    *(u32*)(usize)(ctx + 0x08) = pOut + 0x04u;
    *(u32*)(usize)(ctx + 0x18) = ((v & 1) || v >= 5) ? 1u : 0u;
    *(u32*)(usize)(ctx + 0x20) = 0x6FD922C0u;
    *(u32*)(usize)(ctx + 0x24) = 0u;
    *(u32*)(usize)(ctx + 0x2C) = 0x6FD922F0u;
    *(u32*)(usize)(ctx + 0x30) = 0x6FD922A0u;
    *(u32*)(usize)(pLevel + 0x14) = pOut;
    *(u32*)(usize)(pLevel + 0x1C4) = 1111u + (u32)v;
    *(u32*)(usize)(pLevel + 0x1C8) = 2222u;
    *(u32*)(usize)(pLevel + 0x1D0) = (v == 1 || v >= 5) ? 3u : 1u;
    *(u32*)(usize)(lvlSub + 0x44) = (v == 2) ? 2u : (v == 3) ? 1u : 0u;
    *(u32*)(usize)(lvlSub + 0x4C) = 1u;
    *(u32*)(usize)(lvlSub + 0x50) = pDs1;
    *(u32*)(usize)(pCoord + 0x08) = (v >= 5) ? kSpanW[v - 5] : (v == 0) ? 1u : (v == 1) ? 5u : 3u;
    *(u32*)(usize)(pCoord + 0x0C) = (v >= 5) ? kSpanH[v - 5] : (v == 0) ? 1u : (v == 1) ? 5u : 2u;
    *(u32*)(usize)(subGrp + 0x08) = (v == 0) ? 2u : 1u;
    *(u32*)(usize)(subGrp + 0x0C) = 1u;
    *(u32*)(usize)(subGrp + 0x14) = (v == 2) ? 3u : 4u;
    track_region(ctx, 0x40); track_region(pCoord, 0x10);
    track_region(pLevel, 0x200); track_region(pOut, 0x280);
    track_region(lvlSub, 0x160); track_region(subGrp, 0x20);
    track_region(pDs1, 0x60);
    track_region(outCells0, 0x100); track_region(outCells1, 0x100); track_region(outCells2, 0x100);
    track_region(outRows, 0x20);
    snapshot_pre();
    u32 ret = ((fn_std3_u32_t)(usize)0x6FDD3E20u)(ctx, lvlSub, subGrp);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u,%u]", ctx, lvlSub, subGrp);
    emit_vector(fp, "0x6FDD3E20", "DRLGTILESUB_ApplyNonPresetSubTheme113c", v, args, ret, 1);
  }

  /* 22. 0x6FDD4C30 UNITS_GetMonStats2ComponentChoice113c */
  for (int v = 0; v < 5; v++) {
    reset_heap();
    u32 pSgpt = heap_alloc(0xB00);
    u32 pMonStats = heap_alloc(0x200);
    u32 pMonStats2 = heap_alloc(0x200);
    *(u32*)(usize)0x6FDE9E1Cu = pSgpt;
    *(u32*)(usize)(pSgpt + 0xA78) = pMonStats;
    *(u32*)(usize)(pSgpt + 0xA80) = 2u;
    *(u32*)(usize)(pSgpt + 0xA90) = pMonStats2;
    *(u32*)(usize)(pSgpt + 0xA98) = 2u;
    *(u16*)(usize)(pMonStats + 0x18) = (v == 3) ? 0xFFFFu : 0u;
    *(u8*)(usize)(pMonStats2 + 0x15 + 3) = 7u;
    u32 pUnit = (v == 0) ? 0u : heap_alloc(0x20);
    if (pUnit) {
      *(u32*)(usize)(pUnit + 0x00) = (v == 1) ? 0u : 1u;
      *(u32*)(usize)(pUnit + 0x04) = 0u;
      track_region(pUnit, 0x20);
    }
    u32 nComp = (v == 2) ? 16u : 3u;
    track_region(0x6FDE9E1Cu, 4);
    track_region(pSgpt, 0xB00);
    track_region(pMonStats, 0x200);
    track_region(pMonStats2, 0x200);
    snapshot_pre();
    u32 ret = ((fn_std2_u32_t)(usize)0x6FDD4C30u)(pUnit, nComp);
    char args[128];
    snprintf(args, sizeof(args), "[%u,%u]", pUnit, nComp);
    emit_vector(fp, "0x6FDD4C30", "UNITS_GetMonStats2ComponentChoice113c", v, args, ret, 1);
  }
}

int main(int argc, char **argv) {
  const char *b050_out = (argc > 1) ? argv[1] : "tests/fixtures/oracle/k1/b050-vectors.ndjson";
  const char *b053_out = (argc > 2) ? argv[2] : "tests/fixtures/oracle/k1/b053-vectors.ndjson";
  SetDllDirectoryA("samples/d2");
  HMODULE hDll = LoadLibraryA("D2Common.dll");
  if (!hDll) hDll = LoadLibraryA("samples/d2/D2Common.dll");
  if (!hDll || (usize)hDll != 0x6FD50000u) return 2;

  g_arena = (u8 *)VirtualAlloc((void *)(usize)ARENA_ADDR, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  g_heap  = (u8 *)VirtualAlloc((void *)(usize)HEAP_ADDR,  HEAP_SIZE,  MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  if (!g_arena || !g_heap) return 3;

  DWORD oldProt = 0;
  VirtualProtect((LPVOID)(usize)0x6FDD9000u, 0x1000u, PAGE_EXECUTE_READWRITE, &oldProt);
  VirtualProtect((LPVOID)(usize)0x6FDE9000u, 0x9000u, PAGE_EXECUTE_READWRITE, &oldProt);
  *(u32*)(usize)0x6FDD9000u = (u32)(usize)&stub_d2cmp_10011;
  *(u32*)(usize)0x6FDD9094u = (u32)(usize)&stub_fog_10046;
  *(u32*)(usize)0x6FDD9098u = (u32)(usize)&stub_fog_10045;
  *(u32*)(usize)0x6FDD909Cu = (u32)(usize)&stub_fog_10043;
  *(u32*)(usize)0x6FDD90A0u = (u32)(usize)&stub_fog_10042;
  *(u32*)(usize)0x6FDD90A8u = (u32)(usize)&stub_fog_10046;
  *(u32*)(usize)0x6FDD90CCu = (u32)(usize)&stub_fog_10046;
  *(u32*)(usize)0x6FDD90D0u = (u32)(usize)&stub_fog_10045;
  *(u32*)(usize)0x6FDD90DCu = (u32)(usize)&stub_fog_10104;
  *(u32*)(usize)0x6FDD90E0u = (u32)(usize)&stub_fog_10102;
  *(u32*)(usize)0x6FDD90E4u = (u32)(usize)&stub_fog_10029;
  *(u32*)(usize)0x6FDD90E8u = (u32)(usize)&stub_fog_10103;
  *(u32*)(usize)0x6FDD90F0u = (u32)(usize)&stub_fog_10105;

  FILE *fp50 = fopen(b050_out, "wb");
  if (!fp50) return 4;
  emit_b050(fp50);
  fclose(fp50);

  FILE *fp53 = fopen(b053_out, "wb");
  if (!fp53) return 5;
  emit_b053(fp53);
  fclose(fp53);
  return 0;
}
