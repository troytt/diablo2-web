/*
 * Standalone MinGW real-DLL differential vector emitter for K1r2 Iteration 5 Lane B (B021 + B024, 36 functions).
 *
 * Loads the real Diablo II v1.13c D2Common.dll (image base 0x6FD50000) under Wine, allocates a
 * deterministic scratch arena at 0x20000000, executes all 21 B021 functions and 15 B024 functions
 * across normal, boundary, negative/edge, and sentinel-padded inputs, and writes NDJSON records
 * to b021-vectors.ndjson and b024-vectors.ndjson.
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define EXPECTED_BASE 0x6FD50000u
#define ARENA_ADDR    0x20000000u
#define ARENA_SIZE    0x00080000u

static uintptr_t g_base = 0;
static uint8_t *g_arena = NULL;

#define RVA(va) (g_base - EXPECTED_BASE + (uint32_t)(va))
#define PTR(off) ((uint32_t)(ARENA_ADDR + (uint32_t)(off)))

static void w8(uint32_t addr, uint8_t v) { *(uint8_t *)(uintptr_t)addr = v; }
static void w16(uint32_t addr, uint16_t v) { *(uint16_t *)(uintptr_t)addr = v; }
static void w32(uint32_t addr, uint32_t v) { *(uint32_t *)(uintptr_t)addr = v; }

typedef struct {
  uint32_t addr;
  uint32_t len;
  uint8_t *pre;
  uint8_t *post;
} MemBlock;

#define MAX_BLOCKS 32
static MemBlock g_blocks[MAX_BLOCKS];
static int g_num_blocks = 0;

static void reset_arena(void) {
  memset(g_arena, 0, ARENA_SIZE);
  for (int i = 0; i < g_num_blocks; i++) {
    free(g_blocks[i].pre);
    free(g_blocks[i].post);
  }
  g_num_blocks = 0;
}

static void track_block(uint32_t addr, uint32_t len) {
  if (g_num_blocks >= MAX_BLOCKS) {
    fprintf(stderr, "Too many tracked blocks\n");
    ExitProcess(5);
  }
  MemBlock *b = &g_blocks[g_num_blocks++];
  b->addr = addr;
  b->len = len;
  b->pre = (uint8_t *)malloc(len);
  b->post = (uint8_t *)malloc(len);
  memcpy(b->pre, (const void *)(uintptr_t)addr, len);
}

static void snapshot_post(void) {
  for (int i = 0; i < g_num_blocks; i++) {
    memcpy(g_blocks[i].post, (const void *)(uintptr_t)g_blocks[i].addr, g_blocks[i].len);
  }
}

static void write_hex(FILE *fp, const uint8_t *buf, uint32_t len) {
  for (uint32_t i = 0; i < len; i++) {
    fprintf(fp, "%02x", buf[i]);
  }
}

static void emit_record(
  FILE *fp,
  uint32_t va,
  const char *name,
  const char *case_id,
  const uint32_t *args,
  int nargs,
  uint32_t eax,
  uint32_t ret_mask
) {
  snapshot_post();
  fprintf(fp, "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseId\":\"%s\",\"args\":[", va, name, case_id);
  for (int i = 0; i < nargs; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "%u", args[i]);
  }
  fprintf(fp, "],\"retMask\":%u,\"eax\":%u,\"pre\":[", ret_mask, eax & ret_mask);
  for (int i = 0; i < g_num_blocks; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", g_blocks[i].addr);
    write_hex(fp, g_blocks[i].pre, g_blocks[i].len);
    fprintf(fp, "\"}");
  }
  fprintf(fp, "],\"post\":[");
  for (int i = 0; i < g_num_blocks; i++) {
    if (i > 0) fputc(',', fp);
    fprintf(fp, "{\"addr\":%u,\"hex\":\"", g_blocks[i].addr);
    write_hex(fp, g_blocks[i].post, g_blocks[i].len);
    fprintf(fp, "\"}");
  }
  fprintf(fp, "]}\n");
}

/* Standard calling convention typedefs */
typedef uint32_t(__stdcall *Std0)(void);
typedef uint32_t(__stdcall *Std1)(uint32_t);
typedef uint32_t(__stdcall *Std2)(uint32_t, uint32_t);
typedef uint32_t(__stdcall *Std3)(uint32_t, uint32_t, uint32_t);
typedef uint32_t(__stdcall *Std4)(uint32_t, uint32_t, uint32_t, uint32_t);

/* Custom ABI wrappers with register-only constraints (never [esp+...] after pushl). */
static __attribute__((noinline)) uint32_t call_fastcall_ret8(
  uintptr_t fn,
  uint32_t ecx_val,
  uint32_t edx_val,
  uint32_t s0,
  uint32_t s1
) {
  uint32_t ret;
  __asm__ volatile (
    "pushl %[s1]\n\t"
    "pushl %[s0]\n\t"
    "call *%[fn]\n\t"
    : "=a"(ret), "+c"(ecx_val), "+d"(edx_val)
    : [fn]"r"(fn), [s0]"r"(s0), [s1]"r"(s1)
    : "cc", "memory"
  );
  return ret;
}

static __attribute__((noinline)) uint32_t call_eax1(uintptr_t fn, uint32_t eax_in) {
  uint32_t ret = eax_in;
  __asm__ volatile (
    "call *%[fn]\n\t"
    : "+a"(ret)
    : [fn]"r"(fn)
    : "ecx", "edx", "cc", "memory"
  );
  return ret;
}

/* Helper to set up a sentinel-padded D2UnitStrc + D2ItemDataStrc */
static void setup_item_unit(uint32_t u_addr, uint32_t d_addr, uint32_t unit_type) {
  memset((void *)(uintptr_t)u_addr, 0, 0xF4);
  w32(u_addr + 0x00, unit_type);
  w32(u_addr + 0x14, d_addr);
  if (d_addr != 0) {
    memset((void *)(uintptr_t)d_addr, 0xA5, 0x74);
  }
}

/* ========================= B021 (21 functions) ========================= */
static void emit_b021(FILE *fp) {
  uint32_t u0 = PTR(0x0100);
  uint32_t d0 = PTR(0x0200);
  uint32_t inv0 = PTR(0x0300);

  /* 1. 0x6FD73900 ITEMS_SetOrClearCommandFlags */
  {
    Std3 fn = (Std3)RVA(0x6FD73900);
    const char *name = "ITEMS_SetOrClearCommandFlags";
    uint32_t va = 0x6FD73900u;

    reset_arena();
    uint32_t a0[3] = { 0, 0x20, 1 };
    fn(a0[0], a0[1], a0[2]);
    emit_record(fp, va, name, "null_item", a0, 3, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 1);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a1[3] = { u0, 0x20, 1 };
    fn(a1[0], a1[1], a1[2]);
    emit_record(fp, va, name, "non_item_type", a1, 3, 0, 0);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    uint32_t a2[3] = { u0, 0x20, 1 };
    fn(a2[0], a2[1], a2[2]);
    emit_record(fp, va, name, "null_itemdata", a2, 3, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w32(d0 + 0x18, 0x00400001u);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a3[3] = { u0, 0x00000010u, 1 };
    fn(a3[0], a3[1], a3[2]);
    emit_record(fp, va, name, "set_flag_bits", a3, 3, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w32(d0 + 0x18, 0x00400011u);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a4[3] = { u0, 0x00400000u, 0 };
    fn(a4[0], a4[1], a4[2]);
    emit_record(fp, va, name, "clear_flag_bits", a4, 3, 0, 0);
  }

  /* 2. 0x6FD73940 ITEMS_CheckCommandFlags (ret 0x10 -> Std4) */
  {
    Std4 fn = (Std4)RVA(0x6FD73940);
    const char *name = "ITEMS_CheckCommandFlags";
    uint32_t va = 0x6FD73940u;

    reset_arena();
    uint32_t a0[4] = { 0, 0x10, 0, 0 };
    uint32_t r = fn(a0[0], a0[1], a0[2], a0[3]);
    emit_record(fp, va, name, "null_item", a0, 4, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 2);
    track_block(u0, 0x20);
    uint32_t a1[4] = { u0, 0x10, 7, 9 };
    r = fn(a1[0], a1[1], a1[2], a1[3]);
    emit_record(fp, va, name, "non_item_type", a1, 4, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    uint32_t a2[4] = { u0, 0x10, 0, 0 };
    r = fn(a2[0], a2[1], a2[2], a2[3]);
    emit_record(fp, va, name, "null_itemdata", a2, 4, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w32(d0 + 0x18, 0x80400010u);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a3[4] = { u0, 0x80000010u, 11, 22 };
    r = fn(a3[0], a3[1], a3[2], a3[3]);
    emit_record(fp, va, name, "mask_match", a3, 4, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w32(d0 + 0x18, 0x00400000u);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a4[4] = { u0, 0x00000010u, 0, 0 };
    r = fn(a4[0], a4[1], a4[2], a4[3]);
    emit_record(fp, va, name, "mask_miss", a4, 4, r, 0xFFFFFFFFu);
  }

  /* 3. 0x6FD73990 ITEMS_GetRareSuffix */
  {
    Std1 fn = (Std1)RVA(0x6FD73990);
    const char *name = "ITEMS_GetRareSuffix";
    uint32_t va = 0x6FD73990u;

    reset_arena();
    uint32_t a0[1] = { 0 };
    uint32_t r = fn(a0[0]);
    emit_record(fp, va, name, "null_item", a0, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 0);
    track_block(u0, 0x20);
    uint32_t a1[1] = { u0 };
    r = fn(a1[0]);
    emit_record(fp, va, name, "non_item_type", a1, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    r = fn(a1[0]);
    emit_record(fp, va, name, "null_itemdata", a1, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w16(d0 + 0x34, 0x4321u);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_4321", a1, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w16(d0 + 0x34, 0xFFFFu);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_ffff", a1, 1, r, 0xFFFFu);
  }

  /* 4. 0x6FD739E0 ITEMS_GetRarePrefix */
  {
    Std1 fn = (Std1)RVA(0x6FD739E0);
    const char *name = "ITEMS_GetRarePrefix";
    uint32_t va = 0x6FD739E0u;

    reset_arena();
    uint32_t a0[1] = { 0 };
    uint32_t r = fn(a0[0]);
    emit_record(fp, va, name, "null_item", a0, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 1);
    track_block(u0, 0x20);
    uint32_t a1[1] = { u0 };
    r = fn(a1[0]);
    emit_record(fp, va, name, "non_item_type", a1, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    r = fn(a1[0]);
    emit_record(fp, va, name, "null_itemdata", a1, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w16(d0 + 0x32, 0x1357u);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_1357", a1, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w16(d0 + 0x32, 0xBEEFu);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_beef", a1, 1, r, 0xFFFFu);
  }

  /* 5. 0x6FD73A40 ITEMS_GetMagicSuffix */
  {
    Std2 fn = (Std2)RVA(0x6FD73A40);
    const char *name = "ITEMS_GetMagicSuffix";
    uint32_t va = 0x6FD73A40u;

    reset_arena();
    uint32_t a0[2] = { 0, 0 };
    uint32_t r = fn(a0[0], a0[1]);
    emit_record(fp, va, name, "null_item", a0, 2, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 3);
    track_block(u0, 0x20);
    uint32_t a1[2] = { u0, 1 };
    r = fn(a1[0], a1[1]);
    emit_record(fp, va, name, "non_item_type", a1, 2, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    r = fn(a1[0], a1[1]);
    emit_record(fp, va, name, "null_itemdata", a1, 2, r, 0xFFFFu);

    for (uint32_t idx = 0; idx < 3; idx++) {
      char cid[32];
      sprintf(cid, "valid_idx_%u", idx);
      reset_arena();
      setup_item_unit(u0, d0, 4);
      w16(d0 + 0x3E, 0x0101u);
      w16(d0 + 0x40, 0x0202u);
      w16(d0 + 0x42, 0x0303u);
      track_block(u0, 0x20); track_block(d0, 0x74);
      uint32_t av[2] = { u0, idx };
      r = fn(av[0], av[1]);
      emit_record(fp, va, name, cid, av, 2, r, 0xFFFFu);
    }
  }

  /* 6. 0x6FD73A70 ITEMS_SetAutoAffix */
  {
    Std2 fn = (Std2)RVA(0x6FD73A70);
    const char *name = "ITEMS_SetAutoAffix";
    uint32_t va = 0x6FD73A70u;

    reset_arena();
    uint32_t a0[2] = { 0, 0x1234u };
    fn(a0[0], a0[1]);
    emit_record(fp, va, name, "null_item", a0, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 2);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a1[2] = { u0, 0x1234u };
    fn(a1[0], a1[1]);
    emit_record(fp, va, name, "non_item_type", a1, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    fn(a1[0], a1[1]);
    emit_record(fp, va, name, "null_itemdata", a1, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a3[2] = { u0, 0x0255u };
    fn(a3[0], a3[1]);
    emit_record(fp, va, name, "valid_set_0255", a3, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a4[2] = { u0, 0x1ABCDu };
    fn(a4[0], a4[1]);
    emit_record(fp, va, name, "valid_set_trunc_abcd", a4, 2, 0, 0);
  }

  /* 7. 0x6FD73A90 ITEMS_GetAutoAffix */
  {
    Std1 fn = (Std1)RVA(0x6FD73A90);
    const char *name = "ITEMS_GetAutoAffix";
    uint32_t va = 0x6FD73A90u;

    reset_arena();
    uint32_t a0[1] = { 0 };
    uint32_t r = fn(a0[0]);
    emit_record(fp, va, name, "null_item", a0, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 5);
    track_block(u0, 0x20);
    uint32_t a1[1] = { u0 };
    r = fn(a1[0]);
    emit_record(fp, va, name, "non_item_type", a1, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    r = fn(a1[0]);
    emit_record(fp, va, name, "null_itemdata", a1, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w16(d0 + 0x36, 0x0777u);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_0777", a1, 1, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w16(d0 + 0x36, 0x8001u);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_8001", a1, 1, r, 0xFFFFu);
  }

  /* 8. 0x6FD73AF0 ITEMS_GetMagicPrefix */
  {
    Std2 fn = (Std2)RVA(0x6FD73AF0);
    const char *name = "ITEMS_GetMagicPrefix";
    uint32_t va = 0x6FD73AF0u;

    reset_arena();
    uint32_t a0[2] = { 0, 0 };
    uint32_t r = fn(a0[0], a0[1]);
    emit_record(fp, va, name, "null_item", a0, 2, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 1);
    track_block(u0, 0x20);
    uint32_t a1[2] = { u0, 2 };
    r = fn(a1[0], a1[1]);
    emit_record(fp, va, name, "non_item_type", a1, 2, r, 0xFFFFu);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    r = fn(a1[0], a1[1]);
    emit_record(fp, va, name, "null_itemdata", a1, 2, r, 0xFFFFu);

    for (uint32_t idx = 0; idx < 3; idx++) {
      char cid[32];
      sprintf(cid, "valid_idx_%u", idx);
      reset_arena();
      setup_item_unit(u0, d0, 4);
      w16(d0 + 0x38, 0x1111u);
      w16(d0 + 0x3A, 0x2222u);
      w16(d0 + 0x3C, 0x3333u);
      track_block(u0, 0x20); track_block(d0, 0x74);
      uint32_t av[2] = { u0, idx };
      r = fn(av[0], av[1]);
      emit_record(fp, va, name, cid, av, 2, r, 0xFFFFu);
    }
  }

  /* 9. 0x6FD73B20 ITEMS_SetItemQuality */
  {
    Std2 fn = (Std2)RVA(0x6FD73B20);
    const char *name = "ITEMS_SetItemQuality";
    uint32_t va = 0x6FD73B20u;

    reset_arena();
    uint32_t a0[2] = { 0, 7 };
    fn(a0[0], a0[1]);
    emit_record(fp, va, name, "null_item", a0, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 0);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a1[2] = { u0, 7 };
    fn(a1[0], a1[1]);
    emit_record(fp, va, name, "non_item_type", a1, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    fn(a1[0], a1[1]);
    emit_record(fp, va, name, "null_itemdata", a1, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a3[2] = { u0, 7 };
    fn(a3[0], a3[1]);
    emit_record(fp, va, name, "valid_qual_7", a3, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a4[2] = { u0, 4 };
    fn(a4[0], a4[1]);
    emit_record(fp, va, name, "valid_qual_4", a4, 2, 0, 0);
  }

  /* 10. 0x6FD73B40 ITEMS_GetItemQuality */
  {
    Std1 fn = (Std1)RVA(0x6FD73B40);
    const char *name = "ITEMS_GetItemQuality";
    uint32_t va = 0x6FD73B40u;

    reset_arena();
    uint32_t a0[1] = { 0 };
    uint32_t r = fn(a0[0]);
    emit_record(fp, va, name, "null_item_returns_2", a0, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 1);
    track_block(u0, 0x20);
    uint32_t a1[1] = { u0 };
    r = fn(a1[0]);
    emit_record(fp, va, name, "non_item_returns_2", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    r = fn(a1[0]);
    emit_record(fp, va, name, "null_itemdata_returns_2", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w32(d0 + 0x00, 6);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_qual_6", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w32(d0 + 0x00, 0);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_qual_0", a1, 1, r, 0xFFFFFFFFu);
  }

  /* 11. 0x6FD73BC0 ITEMS_GetOwnerGuid */
  {
    Std1 fn = (Std1)RVA(0x6FD73BC0);
    const char *name = "ITEMS_GetOwnerGuid";
    uint32_t va = 0x6FD73BC0u;

    reset_arena();
    uint32_t a0[1] = { 0 };
    uint32_t r = fn(a0[0]);
    emit_record(fp, va, name, "null_item", a0, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 2);
    track_block(u0, 0x20);
    uint32_t a1[1] = { u0 };
    r = fn(a1[0]);
    emit_record(fp, va, name, "non_item_type", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    r = fn(a1[0]);
    emit_record(fp, va, name, "null_itemdata", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w32(d0 + 0x10, 0xCAFEBABEu);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_guid_cafebabe", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w32(d0 + 0x10, 0xFFFFFFFFu);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_guid_ffffffff", a1, 1, r, 0xFFFFFFFFu);
  }

  /* 12. 0x6FD73BE0 ITEMS_InitItemSeed */
  {
    Std1 fn = (Std1)RVA(0x6FD73BE0);
    const char *name = "ITEMS_InitItemSeed";
    uint32_t va = 0x6FD73BE0u;

    reset_arena();
    uint32_t a0[1] = { 0 };
    fn(a0[0]);
    emit_record(fp, va, name, "null_item", a0, 1, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 1);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a1[1] = { u0 };
    fn(a1[0]);
    emit_record(fp, va, name, "non_item_type", a1, 1, 0, 0);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    fn(a1[0]);
    emit_record(fp, va, name, "null_itemdata", a1, 1, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    track_block(u0, 0x20); track_block(d0, 0x74);
    fn(a1[0]);
    emit_record(fp, va, name, "valid_init_seed_from_sentinel", a1, 1, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w32(d0 + 0x04, 0);
    w32(d0 + 0x08, 0);
    track_block(u0, 0x20); track_block(d0, 0x74);
    fn(a1[0]);
    emit_record(fp, va, name, "valid_init_seed_from_zero", a1, 1, 0, 0);
  }

  /* 13. 0x6FD73C10 ITEMS_GetItemSeed */
  {
    Std1 fn = (Std1)RVA(0x6FD73C10);
    const char *name = "ITEMS_GetItemSeed";
    uint32_t va = 0x6FD73C10u;

    reset_arena();
    uint32_t a0[1] = { 0 };
    uint32_t r = fn(a0[0]);
    emit_record(fp, va, name, "null_item", a0, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 3);
    track_block(u0, 0x20);
    uint32_t a1[1] = { u0 };
    r = fn(a1[0]);
    emit_record(fp, va, name, "non_item_type", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    r = fn(a1[0]);
    emit_record(fp, va, name, "null_itemdata", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_seed_ptr_0", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, PTR(0x0500), 4);
    track_block(u0, 0x20); track_block(PTR(0x0500), 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "valid_seed_ptr_500", a1, 1, r, 0xFFFFFFFFu);
  }

  /* 14. 0x6FD73C30 ITEMS_SetBodyLocation */
  {
    Std2 fn = (Std2)RVA(0x6FD73C30);
    const char *name = "ITEMS_SetBodyLocation";
    uint32_t va = 0x6FD73C30u;

    reset_arena();
    uint32_t a0[2] = { 0, 5 };
    fn(a0[0], a0[1]);
    emit_record(fp, va, name, "null_item", a0, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 1);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a1[2] = { u0, 5 };
    fn(a1[0], a1[1]);
    emit_record(fp, va, name, "non_item_type", a1, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    fn(a1[0], a1[1]);
    emit_record(fp, va, name, "null_itemdata", a1, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a3[2] = { u0, 4 };
    fn(a3[0], a3[1]);
    emit_record(fp, va, name, "valid_bodyloc_4", a3, 2, 0, 0);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    track_block(u0, 0x20); track_block(d0, 0x74);
    uint32_t a4[2] = { u0, 0x1ABu };
    fn(a4[0], a4[1]);
    emit_record(fp, va, name, "valid_bodyloc_trunc_ab", a4, 2, 0, 0);
  }

  /* 15 & 16. 0x6FD73D50 ITEMS_MaxIntFastcall & 0x6FD73D60 ITEMS_MinIntFastcall */
  {
    const int32_t pairs[6][2] = {
      { 10, 20 },
      { 25, 12 },
      { -5, 3 },
      { -10, -25 },
      { 0, 0 },
      { 0x7FFFFFFF, (int32_t)0x80000000u }
    };
    for (int i = 0; i < 6; i++) {
      char cid[32];
      sprintf(cid, "pair_%d", i);
      reset_arena();
      uint32_t args[4] = { (uint32_t)pairs[i][0], (uint32_t)pairs[i][1], 0, 0 };
      uint32_t rmax = call_fastcall_ret8(RVA(0x6FD73D50), args[0], args[1], args[2], args[3]);
      emit_record(fp, 0x6FD73D50u, "ITEMS_MaxIntFastcall", cid, args, 4, rmax, 0xFFFFFFFFu);

      reset_arena();
      uint32_t rmin = call_fastcall_ret8(RVA(0x6FD73D60), args[0], args[1], args[2], args[3]);
      emit_record(fp, 0x6FD73D60u, "ITEMS_MinIntFastcall", cid, args, 4, rmin, 0xFFFFFFFFu);
    }
  }

  /* 17. 0x6FD73E00 ITEMS_CheckEtherealFlag */
  {
    Std1 fn = (Std1)RVA(0x6FD73E00);
    const char *name = "ITEMS_CheckEtherealFlag";
    uint32_t va = 0x6FD73E00u;

    reset_arena();
    uint32_t a0[1] = { 0 };
    uint32_t r = fn(a0[0]);
    emit_record(fp, va, name, "null_item", a0, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 1);
    track_block(u0, 0x20);
    uint32_t a1[1] = { u0 };
    r = fn(a1[0]);
    emit_record(fp, va, name, "non_item_type", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    r = fn(a1[0]);
    emit_record(fp, va, name, "null_itemdata", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w32(d0 + 0x18, 0x00400010u);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "ethereal_set", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 4);
    w32(d0 + 0x18, 0xFFBFFFEFu);
    track_block(u0, 0x20); track_block(d0, 0x74);
    r = fn(a1[0]);
    emit_record(fp, va, name, "ethereal_clear", a1, 1, r, 0xFFFFFFFFu);
  }

  /* 18. 0x6FD73E30 ITEMS_CountEquippedOrCarryItems */
  {
    Std1 fn = (Std1)RVA(0x6FD73E30);
    const char *name = "ITEMS_CountEquippedOrCarryItems";
    uint32_t va = 0x6FD73E30u;
    uint32_t a0[1] = { u0 };

    /* pInventory == 0 */
    reset_arena();
    w32(u0 + 0x60, 0);
    track_block(u0, 0x68);
    uint32_t r = fn(a0[0]);
    emit_record(fp, va, name, "null_inventory", a0, 1, r, 0xFFFFFFFFu);

    /* bad signature */
    reset_arena();
    w32(u0 + 0x60, inv0);
    w32(inv0 + 0x00, 0xDEADBEEFu);
    w32(inv0 + 0x0C, PTR(0x0400));
    track_block(u0, 0x68); track_block(inv0, 0x20);
    r = fn(a0[0]);
    emit_record(fp, va, name, "bad_inv_signature", a0, 1, r, 0xFFFFFFFFu);

    /* empty inventory */
    reset_arena();
    w32(u0 + 0x60, inv0);
    w32(inv0 + 0x00, 0x01020304u);
    w32(inv0 + 0x0C, 0);
    track_block(u0, 0x68); track_block(inv0, 0x20);
    r = fn(a0[0]);
    emit_record(fp, va, name, "empty_inventory", a0, 1, r, 0xFFFFFFFFu);

    /* chain of 6 items:
     * 0: cmdFlags=0x10 (skipped), nodePos=3
     * 1: cmdFlags=0, nodePos=3 (equipped -> +1)
     * 2: cmdFlags=0, nodePos=1, invPage=0 (carry page 0 -> +1)
     * 3: cmdFlags=0, nodePos=1, invPage=3 (carry page 3 -> +1)
     * 4: cmdFlags=0, nodePos=1, invPage=1 (not counted)
     * 5: cmdFlags=0, nodePos=2, invPage=0 (not counted)
     */
    reset_arena();
    w32(u0 + 0x60, inv0);
    w32(inv0 + 0x00, 0x01020304u);
    w32(inv0 + 0x0C, PTR(0x1000));
    track_block(u0, 0x68);
    track_block(inv0, 0x20);
    const uint32_t cmdFlags[6] = { 0x10, 0, 0, 0, 0, 0 };
    const uint8_t nodePos[6] = { 3, 3, 1, 1, 1, 2 };
    const uint8_t invPage[6] = { 0, 0, 0, 3, 1, 0 };
    for (int i = 0; i < 6; i++) {
      uint32_t it = PTR(0x1000 + i * 0x200);
      uint32_t id = PTR(0x1080 + i * 0x200);
      uint32_t next_it = (i < 5) ? PTR(0x1000 + (i + 1) * 0x200) : 0;
      w32(it + 0x00, 4);
      w32(it + 0x14, id);
      w32(id + 0x18, cmdFlags[i]);
      w8(id + 0x45, invPage[i]);
      w32(id + 0x5C + 0x08, next_it);
      w8(id + 0x5C + 0x0D, nodePos[i]);
      track_block(it, 0x20);
      track_block(id, 0x74);
    }
    r = fn(a0[0]);
    emit_record(fp, va, name, "mixed_6_item_chain", a0, 1, r, 0xFFFFFFFFu);

    /* item with null pItemData */
    reset_arena();
    w32(u0 + 0x60, inv0);
    w32(inv0 + 0x00, 0x01020304u);
    w32(inv0 + 0x0C, PTR(0x1000));
    w32(PTR(0x1000) + 0x00, 4);
    w32(PTR(0x1000) + 0x14, 0);
    track_block(u0, 0x68); track_block(inv0, 0x20);
    track_block(PTR(0x1000), 0x20);
    r = fn(a0[0]);
    emit_record(fp, va, name, "item_null_itemdata", a0, 1, r, 0xFFFFFFFFu);

    /* item with non-item dwUnitType */
    reset_arena();
    w32(u0 + 0x60, inv0);
    w32(inv0 + 0x00, 0x01020304u);
    w32(inv0 + 0x0C, PTR(0x1000));
    w32(PTR(0x1000) + 0x00, 1);
    track_block(u0, 0x68); track_block(inv0, 0x20);
    track_block(PTR(0x1000), 0x20);
    r = fn(a0[0]);
    emit_record(fp, va, name, "item_non_item_type", a0, 1, r, 0xFFFFFFFFu);
  }

  /* 19. 0x6FD741A0 ITEMS_HasSocketedItems (custom LTCG eax = pItem) */
  {
    uintptr_t fn = RVA(0x6FD741A0);
    const char *name = "ITEMS_HasSocketedItems";
    uint32_t va = 0x6FD741A0u;
    uint32_t a0[1] = { u0 };

    reset_arena();
    w32(u0 + 0x60, 0);
    track_block(u0, 0x68);
    uint32_t r = call_eax1(fn, a0[0]);
    emit_record(fp, va, name, "null_inv", a0, 1, r, 0xFFFFFFFFu);

    reset_arena();
    w32(u0 + 0x60, inv0);
    w32(inv0 + 0x00, 0x11111111u);
    w32(inv0 + 0x0C, PTR(0x0400));
    track_block(u0, 0x68); track_block(inv0, 0x20);
    r = call_eax1(fn, a0[0]);
    emit_record(fp, va, name, "bad_signature", a0, 1, r, 0xFFFFFFFFu);

    reset_arena();
    w32(u0 + 0x60, inv0);
    w32(inv0 + 0x00, 0x01020304u);
    w32(inv0 + 0x0C, 0);
    track_block(u0, 0x68); track_block(inv0, 0x20);
    r = call_eax1(fn, a0[0]);
    emit_record(fp, va, name, "null_first_item", a0, 1, r, 0xFFFFFFFFu);

    reset_arena();
    w32(u0 + 0x60, inv0);
    w32(inv0 + 0x00, 0x01020304u);
    w32(inv0 + 0x0C, PTR(0x0400));
    w32(PTR(0x0400) + 0x00, 2);
    track_block(u0, 0x68); track_block(inv0, 0x20); track_block(PTR(0x0400), 0x10);
    r = call_eax1(fn, a0[0]);
    emit_record(fp, va, name, "first_not_item", a0, 1, r, 0xFFFFFFFFu);

    reset_arena();
    w32(u0 + 0x60, inv0);
    w32(inv0 + 0x00, 0x01020304u);
    w32(inv0 + 0x0C, PTR(0x0400));
    w32(PTR(0x0400) + 0x00, 4);
    track_block(u0, 0x68); track_block(inv0, 0x20); track_block(PTR(0x0400), 0x10);
    r = call_eax1(fn, a0[0]);
    emit_record(fp, va, name, "has_socketed_item", a0, 1, r, 0xFFFFFFFFu);
  }

  /* 20. 0x6FD74210 ITEMS_IsHighQualityItem */
  {
    Std1 fn = (Std1)RVA(0x6FD74210);
    const char *name = "ITEMS_IsHighQualityItem";
    uint32_t va = 0x6FD74210u;

    reset_arena();
    uint32_t a0[1] = { 0 };
    uint32_t r = fn(a0[0]);
    emit_record(fp, va, name, "null_item", a0, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, d0, 1);
    track_block(u0, 0x20);
    uint32_t a1[1] = { u0 };
    r = fn(a1[0]);
    emit_record(fp, va, name, "non_item_type", a1, 1, r, 0xFFFFFFFFu);

    reset_arena();
    setup_item_unit(u0, 0, 4);
    track_block(u0, 0x20);
    r = fn(a1[0]);
    emit_record(fp, va, name, "null_itemdata", a1, 1, r, 0xFFFFFFFFu);

    const int32_t quals[5] = { 3, 4, 7, 9, 10 };
    for (int i = 0; i < 5; i++) {
      char cid[32];
      sprintf(cid, "qual_%d", quals[i]);
      reset_arena();
      setup_item_unit(u0, d0, 4);
      w32(d0 + 0x00, (uint32_t)quals[i]);
      track_block(u0, 0x20); track_block(d0, 0x74);
      r = fn(a1[0]);
      emit_record(fp, va, name, cid, a1, 1, r, 0xFFFFFFFFu);
    }
  }

  /* 21. 0x6FDA3020 DATATBLS_FindCodeRecord4C */
  {
    Std1 fn = (Std1)RVA(0x6FDA3020);
    const char *name = "DATATBLS_FindCodeRecord4C";
    uint32_t va = 0x6FDA3020u;
    uint32_t *pTablePtr = (uint32_t *)(uintptr_t)RVA(0x6FDF0880);
    uint32_t *pTableCnt = (uint32_t *)(uintptr_t)RVA(0x6FDF0884);
    uint32_t origPtr = *pTablePtr;
    uint32_t origCnt = *pTableCnt;

    uint32_t recs = PTR(0x2000);

    /* count == 0 */
    reset_arena();
    *pTablePtr = recs;
    *pTableCnt = 0;
    track_block((uint32_t)RVA(0x6FDF0880), 8);
    {
      uint32_t a0[1] = { 0x2076616Au };
      uint32_t r = fn(a0[0]);
      emit_record(fp, va, name, "count_zero", a0, 1, r, 0xFFFFFFFFu);
    }

    /* count < 0 */
    reset_arena();
    *pTablePtr = recs;
    *pTableCnt = 0xFFFFFFFFu;
    track_block((uint32_t)RVA(0x6FDF0880), 8);
    {
      uint32_t a0[1] = { 0x2076616Au };
      uint32_t r = fn(a0[0]);
      emit_record(fp, va, name, "count_negative", a0, 1, r, 0xFFFFFFFFu);
    }

    /* count == 4 */
    const uint32_t queries[4] = { 0x2076616Au, 0x206D6567u, 0x206E7572u, 0xdeadbeefu };
    const char *qnames[4] = { "hit_idx_0", "hit_idx_2", "hit_idx_3", "miss_not_found" };
    for (int i = 0; i < 4; i++) {
      reset_arena();
      w32(recs + 0 * 0x4C, 0x2076616Au);
      w32(recs + 1 * 0x4C, 0x20776F62u);
      w32(recs + 2 * 0x4C, 0x206D6567u);
      w32(recs + 3 * 0x4C, 0x206E7572u);
      *pTablePtr = recs;
      *pTableCnt = 4;
      track_block((uint32_t)RVA(0x6FDF0880), 8);
      track_block(recs, 4 * 0x4C);
      uint32_t a0[1] = { queries[i] };
      uint32_t r = fn(a0[0]);
      emit_record(fp, va, name, qnames[i], a0, 1, r, 0xFFFFFFFFu);
    }

    *pTablePtr = origPtr;
    *pTableCnt = origCnt;
  }
}

/* ========================= B024 (15 functions) ========================= */
static void emit_b024(FILE *fp) {
  /* 1. 0x6FD8E900 DATATBLS_GetObjGroupTxtRecordCount */
  {
    Std0 fn = (Std0)RVA(0x6FD8E900);
    const char *name = "DATATBLS_GetObjGroupTxtRecordCount";
    uint32_t va = 0x6FD8E900u;
    uint32_t *pCnt = (uint32_t *)(uintptr_t)RVA(0x6FDF0B90);
    uint32_t orig = *pCnt;
    const uint32_t vals[4] = { 0, 1, 19, 0x12345678u };
    for (int i = 0; i < 4; i++) {
      char cid[32];
      sprintf(cid, "count_%d", i);
      reset_arena();
      *pCnt = vals[i];
      track_block((uint32_t)RVA(0x6FDF0B90), 4);
      uint32_t r = fn();
      emit_record(fp, va, name, cid, NULL, 0, r, 0xFFFFFFFFu);
    }
    *pCnt = orig;
  }

  /* 2. 0x6FD8E960 DATATBLS_GetShrinesTxtRecord */
  {
    Std1 fn = (Std1)RVA(0x6FD8E960);
    const char *name = "DATATBLS_GetShrinesTxtRecord";
    uint32_t va = 0x6FD8E960u;
    uint32_t *pBase = (uint32_t *)(uintptr_t)RVA(0x6FDF0B9C);
    uint32_t *pCnt = (uint32_t *)(uintptr_t)RVA(0x6FDF0BA0);
    uint32_t origBase = *pBase;
    uint32_t origCnt = *pCnt;

    *pBase = 0x10002000u;
    *pCnt = 5;
    const int32_t indices[5] = { 0, 3, 4, 5, -1 };
    const char *cids[5] = { "idx_0", "idx_3", "idx_4", "idx_5_oob", "idx_neg1_no_low_clamp" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t a0[1] = { (uint32_t)indices[i] };
      track_block((uint32_t)RVA(0x6FDF0B9C), 8);
      uint32_t r = fn(a0[0]);
      emit_record(fp, va, name, cids[i], a0, 1, r, 0xFFFFFFFFu);
    }
    *pBase = origBase;
    *pCnt = origCnt;
  }

  /* 3. 0x6FDA3AA0 DATATBLS_AdjustMonsterPresetIndex */
  {
    Std2 fn = (Std2)RVA(0x6FDA3AA0);
    const char *name = "DATATBLS_AdjustMonsterPresetIndex";
    uint32_t va = 0x6FDA3AA0u;
    uint32_t *pSuperCnt = (uint32_t *)(uintptr_t)RVA(0x6FDF09B4);
    uint32_t *pSgpt = (uint32_t *)(uintptr_t)RVA(0x6FDE9E1C);
    uint32_t origSuper = *pSuperCnt;
    uint32_t origSgpt = *pSgpt;

    const int32_t types[5] = { 0, 2, 1, 3, -1 };
    const uint32_t idxs[5] = { 10, 10, 10, 42, 7 };
    for (int i = 0; i < 5; i++) {
      char cid[32];
      sprintf(cid, "type_%d", types[i]);
      reset_arena();
      uint32_t dt = PTR(0x1000);
      w32(dt + 0xA80, 733);
      *pSuperCnt = 66;
      *pSgpt = dt;
      track_block((uint32_t)RVA(0x6FDF09B4), 4);
      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block(dt + 0xA80, 4);
      uint32_t args[2] = { (uint32_t)types[i], idxs[i] };
      uint32_t r = fn(args[0], args[1]);
      emit_record(fp, va, name, cid, args, 2, r, 0xFFFFFFFFu);
    }
    *pSuperCnt = origSuper;
    *pSgpt = origSgpt;
  }

  /* 4. 0x6FDA43C0 DATATBLS_GetChestTreasureClass */
  {
    Std3 fn = (Std3)RVA(0x6FDA43C0);
    const char *name = "DATATBLS_GetChestTreasureClass";
    uint32_t va = 0x6FDA43C0u;
    uint32_t *pTable = (uint32_t *)(uintptr_t)RVA(0x6FDF089C);
    uint32_t orig[45];
    memcpy(orig, pTable, sizeof(orig));
    for (int i = 0; i < 45; i++) {
      pTable[i] = 0x1000u + (uint32_t)i * 7u;
    }
    const int32_t cases[6][3] = {
      { 0, 0, 0 },
      { 1, 2, 1 },
      { 2, 4, 2 },
      { -1, -2, -3 },
      { 3, 5, 3 },
      { 99, -5, 10 }
    };
    for (int i = 0; i < 6; i++) {
      char cid[32];
      sprintf(cid, "chest_tc_%d", i);
      reset_arena();
      track_block((uint32_t)RVA(0x6FDF089C), sizeof(orig));
      uint32_t args[3] = { (uint32_t)cases[i][0], (uint32_t)cases[i][1], (uint32_t)cases[i][2] };
      uint32_t r = fn(args[0], args[1], args[2]);
      emit_record(fp, va, name, cid, args, 3, r, 0xFFFFFFFFu);
    }
    memcpy(pTable, orig, sizeof(orig));
  }

  /* 5. 0x6FDAE1C0 DATATBLS_GetCompCodeString */
  {
    Std1 fn = (Std1)RVA(0x6FDAE1C0);
    const char *name = "DATATBLS_GetCompCodeString";
    uint32_t va = 0x6FDAE1C0u;
    uint32_t *pPtr = (uint32_t *)(uintptr_t)RVA(0x6FDEFF54);
    uint32_t *pCnt = (uint32_t *)(uintptr_t)RVA(0x6FDEFF5C);
    uint32_t origPtr = *pPtr;
    uint32_t origCnt = *pCnt;

    const int32_t idxs[5] = { 0, 2, 3, 4, -1 };
    const char *cids[5] = { "idx_0", "idx_2", "idx_3", "idx_4_oob", "idx_neg1" };
    for (int i = 0; i < 5; i++) {
      reset_arena();
      uint32_t arr = PTR(0x2000);
      w32(arr + 0, 0xAAAA0000u);
      w32(arr + 4, 0xBBBB0001u);
      w32(arr + 8, 0xCCCC0002u);
      w32(arr + 12, 0xDDDD0003u);
      w32(arr + 16, 0xEEEE0004u);
      w32(arr + 20, 0xFFFF0005u);
      *pPtr = arr + 4; /* allow nIndex = -1 to read arr + 0 */
      *pCnt = 4;
      track_block((uint32_t)RVA(0x6FDEFF54), 12);
      track_block(arr, 24);
      uint32_t a0[1] = { (uint32_t)idxs[i] };
      uint32_t r = fn(a0[0]);
      emit_record(fp, va, name, cids[i], a0, 1, r, 0xFFFFFFFFu);
    }
    *pPtr = origPtr;
    *pCnt = origCnt;
  }

  /* 6, 7, 8, 10. ExperienceBin family (`0x6FDAE7E0`, `0x6FDAE810`, `0x6FDAE840`, `0x6FDB08D0`) */
  {
    uint32_t *pExpGlobal = (uint32_t *)(uintptr_t)RVA(0x6FDF0B50);
    uint32_t origExp = *pExpGlobal;
    uint32_t expTable = PTR(0x3000);

    /* 6. 0x6FDAE7E0 DATATBLS_GetMaxLevel */
    {
      Std1 fn = (Std1)RVA(0x6FDAE7E0);
      const char *name = "DATATBLS_GetMaxLevel";
      uint32_t va = 0x6FDAE7E0u;
      const int32_t classes[6] = { -1, 0, 3, 6, 7, 99 };
      for (int i = 0; i < 6; i++) {
        char cid[32];
        sprintf(cid, "cls_%d", classes[i]);
        reset_arena();
        for (int c = 0; c < 7; c++) {
          w32(expTable + (uint32_t)c * 4u, (uint32_t)(90 + c));
        }
        *pExpGlobal = expTable;
        track_block((uint32_t)RVA(0x6FDF0B50), 4);
        track_block(expTable, 32);
        uint32_t a0[1] = { (uint32_t)classes[i] };
        uint32_t r = fn(a0[0]);
        emit_record(fp, va, name, cid, a0, 1, r, 0xFFFFFFFFu);
      }
    }

    /* 7. 0x6FDAE810 DATATBLS_GetStartExpForLevel */
    {
      Std2 fn = (Std2)RVA(0x6FDAE810);
      const char *name = "DATATBLS_GetStartExpForLevel";
      uint32_t va = 0x6FDAE810u;
      const int32_t cases[6][2] = {
        { -1, 1 },
        { 0, 0 },
        { 0, 2 },
        { 3, 4 },
        { 6, 5 },
        { 7, 3 }
      };
      for (int i = 0; i < 6; i++) {
        char cid[32];
        sprintf(cid, "start_exp_%d", i);
        reset_arena();
        for (int c = 0; c < 7; c++) w32(expTable + (uint32_t)c * 4u, 5);
        w32(expTable + 7 * 4, 1024);
        for (int lvl = 1; lvl <= 6; lvl++) {
          for (int c = 0; c < 7; c++) {
            w32(expTable + (uint32_t)(lvl * 8 + c) * 4u, (uint32_t)(lvl * 1000 + c * 10));
          }
          w32(expTable + (uint32_t)(lvl * 8 + 7) * 4u, (uint32_t)(1000 - lvl * 100));
        }
        *pExpGlobal = expTable;
        track_block((uint32_t)RVA(0x6FDF0B50), 4);
        track_block(expTable, 64 * 4);
        uint32_t args[2] = { (uint32_t)cases[i][0], (uint32_t)cases[i][1] };
        uint32_t r = fn(args[0], args[1]);
        emit_record(fp, va, name, cid, args, 2, r, 0xFFFFFFFFu);
      }
    }

    /* 8. 0x6FDAE840 DATATBLS_GetExpRatio */
    {
      Std1 fn = (Std1)RVA(0x6FDAE840);
      const char *name = "DATATBLS_GetExpRatio";
      uint32_t va = 0x6FDAE840u;

      reset_arena();
      *pExpGlobal = 0;
      track_block((uint32_t)RVA(0x6FDF0B50), 4);
      {
        uint32_t a0[1] = { 1 };
        uint32_t r = fn(a0[0]);
        emit_record(fp, va, name, "null_exp_bin", a0, 1, r, 0xFFFFFFFFu);
      }

      const int32_t lvls[5] = { -2, 0, 1, 4, 9 };
      for (int i = 0; i < 5; i++) {
        char cid[32];
        sprintf(cid, "lvl_%d", lvls[i]);
        reset_arena();
        for (int c = 0; c < 7; c++) w32(expTable + (uint32_t)c * 4u, 5);
        w32(expTable + 7 * 4, 1024);
        for (int lvl = 1; lvl <= 6; lvl++) {
          w32(expTable + (uint32_t)(lvl * 8 + 7) * 4u, (uint32_t)(1000 - lvl * 100));
        }
        *pExpGlobal = expTable;
        track_block((uint32_t)RVA(0x6FDF0B50), 4);
        track_block(expTable, 64 * 4);
        uint32_t a0[1] = { (uint32_t)lvls[i] };
        uint32_t r = fn(a0[0]);
        emit_record(fp, va, name, cid, a0, 1, r, 0xFFFFFFFFu);
      }
    }

    /* 10. 0x6FDB08D0 DATATBLS_GetCurrentLevelFromExp */
    {
      Std2 fn = (Std2)RVA(0x6FDB08D0);
      const char *name = "DATATBLS_GetCurrentLevelFromExp";
      uint32_t va = 0x6FDB08D0u;
      const int32_t cls_cases[5] = { -1, 0, 2, 6, 8 };
      const uint32_t exp_cases[5] = { 500, 2000, 3500, 999999, 2500 };
      for (int i = 0; i < 5; i++) {
        char cid[32];
        sprintf(cid, "cur_lvl_%d", i);
        reset_arena();
        for (int c = 0; c < 7; c++) w32(expTable + (uint32_t)c * 4u, 5);
        for (int lvl = 1; lvl <= 6; lvl++) {
          for (int c = 0; c < 7; c++) {
            w32(expTable + (uint32_t)(lvl * 8 + c) * 4u, (uint32_t)(lvl * 1000 + c * 10));
          }
        }
        *pExpGlobal = expTable;
        track_block((uint32_t)RVA(0x6FDF0B50), 4);
        track_block(expTable, 64 * 4);
        uint32_t args[2] = { (uint32_t)cls_cases[i], exp_cases[i] };
        uint32_t r = fn(args[0], args[1]);
        emit_record(fp, va, name, cid, args, 2, r, 0xFFFFFFFFu);
      }

      /* maxLvl <= 1 */
      reset_arena();
      w32(expTable + 0, 1);
      *pExpGlobal = expTable;
      track_block((uint32_t)RVA(0x6FDF0B50), 4);
      track_block(expTable, 64 * 4);
      {
        uint32_t args[2] = { 0, 999999 };
        uint32_t r = fn(args[0], args[1]);
        emit_record(fp, va, name, "maxlvl_le_1", args, 2, r, 0xFFFFFFFFu);
      }
    }

    *pExpGlobal = origExp;
  }

  /* 9. 0x6FDB03C0 DATATBLS_GetMonLvlTxtRecord */
  {
    Std1 fn = (Std1)RVA(0x6FDB03C0);
    const char *name = "DATATBLS_GetMonLvlTxtRecord";
    uint32_t va = 0x6FDB03C0u;
    uint32_t *pBase = (uint32_t *)(uintptr_t)RVA(0x6FDF0B54);
    uint32_t *pCnt = (uint32_t *)(uintptr_t)RVA(0x6FDF0B58);
    uint32_t origBase = *pBase;
    uint32_t origCnt = *pCnt;

    *pBase = 0x20004000u;
    *pCnt = 6;
    const int32_t lvls[5] = { -3, 0, 3, 6, 50 };
    for (int i = 0; i < 5; i++) {
      char cid[32];
      sprintf(cid, "monlvl_%d", i);
      reset_arena();
      track_block((uint32_t)RVA(0x6FDF0B54), 8);
      uint32_t a0[1] = { (uint32_t)lvls[i] };
      uint32_t r = fn(a0[0]);
      emit_record(fp, va, name, cid, a0, 1, r, 0xFFFFFFFFu);
    }
    *pBase = origBase;
    *pCnt = origCnt;
  }

  /* 11. 0x6FDBE0C0 DATATBLS_GetLevelMonsterLevel */
  {
    Std3 fn = (Std3)RVA(0x6FDBE0C0);
    const char *name = "DATATBLS_GetLevelMonsterLevel";
    uint32_t va = 0x6FDBE0C0u;
    uint32_t *pSgpt = (uint32_t *)(uintptr_t)RVA(0x6FDE9E1C);
    uint32_t origSgpt = *pSgpt;

    const uint32_t cases[8][3] = {
      { 1, 3, 0 },
      { 0, 0, 0 },
      { 0xFFFFFFFFu, 1, 1 },
      { 3, 0, 0 },
      { 1, 0, 0 },
      { 1, 2, 0 },
      { 1, 1, 1 },
      { 2, 0, 0 }
    };
    for (int i = 0; i < 8; i++) {
      char cid[32];
      sprintf(cid, "lvl_mlvl_%d", i);
      reset_arena();
      uint32_t dt = PTR(0x1000);
      uint32_t lvls = PTR(0x2000);
      w16(lvls + 1 * 0x220 + 0x10, 12);
      w16(lvls + 1 * 0x220 + 0x12, 42);
      w16(lvls + 1 * 0x220 + 0x14, 75);
      w16(lvls + 1 * 0x220 + 0x16, 15);
      w16(lvls + 1 * 0x220 + 0x18, 48);
      w16(lvls + 1 * 0x220 + 0x1A, 85);
      w16(lvls + 2 * 0x220 + 0x10, 0xFFFBu);
      w16(lvls + 2 * 0x220 + 0x16, 0xFFF0u);
      w32(dt + 0xC58, lvls);
      w32(dt + 0xC5C, 3);
      *pSgpt = dt;
      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block(dt + 0xC58, 8);
      track_block(lvls + 1 * 0x220, 0x20);
      track_block(lvls + 2 * 0x220, 0x20);
      uint32_t r = fn(cases[i][0], cases[i][1], cases[i][2]);
      emit_record(fp, va, name, cid, cases[i], 3, r, 0xFFFFFFFFu);
    }

    *pSgpt = origSgpt;
  }

  /* 12, 13, 14. Constant pointer getters (`0x6FDC1480`, `0x6FDC1520`, `0x6FDC1660`) */
  {
    const uint32_t vas[3] = { 0x6FDC1480u, 0x6FDC1520u, 0x6FDC1660u };
    const char *names[3] = {
      "DATATBLS_GetBooksTxtRecordCountPtr",
      "DATATBLS_GetQualityItemsTxtRecordCountPtr",
      "DATATBLS_GetBeltsTxtRecordCountPtr"
    };
    for (int i = 0; i < 3; i++) {
      Std0 fn = (Std0)RVA(vas[i]);
      for (int c = 0; c < 4; c++) {
        char cid[32];
        sprintf(cid, "const_ptr_%d", c);
        reset_arena();
        uint32_t r = fn();
        emit_record(fp, vas[i], names[i], cid, NULL, 0, r, 0xFFFFFFFFu);
      }
    }
  }

  /* 15. 0x6FDCF550 UNITS_IsPointWithinRadius */
  {
    Std3 fn = (Std3)RVA(0x6FDCF550);
    const char *name = "UNITS_IsPointWithinRadius";
    uint32_t va = 0x6FDCF550u;
    uint32_t u = PTR(0x0100);
    uint32_t p = PTR(0x0200);
    uint32_t pt = PTR(0x0300);

    /* Case 0: unitType=0, pPath != 0, on boundary (dx=3, dy=4, r=5 -> 25 <= 25 -> 1) */
    reset_arena();
    w32(u + 0x00, 0); w32(u + 0x2C, p);
    w16(p + 0x02, 100); w16(p + 0x06, 200);
    w32(pt + 0x00, 103); w32(pt + 0x04, 204);
    track_block(u, 0x30); track_block(p, 0x20); track_block(pt, 8);
    {
      uint32_t args[3] = { u, pt, 5 };
      uint32_t r = fn(args[0], args[1], args[2]);
      emit_record(fp, va, name, "type0_on_boundary", args, 3, r, 0xFFFFFFFFu);
    }

    /* Case 1: unitType=1, pPath != 0, outside (dx=3, dy=4, r=4 -> 25 <= 16 -> 0) */
    reset_arena();
    w32(u + 0x00, 1); w32(u + 0x2C, p);
    w16(p + 0x02, 100); w16(p + 0x06, 200);
    w32(pt + 0x00, 103); w32(pt + 0x04, 204);
    track_block(u, 0x30); track_block(p, 0x20); track_block(pt, 8);
    {
      uint32_t args[3] = { u, pt, 4 };
      uint32_t r = fn(args[0], args[1], args[2]);
      emit_record(fp, va, name, "type1_outside", args, 3, r, 0xFFFFFFFFu);
    }

    /* Case 2: unitType=3, pPath == 0 (ux=0, uy=0), inside */
    reset_arena();
    w32(u + 0x00, 3); w32(u + 0x2C, 0);
    w32(pt + 0x00, 2); w32(pt + 0x04, 2);
    track_block(u, 0x30); track_block(pt, 8);
    {
      uint32_t args[3] = { u, pt, 3 };
      uint32_t r = fn(args[0], args[1], args[2]);
      emit_record(fp, va, name, "type3_null_path_inside", args, 3, r, 0xFFFFFFFFu);
    }

    /* Case 3: unitType=2, pPath != 0 (+0x0C, +0x10), inside */
    reset_arena();
    w32(u + 0x00, 2); w32(u + 0x2C, p);
    w32(p + 0x0C, 500); w32(p + 0x10, 600);
    w32(pt + 0x00, 494); w32(pt + 0x04, 592);
    track_block(u, 0x30); track_block(p, 0x20); track_block(pt, 8);
    {
      uint32_t args[3] = { u, pt, 10 };
      uint32_t r = fn(args[0], args[1], args[2]);
      emit_record(fp, va, name, "type2_static_inside", args, 3, r, 0xFFFFFFFFu);
    }

    /* Case 4: unitType=4, pPath != 0 (+0x0C, +0x10), outside */
    reset_arena();
    w32(u + 0x00, 4); w32(u + 0x2C, p);
    w32(p + 0x0C, 500); w32(p + 0x10, 600);
    w32(pt + 0x00, 494); w32(pt + 0x04, 592);
    track_block(u, 0x30); track_block(p, 0x20); track_block(pt, 8);
    {
      uint32_t args[3] = { u, pt, 9 };
      uint32_t r = fn(args[0], args[1], args[2]);
      emit_record(fp, va, name, "type4_static_outside", args, 3, r, 0xFFFFFFFFu);
    }

    /* Case 5: unitType=5, pPath != 0, inside */
    reset_arena();
    w32(u + 0x00, 5); w32(u + 0x2C, p);
    w32(p + 0x0C, 500); w32(p + 0x10, 600);
    w32(pt + 0x00, 494); w32(pt + 0x04, 592);
    track_block(u, 0x30); track_block(p, 0x20); track_block(pt, 8);
    {
      uint32_t args[3] = { u, pt, 12 };
      uint32_t r = fn(args[0], args[1], args[2]);
      emit_record(fp, va, name, "type5_static_inside", args, 3, r, 0xFFFFFFFFu);
    }

    /* Case 6: unitType=6 (default case -> ux=0, uy=0), outside */
    reset_arena();
    w32(u + 0x00, 6);
    w32(pt + 0x00, 5); w32(pt + 0x04, 5);
    track_block(u, 0x30); track_block(pt, 8);
    {
      uint32_t args[3] = { u, pt, 7 };
      uint32_t r = fn(args[0], args[1], args[2]);
      emit_record(fp, va, name, "type6_default_outside", args, 3, r, 0xFFFFFFFFu);
    }
  }
}

int main(int argc, char **argv) {
  const char *out_b021 = (argc > 1) ? argv[1] : "b021-vectors.ndjson";
  const char *out_b024 = (argc > 2) ? argv[2] : "b024-vectors.ndjson";

  g_arena = (uint8_t *)VirtualAlloc((void *)ARENA_ADDR, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if (!g_arena || (uintptr_t)g_arena != ARENA_ADDR) {
    fprintf(stderr, "VirtualAlloc at 0x%08X failed (got %p, err=%lu)\n", ARENA_ADDR, (void *)g_arena, GetLastError());
    return 2;
  }

  HMODULE hMod = LoadLibraryA("D2Common.dll");
  if (!hMod) {
    fprintf(stderr, "LoadLibraryA(D2Common.dll) failed: %lu\n", GetLastError());
    return 1;
  }
  g_base = (uintptr_t)hMod;

  FILE *fp21 = fopen(out_b021, "wb");
  if (!fp21) {
    fprintf(stderr, "fopen(%s) failed\n", out_b021);
    return 3;
  }
  emit_b021(fp21);
  fclose(fp21);

  FILE *fp24 = fopen(out_b024, "wb");
  if (!fp24) {
    fprintf(stderr, "fopen(%s) failed\n", out_b024);
    return 4;
  }
  emit_b024(fp24);
  fclose(fp24);

  printf("Emitted Lane B It5 vectors: %s and %s (D2Common base=0x%08X)\n", out_b021, out_b024, (unsigned)g_base);
  fflush(stdout);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
