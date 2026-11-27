/*
 * k1r11-laneC-it13-emitter.c
 *
 * 32-bit MinGW executable that loads real D2Common.dll v1.13c at 0x6FD50000
 * under Wine and emits differential NDJSON test vectors for Iteration 13 Lane C:
 *   - I13C-1 (15 functions: F01..F15) -> i13c-1-vectors.ndjson
 *   - I13C-2 (23 functions: F16..F38) -> i13c-2-vectors.ndjson
 *
 * Inline-asm wrappers use exclusively register-class operands (0 "m"/"g"/"o").
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

typedef struct {
  u32 addr;
  u32 size;
} HeapAllocRec;
static HeapAllocRec g_heap_recs[256];
static int g_num_heap_recs = 0;

static u32 bump_alloc(u32 size) {
  if (size == 0u) return 0u;
  u32 aligned = (g_heap_off + 3u) & ~3u;
  if (aligned + size > HEAP_SIZE) ExitProcess(4);
  u32 p = HEAP_ADDR + aligned;
  memset(g_heap + aligned, 0, size);
  g_heap_off = aligned + size;
  if (g_num_heap_recs < 256) {
    g_heap_recs[g_num_heap_recs].addr = p;
    g_heap_recs[g_num_heap_recs].size = size;
    g_num_heap_recs++;
  }
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

static u32 lookup_alloc_size(u32 ptr, u32 fallback) {
  for (int i = 0; i < g_num_heap_recs; i++) {
    if (g_heap_recs[i].addr == ptr) return g_heap_recs[i].size;
  }
  for (int i = 0; i < g_num_blocks; i++) {
    if (g_blocks[i].addr == ptr) return g_blocks[i].len;
  }
  return fallback;
}

static u32 __attribute__((fastcall)) stub_fog_10047(
  u32 ecx_p, u32 edx_old, u32 new_sz, u32 f, u32 ln, u32 z
) {
  (void)ecx_p; (void)f; (void)ln; (void)z;
  u32 pNew = bump_alloc(new_sz);
  if (edx_old != 0u && pNew != 0u) {
    u32 old_sz = lookup_alloc_size(edx_old, new_sz);
    u32 copy_sz = (old_sz < new_sz) ? old_sz : new_sz;
    memcpy((void *)(usize)pNew, (const void *)(usize)edx_old, copy_sz);
    record_free(edx_old);
  }
  return pNew;
}

static void reset_heap(void) {
  if (g_arena_off > 0) memset(g_arena, 0, (g_arena_off + 15u) & ~15u);
  if (g_heap_off > 0)  memset(g_heap, 0, (g_heap_off + 3u) & ~3u);
  g_arena_off = 0x100u;
  g_heap_off = 0;
  g_num_frees = 0;
  g_num_heap_recs = 0;
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

typedef void (__stdcall *fn_std1_void_t)(u32);
typedef u32  (__stdcall *fn_std2_u32_t)(u32, u32);
typedef void (__stdcall *fn_std2_void_t)(u32, u32);
typedef u32  (__stdcall *fn_std5_u32_t)(u32, u32, u32, u32, u32);
typedef u32  (__stdcall *fn_std6_u32_t)(u32, u32, u32, u32, u32, u32);
typedef u32  (__stdcall *fn_std7_u32_t)(u32, u32, u32, u32, u32, u32, u32);
typedef u32  (__stdcall *fn_std9_u32_t)(u32, u32, u32, u32, u32, u32, u32, u32, u32);

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
    : "+c"(fn)
    : "a"(a_eax)
    : "edx", "ebx", "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_ecx_u32(u32 fn, u32 a_ecx) {
  u32 out;
  __asm__ volatile(
    "call *%%edx\n\t"
    : "=a"(out), "+c"(a_ecx), "+d"(fn)
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

static __attribute__((noinline)) void call_esi_stk1_void(u32 fn, u32 a_esi, u32 s1) {
  u32 pack[2] = { fn, s1 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "+S"(a_esi), "+d"(p)
    :
    : "eax", "ecx", "ebx", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) void call_eax_ecx_void(u32 fn, u32 a_eax, u32 a_ecx) {
  __asm__ volatile(
    "call *%%edx\n\t"
    : "+c"(a_ecx), "+d"(fn)
    : "a"(a_eax)
    : "ebx", "esi", "edi", "memory", "cc"
  );
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

static __attribute__((noinline)) void call_eax_stk2_void(u32 fn, u32 a_eax, u32 s1, u32 s2) {
  u32 pack[3] = { fn, s1, s2 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "+d"(p)
    : "a"(a_eax)
    : "ecx", "ebx", "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) void call_edx_stk2_void(u32 fn, u32 a_edx, u32 s1, u32 s2) {
  u32 pack[3] = { fn, s1, s2 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 8(%%ecx)\n\t"
    "pushl 4(%%ecx)\n\t"
    "call *0(%%ecx)\n\t"
    : "+c"(p), "+d"(a_edx)
    :
    : "eax", "ebx", "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) void call_eax_ecx_stk4_void(
  u32 fn, u32 a_eax, u32 a_ecx, u32 s1, u32 s2, u32 s3, u32 s4
) {
  u32 pack[5] = { fn, s1, s2, s3, s4 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 16(%%edx)\n\t"
    "pushl 12(%%edx)\n\t"
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "+c"(a_ecx), "+d"(p)
    : "a"(a_eax)
    : "ebx", "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_eax_ecx_stk3_u32(
  u32 fn, u32 a_eax, u32 a_ecx, u32 s1, u32 s2, u32 s3
) {
  u32 pack[4] = { fn, s1, s2, s3 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
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

static __attribute__((noinline)) void call_eax_ebx_ecx_esi_stk2_void(
  u32 fn, u32 a_eax, u32 a_ebx, u32 a_ecx, u32 a_esi, u32 s1, u32 s2
) {
  u32 pack[3] = { fn, s1, s2 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "+b"(a_ebx), "+c"(a_ecx), "+S"(a_esi), "+d"(p)
    : "a"(a_eax)
    : "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_eax_ecx_stk7_u32(
  u32 fn, u32 a_eax, u32 a_ecx,
  u32 s1, u32 s2, u32 s3, u32 s4, u32 s5, u32 s6, u32 s7
) {
  u32 pack[8] = { fn, s1, s2, s3, s4, s5, s6, s7 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 28(%%edx)\n\t"
    "pushl 24(%%edx)\n\t"
    "pushl 20(%%edx)\n\t"
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

#define TRAMP_F04_ADDR (ARENA_ADDR + 0x003F0000u)
#define TRAMP_F19_ADDR (ARENA_ADDR + 0x003F0100u)

static void install_fixed_callbacks(void) {
  /* __fastcall(ecx=pUnit, edx=pContext): return (*(u32*)(pUnit+0xC) == pContext) ? 1 : 0 */
  static const u8 stub_f04[10] = { 0x39u, 0x51u, 0x0Cu, 0x0Fu, 0x94u, 0xC0u, 0x0Fu, 0xB6u, 0xC0u, 0xC3u };
  /* __fastcall(ecx=pRoom): *(u32*)(pRoom+0xC) = 0xCAFEBABEu; ret */
  static const u8 stub_f19[8]  = { 0xC7u, 0x41u, 0x0Cu, 0xBEu, 0xBAu, 0xFEu, 0xCAu, 0xC3u };
  memcpy((void *)(usize)TRAMP_F04_ADDR, stub_f04, sizeof(stub_f04));
  memcpy((void *)(usize)TRAMP_F19_ADDR, stub_f19, sizeof(stub_f19));
}

static void emit_i13c_1_a(FILE *fp) {
  char note[64], args[256];

  /* F01: 0x6FD5DF30 COLLISION_MoveUnitToRoomAndCoord113c */
  for (int c = 0; c < 6; c++) {
    reset_heap();
    CollWorld w; build_coll_world(&w);
    u32 pPath = heap_alloc(0x200);
    u32 pUnit = heap_alloc(0x100);
    *(u32 *)(usize)(pUnit + 0x00) = (c <= 2) ? 3u : 0u;
    *(u32 *)(usize)(pUnit + 0x2C) = pPath;
    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x1C) = (c == 5) ? 0u : w.r[4];
    if (c == 3) {
      *(u32 *)(usize)(w.r[4] + 0x74) = pUnit;
      *(u32 *)(usize)(w.r[4] + 0x28) = 1u;
    }
    *(u16 *)(usize)(pPath + 0x02) = 102u;
    *(u16 *)(usize)(pPath + 0x06) = 102u;
    *(u32 *)(usize)(pPath + 0x08) = (102u << 16) | 0x8000u;
    *(u32 *)(usize)(pPath + 0x0C) = (102u << 16) | 0x8000u;
    *(u32 *)(usize)(pPath + 0x34) = (c == 1) ? 0x08u : 0u;
    *(u32 *)(usize)(pPath + 0x44) = 1u;
    *(u32 *)(usize)(pPath + 0x48) = 1u;
    *(u32 *)(usize)(pPath + 0x4C) = 0x0080u;
    *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
    *(u16 *)(usize)(pPath + 0x54) = 0x00FFu;
    set_world_cell(&w, 102, 102, 0x0080u);
    if (c == 0) set_world_cell(&w, 103, 104, 0x0401u);

    u32 targetRoom = (c == 1 || c == 3) ? w.r[5] : w.r[4];
    u32 packedXY = 0u;
    if (c == 0) packedXY = (104u << 16) | 103u;
    else if (c == 1) packedXY = (102u << 16) | 102u;
    else if (c == 2 || c == 4) packedXY = 0u;
    else if (c == 3) packedXY = (103u << 16) | 113u;
    else if (c == 5) packedXY = (104u << 16) | 104u;

    track_region(pPath, 0x200);
    track_region(pUnit, 0x100);
    snapshot_pre();
    u32 ret = call_eax_stk2_u32(0x6FD5DF30u, pPath, targetRoom, packedXY);
    snprintf(note, sizeof(note), "f01_move_unit_room_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u]", pPath, targetRoom, packedXY);
    emit_vector(fp, "0x6FD5DF30", "COLLISION_MoveUnitToRoomAndCoord113c", c, note, args, ret, 0xFFFFFFFFu);
  }

  /* F02: 0x6FD9D010 COLLISION_AllocAndBuildRoomGrid113c */
  {
    fn_std2_void_t fn = (fn_std2_void_t)(usize)0x6FD9D010u;
    for (int c = 0; c < 4; c++) {
      reset_heap();
      u32 pRoom = heap_alloc(0x80);
      u32 pNear = heap_alloc(0x80);
      u32 ppNear = heap_alloc(8u);
      u32 pCoords0 = heap_alloc(0x20);
      u32 pCoords1 = heap_alloc(0x20);
      u32 pTileGrid = heap_alloc(0x18);
      u32 pFloors = heap_alloc(0x30);
      u32 pWalls = heap_alloc(0x30);
      u32 pRoofs = heap_alloc(0x30);
      u32 pLibF = heap_alloc(0x50);
      u32 pLibW = heap_alloc(0x50);
      u32 pLibR = heap_alloc(0x50);

      for (int i = 0; i < 25; i++) {
        *(u8 *)(usize)(pLibF + 0x28u + (u32)i) = (i == 12) ? 0x02u : 0x00u;
        *(u8 *)(usize)(pLibW + 0x28u + (u32)i) = 0x01u;
        *(u8 *)(usize)(pLibR + 0x28u + (u32)i) = 0x08u;
      }

      /* pRoom at tile (10, 10), size 2x2 tiles -> subtile (50, 50), size 10x10 */
      *(u32 *)(usize)(pRoom + 0x4C) = 50u; *(u32 *)(usize)(pRoom + 0x50) = 50u;
      *(u32 *)(usize)(pRoom + 0x54) = 10u; *(u32 *)(usize)(pRoom + 0x58) = 10u;
      *(u32 *)(usize)(pRoom + 0x5C) = 10u; *(u32 *)(usize)(pRoom + 0x60) = 10u;
      *(u32 *)(usize)(pRoom + 0x64) = 2u;  *(u32 *)(usize)(pRoom + 0x68) = 2u;
      *(u32 *)(usize)(pRoom + 0x00) = ppNear;
      *(u32 *)(usize)(pRoom + 0x24) = (c == 3) ? 2u : 1u;

      *(u32 *)(usize)(pCoords0 + 0x00) = 50u; *(u32 *)(usize)(pCoords0 + 0x04) = 50u;
      *(u32 *)(usize)(pCoords0 + 0x08) = 10u; *(u32 *)(usize)(pCoords0 + 0x0C) = 10u;
      *(u32 *)(usize)(pCoords0 + 0x10) = 10u; *(u32 *)(usize)(pCoords0 + 0x14) = 10u;
      *(u32 *)(usize)(pCoords0 + 0x18) = 2u;  *(u32 *)(usize)(pCoords0 + 0x1C) = 2u;
      *(u32 *)(usize)(pRoom + 0x20) = pCoords0;

      *(u32 *)(usize)(ppNear + 0u) = pRoom;
      *(u32 *)(usize)(ppNear + 4u) = pNear;
      *(u32 *)(usize)(pNear + 0x20) = pCoords1;
      *(u32 *)(usize)(pCoords1 + 0x10) = 11u; *(u32 *)(usize)(pCoords1 + 0x14) = 10u;

      if (c >= 1) {
        *(u32 *)(usize)(pRoom + 0x08) = pTileGrid;
      }
      if (c >= 2) {
        *(u32 *)(usize)(pTileGrid + 0x00) = pWalls;  *(u32 *)(usize)(pTileGrid + 0x04) = 1u;
        *(u32 *)(usize)(pTileGrid + 0x08) = pFloors; *(u32 *)(usize)(pTileGrid + 0x0C) = 1u;
        *(u32 *)(usize)(pTileGrid + 0x10) = pRoofs;  *(u32 *)(usize)(pTileGrid + 0x14) = 1u;
        *(u32 *)(usize)(pFloors + 0x08) = 0u; *(u32 *)(usize)(pFloors + 0x0C) = 0u;
        *(u32 *)(usize)(pFloors + 0x14) = 0x02u; *(u32 *)(usize)(pFloors + 0x18) = pLibF;
        *(u32 *)(usize)(pWalls + 0x08) = 1u; *(u32 *)(usize)(pWalls + 0x0C) = 0u;
        *(u32 *)(usize)(pWalls + 0x14) = 0x40u; *(u32 *)(usize)(pWalls + 0x18) = pLibW;
        *(u32 *)(usize)(pRoofs + 0x08) = 0u; *(u32 *)(usize)(pRoofs + 0x0C) = 1u;
        *(u32 *)(usize)(pRoofs + 0x14) = 0x80u; *(u32 *)(usize)(pRoofs + 0x18) = pLibR;
      }
      if (c == 3) {
        *(u32 *)(usize)(pNear + 0x08) = pTileGrid;
      }

      u32 argRoom = (c == 0) ? 0u : pRoom;
      track_region(pRoom, 0x80); track_region(pNear, 0x80); track_region(ppNear, 8u);
      track_region(pCoords0, 0x20); track_region(pCoords1, 0x20); track_region(pTileGrid, 0x18);
      track_region(pFloors, 0x30); track_region(pWalls, 0x30); track_region(pRoofs, 0x30);
      track_region(pLibF, 0x50); track_region(pLibW, 0x50); track_region(pLibR, 0x50);
      snapshot_pre();
      fn(0x1111u, argRoom);
      snprintf(note, sizeof(note), "f02_alloc_coll_grid_c%d", c);
      snprintf(args, sizeof(args), "[4369,%u]", argRoom);
      emit_vector(fp, "0x6FD9D010", "COLLISION_AllocAndBuildRoomGrid113c", c, note, args, 0u, 0u);
    }
  }

  /* F03: 0x6FD9D140 COLLISION_FindFreePosition113c */
  {
    fn_std9_u32_t fn = (fn_std9_u32_t)(usize)0x6FD9D140u;
    u32 savedF04 = *(u32 *)(usize)0x6FDF1404u;
    u32 savedF14 = *(u32 *)(usize)0x6FDF1414u;
    u32 savedF18 = *(u32 *)(usize)0x6FDF1418u;
    for (int c = 0; c < 6; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pOut = heap_alloc(8u);
      u32 pBox = heap_alloc(8u);
      u32 pFieldData = heap_alloc(12u * 256u);
      memset((void *)(usize)pFieldData, 8, 12u * 256u);
      if (c == 4) {
        /* at (104, 105) -> dir 0 (dx=0, dy=-1) back to (104, 104) where dir=8 stops */
        *(u8 *)(usize)(pFieldData + ((5u << 8) + 4u)) = 0u;
      }
      *(u32 *)(usize)0x6FDF1404u = pFieldData;
      *(u32 *)(usize)0x6FDF1414u = 4u;
      *(u32 *)(usize)0x6FDF1418u = 4u;
      *(s32 *)(usize)(pOut + 0) = 104;
      *(s32 *)(usize)(pOut + 4) = 104;
      *(s32 *)(usize)(pBox + 0) = 104;
      *(s32 *)(usize)(pBox + 4) = 104;

      if (c >= 1) {
        set_world_cell(&w, 104, 104, 0x0001u); /* block center */
      }
      if (c == 2) {
        /* block entire ring 1 (103..105 x 103..105) except (106, 104) */
        for (s32 yy = 103; yy <= 105; yy++)
          for (s32 xx = 103; xx <= 105; xx++)
            set_world_cell(&w, xx, yy, 0x0001u);
      }
      if (c == 3) {
        /* block all cells in 30x30 world -> fallback or fail */
        for (s32 yy = 90; yy < 120; yy++)
          for (s32 xx = 90; xx < 120; xx++)
            set_world_cell(&w, xx, yy, 0x0001u);
      }
      if (c == 4) {
        /* block ring 1 except (104, 105), test fieldBox trace blocking */
        set_world_cell(&w, 104, 105, 0x0002u);
      }

      u32 argBox = (c == 4 || c == 5) ? pBox : 0u;
      u32 wFieldMask = (c == 4) ? 0x0002u : 0x0000u;
      u32 bFallback = (c == 3) ? 1u : 0u;
      u32 nMaxRad = (c == 3) ? 3u : 6u;
      u32 nStep = (c == 2) ? 2u : 1u;
      if (c == 5) {
        /* fieldBox non-null when center (104, 104) is completely free */
        set_world_cell(&w, 104, 104, 0u);
      }

      track_region(0x6FDE9BA0u, 72u);
      track_region(0x6FDF1404u, 24u);
      track_region(pFieldData, 12u * 256u);
      track_region(pOut, 8u); track_region(pBox, 8u);
      snapshot_pre();
      u32 ret = fn(w.r[4], pOut, argBox, 1u, 0x0001u, wFieldMask, bFallback, nMaxRad, nStep);
      snprintf(note, sizeof(note), "f03_find_free_pos_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u,%u,1,1,%u,%u,%u,%u]",
        w.r[4], pOut, argBox, wFieldMask, bFallback, nMaxRad, nStep);
      emit_vector(fp, "0x6FD9D140", "COLLISION_FindFreePosition113c", c, note, args, ret, 0xFFFFFFFFu);
    }
    *(u32 *)(usize)0x6FDF1404u = savedF04;
    *(u32 *)(usize)0x6FDF1414u = savedF14;
    *(u32 *)(usize)0x6FDF1418u = savedF18;
  }

  /* F04: 0x6FDCF6A0 COLLISION_FindAdjacentUnitWithCallback113c */
  {
    fn_std6_u32_t fn = (fn_std6_u32_t)(usize)0x6FDCF6A0u;
    u32 *pSgpt = (u32 *)(usize)0x6FDE9E1Cu;
    u32 savedSgpt = *pSgpt;
    for (int c = 0; c < 6; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 dt = heap_alloc(0x1000);
      u32 monTbl = heap_alloc(4u * 424u);
      u32 mon2Tbl = heap_alloc(4u * 308u);
      u32 misTbl = heap_alloc(4u * 420u);
      *(u32 *)(usize)(dt + 0xA78u) = monTbl; *(u32 *)(usize)(dt + 0xA80u) = 4u;
      *(u32 *)(usize)(dt + 0xA90u) = mon2Tbl; *(u32 *)(usize)(dt + 0xA98u) = 4u;
      *(u32 *)(usize)(dt + 0xB64u) = misTbl; *(u32 *)(usize)(dt + 0xB6Cu) = 4u;
      *(u16 *)(usize)(monTbl + 1u * 424u + 0x02u) = 1u;
      *(u16 *)(usize)(monTbl + 1u * 424u + 0x18u) = 1u;
      *(u8  *)(usize)(mon2Tbl + 1u * 308u + 0x08u) = 2u;
      *(u8  *)(usize)(misTbl + 0u * 420u + 0x18Au) = 1u;
      *pSgpt = dt;

      u32 u0 = heap_alloc(0x100); u32 p0 = heap_alloc(0x40);
      u32 u1 = heap_alloc(0x100); u32 p1 = heap_alloc(0x40);
      u32 u2 = heap_alloc(0x100); u32 p2 = heap_alloc(0x40);

      /* u0: skipped player mode 17; u1: monster size 2 at (105,104) id=0x5555; u2: missile at (106,105) id=0x7777 */
      *(u32 *)(usize)(u0 + 0x00) = 0u; *(u32 *)(usize)(u0 + 0x10) = 17u; *(u32 *)(usize)(u0 + 0x0C) = 0x5555u;
      *(u32 *)(usize)(u0 + 0x2C) = p0; *(u16 *)(usize)(p0 + 0x02) = 104u; *(u16 *)(usize)(p0 + 0x06) = 104u;

      *(u32 *)(usize)(u1 + 0x00) = (c == 4) ? 2u : 1u; /* c==4: object (type=2) */
      *(u32 *)(usize)(u1 + 0x10) = (c == 3) ? 12u : 1u; /* c==3: dead monster -> skipped */
      *(u32 *)(usize)(u1 + 0x0C) = (c == 4) ? 0x6666u : 0x5555u;
      *(u32 *)(usize)(u1 + 0x04) = 1u; /* monster id=1 -> size 2 */
      *(u32 *)(usize)(u1 + 0x2C) = p1;
      *(u16 *)(usize)(p1 + 0x02) = 105u; *(u16 *)(usize)(p1 + 0x06) = 104u;
      *(u32 *)(usize)(p1 + 0x0C) = 105u; *(u32 *)(usize)(p1 + 0x10) = 104u;
      u32 objData = heap_alloc(0x20);
      u32 objTxt = heap_alloc(0xE0);
      *(u32 *)(usize)(objData + 0x00) = objTxt;
      *(u32 *)(usize)(objTxt + 0xD0) = 2u;
      *(u32 *)(usize)(u1 + 0x14) = objData;

      *(u32 *)(usize)(u2 + 0x00) = 3u; *(u32 *)(usize)(u2 + 0x10) = 0u; *(u32 *)(usize)(u2 + 0x0C) = 0x7777u;
      *(u32 *)(usize)(u2 + 0x04) = 0u; /* missile id=0 -> size 1 */
      *(u32 *)(usize)(u2 + 0x2C) = p2; *(u16 *)(usize)(p2 + 0x02) = 106u; *(u16 *)(usize)(p2 + 0x06) = 105u;

      *(u32 *)(usize)(u0 + 0xE8) = u1;
      *(u32 *)(usize)(u1 + 0xE8) = u2;
      *(u32 *)(usize)(w.r[4] + 0x74) = u0;

      u32 argRoom = (c == 0) ? 0u : w.r[4];
      u32 nRange = (c == 0) ? 4u : (c == 2) ? 3u : 2u;
      u32 ctx = (c == 5) ? 0x9999u : (c == 2) ? 0x7777u : (c == 4) ? 0x6666u : 0x5555u;
      u32 cbAddr = TRAMP_F04_ADDR;

      track_region(0x6FDE9E1Cu, 4u);
      track_region(dt, 0x1000u); track_region(monTbl, 4u * 424u);
      track_region(mon2Tbl, 4u * 308u); track_region(misTbl, 4u * 420u);
      track_region(u0, 0x100); track_region(p0, 0x40);
      track_region(u1, 0x100); track_region(p1, 0x40);
      track_region(objData, 0x20); track_region(objTxt, 0xE0);
      track_region(u2, 0x100); track_region(p2, 0x40);
      snapshot_pre();
      u32 ret = fn(argRoom, 104u, 104u, cbAddr, ctx, nRange);
      snprintf(note, sizeof(note), "f04_find_adj_unit_c%d", c);
      snprintf(args, sizeof(args), "[%u,104,104,%u,%u,%u]", argRoom, cbAddr, ctx, nRange);
      emit_vector(fp, "0x6FDCF6A0", "COLLISION_FindAdjacentUnitWithCallback113c", c, note, args, ret, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
  }

  /* F05: 0x6FD8C3B0 DUNGEON_RemoveClientFromRoom113c */
  {
    fn_std2_void_t fn = (fn_std2_void_t)(usize)0x6FD8C3B0u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      u32 pRoom = heap_alloc(0x80);
      u32 pClients = heap_alloc(16u);
      u32 cl0 = heap_alloc(0x20), cl1 = heap_alloc(0x20), cl2 = heap_alloc(0x20);
      *(u32 *)(usize)(cl0 + 0x00) = 10u;
      *(u32 *)(usize)(cl1 + 0x00) = 30u;
      *(u32 *)(usize)(cl2 + 0x00) = 20u;
      *(u32 *)(usize)(pClients + 0u) = cl0;
      *(u32 *)(usize)(pClients + 4u) = cl1;
      *(u32 *)(usize)(pClients + 8u) = cl2;
      *(u32 *)(usize)(pRoom + 0x48) = pClients;
      *(u32 *)(usize)(pRoom + 0x78) = (c == 0) ? 1u : 3u;
      u32 target = (c == 0) ? cl0 : (c == 1) ? cl0 : cl2;

      track_region(pRoom, 0x80); track_region(pClients, 16u);
      track_region(cl0, 0x20); track_region(cl1, 0x20); track_region(cl2, 0x20);
      snapshot_pre();
      fn(pRoom, target);
      snprintf(note, sizeof(note), "f05_remove_client_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u]", pRoom, target);
      emit_vector(fp, "0x6FD8C3B0", "DUNGEON_RemoveClientFromRoom113c", c, note, args, 0u, 0u);
    }
  }

  /* F06: 0x6FD8C460 DUNGEON_AddClientToRoom113c */
  {
    fn_std2_void_t fn = (fn_std2_void_t)(usize)0x6FD8C460u;
    for (int c = 0; c < 4; c++) {
      reset_heap();
      u32 pRoom = heap_alloc(0x80);
      u32 pAct = heap_alloc(0x60);
      u32 cl0 = heap_alloc(0x20), cl1 = heap_alloc(0x20), clNew = heap_alloc(0x20);
      u32 clientsBytes = (c == 0) ? 16u : 8u;
      u32 pClients = (c == 2) ? 0u : heap_alloc(clientsBytes);
      *(u32 *)(usize)(pRoom + 0x2C) = pAct;
      *(u32 *)(usize)(pAct + 0x5C) = 0x1111u;
      *(u32 *)(usize)(cl0 + 0x00) = 30u;
      *(u32 *)(usize)(cl1 + 0x00) = 10u;
      *(u32 *)(usize)(clNew + 0x00) = 20u;
      if (pClients != 0u) {
        *(u32 *)(usize)(pClients + 0u) = cl0;
        *(u32 *)(usize)(pClients + 4u) = cl1;
      }
      *(u32 *)(usize)(pRoom + 0x48) = pClients;
      *(u32 *)(usize)(pRoom + 0x04) = (c == 0) ? 4u : (c == 1) ? 2u : (c == 2) ? 0u : 1u;
      *(u32 *)(usize)(pRoom + 0x78) = (c == 0) ? 2u : (c == 1) ? 2u : (c == 2) ? 0u : 1u;

      track_region(pRoom, 0x80); track_region(pAct, 0x60);
      if (pClients != 0u) track_region(pClients, clientsBytes);
      track_region(cl0, 0x20); track_region(cl1, 0x20); track_region(clNew, 0x20);
      snapshot_pre();
      fn(pRoom, clNew);
      snprintf(note, sizeof(note), "f06_add_client_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u]", pRoom, clNew);
      emit_vector(fp, "0x6FD8C460", "DUNGEON_AddClientToRoom113c", c, note, args, 0u, 0u);
    }
  }

  /* F07: 0x6FD8C520 DUNGEON_CanFreeActiveRoom113c */
  {
    fn_std2_u32_t fn = (fn_std2_u32_t)(usize)0x6FD8C520u;
    for (int c = 0; c < 4; c++) {
      reset_heap();
      u32 pAct = heap_alloc(0x60);
      u32 pRoom = heap_alloc(0x80);
      u32 pRoomEx = heap_alloc(0xEC);
      u32 pRoomEx2 = heap_alloc(0xEC);
      u32 pLevel = heap_alloc(0x200);
      u32 pDrlg = heap_alloc(0x100);
      *(u32 *)(usize)(pRoom + 0x10) = pRoomEx;
      *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
      *(u32 *)(usize)(pRoomEx + 0x24) = pRoomEx2;
      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32 *)(usize)(pLevel + 0x10) = pRoomEx;
      *(u32 *)(usize)(pLevel + 0x1D0) = (c == 2) ? 0x78u : 2u; /* 0x78 checks room list */
      *(u8  *)(usize)(pRoomEx + 0x44) = (c == 0) ? 1u : 2u;
      *(u8  *)(usize)(pRoomEx2 + 0x44) = (c == 2) ? 1u : 2u;
      *(u32 *)(usize)(pRoomEx + 0x28) = (c == 3) ? 0x00400000u : 0u;

      track_region(pAct, 0x60); track_region(pRoom, 0x80);
      track_region(pRoomEx, 0xEC); track_region(pRoomEx2, 0xEC);
      track_region(pLevel, 0x200); track_region(pDrlg, 0x100);
      snapshot_pre();
      u32 ret = fn(pAct, pRoom);
      snprintf(note, sizeof(note), "f07_can_free_room_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u]", pAct, pRoom);
      emit_vector(fp, "0x6FD8C520", "DUNGEON_CanFreeActiveRoom113c", c, note, args, ret, 0xFFFFFFFFu);
    }
  }
}

static void setup_maze_level(u32 *outLevel, u32 *outDrlg, u32 *outMaze, u32 *outBase, u32 nLevelType, u32 seedLo) {
  u32 pLevel = heap_alloc(0x240);
  u32 pDrlg = heap_alloc(0x500);
  u32 pMaze = heap_alloc(0x40);
  u32 pBase = heap_alloc(0xEC);
  u32 pPreset = heap_alloc(0x100);
  *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
  *(u32 *)(usize)(pLevel + 0x14) = pMaze;
  *(u32 *)(usize)(pLevel + 0x1C0) = nLevelType;
  *(u32 *)(usize)(pLevel + 0x1C4) = seedLo;
  *(u32 *)(usize)(pLevel + 0x1C8) = 0x11223344u;
  *(u32 *)(usize)(pLevel + 0x10) = pBase;
  *(u32 *)(usize)(pLevel + 0x08) = 1u;
  *(u32 *)(usize)(pMaze + 0x10) = 10u;
  *(u32 *)(usize)(pMaze + 0x14) = 10u;
  *(u32 *)(usize)(pMaze + 0x18) = 500u;
  *(u32 *)(usize)(pBase + 0x20) = pPreset;
  *(u32 *)(usize)(pBase + 0x58) = pLevel;
  *(s32 *)(usize)(pBase + 0x34) = 100;
  *(s32 *)(usize)(pBase + 0x38) = 100;
  *(s32 *)(usize)(pBase + 0x3C) = 10;
  *(s32 *)(usize)(pBase + 0x40) = 10;
  *(u32 *)(usize)(pBase + 0x14) = seedLo ^ 0x55555555u;
  *(u32 *)(usize)(pBase + 0x18) = 0x77777777u;

  track_region(pLevel, 0x240); track_region(pDrlg, 0x500);
  track_region(pMaze, 0x40); track_region(pBase, 0xEC); track_region(pPreset, 0x100);
  *outLevel = pLevel; *outDrlg = pDrlg; *outMaze = pMaze; *outBase = pBase;
}

static void emit_i13c_1_b(FILE *fp) {
  char note[64], args[256];

  /* F08: 0x6FD5FD20 DRLGMAZE_SpawnAndAssignCornerRoomPresets113c */
  {
    fn_std1_void_t fn = (fn_std1_void_t)(usize)0x6FD5FD20u;
    const u32 ltypes[4] = { 17u, 34u, 3u, 17u };
    const u32 seeds[4]  = { 0x00000001u, 0x00000002u, 0x00000003u, 0x00000004u };
    for (int c = 0; c < 4; c++) {
      reset_heap();
      u32 pLevel, pDrlg, pMaze, pBase;
      setup_maze_level(&pLevel, &pDrlg, &pMaze, &pBase, ltypes[c], seeds[c]);
      if (c == 3) {
        /* Place a blocker room east of pBase (110,100) to force collision & FreeRoomEx */
        u32 rBlk = heap_alloc(0xEC), prBlk = heap_alloc(0x100);
        *(u32 *)(usize)(rBlk + 0x20) = prBlk;
        *(u32 *)(usize)(rBlk + 0x58) = pLevel;
        *(s32 *)(usize)(rBlk + 0x34) = 110; *(s32 *)(usize)(rBlk + 0x38) = 100;
        *(s32 *)(usize)(rBlk + 0x3C) = 10;  *(s32 *)(usize)(rBlk + 0x40) = 10;
        *(u32 *)(usize)(pBase + 0x24) = rBlk;
        *(u32 *)(usize)(pLevel + 0x08) = 2u;
        track_region(rBlk, 0xEC); track_region(prBlk, 0x100);
      }
      snapshot_pre();
      fn(pLevel);
      snprintf(note, sizeof(note), "f08_maze_corners_c%d", c);
      snprintf(args, sizeof(args), "[%u]", pLevel);
      emit_vector(fp, "0x6FD5FD20", "DRLGMAZE_SpawnAndAssignCornerRoomPresets113c", c, note, args, 0u, 0u);
    }
  }

  /* F09: 0x6FD5FE70 DRLGMAZE_SpawnCrossOrPairSpecialRooms113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pMaze, pBase;
    setup_maze_level(&pLevel, &pDrlg, &pMaze, &pBase, 3u, (c == 1) ? 0x00000001u : 0x00000002u);
    u32 bAll = (c == 0 || c == 3) ? 1u : 0u;
    if (c == 3) {
      /* block North (100,90) to exercise pNew == 0 branch */
      u32 rBlk = heap_alloc(0xEC), prBlk = heap_alloc(0x100);
      *(u32 *)(usize)(rBlk + 0x20) = prBlk; *(u32 *)(usize)(rBlk + 0x58) = pLevel;
      *(s32 *)(usize)(rBlk + 0x34) = 100; *(s32 *)(usize)(rBlk + 0x38) = 90;
      *(s32 *)(usize)(rBlk + 0x3C) = 10;  *(s32 *)(usize)(rBlk + 0x40) = 10;
      *(u32 *)(usize)(pBase + 0x24) = rBlk;
      *(u32 *)(usize)(pLevel + 0x08) = 2u;
      track_region(rBlk, 0xEC); track_region(prBlk, 0x100);
    }
    snapshot_pre();
    call_eax_ecx_void(0x6FD5FE70u, bAll, pLevel);
    snprintf(note, sizeof(note), "f09_maze_cross_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u]", bAll, pLevel);
    emit_vector(fp, "0x6FD5FE70", "DRLGMAZE_SpawnCrossOrPairSpecialRooms113c", c, note, args, 0u, 0u);
  }

  /* F10: 0x6FD60010 DRLGMAZE_FillAdjacentRoomsWithPreset113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pMaze, pBase;
    setup_maze_level(&pLevel, &pDrlg, &pMaze, &pBase, 3u, 0x1234u);
    u32 r1 = heap_alloc(0xEC), pr1 = heap_alloc(0x100);
    *(u32 *)(usize)(r1 + 0x20) = pr1; *(u32 *)(usize)(r1 + 0x58) = pLevel;
    *(s32 *)(usize)(r1 + 0x34) = 110; *(s32 *)(usize)(r1 + 0x38) = 100;
    *(s32 *)(usize)(r1 + 0x3C) = 10;  *(s32 *)(usize)(r1 + 0x40) = 10;
    *(u32 *)(usize)(pBase + 0x24) = r1;
    *(u32 *)(usize)(pLevel + 0x08) = 2u;
    u32 ignoreRoom = (c == 1) ? r1 : (c == 2) ? pBase : 0u;
    u32 prestId = (c == 2) ? 0x350u : 0x344u;
    track_region(r1, 0xEC); track_region(pr1, 0x100);
    snapshot_pre();
    call_eax_stk2_void(0x6FD60010u, pLevel, prestId, ignoreRoom);
    snprintf(note, sizeof(note), "f10_fill_adj_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u]", pLevel, prestId, ignoreRoom);
    emit_vector(fp, "0x6FD60010", "DRLGMAZE_FillAdjacentRoomsWithPreset113c", c, note, args, 0u, 0u);
  }

  /* F11: 0x6FD606B0 DRLGMAZE_PlaceOrReplaceSpecialRoomPreset113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pMaze, pBase;
    setup_maze_level(&pLevel, &pDrlg, &pMaze, &pBase, 3u, 0x5555u);
    u32 pPreset = *(u32 *)(usize)(pBase + 0x20);
    *(u32 *)(usize)(pPreset + 0x00) = (c == 0) ? 0x111u : 0x222u;
    *(u32 *)(usize)(pPreset + 0x0C) = (c == 1) ? 0x02u : 0x00u;
    u32 pSpec = heap_alloc(0x10);
    *(u32 *)(usize)(pSpec + 0x00) = 0x111u;
    *(u32 *)(usize)(pSpec + 0x04) = 0x333u;
    *(u32 *)(usize)(pSpec + 0x08) = 2u;
    *(u32 *)(usize)(pSpec + 0x0C) = (c == 2) ? 3u : 1u;
    u32 pOutDir = (c == 3) ? 0u : heap_alloc(4u);
    if (pOutDir != 0u) {
      *(u32 *)(usize)pOutDir = (c == 2) ? 3u : 1u;
      track_region(pOutDir, 4u);
    }
    track_region(pSpec, 0x10);
    snapshot_pre();
    call_edx_stk2_void(0x6FD606B0u, pSpec, pLevel, pOutDir);
    snprintf(note, sizeof(note), "f11_place_replace_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,%u]", pSpec, pLevel, pOutDir);
    emit_vector(fp, "0x6FD606B0", "DRLGMAZE_PlaceOrReplaceSpecialRoomPreset113c", c, note, args, 0u, 0u);
  }

  /* F12: 0x6FD8DC90 DRLGROOMTILE_RasterizeOutdoorRoadsToPreset113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 pLevel = heap_alloc(0x200);
    u32 pOutdoors = heap_alloc(0x280);
    u32 pRoomEx = heap_alloc(0xEC);
    u32 pPreset = heap_alloc(0x100);
    u32 pCells = heap_alloc(12u * 12u * 4u);
    u32 pRows = heap_alloc(12u * 4u);
    for (u32 y = 0; y < 12u; y++) *(u32 *)(usize)(pRows + y * 4u) = y * 12u;
    *(u32 *)(usize)(pPreset + 0x3C + 0x00) = pCells;
    *(u32 *)(usize)(pPreset + 0x3C + 0x04) = pRows;
    *(u32 *)(usize)(pPreset + 0x3C + 0x08) = 12u;
    *(u32 *)(usize)(pPreset + 0x3C + 0x0C) = 12u;
    *(u32 *)(usize)(pRoomEx + 0x20) = pPreset;
    *(s32 *)(usize)(pRoomEx + 0x34) = 10; *(s32 *)(usize)(pRoomEx + 0x38) = 10;
    *(s32 *)(usize)(pRoomEx + 0x3C) = 8;  *(s32 *)(usize)(pRoomEx + 0x40) = 8;
    *(u32 *)(usize)(pLevel + 0x14) = pOutdoors;

    u32 s0 = heap_alloc(0x20), s1 = heap_alloc(0x20), s2 = heap_alloc(0x20);
    *(s32 *)(usize)(s0 + 0x00) = 11; *(s32 *)(usize)(s0 + 0x04) = 11; *(u32 *)(usize)(s0 + 0x10) = s1;
    *(s32 *)(usize)(s1 + 0x00) = 16; *(s32 *)(usize)(s1 + 0x04) = 16; *(u32 *)(usize)(s1 + 0x10) = (c >= 2) ? s2 : 0u;
    *(s32 *)(usize)(s2 + 0x00) = 12; *(s32 *)(usize)(s2 + 0x04) = 16; *(u32 *)(usize)(s2 + 0x10) = 0u;
    *(u32 *)(usize)(pOutdoors + 0x68) = (c == 0) ? 0u : s0;
    *(u32 *)(usize)(pOutdoors + 0x260) = (c == 0) ? 0u : (c == 3) ? 2u : 1u;
    if (c == 3) {
      u32 s3 = heap_alloc(0x20), s4 = heap_alloc(0x20);
      *(s32 *)(usize)(s3 + 0x00) = 10; *(s32 *)(usize)(s3 + 0x04) = 15; *(u32 *)(usize)(s3 + 0x10) = s4;
      *(s32 *)(usize)(s4 + 0x00) = 17; *(s32 *)(usize)(s4 + 0x04) = 15;
      *(u32 *)(usize)(pOutdoors + 0x6C) = s3;
      track_region(s3, 0x20); track_region(s4, 0x20);
    }

    track_region(pLevel, 0x200); track_region(pOutdoors, 0x280);
    track_region(pRoomEx, 0xEC); track_region(pPreset, 0x100);
    track_region(pCells, 12u * 12u * 4u); track_region(pRows, 12u * 4u);
    track_region(s0, 0x20); track_region(s1, 0x20); track_region(s2, 0x20);
    snapshot_pre();
    call_eax_ecx_void(0x6FD8DC90u, pRoomEx, pLevel);
    snprintf(note, sizeof(note), "f12_raster_roads_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u]", pRoomEx, pLevel);
    emit_vector(fp, "0x6FD8DC90", "DRLGROOMTILE_RasterizeOutdoorRoadsToPreset113c", c, note, args, 0u, 0u);
  }

  /* F13: 0x6FDB8970 DRLGROOMTILE_SpawnWarpPresetUnit113c */
  {
    u32 *pSgpt = (u32 *)(usize)0x6FDE9E1Cu;
    u32 savedSgpt = *pSgpt;
    for (int c = 0; c < 6; c++) {
      reset_heap();
      u32 dt = heap_alloc(0x1000);
      u32 monTbl = heap_alloc(600u * 424u);
      *(u32 *)(usize)(dt + 0xA78u) = monTbl; *(u32 *)(usize)(dt + 0xA80u) = 600u;
      *pSgpt = dt;

      u32 pDrlg = heap_alloc(0x500);
      u32 pLevel = heap_alloc(0x200);
      u32 pRoomEx = heap_alloc(0xEC);
      u32 pTileData = (c == 3 || c == 5) ? 0u : heap_alloc(0x30);
      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32 *)(usize)(pLevel + 0x1D0) = (c == 2) ? 109u : (c == 4) ? 55u : 28u; /* 28: idx 0..3; 109: idx 23..24 (mon 435); 55: idx 19..20 (obj 92/91 = 0x5C/0x5B) */
      *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
      *(s32 *)(usize)(pRoomEx + 0x34) = 10; *(s32 *)(usize)(pRoomEx + 0x38) = 10;
      *(s32 *)(usize)(pRoomEx + 0x3C) = 8;  *(s32 *)(usize)(pRoomEx + 0x40) = 8;
      *(u32 *)(usize)(pRoomEx + 0x14) = (c == 4) ? 0x00000003u : 0x12345678u;
      *(u32 *)(usize)(pRoomEx + 0x18) = 0u;

      if (pTileData != 0u) {
        *(u32 *)(usize)(pTileData + 0x14) = (c == 1) ? 0x20u : 0u;
        *(u32 *)(usize)(pTileData + 0x1C) = 9u;
        track_region(pTileData, 0x30);
      }
      /* Build dwTileFlags: style in bits 20..25, seq in bits 8..15:
         level 28 idx 0 = [7,0,1]; level 109 idx 24 = [2,1,0] (bIsType9=0, mon 435); level 55 idx 20 = [2,1,0] (obj 91 = 0x5B) */
      u32 style = (c == 2 || c == 4) ? 2u : 7u;
      u32 seq   = (c == 2 || c == 4) ? 1u : 0u;
      u32 dwTileFlags = (style << 20) | (seq << 8);
      u32 nTileX = (c == 5) ? 99u : 12u;
      u32 nTileY = 12u;
      u32 nTileType = (c == 3) ? 9u : 0u;

      track_region(0x6FDE9E1Cu, 4u); track_region(dt, 0x1000u);
      track_region(pDrlg, 0x500); track_region(pLevel, 0x200); track_region(pRoomEx, 0xEC);
      snapshot_pre();
      call_eax_ecx_stk4_void(0x6FDB8970u, nTileX, pRoomEx, pTileData, dwTileFlags, nTileY, nTileType);
      snprintf(note, sizeof(note), "f13_spawn_warp_preset_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u]", nTileX, pRoomEx, pTileData, dwTileFlags, nTileY, nTileType);
      emit_vector(fp, "0x6FDB8970", "DRLGROOMTILE_SpawnWarpPresetUnit113c", c, note, args, 0u, 0u);
    }
    *pSgpt = savedSgpt;
  }

  /* F14: 0x6FDB9090 DRLGROOMTILE_AllocLevelWarpPresetUnit113c */
  {
    u32 *pWarpPtr = (u32 *)(usize)0x6FDF142Cu;
    u32 *pWarpCnt = (u32 *)(usize)0x6FDF1430u;
    u32 savedWP = *pWarpPtr, savedWC = *pWarpCnt;
    for (int c = 0; c < 4; c++) {
      reset_heap();
      u32 warpTbl = heap_alloc(3u * 0x30u);
      /* rec 0: id=2, dir='l'(0x6C), class=10, dx=2, dy=3; rec 1: id=2, dir='r'(0x72), class=11, dx=4, dy=1 */
      *(u32 *)(usize)(warpTbl + 0x00) = 2u; *(u32 *)(usize)(warpTbl + 0x1C) = 2u; *(u32 *)(usize)(warpTbl + 0x20) = 3u; *(u8 *)(usize)(warpTbl + 0x2C) = 0x6Cu;
      *(u32 *)(usize)(warpTbl + 0x30) = 2u; *(u32 *)(usize)(warpTbl + 0x4C) = 4u; *(u32 *)(usize)(warpTbl + 0x50) = 1u; *(u8 *)(usize)(warpTbl + 0x5C) = 0x72u;
      *pWarpPtr = warpTbl;
      *pWarpCnt = 2u;

      u32 pDrlg = heap_alloc(0x500);
      u32 pLevel = heap_alloc(0x200);
      u32 pRoomEx = heap_alloc(0xEC);
      u32 pWarpNode = heap_alloc(0x48);
      *(u32 *)(usize)(pWarpNode + 0x00) = 1u;
      *(s32 *)(usize)(pWarpNode + 0x24 + 0x00) = 2; /* target level 2 at slot 0 */
      *(u32 *)(usize)(pDrlg + 0x90) = pWarpNode;
      *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
      *(u32 *)(usize)(pLevel + 0x1D0) = 1u;
      *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
      *(s32 *)(usize)(pRoomEx + 0x34) = 10; *(s32 *)(usize)(pRoomEx + 0x38) = 10;
      *(s32 *)(usize)(pRoomEx + 0x3C) = 8;  *(s32 *)(usize)(pRoomEx + 0x40) = 8;

      u32 nTileX = (c == 2) ? 18u : 12u;
      u32 nTileY = (c == 3) ? 18u : 13u;
      u32 nTileType = (c == 1) ? 11u : 10u;

      track_region(0x6FDF142Cu, 4u); track_region(0x6FDF1430u, 4u);
      track_region(warpTbl, 3u * 0x30u); track_region(pWarpNode, 0x48);
      track_region(pDrlg, 0x500); track_region(pLevel, 0x200); track_region(pRoomEx, 0xEC);
      snapshot_pre();
      u32 ret = call_eax_ecx_stk3_u32(0x6FDB9090u, 0u, pRoomEx, nTileX, nTileY, nTileType);
      snprintf(note, sizeof(note), "f14_alloc_lvl_warp_c%d", c);
      snprintf(args, sizeof(args), "[0,%u,%u,%u,%u]", pRoomEx, nTileX, nTileY, nTileType);
      emit_vector(fp, "0x6FDB9090", "DRLGROOMTILE_AllocLevelWarpPresetUnit113c", c, note, args, ret, 0xFFFFFFFFu);
    }
    *pWarpPtr = savedWP; *pWarpCnt = savedWC;
  }

  /* F15: 0x6FD7DC90 DRLG_CollectWarpAndSpecialRoomCenters113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 pDrlg = heap_alloc(0x500);
    u32 pLevel = heap_alloc(0x240);
    u32 pWarpNode = heap_alloc(0x48);
    *(u32 *)(usize)(pWarpNode + 0x00) = 1u;
    *(s32 *)(usize)(pWarpNode + 0x24 + 0x00) = -1;
    *(s32 *)(usize)(pWarpNode + 0x24 + 0x04) = 2; /* bit 1 -> 0x20 valid */
    *(u32 *)(usize)(pDrlg + 0x90) = pWarpNode;
    *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32 *)(usize)(pLevel + 0x1D0) = 1u;

    u32 r0 = heap_alloc(0xEC), r1 = heap_alloc(0xEC), r2 = heap_alloc(0xEC);
    *(s32 *)(usize)(r0 + 0x34) = 10; *(s32 *)(usize)(r0 + 0x38) = 20; *(s32 *)(usize)(r0 + 0x3C) = 6; *(s32 *)(usize)(r0 + 0x40) = 8;
    *(s32 *)(usize)(r1 + 0x34) = 30; *(s32 *)(usize)(r1 + 0x38) = 40; *(s32 *)(usize)(r1 + 0x3C) = 4; *(s32 *)(usize)(r1 + 0x40) = 4;
    *(s32 *)(usize)(r2 + 0x34) = 50; *(s32 *)(usize)(r2 + 0x38) = 60; *(s32 *)(usize)(r2 + 0x3C) = 8; *(s32 *)(usize)(r2 + 0x40) = 6;
    *(u32 *)(usize)(r0 + 0x24) = r1;
    *(u32 *)(usize)(r1 + 0x24) = r2;
    *(u32 *)(usize)(pLevel + 0x10) = (c == 0) ? 0u : r0;
    if (c == 1) {
      *(u32 *)(usize)(r0 + 0x28) = 0x10000u; /* special */
      *(u32 *)(usize)(r1 + 0x28) = 0x0010u;  /* warp bit 0 == -1 -> skip */
      *(u32 *)(usize)(r2 + 0x28) = 0x0020u;  /* warp bit 1 == 2 -> keep */
    } else if (c == 2) {
      *(u32 *)(usize)(r0 + 0x28) = 0x20000u; /* special */
      *(u32 *)(usize)(r1 + 0x28) = 0u;
      *(u32 *)(usize)(r2 + 0x28) = 0x10010u; /* special + warp -> keep */
    } else if (c == 3) {
      *(u32 *)(usize)(r0 + 0x28) = 0x0010u;  /* warp bit 0 == -1, no special -> skip */
      *(u32 *)(usize)(r1 + 0x28) = 0x0020u;  /* valid warp */
      *(u32 *)(usize)(r2 + 0x28) = 0u;
    }

    track_region(pDrlg, 0x500); track_region(pLevel, 0x240); track_region(pWarpNode, 0x48);
    track_region(r0, 0xEC); track_region(r1, 0xEC); track_region(r2, 0xEC);
    snapshot_pre();
    call_esi_void(0x6FD7DC90u, pLevel);
    snprintf(note, sizeof(note), "f15_collect_centers_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FD7DC90", "DRLG_CollectWarpAndSpecialRoomCenters113c", c, note, args, 0u, 0u);
  }
}

static void emit_i13c_2_a(FILE *fp) {
  char note[64], args[256];

  /* F16: 0x6FD9D7E0 COLLISION_FindFreePositionBasic113c */
  {
    fn_std7_u32_t fn = (fn_std7_u32_t)(usize)0x6FD9D7E0u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pOut = heap_alloc(8u);
      *(s32 *)(usize)(pOut + 0) = 104;
      *(s32 *)(usize)(pOut + 4) = 104;
      if (c >= 1) set_world_cell(&w, 104, 104, 0x0001u);
      if (c == 2) {
        for (s32 yy = 90; yy < 120; yy++)
          for (s32 xx = 90; xx < 120; xx++)
            set_world_cell(&w, xx, yy, 0x0001u);
      }
      u32 bFallback = (c == 2) ? 1u : 0u;
      track_region(pOut, 8u);
      snapshot_pre();
      u32 ret = fn(w.r[4], pOut, 0u, 1u, 0x0001u, 0u, bFallback);
      snprintf(note, sizeof(note), "f16_find_free_basic_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u,0,1,1,0,%u]", w.r[4], pOut, bFallback);
      emit_vector(fp, "0x6FD9D7E0", "COLLISION_FindFreePositionBasic113c", c, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F17: 0x6FD9D810 COLLISION_FindFreePositionWithStep113c */
  {
    fn_std5_u32_t fn = (fn_std5_u32_t)(usize)0x6FD9D810u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pOut = heap_alloc(8u);
      *(s32 *)(usize)(pOut + 0) = 104;
      *(s32 *)(usize)(pOut + 4) = 104;
      if (c >= 1) set_world_cell(&w, 104, 104, 0x0001u);
      if (c == 2) {
        for (s32 yy = 103; yy <= 105; yy++)
          for (s32 xx = 103; xx <= 105; xx++)
            set_world_cell(&w, xx, yy, 0x0001u);
      }
      u32 nStep = (c == 2) ? 2u : 1u;
      track_region(pOut, 8u);
      snapshot_pre();
      u32 ret = fn(w.r[4], pOut, 1u, 0x0001u, nStep);
      snprintf(note, sizeof(note), "f17_find_free_step_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u,1,1,%u]", w.r[4], pOut, nStep);
      emit_vector(fp, "0x6FD9D810", "COLLISION_FindFreePositionWithStep113c", c, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F18: 0x6FD9D840 COLLISION_FindFreePositionSimple113c */
  {
    fn_std5_u32_t fn = (fn_std5_u32_t)(usize)0x6FD9D840u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pOut = heap_alloc(8u);
      *(s32 *)(usize)(pOut + 0) = 104;
      *(s32 *)(usize)(pOut + 4) = 104;
      if (c >= 1) set_world_cell(&w, 104, 104, 0x0001u);
      if (c == 2) {
        for (s32 yy = 90; yy < 120; yy++)
          for (s32 xx = 90; xx < 120; xx++)
            set_world_cell(&w, xx, yy, 0x0001u);
      }
      u32 bFallback = (c == 2) ? 1u : 0u;
      track_region(pOut, 8u);
      snapshot_pre();
      u32 ret = fn(w.r[4], pOut, 1u, 0x0001u, bFallback);
      snprintf(note, sizeof(note), "f18_find_free_simple_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u,1,1,%u]", w.r[4], pOut, bFallback);
      emit_vector(fp, "0x6FD9D840", "COLLISION_FindFreePositionSimple113c", c, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F19: 0x6FD8C720 DUNGEON_AllocActiveRoom113c */
  {
    fn_std6_u32_t fn = (fn_std6_u32_t)(usize)0x6FD8C720u;
    for (int c = 0; c < 4; c++) {
      reset_heap();
      u32 pAct = heap_alloc(0x60);
      u32 pPrevRoom = heap_alloc(0x80);
      u32 pRoomEx = heap_alloc(0xEC);
      u32 pCoords = heap_alloc(0x20);
      u32 pTileGrid = heap_alloc(0x18);
      u32 pFloors = heap_alloc(0x30);
      u32 pLibF = heap_alloc(0x50);
      u32 ppNearEx = heap_alloc(4u);
      *(u8 *)(usize)(pLibF + 0x28u) = 0x02u;

      *(u32 *)(usize)(pAct + 0x10) = (c == 1) ? pPrevRoom : 0u;
      *(u32 *)(usize)(pAct + 0x4C) = (c == 2) ? TRAMP_F19_ADDR : 0u;
      *(u32 *)(usize)(pAct + 0x5C) = 0x1111u;

      *(u32 *)(usize)(pCoords + 0x00) = 50u; *(u32 *)(usize)(pCoords + 0x04) = 50u;
      *(u32 *)(usize)(pCoords + 0x08) = 10u; *(u32 *)(usize)(pCoords + 0x0C) = 10u;
      *(u32 *)(usize)(pCoords + 0x10) = 10u; *(u32 *)(usize)(pCoords + 0x14) = 10u;
      *(u32 *)(usize)(pCoords + 0x18) = 2u;  *(u32 *)(usize)(pCoords + 0x1C) = 2u;

      *(u32 *)(usize)(ppNearEx + 0u) = pRoomEx;
      *(u32 *)(usize)(pRoomEx + 0x08) = ppNearEx;
      *(u32 *)(usize)(pRoomEx + 0x2C) = (c == 0) ? 0u : 1u;

      if (c == 3) {
        *(u32 *)(usize)(pTileGrid + 0x08) = pFloors; *(u32 *)(usize)(pTileGrid + 0x0C) = 1u;
        *(u32 *)(usize)(pFloors + 0x14) = 0x02u; *(u32 *)(usize)(pFloors + 0x18) = pLibF;
      }

      u32 argGrid = (c == 0) ? 0u : pTileGrid;
      u32 dwFlags = (c == 1) ? 4u : (c == 2) ? 1u : 0u;
      track_region(pAct, 0x60); track_region(pPrevRoom, 0x80); track_region(pRoomEx, 0xEC);
      track_region(pCoords, 0x20); track_region(pTileGrid, 0x18); track_region(pFloors, 0x30);
      track_region(pLibF, 0x50); track_region(ppNearEx, 4u);
      snapshot_pre();
      u32 ret = fn(pAct, pRoomEx, pCoords, argGrid, 0xABCDE000u + (u32)c, dwFlags);
      snprintf(note, sizeof(note), "f19_alloc_active_room_c%d", c);
      snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u]",
        pAct, pRoomEx, pCoords, argGrid, 0xABCDE000u + (u32)c, dwFlags);
      emit_vector(fp, "0x6FD8C720", "DUNGEON_AllocActiveRoom113c", c, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F20: 0x6FD5E1E0 PATH_WarpUnitToRoomAndCoord113c */
  {
    fn_std5_u32_t fn = (fn_std5_u32_t)(usize)0x6FD5E1E0u;
    for (int c = 0; c < 3; c++) {
      reset_heap();
      CollWorld w; build_coll_world(&w);
      u32 pPath = heap_alloc(0x200);
      u32 pUnit = heap_alloc(0x100);
      *(u32 *)(usize)(pUnit + 0x00) = (c == 0) ? 3u : 0u;
      *(u32 *)(usize)(pUnit + 0x2C) = pPath;
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u32 *)(usize)(pPath + 0x1C) = w.r[4];
      if (c == 1) {
        *(u32 *)(usize)(w.r[4] + 0x74) = pUnit;
        *(u32 *)(usize)(w.r[4] + 0x28) = 1u;
      }
      *(u16 *)(usize)(pPath + 0x02) = 102u; *(u16 *)(usize)(pPath + 0x06) = 102u;
      *(u32 *)(usize)(pPath + 0x28) = 7u;
      *(u32 *)(usize)(pPath + 0x44) = 1u; *(u32 *)(usize)(pPath + 0x48) = 1u;
      *(u32 *)(usize)(pPath + 0x4C) = 0x80u; *(u32 *)(usize)(pPath + 0x50) = 0x1C01u;
      u32 nx = (c == 0) ? 105u : (c == 1) ? 114u : 103u;
      u32 ny = (c == 0) ? 106u : (c == 1) ? 105u : 104u;
      u32 dstRoom = (c == 1) ? w.r[5] : w.r[4];
      track_region(pPath, 0x200); track_region(pUnit, 0x100);
      snapshot_pre();
      u32 ret = fn(pPath, 0u, dstRoom, nx, ny);
      snprintf(note, sizeof(note), "f20_warp_unit_c%d", c);
      snprintf(args, sizeof(args), "[%u,0,%u,%u,%u]", pPath, dstRoom, nx, ny);
      emit_vector(fp, "0x6FD5E1E0", "PATH_WarpUnitToRoomAndCoord113c", c, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F21: 0x6FD60AF0 DRLGMAZE_PlaceTunnelsSpecialPresets113c */
  {
    fn_std1_void_t fn = (fn_std1_void_t)(usize)0x6FD60AF0u;
    for (int c = 0; c < 4; c++) {
      reset_heap();
      u32 pLevel, pDrlg, pMaze, pBase;
      /* seedLo produces newLo & 3 == 0..3 cleanly by picking inverse or scanning */
      u32 seeds[4] = { 0u, 1u, 2u, 3u };
      setup_maze_level(&pLevel, &pDrlg, &pMaze, &pBase, 3u, seeds[c]);
      *(u32 *)(usize)(pBase + 0x14) = seeds[c];
      *(u32 *)(usize)(pBase + 0x18) = 0u;
      snapshot_pre();
      fn(pLevel);
      snprintf(note, sizeof(note), "f21_tunnels_presets_c%d", c);
      snprintf(args, sizeof(args), "[%u]", pLevel);
      emit_vector(fp, "0x6FD60AF0", "DRLGMAZE_PlaceTunnelsSpecialPresets113c", c, note, args, 0u, 0u);
    }
  }

  /* F22: 0x6FDB8A90 DRLGROOMTILE_ApplyTileFlagsAndSpawnWarp113c */
  for (int c = 0; c < 5; c++) {
    reset_heap();
    u32 pDrlg = heap_alloc(0x500);
    u32 pLevel = heap_alloc(0x200);
    u32 pRoomEx = heap_alloc(0xEC);
    u32 pTileData = heap_alloc(0x30);
    u32 pTileEntry = heap_alloc(0x40);
    *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32 *)(usize)(pLevel + 0x1D0) = 28u;
    *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
    *(s32 *)(usize)(pRoomEx + 0x34) = 10; *(s32 *)(usize)(pRoomEx + 0x38) = 10;
    *(s32 *)(usize)(pRoomEx + 0x3C) = 8;  *(s32 *)(usize)(pRoomEx + 0x40) = 8;
    *(u32 *)(usize)(pTileData + 0x14) = (c == 1) ? 0x08u : 0u;
    *(u32 *)(usize)(pTileData + 0x18) = pTileEntry;
    *(u32 *)(usize)(pTileData + 0x1C) = 9u;
    *(u16 *)(usize)(pTileEntry + 0x06) = (c == 4) ? 0x05u : 0x00u;

    u32 flagsArr[5] = { 0x9408008Cu, 0x04030004u, 0x20000008u, 0x10040000u, 0x00000000u };
    u32 typesArr[5] = { 9u, 13u, 14u, 8u, 11u };
    u32 argRoom = (c == 3) ? 0u : pRoomEx;

    track_region(pDrlg, 0x500); track_region(pLevel, 0x200);
    track_region(pRoomEx, 0xEC); track_region(pTileData, 0x30); track_region(pTileEntry, 0x40);
    snapshot_pre();
    call_eax_ebx_ecx_esi_stk2_void(0x6FDB8A90u, 12u, flagsArr[c], argRoom, pTileData, typesArr[c], 12u);
    snprintf(note, sizeof(note), "f22_apply_tile_flags_c%d", c);
    snprintf(args, sizeof(args), "[12,%u,%u,%u,%u,12]", flagsArr[c], argRoom, pTileData, typesArr[c]);
    emit_vector(fp, "0x6FDB8A90", "DRLGROOMTILE_ApplyTileFlagsAndSpawnWarp113c", c, note, args, 0u, 0u);
  }

  /* F23: 0x6FD60160 DRLGMAZE_ExpandRoomsToTargetCount113c */
  {
    fn_std1_void_t fn = (fn_std1_void_t)(usize)0x6FD60160u;
    for (int c = 0; c < 4; c++) {
      reset_heap();
      u32 pLevel, pDrlg, pMaze, pBase;
      setup_maze_level(&pLevel, &pDrlg, &pMaze, &pBase, 3u, 0x12345u + (u32)c);
      *(u32 *)(usize)(pLevel + 0x1D0) = (c == 1) ? 46u : (c == 2) ? 47u : 45u;
      *(u32 *)(usize)(pDrlg + 0x94) = 46u;
      *(u32 *)(usize)(pDrlg + 0x484) = 47u;
      *(u8  *)(usize)(pDrlg + 0x450) = (c == 3) ? 1u : 0u;
      *(u32 *)(usize)(pMaze + 0x04) = (c == 0) ? 1u : 2u;
      *(u32 *)(usize)(pMaze + 0x08) = 4u;
      snapshot_pre();
      fn(pLevel);
      snprintf(note, sizeof(note), "f23_expand_rooms_c%d", c);
      snprintf(args, sizeof(args), "[%u]", pLevel);
      emit_vector(fp, "0x6FD60160", "DRLGMAZE_ExpandRoomsToTargetCount113c", c, note, args, 0u, 0u);
    }
  }

  /* F24..F27: directional expandable room pickers */
  {
    const char *vas[4] = { "0x6FD60730", "0x6FD60820", "0x6FD60910", "0x6FD60A00" };
    const char *names[4] = {
      "DRLGMAZE_FindSouthmostExpandableRoom113c",
      "DRLGMAZE_FindEastmostExpandableRoom113c",
      "DRLGMAZE_FindWestmostExpandableRoom113c",
      "DRLGMAZE_FindNorthmostExpandableRoom113c"
    };
    const u32 addrs[4] = { 0x6FD60730u, 0x6FD60820u, 0x6FD60910u, 0x6FD60A00u };
    for (int f = 0; f < 4; f++) {
      for (int c = 0; c < 4; c++) {
        reset_heap();
        u32 pLevel, pDrlg, pMaze, r0;
        setup_maze_level(&pLevel, &pDrlg, &pMaze, &r0, 3u, 0x333u);
        u32 r1 = heap_alloc(0xEC), pr1 = heap_alloc(0x100);
        u32 r2 = heap_alloc(0xEC), pr2 = heap_alloc(0x100);
        *(u32 *)(usize)(r1 + 0x20) = pr1; *(u32 *)(usize)(r1 + 0x58) = pLevel;
        *(u32 *)(usize)(r2 + 0x20) = pr2; *(u32 *)(usize)(r2 + 0x58) = pLevel;
        /* Spread r0 (100,100), r1 (130,130), r2 (70,70) so all 4 directions have clear extrema */
        *(s32 *)(usize)(r1 + 0x34) = 130; *(s32 *)(usize)(r1 + 0x38) = 130; *(s32 *)(usize)(r1 + 0x3C) = 10; *(s32 *)(usize)(r1 + 0x40) = 10;
        *(s32 *)(usize)(r2 + 0x34) = 70;  *(s32 *)(usize)(r2 + 0x38) = 70;  *(s32 *)(usize)(r2 + 0x3C) = 10; *(s32 *)(usize)(r2 + 0x40) = 10;
        *(u32 *)(usize)(r0 + 0x24) = r1;
        *(u32 *)(usize)(r1 + 0x24) = r2;
        *(u32 *)(usize)(pLevel + 0x08) = 3u;
        if (c == 0) {
          *(u32 *)(usize)(pLevel + 0x10) = 0u;
          *(u32 *)(usize)(pLevel + 0x08) = 0u;
        } else if (c == 2) {
          /* mark extremum candidate preset-flagged so fallback wins */
          *(u32 *)(usize)(pr1 + 0x0C) = 0x02u;
          *(u32 *)(usize)(pr2 + 0x0C) = 0x02u;
        } else if (c == 3) {
          /* give r0/r1/r2 blocking orth in target dir -> returns 0 or non-blocked */
          u32 orthDir = (f == 0) ? 3u : (f == 1) ? 2u : (f == 2) ? 0u : 1u;
          u32 o1 = heap_alloc(0x18), o2 = heap_alloc(0x18);
          *(u32 *)(usize)(o1 + 0x04) = orthDir; *(u32 *)(usize)(r1 + 0x00) = o1;
          *(u32 *)(usize)(o2 + 0x04) = orthDir; *(u32 *)(usize)(r2 + 0x00) = o2;
          track_region(o1, 0x18); track_region(o2, 0x18);
        }
        track_region(r1, 0xEC); track_region(pr1, 0x100);
        track_region(r2, 0xEC); track_region(pr2, 0x100);
        snapshot_pre();
        u32 ret = (f == 3) ? call_eax_u32(addrs[f], pLevel) : call_ecx_u32(addrs[f], pLevel);
        snprintf(note, sizeof(note), "f%d_dir_pick_c%d", 24 + f, c);
        snprintf(args, sizeof(args), "[%u]", pLevel);
        emit_vector(fp, vas[f], names[f], c, note, args, ret, 0xFFFFFFFFu);
      }
    }
  }
}

static void setup_outdoors_level(
  u32 *outLevel, u32 *outDrlg, u32 *outOutdoors, u32 *outPrestTbl, u32 *outDt,
  u32 gridW, u32 gridH, u32 prestCount, u32 seedLo
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
  *(u32 *)(usize)(pOutdoors + 0x04) = g0Cells; *(u32 *)(usize)(pOutdoors + 0x08) = g0Rows;
  *(u32 *)(usize)(pOutdoors + 0x18) = g1Cells; *(u32 *)(usize)(pOutdoors + 0x1C) = g1Rows;
  *(u32 *)(usize)(pOutdoors + 0x2C) = g2Cells; *(u32 *)(usize)(pOutdoors + 0x30) = g2Rows;
  *(u32 *)(usize)(pOutdoors + 0x34) = gridW;   *(u32 *)(usize)(pOutdoors + 0x38) = gridH;
  *(u32 *)(usize)(pOutdoors + 0x5C) = gridW;   *(u32 *)(usize)(pOutdoors + 0x60) = gridH;

  *(u32 *)(usize)(pLevel + 0x14) = pOutdoors;
  *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
  *(u32 *)(usize)(pLevel + 0x1C4) = seedLo;
  *(u32 *)(usize)(pLevel + 0x1C8) = 0x9ABCDEF0u;
  *(u32 *)(usize)(dt + 0xC68) = prestCount;

  for (u32 pid = 0u; pid < prestCount; pid++) {
    *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x00) = pid;
    *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x28) = 2u;
    *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x2C) = 2u;
    *(u32 *)(usize)(prestTbl + pid * 0x1B0u + 0x40) = 1u;
  }

  track_region(pLevel, 0x200); track_region(pDrlg, 0x500);
  track_region(pOutdoors, 0x280); track_region(dt, 0x1000);
  track_region(prestTbl, prestCount * 0x1B0u);
  track_region(g0Cells, nCells * 4u); track_region(g0Rows, gridH * 4u);
  track_region(g1Cells, nCells * 4u); track_region(g1Rows, gridH * 4u);
  track_region(g2Cells, nCells * 4u); track_region(g2Rows, gridH * 4u);

  *outLevel = pLevel; *outDrlg = pDrlg; *outOutdoors = pOutdoors;
  *outPrestTbl = prestTbl; *outDt = dt;
}

static void emit_i13c_2_b(FILE *fp) {
  char note[64], args[256];
  u32 *pSgpt = (u32 *)(usize)0x6FDE9E1Cu;
  u32 *pLvlDefGlobal = (u32 *)(usize)0x6FDF0B38u;
  u32 *pPrestGlobal = (u32 *)(usize)0x6FDF0B3Cu;
  u32 *pLvlSubGlobal = (u32 *)(usize)0x6FDF143Cu;
  u32 *pLvlSubLut = (u32 *)(usize)0x6FDF1444u;
  u32 savedSgpt = *pSgpt, savedLD = *pLvlDefGlobal, savedPrest = *pPrestGlobal;
  u32 savedLS = *pLvlSubGlobal, savedLSL = *pLvlSubLut;

  /* F28: 0x6FD9A5C0 DRLGPRESET_CreatePresetRoomEx113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 dt = heap_alloc(0x1000);
    u32 lvlDefTbl = heap_alloc(8u * 0x9Cu);
    u32 lvlSubTbl = heap_alloc(4u * 0x15Cu);
    u32 lvlSubLut = heap_alloc(4u * 4u);
    *(u32 *)(usize)(dt + 0xC5Cu) = 8u;
    *(s32 *)(usize)(lvlDefTbl + 1u * 0x9Cu + 0x38u) = (c == 0) ? -1 : 1;
    *(s32 *)(usize)(lvlDefTbl + 1u * 0x9Cu + 0x3Cu) = (c == 0) ? -1 : (c == 2) ? 1 : 0;
    *(s32 *)(usize)(lvlDefTbl + 2u * 0x9Cu + 0x38u) = 1;
    *(s32 *)(usize)(lvlDefTbl + 2u * 0x9Cu + 0x3Cu) = 0;
    *(u32 *)(usize)(lvlSubLut + 1u * 4u) = 0u;
    *(u32 *)(usize)(lvlSubTbl + 0u * 0x15Cu + 0x00u) = 1u;
    *(u32 *)(usize)(lvlSubTbl + 0u * 0x15Cu + 0x48u) = 0x10u;
    *(u32 *)(usize)(lvlSubTbl + 0u * 0x15Cu + 0x11Cu) = 100u;
    *(u32 *)(usize)(lvlSubTbl + 0u * 0x15Cu + 0x120u) = 0u;
    *(u32 *)(usize)(lvlSubTbl + 1u * 0x15Cu + 0x00u) = 1u;
    *(u32 *)(usize)(lvlSubTbl + 1u * 0x15Cu + 0x48u) = 0x20u;
    *(u32 *)(usize)(lvlSubTbl + 1u * 0x15Cu + 0x11Cu) = 100u;
    *(u32 *)(usize)(lvlSubTbl + 2u * 0x15Cu + 0x00u) = 2u;

    *pSgpt = dt; *pLvlDefGlobal = lvlDefTbl;
    *pLvlSubGlobal = lvlSubTbl; *pLvlSubLut = lvlSubLut;

    u32 pLevel = heap_alloc(0x200);
    u32 pDrlg = heap_alloc(0x500);
    u32 pPrevRoom = heap_alloc(0xEC);
    *(u32 *)(usize)(pLevel + 0x1B4) = pDrlg;
    *(u32 *)(usize)(pLevel + 0x1D0) = (c == 2) ? 2u : 1u;
    *(u32 *)(usize)(pLevel + 0x10) = (c == 3) ? pPrevRoom : 0u;
    *(u32 *)(usize)(pLevel + 0x08) = (c == 3) ? 1u : 0u;
    *(u32 *)(usize)(pLevel + 0x1C4) = 0x12345678u;

    u32 dwFlags = (c == 2) ? 0x4000u : 0x0100u;
    u32 dt1Mask = (c == 1) ? 0x05u : 0x0Fu;
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B38u, 4u);
    track_region(0x6FDF143Cu, 4u); track_region(0x6FDF1444u, 4u);
    track_region(dt, 0x1000u); track_region(lvlDefTbl, 8u * 0x9Cu);
    track_region(lvlSubTbl, 4u * 0x15Cu); track_region(lvlSubLut, 16u);
    track_region(pLevel, 0x200); track_region(pDrlg, 0x500); track_region(pPrevRoom, 0xEC);
    snapshot_pre();
    u32 ret = call_eax_ecx_stk7_u32(0x6FD9A5C0u, dwFlags, pLevel, 10u, 20u, 8u, 8u, 55u, 2u, dt1Mask);
    snprintf(note, sizeof(note), "f28_create_preset_room_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u,10,20,8,8,55,2,%u]", dwFlags, pLevel, dt1Mask);
    emit_vector(fp, "0x6FD9A5C0", "DRLGPRESET_CreatePresetRoomEx113c", c, note, args, ret, 0xFFFFFFFFu);
  }
  *pSgpt = savedSgpt; *pLvlDefGlobal = savedLD;
  *pLvlSubGlobal = savedLS; *pLvlSubLut = savedLSL;

  /* F29: 0x6FD7E1F0 DRLG_ActivateRoomEx113c */
  for (int c = 0; c < 4; c++) {
    reset_heap();
    u32 pDrlg = heap_alloc(0x500);
    u32 pAct = heap_alloc(0x60);
    u32 pRoomEx = heap_alloc(0xEC);
    u32 pTileGrid = heap_alloc(0x30);
    u32 pTile = heap_alloc(0x30);
    u32 pLib = heap_alloc(0x50);
    u32 ppNearEx = heap_alloc(4u);
    *(u8 *)(usize)(pLib + 0x28u) = 0x02u;
    *(u32 *)(usize)(pTile + 0x14u) = 0x02u;
    *(u32 *)(usize)(pTile + 0x18u) = pLib;
    *(u32 *)(usize)(pDrlg + 0x46C) = pAct;
    *(u32 *)(usize)(pAct + 0x5C) = 0x1111u;
    *(s32 *)(usize)(pRoomEx + 0x34) = 10; *(s32 *)(usize)(pRoomEx + 0x38) = 10;
    *(s32 *)(usize)(pRoomEx + 0x3C) = 2;  *(s32 *)(usize)(pRoomEx + 0x40) = 2;
    *(u32 *)(usize)(pRoomEx + 0x54) = pTileGrid;
    *(u32 *)(usize)(pRoomEx + 0x08) = ppNearEx;
    *(u32 *)(usize)(pRoomEx + 0x2C) = 1u;
    *(u32 *)(usize)(ppNearEx + 0u) = pRoomEx;
    *(u32 *)(usize)(pRoomEx + 0x14) = 0x12345u;
    *(u32 *)(usize)(pRoomEx + 0x18) = 0x6789u;
    *(u32 *)(usize)(pRoomEx + 0x28) = (c == 1) ? 0x40000u : 0u;
    *(u8  *)(usize)(pRoomEx + 0x60) = (c == 2) ? 1u : 0u;
    if (c == 1) {
      *(u32 *)(usize)(pTileGrid + 0x1C) = pTile;
      *(u32 *)(usize)(pTileGrid + 0x20) = 1u; /* nFloorCapacity at +0x14 + 0x0C = +0x20 */
    }
    if (c >= 2) {
      *(u32 *)(usize)(pTileGrid + 0x14) = pTile;
      *(u32 *)(usize)(pTileGrid + 0x18) = 1u; /* nWallCapacity at +0x14 + 0x04 = +0x18 */
    }

    track_region(pDrlg, 0x500); track_region(pAct, 0x60);
    track_region(pRoomEx, 0xEC); track_region(pTileGrid, 0x30);
    track_region(pTile, 0x30); track_region(pLib, 0x50); track_region(ppNearEx, 4u);
    snapshot_pre();
    call_esi_stk1_void(0x6FD7E1F0u, pRoomEx, pDrlg);
    snprintf(note, sizeof(note), "f29_activate_room_c%d", c);
    snprintf(args, sizeof(args), "[%u,%u]", pRoomEx, pDrlg);
    emit_vector(fp, "0x6FD7E1F0", "DRLG_ActivateRoomEx113c", c, note, args, 0u, 0u);
  }

  /* F30: 0x6FDD4DA0 DRLGOUTJUNG_SpawnTravincalPresets113c */
  for (int c = 0; c < 3; c++) {
    reset_heap();
    u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
    setup_outdoors_level(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, (c == 2) ? 12u : 10u, (c == 2) ? 12u : 10u, 700u, 0x1111u + (u32)c);
    *pSgpt = dt; *pPrestGlobal = prestTbl;
    *(u32 *)(usize)(pLevel + 0x1D0) = (c == 0) ? 82u : 83u;
    track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
    snapshot_pre();
    call_esi_void(0x6FDD4DA0u, pLevel);
    snprintf(note, sizeof(note), "f30_travincal_c%d", c);
    snprintf(args, sizeof(args), "[%u]", pLevel);
    emit_vector(fp, "0x6FDD4DA0", "DRLGOUTJUNG_SpawnTravincalPresets113c", c, note, args, 0u, 0u);
  }

  /* F31..F37: jungle shuffled preset wrappers */
  {
    const char *vas[7] = {
      "0x6FDD5B80", "0x6FDD5BE0", "0x6FDD5C50", "0x6FDD5C90",
      "0x6FDD5CF0", "0x6FDD5D20", "0x6FDD5D90"
    };
    const char *names[7] = {
      "DRLGOUTJUNG_SpawnPresetsSet1_113c",
      "DRLGOUTJUNG_SpawnPresetsSet2_113c",
      "DRLGOUTJUNG_SpawnPresetsSet3_113c",
      "DRLGOUTJUNG_SpawnPresetsSet4_113c",
      "DRLGOUTJUNG_SpawnPresetsSet5_113c",
      "DRLGOUTJUNG_SpawnPresetsSet6_113c",
      "DRLGOUTJUNG_SpawnPresetsSet7_113c"
    };
    const u32 addrs[7] = {
      0x6FDD5B80u, 0x6FDD5BE0u, 0x6FDD5C50u, 0x6FDD5C90u,
      0x6FDD5CF0u, 0x6FDD5D20u, 0x6FDD5D90u
    };
    const int is_std[7] = { 0, 0, 1, 0, 1, 0, 1 };
    for (int f = 0; f < 7; f++) {
      for (int c = 0; c < 3; c++) {
        reset_heap();
        u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
        u32 gw = (c == 0) ? 12u : (c == 1) ? 15u : 18u;
        setup_outdoors_level(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, gw, gw, 450u, 0x10001u + (u32)(c * 97 + f));
        *pSgpt = dt; *pPrestGlobal = prestTbl;
        track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
        snapshot_pre();
        if (is_std[f]) {
          fn_std1_void_t fn = (fn_std1_void_t)(usize)addrs[f];
          fn(pLevel);
        } else {
          call_esi_void(addrs[f], pLevel);
        }
        snprintf(note, sizeof(note), "f%d_jung_set_c%d", 31 + f, c);
        snprintf(args, sizeof(args), "[%u]", pLevel);
        emit_vector(fp, vas[f], names[f], c, note, args, 0u, 0u);
      }
    }
  }

  /* F38: 0x6FDD6040 DRLGOUTJUNG_SpawnAct4OutdoorPresets113c */
  {
    const u32 lvls[3] = { 104u, 105u, 106u };
    for (int c = 0; c < 3; c++) {
      reset_heap();
      u32 pLevel, pDrlg, pOutdoors, prestTbl, dt;
      u32 gw = (c == 0) ? 14u : (c == 1) ? 16u : 18u;
      setup_outdoors_level(&pLevel, &pDrlg, &pOutdoors, &prestTbl, &dt, gw, gw, 850u, 0x7777u + (u32)c);
      *pSgpt = dt; *pPrestGlobal = prestTbl;
      *(u32 *)(usize)(pLevel + 0x1D0) = lvls[c];
      track_region(0x6FDE9E1Cu, 4u); track_region(0x6FDF0B3Cu, 4u);
      snapshot_pre();
      call_eax_void(0x6FDD6040u, pLevel);
      snprintf(note, sizeof(note), "f38_act4_presets_c%d", c);
      snprintf(args, sizeof(args), "[%u]", pLevel);
      emit_vector(fp, "0x6FDD6040", "DRLGOUTJUNG_SpawnAct4OutdoorPresets113c", c, note, args, 0u, 0u);
    }
  }

  *pSgpt = savedSgpt; *pPrestGlobal = savedPrest;
}

static void emit_i13c_1(FILE *fp) {
  emit_i13c_1_a(fp);
  emit_i13c_1_b(fp);
}

static void emit_i13c_2(FILE *fp) {
  emit_i13c_2_a(fp);
  emit_i13c_2_b(fp);
}

int main(int argc, char **argv) {
  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  const char *out1 = (argc > 1) ? argv[1] : "tests/fixtures/oracle/k1/i13c-1-vectors.ndjson";
  const char *out2 = (argc > 2) ? argv[2] : "tests/fixtures/oracle/k1/i13c-2-vectors.ndjson";

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
  install_fixed_callbacks();

  DWORD oldProt = 0;
  VirtualProtect((LPVOID)(usize)0x6FDD9000u, 0x1000u, PAGE_EXECUTE_READWRITE, &oldProt);
  VirtualProtect((LPVOID)(usize)0x6FDE9000u, 0x9000u, PAGE_EXECUTE_READWRITE, &oldProt);
  *(u32 *)(usize)0x6FDD90A8u = (u32)(usize)&stub_fog_10046;
  *(u32 *)(usize)0x6FDD90ACu = (u32)(usize)&stub_fog_10047;
  *(u32 *)(usize)0x6FDD90CCu = (u32)(usize)&stub_fog_10046;
  *(u32 *)(usize)0x6FDD90D0u = (u32)(usize)&stub_fog_10045;

  FILE *fp1 = fopen(out1, "wb");
  if (!fp1) return 4;
  emit_i13c_1(fp1);
  fclose(fp1);

  FILE *fp2 = fopen(out2, "wb");
  if (!fp2) return 5;
  emit_i13c_2(fp2);
  fclose(fp2);

  return 0;
}
