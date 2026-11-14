/*
 * Standalone MinGW real-DLL differential vector emitter for K1 Lane C (B001 + B007, 30 functions).
 *
 * Loads the real Diablo II v1.13c D2Common.dll (image base 0x6FD50000) under Wine, allocates a
 * deterministic scratch arena at 0x20000000, executes all 12 B001 functions and 18 B007 functions
 * across normal and boundary/edge inputs, and writes NDJSON records containing:
 *   - va, name, caseId, args, retMask
 *   - pre:  [{addr, hex}, ...]  (exact memory blocks before the DLL call)
 *   - eax:  uint32 return value from the real DLL (masked by retMask)
 *   - post: [{addr, hex}, ...]  (exact memory blocks after the DLL call)
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
#define MEM(off) (g_arena + (uint32_t)(off))

typedef struct {
  uint32_t addr;
  uint32_t len;
  uint8_t *pre;
  uint8_t *post;
} MemBlock;

#define MAX_BLOCKS 16
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

/* Calling-convention thunks */
typedef uint32_t(__stdcall *Std1)(uint32_t);
typedef uint32_t(__stdcall *Std2)(uint32_t, uint32_t);
typedef uint32_t(__stdcall *Std3)(uint32_t, uint32_t, uint32_t);
typedef uint32_t(__stdcall *Std4)(uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t(__stdcall *Std6)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t(__fastcall *Fast2)(uint32_t, uint32_t);

/* 0x6FD51330: eax=pRoom, ebx=nX, edi=nY; plain ret */
static uint32_t call_6FD51330(uint32_t pRoom, uint32_t nX, uint32_t nY) {
  uintptr_t fn = RVA(0x6FD51330);
  uint32_t r;
  __asm__ volatile(
    "call *%4"
    : "=a"(r)
    : "a"(pRoom), "b"(nX), "D"(nY), "S"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FD59C60: esi=pDrlgMap + 1 stack arg (nPops); ret 4 */
static void call_6FD59C60(uint32_t pDrlgMap, uint32_t nPops) {
  uintptr_t fn = RVA(0x6FD59C60);
  __asm__ volatile(
    "pushl %1\n\t"
    "call *%2"
    :
    : "S"(pDrlgMap), "r"(nPops), "r"(fn)
    : "eax", "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FD7D320: eax=nLevelId; plain ret */
static uint32_t call_6FD7D320(uint32_t nLevelId) {
  uintptr_t fn = RVA(0x6FD7D320);
  uint32_t r;
  __asm__ volatile(
    "call *%2"
    : "=a"(r)
    : "a"(nLevelId), "S"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FDBC950: esi=nLevelId; plain ret */
static uint32_t call_6FDBC950(uint32_t nLevelId) {
  uintptr_t fn = RVA(0x6FDBC950);
  uint32_t r;
  __asm__ volatile(
    "call *%2"
    : "=a"(r)
    : "S"(nLevelId), "b"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FD5CEB0: eax=pPath, ecx=nRate; plain ret */
static void call_6FD5CEB0(uint32_t pPath, uint32_t nRate) {
  uintptr_t fn = RVA(0x6FD5CEB0);
  uint32_t a = pPath, c = nRate;
  __asm__ volatile(
    "call *%2"
    : "+a"(a), "+c"(c)
    : "S"(fn)
    : "edx", "memory", "cc"
  );
}

/* 0x6FD68310: edx=pPoints + 3 stack args (dwStartPt, pOut, nPoints); ret 0xC */
static __attribute__((noinline)) uint32_t call_6FD68310(uint32_t pPoints, uint32_t dwStartPt, uint32_t pOut, uint32_t nPoints) {
  uintptr_t fn = RVA(0x6FD68310);
  uint32_t sargs[3] = {dwStartPt, pOut, nPoints};
  uint32_t r, d = pPoints;
  __asm__ volatile(
    "pushl 8(%2)\n\t"
    "pushl 4(%2)\n\t"
    "pushl 0(%2)\n\t"
    "call *%3"
    : "=a"(r), "+d"(d)
    : "S"(sargs), "a"(fn)
    : "ecx", "memory", "cc"
  );
  return r;
}

/* 0x6FD684C0: edi=pOut + 4 stack args (dwStartPt, dwEndPt, nMax, pDir); ret 0x10 */
static __attribute__((noinline)) uint32_t call_6FD684C0(uint32_t pOut, uint32_t dwStartPt, uint32_t dwEndPt, uint32_t nMax, uint32_t pDir) {
  uintptr_t fn = RVA(0x6FD684C0);
  uint32_t sargs[4] = {dwStartPt, dwEndPt, nMax, pDir};
  uint32_t r, D = pOut;
  __asm__ volatile(
    "pushl 12(%2)\n\t"
    "pushl 8(%2)\n\t"
    "pushl 4(%2)\n\t"
    "pushl 0(%2)\n\t"
    "call *%3"
    : "=a"(r), "+D"(D)
    : "S"(sargs), "a"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

static void wr32(uint32_t off, uint32_t v) { *(uint32_t *)MEM(off) = v; }
static void wr16(uint32_t off, uint16_t v) { *(uint16_t *)MEM(off) = v; }
static void wr8(uint32_t off, uint8_t v)   { *(uint8_t *)MEM(off) = v; }

static void emit_b001(FILE *fp) {
  /* 1. 0x6FD51330 DUNGEON_GetRoomAtPosition */
  {
    reset_arena();
    uint32_t args[3] = {0, 100, 200};
    emit_record(fp, 0x6FD51330, "DUNGEON_GetRoomAtPosition", "null_room", args, 3, call_6FD51330(0, 100, 200), 0xFFFFFFFFu);

    /* Room A @ 0x0100 (X=100, Y=200, W=20, H=30), nearList @ 0x0500: [NULL, RoomB(120,200,15,10), NULL, RoomC(-50,-40,20,20), RoomOverflow(0x7FFFFFF0,0,0x20,10)] */
    struct { const char *id; int32_t x; int32_t y; uint32_t nNear; } cases[] = {
      {"self_min_corner", 100, 200, 5},
      {"self_interior", 110, 215, 5},
      {"self_max_inclusive", 119, 229, 5},
      {"self_miss_x_low", 99, 210, 5},
      {"self_miss_x_high_hit_nearB", 120, 200, 5},
      {"nearB_max_inclusive", 134, 209, 5},
      {"nearB_miss_x_high", 135, 200, 5},
      {"nearB_miss_y_high", 120, 210, 5},
      {"self_miss_y_low", 110, 199, 5},
      {"self_miss_y_high", 110, 230, 5},
      {"nearC_neg_min_corner", -50, -40, 5},
      {"nearC_neg_max_inclusive", -31, -21, 5},
      {"nearC_neg_miss_x", -51, -40, 5},
      {"nearC_neg_miss_y", -30, -20, 5},
      {"near_overflow_sum_wraps_neg", 0x7FFFFFF5, 5, 5},
      {"near_count_zero", 125, 205, 0},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      uint32_t rA = 0x0100, rB = 0x0200, rC = 0x0300, rO = 0x0400, nearOff = 0x0500;
      wr32(rA + 0x00, PTR(nearOff));
      wr32(rA + 0x24, cases[i].nNear);
      wr32(rA + 0x4C, 100u); wr32(rA + 0x50, 200u); wr32(rA + 0x54, 20u); wr32(rA + 0x58, 30u);

      wr32(rB + 0x4C, 120u); wr32(rB + 0x50, 200u); wr32(rB + 0x54, 15u); wr32(rB + 0x58, 10u);
      wr32(rC + 0x4C, (uint32_t)-50); wr32(rC + 0x50, (uint32_t)-40); wr32(rC + 0x54, 20u); wr32(rC + 0x58, 20u);
      wr32(rO + 0x4C, 0x7FFFFFF0u); wr32(rO + 0x50, 0u); wr32(rO + 0x54, 0x20u); wr32(rO + 0x58, 10u);

      wr32(nearOff + 0, 0u);
      wr32(nearOff + 4, PTR(rB));
      wr32(nearOff + 8, 0u);
      wr32(nearOff + 12, PTR(rC));
      wr32(nearOff + 16, PTR(rO));

      track_block(PTR(rA), 0x80);
      track_block(PTR(rB), 0x80);
      track_block(PTR(rC), 0x80);
      track_block(PTR(rO), 0x80);
      track_block(PTR(nearOff), 20);

      uint32_t a[3] = {PTR(rA), (uint32_t)cases[i].x, (uint32_t)cases[i].y};
      uint32_t ret = call_6FD51330(a[0], a[1], a[2]);
      emit_record(fp, 0x6FD51330, "DUNGEON_GetRoomAtPosition", cases[i].id, a, 3, ret, 0xFFFFFFFFu);
    }
  }

  /* 2. 0x6FD59C60 DRLGPRESET_FinalizePopsLocations */
  {
    int32_t zero_neg[] = {0, -1, (int32_t)0x80000000u};
    const char *zn_names[] = {"npops_zero", "npops_neg1", "npops_int_min"};
    for (int k = 0; k < 3; k++) {
      reset_arena();
      uint32_t mapOff = 0x0100, idxOff = 0x0200, locOff = 0x0300;
      wr32(mapOff + 0x10, 100u); wr32(mapOff + 0x14, 200u);
      wr32(mapOff + 0x40, 0xAAAAAAAAu);
      wr32(mapOff + 0x44, PTR(idxOff));
      wr32(mapOff + 0x50, PTR(locOff));
      memset(MEM(idxOff), 0xCC, 16);
      memset(MEM(locOff), 0xDD, 32);
      track_block(PTR(mapOff), 0x58);
      track_block(PTR(idxOff), 16);
      track_block(PTR(locOff), 32);
      uint32_t a[2] = {PTR(mapOff), (uint32_t)zero_neg[k]};
      call_6FD59C60(a[0], a[1]);
      emit_record(fp, 0x6FD59C60, "DRLGPRESET_FinalizePopsLocations", zn_names[k], a, 2, 0, 0);
    }

    /* Multi-entry case: ordered, inverted, equal negative with -5 trunc div, INT_MIN/INT_MAX/negative indices + canary tail */
    reset_arena();
    uint32_t mapOff = 0x0100, idxOff = 0x0200, locOff = 0x0300;
    wr32(mapOff + 0x10, 100u);
    wr32(mapOff + 0x14, (uint32_t)-50);
    wr32(mapOff + 0x40, 0u);
    wr32(mapOff + 0x44, PTR(idxOff));
    wr32(mapOff + 0x50, PTR(locOff));
    memset(MEM(idxOff), 0xAA, 10 * 4);
    memset(MEM(locOff), 0xBB, 10 * 16);

    int32_t rects[8][4] = {
      {10, 20, 15, 30},
      {50, 80, 40, 60},
      {-5, -5, -5, -5},
      {-20, 10, -30, -5},
      {0, 0, 0, 0},
      {1000, -1000, -1000, 1000},
      {0x7FFFFFF0, 5, 0x7FFFFFF5, 8},
      {-100, -200, -100, -199},
    };
    int32_t indices[8] = {0, 3, 4, -1, -3, -4, -5, (int32_t)0x80000000u};
    for (int i = 0; i < 8; i++) {
      wr32(locOff + i * 16 + 0, (uint32_t)rects[i][0]);
      wr32(locOff + i * 16 + 4, (uint32_t)rects[i][1]);
      wr32(locOff + i * 16 + 8, (uint32_t)rects[i][2]);
      wr32(locOff + i * 16 + 12, (uint32_t)rects[i][3]);
      wr32(idxOff + i * 4, (uint32_t)indices[i]);
    }
    track_block(PTR(mapOff), 0x58);
    track_block(PTR(idxOff), 10 * 4);
    track_block(PTR(locOff), 10 * 16);
    uint32_t a[2] = {PTR(mapOff), 8};
    call_6FD59C60(a[0], a[1]);
    emit_record(fp, 0x6FD59C60, "DRLGPRESET_FinalizePopsLocations", "eight_pops_trunc_div_and_canary", a, 2, 0, 0);
  }

  /* 3. 0x6FD59DD0 DRLGPRESET_MovePointerAndClear */
  {
    Fast2 fn = (Fast2)RVA(0x6FD59DD0);
    uint32_t vals[] = {0x12345678u, 0u, 0xFFFFFFFFu, 0x80000000u};
    const char *names[] = {"nonzero", "zero", "max_u32", "high_bit"};
    for (int i = 0; i < 4; i++) {
      reset_arena();
      wr32(0x100, vals[i]);
      wr32(0x104, 0xDEADBEEFu);
      track_block(PTR(0x100), 8);
      uint32_t a[2] = {PTR(0x100), PTR(0x104)};
      uint32_t ret = fn(a[0], a[1]);
      emit_record(fp, 0x6FD59DD0, "DRLGPRESET_MovePointerAndClear", names[i], a, 2, ret, 0xFFFFFFFFu);
    }
    /* Aliasing: ppSrc == ppDst */
    reset_arena();
    wr32(0x100, 0x12345678u);
    track_block(PTR(0x100), 4);
    uint32_t a[2] = {PTR(0x100), PTR(0x100)};
    uint32_t ret = fn(a[0], a[1]);
    emit_record(fp, 0x6FD59DD0, "DRLGPRESET_MovePointerAndClear", "alias_same_ptr", a, 2, ret, 0xFFFFFFFFu);
  }

  /* 4. 0x6FD7D320 DRLG_IsTownLevel */
  {
    int32_t lvls[] = {
      0, 1, 2, 3, 39, 40, 41, 74, 75, 76, 102, 103, 104, 108, 109, 110, 136,
      -1, -109, 0x7FFFFFFF, (int32_t)0x80000000u
    };
    for (unsigned i = 0; i < sizeof(lvls) / sizeof(lvls[0]); i++) {
      reset_arena();
      char cid[32];
      snprintf(cid, sizeof(cid), "lvl_%d", lvls[i]);
      uint32_t a[1] = {(uint32_t)lvls[i]};
      uint32_t ret = call_6FD7D320(a[0]);
      emit_record(fp, 0x6FD7D320, "DRLG_IsTownLevel", cid, a, 1, ret, 0xFFFFFFFFu);
    }
  }

  /* 5. 0x6FD8B6B0 DUNGEON_IncreaseRoomPlayerCount */
  {
    Std1 fn = (Std1)RVA(0x6FD8B6B0);
    reset_arena();
    uint32_t a0[1] = {0};
    fn(0);
    emit_record(fp, 0x6FD8B6B0, "DUNGEON_IncreaseRoomPlayerCount", "null_room", a0, 1, 0, 0);

    uint32_t init_vals[] = {0u, 1u, 42u, 0x7FFFFFFFu, 0xFFFFFFFFu};
    const char *names[] = {"from_0", "from_1", "from_42", "from_int_max", "from_u32_max_wrap"};
    for (int i = 0; i < 5; i++) {
      reset_arena();
      memset(MEM(0x100), 0x55, 0x80);
      wr32(0x100 + 0x28, init_vals[i]);
      track_block(PTR(0x100), 0x80);
      uint32_t a[1] = {PTR(0x100)};
      fn(a[0]);
      emit_record(fp, 0x6FD8B6B0, "DUNGEON_IncreaseRoomPlayerCount", names[i], a, 1, 0, 0);
    }
  }

  /* 6. 0x6FD8B710 DUNGEON_FindRoomBySubtileCoordinates */
  {
    Std3 fn = (Std3)RVA(0x6FD8B710);
    reset_arena();
    uint32_t a0[3] = {0, 10, 20};
    emit_record(fp, 0x6FD8B710, "DUNGEON_FindRoomBySubtileCoordinates", "null_act", a0, 3, fn(0, 10, 20), 0xFFFFFFFFu);

    reset_arena();
    wr32(0x100 + 0x10, 0u);
    track_block(PTR(0x100), 0x60);
    uint32_t a1[3] = {PTR(0x100), 10, 20};
    emit_record(fp, 0x6FD8B710, "DUNGEON_FindRoomBySubtileCoordinates", "empty_room_list", a1, 3, fn(a1[0], 10, 20), 0xFFFFFFFFu);

    struct { const char *id; int32_t x; int32_t y; } q[] = {
      {"hit_room1_min", 10, 20},
      {"hit_room1_overlap_first_wins", 15, 25},
      {"hit_room3_past_room1_x", 20, 25},
      {"hit_room2_neg_coords", -30, -20},
      {"hit_room2_neg_max_incl", -16, -6},
      {"miss_room2_neg_excl", -15, -5},
      {"miss_all_x_low", 9, 20},
      {"miss_all_y_low", 10, 19},
      {"miss_overflow_room", 0x7FFFFFF5, 2},
    };
    for (unsigned i = 0; i < sizeof(q) / sizeof(q[0]); i++) {
      reset_arena();
      uint32_t act = 0x100, r1 = 0x200, r2 = 0x300, rO = 0x400, r3 = 0x500;
      wr32(act + 0x10, PTR(r1));
      wr32(r1 + 0x4C, 10u); wr32(r1 + 0x50, 20u); wr32(r1 + 0x54, 10u); wr32(r1 + 0x58, 10u); wr32(r1 + 0x7C, PTR(r2));
      wr32(r2 + 0x4C, (uint32_t)-30); wr32(r2 + 0x50, (uint32_t)-20); wr32(r2 + 0x54, 15u); wr32(r2 + 0x58, 15u); wr32(r2 + 0x7C, PTR(rO));
      wr32(rO + 0x4C, 0x7FFFFFF0u); wr32(rO + 0x50, 0u); wr32(rO + 0x54, 0x20u); wr32(rO + 0x58, 10u); wr32(rO + 0x7C, PTR(r3));
      wr32(r3 + 0x4C, 10u); wr32(r3 + 0x50, 20u); wr32(r3 + 0x54, 20u); wr32(r3 + 0x58, 20u); wr32(r3 + 0x7C, 0u);
      track_block(PTR(act), 0x60);
      track_block(PTR(r1), 0x80);
      track_block(PTR(r2), 0x80);
      track_block(PTR(rO), 0x80);
      track_block(PTR(r3), 0x80);
      uint32_t a[3] = {PTR(act), (uint32_t)q[i].x, (uint32_t)q[i].y};
      uint32_t ret = fn(a[0], a[1], a[2]);
      emit_record(fp, 0x6FD8B710, "DUNGEON_FindRoomBySubtileCoordinates", q[i].id, a, 3, ret, 0xFFFFFFFFu);
    }
  }

  /* 7. 0x6FD8BB50 DUNGEON_GetFloorTilesFromRoom */
  {
    Std2 fn = (Std2)RVA(0x6FD8BB50);
    /* NULL room */
    reset_arena();
    wr32(0x300, 0xDEADBEEFu);
    track_block(PTR(0x300), 4);
    uint32_t a0[2] = {0, PTR(0x300)};
    emit_record(fp, 0x6FD8BB50, "DUNGEON_GetFloorTilesFromRoom", "null_room", a0, 2, fn(0, PTR(0x300)), 0xFFFFFFFFu);

    /* Room with pRoomTiles == NULL */
    reset_arena();
    wr32(0x100 + 0x08, 0u);
    wr32(0x300, 0xDEADBEEFu);
    track_block(PTR(0x100), 0x80);
    track_block(PTR(0x300), 4);
    uint32_t a1[2] = {PTR(0x100), PTR(0x300)};
    emit_record(fp, 0x6FD8BB50, "DUNGEON_GetFloorTilesFromRoom", "null_tiles_ptr", a1, 2, fn(a1[0], a1[1]), 0xFFFFFFFFu);

    /* Room with valid pRoomTiles (normal + boundary) */
    uint32_t pFloorVals[] = {0x20005000u, 0u, 0xFFFFFFFFu};
    uint32_t nFloorVals[] = {17u, 0u, 0xFFFFFFFFu};
    const char *names[] = {"valid_17", "valid_zero", "valid_max_u32"};
    for (int i = 0; i < 3; i++) {
      reset_arena();
      wr32(0x100 + 0x08, PTR(0x200));
      wr32(0x200 + 0x08, pFloorVals[i]);
      wr32(0x200 + 0x0C, nFloorVals[i]);
      wr32(0x300, 0xAAAAAAAAu);
      track_block(PTR(0x100), 0x80);
      track_block(PTR(0x200), 0x18);
      track_block(PTR(0x300), 4);
      uint32_t a[2] = {PTR(0x100), PTR(0x300)};
      emit_record(fp, 0x6FD8BB50, "DUNGEON_GetFloorTilesFromRoom", names[i], a, 2, fn(a[0], a[1]), 0xFFFFFFFFu);
    }
  }

  /* 8. 0x6FD8BC10 DUNGEON_ToggleHasPortalFlag */
  {
    Std2 fn = (Std2)RVA(0x6FD8BC10);
    reset_arena();
    uint32_t a0[2] = {0, 0};
    fn(0, 0);
    emit_record(fp, 0x6FD8BC10, "DUNGEON_ToggleHasPortalFlag", "null_room", a0, 2, 0, 0);

    struct { const char *id; uint32_t initFlags; uint32_t bReset; } cases[] = {
      {"set_from_zero", 0u, 0u},
      {"set_idempotent", 0x00400000u, 0u},
      {"set_preserve_bits", 0xABC80005u, 0u},
      {"clear_bReset_1", 0xFFFFFFFFu, 1u},
      {"clear_bReset_neg1", 0x00400000u, 0xFFFFFFFFu},
      {"clear_bReset_highbit", 0x00400001u, 0x80000000u},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100 + 0x10, PTR(0x200));
      wr32(0x200 + 0x28, cases[i].initFlags);
      track_block(PTR(0x100), 0x80);
      track_block(PTR(0x200), 0xEC);
      uint32_t a[2] = {PTR(0x100), cases[i].bReset};
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD8BC10, "DUNGEON_ToggleHasPortalFlag", cases[i].id, a, 2, 0, 0);
    }
  }

  /* 9. 0x6FD8BC40 DUNGEON_GetPortalLevelBit */
  {
    Std1 fn = (Std1)RVA(0x6FD8BC40);
    uint32_t gArrVa = (uint32_t)RVA(0x6FDF1420);
    uint32_t gCntVa = (uint32_t)RVA(0x6FDF1424);

    /* count = 0 and count = -3 */
    int32_t bad_cnts[] = {0, -3};
    const char *bad_names[] = {"count_zero", "count_neg"};
    for (int i = 0; i < 2; i++) {
      reset_arena();
      *(uint32_t *)(uintptr_t)gArrVa = PTR(0x100);
      *(int32_t *)(uintptr_t)gCntVa = bad_cnts[i];
      wr32(0x100, 1u);
      track_block(gArrVa, 8);
      track_block(PTR(0x100), 4);
      uint32_t a[1] = {1u};
      emit_record(fp, 0x6FD8BC40, "DUNGEON_GetPortalLevelBit", bad_names[i], a, 1, fn(1u), 0xFFFFFFFFu);
    }

    /* 33-entry table testing idx 0, 1, 4, duplicate, negative levelId, idx 31, idx 32 (shift wrap), and miss */
    int32_t queries[] = {1, 40, 109, 10, -7, 300, 301, 999};
    const char *qnames[] = {"idx_0", "idx_1", "idx_4", "dup_first_wins", "neg_level_id", "idx_31_highbit", "idx_32_shift_wrap", "miss"};
    for (int qi = 0; qi < 8; qi++) {
      reset_arena();
      for (int k = 0; k < 33; k++) wr32(0x100 + k * 4, (uint32_t)(1000 + k));
      wr32(0x100 + 0 * 4, 1u);
      wr32(0x100 + 1 * 4, 40u);
      wr32(0x100 + 2 * 4, 10u);
      wr32(0x100 + 3 * 4, (uint32_t)-7);
      wr32(0x100 + 4 * 4, 109u);
      wr32(0x100 + 5 * 4, 10u);
      wr32(0x100 + 31 * 4, 300u);
      wr32(0x100 + 32 * 4, 301u);
      *(uint32_t *)(uintptr_t)gArrVa = PTR(0x100);
      *(int32_t *)(uintptr_t)gCntVa = 33;
      track_block(gArrVa, 8);
      track_block(PTR(0x100), 33 * 4);
      uint32_t a[1] = {(uint32_t)queries[qi]};
      emit_record(fp, 0x6FD8BC40, "DUNGEON_GetPortalLevelBit", qnames[qi], a, 1, fn(a[0]), 0xFFFFFFFFu);
    }
  }

  /* 10. 0x6FD8BDA0 DUNGEON_CheckLOSDraw */
  {
    Std1 fn = (Std1)RVA(0x6FD8BDA0);
    reset_arena();
    uint32_t a0[1] = {0};
    emit_record(fp, 0x6FD8BDA0, "DUNGEON_CheckLOSDraw", "null_room", a0, 1, fn(0), 0xFFFFFFFFu);

    struct { const char *id; int32_t nType; uint32_t dwFlags; } cases[] = {
      {"type_0", 0, 0xFFFFFFFFu},
      {"type_1_outdoor", 1, 0u},
      {"type_2_flag_set", 2, 0x00080000u},
      {"type_2_flag_clear_others_set", 2, 0xFFF7FFFFu},
      {"type_2_all_flags", 2, 0xFFFFFFFFu},
      {"type_3_other", 3, 0xFFFFFFFFu},
      {"type_neg1", -1, 0xFFFFFFFFu},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100 + 0x10, PTR(0x200));
      wr32(0x200 + 0x28, cases[i].dwFlags);
      wr32(0x200 + 0x48, (uint32_t)cases[i].nType);
      track_block(PTR(0x100), 0x80);
      track_block(PTR(0x200), 0xEC);
      uint32_t a[1] = {PTR(0x100)};
      emit_record(fp, 0x6FD8BDA0, "DUNGEON_CheckLOSDraw", cases[i].id, a, 1, fn(a[0]), 0xFFFFFFFFu);
    }
  }

  /* 11. 0x6FD8C000 DUNGEON_GetLevelIdFromRoom */
  {
    Std1 fn = (Std1)RVA(0x6FD8C000);
    reset_arena();
    uint32_t a0[1] = {0};
    emit_record(fp, 0x6FD8C000, "DUNGEON_GetLevelIdFromRoom", "null_room", a0, 1, fn(0), 0xFFFFFFFFu);

    int32_t lvls[] = {0, 1, 39, 109, 136, -1, 0x7FFFFFFF, (int32_t)0x80000000u};
    for (unsigned i = 0; i < sizeof(lvls) / sizeof(lvls[0]); i++) {
      reset_arena();
      wr32(0x100 + 0x10, PTR(0x200));
      wr32(0x200 + 0x58, PTR(0x300));
      wr32(0x300 + 0x1D0, (uint32_t)lvls[i]);
      track_block(PTR(0x100), 0x80);
      track_block(PTR(0x200), 0xEC);
      track_block(PTR(0x300), 0x230);
      char cid[32];
      snprintf(cid, sizeof(cid), "lvl_%d", lvls[i]);
      uint32_t a[1] = {PTR(0x100)};
      emit_record(fp, 0x6FD8C000, "DUNGEON_GetLevelIdFromRoom", cid, a, 1, fn(a[0]), 0xFFFFFFFFu);
    }
  }

  /* 12. 0x6FDBC950 DATATBLS_GetLvlPrestTxtRecordFromLevelId */
  {
    uint32_t sgptVa = (uint32_t)RVA(0x6FDE9E1C);
    uint32_t dtPtr = *(uint32_t *)(uintptr_t)sgptVa;
    uint32_t gBaseVa = (uint32_t)RVA(0x6FDF0B3C);

    int32_t bad_cnts[] = {0, -2};
    const char *bad_names[] = {"count_zero", "count_neg"};
    for (int i = 0; i < 2; i++) {
      reset_arena();
      wr32(0x100 + 4, 7u);
      *(uint32_t *)(uintptr_t)gBaseVa = PTR(0x100);
      *(int32_t *)(uintptr_t)(dtPtr + 0xC68) = bad_cnts[i];
      track_block(sgptVa, 4);
      track_block(dtPtr + 0xC64, 8);
      track_block(PTR(0x100), 0x1B0);
      uint32_t a[1] = {7u};
      emit_record(fp, 0x6FDBC950, "DATATBLS_GetLvlPrestTxtRecordFromLevelId", bad_names[i], a, 1, call_6FDBC950(7u), 0xFFFFFFFFu);
    }

    int32_t q[] = {7, 5, -1, 0, 99};
    const char *qnames[] = {"match_first", "match_dup_first", "match_last_neg", "miss_zero", "miss_99"};
    for (int i = 0; i < 5; i++) {
      reset_arena();
      wr32(0x100 + 0 * 0x1B0 + 4, 7u);
      wr32(0x100 + 1 * 0x1B0 + 4, 5u);
      wr32(0x100 + 2 * 0x1B0 + 4, 5u);
      wr32(0x100 + 3 * 0x1B0 + 4, (uint32_t)-1);
      *(uint32_t *)(uintptr_t)gBaseVa = PTR(0x100);
      *(int32_t *)(uintptr_t)(dtPtr + 0xC68) = 4;
      track_block(sgptVa, 4);
      track_block(dtPtr + 0xC64, 8);
      track_block(PTR(0x100), 4 * 0x1B0);
      uint32_t a[1] = {(uint32_t)q[i]};
      emit_record(fp, 0x6FDBC950, "DATATBLS_GetLvlPrestTxtRecordFromLevelId", qnames[i], a, 1, call_6FDBC950(a[0]), 0xFFFFFFFFu);
    }
  }
}

static void emit_b007(FILE *fp) {
  /* 1. 0x6FD5CEB0 PATH_StepVelocity */
  {
    struct {
      const char *id;
      int32_t dirX, dirY, vel, maxVel, acc, cnt, rate;
    } cases[] = {
      {"acc_zero_rate_zero_default_1024", 4096, -2048, 1000, 1200, 0, 4, 0},
      {"acc_zero_rate_neg_default_1024", -3000, 1500, 800, 1200, 0, 10, -50},
      {"cnt_below_5_no_vel_step", 4096, 2048, 500, 1200, 200, 3, 1024},
      {"cnt_4_to_5_normal_step", 4096, -2048, 500, 1200, 200, 4, 1024},
      {"cnt_4_to_5_exact_max_keeps_acc", 4096, -2048, 1000, 1200, 200, 4, 1024},
      {"cnt_4_to_5_overshoot_clamps_and_clears_acc", 4096, -2048, 1000, 1200, 250, 4, 0},
      {"cnt_4_to_5_neg_acc_clamps_zero_keeps_acc", 4096, -2048, 100, 1200, -250, 4, 1024},
      {"cnt_6_already_above_5", -4095, -4095, 600, 2000, 100, 6, 512},
      {"custom_rate_2048_neg_odd_dir", -1337, 2777, 900, 1500, 0, 0, 2048},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100 + 0x6A, (uint32_t)cases[i].dirX);
      wr32(0x100 + 0x6E, (uint32_t)cases[i].dirY);
      wr32(0x100 + 0x72, 0xDEADBEEFu);
      wr32(0x100 + 0x76, 0xCAFEBABEu);
      wr32(0x100 + 0x7C, (uint32_t)cases[i].vel);
      wr32(0x100 + 0x84, (uint32_t)cases[i].maxVel);
      wr32(0x100 + 0x88, (uint32_t)cases[i].acc);
      wr32(0x100 + 0x8C, (uint32_t)cases[i].cnt);
      track_block(PTR(0x100), 0x200);
      uint32_t a[2] = {PTR(0x100), (uint32_t)cases[i].rate};
      call_6FD5CEB0(a[0], a[1]);
      emit_record(fp, 0x6FD5CEB0, "PATH_StepVelocity", cases[i].id, a, 2, 0, 0);
    }
  }

  /* 2. 0x6FD5CF40 PATH_GetDirectionVector */
  {
    Std6 fn = (Std6)RVA(0x6FD5CF40);
    struct { const char *id; int32_t x1, y1, x2, y2; } cases[] = {
      {"same_point", 100, 100, 100, 100},
      {"axis_pos_x", 10, 10, 50, 10},
      {"axis_neg_x", 50, 10, 10, 10},
      {"axis_pos_y", 10, 10, 10, 50},
      {"axis_neg_y", 10, 50, 10, 10},
      {"diag_pp", 10, 10, 30, 30},
      {"diag_np", 30, 10, 10, 30},
      {"diag_pn", 10, 30, 30, 10},
      {"diag_nn", 30, 30, 10, 10},
      {"oct_xmajor_pp", 0, 0, 100, 37},
      {"oct_ymajor_pp", 0, 0, 37, 100},
      {"oct_xmajor_np", 100, 0, 0, 37},
      {"oct_ymajor_np", 37, 0, 0, 100},
      {"oct_xmajor_pn", 0, 37, 100, 0},
      {"oct_ymajor_pn", 0, 100, 37, 0},
      {"oct_xmajor_nn", 100, 37, 0, 0},
      {"oct_ymajor_nn", 37, 100, 0, 0},
      {"unsigned_cmp_both_neg", -20, -30, -5, -10},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100, 0xAAAAAAAAu);
      wr32(0x104, 0xBBBBBBBBu);
      wr32(0x200, 0xCCCCCCCCu);
      track_block(PTR(0x100), 8);
      track_block(PTR(0x200), 4);
      uint32_t a[6] = {
        (uint32_t)cases[i].x1, (uint32_t)cases[i].y1,
        (uint32_t)cases[i].x2, (uint32_t)cases[i].y2,
        PTR(0x100), PTR(0x200)
      };
      uint32_t ret = fn(a[0], a[1], a[2], a[3], a[4], a[5]);
      emit_record(fp, 0x6FD5CF40, "PATH_GetDirectionVector", cases[i].id, a, 6, ret, 0xFFFFFFFFu);
    }
  }

  /* 3. 0x6FD68310 PATH_SimplifyToLines */
  {
    #define PT(x, y) ((uint32_t)((uint16_t)(x)) | ((uint32_t)((uint16_t)(y)) << 16))
    /* n = -1, 0, 1 */
    int32_t small_n[] = {-1, 0, 1};
    const char *small_names[] = {"n_neg1", "n_zero", "n_one"};
    for (int i = 0; i < 3; i++) {
      reset_arena();
      wr32(0x100, PT(15, 25));
      memset(MEM(0x200), 0xCC, 16);
      track_block(PTR(0x100), 8);
      track_block(PTR(0x200), 16);
      uint32_t a[4] = {PTR(0x100), PT(10, 20), PTR(0x200), (uint32_t)small_n[i]};
      uint32_t ret = call_6FD68310(a[0], a[1], a[2], a[3]);
      emit_record(fp, 0x6FD68310, "PATH_SimplifyToLines", small_names[i], a, 4, ret, 0xFFFFFFFFu);
    }

    /* Collinear straight line (5 points) */
    {
      reset_arena();
      for (int i = 0; i < 5; i++) wr32(0x100 + i * 4, PT(11 + i, 20));
      memset(MEM(0x200), 0xCC, 32);
      track_block(PTR(0x100), 20);
      track_block(PTR(0x200), 32);
      uint32_t a[4] = {PTR(0x100), PT(10, 20), PTR(0x200), 5};
      uint32_t ret = call_6FD68310(a[0], a[1], a[2], a[3]);
      emit_record(fp, 0x6FD68310, "PATH_SimplifyToLines", "collinear_5pts", a, 4, ret, 0xFFFFFFFFu);
    }

    /* Staircase triggering sentinel dx=-2 (both pdx != dx and pdy != dy when run <= 0) */
    {
      reset_arena();
      uint32_t pts[] = {
        PT(11, 20), /* pdx=1, pdy=0 from start(10,20) */
        PT(11, 21), /* dx=0, dy=1 -> both changed, run=0 -> run=1, pdx=-2, pdy=1 */
        PT(12, 21), /* dx=1, dy=0 -> run=1>0 -> emits PT(11,21), run=0 */
        PT(13, 21), /* dx=1, dy=0 -> same, run=1 */
        PT(13, 22), /* dx=0, dy=1 -> run=1>0 -> emits PT(13,21), run=0 */
      };
      for (int i = 0; i < 5; i++) wr32(0x100 + i * 4, pts[i]);
      memset(MEM(0x200), 0xCC, 32);
      track_block(PTR(0x100), 20);
      track_block(PTR(0x200), 32);
      uint32_t a[4] = {PTR(0x100), PT(10, 20), PTR(0x200), 5};
      uint32_t ret = call_6FD68310(a[0], a[1], a[2], a[3]);
      emit_record(fp, 0x6FD68310, "PATH_SimplifyToLines", "staircase_sentinel", a, 4, ret, 0xFFFFFFFFu);
    }

    /* Sentinel collision: real dx == -2 && dy == pdy immediately after sentinel sets pdx = -2 */
    {
      reset_arena();
      uint32_t pts[] = {
        PT(11, 20), /* pdx=1, pdy=0 from start(10,20) */
        PT(11, 21), /* dx=0, dy=1 -> sentinel sets run=1, pdx=-2, pdy=1 */
        PT(9, 22),  /* dx=-2, dy=1 -> matches pdx==-2 && pdy==1 -> run++ instead of emitting! */
        PT(7, 23),  /* dx=-2, dy=1 -> matches again! */
      };
      for (int i = 0; i < 4; i++) wr32(0x100 + i * 4, pts[i]);
      memset(MEM(0x200), 0xCC, 32);
      track_block(PTR(0x100), 16);
      track_block(PTR(0x200), 32);
      uint32_t a[4] = {PTR(0x100), PT(10, 20), PTR(0x200), 4};
      uint32_t ret = call_6FD68310(a[0], a[1], a[2], a[3]);
      emit_record(fp, 0x6FD68310, "PATH_SimplifyToLines", "sentinel_dx_neg2_collision", a, 4, ret, 0xFFFFFFFFu);
    }
  }

  /* 4. 0x6FD684C0 PATH_BresenhamLine */
  {
    struct {
      const char *id;
      uint32_t p0, p1;
      int32_t nMax;
    } cases[] = {
      {"zero_delta", PT(10, 20), PT(10, 20), 10},
      {"vert_down_pos_y", PT(10, 20), PT(10, 24), 10},
      {"vert_up_neg_y", PT(10, 24), PT(10, 20), 10},
      {"horiz_right_pos_x", PT(10, 20), PT(14, 20), 10},
      {"horiz_left_neg_x", PT(14, 20), PT(10, 20), 10},
      {"diag_equal_pp", PT(10, 20), PT(13, 23), 10},
      {"diag_equal_nn", PT(13, 23), PT(10, 20), 10},
      {"xmajor_shallow_pp", PT(10, 20), PT(15, 22), 10},
      {"xmajor_shallow_np", PT(15, 20), PT(10, 22), 10},
      {"ymajor_steep_pn", PT(10, 25), PT(12, 20), 10},
      {"ymajor_steep_nn", PT(12, 25), PT(10, 20), 10},
      {"exact_limit_ok", PT(10, 20), PT(14, 20), 5},       /* dx=4 <= lim=4 */
      {"over_limit_horiz_fail", PT(10, 20), PT(14, 20), 4}, /* dx=4 > lim=3, sets *pDir=1 then fails */
      {"over_limit_vert_fail", PT(10, 20), PT(10, 24), 4},  /* dy=4 > lim=3, sets *pDir=2 then fails */
      {"over_limit_xmajor_fail", PT(10, 20), PT(15, 22), 5},/* dx=5 > lim=4 */
      {"over_limit_ymajor_fail", PT(10, 20), PT(12, 25), 5},/* dy=5 > lim=4 */
      {"nmax_zero_fail", PT(10, 20), PT(11, 20), 0},
      {"u16_wrap_x0_zero_left", PT(0, 5), PT(2, 5), 10},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      memset(MEM(0x100), 0xCC, 48);
      wr32(0x200, 0xDEADBEEFu);
      track_block(PTR(0x100), 48);
      track_block(PTR(0x200), 4);
      uint32_t a[5] = {PTR(0x100), cases[i].p0, cases[i].p1, (uint32_t)cases[i].nMax, PTR(0x200)};
      uint32_t ret = call_6FD684C0(a[0], a[1], a[2], a[3], a[4]);
      emit_record(fp, 0x6FD684C0, "PATH_BresenhamLine", cases[i].id, a, 5, ret, 0xFFFFFFFFu);
    }
    #undef PT
  }

  /* 5. 0x6FD84580 PATH_ComputeSquaredDistance */
  {
    Std4 fn = (Std4)RVA(0x6FD84580);
    struct { const char *id; int32_t x1, y1, x2, y2; } cases[] = {
      {"zeros", 0, 0, 0, 0},
      {"same_pt", 123, -456, 123, -456},
      {"pythag_3_4", 0, 0, 3, 4},
      {"neg_deltas", 10, -5, -2, 11},
      {"wrap_65536_to_0", 0, 0, 0x10000, 0},
      {"overflow_negative_i32", 0, 0, 46341, 0},
      {"int_min_delta", 0, 0, (int32_t)0x80000000u, 1},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      uint32_t a[4] = {(uint32_t)cases[i].x1, (uint32_t)cases[i].y1, (uint32_t)cases[i].x2, (uint32_t)cases[i].y2};
      uint32_t ret = fn(a[0], a[1], a[2], a[3]);
      emit_record(fp, 0x6FD84580, "PATH_ComputeSquaredDistance", cases[i].id, a, 4, ret, 0xFFFFFFFFu);
    }
  }

  /* 6 & 7. 0x6FD845B0 PATH_SetUnitCollisionPattern & 0x6FD845D0 PATH_GetUnitCollisionPattern */
  {
    Std2 fnSet = (Std2)RVA(0x6FD845B0);
    Std1 fnGet = (Std1)RVA(0x6FD845D0);
    uint32_t vals[] = {0u, 1u, 0x00008000u, 0x7FFFFFFFu, 0x80000000u, 0xFFFFFFFFu};
    const char *names[] = {"zero", "one", "mask_8000", "int_max", "int_min", "u32_max"};
    for (int i = 0; i < 6; i++) {
      reset_arena();
      wr32(0x100 + 0x2C, PTR(0x200));
      wr32(0x200 + 0x48, ~vals[i]);
      track_block(PTR(0x100), 0xF4);
      track_block(PTR(0x200), 0x200);
      uint32_t aSet[2] = {PTR(0x100), vals[i]};
      fnSet(aSet[0], aSet[1]);
      emit_record(fp, 0x6FD845B0, "PATH_SetUnitCollisionPattern", names[i], aSet, 2, 0, 0);

      reset_arena();
      wr32(0x100 + 0x2C, PTR(0x200));
      wr32(0x200 + 0x48, vals[i]);
      track_block(PTR(0x100), 0xF4);
      track_block(PTR(0x200), 0x200);
      uint32_t aGet[1] = {PTR(0x100)};
      uint32_t ret = fnGet(aGet[0]);
      emit_record(fp, 0x6FD845D0, "PATH_GetUnitCollisionPattern", names[i], aGet, 1, ret, 0xFFFFFFFFu);
    }
  }

  /* 8. 0x6FD84690 PATH_GetStepNum */
  {
    Std1 fn = (Std1)RVA(0x6FD84690);
    uint8_t vals[] = {0, 1, 18, 19, 0x7F, 0x80, 0xFF};
    const char *names[] = {"u8_0", "u8_1", "u8_18", "u8_19", "u8_127", "u8_128", "u8_255_to_256"};
    for (int i = 0; i < 7; i++) {
      reset_arena();
      memset(MEM(0x100 + 0x90), 0xAA, 8);
      wr8(0x100 + 0x93, vals[i]);
      track_block(PTR(0x100), 0x200);
      uint32_t a[1] = {PTR(0x100)};
      emit_record(fp, 0x6FD84690, "PATH_GetStepNum", names[i], a, 1, fn(a[0]), 0xFFFFFFFFu);
    }
  }

  /* 9. 0x6FD846A0 PATH_SetStepNum */
  {
    Std2 fn = (Std2)RVA(0x6FD846A0);
    reset_arena();
    uint32_t a0[2] = {0, 5};
    fn(0, 5);
    emit_record(fp, 0x6FD846A0, "PATH_SetStepNum", "null_path", a0, 2, 0, 0);

    uint32_t steps[] = {0u, 1u, 2u, 19u, 20u, 255u, 0x105u, 0x100u, 0x114u};
    const char *names[] = {"zero_resets_0", "one_stores_0", "two_stores_1", "19_stores_18", "20_clamps_0", "255_clamps_0", "trunc_0x105_stores_4", "trunc_0x100_stores_0", "trunc_0x114_stores_0"};
    for (int i = 0; i < 9; i++) {
      reset_arena();
      wr8(0x100 + 0x93, 0x77);
      track_block(PTR(0x100), 0x200);
      uint32_t a[2] = {PTR(0x100), steps[i]};
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD846A0, "PATH_SetStepNum", names[i], a, 2, 0, 0);
    }
  }

  /* 10. 0x6FD846D0 PATH_ClearPrevTargetCoord */
  {
    Std1 fn = (Std1)RVA(0x6FD846D0);
    uint16_t pairs[][2] = {{0x1234, 0x5678}, {0xFFFF, 0xFFFF}, {0, 0}, {0x8000, 0x0001}};
    const char *names[] = {"normal", "max_u16", "already_zero", "high_low"};
    for (int i = 0; i < 4; i++) {
      reset_arena();
      memset(MEM(0x100 + 0x10), 0xAA, 16);
      wr16(0x100 + 0x14, pairs[i][0]);
      wr16(0x100 + 0x16, pairs[i][1]);
      track_block(PTR(0x100), 0x200);
      uint32_t a[1] = {PTR(0x100)};
      fn(a[0]);
      emit_record(fp, 0x6FD846D0, "PATH_ClearPrevTargetCoord", names[i], a, 1, 0, 0);
    }
  }

  /* 11 & 12 & 13. 0x6FD84860 PATH_GetMaxDistance, 0x6FD84870 PATH_GetDistance, 0x6FD84880 PATH_SetDistance */
  {
    Std1 fnGetMax = (Std1)RVA(0x6FD84860);
    Std1 fnGet = (Std1)RVA(0x6FD84870);
    Std2 fnSet = (Std2)RVA(0x6FD84880);
    uint8_t bvals[] = {0, 1, 0x7F, 0x80, 0xFF};
    const char *bnames[] = {"u8_0", "u8_1", "u8_127", "u8_128", "u8_255"};
    for (int i = 0; i < 5; i++) {
      reset_arena();
      memset(MEM(0x100 + 0x90), 0xEE, 4);
      wr8(0x100 + 0x91, bvals[i]);
      track_block(PTR(0x100), 0x200);
      uint32_t a[1] = {PTR(0x100)};
      emit_record(fp, 0x6FD84860, "PATH_GetMaxDistance", bnames[i], a, 1, fnGetMax(a[0]), 0xFFu);

      reset_arena();
      memset(MEM(0x100 + 0x90), 0xEE, 4);
      wr8(0x100 + 0x90, bvals[i]);
      track_block(PTR(0x100), 0x200);
      emit_record(fp, 0x6FD84870, "PATH_GetDistance", bnames[i], a, 1, fnGet(a[0]), 0xFFu);
    }

    uint32_t svals[] = {0u, 1u, 0x7Fu, 0x80u, 0xFFu, 0x1234u, 0xFFFFFF00u};
    const char *snames[] = {"set_0", "set_1", "set_127", "set_128", "set_255", "trunc_0x1234", "trunc_0xffffff00"};
    for (int i = 0; i < 7; i++) {
      reset_arena();
      memset(MEM(0x100 + 0x90), 0xEE, 4);
      track_block(PTR(0x100), 0x200);
      uint32_t a[2] = {PTR(0x100), svals[i]};
      fnSet(a[0], a[1]);
      emit_record(fp, 0x6FD84880, "PATH_SetDistance", snames[i], a, 2, 0, 0);
    }
  }

  /* 14. 0x6FD848A0 PATH_GetType */
  {
    Std1 fn = (Std1)RVA(0x6FD848A0);
    uint32_t vals[] = {0u, 1u, 2u, 4u, 0x7FFFFFFFu, 0x80000000u, 0xFFFFFFFFu};
    const char *names[] = {"type_0", "type_1", "type_2", "type_4", "int_max", "int_min", "u32_max"};
    for (int i = 0; i < 7; i++) {
      reset_arena();
      wr32(0x100 + 0x3C, vals[i]);
      track_block(PTR(0x100), 0x200);
      uint32_t a[1] = {PTR(0x100)};
      emit_record(fp, 0x6FD848A0, "PATH_GetType", names[i], a, 1, fn(a[0]), 0xFFFFFFFFu);
    }
  }

  /* 15 & 16. 0x6FD848B0 PATH_SetMoveTestCollisionMask & 0x6FD848C0 PATH_GetMoveTestCollisionMask */
  {
    Std2 fnSet = (Std2)RVA(0x6FD848B0);
    Std1 fnGet = (Std1)RVA(0x6FD848C0);
    uint32_t vals[] = {0u, 1u, 0x1C09u, 0xFFFFu, 0x7FFFFFFFu, 0x80000000u, 0xFFFFFFFFu};
    const char *names[] = {"zero", "one", "mask_1c09", "u16_max", "int_max", "int_min", "u32_max"};
    for (int i = 0; i < 7; i++) {
      reset_arena();
      memset(MEM(0x100 + 0x4C), 0xAA, 12);
      track_block(PTR(0x100), 0x200);
      uint32_t aSet[2] = {PTR(0x100), vals[i]};
      fnSet(aSet[0], aSet[1]);
      emit_record(fp, 0x6FD848B0, "PATH_SetMoveTestCollisionMask", names[i], aSet, 2, 0, 0);

      reset_arena();
      wr32(0x100 + 0x50, vals[i]);
      track_block(PTR(0x100), 0x200);
      uint32_t aGet[1] = {PTR(0x100)};
      emit_record(fp, 0x6FD848C0, "PATH_GetMoveTestCollisionMask", names[i], aGet, 1, fnGet(aGet[0]), 0xFFFFFFFFu);
    }
  }

  /* 17. 0x6FD848D0 PATH_GetFootprintCollisionMask */
  {
    Std1 fn = (Std1)RVA(0x6FD848D0);
    reset_arena();
    uint32_t a0[1] = {0};
    emit_record(fp, 0x6FD848D0, "PATH_GetFootprintCollisionMask", "null_path_default_ffff", a0, 1, fn(0), 0xFFFFFFFFu);

    uint32_t vals[] = {0u, 1u, 0x0804u, 0xFFFFu, 0x12345678u, 0xFFFFFFFFu};
    const char *names[] = {"zero", "one", "mask_0804", "ffff", "dword_12345678", "u32_max"};
    for (int i = 0; i < 6; i++) {
      reset_arena();
      wr32(0x100 + 0x4C, vals[i]);
      track_block(PTR(0x100), 0x200);
      uint32_t a[1] = {PTR(0x100)};
      emit_record(fp, 0x6FD848D0, "PATH_GetFootprintCollisionMask", names[i], a, 1, fn(a[0]), 0xFFFFFFFFu);
    }
  }

  /* 18. 0x6FD848F0 PATH_GetTargetUnit */
  {
    Std1 fn = (Std1)RVA(0x6FD848F0);
    reset_arena();
    uint32_t a0[1] = {0};
    emit_record(fp, 0x6FD848F0, "PATH_GetTargetUnit", "null_path", a0, 1, fn(0), 0xFFFFFFFFu);

    uint32_t vals[] = {0u, 0x20001234u, 0x7FFFFFFFu, 0x80000000u, 0xFFFFFFFFu};
    const char *names[] = {"zero_target", "valid_ptr", "int_max", "int_min", "u32_max"};
    for (int i = 0; i < 5; i++) {
      reset_arena();
      wr32(0x100 + 0x58, vals[i]);
      track_block(PTR(0x100), 0x200);
      uint32_t a[1] = {PTR(0x100)};
      emit_record(fp, 0x6FD848F0, "PATH_GetTargetUnit", names[i], a, 1, fn(a[0]), 0xFFFFFFFFu);
    }
  }
}

typedef uint32_t(__stdcall *Std7)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);

/* 0x6FD5D0A0: edx=pPath + 1 stack arg (pOutStepVec); ret 4 */
static __attribute__((noinline)) uint32_t call_6FD5D0A0(uint32_t pPath, uint32_t pOutStepVec) {
  uintptr_t fn = RVA(0x6FD5D0A0);
  uint32_t r, d = pPath;
  __asm__ volatile(
    "pushl %2\n\t"
    "call *%3"
    : "=a"(r), "+d"(d)
    : "r"(pOutStepVec), "S"(fn)
    : "ecx", "memory", "cc"
  );
  return r;
}

/* 0x6FD67B70: eax=pNode, edi=ppRootNode; plain ret */
static __attribute__((noinline)) uint32_t call_6FD67B70(uint32_t pNode, uint32_t ppRootNode) {
  uintptr_t fn = RVA(0x6FD67B70);
  uint32_t r = pNode, D = ppRootNode;
  __asm__ volatile(
    "call *%2"
    : "+a"(r), "+D"(D)
    : "S"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FD94540: edx=pRoomEx, edi=ppOutRooms1; plain ret */
static __attribute__((noinline)) uint32_t call_6FD94540(uint32_t pRoomEx, uint32_t ppOutRooms1) {
  uintptr_t fn = RVA(0x6FD94540);
  uint32_t r, d = pRoomEx, D = ppOutRooms1;
  __asm__ volatile(
    "call *%3"
    : "=a"(r), "+d"(d), "+D"(D)
    : "S"(fn)
    : "ecx", "memory", "cc"
  );
  return r;
}

/* 0x6FD945A0: eax=nCount, esi=ppRoomsEx; plain ret */
static __attribute__((noinline)) void call_6FD945A0(uint32_t nCount, uint32_t ppRoomsEx) {
  uintptr_t fn = RVA(0x6FD945A0);
  uint32_t a = nCount, S = ppRoomsEx;
  __asm__ volatile(
    "call *%2"
    : "+a"(a), "+S"(S)
    : "D"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FD94740: eax=pRect, esi=nX, edi=nY; plain ret */
static __attribute__((noinline)) uint32_t call_6FD94740(uint32_t pRect, uint32_t nX, uint32_t nY) {
  uintptr_t fn = RVA(0x6FD94740);
  uint32_t r = pRect, S = nX, D = nY;
  __asm__ volatile(
    "call *%3"
    : "+a"(r), "+S"(S), "+D"(D)
    : "b"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FD94EB0: eax=pLevel, ebx=nMinDist, esi=pRoomEx1 + 1 stack arg (pRoomEx2); ret 4 */
static __attribute__((noinline)) uint32_t call_6FD94EB0(uint32_t pLevel, uint32_t nMinDist, uint32_t pRoomEx1, uint32_t pRoomEx2) {
  uintptr_t fn = RVA(0x6FD94EB0);
  uint32_t r = pLevel, b = nMinDist, S = pRoomEx1;
  __asm__ volatile(
    "pushl %3\n\t"
    "call *%4"
    : "+a"(r), "+b"(b), "+S"(S)
    : "r"(pRoomEx2), "D"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FD95640: eax=nStatId, ecx=pValue; plain ret */
static __attribute__((noinline)) uint32_t call_6FD95640(uint32_t nStatId, uint32_t pValue) {
  uintptr_t fn = RVA(0x6FD95640);
  uint32_t r = nStatId, c = pValue;
  __asm__ volatile(
    "call *%2"
    : "+a"(r), "+c"(c)
    : "S"(fn)
    : "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FDB81A0: esi=pRoomEx, ebx=dwPresetFlags + 3 stack args (bFloor, nX, nY); ret 0xC */
static __attribute__((noinline)) uint32_t call_6FDB81A0(uint32_t pRoomEx, uint32_t dwPresetFlags, uint32_t bFloor, uint32_t nX, uint32_t nY) {
  uintptr_t fn = RVA(0x6FDB81A0);
  uint32_t sargs[3] = {bFloor, nX, nY};
  uint32_t r, S = pRoomEx, b = dwPresetFlags;
  __asm__ volatile(
    "pushl 8(%3)\n\t"
    "pushl 4(%3)\n\t"
    "pushl 0(%3)\n\t"
    "call *%4"
    : "=a"(r), "+S"(S), "+b"(b)
    : "D"(sargs), "a"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FDB8340: ebx=bIsType9 + 2 stack args (nLevelId, dwTileFlags); ret 8 */
static __attribute__((noinline)) uint32_t call_6FDB8340(uint32_t bIsType9, uint32_t nLevelId, uint32_t dwTileFlags) {
  uintptr_t fn = RVA(0x6FDB8340);
  uint32_t sargs[2] = {nLevelId, dwTileFlags};
  uint32_t r, b = bIsType9;
  __asm__ volatile(
    "pushl 4(%2)\n\t"
    "pushl 0(%2)\n\t"
    "call *%3"
    : "=a"(r), "+b"(b)
    : "S"(sargs), "D"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FDB85D0: eax=pRoomEx, edx=bNoExtraHeight, ebx=pDefGrid, edi=pTypeGrid + 1 stack arg (bNoExtraWidth); ret 4 */
static __attribute__((noinline)) void call_6FDB85D0(uint32_t pRoomEx, uint32_t bNoExtraHeight, uint32_t pDefGrid, uint32_t pTypeGrid, uint32_t bNoExtraWidth) {
  uintptr_t fn = RVA(0x6FDB85D0);
  uint32_t a = pRoomEx, d = bNoExtraHeight, b = pDefGrid, D = pTypeGrid;
  __asm__ volatile(
    "pushl %4\n\t"
    "call *%5"
    : "+a"(a), "+d"(d), "+b"(b), "+D"(D)
    : "r"(bNoExtraWidth), "S"(fn)
    : "ecx", "memory", "cc"
  );
}

/* 0x6FDB8660: eax=pRoomEx + 4 stack args (pFlagGrid, bCheckRoomBounds, bNoExtraWidth, bNoExtraHeight); ret 0x10 */
static __attribute__((noinline)) void call_6FDB8660(uint32_t pRoomEx, uint32_t pFlagGrid, uint32_t bCheckRoomBounds, uint32_t bNoExtraWidth, uint32_t bNoExtraHeight) {
  uintptr_t fn = RVA(0x6FDB8660);
  uint32_t sargs[4] = {pFlagGrid, bCheckRoomBounds, bNoExtraWidth, bNoExtraHeight};
  uint32_t a = pRoomEx;
  __asm__ volatile(
    "pushl 12(%1)\n\t"
    "pushl 8(%1)\n\t"
    "pushl 4(%1)\n\t"
    "pushl 0(%1)\n\t"
    "call *%2"
    : "+a"(a)
    : "S"(sargs), "D"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FDB9DA0 / 0x6FDB9DB0: ecx=a, edx=b + 2 unused stack dwords; ret 8 */
static __attribute__((noinline)) uint32_t call_fastq_ret8(uintptr_t fn, uint32_t a, uint32_t b) {
  uint32_t r, c = a, d = b;
  __asm__ volatile(
    "pushl $0\n\t"
    "pushl $0\n\t"
    "call *%3"
    : "=a"(r), "+c"(c), "+d"(d)
    : "S"(fn)
    : "memory", "cc"
  );
  return r;
}

/* B016 register-convention thunks */
/* 0x6FD84E70: eax=pPath; plain ret */
static __attribute__((noinline)) void call_6FD84E70(uint32_t pPath) {
  uintptr_t fn = RVA(0x6FD84E70);
  uint32_t a = pPath;
  __asm__ volatile(
    "call *%1"
    : "+a"(a)
    : "S"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FD850B0: ecx=pPath, al=nDir; plain ret */
static __attribute__((noinline)) void call_6FD850B0(uint32_t pPath, uint32_t nDir) {
  uintptr_t fn = RVA(0x6FD850B0);
  uint32_t a = nDir, c = pPath;
  __asm__ volatile(
    "call *%2"
    : "+a"(a), "+c"(c)
    : "S"(fn)
    : "edx", "memory", "cc"
  );
}

/* 0x6FD85100: eax=pMonsterUnit; plain ret */
static __attribute__((noinline)) uint32_t call_6FD85100(uint32_t pMonsterUnit) {
  uintptr_t fn = RVA(0x6FD85100);
  uint32_t r = pMonsterUnit;
  __asm__ volatile(
    "call *%1"
    : "+a"(r)
    : "S"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FD8E110: eax=pVecX, ecx=pVecY; plain ret */
static __attribute__((noinline)) void call_6FD8E110(uint32_t pVecX, uint32_t pVecY) {
  uintptr_t fn = RVA(0x6FD8E110);
  uint32_t a = pVecX, c = pVecY;
  __asm__ volatile(
    "call *%2"
    : "+a"(a), "+c"(c)
    : "S"(fn)
    : "edx", "memory", "cc"
  );
}

/* 0x6FDC0650 / 0x6FDCAB50: eax=pPathInfo, ecx=pNode; plain ret */
static __attribute__((noinline)) uint32_t call_eax_ecx_ret(uintptr_t fn, uint32_t a, uint32_t c) {
  uint32_t r = a, C = c;
  __asm__ volatile(
    "call *%2"
    : "+a"(r), "+c"(C)
    : "S"(fn)
    : "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FDC07E0: eax=pContext, esi=pNode; plain ret */
static __attribute__((noinline)) void call_6FDC07E0(uint32_t pContext, uint32_t pNode) {
  uintptr_t fn = RVA(0x6FDC07E0);
  uint32_t a = pContext, S = pNode;
  __asm__ volatile(
    "call *%2"
    : "+a"(a), "+S"(S)
    : "D"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FDCAE20: edi=pContext, esi=pNode; plain ret */
static __attribute__((noinline)) void call_6FDCAE20(uint32_t pContext, uint32_t pNode) {
  uintptr_t fn = RVA(0x6FDCAE20);
  uint32_t D = pContext, S = pNode;
  __asm__ volatile(
    "call *%2"
    : "+D"(D), "+S"(S)
    : "b"(fn)
    : "eax", "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FDCB220: esi=pContext; plain ret */
static __attribute__((noinline)) uint32_t call_6FDCB220(uint32_t pContext) {
  uintptr_t fn = RVA(0x6FDCB220);
  uint32_t r, S = pContext;
  __asm__ volatile(
    "call *%2"
    : "=a"(r), "+S"(S)
    : "b"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

static void emit_b004(FILE *fp) {
  /* 1. 0x6FD5CE90 PATH_CheckFlag08 */
  {
    Std1 fn = (Std1)RVA(0x6FD5CE90);
    reset_arena();
    uint32_t a0[1] = {0};
    emit_record(fp, 0x6FD5CE90, "PATH_CheckFlag08", "null_path", a0, 1, fn(0), 0xFFFFFFFFu);

    uint32_t flags[] = {0u, 8u, 0xFFFFFFF7u, 0xFFFFFFFFu, 0x80000008u};
    const char *names[] = {"flags_0", "flags_8_only", "flags_all_but_8", "flags_all", "flags_high_and_8"};
    for (int i = 0; i < 5; i++) {
      reset_arena();
      wr32(0x100 + 0x34, flags[i]);
      track_block(PTR(0x100), 0x200);
      uint32_t a[1] = {PTR(0x100)};
      emit_record(fp, 0x6FD5CE90, "PATH_CheckFlag08", names[i], a, 1, fn(a[0]), 0xFFFFFFFFu);
    }
  }

  /* 2. 0x6FD5D0A0 PATH_CheckStepTargetDistance */
  {
    struct {
      const char *id;
      uint32_t pathType;
      uint32_t curIdx;
      uint16_t ptX, ptY;
      uint32_t precX, precY;
      int32_t velX, velY;
    } cases[] = {
      {"pathtype_4_early_zero", 4, 0, 10, 20, (10u << 16) + 0x8000u, (20u << 16) + 0x8000u, 1000, -500},
      {"within_threshold_xmajor_vel", 1, 2, 10, 20, (10u << 16) + 0x7E00u, (20u << 16) + 0x8100u, 1024, -512},
      {"within_threshold_ymajor_neg_vel", 2, 1, 15, 25, (15u << 16) + 0x8300u, (25u << 16) + 0x7D00u, 400, -1024},
      {"exact_boundary_equal_threshold", 0, 0, 5, 5, (5u << 16) + 0x8000u - 500u, (5u << 16) + 0x8000u + 500u, -500, 300},
      {"exceeds_dx_keeps_vel", 1, 0, 10, 20, (10u << 16) + 0x7000u, (20u << 16) + 0x8000u, 1024, 512},
      {"exceeds_dy_keeps_vel", 1, 3, 10, 20, (10u << 16) + 0x8000u, (20u << 16) + 0x9000u, 512, 1024},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100 + 0x00, cases[i].precX);
      wr32(0x100 + 0x04, cases[i].precY);
      wr32(0x100 + 0x24, cases[i].curIdx);
      wr32(0x100 + 0x3C, cases[i].pathType);
      wr32(0x100 + 0x72, (uint32_t)cases[i].velX);
      wr32(0x100 + 0x76, (uint32_t)cases[i].velY);
      wr16(0x100 + 0x9C + cases[i].curIdx * 4, cases[i].ptX);
      wr16(0x100 + 0x9E + cases[i].curIdx * 4, cases[i].ptY);
      wr32(0x300, 0xDEADBEEFu);
      wr32(0x304, 0xCAFEBABEu);
      track_block(PTR(0x100), 0x200);
      track_block(PTR(0x300), 8);
      uint32_t a[2] = {PTR(0x100), PTR(0x300)};
      uint32_t ret = call_6FD5D0A0(a[0], a[1]);
      emit_record(fp, 0x6FD5D0A0, "PATH_CheckStepTargetDistance", cases[i].id, a, 2, ret, 0xFFFFFFFFu);
    }
  }

  /* 3. 0x6FD67B70 DRLGOUTPLACE_StepMazeLinkNode */
  {
    static const uint8_t dir_seq[8] = {1, 2, 3, 1, 2, 1, 3, 0};
    /* Case 1: stepCount < 3, dir wraps (3 + 1) & 3 = 0 */
    {
      reset_arena();
      uint32_t n0 = 0x100, rootBox = 0x300, seq = 0x380;
      memcpy(MEM(seq), dir_seq, 8);
      wr32(n0 + 0x14, 1u);
      wr32(n0 + 0x18, PTR(seq + 2)); /* +1 -> seq[3] == 1 */
      wr8(n0 + 0x1C, 3u);
      wr32(n0 + 0x20, 0u);
      wr32(rootBox, PTR(n0));
      track_block(PTR(n0), 0x28);
      track_block(PTR(rootBox), 4);
      track_block(PTR(seq), 8);
      uint32_t a[2] = {PTR(n0), PTR(rootBox)};
      uint32_t ret = call_6FD67B70(a[0], a[1]);
      emit_record(fp, 0x6FD67B70, "DRLGOUTPLACE_StepMazeLinkNode", "step_1_to_2_wrap_dir", a, 2, ret, 0xFFFFFFFFu);
    }
    /* Case 2: stepCount = 4 >= 4 -> skips cursor advance, increments stepCount to 5 */
    {
      reset_arena();
      uint32_t n0 = 0x100, rootBox = 0x300, seq = 0x380;
      memcpy(MEM(seq), dir_seq, 8);
      wr32(n0 + 0x14, 4u);
      wr32(n0 + 0x18, PTR(seq));
      wr8(n0 + 0x1C, 2u);
      wr32(n0 + 0x20, 0u);
      wr32(rootBox, PTR(n0));
      track_block(PTR(n0), 0x28);
      track_block(PTR(rootBox), 4);
      track_block(PTR(seq), 8);
      uint32_t a[2] = {PTR(n0), PTR(rootBox)};
      uint32_t ret = call_6FD67B70(a[0], a[1]);
      emit_record(fp, 0x6FD67B70, "DRLGOUTPLACE_StepMazeLinkNode", "step_4_to_5_no_cursor_advance", a, 2, ret, 0xFFFFFFFFu);
    }
    /* Case 3: stepCount 2 -> 3 on root node -> returns 0 */
    {
      reset_arena();
      uint32_t n0 = 0x100, rootBox = 0x300, seq = 0x380;
      memcpy(MEM(seq), dir_seq, 8);
      wr32(n0 + 0x14, 2u);
      wr32(n0 + 0x18, PTR(seq));
      wr8(n0 + 0x1C, 1u);
      wr32(n0 + 0x20, 0u);
      wr32(rootBox, PTR(n0));
      track_block(PTR(n0), 0x28);
      track_block(PTR(rootBox), 4);
      track_block(PTR(seq), 8);
      uint32_t a[2] = {PTR(n0), PTR(rootBox)};
      uint32_t ret = call_6FD67B70(a[0], a[1]);
      emit_record(fp, 0x6FD67B70, "DRLGOUTPLACE_StepMazeLinkNode", "root_reaches_3_returns_0", a, 2, ret, 0xFFFFFFFFu);
    }
    /* Case 4: child reaches 3, parent has stepCount=1 != 2 -> climbs to parent and steps parent to 2 */
    {
      reset_arena();
      uint32_t root = 0x100, child = 0x200, rootBox = 0x300, seq = 0x380;
      memcpy(MEM(seq), dir_seq, 8);
      wr32(root + 0x14, 1u); wr32(root + 0x18, PTR(seq + 0)); wr8(root + 0x1C, 2u); wr32(root + 0x20, 0u);
      wr32(child + 0x14, 2u); wr32(child + 0x18, PTR(seq + 1)); wr8(child + 0x1C, 0u); wr32(child + 0x20, PTR(root));
      wr32(rootBox, PTR(root));
      track_block(PTR(root), 0x28);
      track_block(PTR(child), 0x28);
      track_block(PTR(rootBox), 4);
      track_block(PTR(seq), 8);
      uint32_t a[2] = {PTR(child), PTR(rootBox)};
      uint32_t ret = call_6FD67B70(a[0], a[1]);
      emit_record(fp, 0x6FD67B70, "DRLGOUTPLACE_StepMazeLinkNode", "child_climbs_to_parent", a, 2, ret, 0xFFFFFFFFu);
    }
    /* Case 5: grandchild reaches 3, mid reaches 2->3, root steps 0->1 -> climbs 2 levels to root */
    {
      reset_arena();
      uint32_t root = 0x100, mid = 0x180, leaf = 0x200, rootBox = 0x300, seq = 0x380;
      memcpy(MEM(seq), dir_seq, 8);
      wr32(root + 0x14, 0u); wr32(root + 0x18, PTR(seq + 3)); wr8(root + 0x1C, 1u); wr32(root + 0x20, 0u);
      wr32(mid + 0x14, 2u);  wr32(mid + 0x18, PTR(seq + 2));  wr8(mid + 0x1C, 2u);  wr32(mid + 0x20, PTR(root));
      wr32(leaf + 0x14, 2u); wr32(leaf + 0x18, PTR(seq + 0)); wr8(leaf + 0x1C, 3u); wr32(leaf + 0x20, PTR(mid));
      wr32(rootBox, PTR(root));
      track_block(PTR(root), 0x28);
      track_block(PTR(mid), 0x28);
      track_block(PTR(leaf), 0x28);
      track_block(PTR(rootBox), 4);
      track_block(PTR(seq), 8);
      uint32_t a[2] = {PTR(leaf), PTR(rootBox)};
      uint32_t ret = call_6FD67B70(a[0], a[1]);
      emit_record(fp, 0x6FD67B70, "DRLGOUTPLACE_StepMazeLinkNode", "climb_two_levels_to_root", a, 2, ret, 0xFFFFFFFFu);
    }
    /* Case 6: grandchild reaches 3, mid reaches 2->3, root reaches 2->3 -> hits root and returns 0 */
    {
      reset_arena();
      uint32_t root = 0x100, mid = 0x180, leaf = 0x200, rootBox = 0x300, seq = 0x380;
      memcpy(MEM(seq), dir_seq, 8);
      wr32(root + 0x14, 2u); wr32(root + 0x18, PTR(seq + 3)); wr8(root + 0x1C, 1u); wr32(root + 0x20, 0u);
      wr32(mid + 0x14, 2u);  wr32(mid + 0x18, PTR(seq + 2));  wr8(mid + 0x1C, 2u);  wr32(mid + 0x20, PTR(root));
      wr32(leaf + 0x14, 2u); wr32(leaf + 0x18, PTR(seq + 0)); wr8(leaf + 0x1C, 3u); wr32(leaf + 0x20, PTR(mid));
      wr32(rootBox, PTR(root));
      track_block(PTR(root), 0x28);
      track_block(PTR(mid), 0x28);
      track_block(PTR(leaf), 0x28);
      track_block(PTR(rootBox), 4);
      track_block(PTR(seq), 8);
      uint32_t a[2] = {PTR(leaf), PTR(rootBox)};
      uint32_t ret = call_6FD67B70(a[0], a[1]);
      emit_record(fp, 0x6FD67B70, "DRLGOUTPLACE_StepMazeLinkNode", "climb_all_exhausted_returns_0", a, 2, ret, 0xFFFFFFFFu);
    }
  }

  /* 4. 0x6FD94540 DRLGROOM_PackAdjacentRooms */
  {
    /* Case 1: nRoomsNear = 0 */
    {
      reset_arena();
      wr32(0x100 + 0x2C, 0u);
      memset(MEM(0x400), 0xCC, 16);
      track_block(PTR(0x100), 0xEC);
      track_block(PTR(0x400), 16);
      uint32_t a[2] = {PTR(0x100), PTR(0x400)};
      emit_record(fp, 0x6FD94540, "DRLGROOM_PackAdjacentRooms", "zero_near", a, 2, call_6FD94540(a[0], a[1]), 0xFFFFFFFFu);
    }
    /* Case 2: nRoomsNear = -2 */
    {
      reset_arena();
      wr32(0x100 + 0x2C, (uint32_t)-2);
      memset(MEM(0x400), 0xCC, 16);
      track_block(PTR(0x100), 0xEC);
      track_block(PTR(0x400), 16);
      uint32_t a[2] = {PTR(0x100), PTR(0x400)};
      emit_record(fp, 0x6FD94540, "DRLGROOM_PackAdjacentRooms", "neg_near", a, 2, call_6FD94540(a[0], a[1]), 0xFFFFFFFFu);
    }
    /* Case 3: 4 near rooms, all have non-null pRoom1 */
    {
      reset_arena();
      uint32_t rEx = 0x100, nearArr = 0x200, outArr = 0x400;
      wr32(rEx + 0x08, PTR(nearArr));
      wr32(rEx + 0x2C, 4u);
      for (int i = 0; i < 4; i++) {
        uint32_t nEx = 0x500 + i * 0x100;
        wr32(nearArr + i * 4, PTR(nEx));
        wr32(nEx + 0x30, 0xABCD0001u + (uint32_t)i);
        track_block(PTR(nEx), 0xEC);
      }
      memset(MEM(outArr), 0xCC, 24);
      track_block(PTR(rEx), 0xEC);
      track_block(PTR(nearArr), 16);
      track_block(PTR(outArr), 24);
      uint32_t a[2] = {PTR(rEx), PTR(outArr)};
      emit_record(fp, 0x6FD94540, "DRLGROOM_PackAdjacentRooms", "all_4_nonnull", a, 2, call_6FD94540(a[0], a[1]), 0xFFFFFFFFu);
    }
    /* Case 4: 5 near rooms, 2 have pRoom1 == 0 -> packs 3 and zeroes remaining 2 slots */
    {
      reset_arena();
      uint32_t rEx = 0x100, nearArr = 0x200, outArr = 0x400;
      wr32(rEx + 0x08, PTR(nearArr));
      wr32(rEx + 0x2C, 5u);
      uint32_t room1s[5] = {0x11110001u, 0u, 0x22220002u, 0u, 0x33330003u};
      for (int i = 0; i < 5; i++) {
        uint32_t nEx = 0x500 + i * 0x100;
        wr32(nearArr + i * 4, PTR(nEx));
        wr32(nEx + 0x30, room1s[i]);
        track_block(PTR(nEx), 0xEC);
      }
      memset(MEM(outArr), 0xCC, 24);
      track_block(PTR(rEx), 0xEC);
      track_block(PTR(nearArr), 20);
      track_block(PTR(outArr), 24);
      uint32_t a[2] = {PTR(rEx), PTR(outArr)};
      emit_record(fp, 0x6FD94540, "DRLGROOM_PackAdjacentRooms", "mixed_3_of_5_zero_padded", a, 2, call_6FD94540(a[0], a[1]), 0xFFFFFFFFu);
    }
  }

  /* 5. 0x6FD945A0 DRLGROOM_SortRoomExArrayByBounds */
  {
    /* Case 1: nCount = 1 (no-op) */
    {
      reset_arena();
      wr32(0x100, PTR(0x200));
      track_block(PTR(0x100), 4);
      uint32_t a[2] = {1u, PTR(0x100)};
      call_6FD945A0(a[0], a[1]);
      emit_record(fp, 0x6FD945A0, "DRLGROOM_SortRoomExArrayByBounds", "count_1_noop", a, 2, 0, 0);
    }
    /* Case 2: 5 rooms exercising both cur.x >= next.x + next.w and cur.y >= next.y + next.h */
    {
      reset_arena();
      int32_t bounds[5][4] = {
        {50, 50, 10, 10},
        {20, 45, 15, 10},
        {10, 30, 10, 10},
        {10, 10, 10, 15},
        {0,  0,  8,  8},
      };
      for (int i = 0; i < 5; i++) {
        uint32_t r = 0x200 + i * 0x100;
        wr32(0x100 + i * 4, PTR(r));
        wr32(r + 0x34, (uint32_t)bounds[i][0]);
        wr32(r + 0x38, (uint32_t)bounds[i][1]);
        wr32(r + 0x3C, (uint32_t)bounds[i][2]);
        wr32(r + 0x40, (uint32_t)bounds[i][3]);
        track_block(PTR(r), 0xEC);
      }
      track_block(PTR(0x100), 20);
      uint32_t a[2] = {5u, PTR(0x100)};
      call_6FD945A0(a[0], a[1]);
      emit_record(fp, 0x6FD945A0, "DRLGROOM_SortRoomExArrayByBounds", "five_rooms_x_and_y_swaps", a, 2, 0, 0);
    }
    /* Case 3: reverse-ordered negative coordinates */
    {
      reset_arena();
      int32_t bounds[4][4] = {
        {10, 20, 5, 5},
        {0, 0, 5, 5},
        {-10, -5, 5, 5},
        {-20, -5, 5, 5},
      };
      for (int i = 0; i < 4; i++) {
        uint32_t r = 0x200 + i * 0x100;
        wr32(0x100 + i * 4, PTR(r));
        wr32(r + 0x34, (uint32_t)bounds[i][0]);
        wr32(r + 0x38, (uint32_t)bounds[i][1]);
        wr32(r + 0x3C, (uint32_t)bounds[i][2]);
        wr32(r + 0x40, (uint32_t)bounds[i][3]);
        track_block(PTR(r), 0xEC);
      }
      track_block(PTR(0x100), 16);
      uint32_t a[2] = {4u, PTR(0x100)};
      call_6FD945A0(a[0], a[1]);
      emit_record(fp, 0x6FD945A0, "DRLGROOM_SortRoomExArrayByBounds", "reverse_negative_coords", a, 2, 0, 0);
    }
    /* Case 4: already ordered */
    {
      reset_arena();
      for (int i = 0; i < 3; i++) {
        uint32_t r = 0x200 + i * 0x100;
        wr32(0x100 + i * 4, PTR(r));
        wr32(r + 0x34, (uint32_t)(i * 10));
        wr32(r + 0x38, (uint32_t)(i * 10));
        wr32(r + 0x3C, 5u);
        wr32(r + 0x40, 5u);
        track_block(PTR(r), 0xEC);
      }
      track_block(PTR(0x100), 12);
      uint32_t a[2] = {3u, PTR(0x100)};
      call_6FD945A0(a[0], a[1]);
      emit_record(fp, 0x6FD945A0, "DRLGROOM_SortRoomExArrayByBounds", "already_ordered", a, 2, 0, 0);
    }
  }

  /* 6. 0x6FD94740 DRLGROOM_CheckPointInRect */
  {
    struct { const char *id; int32_t rx, ry, rw, rh, qx, qy; } cases[] = {
      {"hit_min_corner", 10, 20, 5, 8, 10, 20},
      {"hit_max_inclusive", 10, 20, 5, 8, 14, 27},
      {"miss_x_low", 10, 20, 5, 8, 9, 22},
      {"miss_x_high_excl", 10, 20, 5, 8, 15, 22},
      {"miss_y_low", 10, 20, 5, 8, 12, 19},
      {"miss_y_high_excl", 10, 20, 5, 8, 12, 28},
      {"hit_negative_rect", -30, -40, 10, 10, -25, -35},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100 + 0x00, (uint32_t)cases[i].rx);
      wr32(0x100 + 0x04, (uint32_t)cases[i].ry);
      wr32(0x100 + 0x08, (uint32_t)cases[i].rw);
      wr32(0x100 + 0x0C, (uint32_t)cases[i].rh);
      track_block(PTR(0x100), 16);
      uint32_t a[3] = {PTR(0x100), (uint32_t)cases[i].qx, (uint32_t)cases[i].qy};
      uint32_t ret = call_6FD94740(a[0], a[1], a[2]);
      emit_record(fp, 0x6FD94740, "DRLGROOM_CheckPointInRect", cases[i].id, a, 3, ret, 0xFFFFFFFFu);
    }
  }

  /* 7. 0x6FD94870 DRLGROOM_CompareOrthoNodes */
  {
    Fast2 fn = (Fast2)RVA(0x6FD94870);
    struct {
      const char *id;
      int32_t d1, x1, y1;
      int32_t d2, x2, y2;
    } cases[] = {
      {"diff_dir_d2_gt_d1", 0, 10, 10, 2, 10, 10},
      {"diff_dir_d2_lt_d1", 3, 10, 10, 1, 10, 10},
      {"dir0_y2_gt_y1", 0, 10, 20, 0, 10, 25},
      {"dir0_y2_le_y1", 0, 10, 25, 0, 10, 20},
      {"dir1_x2_lt_x1", 1, 30, 10, 1, 20, 10},
      {"dir1_x2_ge_x1", 1, 20, 10, 1, 30, 10},
      {"dir2_y2_lt_y1", 2, 10, 25, 2, 10, 20},
      {"dir2_y2_ge_y1", 2, 10, 20, 2, 10, 25},
      {"dir3_x2_gt_x1", 3, 10, 10, 3, 20, 10},
      {"dir3_x2_le_x1", 3, 20, 10, 3, 10, 10},
      {"dir_default_oob_5", 5, 10, 10, 5, 20, 20},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100 + 0x04, (uint32_t)cases[i].d1);
      wr32(0x100 + 0x10, PTR(0x300));
      wr32(0x300 + 0x00, (uint32_t)cases[i].x1);
      wr32(0x300 + 0x04, (uint32_t)cases[i].y1);

      wr32(0x200 + 0x04, (uint32_t)cases[i].d2);
      wr32(0x200 + 0x10, PTR(0x400));
      wr32(0x400 + 0x00, (uint32_t)cases[i].x2);
      wr32(0x400 + 0x04, (uint32_t)cases[i].y2);

      track_block(PTR(0x100), 0x18);
      track_block(PTR(0x200), 0x18);
      track_block(PTR(0x300), 16);
      track_block(PTR(0x400), 16);
      uint32_t a[2] = {PTR(0x100), PTR(0x200)};
      emit_record(fp, 0x6FD94870, "DRLGROOM_CompareOrthoNodes", cases[i].id, a, 2, fn(a[0], a[1]), 0xFFFFFFFFu);
    }
  }

  /* 8. 0x6FD94EB0 DRLGROOM_CheckLevelRoomsSeparation */
  {
    /* Empty level (pFirstRoomEx == 0) */
    {
      reset_arena();
      wr32(0x100 + 0x10, 0u);
      track_block(PTR(0x100), 0x230);
      uint32_t a[4] = {PTR(0x100), 5u, PTR(0x200), PTR(0x300)};
      emit_record(fp, 0x6FD94EB0, "DRLGROOM_CheckLevelRoomsSeparation", "empty_level", a, 4, call_6FD94EB0(a[0], a[1], a[2], a[3]), 0xFFFFFFFFu);
    }
    /* Chain of rooms: rSkip is pRoomEx2 (skipped even though overlapping), rOther is tested against rTarget */
    struct {
      const char *id;
      int32_t minDist;
      int32_t ox, oy, ow, oh;
    } cases[] = {
      {"separated_left_ok", 5, 10, 50, 10, 10},       /* ox+ow=20 <= tx-d=45 */
      {"too_close_left_fail", 5, 36, 50, 10, 10},     /* ox+ow=46 > 45 */
      {"separated_right_ok", 5, 65, 50, 10, 10},      /* ox=65 >= tx+tw+d=65 */
      {"separated_top_ok", 5, 50, 10, 10, 10},        /* oy+oh=20 <= ty-d=45 */
      {"separated_bottom_ok", 5, 50, 65, 10, 10},     /* oy=65 >= ty+th+d=65 */
      {"overlap_interior_fail", 2, 52, 52, 5, 5},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      uint32_t lvl = 0x100, rTarget = 0x300, rSkip = 0x400, rOther = 0x500;
      wr32(lvl + 0x10, PTR(rTarget));
      /* rTarget at (50, 50, 10, 10) at +0x34..+0x40 */
      wr32(rTarget + 0x34, 50u); wr32(rTarget + 0x38, 50u); wr32(rTarget + 0x3C, 10u); wr32(rTarget + 0x40, 10u);
      wr32(rTarget + 0x24, PTR(rSkip));
      /* rSkip overlaps rTarget at (50, 50, 10, 10) but is passed as pRoomEx2 so skipped */
      wr32(rSkip + 0x34, 50u); wr32(rSkip + 0x38, 50u); wr32(rSkip + 0x3C, 10u); wr32(rSkip + 0x40, 10u);
      wr32(rSkip + 0x24, PTR(rOther));
      /* rOther */
      wr32(rOther + 0x34, (uint32_t)cases[i].ox);
      wr32(rOther + 0x38, (uint32_t)cases[i].oy);
      wr32(rOther + 0x3C, (uint32_t)cases[i].ow);
      wr32(rOther + 0x40, (uint32_t)cases[i].oh);
      wr32(rOther + 0x24, 0u);

      track_block(PTR(lvl), 0x230);
      track_block(PTR(rTarget), 0xEC);
      track_block(PTR(rSkip), 0xEC);
      track_block(PTR(rOther), 0xEC);
      uint32_t a[4] = {PTR(lvl), (uint32_t)cases[i].minDist, PTR(rTarget), PTR(rSkip)};
      emit_record(fp, 0x6FD94EB0, "DRLGROOM_CheckLevelRoomsSeparation", cases[i].id, a, 4, call_6FD94EB0(a[0], a[1], a[2], a[3]), 0xFFFFFFFFu);
    }
  }

  /* 9. 0x6FD95630 ITEMMODS_StubReturnOne */
  {
    Std7 fn = (Std7)RVA(0x6FD95630);
    uint32_t sets[4][7] = {
      {0, 0, 0, 0, 0, 0, 0},
      {1, 2, 3, 4, 5, 6, 7},
      {0xFFFFFFFFu, 0x80000000u, 0x7FFFFFFFu, 42u, 99u, 0u, 1u},
      {0x12345678u, 0x9ABCDEF0u, 0x11111111u, 0x22222222u, 0x33333333u, 0x44444444u, 0x55555555u},
    };
    const char *names[] = {"all_zero", "seq_1_7", "extremes", "hex_pattern"};
    for (int i = 0; i < 4; i++) {
      reset_arena();
      wr32(0x100, 0xA5A5A5A5u);
      track_block(PTR(0x100), 4);
      uint32_t *s = sets[i];
      uint32_t ret = fn(s[0], s[1], s[2], s[3], s[4], s[5], s[6]);
      emit_record(fp, 0x6FD95630, "ITEMMODS_StubReturnOne", names[i], s, 7, ret, 0xFFFFFFFFu);
    }
  }

  /* 10. 0x6FD95640 ITEMMODS_ShiftStatValueIfFixedPoint */
  {
    struct { const char *id; int32_t statId; int32_t initVal; } cases[] = {
      {"stat_5_below_range_unchanged", 5, 100},
      {"stat_6_hitpoints_shifted", 6, 25},
      {"stat_7_maxhp_shifted", 7, 50},
      {"stat_8_mana_shifted", 8, 30},
      {"stat_11_maxstamina_shifted", 11, -10},
      {"stat_12_level_tag2_unchanged", 12, 99},
      {"stat_57_tag1_unchanged", 57, 45},
      {"stat_58_tag1_unchanged", 58, 60},
      {"stat_216_shifted", 216, 3},
      {"stat_217_last_in_range_shifted", 217, 7},
      {"stat_218_above_range_unchanged", 218, 7},
      {"stat_neg1_unchanged", -1, 42},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100, (uint32_t)cases[i].initVal);
      track_block(PTR(0x100), 4);
      uint32_t a[2] = {(uint32_t)cases[i].statId, PTR(0x100)};
      uint32_t ret = call_6FD95640(a[0], a[1]);
      emit_record(fp, 0x6FD95640, "ITEMMODS_ShiftStatValueIfFixedPoint", cases[i].id, a, 2, ret, 0xFFFFFFFFu);
    }
  }

  /* 12. 0x6FDB81A0 DRLGROOMTILE_FindPresetRoomTile */
  {
    /* Case 1: pTileGrid == NULL */
    {
      reset_arena();
      wr32(0x100 + 0x54, 0u);
      track_block(PTR(0x100), 0xEC);
      uint32_t a[5] = {PTR(0x100), 0u, 0u, 10u, 20u};
      emit_record(fp, 0x6FDB81A0, "DRLGROOMTILE_FindPresetRoomTile", "null_tile_grid", a, 5,
                  call_6FDB81A0(a[0], a[1], a[2], a[3], a[4]), 0xFFFFFFFFu);
    }
    /* Cases 2..8: populated room + tileGrid + 2 links + 3 tiles per link */
    struct {
      const char *id;
      uint32_t presetFlags;
      uint32_t bFloor;
      int32_t qx, qy;
    } cases[] = {
      {"oob_x_low", 0u, 0u, 9, 20},
      {"oob_y_high_gt_inclusive", 0u, 0u, 10, 26},
      {"hit_wall_link_inclusive_max_edge", 0u, 0u, 15, 25},
      {"skip_type4_and_hit_type13_with_flag08000000", 0x08000000u, 0u, 12, 22},
      {"miss_non_type13_when_flag08000000_set", 0x08000000u, 1u, 11, 21},
      {"hit_floor_link_orient_match", 0x00080000u, 1u, 11, 21}, /* ((presetFlags>>18)&3)==2 matches (((dwFlags>>14)&7)-1)==2 (bits 16:14 = 3) */
      {"miss_floor_link_orient_mismatch", 0x00040000u, 1u, 11, 21},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      uint32_t rEx = 0x100, tGrid = 0x200, lWall = 0x300, lFloor = 0x340, tWall = 0x400, tFloor = 0x500;
      wr32(rEx + 0x34, 10u); wr32(rEx + 0x38, 20u); wr32(rEx + 0x3C, 5u); wr32(rEx + 0x40, 5u);
      wr32(rEx + 0x54, PTR(tGrid));
      wr32(tGrid + 0x00, PTR(lWall));

      /* lWall (bFloor = 0) -> lFloor (bFloor = 1) */
      wr32(lWall + 0x00, 0u);
      wr32(lWall + 0x04, PTR(tWall));
      wr32(lWall + 0x08, PTR(lFloor));

      /* tWall[0]: at (2,2)->(12,22) but nTileType (+0x1C) = 4 (skipped) */
      wr32(tWall + 0 * 0x30 + 0x08, 2u);
      wr32(tWall + 0 * 0x30 + 0x0C, 2u);
      wr32(tWall + 0 * 0x30 + 0x14, 0u);
      wr32(tWall + 0 * 0x30 + 0x1C, 4u);
      wr32(tWall + 0 * 0x30 + 0x20, PTR(tWall + 1 * 0x30));

      /* tWall[1]: at (2,2)->(12,22) with nTileType (+0x1C) = 13, dwFlags (+0x14) = 0 */
      wr32(tWall + 1 * 0x30 + 0x08, 2u);
      wr32(tWall + 1 * 0x30 + 0x0C, 2u);
      wr32(tWall + 1 * 0x30 + 0x14, 0u);
      wr32(tWall + 1 * 0x30 + 0x1C, 13u);
      wr32(tWall + 1 * 0x30 + 0x20, PTR(tWall + 2 * 0x30));

      /* tWall[2]: at (5,5)->(15,25) inclusive upper edge, nTileType (+0x1C) = 1, dwFlags (+0x14) = 0 */
      wr32(tWall + 2 * 0x30 + 0x08, 5u);
      wr32(tWall + 2 * 0x30 + 0x0C, 5u);
      wr32(tWall + 2 * 0x30 + 0x14, 0u);
      wr32(tWall + 2 * 0x30 + 0x1C, 1u);
      wr32(tWall + 2 * 0x30 + 0x20, 0u);

      /* lFloor (bFloor = 1) */
      wr32(lFloor + 0x00, 1u);
      wr32(lFloor + 0x04, PTR(tFloor));
      wr32(lFloor + 0x08, 0u);

      /* tFloor[0]: at (1,1)->(11,21), dwFlags (+0x14) = (3 << 14), nTileType (+0x1C) = 0 */
      wr32(tFloor + 0x08, 1u);
      wr32(tFloor + 0x0C, 1u);
      wr32(tFloor + 0x14, 3u << 14);
      wr32(tFloor + 0x1C, 0u);
      wr32(tFloor + 0x20, 0u);

      track_block(PTR(rEx), 0xEC);
      track_block(PTR(tGrid), 0x2C);
      track_block(PTR(lWall), 0x0C);
      track_block(PTR(lFloor), 0x0C);
      track_block(PTR(tWall), 3 * 0x30);
      track_block(PTR(tFloor), 0x30);

      uint32_t a[5] = {PTR(rEx), cases[i].presetFlags, cases[i].bFloor, (uint32_t)cases[i].qx, (uint32_t)cases[i].qy};
      emit_record(fp, 0x6FDB81A0, "DRLGROOMTILE_FindPresetRoomTile", cases[i].id, a, 5,
                  call_6FDB81A0(a[0], a[1], a[2], a[3], a[4]), 0xFFFFFFFFu);
    }
  }

  /* 13. 0x6FDB8340 DRLGROOMTILE_LookupWarpTileEntryIndex */
  {
    struct { const char *id; uint32_t bIsType9; int32_t lvlId; uint32_t tileFlags; } cases[] = {
      {"hit_lvl28_style7_seq0_type9_idx0", 1u, 28, (7u << 20) | (0u << 8)},
      {"hit_lvl28_style7_seq0_not_type9_idx1", 0u, 28, (7u << 20) | (0u << 8)},
      {"hit_lvl31_style5_seq0_not_type9_idx3", 0u, 31, (5u << 20) | (0u << 8)},
      {"hit_lvl26_style4_seq0_not_type9_idx6", 0u, 26, (4u << 20) | (0u << 8)},
      {"hit_lvl33_style1_seq2_type9_idx9", 1u, 33, (1u << 20) | (2u << 8)},
      {"hit_lvl37_style2_seq0_type9_idx12", 1u, 37, (2u << 20) | (0u << 8)},
      {"hit_lvl109_style3_seq3_not_type9_idx23", 0u, 109, (3u << 20) | (3u << 8)},
      {"hit_lvl117_style29_seq0_not_type9_idx33", 0u, 117, (29u << 20) | (0u << 8)},
      {"miss_lvl1_not_in_table", 0u, 1, 0u},
      {"miss_lvl33_wrong_seq", 0u, 33, (4u << 20) | (5u << 8)},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100, 0x55555555u);
      track_block(PTR(0x100), 4);
      uint32_t a[3] = {cases[i].bIsType9, (uint32_t)cases[i].lvlId, cases[i].tileFlags};
      uint32_t ret = call_6FDB8340(a[0], a[1], a[2]);
      emit_record(fp, 0x6FDB8340, "DRLGROOMTILE_LookupWarpTileEntryIndex", cases[i].id, a, 3, ret, 0xFFFFFFFFu);
    }
  }

  /* 14. 0x6FDB85D0 DRLGROOMTILE_CountPresetWallTileCells */
  {
    struct {
      const char *id;
      uint32_t bNoExtraH, bNoExtraW;
    } cases[] = {
      {"extra_both_w_and_h", 0u, 0u},
      {"no_extra_width_only", 0u, 1u},
      {"no_extra_height_only", 1u, 0u},
      {"no_extra_both", 1u, 1u},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      uint32_t rEx = 0x100, tGrid = 0x200, defGrid = 0x300, typeGrid = 0x340;
      uint32_t rowOffsets = 0x400, defCells = 0x500, typeCells = 0x600;
      wr32(rEx + 0x3C, 3u); /* nTileWidth = 3 -> w = 4 or 3 */
      wr32(rEx + 0x40, 2u); /* nTileHeight = 2 -> h = 3 or 2 */
      wr32(rEx + 0x54, PTR(tGrid));
      wr32(tGrid + 0x18, 10u); /* initial nWallCapacity */
      wr32(tGrid + 0x20, 5u);  /* initial nFloorCapacity */

      /* rowOffsets[y] = y * 4 */
      for (int y = 0; y < 4; y++) wr32(rowOffsets + y * 4, (uint32_t)(y * 4));
      wr32(defGrid + 0x00, PTR(defCells));
      wr32(defGrid + 0x04, PTR(rowOffsets));
      wr32(typeGrid + 0x00, PTR(typeCells));
      wr32(typeGrid + 0x04, PTR(rowOffsets));

      /* Populate 4x3 cells with tile types (0, 3, 9, 10, 11, 12) and def sign bit 0x80000000 */
      uint32_t types[12] = {
        0u, 3u, 9u, 10u,
        10u, 11u, 11u, 12u,
        3u, 10u, 2u, 3u
      };
      uint32_t defs[12] = {
        0xFFFFFFFFu, 0u, 0x80000000u, 0x80000000u,
        0x7FFFFFFFu, 0x80000000u, 0u, 0x80000000u,
        0u, 0x80000000u, 0u, 0u
      };
      for (int k = 0; k < 12; k++) {
        wr32(typeCells + k * 4, types[k]);
        wr32(defCells + k * 4, defs[k]);
      }

      track_block(PTR(rEx), 0xEC);
      track_block(PTR(tGrid), 0x2C);
      track_block(PTR(defGrid), 0x14);
      track_block(PTR(typeGrid), 0x14);
      track_block(PTR(rowOffsets), 16);
      track_block(PTR(defCells), 48);
      track_block(PTR(typeCells), 48);

      uint32_t a[5] = {PTR(rEx), cases[i].bNoExtraH, PTR(defGrid), PTR(typeGrid), cases[i].bNoExtraW};
      call_6FDB85D0(a[0], a[1], a[2], a[3], a[4]);
      emit_record(fp, 0x6FDB85D0, "DRLGROOMTILE_CountPresetWallTileCells", cases[i].id, a, 5, 0, 0);
    }
  }

  /* 15. 0x6FDB8660 DRLGROOMTILE_CountAllTileTypes */
  {
    struct {
      const char *id;
      uint32_t bCheckBounds, bNoExtraW, bNoExtraH;
    } cases[] = {
      {"unbounded_extra_both", 0u, 0u, 0u},
      {"bounded_extra_both", 1u, 0u, 0u},
      {"bounded_no_extra_w", 1u, 1u, 0u},
      {"unbounded_no_extra_both", 0u, 1u, 1u},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      uint32_t rEx = 0x100, tGrid = 0x200, flagGrid = 0x300, rowOffsets = 0x400, flagCells = 0x500;
      wr32(rEx + 0x34, 10u); /* nTileXPos = 10 */
      wr32(rEx + 0x38, 20u); /* nTileYPos = 20 */
      wr32(rEx + 0x3C, 3u);  /* nTileWidth = 3 */
      wr32(rEx + 0x40, 2u);  /* nTileHeight = 2 */
      wr32(rEx + 0x54, PTR(tGrid));
      wr32(tGrid + 0x18, 5u); /* nWallCapacity */
      wr32(tGrid + 0x20, 2u); /* nFloorCapacity */
      wr32(tGrid + 0x28, 1u); /* nRoofCapacity */

      for (int y = 0; y < 4; y++) wr32(rowOffsets + y * 4, (uint32_t)(y * 4));
      wr32(flagGrid + 0x00, PTR(flagCells));
      wr32(flagGrid + 0x04, PTR(rowOffsets));

      uint32_t flags[12] = {
        0x03u, 0x08000000u, 0x00u, 0x08000003u,
        0x01u, 0x02u, 0x08000001u, 0x00u,
        0x08000000u, 0x03u, 0x08000002u, 0x00u
      };
      for (int k = 0; k < 12; k++) wr32(flagCells + k * 4, flags[k]);

      track_block(PTR(rEx), 0xEC);
      track_block(PTR(tGrid), 0x2C);
      track_block(PTR(flagGrid), 0x14);
      track_block(PTR(rowOffsets), 16);
      track_block(PTR(flagCells), 48);

      uint32_t a[5] = {PTR(rEx), PTR(flagGrid), cases[i].bCheckBounds, cases[i].bNoExtraW, cases[i].bNoExtraH};
      call_6FDB8660(a[0], a[1], a[2], a[3], a[4]);
      emit_record(fp, 0x6FDB8660, "DRLGROOMTILE_CountAllTileTypes", cases[i].id, a, 5, 0, 0);
    }
  }

  /* 16 & 17. 0x6FDB9DA0 DRLGROOMTILE_MaxInt & 0x6FDB9DB0 DRLGROOMTILE_MinInt */
  {
    uintptr_t fnMax = RVA(0x6FDB9DA0);
    uintptr_t fnMin = RVA(0x6FDB9DB0);
    struct { const char *id; int32_t a, b; } cases[] = {
      {"pos_a_lt_b", 10, 25},
      {"pos_a_gt_b", 42, 7},
      {"equal_neg", -15, -15},
      {"neg_vs_pos", -100, 5},
      {"int_min_vs_int_max", (int32_t)0x80000000u, 0x7FFFFFFF},
      {"zero_vs_neg1", 0, -1},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100, 0x11223344u);
      track_block(PTR(0x100), 4);
      uint32_t a[2] = {(uint32_t)cases[i].a, (uint32_t)cases[i].b};
      emit_record(fp, 0x6FDB9DA0, "DRLGROOMTILE_MaxInt", cases[i].id, a, 2, call_fastq_ret8(fnMax, a[0], a[1]), 0xFFFFFFFFu);

      reset_arena();
      wr32(0x100, 0x11223344u);
      track_block(PTR(0x100), 4);
      emit_record(fp, 0x6FDB9DB0, "DRLGROOMTILE_MinInt", cases[i].id, a, 2, call_fastq_ret8(fnMin, a[0], a[1]), 0xFFFFFFFFu);
    }
  }
}

static void emit_b016(FILE *fp, const uint8_t *saved_bitmasks) {
  /* 1 & 2. 0x6FD84D30 PATH_GetVelocity & 0x6FD84D40 PATH_SetVelocity */
  {
    Std1 fnGet = (Std1)RVA(0x6FD84D30);
    Std4 fnSet = (Std4)RVA(0x6FD84D40);
    uint32_t vels[] = {0u, 512u, 1024u, 2048u, 0x7FFFFFFFu, 0xFFFFFFFFu};
    const char *names[] = {"vel_0", "vel_512", "vel_1024", "vel_2048", "vel_int_max", "vel_u32_max"};
    for (int i = 0; i < 6; i++) {
      reset_arena();
      wr32(0x100 + 0x7C, vels[i]);
      track_block(PTR(0x100), 0x200);
      uint32_t aGet[1] = {PTR(0x100)};
      emit_record(fp, 0x6FD84D30, "PATH_GetVelocity", names[i], aGet, 1, fnGet(aGet[0]), 0xFFFFFFFFu);
    }

    /* SetVelocity: NULL path */
    {
      reset_arena();
      wr32(0x100, 0x12345678u);
      track_block(PTR(0x100), 4);
      uint32_t a0[4] = {0u, 1024u, 0u, 0u};
      fnSet(0u, 1024u, 0u, 0u);
      emit_record(fp, 0x6FD84D40, "PATH_SetVelocity", "null_path", a0, 4, 0, 0);
    }
    /* SetVelocity: unchanged vs changed velocity */
    struct { const char *id; uint32_t oldVel, newVel, initCnt; } sc[] = {
      {"changed_sets_counter_15", 500u, 1024u, 3u},
      {"unchanged_preserves_counter", 1024u, 1024u, 7u},
      {"changed_to_zero_sets_counter_15", 1024u, 0u, 0u},
      {"changed_negative_sets_counter_15", 0u, 0xFFFFFF00u, 2u},
    };
    for (int i = 0; i < 4; i++) {
      reset_arena();
      wr32(0x100 + 0x38, sc[i].initCnt);
      wr32(0x100 + 0x7C, sc[i].oldVel);
      wr32(0x100 + 0x84, 0xDEADBEEFu);
      track_block(PTR(0x100), 0x200);
      uint32_t a[4] = {PTR(0x100), sc[i].newVel, 0u, 123u};
      fnSet(a[0], a[1], a[2], a[3]);
      emit_record(fp, 0x6FD84D40, "PATH_SetVelocity", sc[i].id, a, 4, 0, 0);
    }
  }

  /* 3. 0x6FD84E70 PATH_UpdateOutOfRoomFlag */
  {
    struct {
      const char *id;
      uint32_t initFlags;
      int32_t nPts;
      uint32_t hasRoom;
      uint16_t pts[3][2];
    } cases[] = {
      {"zero_points_clears_bit0", 0xFFFFFFFFu, 0, 1u, {{0, 0}, {0, 0}, {0, 0}}},
      {"neg_points_clears_bit0", 0x00000003u, -2, 1u, {{0, 0}, {0, 0}, {0, 0}}},
      {"null_room_sets_bit0", 0x00000010u, 1, 0u, {{105, 205}, {0, 0}, {0, 0}}},
      {"all_points_inside_clears_bit0", 0x00000007u, 3, 1u, {{100, 200}, {109, 219}, {105, 210}}},
      {"second_point_x_low_sets_bit0", 0x00000004u, 3, 1u, {{100, 200}, {99, 205}, {105, 210}}},
      {"third_point_x_high_excl_sets_bit0", 0u, 3, 1u, {{100, 200}, {105, 205}, {110, 210}}},
      {"point_y_low_sets_bit0", 0u, 2, 1u, {{100, 199}, {105, 205}, {0, 0}}},
      {"point_y_high_excl_sets_bit0", 0u, 2, 1u, {{105, 205}, {105, 220}, {0, 0}}},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      uint32_t pPath = 0x100, pRoom = 0x400;
      wr32(pPath + 0x1C, cases[i].hasRoom ? PTR(pRoom) : 0u);
      wr32(pPath + 0x28, (uint32_t)cases[i].nPts);
      wr32(pPath + 0x34, cases[i].initFlags);
      for (int k = 0; k < 3; k++) {
        wr16(pPath + 0x9C + k * 4, cases[i].pts[k][0]);
        wr16(pPath + 0x9E + k * 4, cases[i].pts[k][1]);
      }
      /* Room subtile rect: X=100, Y=200, W=10, H=20 */
      wr32(pRoom + 0x4C, 100u);
      wr32(pRoom + 0x50, 200u);
      wr32(pRoom + 0x54, 10u);
      wr32(pRoom + 0x58, 20u);
      track_block(PTR(pPath), 0x200);
      track_block(PTR(pRoom), 0x80);
      uint32_t a[1] = {PTR(pPath)};
      call_6FD84E70(a[0]);
      emit_record(fp, 0x6FD84E70, "PATH_UpdateOutOfRoomFlag", cases[i].id, a, 1, 0, 0);
    }
  }

  /* 4. 0x6FD84F50 PATH_SetNewDistance */
  {
    Std2 fn = (Std2)RVA(0x6FD84F50);
    reset_arena();
    wr32(0x100, 0x11111111u);
    track_block(PTR(0x100), 4);
    uint32_t a0[2] = {0u, 10u};
    fn(0u, 10u);
    emit_record(fp, 0x6FD84F50, "PATH_SetNewDistance", "null_path", a0, 2, 0, 0);

    uint32_t vals[] = {0u, 1u, 0x4Cu, 0x4Du, 0x4Eu, 0xFFu, 0x105u};
    const char *names[] = {"dist_0", "dist_1", "dist_76_below_max", "dist_77_exact_max", "dist_78_clamped_77", "dist_255_clamped_77", "dist_0x105_lowbyte_5"};
    for (int i = 0; i < 7; i++) {
      reset_arena();
      memset(MEM(0x100 + 0x90), 0xAA, 4);
      track_block(PTR(0x100), 0x200);
      uint32_t a[2] = {PTR(0x100), vals[i]};
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD84F50, "PATH_SetNewDistance", names[i], a, 2, 0, 0);
    }
  }

  /* 5. 0x6FD85040 PATH_SetTargetUnit */
  {
    Std2 fn = (Std2)RVA(0x6FD85040);
    /* Clear target unit (pUnit == 0): preserves old dwTargetType and dwTargetId */
    {
      reset_arena();
      wr32(0x100 + 0x58, PTR(0x400));
      wr32(0x100 + 0x5C, 2u);
      wr32(0x100 + 0x60, 0x12345678u);
      track_block(PTR(0x100), 0x200);
      uint32_t a[2] = {PTR(0x100), 0u};
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD85040, "PATH_SetTargetUnit", "null_target_preserves_type_id", a, 2, 0, 0);
    }
    /* Non-null target units of various types and IDs */
    struct { const char *id; uint32_t uType, uId; } cases[] = {
      {"unit_player_0", 0u, 101u},
      {"unit_monster_1", 1u, 0xABCD1234u},
      {"unit_object_2", 2u, 0xFFFFFFFFu},
      {"unit_item_4", 4u, 0u},
    };
    for (int i = 0; i < 4; i++) {
      reset_arena();
      wr32(0x100 + 0x58, 0u);
      wr32(0x100 + 0x5C, 0xDEADBEEFu);
      wr32(0x100 + 0x60, 0xCAFEBABEu);
      wr32(0x400 + 0x00, cases[i].uType);
      wr32(0x400 + 0x0C, cases[i].uId);
      track_block(PTR(0x100), 0x200);
      track_block(PTR(0x400), 0xF4);
      uint32_t a[2] = {PTR(0x100), PTR(0x400)};
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD85040, "PATH_SetTargetUnit", cases[i].id, a, 2, 0, 0);
    }
  }

  /* 6. 0x6FD85080 PATH_SetNumberOfPathPoints */
  {
    Std2 fn = (Std2)RVA(0x6FD85080);
    int32_t pts[] = {0, 1, 76, 77, 78, 500, -1, (int32_t)0x80000000u};
    const char *names[] = {"pts_0", "pts_1", "pts_76", "pts_77_exact", "pts_78_clamped_77", "pts_500_clamped_77", "pts_neg1_unclamped", "pts_int_min_unclamped"};
    for (int i = 0; i < 8; i++) {
      reset_arena();
      wr32(0x100 + 0x28, 0xAAAAAAAAu);
      track_block(PTR(0x100), 0x200);
      uint32_t a[2] = {PTR(0x100), (uint32_t)pts[i]};
      fn(a[0], a[1]);
      emit_record(fp, 0x6FD85080, "PATH_SetNumberOfPathPoints", names[i], a, 2, 0, 0);
    }
  }

  /* 7. 0x6FD850B0 PATH_SetDirection */
  {
    struct {
      const char *id;
      uint32_t hasUnit;
      uint32_t unitType;
      uint32_t flags;
      uint8_t curDir, newDir, diffDir;
      uint32_t argDir;
    } cases[] = {
      {"unit_object_2_sets_dir_directly", 1u, 2u, 0x40u, 5, 10, 99, 0xDFu},      /* 0xDF & 0x3F = 31 */
      {"unit_item_4_sets_dir_directly", 1u, 4u, 0u, 5, 10, 99, 42u},
      {"unit_missile_3_flag40_clear_sets_dir", 1u, 3u, 0u, 5, 10, 99, 25u},
      {"unit_missile_3_flag40_set_noop", 1u, 3u, 0x40u, 5, 10, 99, 25u},
      {"unit_player_0_same_newdir_noop", 1u, 0u, 0u, 5, 20, 99, 20u},
      {"unit_player_0_small_pos_diff_rate_1", 1u, 0u, 0u, 10, 10, 0, 15u},      /* diff=5 -> +1 */
      {"unit_monster_1_medium_pos_diff_rate_4", 1u, 1u, 0u, 10, 10, 0, 22u},    /* diff=12 -> +4 */
      {"unit_monster_1_large_pos_diff_rate_8", 1u, 1u, 0u, 10, 10, 0, 30u},     /* diff=20 -> +8 */
      {"null_unit_type6_neg_diff_rate_neg8", 0u, 0u, 0u, 10, 10, 0, 50u},       /* diff=40 -> -8 (0xF8) */
      {"null_unit_type6_neg_diff_rate_neg4", 0u, 0u, 0u, 10, 10, 0, 60u},       /* diff=50 -> -4 (0xFC) */
      {"null_unit_type6_neg_diff_rate_neg1", 0u, 0u, 0u, 10, 10, 0, 7u},        /* diff=61 -> -1 (0xFF) */
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      uint32_t pPath = 0x100, pUnit = 0x400;
      wr32(pPath + 0x30, cases[i].hasUnit ? PTR(pUnit) : 0u);
      wr32(pPath + 0x34, cases[i].flags);
      wr8(pPath + 0x64, cases[i].curDir);
      wr8(pPath + 0x65, cases[i].newDir);
      wr8(pPath + 0x66, cases[i].diffDir);
      wr32(pUnit + 0x00, cases[i].unitType);
      track_block(PTR(pPath), 0x200);
      track_block(PTR(pUnit), 0xF4);
      uint32_t a[2] = {PTR(pPath), cases[i].argDir};
      call_6FD850B0(a[0], a[1]);
      emit_record(fp, 0x6FD850B0, "PATH_SetDirection", cases[i].id, a, 2, 0, 0);
    }
  }

  /* 8. 0x6FD85100 PATH_GetMonsterMoveTestMask */
  {
    uint32_t sgptVa = (uint32_t)RVA(0x6FDE9E1C);
    uint32_t dtPtr = *(uint32_t *)(uintptr_t)sgptVa;
    uint32_t iatBitMasksVa = (uint32_t)RVA(0x6FDD90B0);

    struct { const char *id; uint32_t classId; uint8_t bf1, bf2; } cases[] = {
      {"flying_bit6_in_bf2_returns_1804", 0u, 0x00u, 0x40u},
      {"flying_overrides_doors_returns_1804", 1u, 0x08u, 0x40u},
      {"doors_bit3_in_bf1_returns_3401", 2u, 0x08u, 0x00u},
      {"normal_walker_returns_3c01", 3u, 0x00u, 0x00u},
      {"other_bits_ignored_returns_3c01", 4u, 0xF7u, 0xBFu},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      uint32_t bmOff = 0x0080, unitOff = 0x0100, monTxtOff = 0x0300;
      memcpy(MEM(bmOff), saved_bitmasks, 128);
      *(uint32_t *)(uintptr_t)iatBitMasksVa = PTR(bmOff);
      *(uint32_t *)(uintptr_t)(dtPtr + 0xA78) = PTR(monTxtOff);
      *(int32_t *)(uintptr_t)(dtPtr + 0xA80) = 5;

      wr32(unitOff + 0x04, cases[i].classId);
      wr8(monTxtOff + cases[i].classId * 0x1A8 + 0x0C, cases[i].bf1);
      wr8(monTxtOff + cases[i].classId * 0x1A8 + 0x0D, cases[i].bf2);

      track_block(sgptVa, 4);
      track_block(dtPtr + 0xA78, 12);
      track_block(iatBitMasksVa, 4);
      track_block(PTR(bmOff), 128);
      track_block(PTR(unitOff), 0xF4);
      track_block(PTR(monTxtOff), 5 * 0x1A8);

      uint32_t a[1] = {PTR(unitOff)};
      uint32_t ret = call_6FD85100(a[0]);
      emit_record(fp, 0x6FD85100, "PATH_GetMonsterMoveTestMask", cases[i].id, a, 1, ret, 0xFFFFFFFFu);
    }
  }

  /* 9. 0x6FD8E110 PATH_NormalizePrecisionVector */
  {
    struct { const char *id; int32_t vx, vy; } cases[] = {
      {"already_within_bounds", 0x10000, -0x10000},
      {"pos_x_exceeds_shifts_twice", 0x38000, 0x08000},
      {"neg_x_exceeds_shifts_three_times", -0x40001, 0x10000},
      {"pos_y_exceeds_shifts_once", 0x08000, 0x18000},
      {"neg_y_exceeds_shifts_twice", -0x04000, -0x28000},
      {"both_exceed_pos_x_then_neg_y", 0x20000, -0x50000},
      {"zero_vector", 0, 0},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100, (uint32_t)cases[i].vx);
      wr32(0x104, (uint32_t)cases[i].vy);
      track_block(PTR(0x100), 8);
      uint32_t a[2] = {PTR(0x100), PTR(0x104)};
      call_6FD8E110(a[0], a[1]);
      emit_record(fp, 0x6FD8E110, "PATH_NormalizePrecisionVector", cases[i].id, a, 2, 0, 0);
    }
  }

  /* 10. 0x6FD8E190 PATH_QuantizeDirectionIndex25 */
  {
    Std2 fn = (Std2)RVA(0x6FD8E190);
    #define PT(x, y) ((uint32_t)((uint16_t)(x)) | ((uint32_t)((uint16_t)(y)) << 16))
    struct { const char *id; uint32_t c0, c1; } cases[] = {
      {"same_point_center_12", PT(100, 100), PT(100, 100)},
      {"step_px1_py0", PT(100, 100), PT(101, 100)},
      {"step_nx1_py0", PT(100, 100), PT(99, 100)},
      {"step_px0_py1", PT(100, 100), PT(100, 101)},
      {"step_px0_ny1", PT(100, 100), PT(100, 99)},
      {"far_px10_py3_xmajor_odd_y", PT(100, 100), PT(110, 103)},
      {"far_px10_py4_xmajor_even_y", PT(100, 100), PT(110, 104)},
      {"far_nx10_ny3_xmajor_neg_y", PT(100, 100), PT(90, 97)},
      {"far_px3_py10_ymajor_odd_x", PT(100, 100), PT(103, 110)},
      {"far_nx3_ny10_ymajor_neg_x", PT(100, 100), PT(97, 90)},
      {"diag_px5_py5_clamped_2_2", PT(100, 100), PT(105, 105)},
      {"diag_nx5_ny5_clamped_neg2_neg2", PT(100, 100), PT(95, 95)},
      {"boundary_dx4_dy2_eq_2x", PT(100, 100), PT(104, 102)},
      {"boundary_dx2_dy4_eq_2y", PT(100, 100), PT(102, 104)},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      wr32(0x100, 0x22222222u);
      track_block(PTR(0x100), 4);
      uint32_t a[2] = {cases[i].c0, cases[i].c1};
      emit_record(fp, 0x6FD8E190, "PATH_QuantizeDirectionIndex25", cases[i].id, a, 2, fn(a[0], a[1]), 0xFFFFFFFFu);
    }

    /* 11. 0x6FD8E2B0 PATH_OctileDistanceWithTable */
    Std2 fnOct = (Std2)RVA(0x6FD8E2B0);
    struct { const char *id; uint32_t c0, c1; } oct_cases[] = {
      {"table_0_0_neg1_returns_0", PT(50, 50), PT(50, 50)},
      {"table_2_0_neg1_returns_0", PT(50, 50), PT(52, 50)},
      {"table_3_0_zero_returns_1", PT(50, 50), PT(53, 50)},
      {"table_4_3_returns_5", PT(50, 50), PT(46, 53)},
      {"table_7_7_max_in_table_returns_12", PT(50, 50), PT(57, 57)},
      {"outside_table_dx8_dy3_xmajor", PT(50, 50), PT(58, 53)},
      {"outside_table_dx3_dy8_ymajor", PT(50, 50), PT(47, 42)},
      {"outside_table_equal_10_10", PT(50, 50), PT(60, 60)},
    };
    for (unsigned i = 0; i < sizeof(oct_cases) / sizeof(oct_cases[0]); i++) {
      reset_arena();
      wr32(0x100, 0x33333333u);
      track_block(PTR(0x100), 4);
      uint32_t a[2] = {oct_cases[i].c0, oct_cases[i].c1};
      emit_record(fp, 0x6FD8E2B0, "PATH_OctileDistanceWithTable", oct_cases[i].id, a, 2, fnOct(a[0], a[1]), 0xFFFFFFFFu);
    }

    /* 16. 0x6FDCAF70 PATH_AStar_EvaluateHeuristic */
    Std2 fnHeur = (Std2)RVA(0x6FDCAF70);
    struct { const char *id; uint32_t c0, c1; } heur_cases[] = {
      {"same_point_0", PT(50, 50), PT(50, 50)},
      {"dx_gt_dy", PT(50, 50), PT(60, 53)},
      {"dx_lt_dy", PT(50, 50), PT(47, 40)},
      {"dx_eq_dy", PT(50, 50), PT(45, 55)},
      {"large_coords", PT(10, 20), PT(310, 520)},
    };
    for (unsigned i = 0; i < sizeof(heur_cases) / sizeof(heur_cases[0]); i++) {
      reset_arena();
      wr32(0x100, 0x44444444u);
      track_block(PTR(0x100), 4);
      uint32_t a[2] = {heur_cases[i].c0, heur_cases[i].c1};
      emit_record(fp, 0x6FDCAF70, "PATH_AStar_EvaluateHeuristic", heur_cases[i].id, a, 2, fnHeur(a[0], a[1]), 0xFFFFFFFFu);
    }
    #undef PT
  }

  /* 12. 0x6FDC0650 PATH_IdaStar_FlushNodeToDynamicPath */
  {
    uintptr_t fn = RVA(0x6FDC0650);
    /* Case 1: pNode == NULL -> returns 0 */
    {
      reset_arena();
      wr32(0x100 + 0x30, PTR(0x200));
      memset(MEM(0x200 + 0x9C), 0xCC, 32);
      track_block(PTR(0x100), 0x40);
      track_block(PTR(0x200 + 0x9C), 32);
      uint32_t a[2] = {PTR(0x100), 0u};
      emit_record(fp, 0x6FDC0650, "PATH_IdaStar_FlushNodeToDynamicPath", "null_node", a, 2, call_eax_ecx_ret(fn, a[0], a[1]), 0xFFFFFFFFu);
    }
    /* Case 2: only 1 non-root segment -> count == 1 <= 1 -> returns 0 without copying */
    {
      reset_arena();
      wr32(0x100 + 0x30, PTR(0x200));
      memset(MEM(0x200 + 0x9C), 0xCC, 32);
      /* n0 (root) at 0x400, n1 (leaf) at 0x420 */
      wr16(0x400 + 0x08, 10); wr16(0x400 + 0x0A, 20); wr32(0x400 + 0x14, 0u);
      wr16(0x420 + 0x08, 11); wr16(0x420 + 0x0A, 20); wr32(0x420 + 0x14, PTR(0x400));
      track_block(PTR(0x100), 0x40);
      track_block(PTR(0x200 + 0x9C), 32);
      track_block(PTR(0x400), 0x40);
      uint32_t a[2] = {PTR(0x100), PTR(0x420)};
      emit_record(fp, 0x6FDC0650, "PATH_IdaStar_FlushNodeToDynamicPath", "single_segment_rejected", a, 2, call_eax_ecx_ret(fn, a[0], a[1]), 0xFFFFFFFFu);
    }
    /* Case 3: 5 nodes with collinear run -> compresses to 3 turn points in forward order */
    {
      reset_arena();
      wr32(0x100 + 0x30, PTR(0x200));
      memset(MEM(0x200 + 0x9C), 0xCC, 32);
      uint16_t coords[5][2] = {{10, 20}, {11, 20}, {12, 20}, {12, 21}, {13, 22}};
      for (int i = 0; i < 5; i++) {
        uint32_t off = 0x400 + i * 0x20;
        wr16(off + 0x08, coords[i][0]);
        wr16(off + 0x0A, coords[i][1]);
        wr32(off + 0x14, i == 0 ? 0u : PTR(0x400 + (i - 1) * 0x20));
      }
      track_block(PTR(0x100), 0x40);
      track_block(PTR(0x200 + 0x9C), 32);
      track_block(PTR(0x400), 5 * 0x20);
      uint32_t a[2] = {PTR(0x100), PTR(0x400 + 4 * 0x20)};
      emit_record(fp, 0x6FDC0650, "PATH_IdaStar_FlushNodeToDynamicPath", "collinear_compressed_to_3", a, 2, call_eax_ecx_ret(fn, a[0], a[1]), 0xFFFFFFFFu);
    }
    /* Case 4: 80 zigzag nodes -> hits count == 78 cap -> returns 0 without copying */
    {
      reset_arena();
      wr32(0x100 + 0x30, PTR(0x200));
      memset(MEM(0x200 + 0x9C), 0xCC, 32);
      for (int i = 0; i < 80; i++) {
        uint32_t off = 0x500 + i * 0x20;
        wr16(off + 0x08, (uint16_t)(10 + i));
        wr16(off + 0x0A, (uint16_t)(20 + (i & 1)));
        wr32(off + 0x14, i == 0 ? 0u : PTR(0x500 + (i - 1) * 0x20));
      }
      track_block(PTR(0x100), 0x40);
      track_block(PTR(0x200 + 0x9C), 32);
      track_block(PTR(0x500), 80 * 0x20);
      uint32_t a[2] = {PTR(0x100), PTR(0x500 + 79 * 0x20)};
      emit_record(fp, 0x6FDC0650, "PATH_IdaStar_FlushNodeToDynamicPath", "overflow_78_rejected", a, 2, call_eax_ecx_ret(fn, a[0], a[1]), 0xFFFFFFFFu);
    }
  }

  /* 13. 0x6FDC07E0 PATH_IdaStar_AdvanceNeighborIndex */
  {
    struct {
      const char *id;
      uint32_t bRandom;
      uint32_t seedLo, seedHi;
      int32_t delta;
      uint32_t curIdx;
    } cases[] = {
      {"deterministic_plus_1", 0u, 0u, 0u, 1, 3u},
      {"deterministic_wrap_8", 0u, 0u, 0u, 3, 6u},
      {"deterministic_neg_delta", 0u, 0u, 0u, -1, 0u},
      {"random_seed_1_step", 1u, 0x12345678u, 0x00000001u, 1, 2u},
      {"random_seed_2_carry", 1u, 0xFFFFFFFFu, 0x7FFFFFFFu, -1, 5u},
    };
    for (unsigned i = 0; i < sizeof(cases) / sizeof(cases[0]); i++) {
      reset_arena();
      uint32_t ctx = 0x100, node = 0x200, seed = 0x300, deltaBox = 0x320;
      wr32(ctx + 0x36FD0, cases[i].bRandom);
      wr32(ctx + 0x36FD4, PTR(seed));
      wr32(seed + 0x00, cases[i].seedLo);
      wr32(seed + 0x04, cases[i].seedHi);
      wr32(deltaBox, (uint32_t)cases[i].delta);
      wr32(node + 0x0C, PTR(deltaBox));
      wr32(node + 0x10, cases[i].curIdx);

      track_block(PTR(ctx + 0x36FD0), 8);
      track_block(PTR(node), 0x18);
      track_block(PTR(seed), 8);
      track_block(PTR(deltaBox), 4);
      uint32_t a[2] = {PTR(ctx), PTR(node)};
      call_6FDC07E0(a[0], a[1]);
      emit_record(fp, 0x6FDC07E0, "PATH_IdaStar_AdvanceNeighborIndex", cases[i].id, a, 2, 0, 0);
    }
  }

  /* 14. 0x6FDCAB50 PATH_AStar_FlushNodeToDynamicPath */
  {
    uintptr_t fn = RVA(0x6FDCAB50);
    /* Case 1: pNode == NULL -> returns 0 */
    {
      reset_arena();
      wr32(0x100 + 0x30, PTR(0x200));
      memset(MEM(0x200 + 0x9C), 0xCC, 32);
      track_block(PTR(0x100), 0x40);
      track_block(PTR(0x200 + 0x9C), 32);
      uint32_t a[2] = {PTR(0x100), 0u};
      emit_record(fp, 0x6FDCAB50, "PATH_AStar_FlushNodeToDynamicPath", "null_node", a, 2, call_eax_ecx_ret(fn, a[0], a[1]), 0xFFFFFFFFu);
    }
    /* Case 2: single root node (pParent == 0) -> count == 0 < 1 -> returns 0 */
    {
      reset_arena();
      wr32(0x100 + 0x30, PTR(0x200));
      memset(MEM(0x200 + 0x9C), 0xCC, 32);
      wr16(0x400 + 0x00, 10); wr16(0x400 + 0x02, 20); wr32(0x400 + 0x0C, 0u);
      track_block(PTR(0x100), 0x40);
      track_block(PTR(0x200 + 0x9C), 32);
      track_block(PTR(0x400), 0x38);
      uint32_t a[2] = {PTR(0x100), PTR(0x400)};
      emit_record(fp, 0x6FDCAB50, "PATH_AStar_FlushNodeToDynamicPath", "root_only_count0_rejected", a, 2, call_eax_ecx_ret(fn, a[0], a[1]), 0xFFFFFFFFu);
    }
    /* Case 3: 1 non-root segment -> count == 1 >= 1 -> accepted in A* (unlike IDA*!) */
    {
      reset_arena();
      wr32(0x100 + 0x30, PTR(0x200));
      memset(MEM(0x200 + 0x9C), 0xCC, 32);
      wr16(0x400 + 0x00, 10); wr16(0x400 + 0x02, 20); wr32(0x400 + 0x0C, 0u);
      wr16(0x440 + 0x00, 11); wr16(0x440 + 0x02, 20); wr32(0x440 + 0x0C, PTR(0x400));
      track_block(PTR(0x100), 0x40);
      track_block(PTR(0x200 + 0x9C), 32);
      track_block(PTR(0x400), 0x80);
      uint32_t a[2] = {PTR(0x100), PTR(0x440)};
      emit_record(fp, 0x6FDCAB50, "PATH_AStar_FlushNodeToDynamicPath", "single_segment_accepted_count1", a, 2, call_eax_ecx_ret(fn, a[0], a[1]), 0xFFFFFFFFu);
    }
    /* Case 4: 5 nodes with collinear run -> compresses to 3 turn points */
    {
      reset_arena();
      wr32(0x100 + 0x30, PTR(0x200));
      memset(MEM(0x200 + 0x9C), 0xCC, 32);
      uint16_t coords[5][2] = {{10, 20}, {11, 20}, {12, 20}, {12, 21}, {13, 22}};
      for (int i = 0; i < 5; i++) {
        uint32_t off = 0x400 + i * 0x38;
        wr16(off + 0x00, coords[i][0]);
        wr16(off + 0x02, coords[i][1]);
        wr32(off + 0x0C, i == 0 ? 0u : PTR(0x400 + (i - 1) * 0x38));
      }
      track_block(PTR(0x100), 0x40);
      track_block(PTR(0x200 + 0x9C), 32);
      track_block(PTR(0x400), 5 * 0x38);
      uint32_t a[2] = {PTR(0x100), PTR(0x400 + 4 * 0x38)};
      emit_record(fp, 0x6FDCAB50, "PATH_AStar_FlushNodeToDynamicPath", "collinear_compressed_to_3", a, 2, call_eax_ecx_ret(fn, a[0], a[1]), 0xFFFFFFFFu);
    }
  }

  /* 15 & 17. 0x6FDCAE20 PATH_AStar_PushToOpenAndHash & 0x6FDCB220 PATH_AStar_PopBestOpenToClosed */
  {
    /* Push cases: empty open list, new best head, middle insertion, tail insertion, collision in same hash bucket */
    {
      reset_arena();
      uint32_t ctx = 0x100, n1 = 0x600;
      wr16(n1 + 0x00, 15); wr16(n1 + 0x02, 25); wr16(n1 + 0x04, 100);
      track_block(PTR(ctx), 0x404);
      track_block(PTR(n1), 0x38);
      uint32_t a[2] = {PTR(ctx), PTR(n1)};
      call_6FDCAE20(a[0], a[1]);
      emit_record(fp, 0x6FDCAE20, "PATH_AStar_PushToOpenAndHash", "push_into_empty_open", a, 2, 0, 0);
    }
    /* Push new best (fScore = 50 < head 100) into same hash bucket */
    {
      reset_arena();
      uint32_t ctx = 0x100, n1 = 0x600, n2 = 0x640;
      wr16(n1 + 0x00, 15); wr16(n1 + 0x02, 25); wr16(n1 + 0x04, 100);
      call_6FDCAE20(PTR(ctx), PTR(n1));
      wr16(n2 + 0x00, 15 + 128); wr16(n2 + 0x02, 25 + 128); wr16(n2 + 0x04, 50);
      track_block(PTR(ctx), 0x404);
      track_block(PTR(n1), 0x38);
      track_block(PTR(n2), 0x38);
      uint32_t a[2] = {PTR(ctx), PTR(n2)};
      call_6FDCAE20(a[0], a[1]);
      emit_record(fp, 0x6FDCAE20, "PATH_AStar_PushToOpenAndHash", "push_new_best_same_bucket", a, 2, 0, 0);
    }
    /* Push middle (fScore = 75 between 50 and 100) */
    {
      reset_arena();
      uint32_t ctx = 0x100, n1 = 0x600, n2 = 0x640, n3 = 0x680;
      wr16(n1 + 0x00, 15); wr16(n1 + 0x02, 25); wr16(n1 + 0x04, 100);
      wr16(n2 + 0x00, 15 + 128); wr16(n2 + 0x02, 25 + 128); wr16(n2 + 0x04, 50);
      call_6FDCAE20(PTR(ctx), PTR(n1));
      call_6FDCAE20(PTR(ctx), PTR(n2));
      wr16(n3 + 0x00, 42); wr16(n3 + 0x02, 99); wr16(n3 + 0x04, 75);
      track_block(PTR(ctx), 0x404);
      track_block(PTR(n1), 0x38);
      track_block(PTR(n2), 0x38);
      track_block(PTR(n3), 0x38);
      uint32_t a[2] = {PTR(ctx), PTR(n3)};
      call_6FDCAE20(a[0], a[1]);
      emit_record(fp, 0x6FDCAE20, "PATH_AStar_PushToOpenAndHash", "push_middle_fscore", a, 2, 0, 0);
    }
    /* Push tail (fScore = 150 > all existing) */
    {
      reset_arena();
      uint32_t ctx = 0x100, n1 = 0x600, n2 = 0x640, n4 = 0x6C0;
      wr16(n1 + 0x00, 15); wr16(n1 + 0x02, 25); wr16(n1 + 0x04, 100);
      wr16(n2 + 0x00, 30); wr16(n2 + 0x02, 40); wr16(n2 + 0x04, 50);
      call_6FDCAE20(PTR(ctx), PTR(n1));
      call_6FDCAE20(PTR(ctx), PTR(n2));
      wr16(n4 + 0x00, 77); wr16(n4 + 0x02, 88); wr16(n4 + 0x04, 150);
      track_block(PTR(ctx), 0x404);
      track_block(PTR(n1), 0x38);
      track_block(PTR(n2), 0x38);
      track_block(PTR(n4), 0x38);
      uint32_t a[2] = {PTR(ctx), PTR(n4)};
      call_6FDCAE20(a[0], a[1]);
      emit_record(fp, 0x6FDCAE20, "PATH_AStar_PushToOpenAndHash", "push_tail_fscore", a, 2, 0, 0);
    }

    /* Pop cases: empty open list, pop head of bucket, pop non-head of bucket, pop into non-empty closed bucket */
    {
      reset_arena();
      uint32_t ctx = 0x100;
      track_block(PTR(ctx), 0x404);
      uint32_t a[1] = {PTR(ctx)};
      emit_record(fp, 0x6FDCB220, "PATH_AStar_PopBestOpenToClosed", "pop_empty_open", a, 1, call_6FDCB220(a[0]), 0xFFFFFFFFu);
    }
    /* Pop when best node is at head of its open hash bucket */
    {
      reset_arena();
      uint32_t ctx = 0x100, n1 = 0x600, n2 = 0x640;
      wr16(n1 + 0x00, 15); wr16(n1 + 0x02, 25); wr16(n1 + 0x04, 100);
      wr16(n2 + 0x00, 15 + 128); wr16(n2 + 0x02, 25 + 128); wr16(n2 + 0x04, 50);
      call_6FDCAE20(PTR(ctx), PTR(n1));
      call_6FDCAE20(PTR(ctx), PTR(n2)); /* n2 is now head of both open bucket and best list */
      track_block(PTR(ctx), 0x404);
      track_block(PTR(n1), 0x38);
      track_block(PTR(n2), 0x38);
      uint32_t a[1] = {PTR(ctx)};
      emit_record(fp, 0x6FDCB220, "PATH_AStar_PopBestOpenToClosed", "pop_bucket_head", a, 1, call_6FDCB220(a[0]), 0xFFFFFFFFu);
    }
    /* Pop when best node is NOT at head of its open hash bucket (n1 pushed first with fScore=50, n2 pushed second into same bucket with fScore=100) */
    {
      reset_arena();
      uint32_t ctx = 0x100, n1 = 0x600, n2 = 0x640;
      wr16(n1 + 0x00, 15); wr16(n1 + 0x02, 25); wr16(n1 + 0x04, 50);
      wr16(n2 + 0x00, 15 + 128); wr16(n2 + 0x02, 25 + 128); wr16(n2 + 0x04, 100);
      call_6FDCAE20(PTR(ctx), PTR(n1));
      call_6FDCAE20(PTR(ctx), PTR(n2)); /* n2 is bucket head, but n1 is pOpenBest! */
      track_block(PTR(ctx), 0x404);
      track_block(PTR(n1), 0x38);
      track_block(PTR(n2), 0x38);
      uint32_t a[1] = {PTR(ctx)};
      emit_record(fp, 0x6FDCB220, "PATH_AStar_PopBestOpenToClosed", "pop_non_head_of_bucket", a, 1, call_6FDCB220(a[0]), 0xFFFFFFFFu);
    }
    /* Pop second node into already non-empty closed bucket */
    {
      reset_arena();
      uint32_t ctx = 0x100, n1 = 0x600, n2 = 0x640;
      wr16(n1 + 0x00, 15); wr16(n1 + 0x02, 25); wr16(n1 + 0x04, 50);
      wr16(n2 + 0x00, 15 + 128); wr16(n2 + 0x02, 25 + 128); wr16(n2 + 0x04, 100);
      call_6FDCAE20(PTR(ctx), PTR(n1));
      call_6FDCAE20(PTR(ctx), PTR(n2));
      call_6FDCB220(PTR(ctx)); /* pops n1 into closed bucket */
      track_block(PTR(ctx), 0x404);
      track_block(PTR(n1), 0x38);
      track_block(PTR(n2), 0x38);
      uint32_t a[1] = {PTR(ctx)};
      emit_record(fp, 0x6FDCB220, "PATH_AStar_PopBestOpenToClosed", "pop_into_nonempty_closed_bucket", a, 1, call_6FDCB220(a[0]), 0xFFFFFFFFu);
    }
  }
}

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "Usage: %s <b001.ndjson> <b007.ndjson> [b004.ndjson] [b016.ndjson]\n", argv[0]);
    return 1;
  }
  LoadLibraryA("Storm.dll");
  HMODULE hFog = LoadLibraryA("Fog.dll");
  if (hFog) {
    typedef void(__fastcall *FogInitSysFn)(int, void *);
    FogInitSysFn pInit = (FogInitSysFn)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089));
    if (pInit) pInit(1, NULL);
  }
  HMODULE hD2Common = LoadLibraryA("D2Common.dll");
  if (!hD2Common) {
    fprintf(stderr, "Failed to load D2Common.dll (err=%lu)\n", GetLastError());
    return 2;
  }
  g_base = (uintptr_t)hD2Common;
  if (g_base != EXPECTED_BASE) {
    fprintf(stderr, "Unexpected D2Common.dll base %p (expected 0x6FD50000)\n", (void *)g_base);
    return 3;
  }
  g_arena = (uint8_t *)VirtualAlloc((void *)(uintptr_t)ARENA_ADDR, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_EXECUTE_READWRITE);
  if (!g_arena || (uintptr_t)g_arena != ARENA_ADDR) {
    fprintf(stderr, "VirtualAlloc at 0x20000000 failed (got %p, err=%lu)\n", (void *)g_arena, GetLastError());
    return 4;
  }

  /* Save a copy of real Fog.dll gdwBitMasks and make IAT 0x6FDD90B0 writable */
  uint8_t saved_bitmasks[128];
  uint32_t iatBitMasksVa = (uint32_t)RVA(0x6FDD90B0);
  uint32_t realBmPtr = *(uint32_t *)(uintptr_t)iatBitMasksVa;
  memcpy(saved_bitmasks, (const void *)(uintptr_t)realBmPtr, 128);
  DWORD oldProt = 0;
  VirtualProtect((void *)(uintptr_t)iatBitMasksVa, 4, PAGE_READWRITE, &oldProt);

  FILE *fp1 = fopen(argv[1], "wb");
  FILE *fp7 = fopen(argv[2], "wb");
  if (!fp1 || !fp7) {
    fprintf(stderr, "Failed to open output files\n");
    return 5;
  }
  emit_b001(fp1);
  emit_b007(fp7);
  fclose(fp1);
  fclose(fp7);

  if (argc >= 5) {
    FILE *fp4 = fopen(argv[3], "wb");
    FILE *fp16 = fopen(argv[4], "wb");
    if (!fp4 || !fp16) {
      fprintf(stderr, "Failed to open B004/B016 output files\n");
      return 6;
    }
    emit_b004(fp4);
    emit_b016(fp16, saved_bitmasks);
    fclose(fp4);
    fclose(fp16);
  }

  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}

