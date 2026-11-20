/*
 * k1r9-laneC-it12-emitter.c
 *
 * 32-bit MinGW executable that loads the real D2Common.dll v1.13c at its
 * preferred image base 0x6FD50000 (along with Fog.dll and D2CMP.dll) under Wine
 * and emits differential test vectors (NDJSON) for Lane C Iteration 12:
 *   - I12C-1 (21 functions: F01..F21) -> i12c-1-vectors.ndjson
 *   - I12C-2 (11 functions: F22..F32) -> i12c-2-vectors.ndjson
 *
 * Inline-asm wrappers use exclusively register-class operands.
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
#define ARENA_SIZE    0x00400000u
#define HEAP_ADDR     0x40000000u
#define HEAP_SIZE     0x00080000u

static u8 *g_arena = NULL;
static u8 *g_heap = NULL;
static u32 g_arena_off = 0;
static u32 g_heap_off = 0;
static u32 g_frees[256];
static int g_num_frees = 0;

static u32 bump_alloc(u32 size) {
  if (size == 0u) return 0u;
  u32 aligned = (g_heap_off + 3u) & ~3u;
  if (aligned + size > HEAP_SIZE) ExitProcess(4);
  u32 p = HEAP_ADDR + aligned;
  memset(g_heap + aligned, 0, size);
  g_heap_off = aligned + size;
  return p;
}

static void record_free(u32 ptr) {
  if (ptr != 0u && g_num_frees < 256) g_frees[g_num_frees++] = ptr;
}

static u32 __attribute__((fastcall)) stub_fog_10045(u32 ecx_p, u32 edx_sz, u32 f, u32 ln, u32 z) {
  (void)ecx_p; (void)f; (void)ln; (void)z;
  return bump_alloc(edx_sz);
}

static void __attribute__((fastcall)) stub_fog_10046(u32 ecx_p, u32 edx_ptr, u32 f, u32 ln, u32 z) {
  (void)ecx_p; (void)f; (void)ln; (void)z;
  record_free(edx_ptr);
}

typedef struct {
  u32 addr;
  u32 len;
  u8 *pre;
  u8 *post;
} TrackedBlock;

#define MAX_BLOCKS 512
static TrackedBlock g_blocks[MAX_BLOCKS];
static int g_num_blocks = 0;

static void reset_heap(void) {
  if (g_arena_off > 0) memset(g_arena, 0, (g_arena_off + 15u) & ~15u);
  if (g_heap_off > 0)  memset(g_heap, 0, (g_heap_off + 3u) & ~3u);
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
    fprintf(stderr, "ARENA OVERFLOW: %u + %u > %u\n", aligned, alloc_sz, ARENA_SIZE);
    ExitProcess(14);
  }
  u32 p = ARENA_ADDR + aligned;
  memset(g_arena + aligned, 0, alloc_sz);
  g_arena_off = aligned + alloc_sz;
  return p;
}

static void track_region(u32 addr, u32 byte_len) {
  if (g_num_blocks >= MAX_BLOCKS) {
    fprintf(stderr, "MAX_BLOCKS OVERFLOW at 0x%08X\n", addr);
    ExitProcess(15);
  }
  TrackedBlock *b = &g_blocks[g_num_blocks++];
  b->addr = addr;
  b->len  = (byte_len + 3u) & ~3u;
  b->pre  = (u8 *)malloc(b->len);
  b->post = (u8 *)malloc(b->len);
}

static void snapshot_pre(void) {
  for (int i = 0; i < g_num_blocks; i++) {
    memcpy(g_blocks[i].pre, (const void *)(usize)g_blocks[i].addr, g_blocks[i].len);
  }
}

static void snapshot_post(void) {
  for (int i = 0; i < g_num_blocks; i++) {
    memcpy(g_blocks[i].post, (const void *)(usize)g_blocks[i].addr, g_blocks[i].len);
  }
}

static void emit_vector(
  FILE *fp, const char *vaStr, const char *fnName, int case_idx, const char *note,
  const char *argsJson, u32 eax_out, u32 retMask
) {
  int has_ret = (retMask != 0u) ? 1 : 0;
  snapshot_post();
  fprintf(fp,
    "{\"va\":\"%s\",\"name\":\"%s\",\"case\":%d,\"note\":\"%s\",\"retMask\":%u,\"in\":{\"args\":%s,\"mem\":{",
    vaStr, fnName, case_idx, note, retMask, argsJson);
  int first = 1;
  for (int b = 0; b < g_num_blocks; b++) {
    const u32 *words = (const u32 *)g_blocks[b].pre;
    u32 count = g_blocks[b].len / 4u;
    for (u32 w = 0; w < count; w++) {
      fprintf(fp, "%s\"0x%08X\":%u", first ? "" : ",", g_blocks[b].addr + w * 4u, words[w]);
      first = 0;
    }
  }
  fprintf(fp, "}},\"out\":{\"eax\":%u,\"hasRet\":%d,\"mem\":{",
    has_ret ? (eax_out & retMask) : 0u, has_ret);
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
  fflush(fp);
}

typedef u32  (__stdcall *fn_std1_u32_t)(u32);
typedef void (__stdcall *fn_std1_void_t)(u32);
typedef u32  (__stdcall *fn_std2_u32_t)(u32, u32);
typedef void (__stdcall *fn_std2_void_t)(u32, u32);
typedef u32  (__stdcall *fn_std3_u32_t)(u32, u32, u32);
typedef void (__stdcall *fn_std4_void_t)(u32, u32, u32, u32);

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

static __attribute__((noinline)) void call_eax_stk1_void(u32 fn, u32 a_eax, u32 s1) {
  u32 pack[2] = { fn, s1 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "+d"(p)
    : "a"(a_eax)
    : "ecx", "ebx", "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_eax_ecx_edx_u32(u32 fn, u32 a_eax, u32 a_ecx, u32 a_edx) {
  u32 out;
  __asm__ volatile(
    "call *%%esi\n\t"
    : "=a"(out), "+c"(a_ecx), "+d"(a_edx), "+S"(fn)
    : "a"(a_eax)
    : "ebx", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_eax_ecx_edx_edi_u32(
  u32 fn, u32 a_eax, u32 a_ecx, u32 a_edx, u32 a_edi
) {
  u32 out;
  __asm__ volatile(
    "call *%%esi\n\t"
    : "=a"(out), "+c"(a_ecx), "+d"(a_edx), "+D"(a_edi), "+S"(fn)
    : "a"(a_eax)
    : "ebx", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_eax_ecx_edx_esi_u32(
  u32 fn, u32 a_eax, u32 a_ecx, u32 a_edx, u32 a_esi
) {
  u32 out;
  __asm__ volatile(
    "call *%%edi\n\t"
    : "=a"(out), "+c"(a_ecx), "+d"(a_edx), "+S"(a_esi), "+D"(fn)
    : "a"(a_eax)
    : "ebx", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_edi_u32(u32 fn, u32 a_edi) {
  u32 out;
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "=a"(out), "+D"(a_edi), "+c"(fn)
    :
    : "edx", "ebx", "esi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_esi_stk4_u32(
  u32 fn, u32 a_esi, u32 s1, u32 s2, u32 s3, u32 s4
) {
  u32 pack[5] = { fn, s1, s2, s3, s4 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 16(%%edx)\n\t"
    "pushl 12(%%edx)\n\t"
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "=a"(out), "+S"(a_esi), "+d"(p)
    :
    : "ecx", "ebx", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_ecx_stk1_u32(u32 fn, u32 a_ecx, u32 s1) {
  u32 pack[2] = { fn, s1 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "=a"(out), "+c"(a_ecx), "+d"(p)
    :
    : "ebx", "esi", "edi", "memory", "cc"
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

static __attribute__((noinline)) u32 call_esi_u32(u32 fn, u32 a_esi) {
  u32 out;
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "=a"(out), "+S"(a_esi), "+c"(fn)
    :
    : "edx", "ebx", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) void call_ebx_stk1_void(u32 fn, u32 a_ebx, u32 s1) {
  u32 pack[2] = { fn, s1 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "+b"(a_ebx), "+d"(p)
    :
    : "eax", "ecx", "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_eax_stk3_u32(u32 fn, u32 a_eax, u32 s1, u32 s2, u32 s3) {
  u32 pack[4] = { fn, s1, s2, s3 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 12(%%edx)\n\t"
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "=a"(out), "+d"(p)
    : "a"(a_eax)
    : "ecx", "ebx", "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) void call_eax_stk3_void(u32 fn, u32 a_eax, u32 s1, u32 s2, u32 s3) {
  u32 pack[4] = { fn, s1, s2, s3 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 12(%%edx)\n\t"
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "+d"(p)
    : "a"(a_eax)
    : "ecx", "ebx", "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) void call_eax_void(u32 fn, u32 a_eax) {
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "+c"(fn)
    : "a"(a_eax)
    : "edx", "ebx", "esi", "edi", "memory", "cc"
  );
}

typedef struct {
  u32 r[9];
  u32 g[9];
  u32 m[9];
  u32 nearArr[9];
  u32 actFlag;
} CollWorld;

static void build_coll_world(CollWorld *w) {
  w->actFlag = heap_alloc(0x10);
  track_region(w->actFlag, 0x10);
  for (int i = 0; i < 9; i++) {
    int gx = i % 3;
    int gy = i / 3;
    s32 sx = 90 + gx * 10;
    s32 sy = 90 + gy * 10;
    w->r[i] = heap_alloc(0x80);
    w->g[i] = heap_alloc(0x28);
    w->m[i] = heap_alloc(200);
    w->nearArr[i] = heap_alloc(9 * 4);
    *(u32 *)(usize)(w->r[i] + 0x20) = w->g[i];
    *(u32 *)(usize)(w->r[i] + 0x2C) = w->actFlag;
    *(s32 *)(usize)(w->r[i] + 0x4C) = sx;
    *(s32 *)(usize)(w->r[i] + 0x50) = sy;
    *(s32 *)(usize)(w->r[i] + 0x54) = 10;
    *(s32 *)(usize)(w->r[i] + 0x58) = 10;
    *(s32 *)(usize)(w->g[i] + 0x00) = sx;
    *(s32 *)(usize)(w->g[i] + 0x04) = sy;
    *(s32 *)(usize)(w->g[i] + 0x08) = 10;
    *(s32 *)(usize)(w->g[i] + 0x0C) = 10;
    *(u32 *)(usize)(w->g[i] + 0x20) = w->m[i];
  }
  for (int i = 0; i < 9; i++) {
    *(u32 *)(usize)(w->r[i] + 0x00) = w->nearArr[i];
    *(u32 *)(usize)(w->r[i] + 0x24) = 9u;
    for (int j = 0; j < 9; j++) {
      *(u32 *)(usize)(w->nearArr[i] + (u32)(j * 4)) = w->r[j];
    }
    track_region(w->r[i], 0x80);
    track_region(w->g[i], 0x28);
    track_region(w->m[i], 200);
    track_region(w->nearArr[i], 9 * 4);
  }
}

static void set_world_cell(CollWorld *w, s32 x, s32 y, u16 val) {
  for (int i = 0; i < 9; i++) {
    s32 sx = *(s32 *)(usize)(w->g[i] + 0x00);
    s32 sy = *(s32 *)(usize)(w->g[i] + 0x04);
    s32 sw = *(s32 *)(usize)(w->g[i] + 0x08);
    s32 sh = *(s32 *)(usize)(w->g[i] + 0x0C);
    if (x >= sx && x < sx + sw && y >= sy && y < sy + sh) {
      s32 off = (y - sy) * sw + (x - sx);
      *(u16 *)(usize)(w->m[i] + (u32)(off * 2)) = val;
      return;
    }
  }
}

static void setup_datatables_min(u32 *outDt, u32 *outBitMasks, u32 *outMon, u32 *outMon2) {
  u32 pBitMasks = heap_alloc(32u);
  for (int i = 0; i < 8; i++) *(u32 *)(usize)(pBitMasks + (u32)(i * 4)) = (1u << i);
  u32 dt = heap_alloc(0x1000);
  u32 monTbl = heap_alloc(8u * 424u);
  u32 mon2Tbl = heap_alloc(8u * 308u);
  *(u32 *)(usize)(dt + 0xA78u) = monTbl;
  *(u32 *)(usize)(dt + 0xA80u) = 8u;
  *(u32 *)(usize)(dt + 0xA90u) = mon2Tbl;
  *(u32 *)(usize)(dt + 0xA98u) = 8u;
  *(u16 *)(usize)(monTbl + 1u * 424u + 0x02u) = 1u;
  *(u16 *)(usize)(monTbl + 1u * 424u + 0x18u) = 1u;
  *(u8  *)(usize)(mon2Tbl + 1u * 308u + 0x08u) = 1u;
  *outDt = dt;
  *outBitMasks = pBitMasks;
  *outMon = monTbl;
  *outMon2 = mon2Tbl;
}

static void emit_i12c_1_path(FILE *fp) {
  char note[64], args[256];
  u32 *pSgpt = (u32 *)(usize)0x6FDE9E1Cu;
  u32 *pBitMasksIat = (u32 *)(usize)0x6FDD90B0u;
  u32 savedSgpt = *pSgpt;
  u32 savedBitMasks = *pBitMasksIat;

  /* F01: 0x6FD5D420 PATH_MoveOrTestSubtileStepCollision113c */
  for (int c = 0; c < 6; c++) {
    reset_heap();
    CollWorld w; build_coll_world(&w);
    u32 pPath = heap_alloc(0x200);
    u32 pUnit = heap_alloc(0x100);
    *(u32 *)(usize)(pUnit + 0x00) = (c == 1) ? 1u : 0u;
    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x1C) = (c == 1) ? 0u : w.r[4];
    *(u32 *)(usize)(pPath + 0x44) = 1u;
    *(u32 *)(usize)(pPath + 0x48) = 1u;
    *(u32 *)(usize)(pPath + 0x4C) = 0x0080u;
    *(u32 *)(usize)(pPath + 0x50) = 0x3401u;
    if (c == 0 || c == 1) {
      *(u32 *)(usize)(pPath + 0x34) = 0x04u;
      set_world_cell(&w, 102, 102, 0x0080u);
    } else if (c == 2) {
      set_world_cell(&w, 103, 102, 0x0800u);
    } else if (c == 4) {
      *(u32 *)(usize)(pPath + 0x34) = 0x40000u;
      *(u32 *)(usize)(pPath + 0x50) = 0x0007u;
      set_world_cell(&w, 103, 102, 0x0002u);
    } else if (c == 5) {
      *(u32 *)(usize)(pPath + 0x34) = 0x40000u;
      *(u32 *)(usize)(pPath + 0x50) = 0x0007u;
      set_world_cell(&w, 103, 102, 0x0001u);
    }
    u32 packedOld = (102u | (102u << 16));
    u32 packedNew = (103u | (102u << 16));
    track_region(pPath, 0x200);
    track_region(pUnit, 0x100);
    snapshot_pre();
    u32 ret = call_eax_stk2_u32(0x6FD5D420u, pPath, packedNew, packedOld);
    snprintf(note, sizeof(note), "f01_step_coll_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u]", pPath, packedNew, packedOld);
    emit_vector(fp, "0x6FD5D420", "PATH_MoveOrTestSubtileStepCollision113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* F02: 0x6FD5D820 PATH_RecomputeDynamicPath113c */
  {
    fn_std2_u32_t fn = (fn_std2_u32_t)(usize)0x6FD5D820u;
    for (int c = 0; c < 6; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 dt, pBitMasks, monTbl, mon2Tbl;
      setup_datatables_min(&dt, &pBitMasks, &monTbl, &mon2Tbl);
      *pSgpt = dt;
      *pBitMasksIat = pBitMasks;
      u32 pUnit = heap_alloc(0x100);
      u32 pPath = heap_alloc(0x200);
      u32 pSeed = heap_alloc(0x10);
      u32 pRoomEx = heap_alloc(0x80);
      u32 pLevel = heap_alloc(0x200);
      *(u32 *)(usize)(pSeed + 0x00) = 0x12345678u;
      *(u32 *)(usize)(pSeed + 0x04) = 0x87654321u;
      *(u32 *)(usize)(pUnit + 0x00) = (c == 1) ? 1u : 0u;
      *(u32 *)(usize)(pUnit + 0x20) = pSeed;
      *(u32 *)(usize)(pUnit + 0x2C) = (c == 0) ? 0u : pPath;
      *(u32 *)(usize)(pLevel + 0x1D0) = 2u;
      *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
      for (int i = 0; i < 9; i++) *(u32 *)(usize)(w.r[i] + 0x10) = pRoomEx;

      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (102u << 16);
      *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (104u << 16);
      *(u16 *)(usize)(pPath + 0x10) = 104u;
      *(u16 *)(usize)(pPath + 0x12) = 104u;
      *(u16 *)(usize)(pPath + 0x18) = 106u;
      *(u16 *)(usize)(pPath + 0x1A) = 104u;
      *(u32 *)(usize)(pPath + 0x24) = (c == 3) ? 5u : 3u;
      *(u32 *)(usize)(pPath + 0x34) = (c == 5) ? 0x21910u : 0x21900u;
      *(u32 *)(usize)(pPath + 0x3C) = (c == 3) ? 13u : (c == 5) ? 11u : 2u;
      *(u32 *)(usize)(pPath + 0x44) = 1u;
      *(u32 *)(usize)(pPath + 0x4C) = 0x80u;
      *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
      *(u32 *)(usize)(pPath + 0x7C) = 0x10000u;
      *(u8  *)(usize)(pPath + 0x91) = 40u;
      *(u8  *)(usize)(pPath + 0x92) = 40u;
      *(u8  *)(usize)(pPath + 0x94) = (c == 1) ? 0u : (c == 3) ? 2u : 10u;
      if (c == 4) {
        for (int y = 100; y < 109; y++) set_world_cell(&w, 104, y, 0x1C01u);
      }
      u32 usePrev = (c == 3) ? 1u : 0u;

      track_region(0x6FDE9E1Cu, 4u);
      track_region(0x6FDD90B0u, 4u);
      track_region(pBitMasks, 32u);
      track_region(dt, 0x1000u);
      track_region(monTbl, 8u * 424u);
      track_region(mon2Tbl, 8u * 308u);
      track_region(0x6FDE4138u, 72u);
      track_region(0x6FDE4180u, 72u);
      track_region(0x6FDE42F0u, 72u);
      track_region(0x6FDDC320u, 300u);
      track_region(0x6FDDC450u, 76u);
      track_region(0x6FDE5098u, 256u);
      track_region(0x6FDE5198u, 36u);
      track_region(pUnit, 0x100);
      track_region(pPath, 0x200);
      track_region(pSeed, 0x10);
      track_region(pRoomEx, 0x80);
      track_region(pLevel, 0x200);
      snapshot_pre();
      u32 ret = fn(pUnit, usePrev);
      snprintf(note, sizeof(note), "f02_recompute_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u]", pUnit, usePrev);
      emit_vector(fp, "0x6FD5D820", "PATH_RecomputeDynamicPath113c", c, note, args, ret, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
    *pBitMasksIat = savedBitMasks;
  }

  /* F03: 0x6FD5DAB0 PATH_CopyPositionFromUnit113c */
  {
    fn_std2_void_t fn = (fn_std2_void_t)(usize)0x6FD5DAB0u;
    for (int c = 0; c < 4; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 dstU = heap_alloc(0x100), srcU = heap_alloc(0x100);
      u32 dstP = heap_alloc(0x200), srcP = heap_alloc(0x200);
      *(u32 *)(usize)(dstU + 0x2C) = dstP;
      *(u32 *)(usize)(srcU + 0x2C) = srcP;
      *(u32 *)(usize)(dstP + 0x30) = dstU;
      *(u32 *)(usize)(dstP + 0x00) = 0x1234u | (102u << 16);
      *(u32 *)(usize)(dstP + 0x04) = 0x5678u | (102u << 16);
      *(u32 *)(usize)(dstP + 0x1C) = w.r[4];
      *(u32 *)(usize)(dstP + 0x34) = (c == 0) ? 0x08u : 0x00u;

      *(u32 *)(usize)(srcP + 0x00) = 0x8000u | (((c == 1) ? 105u : 102u) << 16);
      *(u32 *)(usize)(srcP + 0x04) = 0x8000u | (((c == 2) ? 105u : 102u) << 16);
      *(u32 *)(usize)(srcP + 0x1C) = (c == 1 || c == 3) ? w.r[5] : w.r[4];

      track_region(dstU, 0x100);
      track_region(srcU, 0x100);
      track_region(dstP, 0x200);
      track_region(srcP, 0x200);
      snapshot_pre();
      fn(dstU, srcU);
      snprintf(note, sizeof(note), "f03_copy_pos_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u]", dstU, srcU);
      emit_vector(fp, "0x6FD5DAB0", "PATH_CopyPositionFromUnit113c", c, note, args, 0u, 0u);
    }
  }

  /* F04: 0x6FD5DB40 PATH_SnapToSubtileCenter113c */
  {
    fn_std1_void_t fn = (fn_std1_void_t)(usize)0x6FD5DB40u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x100);
      *(u32 *)(usize)(pPath + 0x00) = ((c == 0) ? (0x1234u | (102u << 16)) : (c == 1) ? (0x8000u | (105u << 16)) : (0x0001u | (103u << 16)));
      *(u32 *)(usize)(pPath + 0x04) = ((c == 0) ? (0x9999u | (104u << 16)) : (c == 1) ? (0x8000u | (106u << 16)) : (0x0002u | (105u << 16)));
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      if (c == 2) {
        *(u32 *)(usize)(pPath + 0x30) = pUnit;
        *(u32 *)(usize)(pPath + 0x34) = 0x01u;
      }
      track_region(pPath, 0x200);
      track_region(pUnit, 0x100);
      snapshot_pre();
      fn(pPath);
      snprintf(note, sizeof(note), "f04_snap_center_c%d", c);
      snprintf(args, sizeof(args), "[%u]", pPath);
      emit_vector(fp, "0x6FD5DB40", "PATH_SnapToSubtileCenter113c", c, note, args, 0u, 0u);
    }
  }
}

static void emit_i12c_1_mid(FILE *fp) {
  char note[64], args[256];
  u32 *pSgpt = (u32 *)(usize)0x6FDE9E1Cu;
  u32 *pBitMasksIat = (u32 *)(usize)0x6FDD90B0u;
  u32 savedSgpt = *pSgpt;
  u32 savedBitMasks = *pBitMasksIat;

  /* F05: 0x6FD85640 PATH_SetCollisionMask113c */
  {
    fn_std2_void_t fn = (fn_std2_void_t)(usize)0x6FD85640u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x100);
      *(u32 *)(usize)(pUnit + 0x00) = (c == 1) ? 3u : 0u;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = (c == 2) ? 0u : w.r[4];
      *(u16 *)(usize)(pPath + 0x02) = 104u;
      *(u16 *)(usize)(pPath + 0x06) = 104u;
      *(u32 *)(usize)(pPath + 0x44) = 1u;
      *(u32 *)(usize)(pPath + 0x48) = 1u;
      *(u32 *)(usize)(pPath + 0x4C) = 0x0080u;
      if (c != 2) set_world_cell(&w, 104, 104, 0x0080u);
      u32 newMask = (c == 1) ? 0x0200u : 0x0100u;
      track_region(pPath, 0x200);
      track_region(pUnit, 0x100);
      snapshot_pre();
      fn(pPath, newMask);
      snprintf(note, sizeof(note), "f05_set_coll_mask_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u]", pPath, newMask);
      emit_vector(fp, "0x6FD85640", "PATH_SetCollisionMask113c", c, note, args, 0u, 0u);
    }
  }

  /* F06: 0x6FD85BA0 PATH_GetOrCheckLastCollisionMask113c */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)(usize)0x6FD85BA0u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pPath = heap_alloc(0x200);
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u16 *)(usize)(pPath + 0x02) = 104u;
      *(u16 *)(usize)(pPath + 0x06) = 104u;
      *(u32 *)(usize)(pPath + 0x44) = 1u;
      *(u16 *)(usize)(pPath + 0x54) = 0x0042u;
      *(u32 *)(usize)(pPath + 0x7C) = (c == 0) ? 3u : 0u;
      if (c == 1) set_world_cell(&w, 104, 104, 0x0005u);
      track_region(pPath, 0x200);
      snapshot_pre();
      u32 ret = fn(pPath);
      snprintf(note, sizeof(note), "f06_get_last_coll_c%d", c);
      snprintf(args, sizeof(args), "[%u]", pPath);
      emit_vector(fp, "0x6FD85BA0", "PATH_GetOrCheckLastCollisionMask113c", c, note, args, ret, 0xFFFFu);
    }
  }

  /* F07: 0x6FD85CD0 PATH_RemoveUnitCollisionIfHasPath113c */
  {
    fn_std1_void_t fn = (fn_std1_void_t)(usize)0x6FD85CD0u;
    for (int c = 0; c < 2; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pUnit = heap_alloc(0x100);
      u32 pPath = heap_alloc(0x200);
      *(u32 *)(usize)(pUnit + 0x00) = 0u;
      *(u32 *)(usize)(pUnit + 0x2C) = (c == 0) ? 0u : pPath;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u16 *)(usize)(pPath + 0x02) = 104u;
      *(u16 *)(usize)(pPath + 0x06) = 104u;
      *(u32 *)(usize)(pPath + 0x48) = 1u;
      *(u32 *)(usize)(pPath + 0x4C) = 0x0080u;
      *(u32 *)(usize)(pPath + 0x7C) = 2u;
      set_world_cell(&w, 104, 104, 0x0080u);
      track_region(pUnit, 0x100);
      track_region(pPath, 0x200);
      snapshot_pre();
      fn(pUnit);
      snprintf(note, sizeof(note), "f07_rm_coll_c%d", c);
      snprintf(args, sizeof(args), "[%u]", pUnit);
      emit_vector(fp, "0x6FD85CD0", "PATH_RemoveUnitCollisionIfHasPath113c", c, note, args, 0u, 0u);
    }
  }

  /* F08: 0x6FD85CF0 PATH_RefreshUnitCollisionPattern113c */
  {
    fn_std1_void_t fn = (fn_std1_void_t)(usize)0x6FD85CF0u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pUnit = heap_alloc(0x100);
      u32 pPath = heap_alloc(0x200);
      *(u32 *)(usize)(pUnit + 0x00) = 0u;
      *(u32 *)(usize)(pUnit + 0x2C) = (c == 0) ? 0u : pPath;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = (c == 2) ? 0u : w.r[4];
      *(u16 *)(usize)(pPath + 0x02) = 104u;
      *(u16 *)(usize)(pPath + 0x06) = 104u;
      *(u32 *)(usize)(pPath + 0x44) = 2u;
      *(u32 *)(usize)(pPath + 0x48) = 1u;
      *(u32 *)(usize)(pPath + 0x4C) = 0x0080u;
      *(u32 *)(usize)(pPath + 0x7C) = 1u;
      if (c == 1) set_world_cell(&w, 104, 104, 0x0080u);
      track_region(pUnit, 0x100);
      track_region(pPath, 0x200);
      snapshot_pre();
      fn(pUnit);
      snprintf(note, sizeof(note), "f08_refresh_pat_c%d", c);
      snprintf(args, sizeof(args), "[%u]", pUnit);
      emit_vector(fp, "0x6FD85CF0", "PATH_RefreshUnitCollisionPattern113c", c, note, args, 0u, 0u);
    }
  }

  /* F09: 0x6FD6B280 MONSTER_GetMissileIdForAnimMode113c */
  {
    fn_std2_u32_t fn = (fn_std2_u32_t)(usize)0x6FD6B280u;
    const u32 modes[6] = { 1u, 4u, 5u, 7u, 8u, 14u };
    for (int c = 0; c < 8; c++) {
      reset_heap();
      u32 dt, pBitMasks, monTbl, mon2Tbl;
      setup_datatables_min(&dt, &pBitMasks, &monTbl, &mon2Tbl);
      *pSgpt = dt;
      *pBitMasksIat = pBitMasks;
      u32 pUnit = heap_alloc(0x100);
      u32 pAnim = heap_alloc(0x120);
      *(u32 *)(usize)(pUnit + 0x00) = 1u;
      *(u32 *)(usize)(pUnit + 0x04) = 1u;
      *(u32 *)(usize)(pUnit + 0x10) = (c < 6) ? modes[c] : 4u;
      *(u32 *)(usize)(pUnit + 0x44) = (5u << 8);
      *(s16 *)(usize)(pUnit + 0x4C) = (s16)(2 << 8);
      *(u8  *)(usize)(pUnit + 0x4E) = (c == 6) ? 0u : 1u;
      *(u32 *)(usize)(pUnit + 0x50) = pAnim;
      if (c == 1) *(u8 *)(usize)(pAnim + 0x10u + 4u) = 2u; /* event 2 at f=4 -> missile */
      if (c == 2) *(u8 *)(usize)(pAnim + 0x10u + 5u) = 1u; /* event 1 at f=5 -> missile */
      if (c == 7) *(u8 *)(usize)(pAnim + 0x10u + 3u) = 2u; /* f==startFrame -> -1 */

      *(s16 *)(usize)(monTbl + 1u * 424u + 0x3Au) = 101;
      *(s16 *)(usize)(monTbl + 1u * 424u + 0x3Cu) = 102;
      *(s16 *)(usize)(monTbl + 1u * 424u + 0x46u) = 103;
      *(s16 *)(usize)(monTbl + 1u * 424u + 0x3Eu) = 104;
      *(s16 *)(usize)(monTbl + 1u * 424u + 0x48u) = -1;

      u32 bCheck = (c == 1 || c == 2 || c == 6 || c == 7) ? 1u : 0u;
      u32 argUnit = (c == 0) ? 0u : pUnit;
      track_region(0x6FDE9E1Cu, 4u);
      track_region(dt, 0x1000u);
      track_region(monTbl, 8u * 424u);
      track_region(pUnit, 0x100);
      track_region(pAnim, 0x120);
      snapshot_pre();
      u32 ret = fn(argUnit, bCheck);
      snprintf(note, sizeof(note), "f09_mon_missile_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u]", argUnit, bCheck);
      emit_vector(fp, "0x6FD6B280", "MONSTER_GetMissileIdForAnimMode113c", c, note, args, ret, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
    *pBitMasksIat = savedBitMasks;
  }

  /* F10: 0x6FD5BD60 DRLGPRESET_BuildFortressAndMapAIPaths113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 pDrlgMap = heap_alloc(0x80);
    u32 pFile = heap_alloc(0x60);
    u32 pLvlPrest = heap_alloc(0x1B0);
    u32 nW = 4u, nH = 3u;
    u32 pCells = heap_alloc((nW + 1u) * (nH + 1u) * 4u);
    *(u32 *)(usize)(pLvlPrest + 0x00) = (c == 0) ? 0x1Bu : 0x05u;
    *(u32 *)(usize)(pFile + 0x10) = 2u;
    *(u32 *)(usize)(pFile + 0x3C) = pCells;
    *(u32 *)(usize)(pDrlgMap + 0x08) = pLvlPrest;
    *(u32 *)(usize)(pDrlgMap + 0x0C) = pFile;
    *(u32 *)(usize)(pDrlgMap + 0x10) = 10u;
    *(u32 *)(usize)(pDrlgMap + 0x14) = 20u;
    *(u32 *)(usize)(pDrlgMap + 0x18) = (c == 3) ? 0u : nW;
    *(u32 *)(usize)(pDrlgMap + 0x1C) = nH;
    if (c == 1) {
      /* style=2 (bits 20..25), seq=0x18 (bits 8..15) at x=0 -> spawns wall2 + AI path */
      *(u32 *)(usize)(pCells + 0u) = (2u << 20) | (0x18u << 8);
    } else if (c == 2) {
      /* style=2, seq=0x19 -> no match */
      *(u32 *)(usize)(pCells + 0u) = (2u << 20) | (0x19u << 8);
    }
    track_region(pDrlgMap, 0x80);
    track_region(pFile, 0x60);
    track_region(pLvlPrest, 0x1B0);
    track_region(pCells, (nW + 1u) * (nH + 1u) * 4u);
    snapshot_pre();
    call_eax_stk1_void(0x6FD5BD60u, pDrlgMap, 0x1234u);
    snprintf(note, sizeof(note), "f10_build_fortress_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u]", pDrlgMap, 0x1234u);
    emit_vector(fp, "0x6FD5BD60", "DRLGPRESET_BuildFortressAndMapAIPaths113c", c, note, args, 0u, 0u);
  }

  /* F11: 0x6FD5EEC0 DRLGMAZE_PositionAdjacentRoomAndCheckSeparation113c */
  for (int c = 0; c < 11; c++) {
    reset_heap();
    u32 pLevel = heap_alloc(0x200);
    u32 pBase = heap_alloc(0xEC);
    u32 pNew = heap_alloc(0xEC);
    u32 pOther = heap_alloc(0xEC);
    u32 pOrth = heap_alloc(0x18);
    u32 pOrthBox = heap_alloc(0x10);

    *(s32 *)(usize)(pBase + 0x34) = 100;
    *(s32 *)(usize)(pBase + 0x38) = 100;
    *(s32 *)(usize)(pBase + 0x3C) = 10;
    *(s32 *)(usize)(pBase + 0x40) = 10;
    *(u32 *)(usize)(pBase + 0x58) = pLevel;

    *(s32 *)(usize)(pNew + 0x34) = 999;
    *(s32 *)(usize)(pNew + 0x38) = 999;
    *(s32 *)(usize)(pNew + 0x3C) = 10;
    *(s32 *)(usize)(pNew + 0x40) = 10;
    *(u32 *)(usize)(pNew + 0x58) = pLevel;

    *(u32 *)(usize)(pLevel + 0x10) = pBase;
    *(u32 *)(usize)(pBase + 0x24) = (c == 10) ? pOther : 0u;
    *(s32 *)(usize)(pOther + 0x34) = 110;
    *(s32 *)(usize)(pOther + 0x38) = 100;
    *(s32 *)(usize)(pOther + 0x3C) = 10;
    *(s32 *)(usize)(pOther + 0x40) = 10;

    if (c == 9) {
      /* Orth overlap with pNew placed at dir=2 (110,100) */
      *(s32 *)(usize)(pOrthBox + 0x00) = 112;
      *(s32 *)(usize)(pOrthBox + 0x04) = 102;
      *(s32 *)(usize)(pOrthBox + 0x08) = 5;
      *(s32 *)(usize)(pOrthBox + 0x0C) = 5;
      *(u32 *)(usize)(pOrth + 0x10) = pOrthBox;
      *(u32 *)(usize)(pBase + 0x00) = pOrth;
    }
    u32 nDir = (c < 8) ? (u32)c : (c == 8) ? 8u : 2u;

    track_region(pLevel, 0x200);
    track_region(pBase, 0xEC);
    track_region(pNew, 0xEC);
    track_region(pOther, 0xEC);
    track_region(pOrth, 0x18);
    track_region(pOrthBox, 0x10);
    snapshot_pre();
    u32 ret = call_eax_ecx_edx_u32(0x6FD5EEC0u, nDir, pBase, pNew);
    snprintf(note, sizeof(note), "f11_maze_pos_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u]", nDir, pBase, pNew);
    emit_vector(fp, "0x6FD5EEC0", "DRLGMAZE_PositionAdjacentRoomAndCheckSeparation113c", c, note, args, ret, 0xFFFFFFFFu);
  }
}

static void emit_i12c_1_tail(FILE *fp) {
  char note[64], args[256];

  /* F12: 0x6FD621D0 DUNGEON_IsSquareTouchingRoomBounds113c */
  for (int c = 0; c < 8; c++) {
    reset_heap();
    u32 pRoom1 = heap_alloc(0x80);
    *(s32 *)(usize)(pRoom1 + 0x4C) = 100;
    *(s32 *)(usize)(pRoom1 + 0x50) = 200;
    *(s32 *)(usize)(pRoom1 + 0x54) = (c == 6) ? -30 : 20;
    *(s32 *)(usize)(pRoom1 + 0x58) = (c == 7) ? -30 : 20;
    const s32 xs[8] = { 105, 90, 95, 130, 105, 110, 90, 105 };
    const s32 ys[8] = { 205, 205, 185, 205, 190, 210, 205, 190 };
    const s32 rs[8] = { 3, 5, 3, 2, 2, -25, 5, 5 };
    u32 nX = (u32)xs[c], nY = (u32)ys[c], nR = (u32)rs[c];
    track_region(pRoom1, 0x80);
    snapshot_pre();
    u32 ret = call_eax_ecx_edx_edi_u32(0x6FD621D0u, nY, pRoom1, nX, nR);
    snprintf(note, sizeof(note), "f12_sq_touch_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", nY, pRoom1, nX, nR);
    emit_vector(fp, "0x6FD621D0", "DUNGEON_IsSquareTouchingRoomBounds113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* F13: 0x6FD62250 DUNGEON_IsSquareOutsideRoomInterior113c */
  for (int c = 0; c < 6; c++) {
    reset_heap();
    u32 pRoom1 = heap_alloc(0x80);
    *(s32 *)(usize)(pRoom1 + 0x4C) = 100;
    *(s32 *)(usize)(pRoom1 + 0x50) = 200;
    *(s32 *)(usize)(pRoom1 + 0x54) = 20;
    *(s32 *)(usize)(pRoom1 + 0x58) = 20;
    const s32 xs[6] = { 110, 102, 110, 118, 110, 103 };
    const s32 ys[6] = { 210, 210, 202, 210, 218, 210 };
    const s32 ms[6] = { 2, 2, 2, 2, 2, 2 };
    u32 nX = (u32)xs[c], nY = (u32)ys[c], nM = (u32)ms[c];
    track_region(pRoom1, 0x80);
    snapshot_pre();
    u32 ret = call_eax_ecx_edx_esi_u32(0x6FD62250u, nY, pRoom1, nX, nM);
    snprintf(note, sizeof(note), "f13_sq_outside_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", nY, pRoom1, nX, nM);
    emit_vector(fp, "0x6FD62250", "DUNGEON_IsSquareOutsideRoomInterior113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* F14: 0x6FD69AD0 DUNGEON_FindRoomExWithValidExitWarp113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 pLevel = heap_alloc(0x200);
    u32 pDrlg = heap_alloc(0x100);
    u32 pWarp = heap_alloc(0x60);
    u32 r0 = heap_alloc(0xEC), r1 = heap_alloc(0xEC);
    *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32 *)(usize)(pLevel + 0x1D0) = 2u;
    *(u32 *)(usize)(pDrlg + 0x90) = pWarp;
    *(u32 *)(usize)(pWarp + 0x00) = 2u;
    for (int i = 0; i < 8; i++) *(s32 *)(usize)(pWarp + 0x24u + (u32)(i * 4)) = -1;
    if (c == 1) *(s32 *)(usize)(pWarp + 0x24u + 0u) = 3;
    if (c == 2) *(s32 *)(usize)(pWarp + 0x24u + 12u) = 8;

    *(u32 *)(usize)(pLevel + 0x10) = (c == 0) ? 0u : r0;
    *(u32 *)(usize)(r0 + 0x24) = r1;
    *(u32 *)(usize)(r0 + 0x28) = (c == 1) ? 0x10u : 0x0Fu;
    *(u32 *)(usize)(r1 + 0x28) = (c == 2) ? 0x80u : 0x20u;

    track_region(pLevel, 0x200);
    track_region(pDrlg, 0x100);
    track_region(pWarp, 0x60);
    track_region(r0, 0xEC);
    track_region(r1, 0xEC);
    snapshot_pre();
    u32 ret = call_edi_u32(0x6FD69AD0u, pLevel);
    snprintf(note, sizeof(note), "f14_find_warp_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FD69AD0", "DUNGEON_FindRoomExWithValidExitWarp113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* F15: 0x6FD8C6D0 DUNGEON_GetRoomCoordListIndexAtSubtile113c */
  {
    fn_std3_u32_t fn = (fn_std3_u32_t)(usize)0x6FD8C6D0u;
    for (int c = 0; c < 4; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pRoomEx = heap_alloc(0xEC);
      u32 pLogical = heap_alloc(0x34);
      u32 pIdxCells = heap_alloc(16 * 4);
      u32 pIdxRows = heap_alloc(4 * 4);
      u32 pCoord = heap_alloc(0x30);
      *(u32 *)(usize)(w.r[4] + 0x10) = pRoomEx;
      *(s32 *)(usize)(pRoomEx + 0x34) = 20;
      *(s32 *)(usize)(pRoomEx + 0x38) = 20;
      *(s32 *)(usize)(pRoomEx + 0x3C) = 4;
      *(s32 *)(usize)(pRoomEx + 0x40) = 4;
      *(u32 *)(usize)(pRoomEx + 0x64) = pLogical;
      *(u32 *)(usize)(pLogical + 0x00) = (c == 2) ? 1u : 0u;
      *(u32 *)(usize)(pLogical + 0x1C) = pIdxCells;
      *(u32 *)(usize)(pLogical + 0x20) = pIdxRows;
      *(u32 *)(usize)(pLogical + 0x30) = pCoord;
      for (int y = 0; y < 4; y++) *(u32 *)(usize)(pIdxRows + (u32)(y * 4)) = (u32)(y * 4);
      if (c == 1) *(u32 *)(usize)(pIdxCells + 0u) = pCoord;
      *(u32 *)(usize)(pCoord + 0x28) = (c == 2) ? 77u : 42u;

      u32 sx = (c == 0) ? 250u : 102u;
      u32 sy = (c == 0) ? 250u : 102u;
      track_region(pRoomEx, 0xEC);
      track_region(pLogical, 0x34);
      track_region(pIdxCells, 16 * 4);
      track_region(pIdxRows, 4 * 4);
      track_region(pCoord, 0x30);
      snapshot_pre();
      u32 ret = fn(w.r[4], sx, sy);
      snprintf(note, sizeof(note), "f15_coord_idx_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u,%u]", w.r[4], sx, sy);
      emit_vector(fp, "0x6FD8C6D0", "DUNGEON_GetRoomCoordListIndexAtSubtile113c", c, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F16: 0x6FD94F90 DRLGROOM_FreeRoomEx113c */
  {
    fn_std1_void_t fn = (fn_std1_void_t)(usize)0x6FD94F90u;
    for (int c = 0; c < 4; c++) {
      reset_heap();
      u32 pLevel = heap_alloc(0x200);
      u32 pDrlg = heap_alloc(0x500);
      u32 pRoomEx = heap_alloc(0xEC);
      u32 pOther = heap_alloc(0xEC);
      u32 pNeigh = heap_alloc(0xEC);
      u32 st1 = heap_alloc(0x10), st2 = heap_alloc(0x10);
      u32 ppNear = heap_alloc(0x10);
      u32 pType = heap_alloc(0x100);
      u32 pu = heap_alloc(0x20), puSub = heap_alloc(0x10), puSubData = heap_alloc(0x10);
      u32 oSelf0 = heap_alloc(0x18), oSelf1 = heap_alloc(0x18);
      u32 oNeigh0 = heap_alloc(0x18), oNeigh1 = heap_alloc(0x18);

      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32 *)(usize)(pDrlg + 0x478) = 0x5555u;
      *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
      *(u32 *)(usize)(pOther + 0x58) = pLevel;
      *(u32 *)(usize)(pNeigh + 0x58) = pLevel;

      if (c == 0) {
        *(u32 *)(usize)(pRoomEx + 0x4C) = st1;
        *(u32 *)(usize)(st1 + 0x04) = st2;
        *(u32 *)(usize)(pRoomEx + 0x08) = ppNear;
        *(u32 *)(usize)(pRoomEx + 0x2C) = 2u;
        *(u32 *)(usize)(pRoomEx + 0x48) = 2u;
        *(u32 *)(usize)(pRoomEx + 0x20) = pType;
        *(u32 *)(usize)(pRoomEx + 0x5C) = pu;
        *(u32 *)(usize)(pu + 0x10) = puSub;
        *(u32 *)(usize)(puSub + 0x04) = puSubData;
        *(u32 *)(usize)(oSelf0 + 0x00) = pNeigh;
        *(u32 *)(usize)(oSelf0 + 0x0C) = 1u;
        *(u32 *)(usize)(oSelf0 + 0x14) = oSelf1;
        *(u32 *)(usize)(oSelf1 + 0x00) = pOther;
        *(u32 *)(usize)(oSelf1 + 0x0C) = 0u;
        *(u32 *)(usize)(pRoomEx + 0x00) = oSelf0;
        *(u32 *)(usize)(oNeigh0 + 0x00) = pRoomEx;
        *(u32 *)(usize)(oNeigh0 + 0x0C) = 1u;
        *(u32 *)(usize)(pNeigh + 0x00) = oNeigh0;
        *(u32 *)(usize)(pLevel + 0x10) = pRoomEx;
        *(u32 *)(usize)(pRoomEx + 0x24) = pOther;
        *(u32 *)(usize)(pLevel + 0x08) = 2u;
      } else if (c == 1) {
        *(u32 *)(usize)(pRoomEx + 0x48) = 1u;
        *(u32 *)(usize)(pRoomEx + 0x20) = pType;
        *(u32 *)(usize)(oSelf0 + 0x00) = pOther;
        *(u32 *)(usize)(oSelf0 + 0x0C) = 0u;
        *(u32 *)(usize)(oSelf0 + 0x14) = oSelf1;
        *(u32 *)(usize)(oSelf1 + 0x00) = pNeigh;
        *(u32 *)(usize)(oSelf1 + 0x0C) = 1u;
        *(u32 *)(usize)(pRoomEx + 0x00) = oSelf0;
        *(u32 *)(usize)(oNeigh0 + 0x00) = pOther;
        *(u32 *)(usize)(oNeigh0 + 0x0C) = 0u;
        *(u32 *)(usize)(oNeigh0 + 0x14) = oNeigh1;
        *(u32 *)(usize)(oNeigh1 + 0x00) = pRoomEx;
        *(u32 *)(usize)(oNeigh1 + 0x0C) = 1u;
        *(u32 *)(usize)(pNeigh + 0x00) = oNeigh0;
        *(u32 *)(usize)(pLevel + 0x10) = pOther;
        *(u32 *)(usize)(pOther + 0x24) = pRoomEx;
        *(u32 *)(usize)(pLevel + 0x08) = 2u;
      } else if (c == 2) {
        *(u32 *)(usize)(pLevel + 0x10) = pOther;
        *(u32 *)(usize)(pLevel + 0x08) = 1u;
      } else if (c == 3) {
        *(u32 *)(usize)(pRoomEx + 0x48) = 1u;
        *(u32 *)(usize)(pRoomEx + 0x20) = 0u;
        *(u32 *)(usize)(pRoomEx + 0x5C) = pu;
        *(u32 *)(usize)(oSelf0 + 0x00) = pNeigh;
        *(u32 *)(usize)(oSelf0 + 0x0C) = 1u;
        *(u32 *)(usize)(pRoomEx + 0x00) = oSelf0;
        *(u32 *)(usize)(oNeigh0 + 0x00) = pOther;
        *(u32 *)(usize)(pNeigh + 0x00) = oNeigh0;
        *(u32 *)(usize)(pLevel + 0x10) = pOther;
        *(u32 *)(usize)(pLevel + 0x08) = 1u;
      }
      track_region(pLevel, 0x200); track_region(pDrlg, 0x500);
      track_region(pRoomEx, 0xEC); track_region(pOther, 0xEC); track_region(pNeigh, 0xEC);
      track_region(st1, 0x10); track_region(st2, 0x10); track_region(ppNear, 0x10);
      track_region(pType, 0x100); track_region(pu, 0x20); track_region(puSub, 0x10); track_region(puSubData, 0x10);
      track_region(oSelf0, 0x18); track_region(oSelf1, 0x18);
      track_region(oNeigh0, 0x18); track_region(oNeigh1, 0x18);
      snapshot_pre();
      fn(pRoomEx);
      snprintf(note, sizeof(note), "f16_free_roomex_c%d", c);
      snprintf(args, sizeof(args), "[%u]", pRoomEx);
      emit_vector(fp, "0x6FD94F90", "DRLGROOM_FreeRoomEx113c", c, note, args, 0u, 0u);
    }
  }

  /* F17: 0x6FD5EB80 DRLGMAZE_LinkTouchingMazeRooms113c */
  {
    fn_std1_void_t fn = (fn_std1_void_t)(usize)0x6FD5EB80u;
    for (int c = 0; c < 4; c++) {
      reset_heap();
      u32 pLevel = heap_alloc(0x200);
      u32 pDrlg = heap_alloc(0x500);
      u32 pMaze = heap_alloc(0x40);
      u32 r0 = heap_alloc(0xEC), r1 = heap_alloc(0xEC), r2 = heap_alloc(0xEC);
      u32 pr0 = heap_alloc(0x100), pr1 = heap_alloc(0x100), pr2 = heap_alloc(0x100);
      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32 *)(usize)(pLevel + 0x14) = pMaze;
      *(u32 *)(usize)(pLevel + 0x1C0) = 3u; /* nDrlgType=3 -> case 0 in AssignMazeRoomPrestId */
      *(s32 *)(usize)(pMaze + 0x18) = (c == 3) ? 0 : 1000;
      *(u32 *)(usize)(r0 + 0x58) = pLevel; *(u32 *)(usize)(r0 + 0x20) = pr0;
      *(u32 *)(usize)(r1 + 0x58) = pLevel; *(u32 *)(usize)(r1 + 0x20) = pr1;
      *(u32 *)(usize)(r2 + 0x58) = pLevel; *(u32 *)(usize)(r2 + 0x20) = pr2;
      *(s32 *)(usize)(r0 + 0x34) = 100; *(s32 *)(usize)(r0 + 0x38) = 100;
      *(s32 *)(usize)(r0 + 0x3C) = 10;  *(s32 *)(usize)(r0 + 0x40) = 10;
      *(s32 *)(usize)(r1 + 0x34) = 110; *(s32 *)(usize)(r1 + 0x38) = 100;
      *(s32 *)(usize)(r1 + 0x3C) = 10;  *(s32 *)(usize)(r1 + 0x40) = 10;
      *(s32 *)(usize)(r2 + 0x34) = 150; *(s32 *)(usize)(r2 + 0x38) = 150;
      *(s32 *)(usize)(r2 + 0x3C) = 10;  *(s32 *)(usize)(r2 + 0x40) = 10;
      *(u32 *)(usize)(r1 + 0x14) = 0x12345u;
      *(u32 *)(usize)(r1 + 0x18) = 0x6789Au;
      *(u32 *)(usize)(pLevel + 0x10) = r0;
      *(u32 *)(usize)(r0 + 0x24) = r1;
      *(u32 *)(usize)(r1 + 0x24) = r2;
      if (c == 0) *(u32 *)(usize)(pr0 + 0x0C) = 0x02u;
      if (c == 2) *(u32 *)(usize)(pr1 + 0x0C) = 0x02u;
      track_region(pLevel, 0x200); track_region(pDrlg, 0x500); track_region(pMaze, 0x40);
      track_region(r0, 0xEC); track_region(r1, 0xEC); track_region(r2, 0xEC);
      track_region(pr0, 0x100); track_region(pr1, 0x100); track_region(pr2, 0x100);
      snapshot_pre();
      fn(r0);
      snprintf(note, sizeof(note), "f17_link_maze_c%d", c);
      snprintf(args, sizeof(args), "[%u]", r0);
      emit_vector(fp, "0x6FD5EB80", "DRLGMAZE_LinkTouchingMazeRooms113c", c, note, args, 0u, 0u);
    }
  }
}

static void setup_outdoors_level(
  u32 *outLevel, u32 *outDrlg, u32 *outOutdoors, u32 *outPrestTbl, u32 *outDt,
  u32 gridW, u32 gridH, u32 prestCount
) {
  u32 pLevel = heap_alloc(0x200);
  u32 pDrlg = heap_alloc(0x500);
  u32 pOutdoors = heap_alloc(0x280);
  u32 dt = heap_alloc(0x1000);
  u32 prestTbl = heap_alloc(prestCount * 0x1B0u);
  u32 nCells = gridW * gridH;
  u32 g0Cells = heap_alloc(nCells * 4u), g0Rows = heap_alloc(gridH * 4u);
  u32 g1Cells = heap_alloc(nCells * 4u), g1Rows = heap_alloc(gridH * 4u);
  u32 g2Cells = heap_alloc(nCells * 4u), g2Rows = heap_alloc(gridH * 4u);

  for (u32 y = 0; y < gridH; y++) {
    *(u32 *)(usize)(g0Rows + y * 4u) = y * gridW;
    *(u32 *)(usize)(g1Rows + y * 4u) = y * gridW;
    *(u32 *)(usize)(g2Rows + y * 4u) = y * gridW;
  }
  *(u32 *)(usize)(pOutdoors + 0x04) = g0Cells;
  *(u32 *)(usize)(pOutdoors + 0x08) = g0Rows;
  *(u32 *)(usize)(pOutdoors + 0x18) = g1Cells;
  *(u32 *)(usize)(pOutdoors + 0x1C) = g1Rows;
  *(u32 *)(usize)(pOutdoors + 0x2C) = g2Cells;
  *(u32 *)(usize)(pOutdoors + 0x30) = g2Rows;
  *(u32 *)(usize)(pOutdoors + 0x34) = gridW;
  *(u32 *)(usize)(pOutdoors + 0x38) = gridH;
  *(u32 *)(usize)(pOutdoors + 0x5C) = gridW;
  *(u32 *)(usize)(pOutdoors + 0x60) = gridH;

  *(u32 *)(usize)(pLevel + 0x14) = pOutdoors;
  *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
  *(u32 *)(usize)(pLevel + 0x1C4) = 0x12345678u;
  *(u32 *)(usize)(pLevel + 0x1C8) = 0x9ABCDEF0u;
  *(u32 *)(usize)(dt + 0xC68) = prestCount;

  track_region(pLevel, 0x200);
  track_region(pDrlg, 0x500);
  track_region(pOutdoors, 0x280);
  track_region(dt, 0x1000);
  track_region(prestTbl, prestCount * 0x1B0u);
  track_region(g0Cells, nCells * 4u); track_region(g0Rows, gridH * 4u);
  track_region(g1Cells, nCells * 4u); track_region(g1Rows, gridH * 4u);
  track_region(g2Cells, nCells * 4u); track_region(g2Rows, gridH * 4u);

  *outLevel = pLevel;
  *outDrlg = pDrlg;
  *outOutdoors = pOutdoors;
  *outPrestTbl = prestTbl;
  *outDt = dt;
}

static void emit_i12c_1_rest(FILE *fp) {
  char note[64], args[256];
  u32 *pSgpt = (u32 *)(usize)0x6FDE9E1Cu;
  u32 *pPrestGlobal = (u32 *)(usize)0x6FDF0B3Cu;
  u32 savedSgpt = *pSgpt;
  u32 savedPrest = *pPrestGlobal;

  /* F18: 0x6FD92CE0 DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    u32 gw = (c == 0) ? 2u : 5u;
    u32 gh = (c == 0) ? 2u : 5u;
    setup_outdoors_level(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, gw, gh, 4u);
    *pSgpt = dt;
    *pPrestGlobal = prestTbl;
    *(u32 *)(usize)(prestTbl + 1u * 0x1B0u + 0x00) = 1u;
    *(u32 *)(usize)(prestTbl + 1u * 0x1B0u + 0x28) = 8u;
    *(u32 *)(usize)(prestTbl + 1u * 0x1B0u + 0x2C) = 8u;
    *(u32 *)(usize)(prestTbl + 1u * 0x1B0u + 0x40) = 2u;
    if (c == 2) {
      /* Block all interior cells in grid2 */
      u32 g2c = *(u32 *)(usize)(pOutdoors + 0x2C);
      for (u32 i = 0; i < gw * gh; i++) *(u32 *)(usize)(g2c + i * 4u) = 0x1000u;
    }
    if (c == 3) {
      /* Block all but (3,3) */
      u32 g2c = *(u32 *)(usize)(pOutdoors + 0x2C);
      for (u32 i = 0; i < gw * gh; i++) *(u32 *)(usize)(g2c + i * 4u) = 0x1000u;
      *(u32 *)(usize)(g2c + (3u * gw + 3u) * 4u) = 0u;
    }
    u32 pickedFile = (c == 1) ? 0u : 0xFFFFFFFFu;
    track_region(0x6FDE9E1Cu, 4u);
    track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    u32 ret = call_esi_stk4_u32(0x6FD92CE0u, pLevel, 1u, pickedFile, 0u, 0u);
    snprintf(note, sizeof(note), "f18_place_rand_preset_c%d", c);
    snprintf(args, sizeof(args), "[%u,1,%u,0,0]", pLevel, pickedFile);
    emit_vector(fp, "0x6FD92CE0", "DRLGOUTDOORS_PlaceRandomOutdoorPresetRoom113c", c, note, args, ret, 0xFFFFFFFFu);
  }
  *pSgpt = savedSgpt;
  *pPrestGlobal = savedPrest;

  /* F19: 0x6FD92C00 DRLGOUTDOORS_ComputeVertexLevelLinkVisBit113c */
  for (int c = 0; c < 8; c++) {
    reset_heap();
    u32 pLevel = heap_alloc(0x200);
    u32 pDrlg = heap_alloc(0x100);
    u32 pOutdoors = heap_alloc(0x280);
    u32 pVertex = heap_alloc(0x14);
    u32 pOrth = heap_alloc(0x18);
    u32 pOrthBox = heap_alloc(0x10);
    u32 pAdjLevel = heap_alloc(0x200);
    u32 pWarp = heap_alloc(0x60);

    *(u32 *)(usize)(pLevel + 0x14) = pOutdoors;
    *(s32 *)(usize)(pLevel + 0x1C) = 100;
    *(s32 *)(usize)(pLevel + 0x20) = 200;
    *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32 *)(usize)(pLevel + 0x1D0) = 2u;
    *(u32 *)(usize)(pOutdoors + 0x5C) = 5u;
    *(u32 *)(usize)(pOutdoors + 0x60) = 5u;
    *(u32 *)(usize)(pOutdoors + 0x264) = (c == 7) ? 0u : pOrth;

    const s32 vxs[8] = { 0, 0, 2, 4, 4, 2, 2, 0 };
    const s32 vys[8] = { 2, 0, 0, 0, 4, 4, 2, 2 };
    *(s32 *)(usize)(pVertex + 0x00) = vxs[c];
    *(s32 *)(usize)(pVertex + 0x04) = vys[c];

    const s32 dirs[8] = { 0, 1, 1, 2, 3, 3, 0, 0 };
    *(s32 *)(usize)(pOrth + 0x04) = dirs[c];
    *(u32 *)(usize)(pOrth + 0x00) = pAdjLevel;
    *(u32 *)(usize)(pOrth + 0x0C) = (c == 5) ? 1u : 0u;
    *(u32 *)(usize)(pOrth + 0x10) = pOrthBox;
    *(s32 *)(usize)(pOrthBox + 0x00) = 80;
    *(s32 *)(usize)(pOrthBox + 0x04) = 180;
    *(s32 *)(usize)(pOrthBox + 0x08) = 100;
    *(s32 *)(usize)(pOrthBox + 0x0C) = 100;

    *(u32 *)(usize)(pAdjLevel + 0x1D0) = 7u;
    *(u32 *)(usize)(pDrlg + 0x90) = pWarp;
    *(u32 *)(usize)(pWarp + 0x00) = 2u;
    for (int i = 0; i < 8; i++) *(s32 *)(usize)(pWarp + 0x04u + (u32)(i * 4)) = -1;
    *(s32 *)(usize)(pWarp + 0x04u + 12u) = 7; /* index 3 -> bit (1 << (3 + 4)) = 0x80 */

    track_region(pLevel, 0x200); track_region(pDrlg, 0x100);
    track_region(pOutdoors, 0x280); track_region(pVertex, 0x14);
    track_region(pOrth, 0x18); track_region(pOrthBox, 0x10);
    track_region(pAdjLevel, 0x200); track_region(pWarp, 0x60);
    snapshot_pre();
    u32 ret = call_ecx_stk1_u32(0x6FD92C00u, pVertex, pLevel);
    snprintf(note, sizeof(note), "f19_vert_vis_bit_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u]", pVertex, pLevel);
    emit_vector(fp, "0x6FD92C00", "DRLGOUTDOORS_ComputeVertexLevelLinkVisBit113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* F20: 0x6FDD1AD0 DRLGLOGIC_LinkAdjacentRoomsCoordLists113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel = heap_alloc(0x200);
    u32 r0 = heap_alloc(0xEC), r1 = heap_alloc(0xEC);
    u32 ppNear = heap_alloc(12u);
    u32 log0 = heap_alloc(0x34), log1 = heap_alloc(0x34);
    u32 cl0 = heap_alloc(0x30), cl1 = heap_alloc(0x30);
    /* r0: x=10,y=10,w=3,h=2 -> (w+1)*(h+1) = 4*3 = 12 cells; r1: w=2,h=2 -> 3*3 = 9 cells */
    u32 idxCells0 = heap_alloc(12u * 4u), idxRows0 = heap_alloc(3u * 4u);
    u32 idxCells1 = heap_alloc(9u * 4u),  idxRows1 = heap_alloc(3u * 4u);

    *(u32 *)(usize)(pLevel + 0x1D0) = 2u;
    *(u32 *)(usize)(r0 + 0x58) = pLevel;
    *(u32 *)(usize)(r1 + 0x58) = pLevel;
    *(s32 *)(usize)(r0 + 0x34) = 10; *(s32 *)(usize)(r0 + 0x38) = 10;
    *(s32 *)(usize)(r0 + 0x3C) = 3;  *(s32 *)(usize)(r0 + 0x40) = 2;
    *(s32 *)(usize)(r1 + 0x34) = (c == 2) ? 30 : 12;
    *(s32 *)(usize)(r1 + 0x38) = 10;
    *(s32 *)(usize)(r1 + 0x3C) = 2;  *(s32 *)(usize)(r1 + 0x40) = 2;
    *(u32 *)(usize)(r0 + 0x08) = ppNear;
    *(u32 *)(usize)(r0 + 0x2C) = (c == 0) ? 0u : 2u;
    *(u32 *)(usize)(ppNear + 0u) = r0;
    *(u32 *)(usize)(ppNear + 4u) = r1;

    *(u32 *)(usize)(r0 + 0x64) = log0;
    *(u32 *)(usize)(r1 + 0x64) = log1;
    *(u32 *)(usize)(log0 + 0x00) = 0u; /* flag 0 -> reads pIndexCells/pIndexRowOffsets */
    *(u32 *)(usize)(log1 + 0x00) = 0u;
    *(u32 *)(usize)(log0 + 0x1C) = idxCells0;
    *(u32 *)(usize)(log0 + 0x20) = idxRows0;
    *(u32 *)(usize)(log1 + 0x1C) = idxCells1;
    *(u32 *)(usize)(log1 + 0x20) = idxRows1;
    for (u32 i = 0; i < 3u; i++) {
      *(u32 *)(usize)(idxRows0 + i * 4u) = i * 4u;
      *(u32 *)(usize)(idxRows1 + i * 4u) = i * 3u;
    }
    for (u32 i = 0; i < 12u; i++) *(u32 *)(usize)(idxCells0 + i * 4u) = cl0;
    for (u32 i = 0; i < 9u; i++)  *(u32 *)(usize)(idxCells1 + i * 4u) = cl1;
    *(u32 *)(usize)(log0 + 0x30) = cl0;
    *(u32 *)(usize)(log1 + 0x30) = cl1;
    *(u32 *)(usize)(cl0 + 0x28) = 5u;
    *(u32 *)(usize)(cl1 + 0x28) = 8u;
    *(u32 *)(usize)(cl0 + 0x20) = 1u;
    *(u32 *)(usize)(cl1 + 0x20) = 1u;

    track_region(pLevel, 0x200); track_region(r0, 0xEC); track_region(r1, 0xEC);
    track_region(ppNear, 12u); track_region(log0, 0x34); track_region(log1, 0x34);
    track_region(cl0, 0x30); track_region(cl1, 0x30);
    track_region(idxCells0, 12u * 4u); track_region(idxRows0, 3u * 4u);
    track_region(idxCells1, 9u * 4u);  track_region(idxRows1, 3u * 4u);
    snapshot_pre();
    call_esi_void(0x6FDD1AD0u, r0);
    snprintf(note, sizeof(note), "f20_link_coord_lists_c%d", c);
    snprintf(args, sizeof(args), "[%u]", r0);
    emit_vector(fp, "0x6FDD1AD0", "DRLGLOGIC_LinkAdjacentRoomsCoordLists113c", c, note, args, 0u, 0u);
  }

  /* F21: 0x6FDD4110 DRLGTILESUB_ApplySubThemesToRoom113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 pLvlSub = heap_alloc(0x80);
    u32 pSubData = heap_alloc(0x60);
    u32 pGroups = heap_alloc(24u * 2u);
    u32 pSubstCtx = heap_alloc(0x40);
    u32 pLevel = heap_alloc(0x200);
    u32 pOutdoors = heap_alloc(0x80);
    u32 pCoord = heap_alloc(0x10);

    *(u32 *)(usize)(pLevel + 0x14) = pOutdoors;
    *(u32 *)(usize)(pLevel + 0x1C4) = 0x24681357u;
    *(u32 *)(usize)(pLevel + 0x1C8) = 0x13572468u;
    *(u32 *)(usize)(pSubstCtx + 0x00) = pLevel;
    *(u32 *)(usize)(pSubstCtx + 0x04) = pCoord;
    *(s32 *)(usize)(pSubstCtx + 0x14) = (c == 1) ? -1 : 10;
    *(s32 *)(usize)(pCoord + 0x08) = (c == 3) ? -1 : 4; /* spanX=0 when c==3 */
    *(s32 *)(usize)(pCoord + 0x0C) = 4;

    *(u32 *)(usize)(pLvlSub + 0x44) = (c == 2) ? 2u : 0u;
    *(u32 *)(usize)(pLvlSub + 0x4C) = 1u;
    *(u32 *)(usize)(pLvlSub + 0x50) = pSubData;
    *(u32 *)(usize)(pSubData + 0x4C) = (c == 0) ? 0u : 2u;
    *(u32 *)(usize)(pSubData + 0x50) = pGroups;
    for (int g = 0; g < 2; g++) {
      *(s32 *)(usize)(pGroups + (u32)(g * 24 + 0x08)) = 0;
      *(s32 *)(usize)(pGroups + (u32)(g * 24 + 0x0C)) = 0;
      *(s32 *)(usize)(pGroups + (u32)(g * 24 + 0x14)) = 2;
    }

    track_region(pLvlSub, 0x80); track_region(pSubData, 0x60);
    track_region(pGroups, 48u); track_region(pSubstCtx, 0x40);
    track_region(pLevel, 0x200); track_region(pOutdoors, 0x80); track_region(pCoord, 0x10);
    snapshot_pre();
    call_ebx_stk1_void(0x6FDD4110u, pLvlSub, pSubstCtx);
    snprintf(note, sizeof(note), "f21_sub_themes_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u]", pLvlSub, pSubstCtx);
    emit_vector(fp, "0x6FDD4110", "DRLGTILESUB_ApplySubThemesToRoom113c", c, note, args, 0u, 0u);
  }
}

static void emit_i12c_1(FILE *fp) {
  emit_i12c_1_path(fp);
  emit_i12c_1_mid(fp);
  emit_i12c_1_tail(fp);
  emit_i12c_1_rest(fp);
}

static void emit_i12c_2_path(FILE *fp) {
  char note[64], args[256];
  u32 *pSgpt = (u32 *)(usize)0x6FDE9E1Cu;
  u32 *pBitMasksIat = (u32 *)(usize)0x6FDD90B0u;
  u32 savedSgpt = *pSgpt;
  u32 savedBitMasks = *pBitMasksIat;

  /* F22: 0x6FD5D580 PATH_RaymarchSubtileSteps113c */
  for (int c = 0; c < 5; c++) {
    reset_heap();
    CollWorld w; build_coll_world(&w);
    u32 pPath = heap_alloc(0x200);
    u32 pUnit = heap_alloc(0x100);
    u32 pOutPos = heap_alloc(8u);
    u32 pOutSteps = heap_alloc(4u);

    *(u32 *)(usize)(pUnit + 0x00) = 0u;
    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
    *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (102u << 16);
    *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (102u << 16);
    *(u32 *)(usize)(pPath + 0x34) = (c == 1 || c == 3) ? 0x20000u : 0x00000u;
    *(u32 *)(usize)(pPath + 0x44) = 1u;
    *(u32 *)(usize)(pPath + 0x48) = 1u;
    *(u32 *)(usize)(pPath + 0x4C) = 0x0080u;
    *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;

    s32 dX = (c == 0) ? 0x1000 : (c == 3) ? 0xF0000 : 0x30000;
    s32 dY = 0;
    if (c == 2) {
      set_world_cell(&w, 104, 102, 0x1C01u); /* blocked mid-march */
    } else if (c == 4) {
      dX = 0x20000;
      dY = 0x10000;
      *(u32 *)(usize)(pPath + 0x34) = 0x20004u; /* direct move flag 0x04 */
    }

    track_region(pPath, 0x200);
    track_region(pUnit, 0x100);
    track_region(pOutPos, 8u);
    track_region(pOutSteps, 4u);
    snapshot_pre();
    u32 ret = call_esi_stk4_u32(0x6FD5D580u, pPath, (u32)dX, (u32)dY, pOutPos, pOutSteps);
    snprintf(note, sizeof(note), "f22_raymarch_c%d", c);
    snprintf(args, sizeof(args), "[%u,%d,%d,%u,%u]", pPath, dX, dY, pOutPos, pOutSteps);
    emit_vector(fp, "0x6FD5D580", "PATH_RaymarchSubtileSteps113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* F23: 0x6FD5DB70 PATH_CheckTargetMovedAndRecompute113c */
  for (int c = 0; c < 8; c++) {
    reset_heap();
    CollWorld w; build_coll_world(&w);
    u32 dt, pBitMasks, monTbl, mon2Tbl;
    setup_datatables_min(&dt, &pBitMasks, &monTbl, &mon2Tbl);
    *pSgpt = dt;
    *pBitMasksIat = pBitMasks;

    u32 pPath = heap_alloc(0x200);
    u32 pUnit = heap_alloc(0x100);
    u32 pTarget = heap_alloc(0x100);
    u32 pTgtPath = heap_alloc(0x200);
    u32 pSeed = heap_alloc(0x10);
    u32 pRoomEx = heap_alloc(0x80);
    u32 pLevel = heap_alloc(0x200);

    *(u32 *)(usize)(pSeed + 0x00) = 0x11112222u;
    *(u32 *)(usize)(pSeed + 0x04) = 0x33334444u;
    *(u32 *)(usize)(pUnit + 0x00) = 0u;
    *(u32 *)(usize)(pUnit + 0x20) = pSeed;
    *(u32 *)(usize)(pUnit + 0x2C) = pPath;
    *(u32 *)(usize)(pLevel + 0x1D0) = 2u;
    *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
    for (int i = 0; i < 9; i++) *(u32 *)(usize)(w.r[i] + 0x10) = pRoomEx;

    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
    *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (102u << 16);
    *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (102u << 16);
    *(u16 *)(usize)(pPath + 0x10) = 105u;
    *(u16 *)(usize)(pPath + 0x12) = 102u;
    *(u16 *)(usize)(pPath + 0x14) = 105u;
    *(u16 *)(usize)(pPath + 0x16) = 102u;
    *(u16 *)(usize)(pPath + 0x18) = 105u;
    *(u16 *)(usize)(pPath + 0x1A) = 102u;
    *(u32 *)(usize)(pPath + 0x24) = (c == 0 || c == 2 || c == 7) ? 2u : 0u;
    *(u32 *)(usize)(pPath + 0x28) = 2u;
    *(u32 *)(usize)(pPath + 0x34) = 0x21900u;
    *(u32 *)(usize)(pPath + 0x3C) = (c == 0) ? 5u : 2u;
    *(u32 *)(usize)(pPath + 0x44) = 1u;
    *(u32 *)(usize)(pPath + 0x4C) = 0x80u;
    *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
    *(u32 *)(usize)(pPath + 0x7C) = 0x10000u;
    *(u8  *)(usize)(pPath + 0x91) = 40u;
    *(u8  *)(usize)(pPath + 0x92) = 40u;
    *(u8  *)(usize)(pPath + 0x93) = (c == 3) ? 10u : 1u;
    *(u8  *)(usize)(pPath + 0x94) = 5u;

    if (c >= 3) {
      *(u32 *)(usize)(pPath + 0x58) = pTarget;
      *(u32 *)(usize)(pTarget + 0x00) = 1u;
      *(u32 *)(usize)(pTarget + 0x2C) = pTgtPath;
      *(u32 *)(usize)(pTgtPath + 0x00) = 0x8000u | (((c == 4) ? 103u : (c == 5) ? 112u : 106u) << 16);
      *(u32 *)(usize)(pTgtPath + 0x04) = 0x8000u | (((c == 6) ? 112u : 102u) << 16);
      if (c == 4) {
        *(u32 *)(usize)(pPath + 0x24) = 0u;
        *(u32 *)(usize)(pPath + 0x28) = 2u;
        *(u16 *)(usize)(pPath + 0x14) = 103u;
      }
    }
    if (c == 1) {
      *(u16 *)(usize)(pPath + 0x18) = 102u;
      *(u16 *)(usize)(pPath + 0x1A) = 102u;
      *(u32 *)(usize)(pPath + 0x24) = 2u;
    }

    track_region(0x6FDE9E1Cu, 4u);
    track_region(0x6FDD90B0u, 4u);
    track_region(pBitMasks, 32u);
    track_region(dt, 0x1000u);
    track_region(monTbl, 8u * 424u);
    track_region(mon2Tbl, 8u * 308u);
    track_region(0x6FDE4138u, 72u);
    track_region(0x6FDE4180u, 72u);
    track_region(0x6FDE42F0u, 72u);
    track_region(0x6FDDC320u, 300u);
    track_region(0x6FDDC450u, 76u);
    track_region(0x6FDE5098u, 256u);
    track_region(0x6FDE5198u, 36u);
    track_region(pPath, 0x200);
    track_region(pUnit, 0x100);
    track_region(pTarget, 0x100);
    track_region(pTgtPath, 0x200);
    track_region(pSeed, 0x10);
    track_region(pRoomEx, 0x80);
    track_region(pLevel, 0x200);
    snapshot_pre();
    u32 ret = call_esi_u32(0x6FD5DB70u, pPath);
    snprintf(note, sizeof(note), "f23_check_tgt_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pPath);
    emit_vector(fp, "0x6FD5DB70", "PATH_CheckTargetMovedAndRecompute113c", c, note, args, ret, 0xFFFFFFFFu);
  }
  *pSgpt = savedSgpt;
  *pBitMasksIat = savedBitMasks;

  /* F24: 0x6FD5D8E0 PATH_AdvancePrecisionStep113c */
  for (int c = 0; c < 6; c++) {
    reset_heap();
    CollWorld w; build_coll_world(&w);
    u32 dt, pBitMasks, monTbl, mon2Tbl;
    setup_datatables_min(&dt, &pBitMasks, &monTbl, &mon2Tbl);
    *pSgpt = dt;
    *pBitMasksIat = pBitMasks;

    u32 pPath = heap_alloc(0x200);
    u32 pUnit = heap_alloc(0x100);
    u32 pSeed = heap_alloc(0x10);
    u32 pRoomEx = heap_alloc(0x80);
    u32 pLevel = heap_alloc(0x200);
    u32 pOutPos = heap_alloc(8u);
    u32 pOutSteps = heap_alloc(4u);

    *(u32 *)(usize)(pSeed + 0x00) = 0x11112222u;
    *(u32 *)(usize)(pSeed + 0x04) = 0x33334444u;
    *(u32 *)(usize)(pUnit + 0x00) = (c == 4) ? 1u : 0u;
    *(u32 *)(usize)(pUnit + 0x20) = pSeed;
    *(u32 *)(usize)(pUnit + 0x2C) = pPath;
    *(u32 *)(usize)(pLevel + 0x1D0) = 2u;
    *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
    for (int i = 0; i < 9; i++) *(u32 *)(usize)(w.r[i] + 0x10) = pRoomEx;

    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
    *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (102u << 16);
    *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (102u << 16);
    *(u16 *)(usize)(pPath + 0x10) = 106u;
    *(u16 *)(usize)(pPath + 0x12) = 102u;
    *(u16 *)(usize)(pPath + 0x18) = 106u;
    *(u16 *)(usize)(pPath + 0x1A) = 102u;
    *(u32 *)(usize)(pPath + 0x24) = 0u;
    *(u32 *)(usize)(pPath + 0x28) = 1u;
    *(u32 *)(usize)(pPath + 0x34) = (c == 4) ? 0x21910u : 0x21900u;
    *(u32 *)(usize)(pPath + 0x3C) = 2u;
    *(u32 *)(usize)(pPath + 0x44) = 1u;
    *(u32 *)(usize)(pPath + 0x48) = 1u;
    *(u32 *)(usize)(pPath + 0x4C) = 0x80u;
    *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
    *(u32 *)(usize)(pPath + 0x7C) = 0x10000u;
    *(u8  *)(usize)(pPath + 0x90) = 3u;
    *(u8  *)(usize)(pPath + 0x91) = 40u;
    *(u8  *)(usize)(pPath + 0x92) = 40u;
    *(u8  *)(usize)(pPath + 0x94) = 4u;
    *(u16 *)(usize)(pPath + 0x9C) = (c == 1) ? 102u : 103u;
    *(u16 *)(usize)(pPath + 0x9E) = 102u;

    if (c != 0) {
      s32 vx = (c == 1) ? 0x1000 : 0x20000;
      *(s32 *)(usize)(pPath + 0x72) = vx;
      *(s32 *)(usize)(pPath + 0x76) = 0;
    }
    if (c == 3 || c == 4) {
      set_world_cell(&w, 103, 102, 0x1C01u);
    }
    if (c == 5) {
      *(u16 *)(usize)(pPath + 0x9C) = 108u; /* waypoint far -> bReachedWaypoint == 0 */
    }

    track_region(0x6FDE9E1Cu, 4u);
    track_region(0x6FDD90B0u, 4u);
    track_region(pBitMasks, 32u);
    track_region(dt, 0x1000u);
    track_region(monTbl, 8u * 424u);
    track_region(mon2Tbl, 8u * 308u);
    track_region(0x6FDE4138u, 72u);
    track_region(0x6FDE4180u, 72u);
    track_region(0x6FDE42F0u, 72u);
    track_region(0x6FDDC320u, 300u);
    track_region(0x6FDDC450u, 76u);
    track_region(0x6FDE5098u, 256u);
    track_region(0x6FDE5198u, 36u);
    track_region(pPath, 0x200);
    track_region(pUnit, 0x100);
    track_region(pSeed, 0x10);
    track_region(pRoomEx, 0x80);
    track_region(pLevel, 0x200);
    track_region(pOutPos, 8u);
    track_region(pOutSteps, 4u);
    snapshot_pre();
    u32 ret = call_eax_stk2_u32(0x6FD5D8E0u, pPath, pOutPos, pOutSteps);
    snprintf(note, sizeof(note), "f24_adv_step_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u]", pPath, pOutPos, pOutSteps);
    emit_vector(fp, "0x6FD5D8E0", "PATH_AdvancePrecisionStep113c", c, note, args, ret, 0xFFFFFFFFu);
  }
  *pSgpt = savedSgpt;
  *pBitMasksIat = savedBitMasks;

  /* F25: 0x6FD5E230 PATH_Step113c (#10342) */
  {
    fn_std2_u32_t fn = (fn_std2_u32_t)(usize)0x6FD5E230u;
    for (int c = 0; c < 6; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 dt, pBitMasks, monTbl, mon2Tbl;
      setup_datatables_min(&dt, &pBitMasks, &monTbl, &mon2Tbl);
      *pSgpt = dt;
      *pBitMasksIat = pBitMasks;

      u32 pUnit = heap_alloc(0x100);
      u32 pPath = heap_alloc(0x200);
      u32 pSeed = heap_alloc(0x10);
      u32 pRoomEx = heap_alloc(0x80);
      u32 pLevel = heap_alloc(0x200);

      *(u32 *)(usize)(pSeed + 0x00) = 0x11112222u;
      *(u32 *)(usize)(pSeed + 0x04) = 0x33334444u;
      *(u32 *)(usize)(pUnit + 0x00) = (c == 4) ? 1u : 0u;
      *(u32 *)(usize)(pUnit + 0x20) = pSeed;
      *(u32 *)(usize)(pUnit + 0x2C) = (c == 0) ? 0u : pPath;
      *(u32 *)(usize)(pLevel + 0x1D0) = 2u;
      *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
      for (int i = 0; i < 9; i++) *(u32 *)(usize)(w.r[i] + 0x10) = pRoomEx;

      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (102u << 16);
      *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (102u << 16);
      *(u16 *)(usize)(pPath + 0x10) = 106u;
      *(u16 *)(usize)(pPath + 0x12) = 102u;
      *(u16 *)(usize)(pPath + 0x18) = 106u;
      *(u16 *)(usize)(pPath + 0x1A) = 102u;
      *(u32 *)(usize)(pPath + 0x24) = 0u;
      *(u32 *)(usize)(pPath + 0x28) = (c == 1) ? 0u : 2u;
      *(u32 *)(usize)(pPath + 0x34) = (c == 3) ? 0x40028u : 0x21928u;
      *(u32 *)(usize)(pPath + 0x3C) = (c == 5) ? 4u : 2u;
      *(u32 *)(usize)(pPath + 0x44) = 1u;
      *(u32 *)(usize)(pPath + 0x48) = 1u;
      *(u32 *)(usize)(pPath + 0x4C) = 0x80u;
      *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
      *(u32 *)(usize)(pPath + 0x7C) = 0x10000u; /* velocity */
      *(u32 *)(usize)(pPath + 0x84) = 0x10000u; /* maxVelocity */
      *(u16 *)(usize)(pPath + 0x9C) = 104u;
      *(u16 *)(usize)(pPath + 0x9E) = 102u;
      *(u16 *)(usize)(pPath + 0xA0) = 106u;
      *(u16 *)(usize)(pPath + 0xA2) = 102u;
      if (c == 2) {
        *(u32 *)(usize)(pPath + 0x28) = 1u;
        *(u16 *)(usize)(pPath + 0x9C) = 102u; /* reaches last point -> stops & returns 0 */
      }

      track_region(0x6FDE9E1Cu, 4u);
      track_region(0x6FDD90B0u, 4u);
      track_region(pBitMasks, 32u);
      track_region(dt, 0x1000u);
      track_region(monTbl, 8u * 424u);
      track_region(mon2Tbl, 8u * 308u);
      track_region(0x6FDE4138u, 72u);
      track_region(0x6FDE4180u, 72u);
      track_region(0x6FDE42F0u, 72u);
      track_region(0x6FDDC320u, 300u);
      track_region(0x6FDDC450u, 76u);
      track_region(0x6FDE5098u, 256u);
      track_region(0x6FDE5198u, 36u);
      track_region(pPath, 0x200);
      track_region(pUnit, 0x100);
      track_region(pSeed, 0x10);
      track_region(pRoomEx, 0x80);
      track_region(pLevel, 0x200);
      snapshot_pre();
      u32 ret = fn(pUnit, 16u);
      snprintf(note, sizeof(note), "f25_path_step_c%d", c);
      snprintf(args, sizeof(args), "[%u,16]", pUnit);
      emit_vector(fp, "0x6FD5E230", "PATH_Step113c", c, note, args, ret, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
    *pBitMasksIat = savedBitMasks;
  }

  /* F26: 0x6FD865A0 PATH_MarkUnitDeadCollision113c */
  {
    fn_std2_void_t fn = (fn_std2_void_t)(usize)0x6FD865A0u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pUnit = heap_alloc(0x100);
      u32 pPath = heap_alloc(0x200);
      *(u32 *)(usize)(pUnit + 0x00) = (c == 0) ? 1u : 0u;
      *(u32 *)(usize)(pUnit + 0x2C) = pPath;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u32 *)(usize)(pPath + 0x00) = 0x1234u | (104u << 16);
      *(u32 *)(usize)(pPath + 0x04) = 0x5678u | (104u << 16);
      *(u32 *)(usize)(pPath + 0x44) = 1u;
      *(u32 *)(usize)(pPath + 0x48) = 1u;
      *(u32 *)(usize)(pPath + 0x4C) = 0x0080u;
      *(u32 *)(usize)(pPath + 0x7C) = 2u;
      set_world_cell(&w, 104, 104, 0x0080u);
      u32 bIsCorpse = (c == 1) ? 1u : 0u;
      track_region(pUnit, 0x100);
      track_region(pPath, 0x200);
      snapshot_pre();
      fn(pUnit, bIsCorpse);
      snprintf(note, sizeof(note), "f26_mark_dead_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u]", pUnit, bIsCorpse);
      emit_vector(fp, "0x6FD865A0", "PATH_MarkUnitDeadCollision113c", c, note, args, 0u, 0u);
    }
  }
}

static void emit_i12c_2_drlg(FILE *fp) {
  char note[64], args[256];
  u32 *pSgpt = (u32 *)(usize)0x6FDE9E1Cu;
  u32 *pPrestGlobal = (u32 *)(usize)0x6FDF0B3Cu;
  u32 savedSgpt = *pSgpt;
  u32 savedPrest = *pPrestGlobal;

  /* F27: 0x6FDD1CA0 DRLGLOGIC_AllocAndBuildRoomCoordList113c */
  {
    fn_std4_void_t fn = (fn_std4_void_t)(usize)0x6FDD1CA0u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      u32 pLevel = heap_alloc(0x200);
      u32 pDrlg = heap_alloc(0x500);
      u32 pRoomEx = heap_alloc(0xEC);
      u32 pTileGrid = heap_alloc(0x2C);
      u32 pGrid1 = heap_alloc(0x14), pGrid2 = heap_alloc(0x14);
      u32 g1Cells = heap_alloc(9 * 4), g1Rows = heap_alloc(3 * 4);
      u32 g2Cells = heap_alloc(9 * 4), g2Rows = heap_alloc(3 * 4);
      for (u32 y = 0; y < 3u; y++) {
        *(u32 *)(usize)(g1Rows + y * 4u) = y * 3u;
        *(u32 *)(usize)(g2Rows + y * 4u) = y * 3u;
      }
      *(u32 *)(usize)(pGrid1 + 0x00) = g1Cells; *(u32 *)(usize)(pGrid1 + 0x04) = g1Rows;
      *(u32 *)(usize)(pGrid1 + 0x08) = 3u;      *(u32 *)(usize)(pGrid1 + 0x0C) = 3u;
      *(u32 *)(usize)(pGrid2 + 0x00) = g2Cells; *(u32 *)(usize)(pGrid2 + 0x04) = g2Rows;
      *(u32 *)(usize)(pGrid2 + 0x08) = 3u;      *(u32 *)(usize)(pGrid2 + 0x0C) = 3u;

      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32 *)(usize)(pLevel + 0x1DC) = (c == 0) ? 0u : 10u;
      *(u32 *)(usize)(pDrlg + 0x478) = 0x1234u;
      *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
      *(u32 *)(usize)(pRoomEx + 0x54) = pTileGrid;
      *(s32 *)(usize)(pRoomEx + 0x34) = 0;
      *(s32 *)(usize)(pRoomEx + 0x38) = 0;
      *(s32 *)(usize)(pRoomEx + 0x3C) = 2;
      *(s32 *)(usize)(pRoomEx + 0x40) = 2;
      if (c == 1) {
        *(u32 *)(usize)(g1Cells + 0u) = 0x80000000u; /* negative wallCell bit -> fillVal |= 0x20000000 */
      }
      u32 nPresetFlags = (c == 2) ? 0x01u : 0x00u;

      track_region(pLevel, 0x200); track_region(pDrlg, 0x500);
      track_region(pRoomEx, 0xEC); track_region(pTileGrid, 0x2C);
      track_region(pGrid1, 0x14); track_region(pGrid2, 0x14);
      track_region(g1Cells, 9 * 4); track_region(g1Rows, 3 * 4);
      track_region(g2Cells, 9 * 4); track_region(g2Rows, 3 * 4);
      track_region(0x6FDDA758u, 60u);
      track_region(0x6FDDA794u, 120u);
      track_region(0x6FDDA80Cu, 32u);
      snapshot_pre();
      fn(pRoomEx, nPresetFlags, pGrid1, pGrid2);
      snprintf(note, sizeof(note), "f27_build_coord_list_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pRoomEx, nPresetFlags, pGrid1, pGrid2);
      emit_vector(fp, "0x6FDD1CA0", "DRLGLOGIC_AllocAndBuildRoomCoordList113c", c, note, args, 0u, 0u);
    }
  }

  /* F28: 0x6FD676F0 DRLGOUTPLACE_ApplyOutdoorVerticesToGrids113c */
  {
    fn_std1_void_t fn = (fn_std1_void_t)(usize)0x6FD676F0u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      u32 pLevel = heap_alloc(0x200);
      u32 pDrlg = heap_alloc(0x500);
      u32 pOutdoors = heap_alloc(0x280);
      u32 g1Cells = heap_alloc(25 * 4), g1Rows = heap_alloc(5 * 4);
      u32 g2Cells = heap_alloc(25 * 4), g2Rows = heap_alloc(5 * 4);
      for (u32 y = 0; y < 5u; y++) {
        *(u32 *)(usize)(g1Rows + y * 4u) = y * 5u;
        *(u32 *)(usize)(g2Rows + y * 4u) = y * 5u;
      }
      *(u32 *)(usize)(pOutdoors + 0x18) = g1Cells; *(u32 *)(usize)(pOutdoors + 0x1C) = g1Rows;
      *(u32 *)(usize)(pOutdoors + 0x24) = 5u;      *(u32 *)(usize)(pOutdoors + 0x28) = 5u;
      *(u32 *)(usize)(pOutdoors + 0x2C) = g2Cells; *(u32 *)(usize)(pOutdoors + 0x30) = g2Rows;
      *(u32 *)(usize)(pOutdoors + 0x38) = 5u;      *(u32 *)(usize)(pOutdoors + 0x3C) = 5u;
      *(u32 *)(usize)(pOutdoors + 0x5C) = 5u;      *(u32 *)(usize)(pOutdoors + 0x60) = 5u;
      *(u32 *)(usize)(pLevel + 0x14) = pOutdoors;
      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;

      u32 v0 = heap_alloc(0x14), v1 = heap_alloc(0x14);
      *(u32 *)(usize)(pOutdoors + 0x64) = v0;
      *(s32 *)(usize)(v0 + 0x00) = 0; *(s32 *)(usize)(v0 + 0x04) = 0;
      *(u8  *)(usize)(v0 + 0x08) = (c == 1) ? 1u : 0u;
      *(u32 *)(usize)(v0 + 0x0C) = (c == 0) ? 0u : 1u;
      *(u32 *)(usize)(v0 + 0x10) = v1;

      *(s32 *)(usize)(v1 + 0x00) = 0; *(s32 *)(usize)(v1 + 0x04) = 4;
      *(u8  *)(usize)(v1 + 0x08) = 0u;
      *(u32 *)(usize)(v1 + 0x0C) = (c == 2) ? 1u : 0u;
      *(u32 *)(usize)(v1 + 0x10) = v0;

      track_region(pLevel, 0x200); track_region(pDrlg, 0x500); track_region(pOutdoors, 0x280);
      track_region(g1Cells, 100u); track_region(g1Rows, 20u);
      track_region(g2Cells, 100u); track_region(g2Rows, 20u);
      track_region(v0, 0x14); track_region(v1, 0x14);
      snapshot_pre();
      fn(pLevel);
      snprintf(note, sizeof(note), "f28_apply_verts_c%d", c);
      snprintf(args, sizeof(args), "[%u]", pLevel);
      emit_vector(fp, "0x6FD676F0", "DRLGOUTPLACE_ApplyOutdoorVerticesToGrids113c", c, note, args, 0u, 0u);
    }
  }

  /* F29: 0x6FD5F000 DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c */
  {
    fn_std3_u32_t fn = (fn_std3_u32_t)(usize)0x6FD5F000u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      u32 pLevel = heap_alloc(0x200);
      u32 pDrlg = heap_alloc(0x500);
      u32 pMaze = heap_alloc(0x40);
      u32 pBase = heap_alloc(0xEC);
      u32 pBasePreset = heap_alloc(0x100);
      u32 pBlocker = heap_alloc(0xEC);
      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32 *)(usize)(pLevel + 0x14) = pMaze;
      *(u32 *)(usize)(pLevel + 0x1C0) = 3u;
      *(u32 *)(usize)(pMaze + 0x10) = 10u;
      *(u32 *)(usize)(pMaze + 0x14) = 10u;
      *(s32 *)(usize)(pMaze + 0x18) = 1000;
      *(u32 *)(usize)(pBase + 0x58) = pLevel;
      *(u32 *)(usize)(pBase + 0x20) = pBasePreset;
      *(s32 *)(usize)(pBase + 0x34) = 100; *(s32 *)(usize)(pBase + 0x38) = 100;
      *(s32 *)(usize)(pBase + 0x3C) = 10;  *(s32 *)(usize)(pBase + 0x40) = 10;
      *(u32 *)(usize)(pLevel + 0x10) = pBase;
      *(u32 *)(usize)(pLevel + 0x08) = 1u;
      if (c == 0) {
        /* Place blocker at dir=2 (110,100) so separation fails and new room is freed */
        *(u32 *)(usize)(pBase + 0x24) = pBlocker;
        *(s32 *)(usize)(pBlocker + 0x34) = 110; *(s32 *)(usize)(pBlocker + 0x38) = 100;
        *(s32 *)(usize)(pBlocker + 0x3C) = 10;  *(s32 *)(usize)(pBlocker + 0x40) = 10;
        *(u32 *)(usize)(pLevel + 0x08) = 2u;
      }
      u32 bLink = (c == 2) ? 1u : 0u;
      track_region(pLevel, 0x200); track_region(pDrlg, 0x500);
      track_region(pMaze, 0x40); track_region(pBase, 0xEC);
      track_region(pBasePreset, 0x100); track_region(pBlocker, 0xEC);
      snapshot_pre();
      u32 ret = fn(pBase, 2u, bLink);
      snprintf(note, sizeof(note), "f29_spawn_adj_c%d", c);
      snprintf(args, sizeof(args), "[%u,2,%u]", pBase, bLink);
      emit_vector(fp, "0x6FD5F000", "DRLGMAZE_SpawnAndLinkAdjacentRoomEx113c", c, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F30: 0x6FD605C0 DRLGMAZE_SpawnAdjacentSpecialPresetRoom113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 pLevel = heap_alloc(0x200);
    u32 pDrlg = heap_alloc(0x500);
    u32 pMaze = heap_alloc(0x40);
    u32 r0 = heap_alloc(0xEC), r1 = heap_alloc(0xEC);
    u32 pr0 = heap_alloc(0x100), pr1 = heap_alloc(0x100);
    *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32 *)(usize)(pLevel + 0x14) = pMaze;
    *(u32 *)(usize)(pLevel + 0x1C0) = 3u;
    *(u32 *)(usize)(pMaze + 0x10) = 10u;
    *(u32 *)(usize)(pMaze + 0x14) = 10u;
    *(u32 *)(usize)(r0 + 0x58) = pLevel; *(u32 *)(usize)(r0 + 0x20) = pr0;
    *(u32 *)(usize)(r1 + 0x58) = pLevel; *(u32 *)(usize)(r1 + 0x20) = pr1;
    *(s32 *)(usize)(r0 + 0x34) = 100; *(s32 *)(usize)(r0 + 0x38) = 100;
    *(s32 *)(usize)(r0 + 0x3C) = 10;  *(s32 *)(usize)(r0 + 0x40) = 10;
    *(s32 *)(usize)(r1 + 0x34) = 110; *(s32 *)(usize)(r1 + 0x38) = 100;
    *(s32 *)(usize)(r1 + 0x3C) = 10;  *(s32 *)(usize)(r1 + 0x40) = 10;
    *(u32 *)(usize)(pLevel + 0x10) = (c == 0) ? 0u : r0;
    *(u32 *)(usize)(pLevel + 0x08) = (c == 0) ? 0u : 2u;
    *(u32 *)(usize)(r0 + 0x24) = r1;
    if (c == 1) *(u32 *)(usize)(pr0 + 0x0C) = 0x02u; /* skip r0 (preset), succeed on r1 */
    if (c == 2) { *(u32 *)(usize)(pr0 + 0x0C) = 0x02u; *(u32 *)(usize)(pr1 + 0x0C) = 0x02u; } /* none */
    /* c == 3: r0 collides at dir=2 with r1, frees and moves to r1 which succeeds */
    track_region(pLevel, 0x200); track_region(pDrlg, 0x500);
    track_region(pMaze, 0x40); track_region(r0, 0xEC); track_region(r1, 0xEC);
    track_region(pr0, 0x100); track_region(pr1, 0x100);
    snapshot_pre();
    u32 ret = call_eax_stk3_u32(0x6FD605C0u, pLevel, 2u, 0x123u, 1u);
    snprintf(note, sizeof(note), "f30_spawn_spec_c%d", c);
    snprintf(args, sizeof(args), "[%u,2,291,1]", pLevel);
    emit_vector(fp, "0x6FD605C0", "DRLGMAZE_SpawnAdjacentSpecialPresetRoom113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* F31: 0x6FDD59F0 DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c */
  {
    const u32 lvls[5] = { 41u, 42u, 43u, 44u, 45u };
    for (int c = 0; c < 5; c++) {
      reset_heap();
      u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
      setup_outdoors_level(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 5u, 5u, 420u);
      *pSgpt = dt;
      *pPrestGlobal = prestTbl;
      *(u32 *)(usize)(pLevel + 0x1D0) = lvls[c];
      const u32 pids[5] = { 0x184u, 0x184u, 0x186u, 0x19Cu, 0x185u };
      u32 pid = pids[c];
      *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x00) = pid;
      *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x28) = 8u;
      *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x2C) = 8u;
      *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x40) = 1u;
      track_region(0x6FDE9E1Cu, 4u);
      track_region(0x6FDF0B3Cu, 4u);
      snapshot_pre();
      call_eax_void(0x6FDD59F0u, pLevel);
      snprintf(note, sizeof(note), "f31_spider_preset_c%d", c);
      snprintf(args, sizeof(args), "[%u]", pLevel);
      emit_vector(fp, "0x6FDD59F0", "DRLGOUTJUNG_SpawnSpiderForestSpecialPreset113c", c, note, args, 0u, 0u);
    }
    *pSgpt = savedSgpt;
    *pPrestGlobal = savedPrest;
  }

  /* F32: 0x6FDD5A80 DRLGOUTJUNG_PlaceShuffledPresetList113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, 6u, 6u, 10u);
    *pSgpt = dt;
    *pPrestGlobal = prestTbl;
    for (u32 pid = 1u; pid <= 3u; pid++) {
      *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x00) = pid;
      *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x28) = 8u;
      *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x2C) = 8u;
      *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x40) = 2u;
    }
    u32 pIds = heap_alloc(12u);
    *(u32 *)(usize)(pIds + 0u) = 1u;
    *(u32 *)(usize)(pIds + 4u) = 2u;
    *(u32 *)(usize)(pIds + 8u) = 3u;
    u32 nCount = (c == 0) ? 0u : (c == 3) ? 2u : 3u;
    u32 bAll = (c == 2 || c == 3) ? 1u : 0u;
    if (bAll != 0) {
      track_region(0x6FDE9E1Cu, 4u);
      track_region(0x6FDF0B3Cu, 4u);
    } else if (nCount > 0u) {
      track_region(0x6FDE9E1Cu, 4u);
      track_region(0x6FDF0B3Cu, 4u);
    }
    track_region(pIds, 12u);
    snapshot_pre();
    call_eax_stk3_void(0x6FDD5A80u, pLevel, pIds, nCount, bAll);
    snprintf(note, sizeof(note), "f32_shuffled_presets_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pLevel, pIds, nCount, bAll);
    emit_vector(fp, "0x6FDD5A80", "DRLGOUTJUNG_PlaceShuffledPresetList113c", c, note, args, 0u, 0u);
  }
  *pSgpt = savedSgpt;
  *pPrestGlobal = savedPrest;
}

static void emit_i12c_2(FILE *fp) {
  emit_i12c_2_path(fp);
  emit_i12c_2_drlg(fp);
}

int main(int argc, char **argv) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  const char *out1 = (argc > 1) ? argv[1] : "tests/fixtures/oracle/k1/i12c-1-vectors.ndjson";
  const char *out2 = (argc > 2) ? argv[2] : "tests/fixtures/oracle/k1/i12c-2-vectors.ndjson";

  const char *d2_dir = getenv("D2_DATA_DIR");
  if (d2_dir && d2_dir[0]) SetDllDirectoryA(d2_dir);
  else SetDllDirectoryA("samples/d2");

  HMODULE hDll = LoadLibraryA("D2Common.dll");
  if (!hDll && d2_dir && d2_dir[0]) {
    char fullPath[512];
    snprintf(fullPath, sizeof(fullPath), "%s/D2Common.dll", d2_dir);
    hDll = LoadLibraryA(fullPath);
  }
  if (!hDll) hDll = LoadLibraryA("samples/d2/D2Common.dll");
  if (!hDll || (usize)hDll != EXPECTED_BASE) {
    fprintf(stderr, "Failed to load D2Common.dll at 0x6FD50000 (got %p)\n", (void *)hDll);
    return 2;
  }

  g_arena = (u8 *)VirtualAlloc((void *)(usize)ARENA_ADDR, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  g_heap  = (u8 *)VirtualAlloc((void *)(usize)HEAP_ADDR,  HEAP_SIZE,  MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  if (!g_arena || !g_heap) return 3;

  DWORD oldProt = 0;
  VirtualProtect((LPVOID)(usize)0x6FDD9000u, 0x1000u, PAGE_EXECUTE_READWRITE, &oldProt);
  VirtualProtect((LPVOID)(usize)0x6FDE9000u, 0x9000u, PAGE_EXECUTE_READWRITE, &oldProt);
  *(u32 *)(usize)0x6FDD90A8u = (u32)(usize)&stub_fog_10046;
  *(u32 *)(usize)0x6FDD90ACu = (u32)(usize)&stub_fog_10045;
  *(u32 *)(usize)0x6FDD90CCu = (u32)(usize)&stub_fog_10046;
  *(u32 *)(usize)0x6FDD90D0u = (u32)(usize)&stub_fog_10045;

  FILE *fp1 = fopen(out1, "wb");
  if (!fp1) return 4;
  emit_i12c_1(fp1);
  fclose(fp1);

  FILE *fp2 = fopen(out2, "wb");
  if (!fp2) return 5;
  emit_i12c_2(fp2);
  fclose(fp2);

  return 0;
}
