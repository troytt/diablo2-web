/*
 * k1r2-laneC-it7-emitter.c
 *
 * 32-bit MinGW executable that loads the real D2Common.dll v1.13c at its
 * preferred image base 0x6FD50000 (along with real D2CMP.dll and Fog.dll)
 * under Wine and emits differential test vectors (NDJSON) for Lane C Iteration 7:
 *   - B040 (17 net-new functions) -> b040-vectors.ndjson
 *   - B044 (1 function 0x6FD88850) -> b044-vectors.ndjson
 *   - B047 (16 functions incl. 0x6FDBC5D0 helper) -> b047-vectors.ndjson
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
static u32 g_mock_tick_count = 0;

#define RVA(va) (g_base - EXPECTED_BASE + (u32)(va))
#define PTR(off) ((u32)(ARENA_ADDR + (u32)(off)))
#define MEM(off) (g_arena + (u32)(off))
#define U32_AT(off) (*(u32 *)MEM(off))
#define S32_AT(off) (*(s32 *)MEM(off))
#define U16_AT(off) (*(u16 *)MEM(off))
#define S16_AT(off) (*(s16 *)MEM(off))
#define U8_AT(off)  (*(u8 *)MEM(off))

static u32 bump_alloc(u32 size) {
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
  if (edx != 0 && g_num_frees < 32) {
    g_frees[g_num_frees++] = edx;
  }
}

static u32 __attribute__((fastcall)) stub_fog_10047(
  u32 ecx, u32 edx_old, u32 new_size, u32 file, u32 line, u32 zero
) {
  (void)ecx; (void)file; (void)line; (void)zero;
  u32 pNew = bump_alloc(new_size);
  if (edx_old != 0 && new_size >= 4u) {
    memcpy((void *)(uintptr_t)pNew, (const void *)(uintptr_t)edx_old, new_size - 4u);
  }
  return pNew;
}

static DWORD __stdcall stub_get_tick_count(void) {
  return (DWORD)g_mock_tick_count;
}

static void __stdcall stub_d2cmp_10085(u32 *ppTiles, const char *szFile) {
  u32 h = *ppTiles;
  for (const u8 *s = (const u8 *)szFile; *s != 0; s++) {
    h = h * 33u + (u32)(*s);
  }
  *ppTiles = h;
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
  FILE *fp, u32 va, int case_idx, const char *note,
  const u32 *args, int nargs, u32 eax
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

static u32 calc_tile_bucket(s32 orient, s32 style, s32 seq) {
  return ((((u32)seq & 0xFFu) << 1) - ((u32)orient & 0xFFu) + ((u32)style & 0xFFu)) & 0x7Fu;
}

typedef void (__stdcall *fn_std1_void_t)(u32);
typedef u32  (__stdcall *fn_std1_u32_t)(u32);
typedef void (__stdcall *fn_std2_void_t)(u32, u32);
typedef u32  (__stdcall *fn_std2_u32_t)(u32, u32);
typedef void (__stdcall *fn_std3_void_t)(u32, u32, u32);
typedef void (__stdcall *fn_std4_void_t)(u32, u32, u32, u32);

/* B040 & B047 Register-Only Inline Asm Wrappers (0 "m" constraints) */
static __attribute__((noinline)) void call_eax_void(u32 fn, u32 a) {
  __asm__ volatile ("call *%1\n\t" : "+a"(a), "+c"(fn) : : "edx", "ebx", "esi", "edi", "cc", "memory");
}
static __attribute__((noinline)) u32 call_edi_ebx_u32(u32 fn, u32 edi_v, u32 ebx_v) {
  u32 r_eax = fn;
  __asm__ volatile ("call *%0\n\t" : "+a"(r_eax), "+D"(edi_v), "+b"(ebx_v) : : "ecx", "edx", "esi", "cc", "memory");
  return r_eax;
}
static __attribute__((noinline)) void call_eax_esi_void(u32 fn, u32 eax_v, u32 esi_v) {
  __asm__ volatile ("call *%2\n\t" : "+a"(eax_v), "+S"(esi_v), "+c"(fn) : : "edx", "ebx", "edi", "cc", "memory");
}
static __attribute__((noinline)) void call_edx_stk1_void(u32 fn, u32 edx_v, u32 s1) {
  __asm__ volatile ("push %2\n\tcall *%1\n\t" : "+d"(edx_v), "+c"(fn), "+a"(s1) : : "ebx", "esi", "edi", "cc", "memory");
}
static __attribute__((noinline)) void call_esi_edi_ecx_void(u32 fn, u32 esi_v, u32 edi_v, u32 ecx_v) {
  __asm__ volatile ("call *%3\n\t" : "+S"(esi_v), "+D"(edi_v), "+c"(ecx_v), "+a"(fn) : : "edx", "ebx", "cc", "memory");
}
static __attribute__((noinline)) void call_edi_ebx_void(u32 fn, u32 edi_v, u32 ebx_v) {
  __asm__ volatile ("call *%2\n\t" : "+D"(edi_v), "+b"(ebx_v), "+a"(fn) : : "ecx", "edx", "esi", "cc", "memory");
}
static __attribute__((noinline)) u32 call_eax_edx_ecx_u32(u32 fn, u32 eax_v, u32 edx_v, u32 ecx_v) {
  __asm__ volatile ("call *%3\n\t" : "+a"(eax_v), "+d"(edx_v), "+c"(ecx_v), "+b"(fn) : : "esi", "edi", "cc", "memory");
  return eax_v;
}
static __attribute__((noinline)) void call_eax_ecx_stk2_void(u32 fn, u32 eax_v, u32 ecx_v, u32 s1, u32 s2) {
  __asm__ volatile ("push %4\n\tpush %3\n\tcall *%2\n\t" : "+a"(eax_v), "+c"(ecx_v), "+b"(fn), "+S"(s1), "+D"(s2) : : "edx", "cc", "memory");
}
static __attribute__((noinline)) u32 call_edi_u32(u32 fn, u32 edi_v) {
  u32 r_eax = fn;
  __asm__ volatile ("call *%0\n\t" : "+a"(r_eax), "+D"(edi_v) : : "ecx", "edx", "ebx", "esi", "cc", "memory");
  return r_eax;
}
static __attribute__((noinline)) u32 call_edx_ecx_stk1_u32(u32 fn, u32 edx_v, u32 ecx_v, u32 s1) {
  u32 r_eax = fn;
  __asm__ volatile ("push %3\n\tcall *%0\n\t" : "+a"(r_eax), "+d"(edx_v), "+c"(ecx_v), "+b"(s1) : : "esi", "edi", "cc", "memory");
  return r_eax;
}
static __attribute__((noinline)) void call_ebx_void(u32 fn, u32 ebx_v) {
  __asm__ volatile ("call *%1\n\t" : "+b"(ebx_v), "+a"(fn) : : "ecx", "edx", "esi", "edi", "cc", "memory");
}
static __attribute__((noinline)) u32 call_esi_stk2_u32(u32 fn, u32 esi_v, u32 s1, u32 s2) {
  u32 r_eax = fn;
  __asm__ volatile ("push %3\n\tpush %2\n\tcall *%0\n\t" : "+a"(r_eax), "+S"(esi_v), "+b"(s1), "+D"(s2) : : "ecx", "edx", "cc", "memory");
  return r_eax;
}
static __attribute__((noinline)) u32 call_ecx_u32(u32 fn, u32 ecx_v) {
  u32 r_eax = fn;
  __asm__ volatile ("call *%0\n\t" : "+a"(r_eax), "+c"(ecx_v) : : "edx", "ebx", "esi", "edi", "cc", "memory");
  return r_eax;
}
static __attribute__((noinline)) void call_esi_ecx_void(u32 fn, u32 esi_v, u32 ecx_v) {
  __asm__ volatile ("call *%2\n\t" : "+S"(esi_v), "+c"(ecx_v), "+a"(fn) : : "edx", "ebx", "edi", "cc", "memory");
}
static __attribute__((noinline)) void call_edi_stk1_void(u32 fn, u32 edi_v, u32 s1) {
  __asm__ volatile ("push %2\n\tcall *%1\n\t" : "+D"(edi_v), "+a"(fn), "+b"(s1) : : "ecx", "edx", "esi", "cc", "memory");
}
static __attribute__((noinline)) void call_eax_ecx_stk1_void(u32 fn, u32 eax_v, u32 ecx_v, u32 s1) {
  __asm__ volatile ("push %3\n\tcall *%2\n\t" : "+a"(eax_v), "+c"(ecx_v), "+b"(fn), "+S"(s1) : : "edx", "edi", "cc", "memory");
}
static __attribute__((noinline)) void call_edi_stk2_void(u32 fn, u32 edi_v, u32 s1, u32 s2) {
  __asm__ volatile ("push %3\n\tpush %2\n\tcall *%1\n\t" : "+D"(edi_v), "+a"(fn), "+b"(s1), "+S"(s2) : : "ecx", "edx", "cc", "memory");
}
static __attribute__((noinline)) void call_ecx_esi_stk3_void(u32 fn, u32 ecx_v, u32 esi_v, u32 s1, u32 s2, u32 s3) {
  __asm__ volatile ("push %5\n\tpush %4\n\tpush %3\n\tcall *%2\n\t" : "+c"(ecx_v), "+S"(esi_v), "+a"(fn), "+b"(s1), "+d"(s2), "+D"(s3) : : "cc", "memory");
}
static __attribute__((noinline)) void call_esi_stk1_void(u32 fn, u32 esi_v, u32 s1) {
  __asm__ volatile ("push %2\n\tcall *%1\n\t" : "+S"(esi_v), "+a"(fn), "+b"(s1) : : "ecx", "edx", "edi", "cc", "memory");
}
static __attribute__((noinline)) u32 call_edx_u32(u32 fn, u32 edx_v) {
  u32 r_eax = fn;
  __asm__ volatile ("call *%0\n\t" : "+a"(r_eax), "+d"(edx_v) : : "ecx", "ebx", "esi", "edi", "cc", "memory");
  return r_eax;
}
static __attribute__((noinline)) u32 call_ebx_dl_u32(u32 fn, u32 ebx_v, u32 edx_v) {
  u32 r_eax = fn;
  __asm__ volatile ("call *%0\n\t" : "+a"(r_eax), "+b"(ebx_v), "+d"(edx_v) : : "ecx", "esi", "edi", "cc", "memory");
  return r_eax;
}

static void emit_b040(FILE *fp) {
  /* 1. 0x6FD7D4E0: DRLG_LoadActTownTileLibrary113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pDrlg = PTR(0x100);
    U32_AT(0x100 + 0x0C) = 0x12340000u + (u32)c;
    U8_AT(0x100 + 0x480) = (u8)c;
    track_dwords(PTR(0x100 + 0x0C), 4);
    track_dwords(PTR(0x100 + 0x480), 4);
    track_dwords((u32)RVA(0x6FDDAD5C), 16);
    track_dwords((u32)RVA(0x6FDE46A4), 32);
    track_dwords((u32)RVA(0x6FDE46C4), 32);
    track_dwords((u32)RVA(0x6FDE46E4), 32);
    u32 args[1] = { pDrlg };
    call_eax_void((u32)RVA(0x6FD7D4E0), pDrlg);
    const char *notes[4] = { "act0_floor_dt1", "act1_ground_dt1", "act2_sets_dt1", "act3_noop" };
    emit_case(fp, 0x6FD7D4E0u, c, notes[c], args, 1, 0);
  }

  /* 2. 0x6FD7D730: DRLG_GetOrAllocObjectPresetRecord113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pDrlg = PTR(0x100), n0 = PTR(0x600), n1 = PTR(0x680), pSgpt = PTR(0x700), pObjs = PTR(0x1000);
    U32_AT(0x100 + 0x90) = (c == 3) ? 0u : n0;
    U32_AT(0x100 + 0x478) = 0xCAFE0040u;
    S32_AT(0x600 + 0x00) = 5; U32_AT(0x600 + 0x44) = n1;
    S32_AT(0x680 + 0x00) = 9; U32_AT(0x680 + 0x44) = 0u;
    *(u32 *)RVA(0x6FDE9E1C) = pSgpt;
    *(u32 *)RVA(0x6FDF0B38) = pObjs;
    S32_AT(0x700 + 0xC5C) = 6;
    for (int i = 0; i < 16; i++) {
      U32_AT(0x1000 + 2 * 0x9C + 0x48 + i * 4) = 0x1000u + (u32)i;
      U32_AT(0x1000 + 4 * 0x9C + 0x48 + i * 4) = 0x2000u + (u32)i;
    }
    s32 objId = (c == 0) ? 5 : (c == 1) ? 9 : (c == 2) ? 2 : 4;
    track_dwords(PTR(0x100 + 0x90), 4);
    track_dwords(PTR(0x100 + 0x478), 4);
    track_dwords(n0, 0x48);
    track_dwords(n1, 0x48);
    track_dwords((u32)RVA(0x6FDE9E1C), 4);
    track_dwords((u32)RVA(0x6FDF0B38), 4);
    track_dwords(PTR(0x700 + 0xC5C), 4);
    track_dwords(PTR(0x1000 + 2 * 0x9C + 0x48), 0x40);
    track_dwords(PTR(0x1000 + 4 * 0x9C + 0x48), 0x40);
    u32 args[2] = { pDrlg, (u32)objId };
    u32 eax = call_edi_ebx_u32((u32)RVA(0x6FD7D730), pDrlg, (u32)objId);
    const char *notes[4] = { "found_head", "found_second", "alloc_prepend_existing", "alloc_on_empty_head" };
    emit_case(fp, 0x6FD7D730u, c, notes[c], args, 2, eax);
  }

  /* 3. 0x6FD7E0C0: DRLG_InitActTownFloorTileData113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pDrlg = PTR(0x100), pTileData = PTR(0x600), pHash = PTR(0x700), pNode = PTR(0x900), pBlk = PTR(0x940), pEntry = PTR(0x980);
    memset(MEM(0x600), 0xAA, 0x30);
    U32_AT(0x100 + 0x0C) = pHash;
    U32_AT(0x100 + 0x10) = 0u;
    U8_AT(0x100 + 0x480) = (u8)c;
    s32 st = (c == 2) ? 0x1D : 0;
    s32 sq = (c == 1) ? 1 : (c == 2) ? 0x0C : 0;
    u32 bkt = calc_tile_bucket(0, st, sq);
    U32_AT(0x700 + bkt * 4) = pNode;
    S32_AT(0x900 + 0x00) = st; S32_AT(0x900 + 0x04) = sq; S32_AT(0x900 + 0x08) = 0;
    U32_AT(0x900 + 0x0C) = pBlk; U32_AT(0x900 + 0x10) = 0u;
    U32_AT(0x940 + 0x00) = pEntry; U32_AT(0x940 + 0x04) = 0u;
    U16_AT(0x980 + 0x06) = (c == 0) ? 0x00u : (c == 1) ? 0x01u : 0x05u;
    track_dwords(PTR(0x100 + 0x0C), 8);
    track_dwords(PTR(0x100 + 0x480), 4);
    track_dwords(pTileData, 0x30);
    track_dwords(PTR(0x700 + bkt * 4), 4);
    track_dwords(pNode, 0x14);
    track_dwords(pBlk, 8);
    track_dwords(pEntry, 8);
    u32 args[2] = { pDrlg, pTileData };
    call_eax_esi_void((u32)RVA(0x6FD7E0C0), pDrlg, pTileData);
    const char *notes[4] = { "act0_flags0", "act1_flag1", "act2_flags1_and_4", "act3_zeroes_and_returns" };
    emit_case(fp, 0x6FD7E0C0u, c, notes[c], args, 2, 0);
  }

  /* 4. 0x6FD871C0: ENV_UpdateLightColor113c (4 cases) */
  {
    struct { s32 nAct, idx, ticks, rate, eclipse; const char *note; } cases[4] = {
      { 0, 2, 10240, 128, 0, "normal_cycle_idx2" },
      { 0, 5, 33280, 128, 0, "normal_cycle_idx5_wraps_to_0" },
      { 0, 1, 120, 4, 1, "eclipse_cycle_idx1" },
      { 3, 3, 23680, 128, 0, "act4_cycle_idx3" },
    };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pEnv = PTR(0x100);
      S32_AT(0x100 + 0x00) = cases[c].idx;
      S32_AT(0x100 + 0x08) = cases[c].ticks;
      S32_AT(0x100 + 0x28) = cases[c].rate;
      S32_AT(0x100 + 0x30) = cases[c].eclipse;
      track_dwords(pEnv, 0x38);
      u32 args[2] = { (u32)cases[c].nAct, pEnv };
      call_edx_stk1_void((u32)RVA(0x6FD871C0), (u32)cases[c].nAct, pEnv);
      emit_case(fp, 0x6FD871C0u, c, cases[c].note, args, 2, 0);
    }
  }

  /* 5. 0x6FD873B0: ENV_GetCycleState113c (4 cases) */
  {
    fn_std4_void_t fn = (fn_std4_void_t)RVA(0x6FD873B0);
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pAct = PTR(0x100), pEnv = PTR(0x140), pIdx = PTR(0x200), pTicks = PTR(0x204), pEcl = PTR(0x208);
      U32_AT(0x100 + 0x04) = pEnv;
      U32_AT(0x140 + 0x00) = (u32)c;
      U32_AT(0x140 + 0x08) = (u32)(c * 500 + 100);
      U32_AT(0x140 + 0x30) = (u32)(c & 1);
      track_dwords(PTR(0x100 + 0x04), 4);
      track_dwords(pEnv, 0x38);
      track_dwords(pIdx, 12);
      u32 args[4] = { pAct, pIdx, pTicks, pEcl };
      fn(pAct, pIdx, pTicks, pEcl);
      emit_case(fp, 0x6FD873B0u, c, "get_cycle_state", args, 4, 0);
    }
  }

  /* 6. 0x6FD876F0: ENV_UpdateIntensityAndSunAngle113c (8 cases) */
  {
    struct { s32 nAct, lvl, cur, ticks, rate, ecl; const char *note; } cases[8] = {
      { 3, 103, 100, 0, 128, 0, "act4_lvl103_inc" },
      { 3, 104, 80,  0, 128, 0, "act4_lvl104_dec" },
      { 3, 105, -1,  0, 128, 0, "act4_lvl105_neg1_to_0_snaps_to_target" },
      { 3, 106, 48,  0, 128, 0, "act4_lvl106_exact" },
      { 3, 108, 20,  0, 128, 0, "act4_lvl108_default_0x10" },
      { 0, 1,   36,  0, 4,   1, "eclipse_cur36_sub8_and_clamp32" },
      { 4, 120, 50,  0, 128, 0, "arreat_summit_lvl120_sets_200" },
      { 4, 109, 50,  11520, 128, 0, "act5_normal_clamps_to_0xAA" },
    };
    for (int c = 0; c < 8; c++) {
      reset_case();
      u32 pEnv = PTR(0x100);
      S32_AT(0x100 + 0x08) = cases[c].ticks;
      S32_AT(0x100 + 0x0C) = cases[c].cur;
      S32_AT(0x100 + 0x28) = cases[c].rate;
      S32_AT(0x100 + 0x30) = cases[c].ecl;
      track_dwords(pEnv, 0x38);
      u32 args[3] = { pEnv, (u32)cases[c].nAct, (u32)cases[c].lvl };
      call_esi_edi_ecx_void((u32)RVA(0x6FD876F0), pEnv, (u32)cases[c].nAct, (u32)cases[c].lvl);
      emit_case(fp, 0x6FD876F0u, c, cases[c].note, args, 3, 0);
    }
  }

  /* 7. 0x6FD92070: DRLGOUTDOORS_ScaleAndCompactVertices113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 ppHead = PTR(0x100), v0 = PTR(0x200), v1 = PTR(0x220), v2 = PTR(0x240);
    U32_AT(0x100) = v0;
    if (c == 0) {
      S32_AT(0x200) = -15; S32_AT(0x200 + 4) = 16;  U8_AT(0x200 + 8) = 1; U32_AT(0x200 + 0x0C) = 0x01; U32_AT(0x200 + 0x10) = v1;
      S32_AT(0x220) = 24;  S32_AT(0x220 + 4) = -24; U8_AT(0x220 + 8) = 2; U32_AT(0x220 + 0x0C) = 0x02; U32_AT(0x220 + 0x10) = v2;
      S32_AT(0x240) = 40;  S32_AT(0x240 + 4) = 48;  U8_AT(0x240 + 8) = 3; U32_AT(0x240 + 0x0C) = 0x04; U32_AT(0x240 + 0x10) = v0;
    } else if (c == 1) {
      S32_AT(0x200) = 10; S32_AT(0x200 + 4) = 20; U8_AT(0x200 + 8) = 1; U32_AT(0x200 + 0x0C) = 0x01; U32_AT(0x200 + 0x10) = v1;
      S32_AT(0x220) = 14; S32_AT(0x220 + 4) = 22; U8_AT(0x220 + 8) = 2; U32_AT(0x220 + 0x0C) = 0x02; U32_AT(0x220 + 0x10) = v2;
      S32_AT(0x240) = 32; S32_AT(0x240 + 4) = 40; U8_AT(0x240 + 8) = 3; U32_AT(0x240 + 0x0C) = 0x04; U32_AT(0x240 + 0x10) = v0;
    } else if (c == 2) {
      S32_AT(0x200) = 8;  S32_AT(0x200 + 4) = 16; U8_AT(0x200 + 8) = 1; U32_AT(0x200 + 0x0C) = 0x01; U32_AT(0x200 + 0x10) = v1;
      S32_AT(0x220) = 32; S32_AT(0x220 + 4) = 40; U8_AT(0x220 + 8) = 2; U32_AT(0x220 + 0x0C) = 0x02; U32_AT(0x220 + 0x10) = v2;
      S32_AT(0x240) = 12; S32_AT(0x240 + 4) = 19; U8_AT(0x240 + 8) = 3; U32_AT(0x240 + 0x0C) = 0x04; U32_AT(0x240 + 0x10) = v0;
    } else {
      S32_AT(0x200) = -7; S32_AT(0x200 + 4) = -6; U8_AT(0x200 + 8) = 4; U32_AT(0x200 + 0x0C) = 0x10; U32_AT(0x200 + 0x10) = v1;
      S32_AT(0x220) = 0;  S32_AT(0x220 + 4) = 0;  U8_AT(0x220 + 8) = 5; U32_AT(0x220 + 0x0C) = 0x20; U32_AT(0x220 + 0x10) = v2;
      S32_AT(0x240) = 16; S32_AT(0x240 + 4) = 24; U8_AT(0x240 + 8) = 6; U32_AT(0x240 + 0x0C) = 0x40; U32_AT(0x240 + 0x10) = v0;
    }
    track_dwords(ppHead, 4);
    track_dwords(v0, 0x60);
    u32 args[2] = { ppHead, 0xCAFE0007u };
    call_edi_ebx_void((u32)RVA(0x6FD92070), ppHead, 0xCAFE0007u);
    const char *notes[4] = { "distinct_scaled_coords", "collapse_v0_v1", "collapse_v2_v0_updates_head", "negative_trunc_toward_zero_collapse" };
    emit_case(fp, 0x6FD92070u, c, notes[c], args, 2, 0);
  }

  /* 8. 0x6FD9AA90: COLLISION_SplitClipRectByRoomBounds113c (7 cases) */
  {
    struct { int hasGrid; s32 l, t, r, b; const char *note; } cases[7] = {
      { 1, 10, 30, 20, 25, "top_gt_bottom_returns_0" },
      { 1, 25, 10, 20, 30, "left_gt_right_returns_0" },
      { 0, 10, 10, 20, 20, "null_coll_grid_returns_0" },
      { 1, 12, 22, 25, 35, "inside_bounds_returns_1" },
      { 1, 12, 22, 35, 35, "overflow_right_returns_2" },
      { 1, 12, 22, 25, 55, "overflow_bottom_returns_2" },
      { 1, 12, 22, 35, 55, "overflow_both_returns_3" },
    };
    for (int c = 0; c < 7; c++) {
      reset_case();
      u32 pRoom = PTR(0x100), pGrid = PTR(0x180), pIn = PTR(0x200), pOut = PTR(0x240);
      U32_AT(0x100 + 0x20) = cases[c].hasGrid ? pGrid : 0u;
      S32_AT(0x180 + 0x00) = 10; S32_AT(0x180 + 0x04) = 20;
      S32_AT(0x180 + 0x08) = 20; S32_AT(0x180 + 0x0C) = 30;
      S32_AT(0x200 + 0x00) = cases[c].l; S32_AT(0x200 + 0x04) = cases[c].t;
      S32_AT(0x200 + 0x08) = cases[c].r; S32_AT(0x200 + 0x0C) = cases[c].b;
      track_dwords(PTR(0x100 + 0x20), 4);
      track_dwords(pGrid, 0x10);
      track_dwords(pIn, 0x10);
      track_dwords(pOut, 0x30);
      u32 args[3] = { pRoom, pIn, pOut };
      u32 eax = call_eax_edx_ecx_u32((u32)RVA(0x6FD9AA90), pRoom, pIn, pOut);
      emit_case(fp, 0x6FD9AA90u, c, cases[c].note, args, 3, eax);
    }
  }

  /* 9..11. 0x6FD9B5F0, 0x6FD9B6B0, 0x6FD9B780: Copy/Clear/OrTileSubtileFlagsToCollGrid113c (4 cases each) */
  {
    u32 vas[3] = { 0x6FD9B5F0u, 0x6FD9B6B0u, 0x6FD9B780u };
    struct { int hasGrid, hasMap; s32 ry, rx; const char *note; } cases[4] = {
      { 0, 0, 1, 1, "null_coll_grid_noop" },
      { 1, 0, 1, 1, "null_map_start_noop" },
      { 1, 1, 1, 2, "interior_5x5_stamp" },
      { 1, 1, -2, -1, "negative_rel_clipped_stamp" },
    };
    for (int f = 0; f < 3; f++) {
      for (int c = 0; c < 4; c++) {
        reset_case();
        u32 pGrid = cases[c].hasGrid ? PTR(0x100) : 0u;
        u32 pMap  = cases[c].hasMap ? PTR(0x400) : 0u;
        u32 pTile = PTR(0x200);
        if (cases[c].hasGrid) {
          S32_AT(0x100 + 0x08) = 10;
          U32_AT(0x100 + 0x20) = pMap;
          track_dwords(PTR(0x100), 0x24);
        }
        if (cases[c].hasMap) {
          for (int i = 0; i < 100; i++) U16_AT(0x400 + i * 2) = 0x00F0u;
          track_dwords(pMap, 0x100);
        }
        for (int i = 0; i < 25; i++) U8_AT(0x200 + 0x28 + i) = (u8)((i + 1) * 3);
        track_dwords(PTR(0x200 + 0x28), 0x1C);
        u32 args[4] = { (u32)cases[c].ry, (u32)cases[c].rx, pGrid, pTile };
        call_eax_ecx_stk2_void((u32)RVA(vas[f]), (u32)cases[c].ry, (u32)cases[c].rx, pGrid, pTile);
        emit_case(fp, vas[f], c, cases[c].note, args, 4, 0);
      }
    }
  }

  /* 12. 0x6FDBC520: DATATBLS_FindWallTileCacheEntry113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pTable = PTR(0x200);
    *(u32 *)RVA(0x6FDF1434) = pTable;
    *(s32 *)RVA(0x6FDF1438) = 4;
    s32 ids[4] = { 101, 202, -55, 999 };
    for (int i = 0; i < 4; i++) S32_AT(0x200 + i * 0x1C) = ids[i];
    track_dwords((u32)RVA(0x6FDF1434), 8);
    track_dwords(pTable, 4 * 0x1C);
    u32 args[1] = { (u32)ids[c] };
    u32 eax = call_edi_u32((u32)RVA(0x6FDBC520), (u32)ids[c]);
    const char *notes[4] = { "match_idx0", "match_idx1", "match_idx2_neg", "match_idx3_last" };
    emit_case(fp, 0x6FDBC520u, c, notes[c], args, 1, eax);
  }

  /* 13. 0x6FDCE390: COLLISION_InitBoundingBox113c (4 cases) */
  {
    fn_std3_void_t fn = (fn_std3_void_t)RVA(0x6FDCE390);
    s32 coords[4][2] = { { 0, 0 }, { 100, 200 }, { -50, 75 }, { -1234, -5678 } };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pBox = PTR(0x100);
      memset(MEM(0x100), 0x55, 0x10);
      track_dwords(pBox, 0x10);
      u32 args[3] = { pBox, (u32)coords[c][0], (u32)coords[c][1] };
      fn(pBox, (u32)coords[c][0], (u32)coords[c][1]);
      emit_case(fp, 0x6FDCE390u, c, "init_bounding_box", args, 3, 0);
    }
  }

  /* 14. 0x6FDD10A0: DRLGLOGIC_GetRoomCoordListAtSubtile113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pRoomEx = PTR(0x100), pCoords = PTR(0x200), pRows = PTR(0x300), pCells = PTR(0x400);
    S32_AT(0x100 + 0x34) = 10; S32_AT(0x100 + 0x38) = 20;
    U32_AT(0x100 + 0x64) = pCoords;
    U32_AT(0x200 + 0x00) = (c == 0) ? 1u : 0u;
    U32_AT(0x200 + 0x1C) = pCells;
    U32_AT(0x200 + 0x20) = pRows;
    U32_AT(0x200 + 0x30) = PTR(0x800);
    for (int r = 0; r < 4; r++) S32_AT(0x300 + r * 4) = r * 4;
    for (int k = 0; k < 16; k++) U32_AT(0x400 + k * 4) = PTR(0x900 + k * 0x30);
    track_dwords(PTR(0x100 + 0x34), 8);
    track_dwords(PTR(0x100 + 0x64), 4);
    track_dwords(pCoords, 0x34);
    track_dwords(pRows, 0x10);
    track_dwords(pCells, 0x40);
    s32 ty = 20 + (c % 3), tx = 10 + c;
    u32 args[3] = { pRoomEx, (u32)ty, (u32)tx };
    u32 eax = call_edx_ecx_stk1_u32((u32)RVA(0x6FDD10A0), pRoomEx, (u32)ty, (u32)tx);
    const char *notes[4] = { "flag1_returns_head", "grid_lookup_1", "grid_lookup_2", "grid_lookup_3" };
    emit_case(fp, 0x6FDD10A0u, c, notes[c], args, 3, eax);
  }

  /* 15. 0x6FDD1100: DRLGLOGIC_AllocSingleRoomCoordList113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pRoomEx = PTR(0x100), pLevel = PTR(0x200), pDrlg = PTR(0x400);
    S32_AT(0x100 + 0x34) = 10 * (c + 1);
    S32_AT(0x100 + 0x38) = 20 * (c + 1);
    S32_AT(0x100 + 0x3C) = 8 + c;
    S32_AT(0x100 + 0x40) = 12 + c;
    U32_AT(0x100 + 0x58) = pLevel;
    U32_AT(0x200 + 0x1B4) = pDrlg;
    U32_AT(0x400 + 0x478) = 0xCAFE0015u;
    track_dwords(PTR(0x100 + 0x34), 0x10);
    track_dwords(PTR(0x100 + 0x58), 4);
    track_dwords(PTR(0x100 + 0x64), 4);
    track_dwords(PTR(0x200 + 0x1B4), 4);
    track_dwords(PTR(0x200 + 0x1DC), 4);
    track_dwords(PTR(0x400 + 0x478), 4);
    u32 args[1] = { pRoomEx };
    call_ebx_void((u32)RVA(0x6FDD1100), pRoomEx);
    emit_case(fp, 0x6FDD1100u, c, "alloc_single_room_coord_list", args, 1, 0);
  }

  /* 16. 0x6FDD1950: DRLGLOGIC_GetRoomCoordListFromWorldSubtile113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pRoomEx = PTR(0x100), pCoords = PTR(0x200), pRows = PTR(0x300), pCells = PTR(0x400);
    S32_AT(0x100 + 0x34) = 10; S32_AT(0x100 + 0x38) = 20;
    U32_AT(0x100 + 0x64) = pCoords;
    U32_AT(0x200 + 0x00) = (c == 0) ? 1u : 0u;
    U32_AT(0x200 + 0x1C) = pCells;
    U32_AT(0x200 + 0x20) = pRows;
    U32_AT(0x200 + 0x30) = PTR(0x800);
    for (int r = 0; r < 4; r++) S32_AT(0x300 + r * 4) = r * 4;
    for (int k = 0; k < 16; k++) U32_AT(0x400 + k * 4) = PTR(0x900 + k * 0x30);
    track_dwords(PTR(0x100 + 0x34), 8);
    track_dwords(PTR(0x100 + 0x64), 4);
    track_dwords(pCoords, 0x34);
    track_dwords(pRows, 0x10);
    track_dwords(pCells, 0x40);
    s32 wx = (10 + c) * 5 + 3, wy = (20 + (c % 3)) * 5 + 4;
    u32 args[3] = { pRoomEx, (u32)wx, (u32)wy };
    u32 eax = call_esi_stk2_u32((u32)RVA(0x6FDD1950), pRoomEx, (u32)wx, (u32)wy);
    const char *notes[4] = { "flag1_returns_head", "world_subtile_1", "world_subtile_2", "world_subtile_3" };
    emit_case(fp, 0x6FDD1950u, c, notes[c], args, 3, eax);
  }

  /* 17. 0x6FDD19C0: DRLGLOGIC_GetRoomCoordListIndexAtSubtile113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pRoomEx = PTR(0x100), pCoords = PTR(0x200), pRows = PTR(0x300), pCells = PTR(0x400), pN0 = PTR(0x800), pN1 = PTR(0x840);
    S32_AT(0x100 + 0x34) = 10; S32_AT(0x100 + 0x38) = 20;
    U32_AT(0x100 + 0x64) = pCoords;
    U32_AT(0x200 + 0x00) = (c < 2) ? 1u : 0u;
    U32_AT(0x200 + 0x1C) = pCells;
    U32_AT(0x200 + 0x20) = pRows;
    U32_AT(0x200 + 0x30) = (c == 0) ? pN0 : 0u;
    S32_AT(0x300 + 0x04) = 4;
    U32_AT(0x400 + 5 * 4) = (c == 2) ? pN1 : 0u;
    S32_AT(0x800 + 0x28) = 7;
    S32_AT(0x840 + 0x28) = 42;
    track_dwords(PTR(0x100 + 0x34), 8);
    track_dwords(PTR(0x100 + 0x64), 4);
    track_dwords(pCoords, 0x34);
    track_dwords(pRows, 0x10);
    track_dwords(pCells, 0x40);
    track_dwords(PTR(0x800 + 0x28), 4);
    track_dwords(PTR(0x840 + 0x28), 4);
    u32 args[3] = { pRoomEx, 21u, 11u };
    u32 eax = call_edx_ecx_stk1_u32((u32)RVA(0x6FDD19C0), pRoomEx, 21u, 11u);
    const char *notes[4] = { "flag1_nonnull_idx7", "flag1_null_neg1", "grid_nonnull_idx42", "grid_null_neg1" };
    emit_case(fp, 0x6FDD19C0u, c, notes[c], args, 3, eax);
  }
}

static void __attribute__((fastcall)) stat_enum_cb(u32 ecx_pUnit, u32 edx_nStatId, s32 nValue, u32 pArg) {
  if (pArg != 0) {
    u32 nCalls = *(u32 *)(uintptr_t)pArg;
    u32 *base = (u32 *)(uintptr_t)(pArg + 4u + nCalls * 12u);
    base[0] = ecx_pUnit;
    base[1] = edx_nStatId;
    base[2] = (u32)nValue;
    *(u32 *)(uintptr_t)pArg = nCalls + 1u;
  }
}

static void emit_b044(FILE *fp) {
  fn_std3_void_t fn = (fn_std3_void_t)RVA(0x6FD88850);
  for (int c = 0; c < 6; c++) {
    reset_case();
    /* Write jmp rel32 to stat_enum_cb at PTR(0x50) so callback addr is fixed 0x10000050 */
    u32 cbTramp = PTR(0x50);
    U8_AT(0x50) = 0xE9u;
    *(s32 *)MEM(0x51) = (s32)((uintptr_t)stat_enum_cb - (uintptr_t)(cbTramp + 5u));

    u32 pUnit = (c == 0) ? 0u : PTR(0x100);
    u32 pArg  = (c == 1) ? 0u : PTR(0x500);
    u32 pfCb  = cbTramp;
    u32 pSlEx = (c == 2) ? 0u : PTR(0x200);
    u32 pStats = PTR(0x300);
    u32 pKeys  = PTR(0x400);

    U32_AT(0x100 + 0x5C) = pSlEx;
    U32_AT(0x200 + 0x10) = (c == 3) ? 0x00000040u : 0x80000000u;
    U32_AT(0x200 + 0x24) = pStats;
    U16_AT(0x200 + 0x28) = 2u;
    U32_AT(0x200 + 0x50) = pKeys;
    S16_AT(0x200 + 0x54) = (c == 4) ? 0 : 3;

    /* FullStats sorted by packed key: [0] = (stat 7 << 16) | 0, val=123; [1] = (stat 12 << 16) | 1, val=-45 */
    U32_AT(0x300 + 0x00) = (7u << 16) | 0u;  S32_AT(0x300 + 0x04) = 123;
    U32_AT(0x300 + 0x08) = (12u << 16) | 1u; S32_AT(0x300 + 0x0C) = -45;

    /* CopyList keys: [0] matches idx 0, [1] misses (stat 99), [2] matches idx 1 */
    U32_AT(0x400 + 0x00) = (7u << 16) | 0u;
    U32_AT(0x400 + 0x04) = (99u << 16) | 0u;
    U32_AT(0x400 + 0x08) = (12u << 16) | 1u;

    track_dwords(PTR(0x100 + 0x5C), 4);
    track_dwords(PTR(0x200), 0x58);
    track_dwords(pStats, 0x10);
    track_dwords(pKeys, 0x10);
    track_dwords(PTR(0x500), 0x30);

    u32 args[3] = { pUnit, pArg, pfCb };
    fn(pUnit, pArg, pfCb);
    const char *notes[6] = {
      "null_unit_noop", "null_arg_nonnull_cb_noop", "null_statlist_noop",
      "non_extended_statlist_noop", "zero_copy_count_noop", "enumerates_found_and_missing_keys"
    };
    emit_case(fp, 0x6FD88850u, c, notes[c], args, 3, 0);
  }
}

static void emit_b047(FILE *fp) {
  /* 1. 0x6FD87660: ENV_StepCycle113c (5 cases) */
  {
    fn_std2_u32_t fn = (fn_std2_u32_t)RVA(0x6FD87660);
    struct { int hasEnv; s32 act, idx, period, ticks, rate, ecl, prevDeg; const char *note; } cases[5] = {
      { 0, 0, 0, 0, 0,     128, 0, 0,  "null_env_returns_0" },
      { 1, 0, 2, 0, 1280,  128, 0, 5,  "normal_step_small_diff_returns_0" },
      { 1, 0, 2, 0, 3840,  128, 0, 5,  "positive_diff_gt_16_updates_prevDeg_returns_1" },
      { 1, 0, 2, 0, 256,   128, 0, 25, "negative_diff_gt_16_updates_prevDeg_returns_1" },
      { 1, 0, 2, 0, 20480, 128, 0, 155,"threshold_cross_advances_cycle_returns_1" },
    };
    for (int c = 0; c < 5; c++) {
      reset_case();
      u32 pAct = PTR(0x100), pEnv = cases[c].hasEnv ? PTR(0x140) : 0u;
      U32_AT(0x100 + 0x04) = pEnv;
      if (cases[c].hasEnv) {
        S32_AT(0x140 + 0x00) = cases[c].idx;
        S32_AT(0x140 + 0x04) = cases[c].period;
        S32_AT(0x140 + 0x08) = cases[c].ticks;
        S32_AT(0x140 + 0x28) = cases[c].rate;
        S32_AT(0x140 + 0x30) = cases[c].ecl;
        S32_AT(0x140 + 0x34) = cases[c].prevDeg;
        track_dwords(pEnv, 0x38);
      }
      track_dwords(PTR(0x100 + 0x04), 4);
      u32 args[2] = { pAct, (u32)cases[c].act };
      u32 eax = fn(pAct, (u32)cases[c].act);
      emit_case(fp, 0x6FD87660u, c, cases[c].note, args, 2, eax);
    }
  }

  /* 2. 0x6FD87BA0: ENV_AllocDrlgEnvironment113c (4 cases) */
  {
    u32 ticks[4] = { 0u, 123456u, 0xABCDEF01u, 999999u };
    for (int c = 0; c < 4; c++) {
      reset_case();
      g_mock_tick_count = ticks[c];
      *(u32 *)RVA(0x6FDD91FC) = g_mock_tick_count;
      track_dwords((u32)RVA(0x6FDD91FC), 4);
      *(uintptr_t *)RVA(0x6FDD91FC) = (uintptr_t)stub_get_tick_count;
      u32 args[1] = { 0xCAFE0047u };
      u32 eax = call_ecx_u32((u32)RVA(0x6FD87BA0), 0xCAFE0047u);
      *(u32 *)RVA(0x6FDD91FC) = g_mock_tick_count;
      emit_case(fp, 0x6FD87BA0u, c, "alloc_drlg_environment", args, 1, eax);
    }
  }

  /* 3. 0x6FD87C20: ENV_ResetDefaultEnvironment113c (4 cases) */
  {
    fn_std1_void_t fn = (fn_std1_void_t)RVA(0x6FD87C20);
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pAct = PTR(0x100), pEnv = PTR(0x140);
      U32_AT(0x100 + 0x04) = pEnv;
      S32_AT(0x140 + 0x00) = c;
      S32_AT(0x140 + 0x04) = 3;
      S32_AT(0x140 + 0x08) = 5000 * (c + 1);
      S32_AT(0x140 + 0x0C) = 40;
      S32_AT(0x140 + 0x28) = 4;
      S32_AT(0x140 + 0x2C) = 1;
      S32_AT(0x140 + 0x30) = (c & 1);
      track_dwords(PTR(0x100 + 0x04), 4);
      track_dwords(pEnv, 0x38);
      u32 args[1] = { pAct };
      fn(pAct);
      emit_case(fp, 0x6FD87C20u, c, "reset_default_environment", args, 1, 0);
    }
  }

  /* 4. 0x6FD87CA0: ENV_InitEclipseEnvironment113c (4 cases) */
  {
    fn_std1_void_t fn = (fn_std1_void_t)RVA(0x6FD87CA0);
    s32 initCur[4] = { 100, 20, 36, 200 };
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pAct = PTR(0x100), pEnv = PTR(0x140);
      U32_AT(0x100 + 0x04) = pEnv;
      S32_AT(0x140 + 0x0C) = initCur[c];
      S32_AT(0x140 + 0x30) = (c & 1);
      track_dwords(PTR(0x100 + 0x04), 4);
      track_dwords(pEnv, 0x38);
      u32 args[1] = { pAct };
      fn(pAct);
      emit_case(fp, 0x6FD87CA0u, c, "init_eclipse_environment", args, 1, 0);
    }
  }

  /* 5. 0x6FD8BDD0: DUNGEON_SortRoomClientArray113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pRoom = PTR(0x100), pArr = PTR(0x200);
    U32_AT(0x100 + 0x48) = pArr;
    if (c == 0) {
      U32_AT(0x100 + 0x78) = 0u;
    } else if (c == 1) {
      U32_AT(0x100 + 0x78) = 1u;
      U32_AT(0x200 + 0x00) = 0x3000u;
    } else if (c == 2) {
      U32_AT(0x100 + 0x78) = 3u;
      U32_AT(0x200 + 0x00) = 0x1000u; U32_AT(0x200 + 0x04) = 0x2000u; U32_AT(0x200 + 0x08) = 0x3000u;
    } else {
      U32_AT(0x100 + 0x78) = 4u;
      U32_AT(0x200 + 0x00) = 0x90000000u; U32_AT(0x200 + 0x04) = 0x4000u;
      U32_AT(0x200 + 0x08) = 0x2000u;     U32_AT(0x200 + 0x0C) = 0x1000u;
    }
    track_dwords(pRoom, 0x80);
    track_dwords(pArr, 0x10);
    u32 args[1] = { pRoom };
    call_eax_void((u32)RVA(0x6FD8BDD0), pRoom);
    const char *notes[4] = { "zero_clients", "one_client", "already_sorted_early_exit", "reverse_sorted_full_passes" };
    emit_case(fp, 0x6FD8BDD0u, c, notes[c], args, 1, 0);
  }

  /* 6. 0x6FD8C200: DUNGEON_AllocAndBuildRoomNeighborList113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pRoom = PTR(0x100), pRoomEx = PTR(0x200), ppExNear = PTR(0x300);
    u32 pN1 = PTR(0x400), pN1Ex = PTR(0x500), ppN1ExNear = PTR(0x600), ppN1Out = PTR(0x700);
    u32 pEmptyEx = PTR(0x800);
    U32_AT(0x100 + 0x10) = pRoomEx;
    U32_AT(0x200 + 0x08) = ppExNear;
    U32_AT(0x200 + 0x30) = pRoom;
    U32_AT(0x400 + 0x00) = ppN1Out;
    U32_AT(0x400 + 0x10) = pN1Ex;
    U32_AT(0x500 + 0x08) = ppN1ExNear;
    U32_AT(0x500 + 0x2C) = 1u;
    U32_AT(0x500 + 0x30) = pN1;
    U32_AT(0x600 + 0x00) = pN1Ex;
    if (c == 0) {
      U32_AT(0x200 + 0x2C) = 0u;
    } else if (c == 1) {
      U32_AT(0x200 + 0x2C) = 1u;
      U32_AT(0x300 + 0x00) = pRoomEx;
    } else if (c == 2) {
      U32_AT(0x200 + 0x2C) = 2u;
      U32_AT(0x300 + 0x00) = pRoomEx;
      U32_AT(0x300 + 0x04) = pEmptyEx;
    } else {
      U32_AT(0x200 + 0x2C) = 2u;
      U32_AT(0x300 + 0x00) = pRoomEx;
      U32_AT(0x300 + 0x04) = pN1Ex;
    }
    track_dwords(pRoom, 0x30);
    track_dwords(pRoomEx, 0x38);
    track_dwords(ppExNear, 0x10);
    track_dwords(pN1, 0x30);
    track_dwords(pN1Ex, 0x38);
    track_dwords(ppN1ExNear, 0x08);
    track_dwords(ppN1Out, 0x08);
    track_dwords(pEmptyEx, 0x38);
    u32 args[2] = { pRoom, 0xCAFE0006u };
    call_esi_ecx_void((u32)RVA(0x6FD8C200), pRoom, 0xCAFE0006u);
    const char *notes[4] = { "zero_near", "self_only", "self_and_null_room1", "self_and_distinct_neighbor" };
    emit_case(fp, 0x6FD8C200u, c, notes[c], args, 2, 0);
  }

  /* 7. 0x6FD8C870: DUNGEON_FreeRoomAndDetachUnits113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pRoom = PTR(0x100), pAct = PTR(0x180), pGrid = PTR(0x200), pPortal = PTR(0x240);
    u32 pClients = PTR(0x280), ppNear = PTR(0x2C0), pUnit0 = PTR(0x300), pPath0 = PTR(0x400);
    U32_AT(0x100 + 0x00) = ppNear;
    U32_AT(0x100 + 0x18) = (c == 1) ? pPortal : 0u;
    U32_AT(0x100 + 0x20) = (c == 0) ? 0u : pGrid;
    U32_AT(0x100 + 0x2C) = pAct;
    U32_AT(0x100 + 0x48) = (c == 0) ? 0u : pClients;
    U32_AT(0x180 + 0x5C) = 0xCAFE0007u;
    if (c == 2) {
      /* Static unit (type 2 object) */
      U32_AT(0x100 + 0x74) = pUnit0;
      U32_AT(0x300 + 0x00) = 2u;
      U32_AT(0x300 + 0x2C) = pPath0;
      U32_AT(0x300 + 0xC4) = 0x00000000u; /* client bit 22 clear -> sets 0x20 on +0xC8 */
      U32_AT(0x400 + 0x00) = pRoom;
    } else if (c == 3) {
      /* Dynamic unit (type 3 missile) */
      U32_AT(0x100 + 0x74) = pUnit0;
      U32_AT(0x300 + 0x00) = 3u;
      U32_AT(0x300 + 0x2C) = pPath0;
      U32_AT(0x300 + 0xC4) = 0x00400000u; /* client bit 22 set */
      U32_AT(0x400 + 0x1C) = pRoom;
      U32_AT(0x400 + 0x30) = pUnit0;
    }
    track_dwords(pRoom, 0x80);
    track_dwords(pAct, 0x60);
    track_dwords(pPortal, 0x10);
    track_dwords(pUnit0, 0xF4);
    track_dwords(pPath0, 0x40);
    track_dwords((u32)RVA(0x6FDDD458), 8);
    u32 args[2] = { pRoom, 0xCAFE0007u };
    call_edi_stk1_void((u32)RVA(0x6FD8C870), pRoom, 0xCAFE0007u);
    const char *notes[4] = { "empty_room_no_grid_or_clients", "room_with_portal_grid_clients", "detach_static_object_unit", "detach_dynamic_missile_unit" };
    emit_case(fp, 0x6FD8C870u, c, notes[c], args, 2, 0);
  }

  /* 8. 0x6FD94A30: DRLGROOM_AppendAndSortAdjacentRoom113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pRoomEx = PTR(0x100), pOld = PTR(0x200), r0 = PTR(0x300), r1 = PTR(0x400), r2 = PTR(0x500);
    S32_AT(0x300 + 0x34) = 30; S32_AT(0x300 + 0x38) = 30; S32_AT(0x300 + 0x3C) = 5; S32_AT(0x300 + 0x40) = 5;
    S32_AT(0x400 + 0x34) = 10; S32_AT(0x400 + 0x38) = 10; S32_AT(0x400 + 0x3C) = 5; S32_AT(0x400 + 0x40) = 5;
    S32_AT(0x500 + 0x34) = 20; S32_AT(0x500 + 0x38) = 20; S32_AT(0x500 + 0x3C) = 5; S32_AT(0x500 + 0x40) = 5;
    if (c == 0) {
      U32_AT(0x100 + 0x08) = 0u; U32_AT(0x100 + 0x2C) = 0u;
    } else {
      U32_AT(0x100 + 0x08) = pOld; U32_AT(0x100 + 0x2C) = (u32)c;
      U32_AT(0x200 + 0x00) = r0;
      if (c >= 2) U32_AT(0x200 + 0x04) = r2;
      if (c >= 3) U32_AT(0x200 + 0x08) = r0;
    }
    track_dwords(pRoomEx, 0x38);
    track_dwords(pOld, 0x10);
    track_dwords(r0, 0x48);
    track_dwords(r1, 0x48);
    track_dwords(r2, 0x48);
    u32 args[3] = { pRoomEx, 0xCAFE0008u, r1 };
    call_eax_ecx_stk1_void((u32)RVA(0x6FD94A30), pRoomEx, 0xCAFE0008u, r1);
    const char *notes[4] = { "append_to_empty", "append_second_and_sort", "append_third_and_sort", "append_fourth_and_sort" };
    emit_case(fp, 0x6FD94A30u, c, notes[c], args, 3, 0);
  }

  /* 9. 0x6FD94DF0: DRLGROOM_BuildRoomExNearList113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pRoomEx = PTR(0x100), pLevel = PTR(0x200), r1 = PTR(0x300), r2 = PTR(0x400), r3 = PTR(0x500);
    S32_AT(0x100 + 0x34) = 20; S32_AT(0x100 + 0x38) = 20; S32_AT(0x100 + 0x3C) = 5; S32_AT(0x100 + 0x40) = 5;
    U32_AT(0x100 + 0x58) = pLevel;
    /* r1: x2=28 (>x1, gapX=3), y2=28 (>y1, gapY=3) */
    S32_AT(0x300 + 0x34) = 28; S32_AT(0x300 + 0x38) = 28; S32_AT(0x300 + 0x3C) = 5; S32_AT(0x300 + 0x40) = 5;
    /* r2: x2=12 (<x1, gapX=3), y2=12 (<y1, gapY=3) */
    S32_AT(0x400 + 0x34) = 12; S32_AT(0x400 + 0x38) = 12; S32_AT(0x400 + 0x3C) = 5; S32_AT(0x400 + 0x40) = 5;
    /* r3: far or close depending on c */
    S32_AT(0x500 + 0x34) = (c == 2) ? 50 : 20;
    S32_AT(0x500 + 0x38) = (c == 3) ? 50 : 20;
    S32_AT(0x500 + 0x3C) = 5; S32_AT(0x500 + 0x40) = 5;
    if (c == 0) {
      U32_AT(0x200 + 0x10) = 0u;
    } else {
      U32_AT(0x200 + 0x10) = r1;
      U32_AT(0x300 + 0x24) = r2;
      U32_AT(0x400 + 0x24) = r3;
      U32_AT(0x500 + 0x24) = 0u;
    }
    track_dwords(pRoomEx, 0x60);
    track_dwords(PTR(0x200 + 0x10), 4);
    track_dwords(r1, 0x48);
    track_dwords(r2, 0x48);
    track_dwords(r3, 0x48);
    u32 args[2] = { pRoomEx, 0xCAFE0009u };
    call_edi_stk1_void((u32)RVA(0x6FD94DF0), pRoomEx, 0xCAFE0009u);
    const char *notes[4] = { "empty_level_rooms", "all_three_near_and_sorted", "skip_far_x_room", "skip_far_y_room" };
    emit_case(fp, 0x6FD94DF0u, c, notes[c], args, 2, 0);
  }

  /* 10. 0x6FD95240: DRLGROOM_AllocRoomTileWindowNode113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pRoomEx = PTR(0x100), pLevel = PTR(0x200), pDrlg = PTR(0x400), pPreset = PTR(0x900), pCache = PTR(0xA00);
    U32_AT(0x100 + 0x4C) = (c & 1) ? PTR(0x880) : 0u;
    U32_AT(0x100 + 0x58) = pLevel;
    U32_AT(0x200 + 0x1B4) = pDrlg;
    S32_AT(0x200 + 0x1D0) = 5;
    U32_AT(0x400 + 0x90) = pPreset;
    U32_AT(0x400 + 0x478) = 0xCAFE0010u;
    S32_AT(0x900 + 0x00) = 5;
    U32_AT(0x900 + 0x44) = 0u;
    for (int i = 0; i < 4; i++) S32_AT(0x900 + 0x24 + i * 4) = 100 + i;
    *(u32 *)RVA(0x6FDF142C) = pCache;
    *(s32 *)RVA(0x6FDF1430) = 4;
    for (int i = 0; i < 4; i++) {
      S32_AT(0xA00 + i * 0x30) = 100 + i;
      U8_AT(0xA00 + i * 0x30 + 0x2C) = 0x62u;
    }
    track_dwords(pRoomEx, 0x60);
    track_dwords(PTR(0x200 + 0x1B4), 0x20);
    track_dwords(PTR(0x400 + 0x90), 4);
    track_dwords(PTR(0x400 + 0x478), 4);
    track_dwords(pPreset, 0x48);
    track_dwords(pCache, 4 * 0x30);
    track_dwords((u32)RVA(0x6FDF142C), 8);
    u32 args[3] = { pRoomEx, 0x11223344u + (u32)c, (u32)c };
    call_edi_stk2_void((u32)RVA(0x6FD95240), pRoomEx, args[1], args[2]);
    emit_case(fp, 0x6FD95240u, c, "alloc_window_node", args, 3, 0);
  }

  /* 11. 0x6FD9CA90: COLLISION_StampRoomTileGridToCollGrid113c (5 cases) */
  for (int c = 0; c < 5; c++) {
    reset_case();
    u32 pTiles = PTR(0x100), pGrid = PTR(0x300), pCoords = PTR(0x340), pMap = PTR(0x400), pLib = PTR(0x600);
    S32_AT(0x300 + 0x00) = 50; S32_AT(0x300 + 0x04) = 100;
    S32_AT(0x300 + 0x08) = 20; S32_AT(0x300 + 0x0C) = 20;
    U32_AT(0x300 + 0x20) = pMap;
    S32_AT(0x340 + 0x10) = 10; S32_AT(0x340 + 0x14) = 20;
    for (int i = 0; i < 25; i++) U8_AT(0x600 + 0x28 + i) = 0x03u;
    for (int i = 0; i < 200; i++) U16_AT(0x400 + i * 2) = 0x0020u;
    s32 nCount = (c == 0) ? 0 : 2;
    s32 bCopy  = (c == 1) ? 1 : 0;
    /* Tile 0: inside (tileX=11 -> subX=55, tileY=21 -> subY=105) */
    S32_AT(0x100 + 0x08) = (c == 3) ? -2 : 1;
    S32_AT(0x100 + 0x0C) = (c == 4) ? 10 : 1;
    U32_AT(0x100 + 0x14) = (c == 1) ? 0x02u : (c == 2) ? 0x40u : 0x80u;
    U32_AT(0x100 + 0x18) = pLib;
    /* Tile 1: second tile */
    S32_AT(0x130 + 0x08) = (c == 3) ? 10 : 2;
    S32_AT(0x130 + 0x0C) = (c == 4) ? -2 : 2;
    U32_AT(0x130 + 0x14) = (c == 2) ? 0xC2u : 0x00u;
    U32_AT(0x130 + 0x18) = pLib;
    track_dwords(pTiles, 0x60);
    track_dwords(pGrid, 0x24);
    track_dwords(pCoords, 0x20);
    track_dwords(pMap, 0x320);
    track_dwords(PTR(0x600 + 0x28), 0x1C);
    u32 args[5] = { pTiles, pGrid, pCoords, (u32)nCount, (u32)bCopy };
    call_ecx_esi_stk3_void((u32)RVA(0x6FD9CA90), pTiles, pGrid, pCoords, (u32)nCount, (u32)bCopy);
    const char *notes[5] = { "count0_noop", "copy_mode_flag02", "or_mode_flags40_and_C2", "oob_x_clipped", "oob_y_clipped" };
    emit_case(fp, 0x6FD9CA90u, c, notes[c], args, 5, 0);
  }

  /* 12. 0x6FDB8510: DRLGROOMTILE_FreeRoomTileGridAndAnimList113c (4 cases) */
  {
    fn_std1_void_t fn = (fn_std1_void_t)RVA(0x6FDB8510);
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx = PTR(0x100), pLevel = PTR(0x200), pDrlg = PTR(0x400), pGrid = PTR(0x900);
      u32 a0 = PTR(0x940), a1 = PTR(0x960), w0 = PTR(0x980), w1 = PTR(0x9A0);
      U32_AT(0x100 + 0x54) = (c == 0) ? 0u : pGrid;
      U32_AT(0x100 + 0x58) = pLevel;
      U32_AT(0x200 + 0x1B4) = pDrlg;
      U32_AT(0x400 + 0x478) = 0xCAFE0012u;
      if (c >= 1) {
        U32_AT(0x900 + 0x14) = PTR(0xA00);
        U32_AT(0x900 + 0x1C) = PTR(0xA40);
        U32_AT(0x900 + 0x24) = PTR(0xA80);
      }
      if (c >= 2) {
        U32_AT(0x900 + 0x00) = a0; U32_AT(0x940 + 0x08) = a1; U32_AT(0x960 + 0x08) = 0u;
        U32_AT(0x900 + 0x04) = w0; U32_AT(0x980 + 0x00) = PTR(0xAC0); U32_AT(0x980 + 0x10) = (c == 3) ? w1 : 0u;
        U32_AT(0x9A0 + 0x00) = PTR(0xAE0); U32_AT(0x9A0 + 0x10) = 0u;
      }
      track_dwords(pRoomEx, 0x60);
      track_dwords(PTR(0x200 + 0x1B4), 4);
      track_dwords(PTR(0x400 + 0x478), 4);
      track_dwords(pGrid, 0xC0);
      u32 args[1] = { pRoomEx };
      fn(pRoomEx);
      const char *notes[4] = { "null_tile_grid", "grid_arrays_only", "grid_with_anim_and_wall_nodes", "grid_with_two_wall_nodes" };
      emit_case(fp, 0x6FDB8510u, c, notes[c], args, 1, 0);
    }
  }

  /* 13. 0x6FDB8800: DRLGROOMTILE_UpdateWindowTileCacheEntry113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pNode = PTR(0x100), pCache = PTR(0x200);
    *(u32 *)RVA(0x6FDF142C) = pCache;
    *(s32 *)RVA(0x6FDF1430) = 3;
    S32_AT(0x200 + 0 * 0x30) = 77; U8_AT(0x200 + 0 * 0x30 + 0x2C) = 0x62u; /* 'b' */
    S32_AT(0x200 + 1 * 0x30) = 77; U8_AT(0x200 + 1 * 0x30 + 0x2C) = 0x6Cu; /* 'l' */
    S32_AT(0x200 + 2 * 0x30) = 77; U8_AT(0x200 + 2 * 0x30 + 0x2C) = 0x72u; /* 'r' */
    U32_AT(0x100 + 0x10) = pCache + (u32)((c == 0) ? 0 : (c == 2) ? 2 : 1) * 0x30u;
    s32 orient = (c == 1) ? 0x0B : 5;
    track_dwords(pNode, 0x18);
    track_dwords(pCache, 3 * 0x30);
    track_dwords((u32)RVA(0x6FDF142C), 8);
    u32 args[2] = { pNode, (u32)orient };
    call_esi_stk1_void((u32)RVA(0x6FDB8800), pNode, (u32)orient);
    const char *notes[4] = { "type_b_early_return", "orient_11_switches_l_to_r", "orient_5_switches_r_to_l", "orient_5_already_l_noop" };
    emit_case(fp, 0x6FDB8800u, c, notes[c], args, 2, 0);
  }

  /* 14. 0x6FDCBA00: DUNGEON_ShouldDeactivateRoomEx113c (6 cases) */
  {
    struct { u32 flags; u8 status, r2Status; s32 lvl; const char *note; } cases[6] = {
      { 0x00400000u, 2, 2, 2,   "has_portal_flag_returns_0" },
      { 0x00000000u, 1, 2, 2,   "status_le_1_returns_0" },
      { 0x00000000u, 2, 1, 2,   "non_town_status_2_returns_1" },
      { 0x00000000u, 2, 2, 1,   "town_all_rooms_gt_1_returns_1" },
      { 0x00000000u, 2, 1, 1,   "town_peer_room_le_1_returns_0" },
      { 0x00000000u, 2, 2, 120, "arreat_summit_all_gt_1_returns_1" },
    };
    for (int c = 0; c < 6; c++) {
      reset_case();
      u32 pRoomEx = PTR(0x100), pR2 = PTR(0x200), pLevel = PTR(0x300), pDrlg = PTR(0x500);
      U32_AT(0x100 + 0x24) = pR2;
      U32_AT(0x100 + 0x28) = cases[c].flags;
      U8_AT(0x100 + 0x44)  = cases[c].status;
      U32_AT(0x100 + 0x58) = pLevel;
      U32_AT(0x200 + 0x24) = 0u;
      U8_AT(0x200 + 0x44)  = cases[c].r2Status;
      U32_AT(0x300 + 0x10) = pRoomEx;
      U32_AT(0x300 + 0x1B4) = pDrlg;
      S32_AT(0x300 + 0x1D0) = cases[c].lvl;
      U8_AT(0x500 + 0x8C) = 0u;
      track_dwords(pRoomEx, 0x60);
      track_dwords(pR2, 0x50);
      track_dwords(PTR(0x300 + 0x10), 4);
      track_dwords(PTR(0x300 + 0x1B4), 0x20);
      track_dwords(PTR(0x500 + 0x8C), 4);
      u32 args[1] = { pRoomEx };
      u32 eax = call_edx_u32((u32)RVA(0x6FDCBA00), pRoomEx);
      emit_case(fp, 0x6FDCBA00u, c, cases[c].note, args, 1, eax);
    }
  }

  /* 15. 0x6FDD1200: DRLGLOGIC_BuildRoomCoordListRegions113c (4 cases) */
  {
    fn_std2_void_t fn = (fn_std2_void_t)RVA(0x6FDD1200);
    for (int c = 0; c < 4; c++) {
      reset_case();
      u32 pRoomEx = PTR(0x100), pCoords = PTR(0x200), pLevel = PTR(0x300), pDrlg = PTR(0x500);
      u32 pSrcCells = PTR(0x600), pSrcRows = PTR(0x700);
      S32_AT(0x100 + 0x34) = 10; S32_AT(0x100 + 0x38) = 20;
      S32_AT(0x100 + 0x3C) = 2;  S32_AT(0x100 + 0x40) = 2; /* 3x3 grid */
      U32_AT(0x100 + 0x58) = pLevel;
      U32_AT(0x300 + 0x1B4) = pDrlg;
      U32_AT(0x500 + 0x478) = 0xCAFE0015u;
      U32_AT(0x200 + 0x08) = pSrcCells;
      U32_AT(0x200 + 0x0C) = pSrcRows;
      S32_AT(0x700 + 0) = 0; S32_AT(0x700 + 4) = 3; S32_AT(0x700 + 8) = 6;
      for (int i = 0; i < 9; i++) {
        u32 v = 0x20000001u;
        if (c == 1 && (i % 3) == 2) v = 2u;
        if (c == 2 && (i / 3) == 2) v = 3u;
        if (c == 3 && i == 4) v = 5u;
        U32_AT(0x600 + i * 4) = v;
      }
      track_dwords(pRoomEx, 0x60);
      track_dwords(pCoords, 0x34);
      track_dwords(PTR(0x300 + 0x1B4), 4);
      track_dwords(PTR(0x500 + 0x478), 4);
      track_dwords(pSrcCells, 0x24);
      track_dwords(pSrcRows, 0x0C);
      u32 args[2] = { pRoomEx, pCoords };
      fn(pRoomEx, pCoords);
      const char *notes[4] = { "uniform_3x3_region", "vertical_split_regions", "horizontal_split_and_border_clamp", "center_obstacle_multi_region" };
      emit_case(fp, 0x6FDD1200u, c, notes[c], args, 2, 0);
    }
  }

  /* 16. 0x6FDBC5D0: DATATBLS_FindFloorWindowTileCacheEntry113c (4 cases) */
  for (int c = 0; c < 4; c++) {
    reset_case();
    u32 pCache = PTR(0x200);
    *(u32 *)RVA(0x6FDF142C) = pCache;
    *(s32 *)RVA(0x6FDF1430) = 3;
    S32_AT(0x200 + 0 * 0x30) = 10; U8_AT(0x200 + 0 * 0x30 + 0x2C) = 0x6Cu; /* 'l' */
    S32_AT(0x200 + 1 * 0x30) = 10; U8_AT(0x200 + 1 * 0x30 + 0x2C) = 0x72u; /* 'r' */
    S32_AT(0x200 + 2 * 0x30) = 20; U8_AT(0x200 + 2 * 0x30 + 0x2C) = 0x62u; /* 'b' */
    s32 id = (c == 3) ? 20 : 10;
    u32 wt = (c == 0) ? 0x62u : (c == 1) ? 0x6Cu : (c == 2) ? 0x72u : 0x6Cu;
    track_dwords(pCache, 3 * 0x30);
    track_dwords((u32)RVA(0x6FDF142C), 8);
    u32 args[2] = { (u32)id, wt };
    u32 eax = call_ebx_dl_u32((u32)RVA(0x6FDBC5D0), (u32)id, wt);
    const char *notes[4] = { "query_b_matches_first", "query_l_matches_l", "query_r_matches_r", "entry_b_matches_query_l" };
    emit_case(fp, 0x6FDBC5D0u, c, notes[c], args, 2, eax);
  }
}

int main(int argc, char **argv) {
  const char *b040_out = (argc > 1) ? argv[1] : "tests/fixtures/oracle/k1/b040-vectors.ndjson";
  const char *b044_out = (argc > 2) ? argv[2] : "tests/fixtures/oracle/k1/b044-vectors.ndjson";
  const char *b047_out = (argc > 3) ? argv[3] : "tests/fixtures/oracle/k1/b047-vectors.ndjson";

  HMODULE hMod = LoadLibraryA("D2Common.dll");
  if (!hMod) return 1;
  g_base = (uintptr_t)hMod;

  g_arena = (u8 *)VirtualAlloc((void *)(uintptr_t)ARENA_ADDR, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  g_heap  = (u8 *)VirtualAlloc((void *)(uintptr_t)HEAP_ADDR,  HEAP_SIZE,  MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  if (!g_arena || !g_heap) return 2;

  DWORD oldProt = 0;
  VirtualProtect((void *)RVA(0x6FDD9000), 0x400, PAGE_READWRITE, &oldProt);
  *(uintptr_t *)RVA(0x6FDD90D0) = (uintptr_t)stub_fog_10045;
  *(uintptr_t *)RVA(0x6FDD90AC) = (uintptr_t)stub_fog_10047;
  *(uintptr_t *)RVA(0x6FDD90CC) = (uintptr_t)stub_fog_10046;
  *(uintptr_t *)RVA(0x6FDD90A8) = (uintptr_t)stub_fog_10046;
  *(uintptr_t *)RVA(0x6FDD9018) = (uintptr_t)stub_d2cmp_10085;

  DWORD oldDataProt = 0;
  VirtualProtect((void *)RVA(0x6FDE9E1C), 0x8000, PAGE_READWRITE, &oldDataProt);

  FILE *fp40 = fopen(b040_out, "wb");
  if (!fp40) return 3;
  emit_b040(fp40);
  fclose(fp40);

  FILE *fp44 = fopen(b044_out, "wb");
  if (!fp44) return 4;
  emit_b044(fp44);
  fclose(fp44);

  FILE *fp47 = fopen(b047_out, "wb");
  if (!fp47) return 5;
  emit_b047(fp47);
  fclose(fp47);

  return 0;
}
