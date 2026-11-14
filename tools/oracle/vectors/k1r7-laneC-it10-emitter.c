/*
 * k1r7-laneC-it10-emitter.c
 *
 * 32-bit MinGW executable that loads the real D2Common.dll v1.13c at its
 * preferred image base 0x6FD50000 (along with Fog.dll and D2CMP.dll) under Wine
 * and emits differential test vectors (NDJSON) for Lane C Iteration 10:
 *   - I10C-1 (15 functions: F01..F15) -> i10c-1-vectors.ndjson
 *   - I10C-2 (12 functions: F16..F27) -> i10c-2-vectors.ndjson
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
#define ARENA_SIZE    0x00200000u
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

#define MAX_BLOCKS 128
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
  if (aligned + alloc_sz > ARENA_SIZE) ExitProcess(4);
  u32 p = ARENA_ADDR + aligned;
  memset(g_arena + aligned, 0, alloc_sz);
  g_arena_off = aligned + alloc_sz;
  return p;
}

static void track_region(u32 addr, u32 byte_len) {
  if (g_num_blocks >= MAX_BLOCKS) ExitProcess(5);
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

/* Standard stdcall function pointer typedefs */
typedef void (__stdcall *fn_std1_void_t)(u32);
typedef u32  (__stdcall *fn_std2_u32_t)(u32, u32);
typedef void (__stdcall *fn_std5_void_t)(u32, u32, u32, u32, u32);
typedef u32  (__stdcall *fn_std5_u32_t)(u32, u32, u32, u32, u32);

/* Register-only custom ABI wrappers */
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

static __attribute__((noinline)) void call_eax_void(u32 fn, u32 a_eax) {
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "+a"(a_eax), "+c"(fn)
    :
    : "edx", "ebx", "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) void call_edx_void(u32 fn, u32 a_edx) {
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "+d"(a_edx), "+c"(fn)
    :
    : "eax", "ebx", "esi", "edi", "memory", "cc"
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

static __attribute__((noinline)) void call_ebx_stk1_void(u32 fn, u32 a_ebx, u32 s1) {
  __asm__ volatile(
    "pushl %%edx\n\t"
    "call *%%ecx\n\t"
    : "+b"(a_ebx), "+c"(fn), "+d"(s1)
    :
    : "eax", "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) void call_eax_ecx_ebx_void(u32 fn, u32 a_eax, u32 a_ecx, u32 a_ebx) {
  __asm__ volatile(
    "call *%%edx\n\t"
    : "+a"(a_eax), "+c"(a_ecx), "+b"(a_ebx), "+d"(fn)
    :
    : "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_eax_stk1_u32(u32 fn, u32 a_eax, u32 s1) {
  u32 out;
  __asm__ volatile(
    "pushl %%edx\n\t"
    "call *%%ecx\n\t"
    : "=a"(out), "+c"(fn), "+d"(s1)
    : "a"(a_eax)
    : "ebx", "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_edi_stk1_u32(u32 fn, u32 a_edi, u32 s1) {
  u32 out;
  __asm__ volatile(
    "pushl %%edx\n\t"
    "call *%%ecx\n\t"
    : "=a"(out), "+D"(a_edi), "+c"(fn), "+d"(s1)
    :
    : "ebx", "esi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_eax_esi_u32(u32 fn, u32 a_eax, u32 a_esi) {
  u32 out;
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "=a"(out), "+S"(a_esi), "+c"(fn)
    : "a"(a_eax)
    : "edx", "ebx", "edi", "memory", "cc"
  );
  return out;
}

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

static __attribute__((noinline)) void call_eax_ecx_edx_stk3_void(
  u32 fn, u32 a_eax, u32 a_ecx, u32 a_edx, u32 s1, u32 s2, u32 s3
) {
  u32 pack[4] = { fn, s1, s2, s3 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 12(%%esi)\n\t"
    "pushl 8(%%esi)\n\t"
    "pushl 4(%%esi)\n\t"
    "call *0(%%esi)\n\t"
    : "+a"(a_eax), "+c"(a_ecx), "+d"(a_edx), "+S"(p)
    :
    : "ebx", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_eax_ecx_stk4_u32(
  u32 fn, u32 a_eax, u32 a_ecx, u32 s1, u32 s2, u32 s3, u32 s4
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
    : "=a"(out), "+c"(a_ecx), "+d"(p)
    : "a"(a_eax)
    : "ebx", "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_eax_esi_edi_stk4_u32(
  u32 fn, u32 a_eax, u32 a_esi, u32 a_edi, u32 s1, u32 s2, u32 s3, u32 s4
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
    : "=a"(out), "+S"(a_esi), "+D"(a_edi), "+d"(p)
    : "a"(a_eax)
    : "ecx", "ebx", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_ecx_edx_stk6_u32(
  u32 fn, u32 a_ecx, u32 a_edx, u32 s1, u32 s2, u32 s3, u32 s4, u32 s5, u32 s6
) {
  u32 pack[7] = { fn, s1, s2, s3, s4, s5, s6 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 24(%%esi)\n\t"
    "pushl 20(%%esi)\n\t"
    "pushl 16(%%esi)\n\t"
    "pushl 12(%%esi)\n\t"
    "pushl 8(%%esi)\n\t"
    "pushl 4(%%esi)\n\t"
    "call *0(%%esi)\n\t"
    : "=a"(out), "+c"(a_ecx), "+d"(a_edx), "+S"(p)
    :
    : "ebx", "edi", "memory", "cc"
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
} CollWorld;

static void build_coll_world(CollWorld *w, int link_neighbors) {
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

static u32 fx_center(s32 c) {
  return (((u32)c << 16) + 0x8000u);
}

static void init_room_sub(u32 r, s32 sx, s32 sy, s32 sw, s32 sh, u32 pActFlag) {
  *(s32 *)(usize)(r + 0x4C) = sx;
  *(s32 *)(usize)(r + 0x50) = sy;
  *(s32 *)(usize)(r + 0x54) = sw;
  *(s32 *)(usize)(r + 0x58) = sh;
  *(u32 *)(usize)(r + 0x2C) = pActFlag;
}

static void emit_i10c_1(FILE *fp) {
  char args[256];

  /* F01: 0x6FD9BCF0 COLLISION_ResetMaskWithPattern113c */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    for (int y = 98; y <= 108; y++)
      for (int x = 98; x <= 108; x++)
        set_world_cell(&w, x, y, 0xFFFFu);
    s32 nx = 104, ny = 104, pat = 0;
    u32 mask = 0x0180u;
    if (v == 0) { pat = 0; mask = 0x0080u; }
    else if (v == 1) { pat = 1; mask = 0x0100u; }
    else if (v == 2) { pat = 2; mask = 0x0380u; }
    else if (v == 3) { pat = 3; mask = 0x0100u; }
    else if (v == 4) { pat = 4; mask = 0x0100u; }
    else if (v == 5) { pat = 5; mask = 0x0080u; }
    else if (v == 6) { pat = 2; nx = 100; ny = 100; mask = 0x0380u; } /* boundary crossing */
    else { pat = 4; nx = 100; ny = 100; mask = 0x0100u; }
    snapshot_pre();
    ((fn_std5_void_t)(usize)0x6FD9BCF0u)(w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    char note[48];
    snprintf(note, sizeof(note), "reset_mask_pat_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u]", w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    emit_vector(fp, "0x6FD9BCF0", "COLLISION_ResetMaskWithPattern113c", v, note, args, 0u, 0u);
  }

  /* F02: 0x6FD9BE10 COLLISION_ResetMaskWithPatternSimple113c */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    for (int y = 98; y <= 108; y++)
      for (int x = 98; x <= 108; x++)
        set_world_cell(&w, x, y, 0x7FFFu);
    s32 nx = 104, ny = 104, pat = 0;
    u32 mask = 0x0100u;
    if (v == 0) { pat = 0; mask = 0x0001u; }
    else if (v == 1) { pat = 1; mask = 0x0080u; }
    else if (v == 2) { pat = 2; mask = 0x0300u; }
    else if (v == 3) { pat = 3; mask = 0x0080u; }
    else if (v == 4) { pat = 4; mask = 0x0200u; }
    else if (v == 5) { pat = -1; mask = 0x0400u; }
    else if (v == 6) { pat = 1; nx = 100; ny = 100; mask = 0x0100u; }
    else { pat = 2; nx = 100; ny = 100; mask = 0x0700u; }
    snapshot_pre();
    ((fn_std5_void_t)(usize)0x6FD9BE10u)(w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    char note[48];
    snprintf(note, sizeof(note), "reset_simple_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u]", w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    emit_vector(fp, "0x6FD9BE10", "COLLISION_ResetMaskWithPatternSimple113c", v, note, args, 0u, 0u);
  }

  /* F03: 0x6FD9BE90 COLLISION_SetUnitCollisionMaskWithPattern113c */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    s32 nx = 104, ny = 104, pat = 0;
    u32 mask = 0x0100u;
    if (v == 0) { pat = 0; mask = 0x0100u; }
    else if (v == 1) { pat = 1; mask = 0x0100u; }
    else if (v == 2) { pat = 2; mask = 0x0100u; }
    else if (v == 3) { pat = 3; mask = 0x0100u; }
    else if (v == 4) { pat = 4; mask = 0x0100u; }
    else if (v == 5) { pat = 9; mask = 0x0040u; }
    else if (v == 6) { pat = 2; nx = 100; ny = 100; mask = 0x0100u; }
    else { pat = 4; nx = 100; ny = 100; mask = 0x0100u; }
    snapshot_pre();
    ((fn_std5_void_t)(usize)0x6FD9BE90u)(w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    char note[48];
    snprintf(note, sizeof(note), "set_unit_pat_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u]", w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    emit_vector(fp, "0x6FD9BE90", "COLLISION_SetUnitCollisionMaskWithPattern113c", v, note, args, 0u, 0u);
  }

  /* F04: 0x6FD9CE00 COLLISION_CheckMaskWithPattern1_113c (retMask 0xFFFF) */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    s32 nx = 104, ny = 104, pat = 0;
    u32 mask = 0x1C01u;
    if (v == 0) { pat = 0; }
    else if (v == 1) { pat = 0; set_world_cell(&w, 104, 104, 0x0401u); }
    else if (v == 2) { pat = 1; set_world_cell(&w, 105, 104, 0x0080u); }
    else if (v == 3) { pat = 1; set_world_cell(&w, 105, 104, 0x0100u); mask = 0x0100u; }
    else if (v == 4) { pat = 2; set_world_cell(&w, 106, 104, 0x0100u); mask = 0x0100u; }
    else if (v == 5) { pat = 2; set_world_cell(&w, 106, 104, 0x0200u); mask = 0x0200u; }
    else if (v == 6) { pat = 3; set_world_cell(&w, 104, 104, 0x0080u); mask = 0x0080u; }
    else { pat = 4; set_world_cell(&w, 104, 104, 0x0100u); mask = 0x0100u; }
    snapshot_pre();
    u32 ret = ((fn_std5_u32_t)(usize)0x6FD9CE00u)(w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    char note[48];
    snprintf(note, sizeof(note), "check_pat1_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u]", w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    emit_vector(fp, "0x6FD9CE00", "COLLISION_CheckMaskWithPattern1_113c", v, note, args, ret, 0xFFFFu);
  }

  /* F05: 0x6FD9CE90 COLLISION_CheckMaskWithPattern2_113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    s32 nx = 104, ny = 104, pat = 0;
    u32 mask = 0x1C01u;
    if (v == 0) { pat = 0; }
    else if (v == 1) { pat = 0; set_world_cell(&w, 104, 104, 0x0001u); }
    else if (v == 2) { pat = 1; set_world_cell(&w, 105, 104, 0x0100u); mask = 0x0100u; }
    else if (v == 3) { pat = 2; set_world_cell(&w, 106, 104, 0x0200u); mask = 0x0200u; }
    else if (v == 4) { pat = 3; set_world_cell(&w, 104, 104, 0x0080u); mask = 0x0080u; }
    else if (v == 5) { pat = 4; set_world_cell(&w, 104, 104, 0x0100u); mask = 0x0100u; }
    else if (v == 6) { pat = 4; set_world_cell(&w, 105, 105, 0x0001u); mask = 0x0001u; }
    else { pat = 9; }
    snapshot_pre();
    u32 ret = ((fn_std5_u32_t)(usize)0x6FD9CE90u)(w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    char note[48];
    snprintf(note, sizeof(note), "check_pat2_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u]", w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    emit_vector(fp, "0x6FD9CE90", "COLLISION_CheckMaskWithPattern2_113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F06: 0x6FD9CF40 COLLISION_GetMaskWithPattern2_113c (retMask 0xFFFF) */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    s32 nx = 104, ny = 104, pat = 0;
    u32 mask = 0xFFFFu;
    if (v == 0) { pat = 0; set_world_cell(&w, 104, 104, 0x1234u); }
    else if (v == 1) { pat = 1; set_world_cell(&w, 103, 104, 0x0010u); set_world_cell(&w, 104, 105, 0x0100u); }
    else if (v == 2) { pat = 2; set_world_cell(&w, 102, 104, 0x0200u); set_world_cell(&w, 104, 106, 0x0004u); }
    else if (v == 3) { pat = 3; set_world_cell(&w, 104, 104, 0x0088u); }
    else if (v == 4) { pat = 4; set_world_cell(&w, 104, 104, 0x0101u); set_world_cell(&w, 105, 104, 0x0020u); }
    else if (v == 5) { pat = 7; set_world_cell(&w, 104, 104, 0x0400u); }
    else if (v == 6) { pat = 1; nx = 100; ny = 100; set_world_cell(&w, 99, 100, 0x0800u); }
    else { pat = 2; nx = 100; ny = 100; set_world_cell(&w, 98, 100, 0x0200u); }
    snapshot_pre();
    u32 ret = ((fn_std5_u32_t)(usize)0x6FD9CF40u)(w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    char note[48];
    snprintf(note, sizeof(note), "get_pat2_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u]", w.r[4], (u32)nx, (u32)ny, (u32)pat, mask);
    emit_vector(fp, "0x6FD9CF40", "COLLISION_GetMaskWithPattern2_113c", v, note, args, ret, 0xFFFFu);
  }

  /* F07: 0x6FD5DA40 PATH_SetPrecisionPosAndRecacheRoom113c */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    u32 pActFlag = heap_alloc(0x10);
    u32 rA = heap_alloc(0x80);
    u32 rB = heap_alloc(0x80);
    u32 rHint = heap_alloc(0x80);
    u32 nearA = heap_alloc(0x10);
    u32 nearHint = heap_alloc(0x10);
    u32 pPath = heap_alloc(0x80);
    u32 pUnit = heap_alloc(0x100);
    init_room_sub(rA, 100, 100, 40, 40, pActFlag);
    init_room_sub(rB, 140, 100, 40, 40, pActFlag);
    init_room_sub(rHint, 100, 60, 40, 40, pActFlag);
    *(u32 *)(usize)nearA = rA;
    *(u32 *)(usize)(nearA + 4) = rB;
    *(u32 *)(usize)(rA + 0x00) = nearA;
    *(u32 *)(usize)(rA + 0x24) = 2u;
    *(u32 *)(usize)nearHint = rHint;
    *(u32 *)(usize)(rHint + 0x00) = nearHint;
    *(u32 *)(usize)(rHint + 0x24) = 1u;

    *(u32 *)(usize)(pUnit + 0x00) = 1u;
    *(u32 *)(usize)(pUnit + 0x2C) = pPath;
    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x1C) = rA;
    *(u32 *)(usize)(rA + 0x74) = pUnit;
    *(u32 *)(usize)(pPath + 0x28) = 5u;

    u32 px = fx_center(110), py = fx_center(115), hint = 0u;
    if (v == 0) { px = 0u; py = fx_center(115); } /* x == 0 -> early return */
    else if (v == 1) { px = fx_center(115); py = 0u; } /* y == 0 -> early return */
    else if (v == 2) { px = (112u << 16) | 0x1234u; py = (118u << 16) | 0x5678u; } /* stays in rA */
    else if (v == 3) { px = fx_center(145); py = fx_center(115); } /* moves to rB */
    else if (v == 4) { px = fx_center(115); py = fx_center(75); hint = rHint; } /* moves to rHint */
    else if (v == 5) { *(u32 *)(usize)(pPath + 0x34) = 0x40000u; px = fx_center(300); py = fx_center(300); } /* miss with 0x40000 */
    else if (v == 6) { px = fx_center(300); py = fx_center(300); } /* miss without 0x40000 -> unlinks */
    else { *(u32 *)(usize)(pPath + 0x1C) = 0u; *(u32 *)(usize)(rA + 0x74) = 0u; px = fx_center(115); py = fx_center(75); hint = rHint; }

    track_region(pActFlag, 0x10);
    track_region(rA, 0x80);
    track_region(rB, 0x80);
    track_region(rHint, 0x80);
    track_region(nearA, 0x10);
    track_region(nearHint, 0x10);
    track_region(pPath, 0x80);
    track_region(pUnit, 0x100);
    snapshot_pre();
    call_esi_stk3_void(0x6FD5DA40u, pPath, px, py, hint);
    char note[48];
    snprintf(note, sizeof(note), "set_prec_pos_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pPath, px, py, hint);
    emit_vector(fp, "0x6FD5DA40", "PATH_SetPrecisionPosAndRecacheRoom113c", v, note, args, 0u, 0u);
  }

  /* F08: 0x6FD85530 PATH_ComputeDirectSinglePointPath113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    u32 pPath = heap_alloc(0x200);
    u32 pRoom = heap_alloc(0x80);
    u32 pTarget = heap_alloc(0x60);
    u32 pTargetPath = heap_alloc(0x80);
    *(s32 *)(usize)(pRoom + 0x4C) = 100;
    *(s32 *)(usize)(pRoom + 0x50) = 100;
    *(s32 *)(usize)(pRoom + 0x54) = 40;
    *(s32 *)(usize)(pRoom + 0x58) = 40;
    *(u32 *)(usize)(pPath + 0x00) = fx_center(110);
    *(u32 *)(usize)(pPath + 0x04) = fx_center(110);
    *(u32 *)(usize)(pPath + 0x1C) = pRoom;
    *(u32 *)(usize)(pPath + 0x7C) = 0x800u;
    *(u16 *)(usize)(pPath + 0x10) = 120u;
    *(u16 *)(usize)(pPath + 0x12) = 125u;

    if (v == 0) { /* inside room, no target unit */ }
    else if (v == 1) { *(u16 *)(usize)(pPath + 0x10) = 150u; } /* outside room X -> sets flag 1 */
    else if (v == 2) { *(u16 *)(usize)(pPath + 0x12) = 95u; }  /* outside room Y -> sets flag 1 */
    else if (v == 3) { *(u32 *)(usize)(pPath + 0x1C) = 0u; }   /* null pRoom -> sets flag 1 */
    else if (v == 4) { *(u16 *)(usize)(pPath + 0x10) = 210u; } /* |dx| == 100 -> returns 0 */
    else if (v == 5) { *(u16 *)(usize)(pPath + 0x12) = 215u; } /* |dy| >= 100 -> returns 0 */
    else if (v == 6) { *(u16 *)(usize)(pPath + 0x10) = 0u; *(u32 *)(usize)(pPath + 0x00) = fx_center(10); } /* tx == 0 -> returns 0 */
    else {
      /* with target unit (monster at 118, 122) */
      *(u32 *)(usize)(pTarget + 0x00) = 1u;
      *(u32 *)(usize)(pTarget + 0x2C) = pTargetPath;
      *(u16 *)(usize)(pTargetPath + 0x02) = 118u;
      *(u16 *)(usize)(pTargetPath + 0x06) = 122u;
      *(u32 *)(usize)(pPath + 0x58) = pTarget;
    }

    track_region(pPath, 0x200);
    track_region(pRoom, 0x80);
    track_region(pTarget, 0x60);
    track_region(pTargetPath, 0x80);
    snapshot_pre();
    u32 ret = call_eax_u32(0x6FD85530u, pPath);
    char note[48];
    snprintf(note, sizeof(note), "direct_single_pt_v%d", v);
    snprintf(args, sizeof(args), "[%u]", pPath);
    emit_vector(fp, "0x6FD85530", "PATH_ComputeDirectSinglePointPath113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F09: 0x6FD5AE10 DRLGPRESET_InitPresetRoomEx113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    u32 pLevel = heap_alloc(0x200);
    u32 pDrlg = heap_alloc(0x490);
    u32 pBox = heap_alloc(0x20);
    u32 pMaze = (v % 2 == 1) ? heap_alloc(0x20) : 0u;
    u32 pMap = heap_alloc(0x40);
    u32 pLvlPrestTxt = heap_alloc(0x40);
    *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32 *)(usize)(pDrlg + 0x478) = 0xCAFE0000u;
    *(s32 *)(usize)(pBox + 0x00) = 10 + v * 4;
    *(s32 *)(usize)(pBox + 0x04) = 20 + v * 6;
    *(s32 *)(usize)(pBox + 0x08) = 8 + v;
    *(s32 *)(usize)(pBox + 0x0C) = 12 + v;
    *(u32 *)(usize)(pMap + 0x08) = pLvlPrestTxt;
    *(s32 *)(usize)(pLvlPrestTxt + 0x00) = 300 + v * 11;
    if (pMaze) *(u32 *)(usize)(pMaze + 0x0C) = (v == 3) ? 0x10u : 0u;
    u32 dt1Mask = 0x05u + (u32)v;
    u32 dwFlags = (v >= 4) ? 0x200u : 0x40u;
    u32 dwPresetFlags = (u32)(v * 3);

    track_region(pLevel, 0x200);
    track_region(pDrlg, 0x490);
    track_region(pBox, 0x20);
    if (pMaze) track_region(pMaze, 0x20);
    track_region(pMap, 0x40);
    track_region(pLvlPrestTxt, 0x40);
    snapshot_pre();
    u32 ret = call_eax_esi_edi_stk4_u32(0x6FD5AE10u, pLevel, pBox, pMaze, pMap, dt1Mask, dwFlags, dwPresetFlags);
    char note[48];
    snprintf(note, sizeof(note), "init_preset_roomex_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u,%u]", pLevel, pBox, pMaze, pMap, dt1Mask, dwFlags, dwPresetFlags);
    emit_vector(fp, "0x6FD5AE10", "DRLGPRESET_InitPresetRoomEx113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F10: 0x6FD944F0 DRLGROOM_FlagIfAdjacentToTown113c */
  for (int v = 0; v < 7; v++) {
    reset_heap();
    u32 pRoomEx = heap_alloc(0x100);
    u32 pSelfLvl = heap_alloc(0x200);
    u32 pNear0 = heap_alloc(0x100);
    u32 pNear1 = heap_alloc(0x100);
    u32 pLvl0 = heap_alloc(0x200);
    u32 pLvl1 = heap_alloc(0x200);
    u32 ppList = heap_alloc(0x10);
    *(u32 *)(usize)(ppList + 0x00) = pNear0;
    *(u32 *)(usize)(ppList + 0x04) = pNear1;
    *(u32 *)(usize)(pRoomEx + 0x58) = pSelfLvl;
    *(s32 *)(usize)(pSelfLvl + 0x1D0) = 2; /* non-town by default */
    *(u32 *)(usize)(pNear0 + 0x58) = pLvl0;
    *(u32 *)(usize)(pNear1 + 0x58) = pLvl1;
    *(u32 *)(usize)(pRoomEx + 0x08) = ppList;
    *(u32 *)(usize)(pRoomEx + 0x28) = 0x0004u;

    if (v == 0) { *(s32 *)(usize)(pRoomEx + 0x2C) = 0; }
    else if (v == 1) { *(s32 *)(usize)(pRoomEx + 0x2C) = 2; *(s32 *)(usize)(pLvl0 + 0x1D0) = 2; *(s32 *)(usize)(pLvl1 + 0x1D0) = 3; }
    else if (v == 2) { *(s32 *)(usize)(pRoomEx + 0x2C) = 2; *(s32 *)(usize)(pLvl0 + 0x1D0) = 1; *(s32 *)(usize)(pLvl1 + 0x1D0) = 3; }
    else if (v == 3) { *(s32 *)(usize)(pRoomEx + 0x2C) = 2; *(s32 *)(usize)(pLvl0 + 0x1D0) = 2; *(s32 *)(usize)(pLvl1 + 0x1D0) = 40; }
    else if (v == 4) { *(s32 *)(usize)(pRoomEx + 0x2C) = 2; *(s32 *)(usize)(pLvl0 + 0x1D0) = 75; *(s32 *)(usize)(pLvl1 + 0x1D0) = 76; }
    else if (v == 5) { *(s32 *)(usize)(pRoomEx + 0x2C) = 2; *(s32 *)(usize)(pLvl0 + 0x1D0) = 103; *(s32 *)(usize)(pLvl1 + 0x1D0) = 104; }
    else { *(s32 *)(usize)(pSelfLvl + 0x1D0) = 1; *(s32 *)(usize)(pRoomEx + 0x2C) = 2; *(s32 *)(usize)(pLvl0 + 0x1D0) = 1; } /* self is town -> early return */

    track_region(pRoomEx, 0x100);
    track_region(pSelfLvl, 0x200);
    track_region(pNear0, 0x100);
    track_region(pNear1, 0x100);
    track_region(pLvl0, 0x200);
    track_region(pLvl1, 0x200);
    track_region(ppList, 0x10);
    snapshot_pre();
    call_edx_void(0x6FD944F0u, pRoomEx);
    char note[48];
    snprintf(note, sizeof(note), "flag_adj_town_v%d", v);
    snprintf(args, sizeof(args), "[%u]", pRoomEx);
    emit_vector(fp, "0x6FD944F0", "DRLGROOM_FlagIfAdjacentToTown113c", v, note, args, 0u, 0u);
  }

  /* F11: 0x6FD94B20 DRLGROOM_InsertOrthSorted113c */
  for (int v = 0; v < 7; v++) {
    reset_heap();
    u32 ppHead = heap_alloc(0x10);
    u32 n0 = heap_alloc(0x30), b0 = heap_alloc(0x20);
    u32 n1 = heap_alloc(0x30), b1 = heap_alloc(0x20);
    u32 nNew = heap_alloc(0x30), bNew = heap_alloc(0x20);
    *(u32 *)(usize)(n0 + 0x10) = b0;
    *(u32 *)(usize)(n1 + 0x10) = b1;
    *(u32 *)(usize)(nNew + 0x10) = bNew;
    *(s32 *)(usize)(n0 + 0x04) = 1; /* dir 1: compares nPosX ascending */
    *(s32 *)(usize)(n1 + 0x04) = 2; /* dir 2: compares nPosY ascending */
    *(s32 *)(usize)(b0 + 0x00) = 10; *(s32 *)(usize)(b0 + 0x04) = 10;
    *(s32 *)(usize)(b1 + 0x00) = 15; *(s32 *)(usize)(b1 + 0x04) = 15;

    if (v == 0) {
      *(u32 *)(usize)ppHead = 0u;
      *(u32 *)(usize)(nNew + 0x14) = 0xDEADBEEFu; /* preserved when *ppHead == 0 */
    } else if (v == 1) {
      /* 1-element list, nNew < n0 (dir 0 < dir 1) -> prepends before head */
      *(u32 *)(usize)ppHead = n0;
      *(u32 *)(usize)(n0 + 0x14) = 0u;
      *(s32 *)(usize)(nNew + 0x04) = 0;
    } else if (v == 2) {
      /* 1-element list, nNew > n0 (dir 2 > dir 1) -> appends after head */
      *(u32 *)(usize)ppHead = n0;
      *(u32 *)(usize)(n0 + 0x14) = 0u;
      *(s32 *)(usize)(nNew + 0x04) = 2;
    } else {
      *(u32 *)(usize)ppHead = n0;
      *(u32 *)(usize)(n0 + 0x14) = n1;
      *(u32 *)(usize)(n1 + 0x14) = 0u;
      if (v == 3) { /* dir 1 < n1(dir 2) -> splices between n0 and n1 */
        *(s32 *)(usize)(nNew + 0x04) = 1; *(s32 *)(usize)(bNew + 0x00) = 12;
      } else if (v == 4) { /* dir 3 > n1(dir 2) -> appends after tail n1 */
        *(s32 *)(usize)(nNew + 0x04) = 3; *(s32 *)(usize)(bNew + 0x00) = 20;
      } else if (v == 5) { /* dir 2 == n1(dir 2), bNew.nPosY(5) < b1.nPosY(15) -> before n1 */
        *(s32 *)(usize)(nNew + 0x04) = 2; *(s32 *)(usize)(bNew + 0x04) = 5;
      } else { /* dir 2 == n1(dir 2), bNew.nPosY(25) > b1.nPosY(15) -> after n1 */
        *(s32 *)(usize)(nNew + 0x04) = 2; *(s32 *)(usize)(bNew + 0x04) = 25;
      }
    }

    track_region(ppHead, 0x10);
    track_region(n0, 0x30); track_region(b0, 0x20);
    track_region(n1, 0x30); track_region(b1, 0x20);
    track_region(nNew, 0x30); track_region(bNew, 0x20);
    snapshot_pre();
    call_ebx_stk1_void(0x6FD94B20u, nNew, ppHead);
    char note[48];
    snprintf(note, sizeof(note), "insert_orth_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u]", nNew, ppHead);
    emit_vector(fp, "0x6FD94B20", "DRLGROOM_InsertOrthSorted113c", v, note, args, 0u, 0u);
  }

  /* F12: 0x6FD94BA0 DRLGROOM_LinkRoomsBidirectional113c */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    u32 rA = heap_alloc(0x100);
    u32 rB = heap_alloc(0x100);
    u32 pLevel = heap_alloc(0x200);
    u32 pDrlg = heap_alloc(0x490);
    *(u32 *)(usize)(rA + 0x58) = pLevel;
    *(u32 *)(usize)(rB + 0x58) = pLevel;
    *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32 *)(usize)(pDrlg + 0x478) = 0xCAFE0000u;
    *(s32 *)(usize)(rA + 0x34) = 10 + v * 2;
    *(s32 *)(usize)(rA + 0x38) = 20 + v * 3;
    *(s32 *)(usize)(rA + 0x3C) = 8;
    *(s32 *)(usize)(rA + 0x40) = 12;
    *(s32 *)(usize)(rB + 0x34) = 30 + v * 2;
    *(s32 *)(usize)(rB + 0x38) = 40 + v * 3;
    *(s32 *)(usize)(rB + 0x3C) = 10;
    *(s32 *)(usize)(rB + 0x40) = 14;
    s32 nDir = v % 4;
    if (v >= 4) {
      /* pre-populate an existing orth node on rA */
      u32 oldOrth = heap_alloc(0x30);
      u32 oldBox = heap_alloc(0x20);
      *(u32 *)(usize)(oldOrth + 0x10) = oldBox;
      *(s32 *)(usize)(oldBox + 0x00) = (v == 4) ? 5 : 100;
      *(u32 *)(usize)(rA + 0x00) = oldOrth;
      track_region(oldOrth, 0x30);
      track_region(oldBox, 0x20);
    }
    track_region(rA, 0x100);
    track_region(rB, 0x100);
    track_region(pLevel, 0x200);
    track_region(pDrlg, 0x490);
    snapshot_pre();
    call_eax_ecx_ebx_void(0x6FD94BA0u, (u32)nDir, rB, rA);
    char note[48];
    snprintf(note, sizeof(note), "link_rooms_bidir_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u]", (u32)nDir, rB, rA);
    emit_vector(fp, "0x6FD94BA0", "DRLGROOM_LinkRoomsBidirectional113c", v, note, args, 0u, 0u);
  }

  /* F13: 0x6FDD3630 DRLGROOM_CopyPresetUnitsInTileBox113c */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    u32 pTileBox = heap_alloc(0x20);
    u32 ppRoomEx = heap_alloc(0x10);
    u32 pRoomEx = heap_alloc(0x100);
    u32 pSrc = heap_alloc(0x80);
    u32 pSrcInner = heap_alloc(0x80);
    u32 u1 = heap_alloc(0x30);
    u32 u2 = heap_alloc(0x30);
    *(u32 *)(usize)ppRoomEx = pRoomEx;
    *(u32 *)(usize)(pSrc + 0x50) = pSrcInner;
    *(s32 *)(usize)(pTileBox + 0x00) = 10; /* boxX = 50 */
    *(s32 *)(usize)(pTileBox + 0x04) = 20; /* boxY = 100 */
    *(s32 *)(usize)(pTileBox + 0x08) = 4;  /* boxW = 20 -> subtile X (50..70) */
    *(s32 *)(usize)(pTileBox + 0x0C) = 6;  /* boxH = 30 -> subtile Y (100..130) */

    /* D2PresetUnitStrc: +0x00=nMode, +0x04=nTxtFileNo, +0x08=nXpos, +0x0C=pNext, +0x14=nUnitType, +0x18=nYpos */
    *(s32 *)(usize)(u1 + 0x00) = 1; *(s32 *)(usize)(u1 + 0x04) = 101;
    *(s32 *)(usize)(u1 + 0x08) = 55; *(u32 *)(usize)(u1 + 0x0C) = u2;
    *(s32 *)(usize)(u1 + 0x14) = 2;  *(s32 *)(usize)(u1 + 0x18) = 110;

    *(s32 *)(usize)(u2 + 0x00) = 2; *(s32 *)(usize)(u2 + 0x04) = 202;
    *(s32 *)(usize)(u2 + 0x08) = (v == 2) ? 65 : 50; /* 50 == boxX -> excluded! 65 -> inside */
    *(u32 *)(usize)(u2 + 0x0C) = 0u;
    *(s32 *)(usize)(u2 + 0x14) = 1; *(s32 *)(usize)(u2 + 0x18) = 120;

    if (v == 0) { *(u32 *)(usize)(pSrcInner + 0x54) = 0u; }
    else if (v == 1) { *(u32 *)(usize)(pSrcInner + 0x54) = u1; }
    else if (v == 2) { *(u32 *)(usize)(pSrcInner + 0x54) = u1; }
    else if (v == 3) { *(u32 *)(usize)(pSrcInner + 0x54) = u1; *(s32 *)(usize)(u1 + 0x08) = 70; } /* ux == endX -> excluded */
    else if (v == 4) { *(u32 *)(usize)(pSrcInner + 0x54) = u1; *(s32 *)(usize)(u1 + 0x18) = 130; } /* uy == endY -> excluded */
    else { *(u32 *)(usize)(pSrcInner + 0x54) = u1; *(u32 *)(usize)(pRoomEx + 0x5C) = 0xDEADBEEFu; }

    s32 dstX = 12 + v, dstY = 15 + v;
    track_region(pTileBox, 0x20);
    track_region(ppRoomEx, 0x10);
    track_region(pRoomEx, 0x100);
    track_region(pSrc, 0x80);
    track_region(pSrcInner, 0x80);
    track_region(u1, 0x30);
    track_region(u2, 0x30);
    snapshot_pre();
    call_eax_ecx_edx_stk3_void(0x6FDD3630u, pTileBox, (u32)dstY, (u32)dstX, ppRoomEx, 0xCAFE0000u, pSrc);
    char note[48];
    snprintf(note, sizeof(note), "copy_preset_units_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u]", pTileBox, (u32)dstY, (u32)dstX, ppRoomEx, 0xCAFE0000u, pSrc);
    emit_vector(fp, "0x6FDD3630", "DRLGROOM_CopyPresetUnitsInTileBox113c", v, note, args, 0u, 0u);
  }

  /* F14: 0x6FD92A20 DRLGOUTDOORS_GetLevelLinkVisBit113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 7; v++) {
    reset_heap();
    u32 pLevel = heap_alloc(0x200);
    u32 pAdj = heap_alloc(0x200);
    u32 pDrlg = heap_alloc(0x100);
    u32 pWarp = heap_alloc(0x60);
    *(s32 *)(usize)(pLevel + 0x1D0) = 5;
    *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32 *)(usize)(pDrlg + 0x90) = pWarp;
    *(s32 *)(usize)(pWarp + 0x00) = 5; /* matches nLevelId == 5, so 0x6FD94CE0 returns pWarp + 4 */
    *(s32 *)(usize)(pAdj + 0x1D0) = 100 + v;
    for (int i = 0; i < 8; i++) {
      *(s32 *)(usize)(pWarp + 0x04 + (u32)(i * 4)) = 200 + i;
    }
    if (v < 6) {
      int matchIdx = (v == 5) ? 7 : v;
      *(s32 *)(usize)(pWarp + 0x04 + (u32)(matchIdx * 4)) = 100 + v;
    }
    track_region(pLevel, 0x200);
    track_region(pAdj, 0x200);
    track_region(pDrlg, 0x100);
    track_region(pWarp, 0x60);
    snapshot_pre();
    u32 ret = call_eax_stk1_u32(0x6FD92A20u, pLevel, pAdj);
    char note[48];
    snprintf(note, sizeof(note), "get_lvl_link_vis_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u]", pLevel, pAdj);
    emit_vector(fp, "0x6FD92A20", "DRLGOUTDOORS_GetLevelLinkVisBit113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F15: 0x6FDB9170 DRLGROOMTILE_InitFloorTileData113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 7; v++) {
    reset_heap();
    u32 pRoomEx = heap_alloc(0x100);
    u32 pTileGrid = heap_alloc(0x40);
    u32 pFloors = heap_alloc(4 * 0x30);
    u32 ppList = (v % 2 == 0) ? heap_alloc(0x10) : 0u;
    u32 pTileCache = heap_alloc(0x20);
    *(u32 *)(usize)(pRoomEx + 0x54) = pTileGrid;
    *(s32 *)(usize)(pRoomEx + 0x34) = 10;
    *(s32 *)(usize)(pRoomEx + 0x38) = 20;
    *(s32 *)(usize)(pTileGrid + 0x0C) = v % 3;
    *(u32 *)(usize)(pTileGrid + 0x1C) = pFloors;
    if (ppList) *(u32 *)(usize)ppList = (v == 2) ? 0x11223344u : 0u;
    *(u16 *)(usize)(pTileCache + 0x06) = (v == 3) ? 1u : (v == 4) ? 4u : (v == 5) ? 5u : 0u;
    u32 dwTileFlags = 0u;
    if (v == 0) dwTileFlags = 0x80u;
    else if (v == 1) dwTileFlags = 0x10000000u | 0x20000u;
    else if (v == 2) dwTileFlags = 0x10000u | 0x08u | (2u << 18);
    else if (v == 3) dwTileFlags = 0x80000000u;
    else if (v == 4) dwTileFlags = 0x04000000u;
    else if (v == 5) dwTileFlags = 0x20000000u | 0x04u;
    else dwTileFlags = (3u << 18) | 0x80u | 0x04u;

    s32 nx = 14 + v, ny = 22 + v * 2;
    track_region(pRoomEx, 0x100);
    track_region(pTileGrid, 0x40);
    track_region(pFloors, 4 * 0x30);
    if (ppList) track_region(ppList, 0x10);
    track_region(pTileCache, 0x20);
    snapshot_pre();
    u32 ret = call_eax_ecx_stk4_u32(0x6FDB9170u, pRoomEx, ppList, (u32)nx, (u32)ny, dwTileFlags, pTileCache);
    char note[48];
    snprintf(note, sizeof(note), "init_floor_tile_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u]", pRoomEx, ppList, (u32)nx, (u32)ny, dwTileFlags, pTileCache);
    emit_vector(fp, "0x6FDB9170", "DRLGROOMTILE_InitFloorTileData113c", v, note, args, ret, 0xFFFFFFFFu);
  }
}

static void emit_i10c_2(FILE *fp) {
  char args[256];

  /* F16: 0x6FD9D6E0 COLLISION_MoveUnitCollisionMask113c (retMask 0xFFFF) */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    s32 ox = 103, oy = 103, nx = 106, ny = 106, pat = 1;
    u32 footMask = 0x0100u, moveMask = 0x1C01u;
    /* Pre-set footprint at old pos */
    ((fn_std5_void_t)(usize)0x6FD9BE90u)(w.r[4], (u32)ox, (u32)oy, (u32)(v % 5), footMask);
    if (v == 0) { pat = 0; }
    else if (v == 1) { pat = 1; }
    else if (v == 2) { pat = 2; }
    else if (v == 3) { pat = 3; }
    else if (v == 4) { pat = 4; }
    else if (v == 5) { pat = 1; set_world_cell(&w, 106, 106, 0x0001u); } /* blocked at new pos -> restores old */
    else if (v == 6) { pat = 2; set_world_cell(&w, 107, 106, 0x0400u); } /* blocked at new pos -> restores old */
    else { pat = 1; ox = 100; oy = 100; nx = 99; ny = 99; } /* cross-room move */
    snapshot_pre();
    u32 ret = call_ecx_edx_stk6_u32(
      0x6FD9D6E0u, w.r[4], (u32)ox, (u32)oy, (u32)nx, (u32)ny, (u32)pat, footMask, moveMask
    );
    char note[48];
    snprintf(note, sizeof(note), "move_unit_coll_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u,%u,%u]",
      w.r[4], (u32)ox, (u32)oy, (u32)nx, (u32)ny, (u32)pat, footMask, moveMask);
    emit_vector(fp, "0x6FD9D6E0", "COLLISION_MoveUnitCollisionMask113c", v, note, args, ret, 0xFFFFu);
  }

  /* F17: 0x6FD5DC80 PATH_StopMovementAndSnapToTileCenter113c */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    u32 pActFlag = heap_alloc(0x10);
    u32 rA = heap_alloc(0x80);
    u32 rB = heap_alloc(0x80);
    u32 nearA = heap_alloc(0x10);
    u32 pPath = heap_alloc(0x100);
    u32 pUnit = heap_alloc(0x100);
    init_room_sub(rA, 100, 100, 40, 40, pActFlag);
    init_room_sub(rB, 140, 100, 40, 40, pActFlag);
    *(u32 *)(usize)nearA = rA;
    *(u32 *)(usize)(nearA + 4) = rB;
    *(u32 *)(usize)(rA + 0x00) = nearA;
    *(u32 *)(usize)(rA + 0x24) = 2u;
    *(u32 *)(usize)(pUnit + 0x00) = 1u;
    *(u32 *)(usize)(pUnit + 0x2C) = pPath;
    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x1C) = rA;
    *(u32 *)(usize)(rA + 0x74) = pUnit;
    *(u32 *)(usize)(pPath + 0x24) = 3u;
    *(u32 *)(usize)(pPath + 0x28) = 7u;
    *(u32 *)(usize)(pPath + 0x34) = 0x35u;
    *(u32 *)(usize)(pPath + 0x72) = 0x1234u;
    *(u32 *)(usize)(pPath + 0x76) = 0x5678u;

    if (v == 0) { *(u32 *)(usize)(pPath + 0x00) = (110u << 16) | 0x1111u; *(u32 *)(usize)(pPath + 0x04) = (115u << 16) | 0x2222u; }
    else if (v == 1) { *(u32 *)(usize)(pPath + 0x00) = (145u << 16) | 0xF000u; *(u32 *)(usize)(pPath + 0x04) = (115u << 16) | 0x0100u; }
    else if (v == 2) { *(u32 *)(usize)(pPath + 0x00) = 0x1234u; *(u32 *)(usize)(pPath + 0x04) = (115u << 16) | 0x4000u; }
    else if (v == 3) { *(u32 *)(usize)(pPath + 0x00) = (120u << 16) | 0x8000u; *(u32 *)(usize)(pPath + 0x04) = (125u << 16) | 0x8000u; *(u32 *)(usize)(pPath + 0x34) = 0x10u; }
    else if (v == 4) { *(u32 *)(usize)(pPath + 0x00) = (300u << 16) | 0x3333u; *(u32 *)(usize)(pPath + 0x04) = (300u << 16) | 0x4444u; *(u32 *)(usize)(pPath + 0x34) = 0x40020u; }
    else { *(u32 *)(usize)(pPath + 0x00) = (100u << 16) | 0xFFFFu; *(u32 *)(usize)(pPath + 0x04) = (139u << 16) | 0x0001u; }

    track_region(pActFlag, 0x10);
    track_region(rA, 0x80);
    track_region(rB, 0x80);
    track_region(nearA, 0x10);
    track_region(pPath, 0x100);
    track_region(pUnit, 0x100);
    snapshot_pre();
    call_eax_void(0x6FD5DC80u, pPath);
    char note[48];
    snprintf(note, sizeof(note), "stop_and_snap_v%d", v);
    snprintf(args, sizeof(args), "[%u]", pPath);
    emit_vector(fp, "0x6FD5DC80", "PATH_StopMovementAndSnapToTileCenter113c", v, note, args, 0u, 0u);
  }

  /* F18: 0x6FD686D0 PATH_FindNonCollidingTargetPoint113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pInfo = heap_alloc(0x40);
    u32 pDynPath = heap_alloc(0x60);
    u32 pUnit = heap_alloc(0x40);
    u32 pMov = heap_alloc(0x20);
    u32 pNextDirTbl = heap_alloc(8 * 4);
    *(u32 *)(usize)pUnit = (v % 2 == 0) ? 0u : 1u;
    *(u32 *)(usize)(pDynPath + 0x30) = pUnit;
    *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
    *(u32 *)(usize)(pInfo + 0x28) = 0u; /* pattern 0 */
    *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
    *(u32 *)(usize)(pInfo + 0x30) = pDynPath;
    for (int i = 0; i < 8; i++) *(u32 *)(usize)(pNextDirTbl + (u32)(i * 4)) = (u32)((i + 1) & 7);
    *(u32 *)(usize)(pMov + 0x00) = 0u; /* initial dir 0 -> (+1, 0) using 0x6FDDCA38 */
    *(u16 *)(usize)(pMov + 0x08) = 104u;
    *(u16 *)(usize)(pMov + 0x0A) = 104u;
    *(u32 *)(usize)(pMov + 0x10) = 99u;
    *(u32 *)(usize)(pMov + 0x18) = pNextDirTbl;

    /* 0x6FDDCA38 dirs from (104,104):
     * dir 0: (105,104), dir 1: (105,103), dir 2: (104,103), dir 3: (103,103) */
    if (v == 0) { /* probe 1 succeeds */ }
    else if (v == 1) { set_world_cell(&w, 105, 104, 1u); } /* probe 2 succeeds */
    else if (v == 2) { set_world_cell(&w, 105, 104, 1u); set_world_cell(&w, 105, 103, 1u); } /* probe 3 succeeds */
    else if (v == 3) { set_world_cell(&w, 105, 104, 1u); set_world_cell(&w, 105, 103, 1u); set_world_cell(&w, 104, 103, 1u); } /* probe 4 succeeds */
    else if (v == 4) {
      set_world_cell(&w, 105, 104, 1u); set_world_cell(&w, 105, 103, 1u);
      set_world_cell(&w, 104, 103, 1u); set_world_cell(&w, 103, 103, 1u);
    } /* all 4 fail -> returns 0 */
    else { *(u32 *)(usize)(pMov + 0x00) = 4u; set_world_cell(&w, 103, 104, 1u); }

    track_region(pInfo, 0x40);
    track_region(pDynPath, 0x60);
    track_region(pUnit, 0x40);
    track_region(pMov, 0x20);
    track_region(pNextDirTbl, 8 * 4);
    snapshot_pre();
    u32 ret = call_eax_esi_u32(0x6FD686D0u, pInfo, pMov);
    char note[48];
    snprintf(note, sizeof(note), "find_noncoll_target_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u]", pInfo, pMov);
    emit_vector(fp, "0x6FD686D0", "PATH_FindNonCollidingTargetPoint113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F19: 0x6FD85780 PATH_ComputeSpecialFlag40000Path113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    u32 pPath = heap_alloc(0x200);
    u32 pRoom = heap_alloc(0x80);
    u32 pUnit = heap_alloc(0x60);
    *(s32 *)(usize)(pRoom + 0x4C) = 100;
    *(s32 *)(usize)(pRoom + 0x50) = 100;
    *(s32 *)(usize)(pRoom + 0x54) = 40;
    *(s32 *)(usize)(pRoom + 0x58) = 40;
    *(u32 *)(usize)(pPath + 0x00) = fx_center(110);
    *(u32 *)(usize)(pPath + 0x04) = fx_center(110);
    *(u32 *)(usize)(pPath + 0x1C) = pRoom;
    *(u32 *)(usize)(pPath + 0x7C) = 0x800u;
    *(u16 *)(usize)(pPath + 0x10) = 120u;
    *(u16 *)(usize)(pPath + 0x12) = 125u;
    *(u8 *)(usize)(pPath + 0x91) = 10u;
    *(u32 *)(usize)(pUnit + 0x20) = 0x12345678u + (u32)v;
    *(u32 *)(usize)(pUnit + 0x24) = 0x9ABCDEF0u;

    if (v == 0) { *(s32 *)(usize)(pPath + 0x3C) = 4; } /* type 4 success */
    else if (v == 1) { *(s32 *)(usize)(pPath + 0x3C) = 4; *(u32 *)(usize)(pPath + 0x34) = 0x20u; *(u16 *)(usize)(pPath + 0x10) = 0u; } /* type 4 fail clears 0x20 */
    else if (v == 2) { *(s32 *)(usize)(pPath + 0x3C) = 10; *(u8 *)(usize)(pPath + 0x91) = 8u; } /* type 10 charged bolt */
    else if (v == 3) { *(s32 *)(usize)(pPath + 0x3C) = 10; *(u8 *)(usize)(pPath + 0x91) = 14u; *(u16 *)(usize)(pPath + 0x10) = 95u; }
    else if (v == 4) { *(s32 *)(usize)(pPath + 0x3C) = 14; track_region(0x6FF7F470u, 512u * 4u); } /* type 14 spiral 77 pts */
    else { *(s32 *)(usize)(pPath + 0x3C) = 14; *(u32 *)(usize)(pPath + 0x00) = fx_center(200); track_region(0x6FF7F470u, 512u * 4u); }

    track_region(pPath, 0x200);
    track_region(pRoom, 0x80);
    track_region(pUnit, 0x60);
    snapshot_pre();
    u32 ret = call_edi_stk1_u32(0x6FD85780u, pPath, pUnit);
    char note[48];
    snprintf(note, sizeof(note), "special_40000_path_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u]", pPath, pUnit);
    emit_vector(fp, "0x6FD85780", "PATH_ComputeSpecialFlag40000Path113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F20: 0x6FD85800 PATH_RemoveUnitCollisionFootprint113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    for (int y = 100; y < 110; y++)
      for (int x = 100; x < 110; x++)
        set_world_cell(&w, x, y, 0xFFFFu);
    u32 pUnit = heap_alloc(0x80);
    u32 pPath = heap_alloc(0x80);
    u32 pObjData = heap_alloc(0x20);
    u32 pObjTxt = heap_alloc(0x1C0);
    *(u32 *)(usize)(pObjData + 0x00) = pObjTxt;
    *(u32 *)(usize)(pUnit + 0x14) = pObjData;
    *(u32 *)(usize)(pUnit + 0x2C) = pPath;
    *(u16 *)(usize)(pPath + 0x02) = 104u;   /* DynamicPath->wPosX */
    *(u16 *)(usize)(pPath + 0x06) = 104u;   /* DynamicPath->wPosY */
    *(s32 *)(usize)(pPath + 0x0C) = 104;    /* StaticPath->nXPos */
    *(s32 *)(usize)(pPath + 0x10) = 104;    /* StaticPath->nYPos */
    *(u32 *)(usize)(pPath + 0x1C) = w.r[4]; /* DynamicPath->pRoom */
    *(u32 *)(usize)(pPath + 0x48) = 1u;     /* dwCollisionPattern */
    *(u32 *)(usize)(pPath + 0x4C) = 0x0100u;/* nFootprintCollisionMask */

    u32 bForce = 0u;
    if (v == 0) { *(u32 *)(usize)pUnit = 0u; *(u32 *)(usize)(pUnit + 0x10) = 17u; bForce = 0u; } /* dead player -> 0 */
    else if (v == 1) { *(u32 *)(usize)pUnit = 0u; *(u32 *)(usize)(pUnit + 0x10) = 17u; bForce = 1u; } /* dead player forced -> 1 */
    else if (v == 2) { *(u32 *)(usize)pUnit = 1u; *(u32 *)(usize)(pUnit + 0x10) = 12u; bForce = 0u; } /* dead monster -> 0 */
    else if (v == 3) { *(u32 *)(usize)pUnit = 1u; *(u32 *)(usize)(pUnit + 0x10) = 2u; } /* live monster -> 1 */
    else if (v == 4) { *(u32 *)(usize)pUnit = 2u; *(u32 *)(usize)(pPath + 0x00) = w.r[4]; *(u32 *)(usize)(pUnit + 0x10) = 1u; *(u8 *)(usize)(pObjTxt + 0x121) = 0u; bForce = 0u; } /* object no coll -> 0 */
    else if (v == 5) {
      *(u32 *)(usize)pUnit = 2u; *(u32 *)(usize)(pPath + 0x00) = w.r[4]; *(u32 *)(usize)(pUnit + 0x10) = 1u; *(u8 *)(usize)(pObjTxt + 0x121) = 1u;
      *(s32 *)(usize)(pObjTxt + 0xD0) = 2; *(s32 *)(usize)(pObjTxt + 0xD4) = 2; *(u8 *)(usize)(pObjTxt + 0x13A) = 1u; *(u8 *)(usize)(pObjTxt + 0x13B) = 1u;
    }
    else if (v == 6) { *(u32 *)(usize)pUnit = 4u; *(u32 *)(usize)(pPath + 0x00) = w.r[4]; } /* item (uType 4) -> sizeX=1, mask=0x200 */
    else { *(u32 *)(usize)pUnit = 5u; *(u32 *)(usize)(pPath + 0x00) = w.r[4]; } /* tile (uType 5) -> sizeX=0, mask=0x1 */

    track_region(pUnit, 0x80);
    track_region(pPath, 0x80);
    track_region(pObjData, 0x20);
    track_region(pObjTxt, 0x1C0);
    snapshot_pre();
    u32 ret = ((fn_std2_u32_t)(usize)0x6FD85800u)(pUnit, bForce);
    char note[48];
    snprintf(note, sizeof(note), "remove_footprint_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u]", pUnit, bForce);
    emit_vector(fp, "0x6FD85800", "PATH_RemoveUnitCollisionFootprint113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F21: 0x6FD859D0 PATH_AddUnitCollisionFootprint113c */
  for (int v = 0; v < 7; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pUnit = heap_alloc(0x80);
    u32 pPath = heap_alloc(0x80);
    u32 pObjData = heap_alloc(0x20);
    u32 pObjTxt = heap_alloc(0x1C0);
    *(u32 *)(usize)(pObjData + 0x00) = pObjTxt;
    *(u32 *)(usize)(pUnit + 0x14) = pObjData;
    *(u32 *)(usize)(pUnit + 0x2C) = pPath;
    *(u16 *)(usize)(pPath + 0x02) = 104u;
    *(u16 *)(usize)(pPath + 0x06) = 104u;
    *(s32 *)(usize)(pPath + 0x0C) = 104;
    *(s32 *)(usize)(pPath + 0x10) = 104;
    *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
    *(u32 *)(usize)(pPath + 0x48) = (u32)(v % 5);
    *(u32 *)(usize)(pPath + 0x4C) = 0x0100u;

    if (v == 0) { *(u32 *)(usize)pUnit = 0u; *(u32 *)(usize)(pPath + 0x48) = 1u; *(u32 *)(usize)(pPath + 0x4C) = 0x0080u; }
    else if (v == 1) { *(u32 *)(usize)pUnit = 1u; *(u32 *)(usize)(pPath + 0x48) = 2u; *(u32 *)(usize)(pPath + 0x4C) = 0x0100u; }
    else if (v == 2) { *(u32 *)(usize)pUnit = 1u; *(u32 *)(usize)(pPath + 0x48) = 4u; *(u32 *)(usize)(pPath + 0x4C) = 0x0100u; }
    else if (v == 3) { *(u32 *)(usize)pUnit = 2u; *(u32 *)(usize)(pPath + 0x00) = w.r[4]; *(u32 *)(usize)(pUnit + 0x10) = 1u; *(u8 *)(usize)(pObjTxt + 0x121) = 0u; }
    else if (v == 4) {
      *(u32 *)(usize)pUnit = 2u; *(u32 *)(usize)(pPath + 0x00) = w.r[4]; *(u32 *)(usize)(pUnit + 0x10) = 1u; *(u8 *)(usize)(pObjTxt + 0x121) = 1u;
      *(s32 *)(usize)(pObjTxt + 0xD0) = 2; *(s32 *)(usize)(pObjTxt + 0xD4) = 2; *(u8 *)(usize)(pObjTxt + 0x13A) = 1u; *(u8 *)(usize)(pObjTxt + 0x13B) = 1u;
    }
    else if (v == 5) { *(u32 *)(usize)pUnit = 4u; *(u32 *)(usize)(pPath + 0x00) = w.r[4]; }
    else { *(u32 *)(usize)pUnit = 5u; *(u32 *)(usize)(pPath + 0x00) = w.r[4]; }

    track_region(pUnit, 0x80);
    track_region(pPath, 0x80);
    track_region(pObjData, 0x20);
    track_region(pObjTxt, 0x1C0);
    snapshot_pre();
    ((fn_std1_void_t)(usize)0x6FD859D0u)(pUnit);
    char note[48];
    snprintf(note, sizeof(note), "add_footprint_v%d", v);
    snprintf(args, sizeof(args), "[%u]", pUnit);
    emit_vector(fp, "0x6FD859D0", "PATH_AddUnitCollisionFootprint113c", v, note, args, 0u, 0u);
  }

  /* F22: 0x6FD85D40 PATH_NudgeTargetOutOfImmediateCollision113c */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pInfo = heap_alloc(0x40);
    *(u16 *)(usize)(pInfo + 0x00) = 104u; /* startX */
    *(u16 *)(usize)(pInfo + 0x02) = 104u; /* startY */
    *(u16 *)(usize)(pInfo + 0x04) = 106u; /* targetX */
    *(u16 *)(usize)(pInfo + 0x06) = 104u; /* targetY */
    *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
    *(u32 *)(usize)(pInfo + 0x28) = 0u;
    *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;

    if (v == 0) { *(u16 *)(usize)(pInfo + 0x00) = 106u; } /* start == target -> noop */
    else if (v == 1) { *(u16 *)(usize)(pInfo + 0x04) = 109u; } /* |dx| == 5 -> noop */
    else if (v == 2) { /* dx=2, dy=0: all clear -> nudges 3 steps to (109, 104) */ }
    else if (v == 3) { set_world_cell(&w, 107, 104, 1u); } /* blocked on 1st step -> unchanged (106, 104) */
    else if (v == 4) { set_world_cell(&w, 108, 104, 1u); } /* nudges 1 step to (107, 104), then blocked */
    else {
      /* negative dx=-1, dy=-2 (target=(103, 102)) nudging outward */
      *(u16 *)(usize)(pInfo + 0x04) = 103u;
      *(u16 *)(usize)(pInfo + 0x06) = 102u;
    }

    track_region(pInfo, 0x40);
    snapshot_pre();
    call_esi_void(0x6FD85D40u, pInfo);
    char note[48];
    snprintf(note, sizeof(note), "nudge_target_v%d", v);
    snprintf(args, sizeof(args), "[%u]", pInfo);
    emit_vector(fp, "0x6FD85D40", "PATH_NudgeTargetOutOfImmediateCollision113c", v, note, args, 0u, 0u);
  }

  /* F23: 0x6FDB6C20 PATH_RaycastGridLineCollision113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pDynPath = heap_alloc(0x80);
    u32 pInOutTarget = heap_alloc(0x10);
    *(u32 *)(usize)(pDynPath + 0x1C) = w.r[4];
    *(u32 *)(usize)(pDynPath + 0x48) = 0u;
    *(u32 *)(usize)(pDynPath + 0x50) = 0x1C01u; /* nMoveTestCollisionMask (+0x50) */

    u32 startPt = (102u | (102u << 16));
    u32 targetPt = (107u | (102u << 16));
    if (v == 0) { targetPt = (107u | (102u << 16)); } /* horizontal clear */
    else if (v == 1) { targetPt = (107u | (102u << 16)); set_world_cell(&w, 105, 102, 1u); } /* horizontal hit */
    else if (v == 2) { targetPt = (102u | (107u << 16)); } /* vertical clear */
    else if (v == 3) { targetPt = (102u | (107u << 16)); set_world_cell(&w, 102, 105, 1u); } /* vertical hit */
    else if (v == 4) { targetPt = (106u | (106u << 16)); } /* diagonal clear */
    else if (v == 5) { targetPt = (106u | (106u << 16)); set_world_cell(&w, 104, 104, 1u); } /* diagonal hit */
    else if (v == 6) { targetPt = (107u | (104u << 16)); set_world_cell(&w, 105, 103, 1u); } /* X-major Bresenham hit */
    else { targetPt = (104u | (107u << 16)); set_world_cell(&w, 103, 105, 1u); } /* Y-major Bresenham hit */
    *(u32 *)(usize)pInOutTarget = targetPt;

    track_region(pDynPath, 0x80);
    track_region(pInOutTarget, 0x10);
    snapshot_pre();
    u32 ret = call_eax_stk2_u32(0x6FDB6C20u, pDynPath, startPt, pInOutTarget);
    char note[48];
    snprintf(note, sizeof(note), "raycast_grid_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u]", pDynPath, startPt, pInOutTarget);
    emit_vector(fp, "0x6FDB6C20", "PATH_RaycastGridLineCollision113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F24: 0x6FDB71B0 PATH_PickStepDirectionCandidate3_113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pInfo = heap_alloc(0x40);
    u32 pDynPath = heap_alloc(0x60);
    u32 pUnit = heap_alloc(0x40);
    u32 pCand = heap_alloc(0x10);
    u32 pOutDir = heap_alloc(0x10);
    *(u32 *)(usize)pUnit = (v % 2 == 0) ? 0u : 1u;
    *(u32 *)(usize)(pDynPath + 0x30) = pUnit;
    *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
    *(u32 *)(usize)(pInfo + 0x28) = 0u;
    *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
    *(u32 *)(usize)(pInfo + 0x30) = pDynPath;
    *(u32 *)(usize)(pCand + 0x00) = 0u; /* (105, 104) */
    *(u32 *)(usize)(pCand + 0x04) = 2u; /* (104, 105) */
    *(u32 *)(usize)(pCand + 0x08) = 4u; /* (103, 104) */
    *(u32 *)(usize)pOutDir = 99u;
    u32 curPt = (104u | (104u << 16));

    if (v == 0) { /* cand 0 free */ }
    else if (v == 1) { set_world_cell(&w, 105, 104, 1u); } /* cand 1 free */
    else if (v == 2) { set_world_cell(&w, 105, 104, 1u); set_world_cell(&w, 104, 105, 1u); } /* cand 2 free */
    else if (v == 3) {
      set_world_cell(&w, 105, 104, 1u); set_world_cell(&w, 104, 105, 1u); set_world_cell(&w, 103, 104, 1u);
    } /* all 3 blocked -> 0 */
    else if (v == 4) { *(u32 *)(usize)(pCand + 0x00) = 1u; *(u32 *)(usize)(pCand + 0x08) = 0xFFu; } /* cand 0 free so cand[2]==0xFF not reached */
    else { *(u32 *)(usize)(pCand + 0x00) = 6u; set_world_cell(&w, 104, 103, 1u); }

    track_region(pInfo, 0x40);
    track_region(pDynPath, 0x60);
    track_region(pUnit, 0x40);
    track_region(pCand, 0x10);
    track_region(pOutDir, 0x10);
    snapshot_pre();
    u32 ret = call_eax_stk3_u32(0x6FDB71B0u, pInfo, curPt, pCand, pOutDir);
    char note[48];
    snprintf(note, sizeof(note), "pick_step_cand3_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pInfo, curPt, pCand, pOutDir);
    emit_vector(fp, "0x6FDB71B0", "PATH_PickStepDirectionCandidate3_113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F25: 0x6FDC08F0 PATH_IdaStar_SearchLoop113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pCtx = heap_alloc(0x37000);
    u32 pInfo = heap_alloc(0x40);
    u32 pSeed = heap_alloc(0x10);
    u32 root = pCtx + 0x04;
    *(u32 *)(usize)pCtx = root;
    *(u32 *)(usize)(pCtx + 0x6274) = 1u; /* 1 node used (root) */
    *(u16 *)(usize)(pCtx + 0x6278) = 100u; /* xMin */
    *(u16 *)(usize)(pCtx + 0x627A) = 100u; /* yMin */
    *(u16 *)(usize)(pCtx + 0x627C) = 109u; /* xMax */
    *(u16 *)(usize)(pCtx + 0x627E) = 109u; /* yMax */
    *(s32 *)(usize)(pCtx + 0x6284) = 16;   /* nGridStride */
    *(s32 *)(usize)(pCtx + 0x6288) = -100; /* nXOffset */
    *(s32 *)(usize)(pCtx + 0x628C) = -100; /* nYOffset */
    *(u32 *)(usize)(pCtx + 0x36FD4) = pSeed;
    *(u32 *)(usize)(pSeed + 0x00) = 0x13579BDFu;
    *(u32 *)(usize)(pSeed + 0x04) = 0x2468ACE0u;

    *(u16 *)(usize)(root + 0x08) = 104u;
    *(u16 *)(usize)(root + 0x0A) = 104u;
    *(u32 *)(usize)(root + 0x0C) = 0x6FDDB860u;
    *(u32 *)(usize)(root + 0x10) = 0u; /* dir 0 -> (+1, 0) */

    *(u16 *)(usize)(pInfo + 0x04) = 106u; /* targetX */
    *(u16 *)(usize)(pInfo + 0x06) = 104u; /* targetY */
    *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
    *(u8 *)(usize)(pInfo + 0x14) = 1u; /* nTargetTypeStatus */
    *(u32 *)(usize)(pInfo + 0x28) = 0u;
    *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;

    s32 cutoff = 20;
    if (v == 0) { *(u16 *)(usize)(pInfo + 0x04) = 104u; } /* already at target */
    else if (v == 1) { *(u16 *)(usize)(root + 0x08) = 99u; } /* out of bounds xMin -> returns root */
    else if (v == 2) { cutoff = 20; } /* reaches target (106,104) in 2 steps */
    else if (v == 3) { cutoff = 1; } /* cutoff too small -> exhausts all 5 candidates on root -> returns 0 */
    else if (v == 4) { *(u32 *)(usize)(pCtx + 0x6274) = 0x384u; } /* node pool full -> returns 0 */
    else { *(u32 *)(usize)(pCtx + 0x36FD0) = 1u; *(u8 *)(usize)(pInfo + 0x14) = 10u; } /* random jitter + early hSigned < status */

    track_region(0x6FDDB860u, 256u);
    track_region(0x6FDDB960u, 128u);
    track_region(pCtx, 0x200);
    track_region(pCtx + 0x6270u, 0x420);
    track_region(pCtx + 0x36FC0u, 0x20);
    track_region(pInfo, 0x40);
    track_region(pSeed, 0x10);
    snapshot_pre();
    u32 ret = call_eax_stk2_u32(0x6FDC08F0u, pCtx, (u32)cutoff, pInfo);
    char note[48];
    snprintf(note, sizeof(note), "idastar_loop_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u]", pCtx, (u32)cutoff, pInfo);
    emit_vector(fp, "0x6FDC08F0", "PATH_IdaStar_SearchLoop113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F26: 0x6FDCB2C0 PATH_AStar_IsTargetReachableOrHasNoTargetUnit113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pInfo = heap_alloc(0x40);
    u32 pDynPath = heap_alloc(0x80);
    *(u16 *)(usize)(pInfo + 0x04) = 104u;
    *(u16 *)(usize)(pInfo + 0x06) = 104u;
    *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
    *(u32 *)(usize)(pInfo + 0x28) = 0u;
    *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
    *(u32 *)(usize)(pInfo + 0x30) = pDynPath;
    *(u32 *)(usize)(pDynPath + 0x58) = (v == 0) ? 0u : 0xDEADBEEFu;

    if (v == 0) { /* pTargetUnit == 0 -> returns 1 */ }
    else if (v == 1) { /* first probe (-2,-2) = (102,102) free -> returns 1 */ }
    else if (v == 2) { set_world_cell(&w, 102, 102, 1u); } /* second probe (-2,+2) = (102,106) free -> returns 1 */
    else if (v == 3) {
      /* block first 7 probes, leave 8th (0,+2) = (104,106) free */
      set_world_cell(&w, 102, 102, 1u); set_world_cell(&w, 102, 106, 1u);
      set_world_cell(&w, 106, 102, 1u); set_world_cell(&w, 106, 106, 1u);
      set_world_cell(&w, 102, 104, 1u); set_world_cell(&w, 104, 102, 1u);
      set_world_cell(&w, 106, 104, 1u);
    }
    else if (v == 4) {
      /* block all 8 probes -> returns 0 */
      set_world_cell(&w, 102, 102, 1u); set_world_cell(&w, 102, 106, 1u);
      set_world_cell(&w, 106, 102, 1u); set_world_cell(&w, 106, 106, 1u);
      set_world_cell(&w, 102, 104, 1u); set_world_cell(&w, 104, 102, 1u);
      set_world_cell(&w, 106, 104, 1u); set_world_cell(&w, 104, 106, 1u);
    }
    else {
      /* pattern 1 with only (106,104) free */
      *(u32 *)(usize)(pInfo + 0x28) = 1u;
      set_world_cell(&w, 102, 102, 1u); set_world_cell(&w, 102, 106, 1u);
      set_world_cell(&w, 106, 102, 1u); set_world_cell(&w, 106, 106, 1u);
    }

    track_region(pInfo, 0x40);
    track_region(pDynPath, 0x80);
    snapshot_pre();
    u32 ret = call_eax_u32(0x6FDCB2C0u, pInfo);
    char note[48];
    snprintf(note, sizeof(note), "astar_target_reach_v%d", v);
    snprintf(args, sizeof(args), "[%u]", pInfo);
    emit_vector(fp, "0x6FDCB2C0", "PATH_AStar_IsTargetReachableOrHasNoTargetUnit113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F27: 0x6FDCB3C0 PATH_AStar_ExpandNodeNeighbors113c (retMask 0xFFFFFFFF) */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    u32 pCtx = heap_alloc(0x3200);
    u32 pInfo = heap_alloc(0x40);
    u32 pNode = pCtx + 0x404;
    *(u32 *)(usize)(pCtx + 0x2FC4) = 1u;
    *(u16 *)(usize)(pNode + 0x00) = 104u;
    *(u16 *)(usize)(pNode + 0x02) = 104u;
    *(u16 *)(usize)(pNode + 0x08) = 10u;
    *(u32 *)(usize)(pInfo + 0x08) = w.r[4];
    *(u32 *)(usize)(pInfo + 0x28) = 0u;
    *(u32 *)(usize)(pInfo + 0x2C) = 0x1C01u;
    u32 targetXY = (108u | (108u << 16));

    if (v == 0) { /* all 8 neighbors free -> expands 8 nodes */ }
    else if (v == 1) {
      /* block 4 diagonals, only 4 orthogonals free */
      set_world_cell(&w, 103, 103, 1u); set_world_cell(&w, 103, 105, 1u);
      set_world_cell(&w, 105, 103, 1u); set_world_cell(&w, 105, 105, 1u);
    }
    else if (v == 2) {
      /* block all 8 neighbors -> expands 0 nodes, returns 1 */
      for (int dy = -1; dy <= 1; dy++)
        for (int dx = -1; dx <= 1; dx++)
          if (dx != 0 || dy != 0) set_world_cell(&w, 104 + dx, 104 + dy, 1u);
    }
    else if (v == 3) {
      /* node pool full (used == 200) -> first free neighbor returns 0 */
      *(u32 *)(usize)(pCtx + 0x2FC4) = 200u;
    }
    else if (v == 4) {
      /* node pool has 197 used (3 slots left) -> fails on 4th neighbor */
      *(u32 *)(usize)(pCtx + 0x2FC4) = 197u;
    }
    else {
      /* pattern 1 with partial collision */
      *(u32 *)(usize)(pInfo + 0x28) = 1u;
      set_world_cell(&w, 103, 103, 1u);
    }

    track_region(0x6FDDB5F0u, 32u);
    track_region(0x6FDDB7F0u, 32u);
    track_region(pCtx, 0x3000);
    track_region(pInfo, 0x40);
    snapshot_pre();
    u32 ret = call_eax_stk3_u32(0x6FDCB3C0u, pNode, pInfo, pCtx, targetXY);
    char note[48];
    snprintf(note, sizeof(note), "astar_expand_neighbors_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pNode, pInfo, pCtx, targetXY);
    emit_vector(fp, "0x6FDCB3C0", "PATH_AStar_ExpandNodeNeighbors113c", v, note, args, ret, 0xFFFFFFFFu);
  }
}

int main(int argc, char **argv) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  const char *i10c1_out = (argc > 1) ? argv[1] : "tests/fixtures/oracle/k1/i10c-1-vectors.ndjson";
  const char *i10c2_out = (argc > 2) ? argv[2] : "tests/fixtures/oracle/k1/i10c-2-vectors.ndjson";

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

  FILE *fp1 = fopen(i10c1_out, "wb");
  if (!fp1) return 4;
  emit_i10c_1(fp1);
  fclose(fp1);

  FILE *fp2 = fopen(i10c2_out, "wb");
  if (!fp2) return 5;
  emit_i10c_2(fp2);
  fclose(fp2);

  return 0;
}
