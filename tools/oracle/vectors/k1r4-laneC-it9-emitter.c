/*
 * k1r4-laneC-it9-emitter.c
 *
 * 32-bit MinGW executable that loads the real D2Common.dll v1.13c at its
 * preferred image base 0x6FD50000 (along with Fog.dll) under Wine and emits
 * differential test vectors (NDJSON) for Lane C Iteration 9:
 *   - B061 (12 PATH functions)      -> b061-vectors.ndjson
 *   - B066 (12 COLLISION functions) -> b066-vectors.ndjson
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
#define ARENA_SIZE    0x00100000u
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
}

/* Standard stdcall function pointer typedefs */
typedef void (__stdcall *fn_std1_void_t)(u32);
typedef void (__stdcall *fn_std2_void_t)(u32, u32);
typedef u32  (__stdcall *fn_std2_u32_t)(u32, u32);
typedef u32  (__stdcall *fn_std3_u32_t)(u32, u32, u32);
typedef void (__stdcall *fn_std4_void_t)(u32, u32, u32, u32);
typedef u32  (__stdcall *fn_std4_u32_t)(u32, u32, u32, u32);
typedef void (__stdcall *fn_std5_void_t)(u32, u32, u32, u32, u32);
typedef void (__stdcall *fn_std6_void_t)(u32, u32, u32, u32, u32, u32);
typedef u32  (__stdcall *fn_std6_u32_t)(u32, u32, u32, u32, u32, u32);

/* Register-only custom ABI wrappers */
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

static __attribute__((noinline)) u32 call_edx_esi_u32(u32 fn, u32 a_edx, u32 a_esi) {
  u32 out;
  __asm__ volatile(
    "call *%%ecx\n\t"
    : "=a"(out), "+d"(a_edx), "+S"(a_esi), "+c"(fn)
    :
    : "ebx", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) void call_esi_stk1_void(u32 fn, u32 a_esi, u32 s1) {
  __asm__ volatile(
    "pushl %%edx\n\t"
    "call *%%ecx\n\t"
    : "+S"(a_esi), "+c"(fn), "+d"(s1)
    :
    : "eax", "ebx", "edi", "memory", "cc"
  );
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

static __attribute__((noinline)) u32 call_ebx_stk4_u32(u32 fn, u32 a_ebx, u32 s1, u32 s2, u32 s3, u32 s4) {
  u32 pack[5] = { fn, s1, s2, s3, s4 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 16(%%edx)\n\t"
    "pushl 12(%%edx)\n\t"
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "=a"(out), "+b"(a_ebx), "+d"(p)
    :
    : "ecx", "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_eax_ecx_edx_stk5_u32(
  u32 fn, u32 a_eax, u32 a_ecx, u32 a_edx, u32 s1, u32 s2, u32 s3, u32 s4, u32 s5
) {
  u32 pack[6] = { fn, s1, s2, s3, s4, s5 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 20(%%esi)\n\t"
    "pushl 16(%%esi)\n\t"
    "pushl 12(%%esi)\n\t"
    "pushl 8(%%esi)\n\t"
    "pushl 4(%%esi)\n\t"
    "call *0(%%esi)\n\t"
    : "=a"(out), "+c"(a_ecx), "+d"(a_edx), "+S"(p)
    : "a"(a_eax)
    : "ebx", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) void call_ecx_eax_stk2_void(u32 fn, u32 a_ecx, u32 a_eax, u32 s1, u32 s2) {
  u32 pack[3] = { fn, s1, s2 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "+c"(a_ecx), "+a"(a_eax), "+d"(p)
    :
    : "ebx", "esi", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_ecx_eax_stk2_u32(u32 fn, u32 a_ecx, u32 a_eax, u32 s1, u32 s2) {
  u32 pack[3] = { fn, s1, s2 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "=a"(out), "+c"(a_ecx), "+d"(p)
    : "a"(a_eax)
    : "ebx", "esi", "edi", "memory", "cc"
  );
  return out;
}

static __attribute__((noinline)) u32 call_eax_esi_stk2_u32(u32 fn, u32 a_eax, u32 a_esi, u32 s1, u32 s2) {
  u32 pack[3] = { fn, s1, s2 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 8(%%edx)\n\t"
    "pushl 4(%%edx)\n\t"
    "call *0(%%edx)\n\t"
    : "=a"(out), "+S"(a_esi), "+d"(p)
    : "a"(a_eax)
    : "ecx", "ebx", "edi", "memory", "cc"
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

static __attribute__((noinline)) void call_ecx_edx_stk3_void(u32 fn, u32 a_ecx, u32 a_edx, u32 s1, u32 s2, u32 s3) {
  u32 pack[4] = { fn, s1, s2, s3 };
  const u32 *p = pack;
  __asm__ volatile(
    "pushl 12(%%esi)\n\t"
    "pushl 8(%%esi)\n\t"
    "pushl 4(%%esi)\n\t"
    "call *0(%%esi)\n\t"
    : "+c"(a_ecx), "+d"(a_edx), "+S"(p)
    :
    : "eax", "ebx", "edi", "memory", "cc"
  );
}

static __attribute__((noinline)) u32 call_eax_edx_ecx_stk1_u32(u32 fn, u32 a_eax, u32 a_edx, u32 a_ecx, u32 s1) {
  u32 pack[2] = { fn, s1 };
  const u32 *p = pack;
  u32 out;
  __asm__ volatile(
    "pushl 4(%%esi)\n\t"
    "call *0(%%esi)\n\t"
    : "=a"(out), "+d"(a_edx), "+c"(a_ecx), "+S"(p)
    : "a"(a_eax)
    : "ebx", "edi", "memory", "cc"
  );
  return out;
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

static void emit_b061(FILE *fp) {
  char args[192];

  /* F1: 0x6FD5D180 PATH_ComputeDirection113c */
  {
    const s32 coords[11][4] = {
      { 100, 100, 110, 100 }, { 100, 100, 110, 110 }, { 100, 100, 100, 110 },
      { 100, 100,  90, 110 }, { 100, 100,  90, 100 }, { 100, 100,  90,  90 },
      { 100, 100, 100,  90 }, { 100, 100, 110,  90 }, { 100, 100, 100, 100 },
      { 65535, 0, 0, 65535 }, { -25, -30, -5, -12 }
    };
    const char *notes[11] = {
      "oct_e", "oct_se", "oct_s", "oct_sw", "oct_w", "oct_nw",
      "oct_n", "oct_ne", "same_pt", "u16_extremes", "neg_coords"
    };
    for (int v = 0; v < 11; v++) {
      reset_heap();
      snapshot_pre();
      u32 a0 = (u32)coords[v][0], a1 = (u32)coords[v][1];
      u32 a2 = (u32)coords[v][2], a3 = (u32)coords[v][3];
      u32 ret = ((fn_std4_u32_t)(usize)0x6FD5D180u)(a0, a1, a2, a3);
      snprintf(args, sizeof(args), "[%u,%u,%u,%u]", a0, a1, a2, a3);
      emit_vector(fp, "0x6FD5D180", "PATH_ComputeDirection113c", v, notes[v], args, ret, 0xFFFFFFFFu);
    }
  }

  /* F2: 0x6FD5D240 PATH_ComputeVelocityToNextPoint113c */
  for (int v = 0; v < 12; v++) {
    reset_heap();
    u32 pPath = heap_alloc(0x200);
    u32 pUnit = (v >= 4 && v <= 9) ? heap_alloc(0x40) : 0u;
    *(u32 *)(usize)(pPath + 0x00) = fx_center(100);
    *(u32 *)(usize)(pPath + 0x04) = fx_center(100);
    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u8 *)(usize)(pPath + 0x64) = 5u;
    *(u8 *)(usize)(pPath + 0x65) = 7u;
    *(u8 *)(usize)(pPath + 0x66) = 0xAAu;
    *(u32 *)(usize)(pPath + 0x6A) = 0x11111111u;
    *(u32 *)(usize)(pPath + 0x6E) = 0x22222222u;
    *(u32 *)(usize)(pPath + 0x72) = 0x33333333u;
    *(u32 *)(usize)(pPath + 0x76) = 0x44444444u;
    *(u32 *)(usize)(pPath + 0x7C) = 0x400u;

    u32 bOnArr = 1u, bAlways = 0u;
    const char *note = "step";
    if (v == 0) {
      *(u32 *)(usize)(pPath + 0x24) = 0u;
      *(u32 *)(usize)(pPath + 0x28) = 1u;
      *(u32 *)(usize)(pPath + 0x9C) = (100u | (100u << 16));
      note = "at_last_pt_end";
    } else if (v == 1) {
      *(u32 *)(usize)(pPath + 0x24) = 0u;
      *(u32 *)(usize)(pPath + 0x28) = 3u;
      *(u32 *)(usize)(pPath + 0x9C) = (100u | (100u << 16));
      *(u32 *)(usize)(pPath + 0xA0) = (105u | (100u << 16));
      note = "advance_one_not_arrived";
    } else if (v == 2) {
      *(u32 *)(usize)(pPath + 0x24) = 0u;
      *(u32 *)(usize)(pPath + 0x28) = 4u;
      *(u32 *)(usize)(pPath + 0x7C) = 0x1000u;
      *(u32 *)(usize)(pPath + 0x9C) = (100u | (100u << 16));
      *(u32 *)(usize)(pPath + 0xA0) = (100u | (100u << 16));
      *(u32 *)(usize)(pPath + 0xA4) = (100u | (101u << 16));
      bOnArr = 1u; bAlways = 0u;
      note = "advance_two_same_x_arrive_dir_update";
    } else if (v == 3) {
      *(u32 *)(usize)(pPath + 0x24) = 0u;
      *(u32 *)(usize)(pPath + 0x28) = 2u;
      *(u32 *)(usize)(pPath + 0x9C) = (100u | (100u << 16));
      *(u32 *)(usize)(pPath + 0xA0) = (100u | (100u << 16));
      note = "advance_then_end";
    } else if (v == 4) {
      *(u32 *)(usize)pUnit = 0u;
      *(u32 *)(usize)(pPath + 0x24) = 0u;
      *(u32 *)(usize)(pPath + 0x28) = 2u;
      *(u32 *)(usize)(pPath + 0x34) = 0x200u;
      *(u32 *)(usize)(pPath + 0x9C) = (100u | (104u << 16));
      bOnArr = 0u; bAlways = 1u;
      note = "flag_0x200_player_always_dir";
    } else if (v == 5) {
      *(u32 *)(usize)pUnit = 1u;
      *(u32 *)(usize)(pPath + 0x24) = 0u;
      *(u32 *)(usize)(pPath + 0x28) = 2u;
      *(u32 *)(usize)(pPath + 0x9C) = (105u | (100u << 16));
      *(u8 *)(usize)(pPath + 0x65) = 16u;
      bOnArr = 0u; bAlways = 1u;
      note = "monster_same_newdir_noop";
    } else if (v == 6) {
      *(u32 *)(usize)pUnit = 2u;
      *(u32 *)(usize)(pPath + 0x28) = 2u;
      *(u32 *)(usize)(pPath + 0x9C) = (104u | (104u << 16));
      bAlways = 1u;
      note = "object_sets_ndir";
    } else if (v == 7) {
      *(u32 *)(usize)pUnit = 4u;
      *(u32 *)(usize)(pPath + 0x28) = 2u;
      *(u32 *)(usize)(pPath + 0x9C) = (96u | (104u << 16));
      bAlways = 1u;
      note = "item_sets_ndir";
    } else if (v == 8) {
      *(u32 *)(usize)pUnit = 3u;
      *(u32 *)(usize)(pPath + 0x34) = 0u;
      *(u32 *)(usize)(pPath + 0x28) = 2u;
      *(u32 *)(usize)(pPath + 0x9C) = (96u | (96u << 16));
      bAlways = 1u;
      note = "missile_no_flag40_sets_ndir";
    } else if (v == 9) {
      *(u32 *)(usize)pUnit = 3u;
      *(u32 *)(usize)(pPath + 0x34) = 0x40u;
      *(u32 *)(usize)(pPath + 0x28) = 2u;
      *(u32 *)(usize)(pPath + 0x9C) = (96u | (96u << 16));
      bAlways = 1u;
      note = "missile_flag40_preserves_ndir";
    } else if (v == 10) {
      *(u32 *)(usize)(pPath + 0x7C) = 0x1000u;
      *(u32 *)(usize)(pPath + 0x28) = 2u;
      *(u32 *)(usize)(pPath + 0x9C) = (101u | (100u << 16));
      bOnArr = 0u; bAlways = 0u;
      note = "arrived_but_both_dir_flags_off";
    } else {
      *(u32 *)(usize)(pPath + 0x7C) = (u32)(-0x800);
      *(u32 *)(usize)(pPath + 0x28) = 2u;
      *(u32 *)(usize)(pPath + 0x9C) = (103u | (104u << 16));
      bOnArr = 1u; bAlways = 0u;
      note = "neg_velocity_no_arrive";
    }
    track_region(pPath, 0xC0);
    if (pUnit) track_region(pUnit, 0x40);
    snapshot_pre();
    u32 ret = call_esi_stk2_u32(0x6FD5D240u, pPath, bOnArr, bAlways);
    snprintf(args, sizeof(args), "[%u,%u,%u]", pPath, bOnArr, bAlways);
    emit_vector(fp, "0x6FD5D240", "PATH_ComputeVelocityToNextPoint113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F3: 0x6FD5D760 PATH_RecacheRoom113c */
  for (int v = 0; v < 9; v++) {
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
    init_room_sub(rHint, 100, (v == 8) ? 140 : 60, 40, 40, pActFlag);
    *(u32 *)(usize)nearA = rA;
    *(u32 *)(usize)(nearA + 4) = rB;
    *(u32 *)(usize)(rA + 0x00) = nearA;
    *(u32 *)(usize)(rA + 0x24) = 2u;
    *(u32 *)(usize)nearHint = rHint;
    *(u32 *)(usize)(rHint + 0x00) = nearHint;
    *(u32 *)(usize)(rHint + 0x24) = 1u;

    *(u32 *)(usize)(pUnit + 0x00) = 1u; /* monster */
    *(u32 *)(usize)(pUnit + 0x2C) = pPath;
    *(u32 *)(usize)(pPath + 0x30) = pUnit;
    *(u32 *)(usize)(pPath + 0x28) = 7u;

    u32 hintArg = 0u;
    const char *note = "recache";
    if (v == 0) {
      *(u16 *)(usize)(pPath + 0x02) = 115u;
      *(u16 *)(usize)(pPath + 0x06) = 120u;
      *(u32 *)(usize)(pPath + 0x1C) = rA;
      *(u32 *)(usize)(rA + 0x74) = pUnit;
      note = "inside_current_room_early_return";
    } else if (v == 1) {
      *(u16 *)(usize)(pPath + 0x02) = 140u;
      *(u16 *)(usize)(pPath + 0x06) = 120u;
      *(u32 *)(usize)(pPath + 0x1C) = rA;
      *(u32 *)(usize)(rA + 0x74) = pUnit;
      note = "right_edge_moves_to_neighbor_rB";
    } else if (v == 2) {
      *(u16 *)(usize)(pPath + 0x02) = 115u;
      *(u16 *)(usize)(pPath + 0x06) = 99u;
      *(u32 *)(usize)(pPath + 0x1C) = rA;
      *(u32 *)(usize)(rA + 0x74) = pUnit;
      hintArg = rHint;
      note = "miss_rA_hits_hint_room";
    } else if (v == 3) {
      *(u16 *)(usize)(pPath + 0x02) = 500u;
      *(u16 *)(usize)(pPath + 0x06) = 500u;
      *(u32 *)(usize)(pPath + 0x1C) = rA;
      *(u32 *)(usize)(pPath + 0x34) = 0x40000u;
      *(u32 *)(usize)(rA + 0x74) = pUnit;
      note = "full_miss_flag_0x40000_clears_points";
    } else if (v == 4) {
      *(u16 *)(usize)(pPath + 0x02) = 500u;
      *(u16 *)(usize)(pPath + 0x06) = 500u;
      *(u32 *)(usize)(pPath + 0x1C) = rA;
      *(u32 *)(usize)(rA + 0x74) = pUnit;
      hintArg = rHint;
      note = "full_miss_no_flag_detaches_room";
    } else if (v == 5) {
      *(u32 *)(usize)(pUnit + 0x00) = 0u; /* player */
      *(u16 *)(usize)(pPath + 0x02) = 150u;
      *(u16 *)(usize)(pPath + 0x06) = 110u;
      *(u32 *)(usize)(pPath + 0x1C) = 0u;
      hintArg = rB;
      note = "initial_null_room_player_adds_to_rB";
    } else if (v == 6) {
      *(u32 *)(usize)(pUnit + 0x00) = 0u; /* player */
      *(u16 *)(usize)(pPath + 0x02) = 145u;
      *(u16 *)(usize)(pPath + 0x06) = 139u;
      *(u32 *)(usize)(pPath + 0x1C) = rA;
      *(u32 *)(usize)(rA + 0x74) = pUnit;
      *(u32 *)(usize)(rA + 0x28) = 2u;
      *(u32 *)(usize)(rB + 0x28) = 5u;
      note = "player_transfers_allied_count_rA_to_rB";
    } else if (v == 7) {
      *(u16 *)(usize)(pPath + 0x02) = 99u;
      *(u16 *)(usize)(pPath + 0x06) = 115u;
      *(u32 *)(usize)(pPath + 0x1C) = 0u;
      note = "initial_null_room_miss_sets_flag2";
    } else {
      *(u16 *)(usize)(pPath + 0x02) = 115u;
      *(u16 *)(usize)(pPath + 0x06) = 140u;
      *(u32 *)(usize)(pPath + 0x1C) = rA;
      *(u32 *)(usize)(rA + 0x74) = pUnit;
      hintArg = rHint;
      note = "bottom_edge_y_eq_ry_plus_rh_moves_to_hint";
    }
    track_region(pActFlag, 0x10);
    track_region(rA, 0x80); track_region(rB, 0x80); track_region(rHint, 0x80);
    track_region(nearA, 0x10); track_region(nearHint, 0x10);
    track_region(pPath, 0x80); track_region(pUnit, 0x100);
    snapshot_pre();
    ((fn_std2_void_t)(usize)0x6FD5D760u)(pPath, hintArg);
    snprintf(args, sizeof(args), "[%u,%u]", pPath, hintArg);
    emit_vector(fp, "0x6FD5D760", "PATH_RecacheRoom113c", v, note, args, 0u, 0u);
  }

  /* F4: 0x6FD7F910 UNITS_GetDirectionToCoords113c (retMask 0xFF) */
  for (int v = 0; v < 10; v++) {
    reset_heap();
    u32 pUnit = heap_alloc(0x40);
    u32 pPath = (v == 7) ? 0u : heap_alloc(0x40);
    u32 uType = (v <= 6) ? (u32)v : (v == 7) ? 0u : (v == 8) ? 1u : 2u;
    *(u32 *)(usize)(pUnit + 0x00) = uType;
    *(u32 *)(usize)(pUnit + 0x2C) = pPath;
    if (pPath) {
      if (uType == 2u || uType == 4u || uType == 5u) {
        *(u32 *)(usize)(pPath + 0x0C) = (v == 9) ? (u32)(-25) : 100u;
        *(u32 *)(usize)(pPath + 0x10) = (v == 9) ? (u32)(-30) : 100u;
      } else {
        *(u16 *)(usize)(pPath + 0x02) = 100u;
        *(u16 *)(usize)(pPath + 0x06) = 100u;
      }
      track_region(pPath, 0x40);
    }
    const s32 tx[10] = { 120, 120, 100,  80,  80,  80, 115, 25, 100,  -5 };
    const s32 ty[10] = { 100, 120, 120, 120, 100,  80,  85, 40, 100, -12 };
    track_region(pUnit, 0x40);
    snapshot_pre();
    u32 ret = ((fn_std3_u32_t)(usize)0x6FD7F910u)(pUnit, (u32)tx[v], (u32)ty[v]);
    char note[48];
    snprintf(note, sizeof(note), "utype_%u_case_%d", uType, v);
    snprintf(args, sizeof(args), "[%u,%u,%u]", pUnit, (u32)tx[v], (u32)ty[v]);
    emit_vector(fp, "0x6FD7F910", "UNITS_GetDirectionToCoords113c", v, note, args, ret, 0xFFu);
  }

  /* F5: 0x6FD844F0 UNITS_TransferStateMaskDCToRemoved113c */
  for (int v = 0; v < 6; v++) {
    reset_heap();
    u32 pSgpt = heap_alloc(0x100);
    u32 pMasks = heap_alloc(0x20);
    *(u32 *)(usize)0x6FDE9E1Cu = pSgpt;
    u32 nStates = (v == 4) ? 185u : 64u;
    *(u32 *)(usize)(pSgpt + 0xC4) = nStates;
    *(u32 *)(usize)(pSgpt + 0xDC) = pMasks;
    for (int i = 0; i < 6; i++) {
      *(u32 *)(usize)(pMasks + i * 4) = 0x0F0F0F0Fu ^ ((u32)i * 0x11111111u);
    }
    u32 pUnit = (v == 0) ? 0u : heap_alloc(0x100);
    u32 pStat = 0u, pStateBuf = 0u, pPath = 0u, pRoom = 0u, pActFlag = 0u;
    if (pUnit) {
      *(u32 *)(usize)pUnit = 1u;
      if (v >= 2) {
        pStat = heap_alloc(0x70);
        *(u32 *)(usize)(pUnit + 0x5C) = pStat;
        *(u32 *)(usize)(pStat + 0x10) = (v == 2) ? 0x40u : 0x80000040u;
        if (v == 3 || v == 4) {
          pStateBuf = heap_alloc(0x40);
          *(u32 *)(usize)(pStat + 0x58) = pStateBuf;
          u32 nDw = (nStates + 31u) >> 5;
          for (u32 i = 0; i < nDw; i++) {
            *(u32 *)(usize)(pStateBuf + i * 4u) = 0xFFFF00FFu - i;
            *(u32 *)(usize)(pStateBuf + (nDw + i) * 4u) = (0x1000u << i);
          }
          if (v == 3) {
            pActFlag = heap_alloc(0x10);
            pRoom = heap_alloc(0x80);
            pPath = heap_alloc(0x40);
            init_room_sub(pRoom, 10, 10, 20, 20, pActFlag);
            *(u32 *)(usize)(pPath + 0x1C) = pRoom;
            *(u32 *)(usize)(pUnit + 0x2C) = pPath;
          }
        }
      }
    }
    track_region(0x6FDE9E1Cu, 4);
    track_region(pSgpt + 0xC0u, 0x30);
    track_region(pMasks, 0x20);
    if (pUnit) track_region(pUnit, 0x100);
    if (pStat) track_region(pStat, 0x70);
    if (pStateBuf) track_region(pStateBuf, 0x40);
    if (pPath) track_region(pPath, 0x40);
    if (pRoom) track_region(pRoom, 0x80);
    if (pActFlag) track_region(pActFlag, 0x10);
    snapshot_pre();
    ((fn_std1_void_t)(usize)0x6FD844F0u)(pUnit);
    char note[48];
    snprintf(note, sizeof(note), "state_dc_case_%d", v);
    snprintf(args, sizeof(args), "[%u]", pUnit);
    emit_vector(fp, "0x6FD844F0", "UNITS_TransferStateMaskDCToRemoved113c", v, note, args, 0u, 0u);
  }

  /* F6: 0x6FD852F0 PATH_FaceTowardsCoords113c */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    u32 pPath = (v == 0) ? 0u : heap_alloc(0x80);
    u32 pUnit = (v >= 4) ? heap_alloc(0x40) : 0u;
    u32 bSetBoth = (v == 1) ? 1u : (v == 2) ? 0xFFFFFFFFu : 0u;
    s32 tx = 115, ty = 100;
    if (pPath) {
      *(u32 *)(usize)(pPath + 0x00) = fx_center(100);
      *(u32 *)(usize)(pPath + 0x04) = fx_center(100);
      *(u32 *)(usize)(pPath + 0x30) = pUnit;
      *(u8 *)(usize)(pPath + 0x64) = 3u;
      *(u8 *)(usize)(pPath + 0x65) = (v == 4) ? 16u : 9u;
      *(u8 *)(usize)(pPath + 0x66) = 0x77u;
      if (v == 2) { tx = 85; ty = 115; }
      if (v == 5) { *(u32 *)(usize)pUnit = 2u; tx = 100; ty = 120; }
      if (v == 6) { *(u32 *)(usize)pUnit = 3u; tx = 85; ty = 85; }
      if (v == 7) { *(u32 *)(usize)pUnit = 3u; *(u32 *)(usize)(pPath + 0x34) = 0x40u; tx = 85; ty = 85; }
      track_region(pPath, 0x80);
    }
    if (pUnit) track_region(pUnit, 0x40);
    snapshot_pre();
    ((fn_std4_void_t)(usize)0x6FD852F0u)(pPath, (u32)tx, (u32)ty, bSetBoth);
    char note[48];
    snprintf(note, sizeof(note), "face_case_%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pPath, (u32)tx, (u32)ty, bSetBoth);
    emit_vector(fp, "0x6FD852F0", "PATH_FaceTowardsCoords113c", v, note, args, 0u, 0u);
  }

  /* F7: 0x6FD85360 PATH_GetCollisionPatternForSize113c */
  {
    const s32 sizes[13] = { -1, 4, 0, 1, 2, 3, 2, 1, 3, 0, 1, 2, 3 };
    for (int v = 0; v < 15; v++) {
      reset_heap();
      u32 pSgpt = heap_alloc(0xB00);
      u32 pMonStats = heap_alloc(0x400);
      *(u32 *)(usize)0x6FDE9E1Cu = pSgpt;
      *(u32 *)(usize)(pSgpt + 0xA78) = pMonStats;
      *(u32 *)(usize)(pSgpt + 0xA80) = 2u;
      u32 pBitMasks = *(u32 *)(usize)0x6FDD90B0u;

      u32 pUnit = (v >= 6) ? heap_alloc(0x100) : 0u;
      s32 sz = (v < 13) ? sizes[v] : (v == 13 ? 1 : 3);
      if (pUnit) {
        *(u32 *)(usize)(pUnit + 0x00) = (v == 6) ? 0u : 1u;
        *(u32 *)(usize)(pUnit + 0x04) = 0u;
        if (v >= 9 && v <= 12) {
          *(u8 *)(usize)(pMonStats + 0x0D) = 0x04u; /* friendly/inTown (+0x0D bit 2), flag 9 (+0x0D bit 1) clear */
        } else if (v >= 13) {
          *(u8 *)(usize)(pMonStats + 0x0D) = 0x06u; /* friendly/inTown (+0x0D bit 2) + flag 9 (+0x0D bit 1) set */
        }
        track_region(pUnit, 0x100);
      }
      track_region(0x6FDE9E1Cu, 4);
      track_region(pSgpt + 0xA70u, 0x20);
      track_region(pMonStats, 0x20);
      track_region(0x6FDD90B0u, 4);
      track_region(pBitMasks, 0x20);
      snapshot_pre();
      u32 ret = ((fn_std2_u32_t)(usize)0x6FD85360u)(pUnit, (u32)sz);
      char note[48];
      snprintf(note, sizeof(note), "coll_pat_v%d_sz%d", v, (int)sz);
      snprintf(args, sizeof(args), "[%u,%u]", pUnit, (u32)sz);
      emit_vector(fp, "0x6FD85360", "PATH_GetCollisionPatternForSize113c", v, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F8: 0x6FD85470 PATH_ResolveTargetUnitPosition113c (retMask 0xFF) */
  for (int v = 0; v < 12; v++) {
    reset_heap();
    u32 pInfo = heap_alloc(0x40);
    u32 pPath = heap_alloc(0x80);
    *(u32 *)(usize)(pInfo + 0x30) = pPath;
    *(u16 *)(usize)(pPath + 0x02) = 100u;
    *(u16 *)(usize)(pPath + 0x06) = 100u;
    *(u16 *)(usize)(pPath + 0x10) = 0x7777u;
    *(u16 *)(usize)(pPath + 0x12) = 0x8888u;

    u32 pTarget = (v == 0) ? 0u : heap_alloc(0x40);
    *(u32 *)(usize)(pPath + 0x58) = pTarget;
    u32 pTPath = 0u, pObjData = 0u, pObjTxt = 0u;
    if (pTarget) {
      if (v == 1) {
        *(u32 *)(usize)pTarget = 0u; /* NULL pTPath -> (0,0) */
      } else if (v == 2) {
        *(u32 *)(usize)pTarget = 2u;
        pTPath = heap_alloc(0x20);
        pObjData = heap_alloc(0x10); pObjTxt = heap_alloc(0x150);
        *(u32 *)(usize)(pObjData) = pObjTxt;
        *(u32 *)(usize)(pTarget + 0x14) = pObjData;
        *(u32 *)(usize)(pTarget + 0x2C) = pTPath;
        *(u32 *)(usize)(pTPath + 0x0C) = 0u;
        *(u32 *)(usize)(pTPath + 0x10) = 50u;
      } else if (v == 3) {
        *(u32 *)(usize)pTarget = 4u;
        pTPath = heap_alloc(0x20);
        *(u32 *)(usize)(pTarget + 0x2C) = pTPath;
        *(u32 *)(usize)(pTPath + 0x0C) = 50u;
        *(u32 *)(usize)(pTPath + 0x10) = 0u;
      } else if (v == 4 || v == 5 || v == 6) {
        *(u32 *)(usize)pTarget = (v == 6) ? 1u : 0u;
        pTPath = heap_alloc(0x80);
        *(u32 *)(usize)(pTarget + 0x2C) = pTPath;
        *(u16 *)(usize)(pTPath + 0x02) = 120u;
        *(u16 *)(usize)(pTPath + 0x06) = 140u;
        *(u8 *)(usize)(pTPath + 0x64) = (v == 5) ? 16u : 40u;
        *(u8 *)(usize)(pPath + 0x68) = (v == 4) ? 0u : (v == 5) ? 5u : 9u;
        if (v >= 5) {
          u32 dir = *(u8 *)(usize)(pTPath + 0x64);
          u32 step = *(u8 *)(usize)(pPath + 0x68);
          u32 lutIdx = ((dir - (step << 5)) << 3) & 0x1FFu;
          track_region(0x6FF7F470u + ((lutIdx + 0x80u) & 0x1FFu) * 4u, 4);
          track_region(0x6FF7F470u + (lutIdx & 0x1FFu) * 4u, 4);
        }
      } else if (v == 7 || v == 8 || v == 9) {
        *(u32 *)(usize)pTarget = 2u;
        pTPath = heap_alloc(0x20);
        pObjData = heap_alloc(0x10); pObjTxt = heap_alloc(0x150);
        *(u32 *)(usize)(pObjData) = pObjTxt;
        *(u32 *)(usize)(pTarget + 0x14) = pObjData;
        *(u32 *)(usize)(pTarget + 0x2C) = pTPath;
        *(u32 *)(usize)(pTPath + 0x0C) = (v == 8) ? 90u : 110u;
        *(u32 *)(usize)(pTPath + 0x10) = 110u;
        *(u8 *)(usize)(pObjTxt + 0x13A) = (v == 9) ? 0u : 1u;
        *(u8 *)(usize)(pObjTxt + 0x13C) = (v == 7) ? 1u : 0u;
      } else if (v == 10) {
        *(u32 *)(usize)pTarget = 3u;
        pTPath = heap_alloc(0x20);
        *(u32 *)(usize)(pTarget + 0x2C) = pTPath;
        *(u16 *)(usize)(pTPath + 0x02) = 80u;
        *(u16 *)(usize)(pTPath + 0x06) = 90u;
      } else {
        *(u32 *)(usize)pTarget = 5u;
        pTPath = heap_alloc(0x20);
        *(u32 *)(usize)(pTarget + 0x2C) = pTPath;
        *(u32 *)(usize)(pTPath + 0x0C) = 70u;
        *(u32 *)(usize)(pTPath + 0x10) = 85u;
      }
    }
    track_region(pInfo, 0x40);
    track_region(pPath, 0x80);
    if (pTarget) track_region(pTarget, 0x40);
    if (pTPath) track_region(pTPath, (v == 4 || v == 5 || v == 6) ? 0x80 : 0x20);
    if (pObjData) track_region(pObjData, 0x10);
    if (pObjTxt) track_region(pObjTxt + 0x130u, 0x20);
    snapshot_pre();
    u32 ret = call_edi_u32(0x6FD85470u, pInfo);
    char note[48];
    snprintf(note, sizeof(note), "resolve_target_v%d", v);
    snprintf(args, sizeof(args), "[%u]", pInfo);
    emit_vector(fp, "0x6FD85470", "PATH_ResolveTargetUnitPosition113c", v, note, args, ret, 0xFFu);
  }

  /* F9: 0x6FD856E0 PATH_IsMonsterDestinationAllowed113c */
  for (int v = 0; v < 10; v++) {
    reset_heap();
    u32 pSgpt = heap_alloc(0xB00);
    u32 pMonStats = heap_alloc(0x200);
    *(u32 *)(usize)0x6FDE9E1Cu = pSgpt;
    *(u32 *)(usize)(pSgpt + 0xA78) = pMonStats;
    *(u32 *)(usize)(pSgpt + 0xA80) = 2u;
    u32 pBitMasks = *(u32 *)(usize)0x6FDD90B0u;

    u32 pInfo = heap_alloc(0x40);
    u32 pUnit = (v == 0) ? 0u : heap_alloc(0x100);
    u32 rStart = heap_alloc(0x80), rMid = heap_alloc(0x80), rTarget = heap_alloc(0x80);
    u32 nearS = heap_alloc(0x10), nearM = heap_alloc(0x10);
    u32 pRoomEx = heap_alloc(0x80), pLevel = heap_alloc(0x200);

    init_room_sub(rStart, 140, 140, 30, 30, 0);
    init_room_sub(rMid, (v == 9) ? 126 : 128, (v == 9) ? 126 : 128, (v == 9) ? 5 : 12, (v == 9) ? 5 : 12, 0);
    init_room_sub(rTarget, 90,  90, 20, 20, 0);
    *(u32 *)(usize)nearS = rStart; *(u32 *)(usize)(nearS + 4) = rMid;
    *(u32 *)(usize)(rStart + 0x00) = nearS; *(u32 *)(usize)(rStart + 0x24) = 2u;
    *(u32 *)(usize)nearM = rMid; *(u32 *)(usize)(nearM + 4) = rTarget;
    *(u32 *)(usize)(rMid + 0x00) = nearM; *(u32 *)(usize)(rMid + 0x24) = 2u;

    *(u32 *)(usize)(rTarget + 0x10) = pRoomEx;
    *(u32 *)(usize)(pRoomEx + 0x58) = pLevel;
    *(u32 *)(usize)(pLevel + 0x1D0) = (v == 3 || v == 5 || v == 6 || v == 9) ? 1u : 2u;

    if (pUnit) {
      *(u32 *)(usize)pUnit = (v == 1) ? 0u : 1u;
      if (v == 2) *(u32 *)(usize)(pUnit + 0xC4) = 0x80000000u; /* friendly */
      track_region(pUnit, 0x100);
    }
    if (v == 3 || v == 4) {
      *(u32 *)(usize)(pInfo + 0x0C) = rTarget;
    } else if (v == 5) {
      *(u16 *)(usize)(pInfo + 0x00) = 150u; *(u16 *)(usize)(pInfo + 0x02) = 150u;
      *(u16 *)(usize)(pInfo + 0x04) = 108u; *(u16 *)(usize)(pInfo + 0x06) = 108u;
      *(u32 *)(usize)(pInfo + 0x08) = rStart;
    } else if (v == 6 || v == 7 || v == 9) {
      /* tX - sX = 100 - 155 = -55 -> sdiv2(-55) = -27 -> mx = 128 (hits narrow [126..131) in v=9; /3 -> 137 misses!) */
      *(u16 *)(usize)(pInfo + 0x00) = 155u; *(u16 *)(usize)(pInfo + 0x02) = 155u;
      *(u16 *)(usize)(pInfo + 0x04) = 100u; *(u16 *)(usize)(pInfo + 0x06) = 100u;
      *(u32 *)(usize)(pInfo + 0x08) = rStart;
    } else if (v == 8) {
      *(u16 *)(usize)(pInfo + 0x00) = 155u; *(u16 *)(usize)(pInfo + 0x02) = 155u;
      *(u16 *)(usize)(pInfo + 0x04) = 300u; *(u16 *)(usize)(pInfo + 0x06) = 300u;
      *(u32 *)(usize)(pInfo + 0x08) = rStart;
    }
    track_region(0x6FDE9E1Cu, 4);
    track_region(pSgpt + 0xA70u, 0x20);
    track_region(pMonStats, 0x20);
    track_region(0x6FDD90B0u, 4);
    track_region(pBitMasks, 0x20);
    track_region(pInfo, 0x40);
    track_region(rStart, 0x80); track_region(rMid, 0x80); track_region(rTarget, 0x80);
    track_region(nearS, 0x10); track_region(nearM, 0x10);
    track_region(pRoomEx, 0x80); track_region(pLevel + 0x1C0u, 0x20);
    snapshot_pre();
    u32 ret = call_edx_esi_u32(0x6FD856E0u, pUnit, pInfo);
    char note[48];
    snprintf(note, sizeof(note), "mon_dest_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u]", pUnit, pInfo);
    emit_vector(fp, "0x6FD856E0", "PATH_IsMonsterDestinationAllowed113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F10: 0x6FDB6AA0 PATH_ComputePathChargedBolt113c */
  {
    const u8 distMax[7] = { 0u, 1u, 2u, 9u, 0x40u, 0xFFu, 20u };
    const u32 seedLo[7] = { 0x11112222u, 0x55556666u, 0u, 0x12345678u, 0xFFFFFFFFu, 0xCAFEBABEu, 0x7F7F7F7Fu };
    const u32 seedHi[7] = { 0x33334444u, 0x77778888u, 0u, 0x9ABCDEF0u, 0xFFFFFFFFu, 0x0000001Fu, 0x01020304u };
    const u16 sx[7]     = { 100u, 100u, 100u, 200u,    1u, 300u, 250u };
    const u16 sy[7]     = { 100u, 100u, 100u, 200u, 0xFFFFu, 400u, 250u };
    const u16 tx[7]     = { 120u,  80u, 110u, 230u,   20u, 280u, 220u };
    const u16 ty[7]     = { 100u, 120u, 115u, 180u,    5u, 420u, 250u };
    for (int v = 0; v < 7; v++) {
      reset_heap();
      u32 pSeed = heap_alloc(0x10);
      u32 pPath = heap_alloc(0x320); /* >= 0x2A0 for nDistMax=0xFF (128 points) */
      *(u32 *)(usize)(pSeed + 0x00) = seedLo[v];
      *(u32 *)(usize)(pSeed + 0x04) = seedHi[v];
      *(u16 *)(usize)(pPath + 0x02) = sx[v];
      *(u16 *)(usize)(pPath + 0x06) = sy[v];
      *(u16 *)(usize)(pPath + 0x10) = tx[v];
      *(u16 *)(usize)(pPath + 0x12) = ty[v];
      *(u8  *)(usize)(pPath + 0x91) = distMax[v];
      track_region(pSeed, 0x10);
      track_region(pPath, 0x320);
      snapshot_pre();
      call_esi_stk1_void(0x6FDB6AA0u, pSeed, pPath);
      char note[48];
      snprintf(note, sizeof(note), "cbolt_dist_%u", (unsigned)distMax[v]);
      snprintf(args, sizeof(args), "[%u,%u]", pSeed, pPath);
      emit_vector(fp, "0x6FDB6AA0", "PATH_ComputePathChargedBolt113c", v, note, args, 0u, 0u);
    }
  }

  /* F11: 0x6FDC0840 PATH_IdaStar_AdvanceToNextCandidate113c */
  for (int v = 0; v < 7; v++) {
    reset_heap();
    u32 pCtx = heap_alloc(0x36FE0);
    u32 pSeed = heap_alloc(0x10);
    u32 n0 = heap_alloc(0x20), n1 = heap_alloc(0x20), n2 = heap_alloc(0x20);
    u32 dirBuf0 = heap_alloc(0x30), dirBuf1 = heap_alloc(0x30), dirBuf2 = heap_alloc(0x30);
    for (int k = 0; k < 8; k++) {
      *(s32 *)(usize)(dirBuf0 + k * 4) = k - 2;
      *(s32 *)(usize)(dirBuf1 + k * 4) = k + 1;
      *(s32 *)(usize)(dirBuf2 + k * 4) = 3 - k;
    }
    *(u32 *)(usize)pSeed = 0x13579BDFu + (u32)v;
    *(u32 *)(usize)(pSeed + 4) = 0x2468ACE0u;
    *(u32 *)(usize)(pCtx + 0x00) = n0;
    *(u32 *)(usize)(pCtx + 0x36FD0u) = (v == 1 || v == 4) ? 1u : 0u;
    *(u32 *)(usize)(pCtx + 0x36FD4u) = pSeed;

    *(u32 *)(usize)(n0 + 0x0C) = dirBuf0; *(u32 *)(usize)(n0 + 0x10) = 2u; *(u32 *)(usize)(n0 + 0x14) = 0u;
    *(u32 *)(usize)(n1 + 0x0C) = dirBuf1; *(u32 *)(usize)(n1 + 0x10) = 5u; *(u32 *)(usize)(n1 + 0x14) = n0;
    *(u32 *)(usize)(n2 + 0x0C) = dirBuf2; *(u32 *)(usize)(n2 + 0x10) = 1u; *(u32 *)(usize)(n2 + 0x14) = n1;

    u32 startNode = n0;
    if (v == 0) { *(u16 *)(usize)(n0 + 0x06) = 0u; startNode = n0; }
    else if (v == 1) { *(u16 *)(usize)(n0 + 0x06) = 3u; startNode = n0; }
    else if (v == 2) { *(u16 *)(usize)(n0 + 0x06) = 4u; startNode = n0; }
    else if (v == 3) { *(u16 *)(usize)(n0 + 0x06) = 2u; *(u16 *)(usize)(n1 + 0x06) = 4u; startNode = n1; }
    else if (v == 4) { *(u16 *)(usize)(n0 + 0x06) = 1u; *(u16 *)(usize)(n1 + 0x06) = 4u; *(u16 *)(usize)(n2 + 0x06) = 4u; startNode = n2; }
    else if (v == 5) { *(u16 *)(usize)(n0 + 0x06) = 4u; *(u16 *)(usize)(n1 + 0x06) = 4u; startNode = n1; }
    else { *(u16 *)(usize)(n0 + 0x06) = 0xFFFFu; startNode = n0; }

    track_region(pCtx, 0x10);
    track_region(pCtx + 0x36FD0u, 0x10);
    track_region(pSeed, 0x10);
    track_region(n0, 0x20); track_region(n1, 0x20); track_region(n2, 0x20);
    track_region(dirBuf0, 0x30); track_region(dirBuf1, 0x30); track_region(dirBuf2, 0x30);
    snapshot_pre();
    u32 ret = call_eax_edi_u32(0x6FDC0840u, startNode, pCtx);
    char note[48];
    snprintf(note, sizeof(note), "idastar_adv_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u]", startNode, pCtx);
    emit_vector(fp, "0x6FDC0840", "PATH_IdaStar_AdvanceToNextCandidate113c", v, note, args, ret, 0xFFFFFFFFu);
  }

  /* F12: 0x6FDCAFB0 PATH_AStar_ProcessNeighbor113c */
  for (int v = 0; v < 11; v++) {
    reset_heap();
    u32 pCtx = heap_alloc(0x3300);
    u32 pParent = heap_alloc(0x38);
    u32 pExisting = heap_alloc(0x38);
    u32 pChild = heap_alloc(0x38);
    u32 pOpenOther = heap_alloc(0x38);

    u16 px = 50u, py = 60u;
    u16 nx = (v % 2 == 0) ? 51u : 51u;
    u16 ny = (v % 2 == 0) ? 60u : 61u; /* even=orth(cost 2), odd=diag(cost 3) */
    u32 xy = (u32)nx | ((u32)ny << 16);
    u32 targetXY = 70u | (75u << 16);
    *(u16 *)(usize)(pParent + 0x00) = px;
    *(u16 *)(usize)(pParent + 0x02) = py;
    *(u16 *)(usize)(pParent + 0x08) = 10u; /* parent.wG = 10 -> g = 12 or 13 */

    u32 hy = *(const u32 *)(usize)(0x6FDDB658u + ((ny & 0x7Fu) << 2));
    u32 hx = *(const u32 *)(usize)(0x6FDDB458u + ((nx & 0x7Fu) << 2));
    u32 bucket = (hy + hx) & 0x7Fu;

    u32 usedInit = 0u;
    if (v == 0 || v == 1 || v == 2) {
      /* Pending cache hit: v0=improve (0 children), v1=no-improve (3 children), v2=improve (8 children full) */
      *(u32 *)(usize)(pCtx + bucket * 4u) = pExisting;
      *(u32 *)(usize)(pExisting + 0x00) = xy;
      *(u16 *)(usize)(pExisting + 0x06) = 25u;
      *(u16 *)(usize)(pExisting + 0x08) = (v == 1) ? 8u : 20u;
      *(u16 *)(usize)(pExisting + 0x04) = (u16)(25u + *(u16 *)(usize)(pExisting + 0x08));
      int nKids = (v == 1) ? 3 : (v == 2) ? 8 : 0;
      for (int k = 0; k < nKids; k++) *(u32 *)(usize)(pParent + 0x10 + k * 4) = 0xDEAD0001u + (u32)k;
    } else if (v == 3 || v == 4 || v == 10) {
      /* Visited cache hit: v3=improve + propagate to child, v4=no-improve, v10=exact tie g==oldG preserves pParent */
      *(u32 *)(usize)(pCtx + 0x200u + bucket * 4u) = pExisting;
      *(u32 *)(usize)(pExisting + 0x00) = xy;
      *(u16 *)(usize)(pExisting + 0x06) = 20u;
      *(u16 *)(usize)(pExisting + 0x08) = (v == 3) ? 30u : (v == 10) ? 12u : 10u;
      *(u16 *)(usize)(pExisting + 0x04) = (u16)(20u + *(u16 *)(usize)(pExisting + 0x08));
      *(u32 *)(usize)(pExisting + 0x0C) = 0xCAFEBABEu;
      *(u32 *)(usize)(pExisting + 0x10) = pChild;
      *(u16 *)(usize)(pChild + 0x00) = nx;
      *(u16 *)(usize)(pChild + 0x02) = (u16)(ny + 1u);
      *(u16 *)(usize)(pChild + 0x06) = 18u;
      *(u16 *)(usize)(pChild + 0x08) = 40u;
      *(u16 *)(usize)(pChild + 0x04) = 58u;
    } else if (v == 5) {
      /* Pool exhausted: used == 200 -> returns 0 */
      usedInit = 200u;
      *(u32 *)(usize)(pCtx + 0x2FC4u) = usedInit;
    } else {
      /* New node allocation: v6=empty open list (used=0), v7=insert after open head, v8=insert before open head, v9=used=199 */
      usedInit = (v == 9) ? 199u : (u32)(v - 6);
      *(u32 *)(usize)(pCtx + 0x2FC4u) = usedInit;
      if (v == 7 || v == 8) {
        *(u32 *)(usize)(pCtx + 0x400u) = pOpenOther;
        *(u16 *)(usize)(pOpenOther + 0x04) = (v == 7) ? 5u : 500u;
      }
      u32 preSlot = pCtx + 0x404u + usedInit * 0x38u;
      memset((void *)(usize)preSlot, 0xCC, 0x38); /* verify 56-byte zeroing */
    }

    track_region(0x6FDDB658u + ((ny & 0x7Fu) << 2), 4);
    track_region(0x6FDDB458u + ((nx & 0x7Fu) << 2), 4);
    track_region(pCtx + bucket * 4u, 4);
    track_region(pCtx + 0x200u + bucket * 4u, 4);
    track_region(pCtx + 0x400u, 4);
    if (usedInit < 200u) track_region(pCtx + 0x404u + usedInit * 0x38u, 0x38);
    track_region(pCtx + 0x2FC4u, 0x20);
    track_region(pCtx + 0x32E8u, 4);
    track_region(pParent, 0x38);
    track_region(pExisting, 0x38);
    track_region(pChild, 0x38);
    track_region(pOpenOther, 0x38);
    snapshot_pre();
    u32 unusedArg = 0xDEADBEEFu;
    u32 ret = call_ebx_stk4_u32(0x6FDCAFB0u, pParent, unusedArg, pCtx, xy, targetXY);
    char note[48];
    snprintf(note, sizeof(note), "astar_neighbor_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u]", pParent, unusedArg, pCtx, xy, targetXY);
    emit_vector(fp, "0x6FDCAFB0", "PATH_AStar_ProcessNeighbor113c", v, note, args, ret, 0xFFFFFFFFu);
  }
}

typedef struct {
  u32 r[9];    /* 3x3 grid: 0=NW(90,90),1=N(100,90),2=NE(110,90),3=W(90,100),4=C(100,100),5=E(110,100),6=SW(90,110),7=S(100,110),8=SE(110,110) */
  u32 g[9];
  u32 m[9];
  u32 nearList;
  u32 rNoGrid;
  u32 rNoMap;
  u32 gNoMap;
} CollWorld;

static void build_coll_world(CollWorld *w, int linkNeighbors) {
  w->nearList = heap_alloc(0x30);
  for (int idx = 0; idx < 9; idx++) {
    s32 sx = 90 + (idx % 3) * 10;
    s32 sy = 90 + (idx / 3) * 10;
    u32 rm = heap_alloc(0x80);
    u32 gr = heap_alloc(0x30);
    u32 mp = heap_alloc(200); /* 10*10 u16 = 200 B */
    *(s32 *)(usize)(rm + 0x4C) = sx;
    *(s32 *)(usize)(rm + 0x50) = sy;
    *(s32 *)(usize)(rm + 0x54) = 10;
    *(s32 *)(usize)(rm + 0x58) = 10;
    *(u32 *)(usize)(rm + 0x20) = gr;
    *(s32 *)(usize)(gr + 0x00) = sx;
    *(s32 *)(usize)(gr + 0x04) = sy;
    *(s32 *)(usize)(gr + 0x08) = 10;
    *(s32 *)(usize)(gr + 0x0C) = 10;
    *(u32 *)(usize)(gr + 0x20) = mp;
    w->r[idx] = rm; w->g[idx] = gr; w->m[idx] = mp;
    *(u32 *)(usize)(w->nearList + (u32)idx * 4u) = rm;
  }
  for (int idx = 0; idx < 9; idx++) {
    if (linkNeighbors) {
      *(u32 *)(usize)(w->r[idx] + 0x00) = w->nearList;
      *(u32 *)(usize)(w->r[idx] + 0x24) = 9u;
    } else {
      u32 selfNear = heap_alloc(0x08);
      *(u32 *)(usize)selfNear = w->r[idx];
      *(u32 *)(usize)(w->r[idx] + 0x00) = selfNear;
      *(u32 *)(usize)(w->r[idx] + 0x24) = 1u;
      track_region(selfNear, 0x08);
    }
  }
  w->rNoGrid = heap_alloc(0x80);
  *(s32 *)(usize)(w->rNoGrid + 0x4C) = 200; *(s32 *)(usize)(w->rNoGrid + 0x50) = 200;
  *(s32 *)(usize)(w->rNoGrid + 0x54) = 10;  *(s32 *)(usize)(w->rNoGrid + 0x58) = 10;
  w->rNoMap = heap_alloc(0x80);
  w->gNoMap = heap_alloc(0x30);
  *(s32 *)(usize)(w->rNoMap + 0x4C) = 220; *(s32 *)(usize)(w->rNoMap + 0x50) = 220;
  *(s32 *)(usize)(w->rNoMap + 0x54) = 10;  *(s32 *)(usize)(w->rNoMap + 0x58) = 10;
  *(u32 *)(usize)(w->rNoMap + 0x20) = w->gNoMap;

  track_region(w->nearList, 0x30);
  for (int idx = 0; idx < 9; idx++) {
    track_region(w->r[idx], 0x80);
    track_region(w->g[idx], 0x30);
    track_region(w->m[idx], 200);
  }
  track_region(w->rNoGrid, 0x80);
  track_region(w->rNoMap, 0x80);
  track_region(w->gNoMap, 0x30);
}

static void set_world_cell(const CollWorld *w, s32 wx, s32 wy, u16 val) {
  int gx = (wx - 90) / 10;
  int gy = (wy - 90) / 10;
  int idx = gy * 3 + gx;
  int rx = (wx - 90) % 10;
  int ry = (wy - 90) % 10;
  *(u16 *)(usize)(w->m[idx] + (u32)((ry * 10 + rx) * 2)) = val;
}

static u32 make_tiny_room(s32 sx, s32 sy, s32 sw, s32 sh) {
  u32 rm = heap_alloc(0x80);
  u32 gr = heap_alloc(0x30);
  u32 mp = heap_alloc(0x20);
  u32 nr = heap_alloc(0x08);
  *(s32 *)(usize)(rm + 0x4C) = sx; *(s32 *)(usize)(rm + 0x50) = sy;
  *(s32 *)(usize)(rm + 0x54) = sw; *(s32 *)(usize)(rm + 0x58) = sh;
  *(u32 *)(usize)(rm + 0x20) = gr;
  *(u32 *)(usize)(rm + 0x00) = nr; *(u32 *)(usize)(rm + 0x24) = 1u;
  *(u32 *)(usize)nr = rm;
  *(s32 *)(usize)(gr + 0x00) = sx; *(s32 *)(usize)(gr + 0x04) = sy;
  *(s32 *)(usize)(gr + 0x08) = sw; *(s32 *)(usize)(gr + 0x0C) = sh;
  *(u32 *)(usize)(gr + 0x20) = mp;
  track_region(rm, 0x80); track_region(gr, 0x30); track_region(mp, 0x20); track_region(nr, 0x08);
  return rm;
}

static void emit_b066(FILE *fp) {
  char args[224];

  /* F13: 0x6FD80730 COLLISION_RayTraceBetweenSizedPoints113c */
  {
    typedef struct {
      s32 x1, y1, sz1, x2, y2, sz2;
      s32 blkX, blkY;
      u32 mask;
      const char *note;
    } F13Case;
    const F13Case cs[15] = {
      { 101, 105,  0, 108, 105,  0,  -1,  -1, 0x01u, "sz00_clear" },
      { 101, 105,  0, 108, 105,  0, 105, 105, 0x01u, "sz00_blocked" },
      { 104, 104,  2, 105, 105,  2, 104, 104, 0x01u, "adjacent_lt_sum_early0" },
      { 102, 104,  1, 104, 105,  2, 103, 104, 0x01u, "eq_sum_runs_raytrace" },
      { 100, 105,  5, 109, 105,  4, 100, 105, 0x01u, "clamped_sz5_sz4_clears_start_blk" },
      { 103, 105, -1, 107, 105,  1, 102, 105, 0x01u, "neg_sz1_expands_left_hits_blk" },
      { 101, 105,  1, 108, 105,  2, 108, 105, 0x01u, "dx_gt_dy_pos_shrink_skips_end_blk" },
      { 108, 105,  1, 101, 105,  2, 101, 105, 0x01u, "dx_gt_dy_neg_shrink_skips_end_blk" },
      { 105, 101,  1, 105, 108,  2, 105, 108, 0x01u, "dy_gt_dx_pos_shrink_skips_end_blk" },
      { 105, 108,  1, 105, 101,  2, 105, 101, 0x01u, "dy_gt_dx_neg_shrink_skips_end_blk" },
      { 101, 108,  1, 108, 101,  1, 105, 104, 0x04u, "diag_eq_dx_dy_blocked" },
      { 105, 105,  1, 116, 105,  1, 113, 105, 0x01u, "cross_room_rC_to_rE_blocked" },
      { 101, 105,  2, 108, 105,  0, 101, 105, 0x01u, "sz20_skips_start_blk" },
      { 105, 105, -2, 105, 105,  0, 106, 106, 0x01u, "same_pt_neg_sz1_se_hits_blk" },
      { 101, 105,  0, 108, 105,  2, 108, 105, 0x01u, "sz02_skips_end_blk" }
    };
    for (int v = 0; v < 15; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      if (cs[v].blkX >= 0) set_world_cell(&w, cs[v].blkX, cs[v].blkY, (u16)cs[v].mask);
      snapshot_pre();
      u32 pRoom = w.r[4];
      u32 ret = call_eax_ecx_edx_stk5_u32(
        0x6FD80730u,
        (u32)cs[v].x2, (u32)cs[v].x1, (u32)cs[v].sz2,
        (u32)cs[v].y1, (u32)cs[v].sz1, (u32)cs[v].y2, pRoom, cs[v].mask
      );
      snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u,%u,%u]",
        (u32)cs[v].x2, (u32)cs[v].x1, (u32)cs[v].sz2,
        (u32)cs[v].y1, (u32)cs[v].sz1, (u32)cs[v].y2, pRoom, cs[v].mask);
      emit_vector(fp, "0x6FD80730", "COLLISION_RayTraceBetweenSizedPoints113c", v, cs[v].note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F14: 0x6FD9B840 COLLISION_SetMaskWithSizeXY113c */
  for (int v = 0; v < 12; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    set_world_cell(&w, 105, 105, 0x0010u);
    u32 pRoom = w.r[4];
    s32 nx = 105, ny = 105, sx = 1, sy = 1;
    u32 mask = 0x0105u;
    if (v == 1) { nx = 113; ny = 104; }
    else if (v == 2) { pRoom = 0u; }
    else if (v == 3) { pRoom = w.rNoGrid; nx = 202; ny = 202; }
    else if (v == 4) { pRoom = w.rNoMap;  nx = 222; ny = 222; }
    else if (v == 5) { sx = 2; sy = 3; }
    else if (v == 6) { nx = 109; ny = 109; sx = 3; sy = 3; mask = 0x0080u; }
    else if (v == 7) { sx = 0; sy = 2; }
    else if (v == 8) { sx = -1; sy = 2; }
    else if (v == 9) { sx = 3; sy = 1; }
    else if (v == 10) { nx = 104; ny = 104; sx = 0; sy = 1; }
    else if (v == 11) { sx = 1; sy = 3; }
    snapshot_pre();
    ((fn_std6_void_t)(usize)0x6FD9B840u)(pRoom, (u32)nx, (u32)ny, (u32)sx, (u32)sy, mask);
    char note[48];
    snprintf(note, sizeof(note), "set_szxy_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u]", pRoom, (u32)nx, (u32)ny, (u32)sx, (u32)sy, mask);
    emit_vector(fp, "0x6FD9B840", "COLLISION_SetMaskWithSizeXY113c", v, note, args, 0u, 0u);
  }

  /* F15: 0x6FD9B8F0 COLLISION_SetMask3x3_113c */
  for (int v = 0; v < 5; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    set_world_cell(&w, 105, 105, 0x0020u);
    u32 pRoom = (v == 3) ? 0u : w.r[4];
    s32 nx = (v == 1) ? 109 : (v == 2) ? 114 : 105;
    s32 ny = (v == 1) ? 109 : (v == 2) ? 104 : 105;
    u32 mask = (v == 4) ? 0x8001u : 0x0004u;
    snapshot_pre();
    call_ecx_eax_stk2_void(0x6FD9B8F0u, pRoom, (u32)nx, (u32)ny, mask);
    char note[48];
    snprintf(note, sizeof(note), "set_3x3_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pRoom, (u32)nx, (u32)ny, mask);
    emit_vector(fp, "0x6FD9B8F0", "COLLISION_SetMask3x3_113c", v, note, args, 0u, 0u);
  }

  /* F16: 0x6FD9BAB0 COLLISION_ResetMaskWithSizeXY113c */
  for (int v = 0; v < 11; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    for (int y = 103; y <= 111; y++)
      for (int x = 103; x <= 115; x++)
        set_world_cell(&w, x, y, 0xFFFFu);
    u32 pRoom = w.r[4];
    s32 nx = 105, ny = 105, sx = 1, sy = 1;
    u32 mask = 0x0105u;
    if (v == 0) { sx = 0; sy = 2; }
    else if (v == 1) { sx = 2; sy = 0; }
    else if (v == 2) { sx = -2; sy = 2; }
    else if (v == 3) { sx = 1; sy = 1; }
    else if (v == 4) { nx = 113; ny = 105; sx = 1; sy = 1; }
    else if (v == 5) { pRoom = 0u; }
    else if (v == 6) { sx = 2; sy = 3; }
    else if (v == 7) { nx = 109; ny = 109; sx = 3; sy = 3; mask = 0x0FF0u; }
    else if (v == 8) { nx = 106; ny = 106; sx = 4; sy = 2; mask = 0x8001u; }
    else if (v == 9) { sx = 3; sy = 1; }
    else if (v == 10) { sx = 1; sy = 3; }
    snapshot_pre();
    ((fn_std6_void_t)(usize)0x6FD9BAB0u)(pRoom, (u32)nx, (u32)ny, (u32)sx, (u32)sy, mask);
    char note[48];
    snprintf(note, sizeof(note), "reset_szxy_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u]", pRoom, (u32)nx, (u32)ny, (u32)sx, (u32)sy, mask);
    emit_vector(fp, "0x6FD9BAB0", "COLLISION_ResetMaskWithSizeXY113c", v, note, args, 0u, 0u);
  }

  /* F17: 0x6FD9BB30 COLLISION_ResetMask3x3_113c */
  for (int v = 0; v < 5; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    for (int y = 103; y <= 111; y++)
      for (int x = 103; x <= 115; x++)
        set_world_cell(&w, x, y, 0xFF3Fu);
    u32 pRoom = (v == 3) ? 0u : w.r[4];
    s32 nx = (v == 1) ? 109 : (v == 2) ? 113 : 105;
    s32 ny = (v == 1) ? 109 : (v == 2) ? 105 : 105;
    u32 mask = (v == 4) ? 0x0104u : 0x00FFu;
    snapshot_pre();
    call_ecx_eax_stk2_void(0x6FD9BB30u, pRoom, (u32)nx, (u32)ny, mask);
    char note[48];
    snprintf(note, sizeof(note), "reset_3x3_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pRoom, (u32)nx, (u32)ny, mask);
    emit_vector(fp, "0x6FD9BB30", "COLLISION_ResetMask3x3_113c", v, note, args, 0u, 0u);
  }

  /* F18: 0x6FD9BFC0 COLLISION_SetMaskWithPattern113c */
  {
    const s32 pats[8] = { 0, 1, 2, 2, 3, 4, -1, 1 };
    const s32 pxs[8]  = { 105, 105, 105, 109, 109, 105, 105, 103 };
    const s32 pys[8]  = { 105, 105, 105, 105, 105, 105, 105, 107 };
    for (int v = 0; v < 8; v++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pRoom = w.r[4];
      u32 mask = 0x0204u;
      snapshot_pre();
      ((fn_std5_void_t)(usize)0x6FD9BFC0u)(pRoom, (u32)pxs[v], (u32)pys[v], (u32)pats[v], mask);
      char note[48];
      snprintf(note, sizeof(note), "set_pat_%d_v%d", (int)pats[v], v);
      snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u]", pRoom, (u32)pxs[v], (u32)pys[v], (u32)pats[v], mask);
      emit_vector(fp, "0x6FD9BFC0", "COLLISION_SetMaskWithPattern113c", v, note, args, 0u, 0u);
    }
  }

  /* F19: 0x6FD9C080 COLLISION_CheckMaskWithSizeXY113c (retMask 0xFFFF) */
  for (int v = 0; v < 9; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, (v == 7) ? 0 : 1);
    set_world_cell(&w, 105, 105, (v == 0) ? 0u : 0x0104u);
    set_world_cell(&w, 105, 106, 0x0020u);
    set_world_cell(&w, 106, 105, 0x0040u);
    set_world_cell(&w, 110, 109, 0x0080u);
    u32 pRoom = (v == 8) ? 0u : w.r[4];
    s32 nx = 105, ny = 105, sx = 1, sy = 1;
    u32 mask = 0x00FFu;
    if (v == 2) { sx = 0; sy = 1; }
    else if (v == 3) { sx = -1; sy = 1; }
    else if (v == 4) { sx = 1; sy = 2; ny = 106; }
    else if (v == 5) { sx = 2; sy = 1; nx = 106; }
    else if (v == 6) { sx = 3; sy = 3; mask = 0xFFFFu; }
    else if (v == 7) { nx = 109; ny = 109; sx = 3; sy = 3; mask = 0xFFFFu; }
    snapshot_pre();
    u32 ret = ((fn_std6_u32_t)(usize)0x6FD9C080u)(pRoom, (u32)nx, (u32)ny, (u32)sx, (u32)sy, mask);
    char note[48];
    snprintf(note, sizeof(note), "chk_szxy_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u,%u]", pRoom, (u32)nx, (u32)ny, (u32)sx, (u32)sy, mask);
    emit_vector(fp, "0x6FD9C080", "COLLISION_CheckMaskWithSizeXY113c", v, note, args, ret, 0xFFFFu);
  }

  /* F20: 0x6FD9C140 COLLISION_CheckCrossPatternCollision113c */
  {
    int caseIdx = 0;
    /* Null / noGrid / noMap */
    for (int k = 0; k < 3; k++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pRoom = (k == 0) ? 0u : (k == 1) ? w.rNoGrid : w.rNoMap;
      s32 nx = (k == 1) ? 202 : (k == 2) ? 222 : 105;
      s32 ny = nx;
      snapshot_pre();
      u32 ret = call_eax_esi_stk2_u32(0x6FD9C140u, (u32)nx, 0xFFFFu, pRoom, (u32)ny);
      char note[48];
      snprintf(note, sizeof(note), "null_guard_%d", k);
      snprintf(args, sizeof(args), "[%u,%u,%u,%u]", (u32)nx, 0xFFFFu, pRoom, (u32)ny);
      emit_vector(fp, "0x6FD9C140", "COLLISION_CheckCrossPatternCollision113c", caseIdx++, note, args, ret, 0xFFFFFFFFu);
    }
    /* Interior case 0: clear + hit in each of C, L, R, U, D + mask-miss */
    const s32 dx5[5] = { 0, -1, 1,  0, 0 };
    const s32 dy5[5] = { 0,  0, 0, -1, 1 };
    for (int sub = 0; sub < 7; sub++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      if (sub >= 1 && sub <= 5) set_world_cell(&w, 105 + dx5[sub - 1], 105 + dy5[sub - 1], 0x0004u);
      if (sub == 6) set_world_cell(&w, 105, 105, 0x0008u);
      u32 mask = 0x0004u;
      snapshot_pre();
      u32 ret = call_eax_esi_stk2_u32(0x6FD9C140u, 105u, mask, w.r[4], 105u);
      char note[48];
      snprintf(note, sizeof(note), "edge0_sub_%d", sub);
      snprintf(args, sizeof(args), "[105,%u,%u,105]", mask, w.r[4]);
      emit_vector(fp, "0x6FD9C140", "COLLISION_CheckCrossPatternCollision113c", caseIdx++, note, args, ret, 0xFFFFFFFFu);
    }
    /* Boundary/corner cases: 1, 2, 3, 4, 6, 8, 9, 12 -> clear, ext1 blocked, ext2/in-room blocked */
    const s32 bx[8]  = { 100, 105, 100, 109, 109, 105, 100, 109 };
    const s32 by[8]  = { 105, 100, 100, 105, 100, 109, 109, 109 };
    const int eId[8] = {   1,   2,   3,   4,   6,   8,   9,  12 };
    const s32 ex1x[8]= {  99, 105, 100, 110, 110, 105,  99, 110 };
    const s32 ex1y[8]= { 105,  99,  99, 105, 100, 110, 109, 109 };
    const s32 ex2x[8]= { 100, 105,  99, 109, 109, 105, 100, 109 };
    const s32 ex2y[8]= { 105, 100, 100, 105,  99, 109, 110, 110 };
    for (int b = 0; b < 8; b++) {
      for (int mode = 0; mode < 3; mode++) {
        reset_heap();
        CollWorld w;
        build_coll_world(&w, 1);
        if (mode == 1) set_world_cell(&w, ex1x[b], ex1y[b], 0x0002u);
        if (mode == 2) set_world_cell(&w, ex2x[b], ex2y[b], 0x0002u);
        snapshot_pre();
        u32 ret = call_eax_esi_stk2_u32(0x6FD9C140u, (u32)bx[b], 0x0002u, w.r[4], (u32)by[b]);
        char note[48];
        snprintf(note, sizeof(note), "edge%d_mode%d", eId[b], mode);
        snprintf(args, sizeof(args), "[%u,2,%u,%u]", (u32)bx[b], w.r[4], (u32)by[b]);
        emit_vector(fp, "0x6FD9C140", "COLLISION_CheckCrossPatternCollision113c", caseIdx++, note, args, ret, 0xFFFFFFFFu);
      }
    }
    /* Impossible/default edge cases 5, 7, 10, 11, 15 via 1x2, 2x1, 1x1 rooms */
    const s32 tw[5] = { 1, 1, 2, 2, 1 };
    const s32 th[5] = { 3, 2, 1, 1, 1 };
    const s32 qx[5] = { 50, 50, 51, 50, 50 };
    const s32 qy[5] = { 51, 50, 50, 50, 50 };
    for (int t = 0; t < 5; t++) {
      reset_heap();
      u32 tr = make_tiny_room(50, 50, tw[t], th[t]);
      snapshot_pre();
      u32 ret = call_eax_esi_stk2_u32(0x6FD9C140u, (u32)qx[t], 0xFFFFu, tr, (u32)qy[t]);
      char note[48];
      snprintf(note, sizeof(note), "tiny_default_%d", t);
      snprintf(args, sizeof(args), "[%u,65535,%u,%u]", (u32)qx[t], tr, (u32)qy[t]);
      emit_vector(fp, "0x6FD9C140", "COLLISION_CheckCrossPatternCollision113c", caseIdx++, note, args, ret, 0xFFFFFFFFu);
    }
  }

  /* F21: 0x6FD9C530 COLLISION_GetMask3x3_113c (retMask 0xFFFF) */
  for (int v = 0; v < 7; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, (v == 4) ? 0 : 1);
    if (v >= 1 && v <= 5) {
      set_world_cell(&w, 104, 104, 0x0001u);
      set_world_cell(&w, 106, 105, 0x0004u);
      set_world_cell(&w, 105, 106, 0x0010u);
      set_world_cell(&w, 110, 110, 0x0200u);
    } else if (v == 6) {
      set_world_cell(&w, 105, 104, 0x0040u);
    }
    u32 pRoom = (v == 5) ? 0u : w.r[4];
    s32 nx = (v == 3 || v == 4) ? 109 : 105;
    s32 ny = (v == 3 || v == 4) ? 109 : (v == 6) ? 108 : 105;
    u32 mask = (v == 2) ? 0x0005u : (v == 6) ? 0x00FFu : 0xFFFFu;
    snapshot_pre();
    u32 ret = call_ecx_eax_stk2_u32(0x6FD9C530u, pRoom, (u32)nx, (u32)ny, mask);
    char note[48];
    snprintf(note, sizeof(note), "get_3x3_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pRoom, (u32)nx, (u32)ny, mask);
    emit_vector(fp, "0x6FD9C530", "COLLISION_GetMask3x3_113c", v, note, args, ret, 0xFFFFu);
  }

  /* F22: 0x6FD9C5C0 COLLISION_GetCrossPatternMask113c (retMask 0xFFFF) */
  {
    int caseIdx = 0;
    for (int k = 0; k < 3; k++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      u32 pRoom = (k == 0) ? 0u : (k == 1) ? w.rNoGrid : w.rNoMap;
      s32 nx = (k == 1) ? 202 : (k == 2) ? 222 : 105;
      u32 mask = 0x1234u + (u32)k;
      snapshot_pre();
      u32 ret = call_eax_stk3_u32(0x6FD9C5C0u, pRoom, (u32)nx, (u32)nx, mask);
      char note[48];
      snprintf(note, sizeof(note), "get_cross_null_%d", k);
      snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pRoom, (u32)nx, (u32)nx, mask);
      emit_vector(fp, "0x6FD9C5C0", "COLLISION_GetCrossPatternMask113c", caseIdx++, note, args, ret, 0xFFFFu);
    }
    /* Case 0 interior: clear + unique bits in C/L/R/U/D + masked */
    for (int sub = 0; sub < 3; sub++) {
      reset_heap();
      CollWorld w;
      build_coll_world(&w, 1);
      if (sub >= 1) {
        set_world_cell(&w, 105, 105, 0x0001u);
        set_world_cell(&w, 104, 105, 0x0002u);
        set_world_cell(&w, 106, 105, 0x0004u);
        set_world_cell(&w, 105, 104, 0x0008u);
        set_world_cell(&w, 105, 106, 0x0010u);
      }
      u32 mask = (sub == 2) ? 0x0015u : 0xFFFFu;
      snapshot_pre();
      u32 ret = call_eax_stk3_u32(0x6FD9C5C0u, w.r[4], 105u, 105u, mask);
      char note[48];
      snprintf(note, sizeof(note), "get_cross_edge0_%d", sub);
      snprintf(args, sizeof(args), "[%u,105,105,%u]", w.r[4], mask);
      emit_vector(fp, "0x6FD9C5C0", "COLLISION_GetCrossPatternMask113c", caseIdx++, note, args, ret, 0xFFFFu);
    }
    /* Boundary/corner cases 1,2,3,4,6,8,9,12: distinct bits in all 5 cross arms + unlinked neighbor 0x27 */
    const s32 bx[8]  = { 100, 105, 100, 109, 109, 105, 100, 109 };
    const s32 by[8]  = { 105, 100, 100, 105, 100, 109, 109, 109 };
    const int eId[8] = {   1,   2,   3,   4,   6,   8,   9,  12 };
    for (int b = 0; b < 8; b++) {
      for (int linked = 0; linked < 2; linked++) {
        reset_heap();
        CollWorld w;
        build_coll_world(&w, linked);
        set_world_cell(&w, bx[b],     by[b],     0x0040u);
        set_world_cell(&w, bx[b] - 1, by[b],     0x0080u);
        set_world_cell(&w, bx[b] + 1, by[b],     0x0100u);
        set_world_cell(&w, bx[b],     by[b] - 1, 0x0200u);
        set_world_cell(&w, bx[b],     by[b] + 1, 0x0400u);
        u32 mask = 0x0FFFu;
        snapshot_pre();
        u32 ret = call_eax_stk3_u32(0x6FD9C5C0u, w.r[4], (u32)bx[b], (u32)by[b], mask);
        char note[48];
        snprintf(note, sizeof(note), "get_cross_edge%d_lnk%d", eId[b], linked);
        snprintf(args, sizeof(args), "[%u,%u,%u,%u]", w.r[4], (u32)bx[b], (u32)by[b], mask);
        emit_vector(fp, "0x6FD9C5C0", "COLLISION_GetCrossPatternMask113c", caseIdx++, note, args, ret, 0xFFFFu);
      }
    }
    /* Default edge cases 5, 7, 10, 11, 15 */
    const s32 tw[5] = { 1, 1, 2, 2, 1 };
    const s32 th[5] = { 3, 2, 1, 1, 1 };
    const s32 qx[5] = { 50, 50, 51, 50, 50 };
    const s32 qy[5] = { 51, 50, 50, 50, 50 };
    for (int t = 0; t < 5; t++) {
      reset_heap();
      u32 tr = make_tiny_room(50, 50, tw[t], th[t]);
      u32 mask = 0x0333u + (u32)t;
      snapshot_pre();
      u32 ret = call_eax_stk3_u32(0x6FD9C5C0u, tr, (u32)qx[t], (u32)qy[t], mask);
      char note[48];
      snprintf(note, sizeof(note), "get_cross_default_%d", t);
      snprintf(args, sizeof(args), "[%u,%u,%u,%u]", tr, (u32)qx[t], (u32)qy[t], mask);
      emit_vector(fp, "0x6FD9C5C0", "COLLISION_GetCrossPatternMask113c", caseIdx++, note, args, ret, 0xFFFFu);
    }
  }

  /* F23: 0x6FD9CB90 COLLISION_FindFreeCoordsNear113c */
  for (int v = 0; v < 9; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, (v == 6 || v == 7) ? 0 : 1);
    u32 pCoord = heap_alloc(0x10);
    u32 ppRoomOut = heap_alloc(0x10);
    *(u32 *)(usize)ppRoomOut = 0xCAFEBABEu;
    s32 x0 = 105, y0 = 105, nSize = 0;
    u32 mask = 0x0001u;
    if (v == 0) {
      /* Free on first probe (104,104) */
    } else if (v == 1) {
      /* Block (104,104) and (103,103) -> lands on (105,103) in ring 2 */
      set_world_cell(&w, 104, 104, 1u);
      set_world_cell(&w, 103, 103, 1u);
    } else if (v == 2) {
      /* Start at (100,100) -> ring 1 (-1,-1) = (99,99) crosses into NW room w.r[0] */
      x0 = 100; y0 = 100;
    } else if (v == 3) {
      /* nSize = -1 (dim = 1 single cell): block surrounding cells so dim=2 fails, single cell (104,104) clear */
      nSize = -1;
      set_world_cell(&w, 103, 104, 1u);
      set_world_cell(&w, 104, 103, 1u);
      set_world_cell(&w, 103, 103, 1u);
    } else if (v == 4) {
      nSize = -2;
      set_world_cell(&w, 104, 104, 1u);
    } else if (v == 5) {
      /* nSize = 2 (dim = 4): block center so rings 1..2 overlap, ring 3 succeeds */
      nSize = 2;
      set_world_cell(&w, 104, 104, 1u);
    } else if (v == 6) {
      /* Unlinked room, y0 = 100 -> ring 1 dy=-1 (y=99) has rr==0, ring 2 dy=0 finds (103,100) inside r[4] */
      x0 = 105; y0 = 100;
      nSize = -1;
    } else if (v == 7) {
      /* Exhaust all 49 rings: fill entire r[4] with 0xFFFF and unlinked */
      for (int y = 100; y < 110; y++)
        for (int x = 100; x < 110; x++)
          set_world_cell(&w, x, y, 0xFFFFu);
    } else {
      /* Non-square 5x10 r[4] [100..105,100..110) blocked + r[5] [105..115,100..110) free; x=105 == coSubX+coSubW */
      *(s32 *)(usize)(w.r[4] + 0x54) = 5;
      *(s32 *)(usize)(w.g[4] + 0x08) = 5;
      *(s32 *)(usize)(w.r[5] + 0x4C) = 105;
      *(s32 *)(usize)(w.g[5] + 0x00) = 105;
      for (int i = 0; i < 100; i++) *(u16 *)(usize)(w.m[4] + (u32)(i * 2)) = 0xFFFFu;
      x0 = 104; y0 = 105;
      nSize = -1;
    }
    *(s32 *)(usize)(pCoord + 0x00) = x0;
    *(s32 *)(usize)(pCoord + 0x04) = y0;
    track_region(pCoord, 0x10);
    track_region(ppRoomOut, 0x10);
    snapshot_pre();
    call_ecx_edx_stk3_void(0x6FD9CB90u, w.r[4], pCoord, (u32)nSize, mask, ppRoomOut);
    char note[48];
    snprintf(note, sizeof(note), "find_free_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u,%u]", w.r[4], pCoord, (u32)nSize, mask, ppRoomOut);
    emit_vector(fp, "0x6FD9CB90", "COLLISION_FindFreeCoordsNear113c", v, note, args, 0u, 0u);
  }

  /* F24: 0x6FD9B510 COLLISION_GetMaskAt113c (retMask 0xFFFF) */
  for (int v = 0; v < 8; v++) {
    reset_heap();
    CollWorld w;
    build_coll_world(&w, 1);
    set_world_cell(&w, 105, 105, 0x8235u);
    set_world_cell(&w, 112, 104, 0x0144u);
    u32 pRoom = w.r[4];
    s32 nx = 105, ny = 105;
    u32 mask = 0xFFFFu;
    if (v == 0) mask = 0u;
    else if (v == 1) mask = 0x0015u;
    else if (v == 2) mask = 0xFFFFu;
    else if (v == 3) { nx = 112; ny = 104; mask = 0x00FFu; }
    else if (v == 4) { nx = 500; ny = 500; }
    else if (v == 5) { pRoom = 0u; }
    else if (v == 6) { pRoom = w.rNoGrid; nx = 202; ny = 202; }
    else if (v == 7) { pRoom = w.rNoMap;  nx = 222; ny = 222; }
    snapshot_pre();
    u32 ret = call_eax_edx_ecx_stk1_u32(0x6FD9B510u, pRoom, (u32)nx, (u32)ny, mask);
    char note[48];
    snprintf(note, sizeof(note), "get_mask_at_v%d", v);
    snprintf(args, sizeof(args), "[%u,%u,%u,%u]", pRoom, (u32)nx, (u32)ny, mask);
    emit_vector(fp, "0x6FD9B510", "COLLISION_GetMaskAt113c", v, note, args, ret, 0xFFFFu);
  }
}

int main(int argc, char **argv) {
  const char *b061_out = (argc > 1) ? argv[1] : "tests/fixtures/oracle/k1/b061-vectors.ndjson";
  const char *b066_out = (argc > 2) ? argv[2] : "tests/fixtures/oracle/k1/b066-vectors.ndjson";

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

  FILE *fp61 = fopen(b061_out, "wb");
  if (!fp61) return 4;
  emit_b061(fp61);
  fclose(fp61);

  FILE *fp66 = fopen(b066_out, "wb");
  if (!fp66) return 5;
  emit_b066(fp66);
  fclose(fp66);

  return 0;
}
