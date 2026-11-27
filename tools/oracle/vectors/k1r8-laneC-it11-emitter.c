/*
 * k1r8-laneC-it11-emitter.c
 *
 * 32-bit MinGW executable that loads the real D2Common.dll v1.13c at its
 * preferred image base 0x6FD50000 (along with Fog.dll and D2CMP.dll) under Wine
 * and emits differential test vectors (NDJSON) for Lane C Iteration 11:
 *   - I11C-1 (17 functions: F01..F17) -> i11c-1-vectors.ndjson
 *   - I11C-2 ( 9 functions: F18..F26) -> i11c-2-vectors.ndjson
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
#define RVA(addr)     ((void *)(usize)(addr))
#define ARENA_ADDR    0x10000000u
#define ARENA_SIZE    0x00400000u
#define HEAP_ADDR     0x40000000u
#define HEAP_SIZE     0x00080000u

static u8 *g_arena = NULL;
static u8 *g_heap = NULL;
static u32 g_arena_off = 0;
static u32 g_heap_off = 0;
static u32 g_frees[64];
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
  if (ptr != 0u && g_num_frees < 64) g_frees[g_num_frees++] = ptr;
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

/* Standard stdcall and fastcall function pointer typedefs */
typedef u32  (__stdcall *fn_std1_u32_t)(u32);
typedef u32  (__stdcall *fn_std3_u32_t)(u32, u32, u32);
typedef u32  (__stdcall *fn_std6_u32_t)(u32, u32, u32, u32, u32, u32);
typedef u32  (__stdcall *fn_std7_u32_t)(u32, u32, u32, u32, u32, u32, u32);
typedef u32  (__attribute__((fastcall)) *fn_fast1_u32_t)(u32);
typedef void (__attribute__((fastcall)) *fn_fast1_void_t)(u32);

/* Register-only custom ABI wrappers */
static __attribute__((noinline)) u32 call_eax_u32(u32 fn, u32 a_eax) {
  u32 out;
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "=a"(out), "+c"(fn)
    : "a"(a_eax)
    : "edx", "ebx", "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_ebx_u32(u32 fn, u32 a_ebx) {
  u32 out;
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "=a"(out), "+b"(a_ebx), "+c"(fn)
    :
    : "edx", "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_eax_edi_u32(u32 fn, u32 a_eax, u32 a_edi) {
  u32 out;
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "=a"(out), "+D"(a_edi), "+c"(fn)
    : "a"(a_eax)
    : "edx", "ebx", "esi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_edx_stk1_u32(u32 fn, u32 a_edx, u32 s1) {
  u32 out;
  __asm__ volatile(
    "pushl %%esi\n\t"
    "call *%%ecx\n\t"
    : "=a"(out), "+d"(a_edx), "+c"(fn), "+S"(s1)
    :
    : "ebx", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) void call_edi_void(u32 fn, u32 a_edi) {
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "+D"(a_edi), "+c"(fn)
    :
    : "eax", "edx", "ebx", "esi", "memory", "cc"
  );
}

static __attribute__((noinline)) void call_esi_void(u32 fn, u32 a_esi) {
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "+S"(a_esi), "+c"(fn)
    :
    : "eax", "edx", "ebx", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) void call_eax_stk3_void(
  u32 fn, u32 a_eax, u32 s1, u32 s2, u32 s3
) {
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

static __attribute__((noinline)) u32 call_eax_stk5_u32(
  u32 fn, u32 a_eax, u32 s1, u32 s2, u32 s3, u32 s4, u32 s5
) {
  u32 pack[6] = { fn, s1, s2, s3, s4, s5 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 20(%%edx)\n\t"
    "pushl 16(%%edx)\n\t"
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

/* 3x3 active room collision world (each room 10x10 subtiles, center r[4] at [100..110, 100..110)) */
typedef struct {
  u32 r[9];
  u32 g[9];
  u32 m[9];
  u32 nearArr[9];
  u32 rNoGrid;
  u32 actFlag;
} CollWorld;

static void build_coll_world(CollWorld *w, int link_neighbors) {
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
    if (link_neighbors) {
      *(u32 *)(usize)(w->r[i] + 0x24) = 9u;
      for (int j = 0; j < 9; j++) {
        *(u32 *)(usize)(w->nearArr[i] + (u32)(j * 4)) = w->r[j];
      }
    } else {
      *(u32 *)(usize)(w->r[i] + 0x24) = 1u;
      *(u32 *)(usize)(w->nearArr[i] + 0) = w->r[i];
    }
    track_region(w->r[i], 0x80);
    track_region(w->g[i], 0x28);
    track_region(w->m[i], 200);
    track_region(w->nearArr[i], 9 * 4);
  }
  w->rNoGrid = heap_alloc(0x80);
  *(s32 *)(usize)(w->rNoGrid + 0x4C) = 200;
  *(s32 *)(usize)(w->rNoGrid + 0x50) = 200;
  *(s32 *)(usize)(w->rNoGrid + 0x54) = 10;
  *(s32 *)(usize)(w->rNoGrid + 0x58) = 10;
  track_region(w->rNoGrid, 0x80);
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

static void init_grid(u32 gAddr, u32 cellsAddr, u32 rowOffAddr, int w, int h) {
  *(u32 *)(usize)(gAddr + 0x00) = cellsAddr;
  *(u32 *)(usize)(gAddr + 0x04) = rowOffAddr;
  *(u32 *)(usize)(gAddr + 0x08) = (u32)w;
  *(u32 *)(usize)(gAddr + 0x0C) = (u32)h;
  *(u32 *)(usize)(gAddr + 0x10) = 1u;
  for (int y = 0; y < h; y++) {
    *(u32 *)(usize)(rowOffAddr + (u32)(y * 4)) = (u32)(y * w);
  }
}


static void emit_i11c_1(FILE *fp) {
  char args[128];
  char note[64];

  /* F01: 0x6FD68830 PATH_WallFollow_StepBidirectional113c (stdcall 7 args, ret 0x1C) */
  {
    fn_std7_u32_t fn = (fn_std7_u32_t)RVA(0x6FD68830u);
    for (int v = 0; v < 6; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pInfo = heap_alloc(0x40);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x80);
      u32 pPts  = heap_alloc(0x200);
      u32 pCur  = heap_alloc(0x10);
      u32 pTot  = heap_alloc(0x10);

      *(u32 *)(usize)(pUnit + 0x00) = 0u;
      *(u32 *)(usize)(pUnit + 0x2C) = pPath;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (104u << 16);
      *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (104u << 16);
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u32 *)(usize)(pPath + 0x34) = 0u;
      *(u32 *)(usize)(pPath + 0x44) = 1u;
      *(u8  *)(usize)(pPath + 0x91) = 40u;

      *(u16 *)(usize)(pInfo + 0x00) = 104u;
      *(u16 *)(usize)(pInfo + 0x02) = 104u;
      *(u16 *)(usize)(pInfo + 0x04) = 107u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x0C) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x10) = 1u;
      *(u32 *)(usize)(pInfo + 0x18) = 40u;
      *(u32 *)(usize)(pInfo + 0x28) = 0u;
      *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
      *(u32 *)(usize)(pInfo + 0x30) = pPath;

      u32 startPt = (104u | (104u << 16));
      u32 maxBudget = 24u;
      u32 lineDir = 1u; /* +X (East) */
      *(u32 *)(usize)pCur = 0u;
      *(u32 *)(usize)pTot = 4u;
      *(u32 *)(usize)(pPts + 0u)  = (105u | (104u << 16));
      *(u32 *)(usize)(pPts + 4u)  = (106u | (104u << 16));
      *(u32 *)(usize)(pPts + 8u)  = (107u | (104u << 16));
      *(u32 *)(usize)(pPts + 12u) = (108u | (104u << 16));

      if (v == 0) {
        /* splice around single obstacle at (105,104) -> rejoins (106,104) */
        set_world_cell(&w, 105, 104, 1u);
      } else if (v == 1) {
        /* block (105,104) and (105,103) -> probes other side */
        set_world_cell(&w, 105, 104, 1u);
        set_world_cell(&w, 105, 103, 1u);
        set_world_cell(&w, 106, 104, 1u);
      } else if (v == 2) {
        /* lineDir = 7 (diagonal/non-cardinal), skips splice check */
        set_world_cell(&w, 105, 104, 1u);
        set_world_cell(&w, 105, 105, 1u);
        lineDir = 7u;
        maxBudget = 6u;
      } else if (v == 3) {
        /* South direction (lineDir = 2), budget truncates */
        lineDir = 2u;
        maxBudget = 4u;
        *(u32 *)(usize)(pPts + 0u)  = (104u | (105u << 16));
        *(u32 *)(usize)(pPts + 4u)  = (104u | (106u << 16));
        *(u32 *)(usize)(pPts + 8u)  = (104u | (107u << 16));
        *(u32 *)(usize)(pPts + 12u) = (104u | (108u << 16));
        set_world_cell(&w, 104, 105, 1u);
        set_world_cell(&w, 104, 106, 1u);
      } else if (v == 4) {
        /* completely boxed in around (104,104) -> bestMov == 0 -> returns 0 */
        for (int dy = -1; dy <= 1; dy++)
          for (int dx = -1; dx <= 1; dx++)
            if (dx != 0 || dy != 0) set_world_cell(&w, 104 + dx, 104 + dy, 1u);
      } else if (v == 5) {
        /* dwUnitSize=2, pat=1, non-zero pCur=1 */
        *(u32 *)(usize)(pInfo + 0x10) = 2u;
        *(u32 *)(usize)(pInfo + 0x28) = 1u;
        startPt = (105u | (104u << 16));
        *(u32 *)(usize)pCur = 1u;
        set_world_cell(&w, 106, 104, 1u);
      }

      track_region(0x6FDE5098u, 256u);
      track_region(0x6FDE5198u, 36u);
      track_region(pInfo, 0x40);
      track_region(pPath, 0x200);
      track_region(pUnit, 0x80);
      track_region(pPts, 0x200);
      track_region(pCur, 0x10);
      track_region(pTot, 0x10);
      snapshot_pre();
      u32 ret = fn(pInfo, startPt, pPts, pCur, pTot, maxBudget, lineDir);
      snprintf(note, sizeof(note), "wf_step_bidir_v%d", v);
      snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u,%u]",
        pInfo, startPt, pPts, pCur, pTot, maxBudget, lineDir);
      emit_vector(fp, "0x6FD68830", "PATH_WallFollow_StepBidirectional113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F02: 0x6FD85E00 PATH_FindValidTargetPosition113c (eax = pInfo) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pInfo = heap_alloc(0x40);
    u32 pPath = heap_alloc(0x200);
    u32 pUnit = heap_alloc(0x80);
    *(u32 *)(usize)(pUnit + 0x00) = 0u;
    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
    *(u16 *)(usize)(pInfo + 0x00) = 102u;
    *(u16 *)(usize)(pInfo + 0x02) = 104u;
    *(u16 *)(usize)(pInfo + 0x04) = 107u;
    *(u16 *)(usize)(pInfo + 0x06) = 104u;
    *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
    *(u32 *)(usize)(pInfo + 0x0C) = w.r[4];
    *(u32 *)(usize)(pInfo + 0x10) = 1u;
    *(u32 *)(usize)(pInfo + 0x28) = 0u;
    *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
    *(u32 *)(usize)(pInfo + 0x30) = pPath;

    if (v == 1) {
      set_world_cell(&w, 107, 104, 1u);
    } else if (v == 2) {
      *(u16 *)(usize)(pInfo + 0x04) = 106u;
      *(u16 *)(usize)(pInfo + 0x06) = 108u;
      set_world_cell(&w, 106, 108, 1u);
      set_world_cell(&w, 105, 107, 1u);
    } else if (v == 3) {
      for (s32 x = 102; x <= 107; x++)
        for (s32 y = 102; y <= 106; y++)
          set_world_cell(&w, x, y, 1u);
    } else if (v == 4) {
      *(u16 *)(usize)(pInfo + 0x04) = 102u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      set_world_cell(&w, 102, 104, 1u);
    } else if (v == 5) {
      *(u16 *)(usize)(pInfo + 0x04) = 112u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      set_world_cell(&w, 112, 104, 1u);
      *(u32 *)(usize)(pInfo + 0x0C) = w.r[5];
    }

    track_region(0x6FDDC450u, 76u);
    track_region(pInfo, 0x40);
    track_region(pPath, 0x200);
    track_region(pUnit, 0x80);
    snapshot_pre();
    u32 ret = call_eax_u32(0x6FD85E00u, pInfo);
    snprintf(note, sizeof(note), "find_valid_target_v%d", v);
    snprintf(args, sizeof(args), "[%u]", pInfo);
    emit_vector(fp, "0x6FD85E00", "PATH_FindValidTargetPosition113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F03: 0x6FD86030 PATH_AllocDynamicPath113c (stdcall 6 args, ret 0x18) */
  {
    fn_std6_u32_t fn = (fn_std6_u32_t)RVA(0x6FD86030u);
    u32 *pSgpt = (u32 *)RVA(0x6FDE9E1Cu);
    u32 savedSgpt = *pSgpt;
    u32 pBitMasks = *(u32 *)RVA(0x6FDD90B0u);
    for (int v = 0; v < 8; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 dt = heap_alloc(0x1000);
      u32 monTbl = heap_alloc(16u * 424u);
      u32 mon2Tbl = heap_alloc(16u * 308u);
      u32 pRoom = (v == 7) ? 0u : w.r[4];
      u32 pUnit = heap_alloc(0x100);
      u32 pObjData = heap_alloc(0x20);
      u32 pObjTxt = heap_alloc(0x180);

      *pSgpt = dt;
      *(u32 *)(usize)(dt + 0xA78u) = monTbl;
      *(u32 *)(usize)(dt + 0xA80u) = 16u;
      *(u32 *)(usize)(dt + 0xA90u) = mon2Tbl;
      *(u32 *)(usize)(dt + 0xA98u) = 16u;

      /* mon 1: normal mon, sizeX=2 */
      *(u16 *)(usize)(monTbl + 1u * 424u + 0x02u) = 1u;
      *(u16 *)(usize)(monTbl + 1u * 424u + 0x18u) = 1u;
      *(u8  *)(usize)(mon2Tbl + 1u * 308u + 0x08u) = 2u;
      /* mon 2: wBaseId=0x26 (38), sizeX=3 */
      *(u16 *)(usize)(monTbl + 2u * 424u + 0x02u) = 0x26u;
      *(u16 *)(usize)(monTbl + 2u * 424u + 0x18u) = 2u;
      *(u8  *)(usize)(mon2Tbl + 2u * 308u + 0x08u) = 3u;
      /* mon 3: bf2 flying bit (+0x18 in gdwBitMasks) */
      *(u16 *)(usize)(monTbl + 3u * 424u + 0x02u) = 3u;
      *(u16 *)(usize)(monTbl + 3u * 424u + 0x18u) = 3u;
      *(u8  *)(usize)(monTbl + 3u * 424u + 0x0Du) = *(u8 *)(usize)(pBitMasks + 0x18u);
      *(u8  *)(usize)(mon2Tbl + 3u * 308u + 0x08u) = 1u;
      /* mon 4: bf1 door-open bit (+0x0C in gdwBitMasks) */
      *(u16 *)(usize)(monTbl + 4u * 424u + 0x02u) = 4u;
      *(u16 *)(usize)(monTbl + 4u * 424u + 0x18u) = 4u;
      *(u8  *)(usize)(monTbl + 4u * 424u + 0x0Cu) = *(u8 *)(usize)(pBitMasks + 0x0Cu);
      *(u8  *)(usize)(mon2Tbl + 4u * 308u + 0x08u) = 1u;

      /* mon 5: wBaseId=0x26, sizeX=1, bSetFlag10=0 */
      *(u16 *)(usize)(monTbl + 5u * 424u + 0x02u) = 0x26u;
      *(u16 *)(usize)(monTbl + 5u * 424u + 0x18u) = 5u;
      *(u8  *)(usize)(mon2Tbl + 5u * 308u + 0x08u) = 1u;

      *(u32 *)(usize)pObjData = pObjTxt;
      *(u32 *)(usize)(pObjTxt + 0xD0u) = 3u;

      u32 bSetFlag10 = 1u;
      if (v == 0) {
        *(u32 *)(usize)(pUnit + 0x00) = 0u; /* player */
      } else if (v == 1) {
        *(u32 *)(usize)(pUnit + 0x00) = 0u; /* player, flag=0 */
        bSetFlag10 = 0u;
      } else if (v == 2) {
        *(u32 *)(usize)(pUnit + 0x00) = 1u;
        *(u32 *)(usize)(pUnit + 0x04) = 1u;
      } else if (v == 3) {
        *(u32 *)(usize)(pUnit + 0x00) = 1u;
        *(u32 *)(usize)(pUnit + 0x04) = 2u;
      } else if (v == 4) {
        *(u32 *)(usize)(pUnit + 0x00) = 1u;
        *(u32 *)(usize)(pUnit + 0x04) = 3u;
      } else if (v == 5) {
        *(u32 *)(usize)(pUnit + 0x00) = 1u;
        *(u32 *)(usize)(pUnit + 0x04) = 4u;
      } else if (v == 6) {
        *(u32 *)(usize)(pUnit + 0x00) = 1u;
        *(u32 *)(usize)(pUnit + 0x04) = 5u;
        bSetFlag10 = 0u;
      } else {
        *(u32 *)(usize)(pUnit + 0x00) = 2u; /* object, pRoom=0 */
        *(u32 *)(usize)(pUnit + 0x14) = pObjData;
      }

      track_region(0x6FDE9E1Cu, 4u);
      track_region(0x6FDD90B0u, 4u);
      track_region(pBitMasks, 32u);
      track_region(0x6FDE4138u, 72u);
      track_region(0x6FDE4180u, 72u);
      track_region(dt, 0x1000);
      track_region(monTbl, 16u * 424u);
      track_region(mon2Tbl, 16u * 308u);
      track_region(pUnit, 0x100);
      track_region(pObjData, 0x20);
      track_region(pObjTxt, 0x180);
      snapshot_pre();
      u32 ret = fn(0u, pRoom, 104u, 105u, pUnit, bSetFlag10);
      snprintf(note, sizeof(note), "alloc_dynamic_path_v%d", v);
      snprintf(args, sizeof(args), "[0,%u,104,105,%u,%u]", pRoom, pUnit, bSetFlag10);
      emit_vector(fp, "0x6FD86030", "PATH_AllocDynamicPath113c", v, note, args, ret, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
  }

  /* F04: 0x6FDB7390 PATH_ComputeKnockbackServer113c (ecx = pInfo) */
  {
    fn_fast1_u32_t fn = (fn_fast1_u32_t)RVA(0x6FDB7390u);
    for (int v = 0; v < 6; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pInfo = heap_alloc(0x40);
      u32 pPath = heap_alloc(0x200);
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u16 *)(usize)(pInfo + 0x00) = 104u;
      *(u16 *)(usize)(pInfo + 0x02) = 104u;
      *(u16 *)(usize)(pInfo + 0x04) = 107u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x10) = 1u;
      *(u32 *)(usize)(pInfo + 0x18) = 10u;
      *(u32 *)(usize)(pInfo + 0x28) = 0u;
      *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
      *(u32 *)(usize)(pInfo + 0x30) = pPath;

      if (v == 1) {
        set_world_cell(&w, 105, 104, 1u);
      } else if (v == 2) {
        set_world_cell(&w, 106, 104, 1u);
      } else if (v == 3) {
        *(u16 *)(usize)(pInfo + 0x04) = 107u;
        *(u16 *)(usize)(pInfo + 0x06) = 107u;
      } else if (v == 4) {
        *(u16 *)(usize)(pInfo + 0x04) = 104u;
        *(u16 *)(usize)(pInfo + 0x06) = 104u;
      } else if (v == 5) {
        *(u32 *)(usize)(pInfo + 0x10) = 2u;
        *(u32 *)(usize)(pInfo + 0x28) = 1u;
        *(u32 *)(usize)(pInfo + 0x18) = 2u;
      }

      track_region(0x6FDDC320u, 300u);
      track_region(pInfo, 0x40);
      track_region(pPath, 0x200);
      snapshot_pre();
      u32 ret = fn(pInfo);
      snprintf(note, sizeof(note), "knockback_server_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pInfo);
      emit_vector(fp, "0x6FDB7390", "PATH_ComputeKnockbackServer113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F05: 0x6FDB74C0 PATH_RebuildTurnCornersWithDirOffset113c (ebx = pInfo) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pInfo = heap_alloc(0x40);
    u32 pPath = heap_alloc(0x200);
    u32 pUnit = heap_alloc(0x80);
    *(u32 *)(usize)(pUnit + 0x00) = 0u;
    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
    *(u16 *)(usize)(pInfo + 0x00) = 104u;
    *(u16 *)(usize)(pInfo + 0x02) = 104u;
    *(u16 *)(usize)(pInfo + 0x04) = 108u;
    *(u16 *)(usize)(pInfo + 0x06) = 104u;
    *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
    *(u32 *)(usize)(pInfo + 0x10) = 1u;
    *(u32 *)(usize)(pInfo + 0x18) = 12u;
    *(u32 *)(usize)(pInfo + 0x28) = 0u;
    *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
    *(u32 *)(usize)(pInfo + 0x30) = pPath;
    *(s32 *)(usize)(pPath + 0x98) = 0;

    if (v == 1) {
      *(s32 *)(usize)(pPath + 0x98) = 1;
    } else if (v == 2) {
      *(s32 *)(usize)(pPath + 0x98) = -1;
    } else if (v == 3) {
      set_world_cell(&w, 105, 104, 1u);
      *(u16 *)(usize)(pInfo + 0x04) = 107u;
      *(u16 *)(usize)(pInfo + 0x06) = 105u;
    } else if (v == 4) {
      *(u32 *)(usize)(pInfo + 0x18) = 2u;
    } else if (v == 5) {
      for (int dy = -1; dy <= 1; dy++)
        for (int dx = -1; dx <= 1; dx++)
          if (dx != 0 || dy != 0) set_world_cell(&w, 104 + dx, 104 + dy, 1u);
    }

    track_region(0x6FDDC320u, 300u);
    track_region(pInfo, 0x40);
    track_region(pPath, 0x200);
    track_region(pUnit, 0x80);
    snapshot_pre();
    u32 ret = call_ebx_u32(0x6FDB74C0u, pInfo);
    snprintf(note, sizeof(note), "rebuild_turn_corners_v%d", v);
    snprintf(args, sizeof(args), "[%u]", pInfo);
    emit_vector(fp, "0x6FDB74C0", "PATH_RebuildTurnCornersWithDirOffset113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F06: 0x6FDB7630 PATH_RaycastVelocityAndCollide113c (eax = pPath, edi = pInOutTargetPoint) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pPath = heap_alloc(0x200);
    u32 pUnit = heap_alloc(0x80);
    u32 pTarget = heap_alloc(0x10);

    *(u32 *)(usize)(pUnit + 0x00) = (v == 5) ? 1u : 0u;
    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x3C) = 2u;
    *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
    *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (104u << 16);
    *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (104u << 16);
    *(u32 *)(usize)(pPath + 0x44) = 1u;
    *(u32 *)(usize)(pPath + 0x48) = 0u;
    *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
    *(u32 *)(usize)(pPath + 0x7C) = 0x10000u;

    *(u16 *)(usize)(pTarget + 0x00) = 107u;
    *(u16 *)(usize)(pTarget + 0x02) = 104u;

    if (v == 0) {
      *(u32 *)(usize)(pPath + 0x7C) = 0u;
    } else if (v == 2) {
      set_world_cell(&w, 105, 104, 1u);
    } else if (v == 3) {
      set_world_cell(&w, 106, 104, 1u);
    } else if (v == 4) {
      *(u16 *)(usize)(pTarget + 0x00) = 101u;
      *(u16 *)(usize)(pTarget + 0x02) = 102u;
    } else if (v == 5) {
      *(u32 *)(usize)(pPath + 0x7C) = 0x20000u;
      *(u16 *)(usize)(pTarget + 0x00) = 106u;
      *(u16 *)(usize)(pTarget + 0x02) = 106u;
    }

    track_region(pPath, 0x200);
    track_region(pUnit, 0x80);
    track_region(pTarget, 0x10);
    snapshot_pre();
    u32 ret = call_eax_edi_u32(0x6FDB7630u, pPath, pTarget);
    snprintf(note, sizeof(note), "raycast_vel_collide_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u]", pPath, pTarget);
    emit_vector(fp, "0x6FDB7630", "PATH_RaycastVelocityAndCollide113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F07: 0x6FDC0BB0 PATH_IdaStar_ComputeInRoomBounds113c (edx = pRect, [esp+4] = pInfo, ret 4) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pRect = heap_alloc(0x20);
    u32 pInfo = heap_alloc(0x40);
    u32 pPath = heap_alloc(0x200);
    u32 pUnit = heap_alloc(0x80);
    u32 pSeed = heap_alloc(0x10);

    *(u32 *)(usize)(pSeed + 0x00) = 0x12345678u;
    *(u32 *)(usize)(pSeed + 0x04) = 0x9ABCDEF0u;
    *(u32 *)(usize)(pUnit + 0x00) = 0u;
    *(u32 *)(usize)(pUnit + 0x20) = pSeed;
    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x1C) = w.r[4];

    *(s32 *)(usize)(pRect + 0x00) = 100;
    *(s32 *)(usize)(pRect + 0x04) = 100;
    *(s32 *)(usize)(pRect + 0x08) = 10;
    *(s32 *)(usize)(pRect + 0x0C) = 10;

    *(u16 *)(usize)(pInfo + 0x00) = 102u;
    *(u16 *)(usize)(pInfo + 0x02) = 104u;
    *(u16 *)(usize)(pInfo + 0x04) = 106u;
    *(u16 *)(usize)(pInfo + 0x06) = 104u;
    *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
    *(u32 *)(usize)(pInfo + 0x10) = 1u;
    *(u32 *)(usize)(pInfo + 0x18) = 40u;
    *(u8  *)(usize)(pInfo + 0x1C) = 40u;
    *(u32 *)(usize)(pInfo + 0x28) = 0u;
    *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
    *(u32 *)(usize)(pInfo + 0x30) = pPath;

    if (v == 1) {
      *(u16 *)(usize)(pInfo + 0x04) = 102u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
    } else if (v == 2) {
      set_world_cell(&w, 104, 103, 1u);
      set_world_cell(&w, 104, 104, 1u);
      set_world_cell(&w, 104, 105, 1u);
    } else if (v == 3) {
      for (s32 y = 100; y <= 109; y++) set_world_cell(&w, 105, y, 1u);
    } else if (v == 4) {
      set_world_cell(&w, 104, 103, 1u);
      set_world_cell(&w, 104, 104, 1u);
      set_world_cell(&w, 104, 105, 1u);
      *(u32 *)(usize)(pInfo + 0x18) = 2u;
      *(u8  *)(usize)(pInfo + 0x1C) = 2u;
    } else if (v == 5) {
      *(s32 *)(usize)(pRect + 0x08) = 20;
      *(u16 *)(usize)(pInfo + 0x04) = 112u;
      *(u16 *)(usize)(pInfo + 0x06) = 106u;
    }

    track_region(0x6FDDB860u, 256u);
    track_region(0x6FDDB960u, 128u);
    track_region(pRect, 0x20);
    track_region(pInfo, 0x40);
    track_region(pPath, 0x200);
    track_region(pUnit, 0x80);
    track_region(pSeed, 0x10);
    snapshot_pre();
    u32 ret = call_edx_stk1_u32(0x6FDC0BB0u, pRect, pInfo);
    snprintf(note, sizeof(note), "idastar_in_bounds_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u]", pRect, pInfo);
    emit_vector(fp, "0x6FDC0BB0", "PATH_IdaStar_ComputeInRoomBounds113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F08: 0x6FDCB630 PATH_AStar_ComputePath113c (ecx = pInfo) */
  {
    fn_fast1_u32_t fn = (fn_fast1_u32_t)RVA(0x6FDCB630u);
    for (int v = 0; v < 6; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pInfo = heap_alloc(0x40);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x80);
      u32 pTgt  = heap_alloc(0x80);

      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u32 *)(usize)(pPath + 0x58) = (v == 1) ? pTgt : 0u;
      *(u32 *)(usize)(pTgt + 0x00) = 1u;
      *(u32 *)(usize)(pTgt + 0x2C) = 0u;

      *(u16 *)(usize)(pInfo + 0x00) = 102u;
      *(u16 *)(usize)(pInfo + 0x02) = 104u;
      *(u16 *)(usize)(pInfo + 0x04) = 106u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x0C) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x10) = 1u;
      *(u32 *)(usize)(pInfo + 0x18) = 40u;
      *(u32 *)(usize)(pInfo + 0x28) = 0u;
      *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
      *(u32 *)(usize)(pInfo + 0x30) = pPath;

      if (v == 1) {
        /* unreachable target unit in F26 check */
        set_world_cell(&w, 106, 104, 1u);
      } else if (v == 2) {
        set_world_cell(&w, 104, 103, 1u);
        set_world_cell(&w, 104, 104, 1u);
        set_world_cell(&w, 104, 105, 1u);
      } else if (v == 3) {
        for (int dy = -1; dy <= 1; dy++)
          for (int dx = -1; dx <= 1; dx++)
            if (dx != 0 || dy != 0) set_world_cell(&w, 106 + dx, 104 + dy, 1u);
        set_world_cell(&w, 106, 104, 1u);
      } else if (v == 4) {
        *(u16 *)(usize)(pInfo + 0x04) = 111u;
        *(u16 *)(usize)(pInfo + 0x06) = 106u;
        *(u32 *)(usize)(pInfo + 0x0C) = w.r[5];
      } else if (v == 5) {
        *(u16 *)(usize)(pInfo + 0x04) = 102u;
        *(u16 *)(usize)(pInfo + 0x06) = 104u;
      }

      track_region(0x6FDDB458u, 0x400u);
      track_region(pInfo, 0x40);
      track_region(pPath, 0x200);
      track_region(pUnit, 0x80);
      track_region(pTgt, 0x80);
      snapshot_pre();
      u32 ret = fn(pInfo);
      snprintf(note, sizeof(note), "astar_compute_path_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pInfo);
      emit_vector(fp, "0x6FDCB630", "PATH_AStar_ComputePath113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F09: 0x6FD94F20 DRLGROOM_AllocAndInsertOrthNode113c (eax=pLevel, [esp+4]=ppHead, [esp+8]=nDir, [esp+C]=bPreset, ret 0xC) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    u32 pLevel = heap_alloc(0x200);
    u32 pDrlg = heap_alloc(0x480);
    u32 ppHead = heap_alloc(0x10);
    u32 n1 = heap_alloc(0x20);
    u32 n2 = heap_alloc(0x20);
    u32 box1 = heap_alloc(0x10);
    u32 box2 = heap_alloc(0x10);
    *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32 *)(usize)(pDrlg + 0x478) = 0xCAFEu;
    *(u32 *)(usize)(pLevel + 0x1C) = 10u;
    *(u32 *)(usize)(n1 + 0x10) = box1;
    *(u32 *)(usize)(n2 + 0x10) = box2;
    *(u32 *)(usize)(box1 + 0x00) = 20u;
    *(u32 *)(usize)(box1 + 0x04) = 20u;
    *(u32 *)(usize)(box2 + 0x00) = 30u;
    *(u32 *)(usize)(box2 + 0x04) = 30u;

    u32 dir = 0u, bPreset = 1u;
    if (v == 0) { dir = 0u; bPreset = 1u; }
    else if (v == 1) {
      *(u32 *)(usize)(n1 + 0x04) = 3u;
      *(u32 *)(usize)ppHead = n1;
      dir = 1u; bPreset = 0u;
    } else if (v == 2) {
      *(u32 *)(usize)(n1 + 0x04) = 1u;
      *(u32 *)(usize)(n1 + 0x14) = n2;
      *(u32 *)(usize)(n2 + 0x04) = 4u;
      *(u32 *)(usize)ppHead = n1;
      dir = 2u; bPreset = 1u;
    } else if (v == 3) {
      *(u32 *)(usize)(n1 + 0x04) = 1u;
      *(u32 *)(usize)ppHead = n1;
      dir = 5u; bPreset = 0u;
    } else if (v == 4) {
      *(u32 *)(usize)(n1 + 0x04) = 3u;
      *(u32 *)(usize)ppHead = n1;
      dir = 3u; bPreset = 1u;
    } else {
      dir = 7u; bPreset = 0u;
    }

    track_region(pLevel, 0x200);
    track_region(pDrlg + 0x478, 4u);
    track_region(ppHead, 0x10);
    track_region(n1, 0x20);
    track_region(n2, 0x20);
    track_region(box1, 0x10);
    track_region(box2, 0x10);
    snapshot_pre();
    call_eax_stk3_void(0x6FD94F20u, pLevel, ppHead, dir, bPreset);
    snprintf(note, sizeof(note), "alloc_insert_orth_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pLevel, ppHead, dir, bPreset);
    emit_vector(fp, "0x6FD94F20", "DRLGROOM_AllocAndInsertOrthNode113c", v, note, args, 0u, 0u);
  }

  /* F10: 0x6FDB8780 DRLGROOMTILE_FindAdjacentRoomTileGrid113c */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    u32 pRoom = heap_alloc(0x80);
    u32 pNear1 = heap_alloc(0x80);
    u32 pNear2 = heap_alloc(0x80);
    u32 ppNear = heap_alloc(0x20);
    u32 pGrid1 = heap_alloc(0x20);
    u32 pGrid2 = heap_alloc(0x20);
    u32 pLink1 = heap_alloc(0x20);
    u32 pLink2 = heap_alloc(0x20);
    u32 pTile1 = heap_alloc(0x40);
    u32 pTile2 = heap_alloc(0x40);
    u32 ppOut = heap_alloc(0x10);

    *(u32 *)(usize)(pRoom + 0x08) = ppNear;
    *(u32 *)(usize)(pRoom + 0x2C) = (v == 0) ? 0u : (v == 1) ? 1u : 3u;
    *(u32 *)(usize)(ppNear + 0x00) = pRoom;
    *(u32 *)(usize)(ppNear + 0x04) = pNear1;
    *(u32 *)(usize)(ppNear + 0x08) = pNear2;

    *(s32 *)(usize)(pNear1 + 0x34) = 10;
    *(s32 *)(usize)(pNear1 + 0x38) = 10;
    *(s32 *)(usize)(pNear1 + 0x3C) = 5;
    *(s32 *)(usize)(pNear1 + 0x40) = 5;
    *(u32 *)(usize)(pNear1 + 0x54) = pGrid1;
    *(u32 *)(usize)(pGrid1 + 0x00) = pLink1;
    *(u32 *)(usize)(pLink1 + 0x00) = 1u; /* bFloor */
    *(u32 *)(usize)(pLink1 + 0x04) = pTile1;
    *(u32 *)(usize)(pTile1 + 0x08) = 2u; /* nPosX */
    *(u32 *)(usize)(pTile1 + 0x0C) = 3u; /* nPosY */
    *(u32 *)(usize)(pTile1 + 0x1C) = 1u; /* nTileType */

    *(s32 *)(usize)(pNear2 + 0x34) = 10;
    *(s32 *)(usize)(pNear2 + 0x38) = 10;
    *(s32 *)(usize)(pNear2 + 0x3C) = 5;
    *(s32 *)(usize)(pNear2 + 0x40) = 5;
    *(u32 *)(usize)(pNear2 + 0x54) = pGrid2;
    *(u32 *)(usize)(pGrid2 + 0x00) = pLink2;
    *(u32 *)(usize)(pLink2 + 0x00) = 0u; /* wall */
    *(u32 *)(usize)(pLink2 + 0x04) = pTile2;
    *(u32 *)(usize)(pTile2 + 0x08) = 2u;
    *(u32 *)(usize)(pTile2 + 0x0C) = 3u;
    *(u32 *)(usize)(pTile2 + 0x1C) = 13u;

    u32 dwFlags = 0u, bFloor = 1u, nX = 12u, nY = 13u;
    if (v == 3) {
      bFloor = 0u;
    } else if (v == 4) {
      *(u32 *)(usize)(pTile1 + 0x1C) = 4u; /* skipped tileType 4 */
      *(u32 *)(usize)(pLink2 + 0x00) = 1u;
    } else if (v == 5) {
      dwFlags = (1u << 18) | 0x08000000u;
      *(u32 *)(usize)(pTile1 + 0x1C) = 13u;
      *(u32 *)(usize)(pTile1 + 0x14) = (2u << 14); /* layer 1 match */
    }
    *(u32 *)(usize)ppOut = 0xDEADBEEFu;

    track_region(pRoom, 0x80);
    track_region(pNear1, 0x80);
    track_region(pNear2, 0x80);
    track_region(ppNear, 0x20);
    track_region(pGrid1, 0x20);
    track_region(pGrid2, 0x20);
    track_region(pLink1, 0x20);
    track_region(pLink2, 0x20);
    track_region(pTile1, 0x40);
    track_region(pTile2, 0x40);
    track_region(ppOut, 0x10);
    snapshot_pre();
    u32 ret = call_eax_stk5_u32(0x6FDB8780u, dwFlags, pRoom, bFloor, nX, nY, ppOut);
    snprintf(note, sizeof(note), "find_adj_room_tile_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u]", dwFlags, pRoom, bFloor, nX, nY, ppOut);
    emit_vector(fp, "0x6FDB8780", "DRLGROOMTILE_FindAdjacentRoomTileGrid113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F11..F15: OutJung preset functions calling 0x6FD92A70 */
  {
    u32 *pSgpt = (u32 *)RVA(0x6FDE9E1Cu);
    u32 *pPrestPtr = (u32 *)RVA(0x6FDF0B3Cu);
    u32 savedSgpt = *pSgpt;
    u32 savedPrest = *pPrestPtr;

    /* F11: 0x6FDD58E0 DRLGOUTJUNG_SpawnLowerKurastPresets113c (edi = pLevel) */
    for (int v = 0; v < 4; v++) {
      reset_heap();
      u32 dt = heap_alloc(0x1000);
      u32 prestArr = heap_alloc(1000u * 0x1B0u);
      u32 pLevel = heap_alloc(0x200);
      u32 pOut = heap_alloc(0x300);
      u32 pDrlg = heap_alloc(0x480);
      u32 c04 = heap_alloc(16 * 16 * 4);
      u32 r04 = heap_alloc(16 * 4);
      u32 c2C = heap_alloc(16 * 16 * 4);
      u32 r2C = heap_alloc(16 * 4);

      *(u32 *)(usize)(dt + 0xC68u) = 1000u;
      *pSgpt = dt;
      *pPrestPtr = prestArr;
      *(u32 *)(usize)(pLevel + 0x14) = pOut;
      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32 *)(usize)(pLevel + 0x1C4) = 0x11111111u + (u32)v * 0x10001u;
      *(u32 *)(usize)(pLevel + 0x1C8) = 0x22222222u + (u32)v;
      init_grid(pOut + 0x04, c04, r04, 16, 16);
      init_grid(pOut + 0x2C, c2C, r2C, 16, 16);

      const u32 ids[10] = { 383u, 384u, 385u, 386u, 387u, 394u, 0u, 0u, 0u, 0u };
      for (int i = 0; i < 6; i++) {
        u32 id = ids[i];
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x00u) = id;
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x28u) = (v & 1) ? 16u : 8u;
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x2Cu) = (v & 2) ? 16u : 8u;
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x40u) = 4u;
        track_region(prestArr + id * 0x1B0u, 0x44u);
      }
      if (v >= 2) {
        u32 node0 = heap_alloc(0x10);
        *(u32 *)(usize)(node0 + 0x00) = 394u;
        *(u32 *)(usize)(node0 + 0x04) = 4u;
        *(u32 *)(usize)(node0 + 0x08) = (u32)(v - 1);
        *(u32 *)(usize)(pLevel + 0x1CC) = node0;
        track_region(node0, 0x10);
      }
      track_region(0x6FDE9E1Cu, 4u);
      track_region(0x6FDF0B3Cu, 4u);
      track_region(dt + 0xC60u, 0x10u);
      track_region(pLevel, 0x200);
      track_region(pOut, 0x80);
      track_region(pDrlg + 0x478u, 4u);
      track_region(c04, 16 * 16 * 4);
      track_region(r04, 16 * 4);
      track_region(c2C, 16 * 16 * 4);
      track_region(r2C, 16 * 4);
      snapshot_pre();
      call_edi_void(0x6FDD58E0u, pLevel);
      snprintf(note, sizeof(note), "spawn_lower_kurast_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pLevel);
      emit_vector(fp, "0x6FDD58E0", "DRLGOUTJUNG_SpawnLowerKurastPresets113c", v, note, args, 0u, 0u);
    }

    /* F12: 0x6FDD5930 DRLGOUTJUNG_SpawnKurastCausewayPresets113c (edi = pLevel) */
    for (int v = 0; v < 8; v++) {
      reset_heap();
      u32 dt = heap_alloc(0x1000);
      u32 prestArr = heap_alloc(1000u * 0x1B0u);
      u32 pLevel = heap_alloc(0x200);
      u32 pOut = heap_alloc(0x300);
      u32 pDrlg = heap_alloc(0x480);
      u32 c04 = heap_alloc(16 * 16 * 4);
      u32 r04 = heap_alloc(16 * 4);
      u32 c2C = heap_alloc(16 * 16 * 4);
      u32 r2C = heap_alloc(16 * 4);

      *(u32 *)(usize)(dt + 0xC68u) = 1000u;
      *pSgpt = dt;
      *pPrestPtr = prestArr;
      *(u32 *)(usize)(pLevel + 0x14) = pOut;
      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
      /* choose seed.lo so next seed.lo & 7 sweeps 0..7 */
      *(u32 *)(usize)(pLevel + 0x1C4) = 0x10000001u + (u32)v * 0x13579B11u;
      *(u32 *)(usize)(pLevel + 0x1C8) = 0x20000003u + (u32)v;
      init_grid(pOut + 0x04, c04, r04, 16, 16);
      init_grid(pOut + 0x2C, c2C, r2C, 16, 16);

      for (u32 id = 376u; id <= 382u; id++) {
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x00u) = id;
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x28u) = 8u;
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x2Cu) = 8u;
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x40u) = 4u;
        track_region(prestArr + id * 0x1B0u, 0x44u);
      }
      track_region(0x6FDE9E1Cu, 4u);
      track_region(0x6FDF0B3Cu, 4u);
      track_region(dt + 0xC60u, 0x10u);
      track_region(pLevel, 0x200);
      track_region(pOut, 0x80);
      track_region(pDrlg + 0x478u, 4u);
      track_region(c04, 16 * 16 * 4);
      track_region(r04, 16 * 4);
      track_region(c2C, 16 * 16 * 4);
      track_region(r2C, 16 * 4);
      snapshot_pre();
      call_edi_void(0x6FDD5930u, pLevel);
      snprintf(note, sizeof(note), "spawn_kurast_causeway_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pLevel);
      emit_vector(fp, "0x6FDD5930", "DRLGOUTJUNG_SpawnKurastCausewayPresets113c", v, note, args, 0u, 0u);
    }

    /* F13: 0x6FDD5990 DRLGOUTJUNG_SpawnAct2LutGholeinBorderPreset113c (ecx = pLevel) */
    {
      fn_fast1_void_t fn = (fn_fast1_void_t)RVA(0x6FDD5990u);
      for (int v = 0; v < 5; v++) {
        reset_heap();
        u32 dt = heap_alloc(0x1000);
        u32 prestArr = heap_alloc(1000u * 0x1B0u);
        u32 pLevel = heap_alloc(0x200);
        u32 pOut = heap_alloc(0x300);
        u32 pDrlg = heap_alloc(0x480);
        u32 c04 = heap_alloc(8 * 8 * 4);
        u32 r04 = heap_alloc(8 * 4);
        u32 c2C = heap_alloc(8 * 8 * 4);
        u32 r2C = heap_alloc(8 * 4);
        u32 link1 = heap_alloc(0x20);
        u32 link2 = heap_alloc(0x20);
        u32 adj1 = heap_alloc(0x200);
        u32 adj2 = heap_alloc(0x200);

        *(u32 *)(usize)(dt + 0xC68u) = 1000u;
        *pSgpt = dt;
        *pPrestPtr = prestArr;
        *(u32 *)(usize)(pLevel + 0x14) = pOut;
        *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
        *(u32 *)(usize)(pLevel + 0x1C4) = 0x55555555u + (u32)v;
        *(u32 *)(usize)(pLevel + 0x1C8) = 0x66666666u;
        *(u32 *)(usize)(pOut + 0x5C) = 8u;
        *(u32 *)(usize)(pOut + 0x60) = 8u;
        init_grid(pOut + 0x04, c04, r04, 8, 8);
        init_grid(pOut + 0x2C, c2C, r2C, 8, 8);

        for (u32 id = 362u; id <= 363u; id++) {
          *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x00u) = id;
          *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x28u) = 8u;
          *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x2Cu) = 8u;
          *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x40u) = 3u;
          track_region(prestArr + id * 0x1B0u, 0x44u);
        }

        if (v == 1) {
          *(u32 *)(usize)(pOut + 0x264) = link1;
          *(u32 *)(usize)(link1 + 0x00) = adj1;
          *(u32 *)(usize)(adj1 + 0x1D0) = 41u;
          *(u32 *)(usize)(link1 + 0x14) = 0u;
        } else if (v == 2) {
          *(u32 *)(usize)(pOut + 0x264) = link1;
          *(u32 *)(usize)(link1 + 0x00) = adj1;
          *(u32 *)(usize)(adj1 + 0x1D0) = 41u;
          *(u32 *)(usize)(link1 + 0x14) = link2;
          *(u32 *)(usize)(link2 + 0x00) = adj2;
          *(u32 *)(usize)(adj2 + 0x1D0) = 0x28u;
          *(u32 *)(usize)(link2 + 0x04) = 3u;
        } else if (v == 3) {
          *(u32 *)(usize)(pOut + 0x264) = link1;
          *(u32 *)(usize)(link1 + 0x00) = adj1;
          *(u32 *)(usize)(adj1 + 0x1D0) = 0x28u;
          *(u32 *)(usize)(link1 + 0x04) = 1u;
        } else if (v == 4) {
          *(u32 *)(usize)(pOut + 0x264) = link1;
          *(u32 *)(usize)(link1 + 0x00) = adj1;
          *(u32 *)(usize)(adj1 + 0x1D0) = 0x28u;
          *(u32 *)(usize)(link1 + 0x04) = 3u;
          *(u32 *)(usize)(pOut + 0x60) = 6u;
        }

        track_region(0x6FDE9E1Cu, 4u);
        track_region(0x6FDF0B3Cu, 4u);
        track_region(dt + 0xC60u, 0x10u);
        track_region(pLevel, 0x200);
        track_region(pOut, 0x270);
        track_region(pDrlg + 0x478u, 4u);
        track_region(link1, 0x20);
        track_region(link2, 0x20);
        track_region(adj1, 0x200);
        track_region(adj2, 0x200);
        track_region(c04, 8 * 8 * 4);
        track_region(r04, 8 * 4);
        track_region(c2C, 8 * 8 * 4);
        track_region(r2C, 8 * 4);
        snapshot_pre();
        fn(pLevel);
        snprintf(note, sizeof(note), "spawn_lut_gholein_border_v%d", v);
        snprintf(args, sizeof(args), "[%u]", pLevel);
        emit_vector(fp, "0x6FDD5990", "DRLGOUTJUNG_SpawnAct2LutGholeinBorderPreset113c", v, note, args, 0u, 0u);
      }
    }

    /* F14: 0x6FDD5FD0 DRLGOUTJUNG_SpawnPandemoniumFortressPresets113c (edi = pLevel) */
    for (int v = 0; v < 4; v++) {
      reset_heap();
      u32 dt = heap_alloc(0x1000);
      u32 prestArr = heap_alloc(1000u * 0x1B0u);
      u32 pLevel = heap_alloc(0x200);
      u32 pOut = heap_alloc(0x300);
      u32 pDrlg = heap_alloc(0x480);
      u32 c04 = heap_alloc(16 * 16 * 4);
      u32 r04 = heap_alloc(16 * 4);
      u32 c2C = heap_alloc(16 * 16 * 4);
      u32 r2C = heap_alloc(16 * 4);

      *(u32 *)(usize)(dt + 0xC68u) = 1000u;
      *pSgpt = dt;
      *pPrestPtr = prestArr;
      *(u32 *)(usize)(pLevel + 0x14) = pOut;
      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32 *)(usize)(pLevel + 0x1C4) = 0x33333333u + (u32)v * 0x111u;
      *(u32 *)(usize)(pLevel + 0x1C8) = 0x44444444u + (u32)v;
      init_grid(pOut + 0x04, c04, r04, 16, 16);
      init_grid(pOut + 0x2C, c2C, r2C, 16, 16);

      const u32 pIds[7] = { 836u, 857u, 858u, 859u, 860u, 861u, 862u };
      for (int i = 0; i < 7; i++) {
        u32 id = pIds[i];
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x00u) = id;
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x28u) = (v & 1) ? 16u : 24u;
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x2Cu) = (v & 2) ? 16u : 24u;
        *(u32 *)(usize)(prestArr + id * 0x1B0u + 0x40u) = 4u;
        track_region(prestArr + id * 0x1B0u, 0x44u);
      }
      track_region(0x6FDE9E1Cu, 4u);
      track_region(0x6FDF0B3Cu, 4u);
      track_region(dt + 0xC60u, 0x10u);
      track_region(pLevel, 0x200);
      track_region(pOut, 0x80);
      track_region(pDrlg + 0x478u, 4u);
      track_region(c04, 16 * 16 * 4);
      track_region(r04, 16 * 4);
      track_region(c2C, 16 * 16 * 4);
      track_region(r2C, 16 * 4);
      snapshot_pre();
      call_edi_void(0x6FDD5FD0u, pLevel);
      snprintf(note, sizeof(note), "spawn_pandemonium_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pLevel);
      emit_vector(fp, "0x6FDD5FD0", "DRLGOUTJUNG_SpawnPandemoniumFortressPresets113c", v, note, args, 0u, 0u);
    }

    /* F15: 0x6FDD6000 DRLGOUTJUNG_SpawnOuterSteppesTransitions113c (esi = pLevel) */
    for (int v = 0; v < 4; v++) {
      reset_heap();
      u32 dt = heap_alloc(0x1000);
      u32 prestArr = heap_alloc(1000u * 0x1B0u);
      u32 pLevel = heap_alloc(0x200);
      u32 pOut = heap_alloc(0x300);
      u32 pDrlg = heap_alloc(0x480);
      u32 c04 = heap_alloc(8 * 8 * 4);
      u32 r04 = heap_alloc(8 * 4);
      u32 c2C = heap_alloc(8 * 8 * 4);
      u32 r2C = heap_alloc(8 * 4);

      *(u32 *)(usize)(dt + 0xC68u) = 1000u;
      *pSgpt = dt;
      *pPrestPtr = prestArr;
      *(u32 *)(usize)(pLevel + 0x14) = pOut;
      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32 *)(usize)(pLevel + 0x1C4) = 0x77777777u + (u32)v;
      *(u32 *)(usize)(pLevel + 0x1C8) = 0x88888888u;
      if (v == 1) *(u32 *)(usize)(pOut + 0x00) = 0x400000u;
      else if (v == 2) *(u32 *)(usize)(pOut + 0x00) = 0x800000u;
      else if (v == 3) *(u32 *)(usize)(pOut + 0x00) = 0xC00000u;
      init_grid(pOut + 0x04, c04, r04, 8, 8);
      init_grid(pOut + 0x2C, c2C, r2C, 8, 8);

      *(u32 *)(usize)(prestArr + 0x31Eu * 0x1B0u + 0x00u) = 0x31Eu;
      *(u32 *)(usize)(prestArr + 0x31Eu * 0x1B0u + 0x28u) = 8u;
      *(u32 *)(usize)(prestArr + 0x31Eu * 0x1B0u + 0x2Cu) = 8u;
      *(u32 *)(usize)(prestArr + 0x31Eu * 0x1B0u + 0x40u) = 4u;
      track_region(prestArr + 0x31Eu * 0x1B0u, 0x44u);
      track_region(0x6FDE9E1Cu, 4u);
      track_region(0x6FDF0B3Cu, 4u);
      track_region(dt + 0xC60u, 0x10u);
      track_region(pLevel, 0x200);
      track_region(pOut, 0x80);
      track_region(pDrlg + 0x478u, 4u);
      track_region(c04, 8 * 8 * 4);
      track_region(r04, 8 * 4);
      track_region(c2C, 8 * 8 * 4);
      track_region(r2C, 8 * 4);
      snapshot_pre();
      call_esi_void(0x6FDD6000u, pLevel);
      snprintf(note, sizeof(note), "spawn_outer_steppes_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pLevel);
      emit_vector(fp, "0x6FDD6000", "DRLGOUTJUNG_SpawnOuterSteppesTransitions113c", v, note, args, 0u, 0u);
    }

    *pSgpt = savedSgpt;
    *pPrestPtr = savedPrest;
  }

  /* F16: 0x6FD8B230 DUNGEON_IsTownLevelId113c (stdcall 1 arg, ret 4) */
  {
    fn_std1_u32_t fn = (fn_std1_u32_t)RVA(0x6FD8B230u);
    const u32 lvls[8] = { 0u, 1u, 2u, 40u, 75u, 103u, 109u, 110u };
    for (int v = 0; v < 8; v++) {
      reset_heap();
      snapshot_pre();
      u32 ret = fn(lvls[v]);
      snprintf(note, sizeof(note), "is_town_lvl_%u", lvls[v]);
      snprintf(args, sizeof(args), "[%u]", lvls[v]);
      emit_vector(fp, "0x6FD8B230", "DUNGEON_IsTownLevelId113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F17: 0x6FD8C680 DUNGEON_GetRoomCoordListFromSubtile113c (stdcall 3 args, ret 0xC) */
  {
    fn_std3_u32_t fn = (fn_std3_u32_t)RVA(0x6FD8C680u);
    for (int v = 0; v < 6; v++) {
      reset_heap();
      u32 pRoom = heap_alloc(0x80);
      u32 pRoomEx = heap_alloc(0x80);
      u32 pLog = heap_alloc(0x40);
      u32 pRows = heap_alloc(0x20);
      u32 pCells = heap_alloc(0x40);

      *(u32 *)(usize)(pRoom + 0x10) = pRoomEx;
      *(u32 *)(usize)(pRoomEx + 0x64) = pLog;
      *(s32 *)(usize)(pRoomEx + 0x0C) = 2; /* nTileXPos */
      *(s32 *)(usize)(pRoomEx + 0x10) = 3; /* nTileYPos */
      *(u32 *)(usize)(pLog + 0x30) = 0xABCD1234u;
      *(u32 *)(usize)(pLog + 0x20) = pRows;
      *(u32 *)(usize)(pLog + 0x1C) = pCells;
      for (int y = 0; y < 4; y++) *(u32 *)(usize)(pRows + (u32)(y * 4)) = (u32)(y * 4);
      for (int c = 0; c < 16; c++) *(u32 *)(usize)(pCells + (u32)(c * 4)) = 0x50000000u + (u32)(c * 0x100);

      u32 sx = 10u, sy = 15u;
      if (v == 0) {
        *(u8 *)(usize)(pLog + 0x00) = 1u;
      } else if (v == 1) {
        *(u8 *)(usize)(pLog + 0x00) = 0u;
        sx = 10u; sy = 15u;
      } else if (v == 2) {
        sx = 15u; sy = 20u;
      } else if (v == 3) {
        sx = 20u; sy = 25u;
      } else if (v == 4) {
        sx = 25u; sy = 30u;
      } else {
        *(u8 *)(usize)(pLog + 0x00) = 3u;
        *(u32 *)(usize)(pLog + 0x30) = 0xFACEB00Cu;
      }

      track_region(pRoom, 0x80);
      track_region(pRoomEx, 0x80);
      track_region(pLog, 0x40);
      track_region(pRows, 0x20);
      track_region(pCells, 0x40);
      snapshot_pre();
      u32 ret = fn(pRoom, sx, sy);
      snprintf(note, sizeof(note), "get_room_coord_list_v%d", v);
      snprintf(args, sizeof(args), "[%u,%u,%u]", pRoom, sx, sy);
      emit_vector(fp, "0x6FD8C680", "DUNGEON_GetRoomCoordListFromSubtile113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }
}


static void emit_i11c_2(FILE *fp) {
  char args[128];
  char note[64];

  /* F18: 0x6FD68C40 PATH_WallFollow_ComputePath113c (ecx = pInfo) */
  {
    fn_fast1_u32_t fn = (fn_fast1_u32_t)RVA(0x6FD68C40u);
    for (int v = 0; v < 8; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pInfo = heap_alloc(0x40);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x80);

      *(u32 *)(usize)(pUnit + 0x00) = 0u;
      *(u32 *)(usize)(pUnit + 0x2C) = pPath;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u8  *)(usize)(pPath + 0x91) = 40u;
      *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (102u << 16);
      *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (104u << 16);

      *(u16 *)(usize)(pInfo + 0x00) = 102u;
      *(u16 *)(usize)(pInfo + 0x02) = 104u;
      *(u16 *)(usize)(pInfo + 0x04) = 107u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x0C) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x10) = 1u;
      *(u32 *)(usize)(pInfo + 0x18) = 40u;
      *(u32 *)(usize)(pInfo + 0x28) = 0u;
      *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
      *(u32 *)(usize)(pInfo + 0x30) = pPath;

      if (v == 1) {
        set_world_cell(&w, 104, 104, 1u);
      } else if (v == 2) {
        set_world_cell(&w, 104, 103, 1u);
        set_world_cell(&w, 104, 104, 1u);
        set_world_cell(&w, 104, 105, 1u);
      } else if (v == 3) {
        for (int dy = -1; dy <= 1; dy++)
          for (int dx = -1; dx <= 1; dx++)
            if (dx != 0 || dy != 0) set_world_cell(&w, 102 + dx, 104 + dy, 1u);
      } else if (v == 4) {
        *(u8 *)(usize)(pPath + 0x91) = 3u;
        *(u32 *)(usize)(pInfo + 0x18) = 3u;
      } else if (v == 5) {
        *(u32 *)(usize)(pInfo + 0x10) = 2u;
        *(u32 *)(usize)(pInfo + 0x28) = 1u;
        *(u16 *)(usize)(pInfo + 0x04) = 106u;
        *(u16 *)(usize)(pInfo + 0x06) = 107u;
        set_world_cell(&w, 104, 105, 1u);
      } else if (v == 6) {
        /* curIdx=28, nMaxStepBudget=81 (0x51): (81 - 28)=53 <= 0x50 splices bestMov; un-subtracted 81 > 0x50 skips */
        *(u32 *)(usize)(pPath + 0x1C) = w.r[3];
        *(u8  *)(usize)(pPath + 0x91) = 81u;
        *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (90u << 16);
        *(u16 *)(usize)(pInfo + 0x00) = 90u;
        *(u16 *)(usize)(pInfo + 0x02) = 104u;
        *(u16 *)(usize)(pInfo + 0x04) = 119u;
        *(u16 *)(usize)(pInfo + 0x06) = 104u;
        *(u32 *)(usize)(pInfo + 0x08) = w.r[3];
        *(u32 *)(usize)(pInfo + 0x0C) = w.r[5];
        *(u32 *)(usize)(pInfo + 0x18) = 81u;
        for (s32 y = 90; y < 120; y++) set_world_cell(&w, 118, y, 1u);
        for (s32 x = 90; x < 120; x++) {
          set_world_cell(&w, x, 98, 1u);
          set_world_cell(&w, x, 110, 1u);
        }
      } else if (v == 7) {
        /* curIdx=7, tight nMaxStepBudget=16: (16 - 7)=9 yields rem=-2 (1 step) vs un-subtracted 16 (rem=5, 5 steps) */
        *(u8  *)(usize)(pPath + 0x91) = 16u;
        *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (100u << 16);
        *(u16 *)(usize)(pInfo + 0x00) = 100u;
        *(u16 *)(usize)(pInfo + 0x02) = 104u;
        *(u16 *)(usize)(pInfo + 0x04) = 109u;
        *(u16 *)(usize)(pInfo + 0x06) = 104u;
        *(u32 *)(usize)(pInfo + 0x18) = 16u;
        for (s32 y = 90; y < 120; y++) set_world_cell(&w, 107, y, 1u);
        for (s32 x = 90; x < 120; x++) {
          set_world_cell(&w, x, 101, 1u);
          set_world_cell(&w, x, 107, 1u);
        }
      }

      track_region(0x6FDE5098u, 256u);
      track_region(0x6FDE5198u, 36u);
      track_region(pInfo, 0x40);
      track_region(pPath, 0x200);
      track_region(pUnit, 0x80);
      snapshot_pre();
      u32 ret = fn(pInfo);
      snprintf(note, sizeof(note), "wf_compute_path_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pInfo);
      emit_vector(fp, "0x6FD68C40", "PATH_WallFollow_ComputePath113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F19: 0x6FDB77C0 PATH_ComputeStraightLineWalk113c (ecx = pInfo) */
  {
    fn_fast1_u32_t fn = (fn_fast1_u32_t)RVA(0x6FDB77C0u);
    for (int v = 0; v < 6; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pInfo = heap_alloc(0x40);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x80);

      *(u32 *)(usize)(pUnit + 0x00) = 0u;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (104u << 16);
      *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (104u << 16);
      *(u32 *)(usize)(pPath + 0x44) = 1u;
      *(u32 *)(usize)(pPath + 0x48) = 0u;
      *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
      *(u32 *)(usize)(pPath + 0x7C) = 0x10000u;
      *(u16 *)(usize)(pInfo + 0x00) = 104u;
      *(u16 *)(usize)(pInfo + 0x02) = 104u;
      *(u16 *)(usize)(pInfo + 0x04) = 107u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x10) = 1u;
      *(u32 *)(usize)(pInfo + 0x28) = 0u;
      *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
      *(u32 *)(usize)(pInfo + 0x30) = pPath;

      if (v == 1) {
        set_world_cell(&w, 107, 104, 1u);
      } else if (v == 2) {
        set_world_cell(&w, 105, 104, 1u);
      } else if (v == 3) {
        *(u16 *)(usize)(pInfo + 0x04) = 111u;
        *(u16 *)(usize)(pInfo + 0x06) = 105u;
      } else if (v == 4) {
        *(u32 *)(usize)(pPath + 0x7C) = 0u;
      } else if (v == 5) {
        *(u32 *)(usize)(pPath + 0x44) = 2u;
        *(u32 *)(usize)(pPath + 0x48) = 1u;
        *(u32 *)(usize)(pInfo + 0x10) = 2u;
        *(u32 *)(usize)(pInfo + 0x28) = 1u;
        *(u16 *)(usize)(pInfo + 0x04) = 106u;
        *(u16 *)(usize)(pInfo + 0x06) = 106u;
      }

      track_region(pInfo, 0x40);
      track_region(pPath, 0x200);
      track_region(pUnit, 0x80);
      snapshot_pre();
      u32 ret = fn(pInfo);
      snprintf(note, sizeof(note), "straight_line_walk_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pInfo);
      emit_vector(fp, "0x6FDB77C0", "PATH_ComputeStraightLineWalk113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F20: 0x6FDB77F0 PATH_ComputeLeapOrKnockback113c (ecx = pInfo) */
  {
    fn_fast1_u32_t fn = (fn_fast1_u32_t)RVA(0x6FDB77F0u);
    for (int v = 0; v < 6; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pInfo = heap_alloc(0x40);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x80);

      *(u32 *)(usize)(pUnit + 0x00) = 0u;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (104u << 16);
      *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (104u << 16);
      *(u32 *)(usize)(pPath + 0x44) = 1u;
      *(u32 *)(usize)(pPath + 0x48) = 0u;
      *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
      *(u32 *)(usize)(pPath + 0x7C) = 0x10000u;
      *(u16 *)(usize)(pInfo + 0x00) = 104u;
      *(u16 *)(usize)(pInfo + 0x02) = 104u;
      *(u16 *)(usize)(pInfo + 0x04) = 108u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x10) = 1u;
      *(u32 *)(usize)(pInfo + 0x28) = 0u;
      *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
      *(u32 *)(usize)(pInfo + 0x30) = pPath;

      if (v == 1) {
        set_world_cell(&w, 105, 104, 1u);
      } else if (v == 2) {
        set_world_cell(&w, 107, 104, 1u);
      } else if (v == 3) {
        *(u16 *)(usize)(pInfo + 0x04) = 101u;
        *(u16 *)(usize)(pInfo + 0x06) = 102u;
      } else if (v == 4) {
        *(u16 *)(usize)(pInfo + 0x04) = 112u;
        *(u16 *)(usize)(pInfo + 0x06) = 104u;
      } else if (v == 5) {
        *(u32 *)(usize)(pPath + 0x44) = 2u;
        *(u32 *)(usize)(pPath + 0x48) = 1u;
        *(u32 *)(usize)(pInfo + 0x10) = 2u;
        *(u32 *)(usize)(pInfo + 0x28) = 1u;
        set_world_cell(&w, 106, 104, 1u);
      }

      track_region(pInfo, 0x40);
      track_region(pPath, 0x200);
      track_region(pUnit, 0x80);
      snapshot_pre();
      u32 ret = fn(pInfo);
      snprintf(note, sizeof(note), "leap_or_knockback_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pInfo);
      emit_vector(fp, "0x6FDB77F0", "PATH_ComputeLeapOrKnockback113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F21: 0x6FDB7850 PATH_BuildTurnCornersWithFallbackOffset113c (ecx = pInfo) */
  {
    fn_fast1_u32_t fn = (fn_fast1_u32_t)RVA(0x6FDB7850u);
    for (int v = 0; v < 6; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pInfo = heap_alloc(0x40);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x80);

      *(u32 *)(usize)(pUnit + 0x00) = 0u;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(s32 *)(usize)(pPath + 0x98) = 0;
      *(u16 *)(usize)(pInfo + 0x00) = 104u;
      *(u16 *)(usize)(pInfo + 0x02) = 104u;
      *(u16 *)(usize)(pInfo + 0x04) = 107u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x10) = 1u;
      *(u32 *)(usize)(pInfo + 0x18) = 12u;
      *(u32 *)(usize)(pInfo + 0x28) = 0u;
      *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
      *(u32 *)(usize)(pInfo + 0x30) = pPath;

      if (v == 1) {
        set_world_cell(&w, 105, 104, 1u);
      } else if (v == 2) {
        set_world_cell(&w, 105, 104, 1u);
        set_world_cell(&w, 105, 103, 1u);
      } else if (v == 3) {
        for (int dy = -1; dy <= 1; dy++)
          for (int dx = -1; dx <= 1; dx++)
            if (dx != 0 || dy != 0) set_world_cell(&w, 104 + dx, 104 + dy, 1u);
      } else if (v == 4) {
        *(u16 *)(usize)(pInfo + 0x04) = 108u;
        *(u16 *)(usize)(pInfo + 0x06) = 107u;
        *(u32 *)(usize)(pInfo + 0x18) = 3u;
      } else if (v == 5) {
        *(s32 *)(usize)(pPath + 0x98) = 1;
        set_world_cell(&w, 105, 103, 1u);
      }

      track_region(0x6FDDC320u, 300u);
      track_region(pInfo, 0x40);
      track_region(pPath, 0x200);
      track_region(pUnit, 0x80);
      snapshot_pre();
      u32 ret = fn(pInfo);
      snprintf(note, sizeof(note), "turn_corners_fallback_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pInfo);
      emit_vector(fp, "0x6FDB7850", "PATH_BuildTurnCornersWithFallbackOffset113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F22: 0x6FDB78B0 PATH_ComputeGuidedStepPath113c (ecx = pInfo) */
  {
    fn_fast1_u32_t fn = (fn_fast1_u32_t)RVA(0x6FDB78B0u);
    for (int v = 0; v < 6; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pInfo = heap_alloc(0x40);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x80);

      *(u32 *)(usize)(pUnit + 0x00) = 0u;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (102u << 16);
      *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (104u << 16);
      *(u32 *)(usize)(pPath + 0x44) = 1u;
      *(u32 *)(usize)(pPath + 0x48) = 0u;
      *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
      *(u32 *)(usize)(pPath + 0x7C) = 0x10000u;
      *(s32 *)(usize)(pPath + 0x98) = 0;
      *(u16 *)(usize)(pInfo + 0x00) = 102u;
      *(u16 *)(usize)(pInfo + 0x02) = 104u;
      *(u16 *)(usize)(pInfo + 0x04) = 107u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x10) = 1u;
      *(u32 *)(usize)(pInfo + 0x18) = 12u;
      *(u32 *)(usize)(pInfo + 0x28) = 0u;
      *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
      *(u32 *)(usize)(pInfo + 0x30) = pPath;

      if (v == 1) {
        set_world_cell(&w, 104, 104, 1u);
      } else if (v == 2) {
        set_world_cell(&w, 103, 104, 1u);
      } else if (v == 3) {
        *(s32 *)(usize)(pPath + 0x98) = 1;
      } else if (v == 4) {
        *(s32 *)(usize)(pPath + 0x98) = -1;
        set_world_cell(&w, 104, 104, 1u);
      } else if (v == 5) {
        *(u16 *)(usize)(pInfo + 0x04) = 111u;
        *(u16 *)(usize)(pInfo + 0x06) = 106u;
      }

      track_region(0x6FDDC320u, 300u);
      track_region(pInfo, 0x40);
      track_region(pPath, 0x200);
      track_region(pUnit, 0x80);
      snapshot_pre();
      u32 ret = fn(pInfo);
      snprintf(note, sizeof(note), "guided_step_path_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pInfo);
      emit_vector(fp, "0x6FDB78B0", "PATH_ComputeGuidedStepPath113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F23: 0x6FDC0E40 PATH_IdaStar_ComputePathWithRooms113c (ecx = pInfo) */
  {
    fn_fast1_u32_t fn = (fn_fast1_u32_t)RVA(0x6FDC0E40u);
    for (int v = 0; v < 6; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pInfo = heap_alloc(0x40);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x80);
      u32 pSeed = heap_alloc(0x10);

      *(u32 *)(usize)(pSeed + 0x00) = 0x12345678u;
      *(u32 *)(usize)(pSeed + 0x04) = 0x9ABCDEF0u;
      *(u32 *)(usize)(pUnit + 0x00) = 0u;
      *(u32 *)(usize)(pUnit + 0x20) = pSeed;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];

      *(u16 *)(usize)(pInfo + 0x00) = 102u;
      *(u16 *)(usize)(pInfo + 0x02) = 104u;
      *(u16 *)(usize)(pInfo + 0x04) = 107u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x0C) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x10) = 1u;
      *(u32 *)(usize)(pInfo + 0x18) = 40u;
      *(u8  *)(usize)(pInfo + 0x1C) = 40u;
      *(u32 *)(usize)(pInfo + 0x28) = 0u;
      *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
      *(u32 *)(usize)(pInfo + 0x30) = pPath;

      if (v == 1) {
        *(u16 *)(usize)(pInfo + 0x04) = 102u;
        *(u16 *)(usize)(pInfo + 0x06) = 104u;
      } else if (v == 2) {
        set_world_cell(&w, 104, 103, 1u);
        set_world_cell(&w, 104, 104, 1u);
        set_world_cell(&w, 104, 105, 1u);
      } else if (v == 3) {
        *(u16 *)(usize)(pInfo + 0x04) = 112u;
        *(u16 *)(usize)(pInfo + 0x06) = 106u;
        *(u32 *)(usize)(pInfo + 0x0C) = w.r[5];
      } else if (v == 4) {
        *(u32 *)(usize)(pInfo + 0x08) = 0u; /* NULL startRoom -> returns 0 */
      } else if (v == 5) {
        set_world_cell(&w, 107, 104, 1u); /* blocked target */
        *(u8 *)(usize)(pInfo + 0x14) = 0u;
      }

      track_region(0x6FDDB860u, 256u);
      track_region(0x6FDDB960u, 128u);
      track_region(pInfo, 0x40);
      track_region(pPath, 0x200);
      track_region(pUnit, 0x80);
      track_region(pSeed, 0x10);
      snapshot_pre();
      u32 ret = fn(pInfo);
      snprintf(note, sizeof(note), "idastar_with_rooms_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pInfo);
      emit_vector(fp, "0x6FDC0E40", "PATH_IdaStar_ComputePathWithRooms113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F24: 0x6FDB7AD0 PATH_ComputeMonsterSeekPath113c (ecx = pInfo) */
  {
    fn_fast1_u32_t fn = (fn_fast1_u32_t)RVA(0x6FDB7AD0u);
    for (int v = 0; v < 6; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pInfo = heap_alloc(0x40);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x80);

      *(u32 *)(usize)(pUnit + 0x00) = 1u;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u16 *)(usize)(pInfo + 0x00) = 102u;
      *(u16 *)(usize)(pInfo + 0x02) = 104u;
      *(u16 *)(usize)(pInfo + 0x04) = 107u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x10) = 1u;
      *(u32 *)(usize)(pInfo + 0x18) = 14u;
      *(u32 *)(usize)(pInfo + 0x28) = 0u;
      *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
      *(u32 *)(usize)(pInfo + 0x30) = pPath;

      if (v == 1) {
        set_world_cell(&w, 103, 104, 1u);
      } else if (v == 2) {
        set_world_cell(&w, 104, 104, 1u);
        set_world_cell(&w, 104, 105, 1u);
      } else if (v == 3) {
        for (int dy = -1; dy <= 1; dy++)
          for (int dx = -1; dx <= 1; dx++)
            if (dx != 0 || dy != 0) set_world_cell(&w, 102 + dx, 104 + dy, 1u);
      } else if (v == 4) {
        *(u32 *)(usize)(pInfo + 0x18) = 2u;
      } else if (v == 5) {
        *(u32 *)(usize)(pInfo + 0x10) = 2u;
        *(u32 *)(usize)(pInfo + 0x28) = 1u;
        *(u16 *)(usize)(pInfo + 0x04) = 106u;
        *(u16 *)(usize)(pInfo + 0x06) = 107u;
      }

      track_region(0x6FDDB458u, 0x400u);
      track_region(0x6FDDC320u, 300u);
      track_region(pInfo, 0x40);
      track_region(pPath, 0x200);
      track_region(pUnit, 0x80);
      snapshot_pre();
      u32 ret = fn(pInfo);
      snprintf(note, sizeof(note), "monster_seek_path_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pInfo);
      emit_vector(fp, "0x6FDB7AD0", "PATH_ComputeMonsterSeekPath113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F25: 0x6FDB7B70 PATH_ComputeChargedBoltOrGuidedPath113c (ecx = pInfo) */
  {
    fn_fast1_u32_t fn = (fn_fast1_u32_t)RVA(0x6FDB7B70u);
    for (int v = 0; v < 6; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pInfo = heap_alloc(0x40);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x80);

      *(u32 *)(usize)(pUnit + 0x00) = 0u;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (102u << 16);
      *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (104u << 16);
      *(u32 *)(usize)(pPath + 0x44) = 1u;
      *(u32 *)(usize)(pPath + 0x48) = 0u;
      *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
      *(u32 *)(usize)(pPath + 0x7C) = 0x10000u;
      *(s32 *)(usize)(pPath + 0x98) = 0;
      *(u16 *)(usize)(pInfo + 0x00) = 102u;
      *(u16 *)(usize)(pInfo + 0x02) = 104u;
      *(u16 *)(usize)(pInfo + 0x04) = 107u;
      *(u16 *)(usize)(pInfo + 0x06) = 104u;
      *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
      *(u32 *)(usize)(pInfo + 0x10) = 1u;
      *(u32 *)(usize)(pInfo + 0x18) = 14u;
      *(u32 *)(usize)(pInfo + 0x28) = 0u;
      *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
      *(u32 *)(usize)(pInfo + 0x30) = pPath;

      if (v == 1) {
        set_world_cell(&w, 104, 104, 1u);
      } else if (v == 2) {
        set_world_cell(&w, 103, 104, 1u);
      } else if (v == 3) {
        *(s32 *)(usize)(pPath + 0x98) = 1;
      } else if (v == 4) {
        *(u16 *)(usize)(pInfo + 0x04) = 100u;
        *(u16 *)(usize)(pInfo + 0x06) = 101u;
      } else if (v == 5) {
        *(u16 *)(usize)(pInfo + 0x04) = 112u;
        *(u16 *)(usize)(pInfo + 0x06) = 105u;
      }

      track_region(0x6FDDB458u, 0x400u);
      track_region(0x6FDDC320u, 300u);
      track_region(pInfo, 0x40);
      track_region(pPath, 0x200);
      track_region(pUnit, 0x80);
      snapshot_pre();
      u32 ret = fn(pInfo);
      snprintf(note, sizeof(note), "charged_bolt_guided_v%d", v);
      snprintf(args, sizeof(args), "[%u]", pInfo);
      emit_vector(fp, "0x6FDB7B70", "PATH_ComputeChargedBoltOrGuidedPath113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F26: 0x6FD86230 PATH_Compute113c (stdcall 3 args: pDynamicPath, pUnit, bAllowInTown, ret 0xC) */
  {
    fn_std3_u32_t fn = (fn_std3_u32_t)RVA(0x6FD86230u);
    u32 *pSgpt = (u32 *)RVA(0x6FDE9E1Cu);
    u32 savedSgpt = *pSgpt;
    u32 pBitMasks = *(u32 *)RVA(0x6FDD90B0u);
    const u32 ptypes[12] = { 0u, 1u, 2u, 3u, 16u, 7u, 8u, 9u, 11u, 12u, 15u, 2u };
    for (int v = 0; v < 15; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 dt = heap_alloc(0x1000);
      u32 monTbl = heap_alloc(8u * 424u);
      u32 mon2Tbl = heap_alloc(8u * 308u);
      *pSgpt = dt;
      *(u32 *)(usize)(dt + 0xA78u) = monTbl;
      *(u32 *)(usize)(dt + 0xA80u) = 8u;
      *(u32 *)(usize)(dt + 0xA90u) = mon2Tbl;
      *(u32 *)(usize)(dt + 0xA98u) = 8u;
      *(u16 *)(usize)(monTbl + 1u * 424u + 0x02u) = 1u;
      *(u16 *)(usize)(monTbl + 1u * 424u + 0x18u) = 1u;
      *(u8  *)(usize)(mon2Tbl + 1u * 308u + 0x08u) = 1u;

      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x100);
      u32 pSeed = heap_alloc(0x10);
      u32 pRoomEx = heap_alloc(0x80);
      u32 pLevel = heap_alloc(0x200);

      *(u32 *)(usize)(pSeed + 0x00) = 0x13579BDFu;
      *(u32 *)(usize)(pSeed + 0x04) = 0x2468ACE0u;
      *(u32 *)(usize)(pUnit + 0x00) = 0u;
      *(u32 *)(usize)(pUnit + 0x20) = pSeed;
      *(u32 *)(usize)(pUnit + 0x2C) = pPath;
      *(u32 *)(usize)(pLevel + 0x1D0) = 2u; /* Blood Moor (non-town) */
      *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
      for (int i = 0; i < 9; i++) {
        *(u32 *)(usize)(w.r[i] + 0x10) = pRoomEx;
      }

      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      *(u32 *)(usize)(pPath + 0x00) = 0x8000u | (102u << 16);
      *(u32 *)(usize)(pPath + 0x04) = 0x8000u | (104u << 16);
      *(u16 *)(usize)(pPath + 0x10) = 106u;
      *(u16 *)(usize)(pPath + 0x12) = 104u;
      *(u32 *)(usize)(pPath + 0x34) = 0x21900u;
      *(u32 *)(usize)(pPath + 0x3C) = (v < 12) ? ptypes[v] : 2u;
      *(u32 *)(usize)(pPath + 0x44) = 1u;
      *(u32 *)(usize)(pPath + 0x48) = 0u;
      *(u32 *)(usize)(pPath + 0x4C) = 0x80u;
      *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
      *(u32 *)(usize)(pPath + 0x7C) = 0x10000u;
      *(u8  *)(usize)(pPath + 0x91) = 40u;
      *(u8  *)(usize)(pPath + 0x92) = 40u;
      *(u8  *)(usize)(pPath + 0x93) = 1u;

      u32 argPath = pPath;
      u32 allowTown = 0u;
      if (v == 4) {
        /* PATHTYPE 16 (IDA* slot 16) with slight vertical delta */
        *(u16 *)(usize)(pPath + 0x10) = 105u;
        *(u16 *)(usize)(pPath + 0x12) = 106u;
      } else if (v == 11) {
        /* Monster blocked by town destination when allowTown == 0 */
        *(u32 *)(usize)(pUnit + 0x00) = 1u;
        *(u32 *)(usize)(pUnit + 0x04) = 1u;
        *(u32 *)(usize)(pLevel + 0x1D0) = 1u; /* Rogue Encampment (town) */
        allowTown = 0u;
      } else if (v == 12) {
        /* NULL pDynamicPath -> returns 0 */
        argPath = 0u;
      } else if (v == 13) {
        /* start == target -> failCleanup returns 0 */
        *(u16 *)(usize)(pPath + 0x10) = 102u;
        *(u16 *)(usize)(pPath + 0x12) = 104u;
      } else if (v == 14) {
        /* 0x40000 special path flag with dwPathType=10 (charged bolt) */
        *(u32 *)(usize)(pPath + 0x34) = 0x40000u;
        *(u32 *)(usize)(pPath + 0x3C) = 10u;
      }

      track_region(0x6FDE9E1Cu, 4u);
      track_region(0x6FDD90B0u, 4u);
      track_region(pBitMasks, 32u);
      track_region(dt, 0x1000);
      track_region(monTbl, 8u * 424u);
      track_region(mon2Tbl, 8u * 308u);
      track_region(0x6FDE4138u, 72u);
      track_region(0x6FDE4180u, 72u);
      track_region(0x6FDE42F0u, 72u);
      track_region(0x6FDDB860u, 256u);
      track_region(0x6FDDB960u, 128u);
      track_region(0x6FDDB458u, 0x400u);
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
      u32 ret = fn(argPath, pUnit, allowTown);
      snprintf(note, sizeof(note), "path_compute_v%d", v);
      snprintf(args, sizeof(args), "[%u,%u,%u]", argPath, pUnit, allowTown);
      emit_vector(fp, "0x6FD86230", "PATH_Compute113c", v, note, args, ret, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
  }
}

int main(int argc, char **argv) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  const char *i11c1_out = (argc > 1) ? argv[1] : "tests/fixtures/oracle/k1/i11c-1-vectors.ndjson";
  const char *i11c2_out = (argc > 2) ? argv[2] : "tests/fixtures/oracle/k1/i11c-2-vectors.ndjson";

  const char *d2_dir = getenv("D2_DATA_DIR");
  if (d2_dir && d2_dir[0]) {
    SetDllDirectoryA(d2_dir);
  } else {
    SetDllDirectoryA("samples/d2");
  }

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

  fprintf(stderr, "MAIN: LoadLibraryA OK at %p\n", (void *)hDll);
  g_arena = (u8 *)VirtualAlloc((void *)(usize)ARENA_ADDR, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  g_heap  = (u8 *)VirtualAlloc((void *)(usize)HEAP_ADDR,  HEAP_SIZE,  MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  if (!g_arena || !g_heap) return 3;
  fprintf(stderr, "MAIN: VirtualAlloc OK\n");

  DWORD oldProt = 0;
  VirtualProtect((LPVOID)(usize)0x6FDD9000u, 0x1000u, PAGE_EXECUTE_READWRITE, &oldProt);
  VirtualProtect((LPVOID)(usize)0x6FDE9000u, 0x9000u, PAGE_EXECUTE_READWRITE, &oldProt);
  *(u32 *)(usize)0x6FDD90A8u = (u32)(usize)&stub_fog_10046;
  *(u32 *)(usize)0x6FDD90ACu = (u32)(usize)&stub_fog_10045;
  *(u32 *)(usize)0x6FDD90CCu = (u32)(usize)&stub_fog_10046;
  *(u32 *)(usize)0x6FDD90D0u = (u32)(usize)&stub_fog_10045;

  FILE *fp1 = fopen(i11c1_out, "wb");
  if (!fp1) return 4;
  fprintf(stderr, "MAIN: calling emit_i11c_1\n");
  emit_i11c_1(fp1);
  fclose(fp1);

  FILE *fp2 = fopen(i11c2_out, "wb");
  if (!fp2) return 5;
  fprintf(stderr, "MAIN: calling emit_i11c_2\n");
  emit_i11c_2(fp2);
  fclose(fp2);

  return 0;
}
