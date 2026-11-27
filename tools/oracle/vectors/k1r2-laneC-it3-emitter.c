/*
 * Standalone MinGW real-DLL differential vector emitter for K1r2 Iteration 3 Lane C (B010 + B013, 48 functions).
 *
 * Loads the real Diablo II v1.13c D2Common.dll (image base 0x6FD50000) under Wine, allocates a
 * deterministic scratch arena at 0x20000000 and heap arena at 0x40000000, executes all 25 B010
 * functions and 23 B013 functions across normal and boundary/edge inputs, and writes NDJSON records
 * containing:
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
#define HEAP_ADDR     0x40000000u
#define HEAP_SIZE     0x00010000u

static uintptr_t g_base = 0;
static uint8_t *g_arena = NULL;
static uint8_t *g_heap = NULL;
static uint32_t g_heap_top = HEAP_ADDR;

#define RVA(va) (g_base - EXPECTED_BASE + (uint32_t)(va))
#define PTR(off) ((uint32_t)(ARENA_ADDR + (uint32_t)(off)))
#define MEM(off) (g_arena + (uint32_t)(off))

static void w16(uint32_t addr, uint16_t v) { *(uint16_t *)(uintptr_t)addr = v; }
static void w32(uint32_t addr, uint32_t v) { *(uint32_t *)(uintptr_t)addr = v; }

/* Deterministic Fog.#10045 bump allocator matching SparseMemory113c.alloc(size) at 0x40000000 */
static uint32_t __fastcall stub_fog_10045(
  uint32_t pMemPool,
  uint32_t nSize,
  uint32_t szFile,
  int32_t nLine,
  uint32_t unk0
) {
  (void)pMemPool;
  (void)szFile;
  (void)nLine;
  (void)unk0;
  uint32_t p = (g_heap_top + 3u) & ~3u;
  memset((void *)(uintptr_t)p, 0, nSize);
  g_heap_top = p + nSize;
  return p;
}

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
  if (g_heap) {
    memset(g_heap, 0, HEAP_SIZE);
  }
  g_heap_top = HEAP_ADDR;
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
typedef uint32_t(__stdcall *Std1)(uint32_t);
typedef uint32_t(__stdcall *Std5)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t(__fastcall *Fast1)(uint32_t);
typedef uint32_t(__fastcall *Fast2)(uint32_t, uint32_t);
typedef uint32_t(__fastcall *Fast3)(uint32_t, uint32_t, uint32_t);
typedef uint32_t(__fastcall *Fast4)(uint32_t, uint32_t, uint32_t, uint32_t);
typedef uint32_t(__fastcall *Fast6)(uint32_t, uint32_t, uint32_t, uint32_t, uint32_t, uint32_t);

/* Custom LTCG thunks for B010 */
/* 0x6FD7D3C0: [esp+4]=pLevel, ebx=pMinX, edi=pMinY, esi=pMaxX, edx=pMaxY; ret 4 */
static __attribute__((noinline)) void call_6FD7D3C0(uint32_t pLevel, uint32_t pMinX, uint32_t pMinY, uint32_t pMaxX, uint32_t pMaxY) {
  uintptr_t fn = RVA(0x6FD7D3C0);
  __asm__ volatile(
    "pushl %0\n\t"
    "call *%5"
    :
    : "m"(pLevel), "b"(pMinX), "D"(pMinY), "S"(pMaxX), "d"(pMaxY), "a"(fn)
    : "ecx", "memory", "cc"
  );
}

/* 0x6FD7D420: edx=pLevel; ret */
static __attribute__((noinline)) void call_6FD7D420(uint32_t pLevel) {
  uintptr_t fn = RVA(0x6FD7D420);
  __asm__ volatile(
    "call *%1"
    :
    : "d"(pLevel), "S"(fn)
    : "eax", "ecx", "memory", "cc"
  );
}

/* 0x6FD7D470: esi=pRect1, edx=pRect2 -> eax; ret */
static __attribute__((noinline)) uint32_t call_6FD7D470(uint32_t pRect1, uint32_t pRect2) {
  uintptr_t fn = RVA(0x6FD7D470);
  uint32_t r;
  __asm__ volatile(
    "call *%3"
    : "=a"(r)
    : "S"(pRect1), "d"(pRect2), "c"(fn)
    : "memory", "cc"
  );
  return r;
}

/* 0x6FD7D5B0: eax=pDrlg, edi=nX, esi=nY -> eax; ret */
static __attribute__((noinline)) uint32_t call_6FD7D5B0(uint32_t pDrlg, uint32_t nX, uint32_t nY) {
  uintptr_t fn = RVA(0x6FD7D5B0);
  uint32_t r;
  __asm__ volatile(
    "call *%4"
    : "=a"(r)
    : "a"(pDrlg), "D"(nX), "S"(nY), "c"(fn)
    : "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FD86FE0: eax=pPointNode, edi=pGrid, ebx=nValue; ret */
static __attribute__((noinline)) void call_6FD86FE0(uint32_t pPointNode, uint32_t pGrid, uint32_t nValue) {
  uintptr_t fn = RVA(0x6FD86FE0);
  __asm__ volatile(
    "call *%3"
    :
    : "a"(pPointNode), "D"(pGrid), "b"(nValue), "S"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FD87020: esi=pGrid, [esp+4]=pSegNode, [esp+8]=nValue, [esp+0xC]=eFlagOp, [esp+0x10]=bIncludeEnd; ret 0x10 */
static __attribute__((noinline)) void call_6FD87020(uint32_t pGrid, uint32_t pSegNode, uint32_t nValue, uint32_t eFlagOp, uint32_t bIncludeEnd) {
  uintptr_t fn = RVA(0x6FD87020);
  __asm__ volatile(
    "pushl %4\n\t"
    "pushl %3\n\t"
    "pushl %2\n\t"
    "pushl %1\n\t"
    "call *%5"
    :
    : "S"(pGrid), "m"(pSegNode), "m"(nValue), "m"(eFlagOp), "m"(bIncludeEnd), "a"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FD87170: eax=pEnv; ret */
static __attribute__((noinline)) void call_6FD87170(uint32_t pEnv) {
  uintptr_t fn = RVA(0x6FD87170);
  __asm__ volatile(
    "call *%1"
    :
    : "a"(pEnv), "S"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FD87570: eax=pEnv, ecx=nActNo; ret */
static __attribute__((noinline)) void call_6FD87570(uint32_t pEnv, uint32_t nActNo) {
  uintptr_t fn = RVA(0x6FD87570);
  __asm__ volatile(
    "call *%2"
    :
    : "a"(pEnv), "c"(nActNo), "S"(fn)
    : "edx", "memory", "cc"
  );
}

/* 0x6FD92460: esi=pLevel, [esp+4]=nMaxSpawns; ret 4 */
static __attribute__((noinline)) void call_6FD92460(uint32_t pLevel, uint32_t nMaxSpawns) {
  uintptr_t fn = RVA(0x6FD92460);
  __asm__ volatile(
    "pushl %1\n\t"
    "call *%2"
    :
    : "S"(pLevel), "m"(nMaxSpawns), "a"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FD9AB60 / 0x6FD9ABD0: eax=pColGrid, edx=pBox, [esp+4]=wMask; ret 4 */
static __attribute__((noinline)) void call_col_set_clear(uint32_t va, uint32_t pColGrid, uint32_t pBox, uint32_t wMask) {
  uintptr_t fn = RVA(va);
  __asm__ volatile(
    "pushl %2\n\t"
    "call *%3"
    :
    : "a"(pColGrid), "d"(pBox), "m"(wMask), "S"(fn)
    : "ecx", "memory", "cc"
  );
}

/* 0x6FD9AC40: ecx=pColGrid, eax=pBox, [esp+4]=wMask -> ax; ret 4 */
static __attribute__((noinline)) uint32_t call_6FD9AC40(uint32_t pColGrid, uint32_t pBox, uint32_t wMask) {
  uintptr_t fn = RVA(0x6FD9AC40);
  uint32_t r;
  __asm__ volatile(
    "pushl %3\n\t"
    "call *%4"
    : "=a"(r)
    : "c"(pColGrid), "a"(pBox), "m"(wMask), "S"(fn)
    : "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FD9B560: ecx=nSubX, eax=nSubY, [esp+4]=pColGrid, [esp+8]=wMask; ret 8 */
static __attribute__((noinline)) void call_6FD9B560(uint32_t nSubX, uint32_t nSubY, uint32_t pColGrid, uint32_t wMask) {
  uintptr_t fn = RVA(0x6FD9B560);
  __asm__ volatile(
    "pushl %3\n\t"
    "pushl %2\n\t"
    "call *%4"
    :
    : "c"(nSubX), "a"(nSubY), "m"(pColGrid), "m"(wMask), "S"(fn)
    : "edx", "memory", "cc"
  );
}

/* 0x6FDCB8D0: eax=pDrlg; ret */
static __attribute__((noinline)) void call_6FDCB8D0(uint32_t pDrlg) {
  uintptr_t fn = RVA(0x6FDCB8D0);
  __asm__ volatile(
    "call *%1"
    :
    : "a"(pDrlg), "S"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FDD14C0: edi=pRoomEx, [esp+4]=pGrid; ret 4 */
static __attribute__((noinline)) void call_6FDD14C0(uint32_t pRoomEx, uint32_t pGrid) {
  uintptr_t fn = RVA(0x6FDD14C0);
  __asm__ volatile(
    "pushl %1\n\t"
    "call *%2"
    :
    : "D"(pRoomEx), "m"(pGrid), "a"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FDD1650: eax=pRoomEx, [esp+4]=pGrid; ret 4 */
static __attribute__((noinline)) void call_6FDD1650(uint32_t pRoomEx, uint32_t pGrid) {
  uintptr_t fn = RVA(0x6FDD1650);
  __asm__ volatile(
    "pushl %1\n\t"
    "call *%2"
    :
    : "a"(pRoomEx), "m"(pGrid), "S"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* Custom LTCG thunks for B013 */
/* 0x6FD5A360: ebx=pRoomEx; ret */
static __attribute__((noinline)) void call_6FD5A360(uint32_t pRoomEx) {
  uintptr_t fn = RVA(0x6FD5A360);
  __asm__ volatile(
    "call *%1"
    :
    : "b"(pRoomEx), "S"(fn)
    : "eax", "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FD867F0: ecx=pOutGrid, eax=pWindowBox, edi=nRowStride, [esp+4]=pBaseCells, [esp+8]=pRowOffsets; ret 8 */
static __attribute__((noinline)) void call_6FD867F0(uint32_t pOutGrid, uint32_t pWindowBox, uint32_t nRowStride, uint32_t pBaseCells, uint32_t pRowOffsets) {
  uintptr_t fn = RVA(0x6FD867F0);
  __asm__ volatile(
    "pushl %4\n\t"
    "pushl %3\n\t"
    "call *%5"
    :
    : "c"(pOutGrid), "a"(pWindowBox), "D"(nRowStride), "m"(pBaseCells), "m"(pRowOffsets), "S"(fn)
    : "edx", "memory", "cc"
  );
}

/* 0x6FD86900: edx=pOutGrid, eax=pCellsBuf, ebx=nWidth, esi=nHeight, [esp+4]=pRowOffsetsBuf; ret 4 */
static __attribute__((noinline)) void call_6FD86900(uint32_t pOutGrid, uint32_t pCellsBuf, uint32_t nWidth, uint32_t nHeight, uint32_t pRowOffsetsBuf) {
  uintptr_t fn = RVA(0x6FD86900);
  __asm__ volatile(
    "pushl %4\n\t"
    "call *%5"
    :
    : "d"(pOutGrid), "a"(pCellsBuf), "b"(nWidth), "S"(nHeight), "m"(pRowOffsetsBuf), "c"(fn)
    : "memory", "cc"
  );
}

/* 0x6FD86A60: esi=pGrid, ebx=nValue, edi=eFlagOp; ret */
static __attribute__((noinline)) void call_6FD86A60(uint32_t pGrid, uint32_t nValue, uint32_t eFlagOp) {
  uintptr_t fn = RVA(0x6FD86A60);
  __asm__ volatile(
    "call *%3"
    :
    : "S"(pGrid), "b"(nValue), "D"(eFlagOp), "a"(fn)
    : "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FD86B10: ebx=pGrid, [esp+4]=nValue, [esp+8]=eFlagOp; ret 8 */
static __attribute__((noinline)) void call_6FD86B10(uint32_t pGrid, uint32_t nValue, uint32_t eFlagOp) {
  uintptr_t fn = RVA(0x6FD86B10);
  __asm__ volatile(
    "pushl %2\n\t"
    "pushl %1\n\t"
    "call *%3"
    :
    : "b"(pGrid), "m"(nValue), "m"(eFlagOp), "S"(fn)
    : "eax", "ecx", "edx", "memory", "cc"
  );
}

/* 0x6FD86CD0: eax=pSegNode, esi=pClipRect, [esp+4]=pGrid, [esp+8]=nValue, [esp+0xC]=eFlagOp, [esp+0x10]=nThickness; ret 0x10 */
static __attribute__((noinline)) void call_6FD86CD0(uint32_t pSegNode, uint32_t pClipRect, uint32_t pGrid, uint32_t nValue, uint32_t eFlagOp, uint32_t nThickness) {
  uintptr_t fn = RVA(0x6FD86CD0);
  __asm__ volatile(
    "pushl %5\n\t"
    "pushl %4\n\t"
    "pushl %3\n\t"
    "pushl %2\n\t"
    "call *%6"
    :
    : "a"(pSegNode), "S"(pClipRect), "m"(pGrid), "m"(nValue), "m"(eFlagOp), "m"(nThickness), "c"(fn)
    : "edx", "memory", "cc"
  );
}

/* 0x6FDD37F0: eax=nY, edi=pLvlSub, [esp+4]=nX, [esp+8]=pSubstCtx, [esp+0xC]=pBox -> eax; ret 0xC */
static __attribute__((noinline)) uint32_t call_6FDD37F0(uint32_t nY, uint32_t pLvlSub, uint32_t nX, uint32_t pSubstCtx, uint32_t pBox) {
  uintptr_t fn = RVA(0x6FDD37F0);
  uint32_t r;
  __asm__ volatile(
    "pushl %5\n\t"
    "pushl %4\n\t"
    "pushl %3\n\t"
    "call *%6"
    : "=a"(r)
    : "a"(nY), "D"(pLvlSub), "m"(nX), "m"(pSubstCtx), "m"(pBox), "S"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FDD3990: edx=nOffset, [esp+4]=nX, [esp+8]=nY, [esp+0xC]=pSubstCtx, [esp+0x10]=pBox, [esp+0x14]=pLvlSub; ret 0x14 */
static __attribute__((noinline)) void call_6FDD3990(uint32_t nOffset, uint32_t nX, uint32_t nY, uint32_t pBox, uint32_t pSubstCtx, uint32_t pLvlSub) {
  uintptr_t fn = RVA(0x6FDD3990);
  __asm__ volatile(
    "pushl %5\n\t"
    "pushl %3\n\t"
    "pushl %4\n\t"
    "pushl %2\n\t"
    "pushl %1\n\t"
    "call *%6"
    :
    : "d"(nOffset), "m"(nX), "m"(nY), "m"(pBox), "m"(pSubstCtx), "m"(pLvlSub), "a"(fn)
    : "ecx", "memory", "cc"
  );
}

/* 0x6FDD3B30: esi=pSubstCtx, [esp+4]=nX, [esp+8]=nY, [esp+0xC]=pBox, [esp+0x10]=pLvlSub -> eax; ret 0x10 */
static __attribute__((noinline)) uint32_t call_6FDD3B30(uint32_t pSubstCtx, uint32_t nX, uint32_t nY, uint32_t pBox, uint32_t pLvlSub) {
  uintptr_t fn = RVA(0x6FDD3B30);
  uint32_t r;
  __asm__ volatile(
    "pushl %5\n\t"
    "pushl %4\n\t"
    "pushl %3\n\t"
    "pushl %2\n\t"
    "call *%6"
    : "=a"(r)
    : "S"(pSubstCtx), "m"(nX), "m"(nY), "m"(pBox), "m"(pLvlSub), "a"(fn)
    : "ecx", "edx", "memory", "cc"
  );
  return r;
}

/* 0x6FD92920: eax=nLvlPrestId, edi=pLevel -> eax; ret */
static __attribute__((noinline)) uint32_t call_6FD92920(uint32_t nLvlPrestId, uint32_t pLevel) {
  uintptr_t fn = RVA(0x6FD92920);
  uint32_t r;
  __asm__ volatile(
    "call *%3"
    : "=a"(r)
    : "a"(nLvlPrestId), "D"(pLevel), "c"(fn)
    : "edx", "memory", "cc"
  );
  return r;
}

static void init_grid(uint32_t gOff, uint32_t cellsOff, uint32_t rowOff, int w, int h) {
  w32(PTR(gOff + 0x00), PTR(cellsOff));
  w32(PTR(gOff + 0x04), PTR(rowOff));
  w32(PTR(gOff + 0x08), (uint32_t)w);
  w32(PTR(gOff + 0x0C), (uint32_t)h);
  w32(PTR(gOff + 0x10), 1);
  for (int y = 0; y < h; y++) {
    w32(PTR(rowOff + y * 4), (uint32_t)(y * w));
  }
}

static void emit_b010_part1(FILE *fp) {
  /* 1. 0x6FD7D2C0: DRLG_GetActNoFromLevelId */
  {
    Std1 fn = (Std1)RVA(0x6FD7D2C0);
    const int32_t lvls[6] = { 1, 39, 40, 75, 103, 1024 };
    const char *ids[6] = { "act1_start", "act1_end", "act2_start", "act3_start", "act4_start", "overflow_1024" };
    for (int i = 0; i < 6; i++) {
      reset_arena();
      uint32_t args[1] = { (uint32_t)lvls[i] };
      uint32_t r = fn(args[0]);
      emit_record(fp, 0x6FD7D2C0, "DRLG_GetActNoFromLevelId", ids[i], args, 1, r, 0xFFu);
    }
  }

  /* 2. 0x6FD7D3C0: DRLG_ComputeLevelRoomsBoundingBox */
  {
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pLevel = PTR(0x100);
      uint32_t pMinX = PTR(0x400), pMinY = PTR(0x404), pMaxX = PTR(0x408), pMaxY = PTR(0x40C);
      uint32_t r1 = PTR(0x500), r2 = PTR(0x600), r3 = PTR(0x700);
      w32(pLevel + 0x10, r1);
      if (c == 0) {
        w32(r1 + 0x34, 10); w32(r1 + 0x38, 20); w32(r1 + 0x3C, 8); w32(r1 + 0x40, 6);
      } else if (c == 1) {
        w32(r1 + 0x34, 10); w32(r1 + 0x38, 20); w32(r1 + 0x3C, 8); w32(r1 + 0x40, 6); w32(r1 + 0x24, r2);
        w32(r2 + 0x34, 2);  w32(r2 + 0x38, 25); w32(r2 + 0x3C, 4); w32(r2 + 0x40, 10);
      } else if (c == 2) {
        w32(r1 + 0x34, 0);   w32(r1 + 0x38, 0);   w32(r1 + 0x3C, 5);  w32(r1 + 0x40, 5); w32(r1 + 0x24, r2);
        w32(r2 + 0x34, (uint32_t)-12); w32(r2 + 0x38, 4); w32(r2 + 0x3C, 6); w32(r2 + 0x40, 6); w32(r2 + 0x24, r3);
        w32(r3 + 0x34, 3);   w32(r3 + 0x38, (uint32_t)-8); w32(r3 + 0x3C, 20); w32(r3 + 0x40, 4);
      } else {
        w32(r1 + 0x34, 0);  w32(r1 + 0x38, 0);  w32(r1 + 0x3C, 50); w32(r1 + 0x40, 40); w32(r1 + 0x24, r2);
        w32(r2 + 0x34, 10); w32(r2 + 0x38, 10); w32(r2 + 0x3C, 5);  w32(r2 + 0x40, 5);
      }
      track_block(pLevel, 0x230);
      track_block(pMinX, 16);
      track_block(r1, 0x300);
      uint32_t args[5] = { pLevel, pMinX, pMinY, pMaxX, pMaxY };
      const char *ids[4] = { "single_room", "two_rooms", "negative_coords", "nested_room" };
      call_6FD7D3C0(pLevel, pMinX, pMinY, pMaxX, pMaxY);
      emit_record(fp, 0x6FD7D3C0, "DRLG_ComputeLevelRoomsBoundingBox", ids[c], args, 5, 0, 0);
    }
  }

  /* 3. 0x6FD7D420: DRLG_MarkLevelRoomsWithWarpFlag */
  {
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pLevel = PTR(0x100);
      uint32_t r1 = PTR(0x400), r2 = PTR(0x500), r3 = PTR(0x600);
      uint32_t arr = PTR(0x700);
      w32(r1 + 0x60, 0x10); w32(r2 + 0x60, 0x20); w32(r3 + 0x60, 0x00);
      if (c > 0) {
        w32(pLevel + 0x08, 3);
        w32(pLevel + 0x10, r1);
        w32(pLevel + 0x22C, arr);
        w32(r1 + 0x24, r2);
        w32(r2 + 0x24, r3);
        if (c == 1) { w32(arr + 0, 1); w32(arr + 4, 0); w32(arr + 8, 5); }
        else if (c == 2) { w32(arr + 0, 0); w32(arr + 4, 0); w32(arr + 8, 0); }
        else { w32(r1 + 0x60, 0x03); w32(arr + 0, 0xFFFFFFFFu); w32(r1 + 0x24, 0); }
      }
      track_block(pLevel, 0x230);
      track_block(r1, 0x300);
      track_block(arr, 16);
      uint32_t args[1] = { pLevel };
      const char *ids[4] = { "guard_null", "three_rooms_mixed", "all_zero_flags", "already_set" };
      call_6FD7D420(pLevel);
      emit_record(fp, 0x6FD7D420, "DRLG_MarkLevelRoomsWithWarpFlag", ids[c], args, 1, 0, 0);
    }
  }

  /* 4. 0x6FD7D470: DRLG_GetRectTouchDirection */
  {
    const int32_t rects[5][8] = {
      { 10, 5, 4, 4,  4, 5, 6, 4 },
      {  4, 5, 6, 4, 10, 5, 4, 4 },
      {  5, 12, 4, 4, 5, 4, 4, 8 },
      {  5, 4, 4, 8,  5, 12, 4, 4 },
      {  0, 0, 4, 4, 10, 10, 4, 4 },
    };
    const char *ids[5] = { "touch_left_0", "touch_right_2", "touch_top_1", "touch_bottom_3", "disjoint_neg1" };
    for (int c = 0; c < 5; c++) {
      reset_arena();
      uint32_t p1 = PTR(0x100), p2 = PTR(0x120);
      for (int k = 0; k < 4; k++) {
        w32(p1 + k * 4, (uint32_t)rects[c][k]);
        w32(p2 + k * 4, (uint32_t)rects[c][4 + k]);
      }
      track_block(p1, 0x30);
      uint32_t args[2] = { p1, p2 };
      uint32_t r = call_6FD7D470(p1, p2);
      emit_record(fp, 0x6FD7D470, "DRLG_GetRectTouchDirection", ids[c], args, 2, r, 0xFFFFFFFFu);
    }
  }

  /* 5. 0x6FD7D5B0: DRLG_FindLevelIdAtCoord */
  {
    const int32_t qx[4] = { 10, 10, 40, 65 };
    const int32_t qy[4] = { 20, 20, 20, 59 };
    const char *ids[4] = { "empty_list", "hit_lvl1_min", "hit_lvl2_boundary", "miss_outside" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pDrlg = PTR(0x100), lv1 = PTR(0x600), lv2 = PTR(0x900);
      if (c > 0) {
        w32(pDrlg + 0x47C, lv1);
        w32(lv1 + 0x1C, 10); w32(lv1 + 0x20, 20); w32(lv1 + 0x24, 30); w32(lv1 + 0x28, 40);
        w32(lv1 + 0x1D0, 2); w32(lv1 + 0x1AC, lv2);
        w32(lv2 + 0x1C, 40); w32(lv2 + 0x20, 20); w32(lv2 + 0x24, 25); w32(lv2 + 0x28, 40);
        w32(lv2 + 0x1D0, 3);
      }
      track_block(pDrlg, 0x488);
      track_block(lv1, 0x560);
      uint32_t args[3] = { pDrlg, (uint32_t)qx[c], (uint32_t)qy[c] };
      uint32_t r = call_6FD7D5B0(args[0], args[1], args[2]);
      emit_record(fp, 0x6FD7D5B0, "DRLG_FindLevelIdAtCoord", ids[c], args, 3, r, 0xFFFFFFFFu);
    }
  }

  /* 6. 0x6FD7D850: DRLG_GetLevelDefField94 */
  {
    Std1 fn = (Std1)RVA(0x6FD7D850);
    uint32_t *pSgpt = (uint32_t *)RVA(0x6FDE9E1C);
    uint32_t *pDef = (uint32_t *)RVA(0x6FDF0B38);
    uint32_t savedSgpt = *pSgpt, savedDef = *pDef;
    const int32_t ids_in[4] = { 0, 1, 2, 4 };
    const uint32_t vals[5] = { 0x12345678u, (uint32_t)-42, 777u, 0u, 255u };
    const char *cids[4] = { "rec_0", "rec_1_neg", "rec_2", "rec_4_last" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t dt = PTR(0x100), recs = PTR(0x1000);
      w32(dt + 0xC5C, 5);
      for (int i = 0; i < 5; i++) w32(recs + i * 0x9C + 0x94, vals[i]);
      *pSgpt = dt;
      *pDef = recs;
      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block((uint32_t)RVA(0x6FDF0B38), 4);
      track_block(dt + 0xC50, 0x20);
      track_block(recs, 5 * 0x9C);
      uint32_t args[1] = { (uint32_t)ids_in[c] };
      uint32_t r = fn(args[0]);
      emit_record(fp, 0x6FD7D850, "DRLG_GetLevelDefField94", cids[c], args, 1, r, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
    *pDef = savedDef;
  }
}

static void emit_b010_part2(FILE *fp) {
  /* 7. 0x6FD86FE0: ENVIRONMENT_Init (DRLGGRID_ApplyPointListCellFlags) */
  {
    const char *cids[4] = { "null_list", "three_in_bounds", "mixed_oob", "existing_bits_or" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      init_grid(0x100, 0x200, 0x180, 4, 4);
      uint32_t n1 = PTR(0x400), n2 = PTR(0x420), n3 = PTR(0x440);
      uint32_t head = 0;
      uint32_t val = 0x80u;
      if (c == 1) {
        head = n1;
        w32(n1 + 0, 0); w32(n1 + 4, 0); w32(n1 + 0x10, n2);
        w32(n2 + 0, 2); w32(n2 + 4, 1); w32(n2 + 0x10, n3);
        w32(n3 + 0, 3); w32(n3 + 4, 3); w32(n3 + 0x10, 0);
      } else if (c == 2) {
        head = n1;
        w32(n1 + 0, (uint32_t)-1); w32(n1 + 4, 0); w32(n1 + 0x10, n2);
        w32(n2 + 0, 4); w32(n2 + 4, 2); w32(n2 + 0x10, n3);
        w32(n3 + 0, 1); w32(n3 + 4, 1); w32(n3 + 0x10, 0);
      } else if (c == 3) {
        head = n1; val = 0x12u;
        w32(PTR(0x200 + (1 * 4 + 2) * 4), 0x05u);
        w32(n1 + 0, 2); w32(n1 + 4, 1); w32(n1 + 0x10, 0);
      }
      track_block(PTR(0x100), 0x200);
      track_block(n1, 0x60);
      uint32_t args[3] = { head, PTR(0x100), val };
      call_6FD86FE0(args[0], args[1], args[2]);
      emit_record(fp, 0x6FD86FE0, "ENVIRONMENT_Init", cids[c], args, 3, 0, 0);
    }
  }

  /* 8. 0x6FD87020: ENVIRONMENT_Alloc (DRLGGRID_ApplySegmentCellFlags) */
  {
    /* x1, y1, x2, y2, op, incEnd, uFlags */
    const int32_t segs[6][7] = {
      { 2, 2, 2, 2, 2, 1, 0x03 },
      { 1, 4, 1, 1, 0, 0, 0x30 },
      { 1, 1, 1, 4, 3, 1, 0x03 },
      { 4, 2, 1, 2, 5, 1, 0x03 },
      { 1, 2, 4, 2, 1, 1, 0x05 },
      { 1, 3, 4, 3, 4, 0, 0x77 },
    };
    const char *cids[6] = {
      "single_pt_xor",
      "vert_reverse_or_no_end",
      "vert_forward_overwrite_end",
      "horiz_reverse_andnot_end",
      "horiz_forward_and_end",
      "horiz_forward_overwrite_if_zero_no_end"
    };
    for (int c = 0; c < 6; c++) {
      reset_arena();
      init_grid(0x100, 0x200, 0x180, 6, 6);
      for (int i = 0; i < 36; i++) w32(PTR(0x200 + i * 4), 0x0Fu);
      if (c == 5) {
        w32(PTR(0x200 + (3 * 6 + 1) * 4), 0u);
        w32(PTR(0x200 + (3 * 6 + 3) * 4), 0u);
        w32(PTR(0x200 + (3 * 6 + 4) * 4), 0u);
      }
      uint32_t s1 = PTR(0x400), s2 = PTR(0x420);
      w32(s1 + 0, (uint32_t)segs[c][0]); w32(s1 + 4, (uint32_t)segs[c][1]); w32(s1 + 0x10, s2);
      w32(s2 + 0, (uint32_t)segs[c][2]); w32(s2 + 4, (uint32_t)segs[c][3]);
      track_block(PTR(0x100), 0x200);
      track_block(s1, 0x40);
      uint32_t args[5] = {
        PTR(0x100), s1, (uint32_t)segs[c][6],
        (uint32_t)segs[c][4], (uint32_t)segs[c][5]
      };
      call_6FD87020(args[0], args[1], args[2], args[3], args[4]);
      emit_record(fp, 0x6FD87020, "ENVIRONMENT_Alloc", cids[c], args, 5, 0, 0);
    }
  }

  /* 9. 0x6FD87170: ENVIRONMENT_SetCycleIndex */
  {
    const int32_t cfg[4][3] = {
      { 0, 0, 50 },
      { 0, 2, 50 },
      { 0, 5, 25 },
      { 1, 3, 40 },
    };
    const char *cids[4] = { "normal_idx0", "normal_idx2", "normal_idx5", "eclipse_idx3" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pEnv = PTR(0x100);
      w32(pEnv + 0x00, (uint32_t)cfg[c][1]);
      w32(pEnv + 0x28, (uint32_t)cfg[c][2]);
      w32(pEnv + 0x30, (uint32_t)cfg[c][0]);
      track_block(pEnv, 0x38);
      uint32_t args[1] = { pEnv };
      call_6FD87170(pEnv);
      emit_record(fp, 0x6FD87170, "ENVIRONMENT_SetCycleIndex", cids[c], args, 1, 0, 0);
    }
  }

  /* 10. 0x6FD87570: ENVIRONMENT_ApplyCycleColors */
  {
    const int32_t cfg[9][5] = {
      { 0, 0, 2, 100,   50 },
      { 0, 3, 2, 100,   50 },
      { 0, 2, 5, 10000, 50 },
      { 0, 0, 2, 8000,  50 },
      { 0, 0, 1, 17999, 50 },
      { 1, 3, 2, 7000,  50 },
      { 1, 3, 2, 9000,  50 },
      { 1, 1, 2, 6000,  50 },
      { 0, 0, 5, 16000, 50 },
    };
    const char *cids[9] = {
      "day_act1",
      "act4_fast",
      "night_act3",
      "row_advance",
      "wrap_360_rate",
      "eclipse_act3_below_9000",
      "eclipse_act3_cross_9000",
      "eclipse_non_act3_cross_6000",
      "wrap_idx5_to_0"
    };
    for (int c = 0; c < 9; c++) {
      reset_arena();
      uint32_t pEnv = PTR(0x100);
      w32(pEnv + 0x30, (uint32_t)cfg[c][0]);
      w32(pEnv + 0x00, (uint32_t)cfg[c][2]);
      w32(pEnv + 0x08, (uint32_t)cfg[c][3]);
      w32(pEnv + 0x28, (uint32_t)cfg[c][4]);
      track_block(pEnv, 0x38);
      uint32_t args[2] = { pEnv, (uint32_t)cfg[c][1] };
      call_6FD87570(args[0], args[1]);
      emit_record(fp, 0x6FD87570, "ENVIRONMENT_ApplyCycleColors", cids[c], args, 2, 0, 0);
    }
  }

  /* 11. 0x6FD92270: DRLGOUTDOORS_MapPresetSlotIndex */
  {
    Fast3 fn = (Fast3)RVA(0x6FD92270);
    const uint32_t cellVals[4] = { 0x00000000u, 0x00000400u, 0xFFFFFBFFu, 0x00000500u };
    const char *cids[4] = { "zero_bit10_clear", "bit10_set", "inv_bit10_clear", "bit10_and_8_set" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pLevel = PTR(0x100), pOut = PTR(0x400);
      w32(pLevel + 0x14, pOut);
      init_grid(0x42C, 0x600, 0x500, 4, 4);
      w32(PTR(0x600 + (1 * 4 + 2) * 4), cellVals[c]);
      track_block(pLevel, 0x30);
      track_block(pOut, 0x300);
      uint32_t args[3] = { pLevel, 2, 1 };
      uint32_t r = fn(args[0], args[1], args[2]);
      emit_record(fp, 0x6FD92270, "DRLGOUTDOORS_MapPresetSlotIndex", cids[c], args, 3, r, 0xFFFFFFFFu);
    }
  }

  /* 12 & 13. 0x6FD922A0 & 0x6FD922F0: SetOutdoorCellFlag200 & ClearOutdoorCellFlag200 */
  {
    Fast3 fnSet = (Fast3)RVA(0x6FD922A0);
    Fast3 fnClr = (Fast3)RVA(0x6FD922F0);
    const int coords[4][2] = { { 0, 0 }, { 3, 2 }, { 2, 1 }, { 1, 3 } };
    const char *cids[4] = { "cell_0_0", "cell_3_2", "cell_2_1", "cell_1_3" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pLevel = PTR(0x100), pOut = PTR(0x400);
      w32(pLevel + 0x14, pOut);
      init_grid(0x404, 0x600, 0x500, 4, 4);
      init_grid(0x42C, 0x700, 0x540, 4, 4);
      for (int i = 0; i < 16; i++) { w32(PTR(0x600 + i * 4), 99u); w32(PTR(0x700 + i * 4), 0xFFFu); }
      track_block(pLevel, 0x30);
      track_block(pOut, 0x400);
      uint32_t args[3] = { pLevel, (uint32_t)coords[c][0], (uint32_t)coords[c][1] };
      fnSet(args[0], args[1], args[2]);
      emit_record(fp, 0x6FD922A0, "DRLGOUTDOORS_SetOutdoorCellFlag200", cids[c], args, 3, 0, 0);

      reset_arena();
      w32(pLevel + 0x14, pOut);
      init_grid(0x404, 0x600, 0x500, 4, 4);
      init_grid(0x42C, 0x700, 0x540, 4, 4);
      for (int i = 0; i < 16; i++) { w32(PTR(0x600 + i * 4), 42u); w32(PTR(0x700 + i * 4), 0x100u); }
      track_block(pLevel, 0x30);
      track_block(pOut, 0x400);
      fnClr(args[0], args[1], args[2]);
      emit_record(fp, 0x6FD922F0, "DRLGOUTDOORS_ClearOutdoorCellFlag200", cids[c], args, 3, 0, 0);
    }
  }
}

static void emit_b010_part3(FILE *fp) {
  /* 14. 0x6FD92370: DRLGOUTDOORS_SpawnOutdoorRoomEx */
  {
    Fast6 fn = (Fast6)RVA(0x6FD92370);
    uint32_t *pSgpt = (uint32_t *)RVA(0x6FDE9E1C);
    uint32_t *pPrest = (uint32_t *)RVA(0x6FDF0B3C);
    uint32_t savedSgpt = *pSgpt, savedPrest = *pPrest;
    const int32_t cfg[8][5] = {
      { 1, 1, 0, 0, 0 },
      { 1, 1, 0, 0, 0 },
      { 1, 1, 1, 1, 0x09 },
      { 0, 1, 0, 1, 0x08 },
      { 1, 1, 2, 1, 0x02 },
      { 1, 1, 2, 1, 0x02 },
      { 1, 1, 2, 1, 0x04 },
      { 1, 1, 2, 1, 0x04 },
    };
    const char *cids[8] = {
      "prest0_free",
      "prest0_blocked",
      "prest1_expanded_free",
      "expanded_oob",
      "prest2_flag02_plus_x_free",
      "prest2_flag02_plus_x_blocked",
      "prest2_flag04_plus_y_free",
      "prest2_flag04_plus_y_blocked"
    };
    for (int c = 0; c < 8; c++) {
      reset_arena();
      uint32_t dt = PTR(0x100), prestArr = PTR(0x1000);
      w32(dt + 0xC68, 4);
      w32(prestArr + 1 * 0x1B0 + 0x28, 16);
      w32(prestArr + 1 * 0x1B0 + 0x2C, 8);
      w32(prestArr + 2 * 0x1B0 + 0x28, 8);
      w32(prestArr + 2 * 0x1B0 + 0x2C, 8);
      *pSgpt = dt;
      *pPrest = prestArr;
      uint32_t pLevel = PTR(0x2000), pOut = PTR(0x2100);
      w32(pLevel + 0x14, pOut);
      init_grid(0x212C, 0x2300, 0x2200, 4, 4);
      if (c == 0) w32(PTR(0x2300 + (1 * 4 + 1) * 4), 0x0400u);
      if (c == 1) w32(PTR(0x2300 + (1 * 4 + 1) * 4), 0x0080u);
      if (c == 5) w32(PTR(0x2300 + (1 * 4 + 2) * 4), 0x0080u); /* (2,1) in +x border */
      if (c == 7) w32(PTR(0x2300 + (2 * 4 + 1) * 4), 0x0080u); /* (1,2) in +y border */
      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block((uint32_t)RVA(0x6FDF0B3C), 4);
      track_block(dt + 0xC60, 0x10);
      track_block(prestArr, 3 * 0x1B0);
      track_block(pLevel, 0x400);
      uint32_t args[6] = {
        pLevel, (uint32_t)cfg[c][0], (uint32_t)cfg[c][1],
        (uint32_t)cfg[c][2], (uint32_t)cfg[c][3], (uint32_t)cfg[c][4]
      };
      uint32_t r = fn(args[0], args[1], args[2], args[3], args[4], args[5]);
      emit_record(fp, 0x6FD92370, "DRLGOUTDOORS_SpawnOutdoorRoomEx", cids[c], args, 6, r, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
    *pPrest = savedPrest;
  }

  /* 15. 0x6FD92460: DRLGOUTDOORS_SpawnRandomOutdoorThemes */
  {
    const int32_t cfg[4][3] = {
      { 2, 4, 2 },
      { 4, 4, 2 },
      { 5, 4, 3 },
      { 4, 4, 3 },
    };
    const char *cids[4] = { "zero_interior", "pow2_4x4", "non_pow2_5x4", "blocked_interior" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pLevel = PTR(0x100), pOut = PTR(0x400);
      w32(pLevel + 0x14, pOut);
      w32(pLevel + 0x1C4, 0x12345678u + (uint32_t)c);
      w32(pLevel + 0x1C8, 0x0000029Au);
      w32(pOut + 0x5C, (uint32_t)cfg[c][0]);
      w32(pOut + 0x60, (uint32_t)cfg[c][1]);
      init_grid(0x418, 0x600, 0x500, cfg[c][0], cfg[c][1]);
      init_grid(0x42C, 0x700, 0x540, cfg[c][0], cfg[c][1]);
      if (c == 3) {
        w32(PTR(0x700 + (1 * 4 + 1) * 4), 0x0001u);
        w32(PTR(0x700 + (2 * 4 + 2) * 4), 0x0800u);
      }
      track_block(pLevel, 0x230);
      track_block(pOut, 0x400);
      uint32_t args[2] = { pLevel, (uint32_t)cfg[c][2] };
      call_6FD92460(args[0], args[1]);
      emit_record(fp, 0x6FD92460, "DRLGOUTDOORS_SpawnRandomOutdoorThemes", cids[c], args, 2, 0, 0);
    }
  }

  /* 16, 17, 18. 0x6FD9AB60, 0x6FD9ABD0, 0x6FD9AC40: Collision BoundingBox Set / Clear / Check */
  {
    const int32_t boxes[5][4] = {
      { 12, 23, 12, 23 },
      { 11, 21, 13, 22 },
      { 11, 25, 13, 22 },
      { 10, 20, 11, 21 },
      { 11, 22, 13, 22 },
    };
    const uint16_t masks[5] = { 0x0004u, 0x0101u, 0x00FFu, 0x0081u, 0x0004u };
    const char *cids[5] = { "single_subtile", "rect_3x2", "inverted_y", "origin_2x2", "single_row_hit" };
    for (int c = 0; c < 5; c++) {
      /* SetMask (0x6FD9AB60) */
      reset_arena();
      uint32_t pCol = PTR(0x100), pBox = PTR(0x140), pMap = PTR(0x200);
      w32(pCol + 0x00, 10); w32(pCol + 0x04, 20); w32(pCol + 0x08, 5); w32(pCol + 0x0C, 5); w32(pCol + 0x20, pMap);
      for (int i = 0; i < 25; i++) w16(pMap + i * 2, (c == 3) ? 0x0080u : 0x0000u);
      for (int k = 0; k < 4; k++) w32(pBox + k * 4, (uint32_t)boxes[c][k]);
      track_block(pCol, 0x180);
      uint32_t argsSet[3] = { pCol, pBox, masks[c] };
      call_col_set_clear(0x6FD9AB60, argsSet[0], argsSet[1], argsSet[2]);
      emit_record(fp, 0x6FD9AB60, "COLLISION_SetMaskForBoundingBox", cids[c], argsSet, 3, 0, 0);

      /* ClearMask (0x6FD9ABD0) */
      reset_arena();
      w32(pCol + 0x00, 10); w32(pCol + 0x04, 20); w32(pCol + 0x08, 5); w32(pCol + 0x0C, 5); w32(pCol + 0x20, pMap);
      for (int i = 0; i < 25; i++) w16(pMap + i * 2, 0xFFFFu);
      for (int k = 0; k < 4; k++) w32(pBox + k * 4, (uint32_t)boxes[c][k]);
      track_block(pCol, 0x180);
      call_col_set_clear(0x6FD9ABD0, argsSet[0], argsSet[1], argsSet[2]);
      emit_record(fp, 0x6FD9ABD0, "COLLISION_ClearMaskForBoundingBox", cids[c], argsSet, 3, 0, 0);

      /* CheckMask (0x6FD9AC40): args = [pColGrid, pBox, wMask] */
      reset_arena();
      w32(pCol + 0x00, 10); w32(pCol + 0x04, 20); w32(pCol + 0x08, 5); w32(pCol + 0x0C, 5); w32(pCol + 0x20, pMap);
      if (c == 1) { w16(pMap + (1 * 5 + 1) * 2, 0x0001u); w16(pMap + (2 * 5 + 3) * 2, 0x0100u); }
      if (c == 3) { w16(pMap + 0, 0x0480u); }
      if (c == 4) { w16(pMap + (2 * 5 + 2) * 2, 0x0004u); }
      for (int k = 0; k < 4; k++) w32(pBox + k * 4, (uint32_t)boxes[c][k]);
      track_block(pCol, 0x180);
      uint32_t r = call_6FD9AC40(argsSet[0], argsSet[1], argsSet[2]);
      emit_record(fp, 0x6FD9AC40, "COLLISION_CheckMaskForBoundingBox", cids[c], argsSet, 3, r, 0xFFFFu);
    }
  }

  /* 19. 0x6FD9B560: COLLISION_FillTileSubtilesMask */
  {
    const int32_t rels[4][2] = { { 0, 0 }, { 5, 0 }, { -2, -3 }, { -5, -5 } };
    const char *cids[4] = { "null_grid", "pos_offset_5_0", "neg_clamped", "fully_neg_noop" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pCol = PTR(0x100), pMap = PTR(0x200);
      w32(pCol + 0x08, 10); w32(pCol + 0x0C, 10); w32(pCol + 0x20, pMap);
      track_block(pCol, 0x200);
      uint32_t args[4] = {
        (uint32_t)rels[c][0], (uint32_t)rels[c][1],
        (c == 0) ? 0u : pCol, 0x0005u
      };
      call_6FD9B560(args[0], args[1], args[2], args[3]);
      emit_record(fp, 0x6FD9B560, "COLLISION_FillTileSubtilesMask", cids[c], args, 4, 0, 0);
    }
  }

  /* 20. 0x6FDCB8D0: DRLG_InitActWarpLists */
  {
    const uint8_t fills[4] = { 0x00u, 0xFFu, 0x55u, 0xAAu };
    const uint32_t offs[4] = { 0x100u, 0x100u, 0x200u, 0x300u };
    const char *cids[4] = { "zero_buf", "ff_buf", "reloc_200", "reloc_300" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pDrlg = PTR(offs[c]);
      memset(MEM(offs[c]), fills[c], 0x488);
      track_block(pDrlg, 0x488);
      uint32_t args[1] = { pDrlg };
      call_6FDCB8D0(pDrlg);
      emit_record(fp, 0x6FDCB8D0, "DRLG_InitActWarpLists", cids[c], args, 1, 0, 0);
    }
  }
}

static void emit_b010_part4(FILE *fp) {
  /* 21. 0x6FDD0EE0: DRLGLOGIC_ReplaceRoomCoordListIndex */
  {
    Fast4 fn = (Fast4)RVA(0x6FDD0EE0);
    const char *cids[4] = { "null_logic", "single_room_replace", "two_rooms_cyclic_same_lvl", "neighbor_diff_lvl" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t r1 = PTR(0x100), r2 = PTR(0x200), lv1 = PTR(0x400), lv2 = PTR(0x700);
      uint32_t lg1 = PTR(0xA00), lg2 = PTR(0xA80);
      uint32_t n1 = PTR(0xB00), n2 = PTR(0xB40), n3 = PTR(0xB80), n4 = PTR(0xBC0);
      uint32_t near1 = PTR(0xC00), near2 = PTR(0xC20);
      w32(lv1 + 0x1D0, 10);
      w32(lv2 + 0x1D0, (c == 3) ? 11u : 10u);
      if (c > 0) {
        w32(r1 + 0x64, lg1); w32(r1 + 0x58, lv1);
        w32(lg1 + 0x30, n1);
        w32(n1 + 0x28, 5); w32(n1 + 0x2C, n2);
        w32(n2 + 0x28, 9); w32(n2 + 0x2C, n3);
        w32(n3 + 0x28, 5); w32(n3 + 0x2C, 0);
        if (c >= 2) {
          w32(r1 + 0x08, near1); w32(r1 + 0x2C, 2);
          w32(near1 + 0, r1); w32(near1 + 4, r2);
          w32(r2 + 0x64, lg2); w32(r2 + 0x58, lv2);
          w32(r2 + 0x08, near2); w32(r2 + 0x2C, 1);
          w32(near2 + 0, r1);
          w32(lg2 + 0x30, n4);
          w32(n4 + 0x28, 5); w32(n4 + 0x2C, 0);
        }
      }
      track_block(PTR(0x100), 0xB40);
      uint32_t args[4] = { r1, 5, 2, 0 };
      fn(args[0], args[1], args[2], args[3]);
      emit_record(fp, 0x6FDD0EE0, "DRLGLOGIC_ReplaceRoomCoordListIndex", cids[c], args, 4, 0, 0);
    }
  }

  /* 22. 0x6FDD14C0: DRLGLOGIC_MarkWallTileCells */
  {
    const char *cids[4] = { "own_four_tiles", "neighbor_wall_link", "neighbor_floor_link_skip", "neighbor_oob_skip" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t r1 = PTR(0x100), r2 = PTR(0x200), tg1 = PTR(0x300), tg2 = PTR(0x380);
      uint32_t walls1 = PTR(0x400), link = PTR(0x600), ltile = PTR(0x640), nearArr = PTR(0x700);
      init_grid(0x800, 0x900, 0x880, 5, 5);
      w32(r1 + 0x34, 10); w32(r1 + 0x38, 20); w32(r1 + 0x3C, 4); w32(r1 + 0x40, 4); w32(r1 + 0x54, tg1);
      w32(tg1 + 0x14, walls1); w32(tg1 + 0x18, 4);
      /* Tile 0: valid (0x4000, type 1) at (1, 2) */
      w32(walls1 + 0x00 + 0x08, 1); w32(walls1 + 0x00 + 0x0C, 2); w32(walls1 + 0x00 + 0x14, 0x4000u); w32(walls1 + 0x00 + 0x1C, 1);
      /* Tile 1: wrong flag 0x8000 */
      w32(walls1 + 0x30 + 0x08, 2); w32(walls1 + 0x30 + 0x0C, 2); w32(walls1 + 0x30 + 0x14, 0x8000u); w32(walls1 + 0x30 + 0x1C, 1);
      /* Tile 2: type 15 */
      w32(walls1 + 0x60 + 0x08, 3); w32(walls1 + 0x60 + 0x0C, 2); w32(walls1 + 0x60 + 0x14, 0x4000u); w32(walls1 + 0x60 + 0x1C, 15);
      /* Tile 3: bit 11 set (0x4800) */
      w32(walls1 + 0x90 + 0x08, 0); w32(walls1 + 0x90 + 0x0C, 2); w32(walls1 + 0x90 + 0x14, 0x4800u); w32(walls1 + 0x90 + 0x1C, 1);
      if (c > 0) {
        w32(r1 + 0x08, nearArr); w32(r1 + 0x2C, 1); w32(nearArr, r2);
        w32(r2 + 0x34, 8); w32(r2 + 0x38, 18); w32(r2 + 0x54, tg2);
        w32(tg2 + 0x00, link);
        w32(link + 0x00, (c == 2) ? 1u : 0u);
        w32(link + 0x04, ltile);
        w32(ltile + 0x08, (c == 3) ? 10u : 6u);
        w32(ltile + 0x0C, 6);
        w32(ltile + 0x14, 0x4000u);
        w32(ltile + 0x1C, 2);
      }
      track_block(PTR(0x100), 0x900);
      uint32_t args[2] = { r1, PTR(0x800) };
      call_6FDD14C0(args[0], args[1]);
      emit_record(fp, 0x6FDD14C0, "DRLGLOGIC_MarkWallTileCells", cids[c], args, 2, 0, 0);
    }
  }

  /* 23. 0x6FDD1650: DRLGLOGIC_MarkFloorTileCells */
  {
    const uint32_t flags[4] = { 0x0004u, 0x4004u, 0x0000u, 0x0004u };
    const char *cids[4] = { "valid_floor_bit2", "skip_wall_bits", "skip_no_bit2", "accumulate_or8" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t r1 = PTR(0x100), tg1 = PTR(0x200), walls = PTR(0x300);
      init_grid(0x500, 0x600, 0x580, 4, 4);
      if (c == 3) w32(PTR(0x600 + (1 * 4 + 2) * 4), 0x01u);
      w32(r1 + 0x54, tg1);
      w32(tg1 + 0x14, walls); w32(tg1 + 0x18, 1);
      w32(walls + 0x08, 2); w32(walls + 0x0C, 1); w32(walls + 0x14, flags[c]);
      track_block(PTR(0x100), 0x580);
      uint32_t args[2] = { r1, PTR(0x500) };
      call_6FDD1650(args[0], args[1]);
      emit_record(fp, 0x6FDD1650, "DRLGLOGIC_MarkFloorTileCells", cids[c], args, 2, 0, 0);
    }
  }

  /* 24. 0x6FDD17A0: DRLGLOGIC_FloodFillLogicalCoordGrid */
  {
    Fast4 fn = (Fast4)RVA(0x6FDD17A0);
    const int32_t starts[10][3] = {
      { -1, 0,  0 },
      {  0, 0,  0 },
      {  0, 0,  0 },
      {  1, 0,  0 },
      {  0, 0, -1 },
      {  1, 1,  2 },
      {  1, 1,  0 },
      {  1, 1,  1 },
      {  1, 1,  3 },
      {  1, 1, -1 },
    };
    const char *cids[10] = {
      "oob_start",
      "already_visited",
      "open_2x2_room",
      "wall_style1_dir0",
      "wall_style3_diag_tail_from_neg1",
      "wall_style7_from_dir2_exclude_plus_x",
      "wall_style7_from_dir0_exclude_minus_x",
      "wall_style7_from_dir1_exclude_minus_y",
      "wall_style7_from_dir3_exclude_plus_y",
      "wall_null_style_grid_group_neg1"
    };
    for (int c = 0; c < 10; c++) {
      reset_arena();
      uint32_t ctx = PTR(0x100), r1 = PTR(0x200);
      w32(r1 + 0x34, 10); w32(r1 + 0x38, 20); w32(r1 + 0x3C, 2); w32(r1 + 0x40, 2);
      init_grid(0x300, 0x400, 0x380, 3, 3); /* pIndexGrid (+0x04) */
      init_grid(0x500, 0x600, 0x580, 3, 3); /* pWallTypeGrid (+0x08) */
      init_grid(0x700, 0x800, 0x780, 3, 3); /* pWallFloorGrid (+0x14) */
      w32(ctx + 0x00, r1);
      w32(ctx + 0x04, PTR(0x300));
      w32(ctx + 0x08, (c == 9) ? 0u : PTR(0x500));
      w32(ctx + 0x14, PTR(0x700));
      w32(ctx + 0x1C, 0x10000005u);
      if (c == 1) w32(PTR(0x400 + 0), 0x10000001u);
      if (c == 3) {
        w32(PTR(0x800 + (0 * 3 + 1) * 4), 1u);
        w32(PTR(0x600 + (0 * 3 + 1) * 4), 1u);
      }
      if (c == 4) {
        /* All cells are walls; (0,0) has style=3 (group=2 -> mask=0x27 for fromDir=-1: OpOr, +x, +y, and &0x20 diag to (1,1));
         * (1,1) has style=1 (group=0 -> mask=0x17 for fromDir=-1: OpOr, +x, +y, -y). */
        for (int i = 0; i < 9; i++) w32(PTR(0x800 + i * 4), 1u);
        w32(PTR(0x600 + (0 * 3 + 0) * 4), 3u);
        w32(PTR(0x600 + (1 * 3 + 1) * 4), 1u);
      }
      if (c >= 5 && c <= 8) {
        /* All 9 cells are walls; center (1,1) has style=7 (group=3 -> mask=0x1F).
         * Orthogonal neighbors mark themselves and step OOB without recursing into other in-bounds cells:
         * (2,1) style=2 (fromDir=0 -> 0x03), (1,2) style=1 (fromDir=1 -> 0x05),
         * (0,1) style=2 (fromDir=2 -> 0x09), (1,0) style=1 (fromDir=3 -> 0x11). */
        for (int i = 0; i < 9; i++) w32(PTR(0x800 + i * 4), 1u);
        w32(PTR(0x600 + (1 * 3 + 1) * 4), 7u);
        w32(PTR(0x600 + (1 * 3 + 2) * 4), 2u);
        w32(PTR(0x600 + (2 * 3 + 1) * 4), 1u);
        w32(PTR(0x600 + (1 * 3 + 0) * 4), 2u);
        w32(PTR(0x600 + (0 * 3 + 1) * 4), 1u);
      }
      if (c == 9) {
        w32(PTR(0x800 + (1 * 3 + 1) * 4), 1u);
      }
      track_block(PTR(0x100), 0x800);
      uint32_t args[4] = { ctx, (uint32_t)starts[c][0], (uint32_t)starts[c][1], (uint32_t)starts[c][2] };
      fn(args[0], args[1], args[2], args[3]);
      emit_record(fp, 0x6FDD17A0, "DRLGLOGIC_FloodFillLogicalCoordGrid", cids[c], args, 4, 0, 0);
    }
  }

  /* 25. 0x6FDD1A20: DRLGLOGIC_AssignTileDataCoordListPointers */
  {
    Std1 fn = (Std1)RVA(0x6FDD1A20);
    const char *cids[4] = { "null_logic", "flag_bit0_set", "copy_coord_ptrs", "zero_walls" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t r1 = PTR(0x100), tg1 = PTR(0x200), walls = PTR(0x300), lg1 = PTR(0x500);
      w32(r1 + 0x54, tg1);
      w32(tg1 + 0x14, walls);
      w32(tg1 + 0x18, (c == 3) ? 0u : 2u);
      w32(walls + 0x00 + 0x08, 1); w32(walls + 0x00 + 0x0C, 0); w32(walls + 0x00 + 0x10, 0xDEADu);
      w32(walls + 0x30 + 0x08, 0); w32(walls + 0x30 + 0x0C, 1); w32(walls + 0x30 + 0x10, 0xBEEFu);
      if (c >= 1) {
        w32(r1 + 0x64, lg1);
        w32(lg1 + 0x00, (c == 1) ? 1u : 0u);
        init_grid(0x51C, 0x600, 0x580, 2, 2);
        w32(PTR(0x600 + 1 * 4), 0x20001111u);
        w32(PTR(0x600 + 2 * 4), 0x20002222u);
      }
      track_block(PTR(0x100), 0x540);
      uint32_t args[1] = { r1 };
      fn(r1);
      emit_record(fp, 0x6FDD1A20, "DRLGLOGIC_AssignTileDataCoordListPointers", cids[c], args, 1, 0, 0);
    }
  }
}

static void emit_b010(FILE *fp) {
  emit_b010_part1(fp);
  emit_b010_part2(fp);
  emit_b010_part3(fp);
  emit_b010_part4(fp);
}

static void emit_b013_part1(FILE *fp) {
  /* 1. 0x6FD5A360: DRLGPRESET_RelinkMapPresetUnitsToRoomEx */
  {
    const char *cids[4] = { "empty_list", "single_inside", "three_mixed_lifo", "boundary_exclusive" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t r1 = PTR(0x100), pr = PTR(0x200), dm = PTR(0x280);
      uint32_t u1 = PTR(0x300), u2 = PTR(0x340), u3 = PTR(0x380);
      w32(r1 + 0x20, pr); w32(pr + 0x08, dm);
      w32(r1 + 0x34, 10); w32(r1 + 0x38, 20); w32(r1 + 0x3C, 4); w32(r1 + 0x40, 3);
      if (c == 1) {
        w32(dm + 0x38, u1);
        w32(u1 + 0x08, 55); w32(u1 + 0x18, 105);
      } else if (c == 2) {
        w32(dm + 0x38, u1);
        w32(u1 + 0x08, 55); w32(u1 + 0x18, 105); w32(u1 + 0x0C, u2);
        w32(u2 + 0x08, 70); w32(u2 + 0x18, 105); w32(u2 + 0x0C, u3);
        w32(u3 + 0x08, 50); w32(u3 + 0x18, 100); w32(u3 + 0x0C, 0);
      } else if (c == 3) {
        w32(dm + 0x38, u1);
        w32(u1 + 0x08, 49); w32(u1 + 0x18, 100); w32(u1 + 0x0C, u2);
        w32(u2 + 0x08, 50); w32(u2 + 0x18, 115); w32(u2 + 0x0C, 0);
      }
      track_block(r1, 0x300);
      uint32_t args[1] = { r1 };
      call_6FD5A360(r1);
      emit_record(fp, 0x6FD5A360, "DRLGPRESET_RelinkMapPresetUnitsToRoomEx", cids[c], args, 1, 0, 0);
    }
  }

  /* 2, 3, 4. 0x6FD86710, 0x6FD86720, 0x6FD86730: SEED_GetSeeds / SetSeeds / GetLowSeed */
  {
    Fast3 fnGet = (Fast3)RVA(0x6FD86710);
    Fast3 fnSet = (Fast3)RVA(0x6FD86720);
    Fast1 fnLow = (Fast1)RVA(0x6FD86730);
    const uint32_t pairs[4][2] = {
      { 0x12345678u, 0x9ABCDEF0u },
      { 0u, 0u },
      { 0xFFFFFFFFu, 0x80000000u },
      { 1u, 666u },
    };
    const char *cids[4] = { "pair_0", "zeros", "high_bits", "one_666" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pSeed = PTR(0x100), pLo = PTR(0x110), pHi = PTR(0x114);
      w32(pSeed + 0, pairs[c][0]); w32(pSeed + 4, pairs[c][1]);
      track_block(pSeed, 0x20);
      uint32_t argsGet[3] = { pSeed, pLo, pHi };
      fnGet(argsGet[0], argsGet[1], argsGet[2]);
      emit_record(fp, 0x6FD86710, "SEED_GetSeeds", cids[c], argsGet, 3, 0, 0);

      reset_arena();
      track_block(pSeed, 0x10);
      uint32_t argsSet[3] = { pSeed, pairs[c][0], pairs[c][1] };
      fnSet(argsSet[0], argsSet[1], argsSet[2]);
      emit_record(fp, 0x6FD86720, "SEED_SetSeeds", cids[c], argsSet, 3, 0, 0);

      reset_arena();
      w32(pSeed + 0, pairs[c][0]); w32(pSeed + 4, pairs[c][1]);
      track_block(pSeed, 0x10);
      uint32_t argsLow[1] = { pSeed };
      uint32_t r = fnLow(pSeed);
      emit_record(fp, 0x6FD86730, "SEED_GetLowSeed", cids[c], argsLow, 1, r, 0xFFFFFFFFu);
    }
  }

  /* 5. 0x6FD867F0: DRLGGRID_InitializeGridWindow */
  {
    const int32_t cfg[4][5] = {
      { 2, 3, 4, 3, 10 },
      { 0, 0, 5, 2, 5 },
      { 1, 1, 4, 0, 8 },
      { 3, 2, 2, 4, 16 },
    };
    const char *cids[4] = { "win_2_3_4x3_s10", "win_origin_5x2", "zero_height", "win_3_2_2x4_s16" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pGrid = PTR(0x100), pBox = PTR(0x140), pRows = PTR(0x180), pBase = PTR(0x1000);
      for (int k = 0; k < 4; k++) w32(pBox + k * 4, (uint32_t)cfg[c][k]);
      track_block(pGrid, 0xC0);
      uint32_t args[5] = { pGrid, pBox, (uint32_t)cfg[c][4], pBase, pRows };
      call_6FD867F0(args[0], args[1], args[2], args[3], args[4]);
      emit_record(fp, 0x6FD867F0, "DRLGGRID_InitializeGridWindow", cids[c], args, 5, 0, 0);
    }
  }

  /* 6. 0x6FD86900: DRLGGRID_InitializeGridCells */
  {
    const int32_t dims[4][2] = { { 4, 3 }, { 1, 1 }, { 5, 0 }, { 3, 4 } };
    const char *cids[4] = { "grid_4x3", "grid_1x1", "grid_5x0", "grid_3x4" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pGrid = PTR(0x100), pRows = PTR(0x140), pCells = PTR(0x200);
      w32(pGrid + 0x10, 99u);
      memset(MEM(0x200), 0xAA, 0x80);
      track_block(pGrid, 0x180);
      uint32_t args[5] = { pGrid, pCells, (uint32_t)dims[c][0], (uint32_t)dims[c][1], pRows };
      call_6FD86900(args[0], args[1], args[2], args[3], args[4]);
      emit_record(fp, 0x6FD86900, "DRLGGRID_InitializeGridCells", cids[c], args, 5, 0, 0);
    }
  }

  /* 7. 0x6FD86A60: DRLGGRID_ApplyBorderCellFlags */
  {
    const int32_t cfg[4][4] = {
      { 4, 4, 0x10, 0 },
      { 4, 4, 0x0F, 2 },
      { 3, 3, 0x07, 3 },
      { 4, 1, 0x03, 2 },
    };
    const char *cids[4] = { "border_4x4_or", "border_4x4_xor_double_corner", "border_3x3_overwrite", "border_4x1_xor" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      init_grid(0x100, 0x200, 0x180, cfg[c][0], cfg[c][1]);
      track_block(PTR(0x100), 0x180);
      uint32_t args[3] = { PTR(0x100), (uint32_t)cfg[c][2], (uint32_t)cfg[c][3] };
      call_6FD86A60(args[0], args[1], args[2]);
      emit_record(fp, 0x6FD86A60, "DRLGGRID_ApplyBorderCellFlags", cids[c], args, 3, 0, 0);
    }
  }

  /* 8. 0x6FD86B10: DRLGGRID_ApplyAllCellFlags */
  {
    const uint32_t ops[6] = { 3, 0, 4, 5, 1, 2 };
    const uint32_t vals[6] = { 0x42u, 0x100u, 9u, 0x03u, 0x03u, 0x05u };
    const char *cids[6] = {
      "all_overwrite", "all_or", "all_overwrite_if_zero",
      "all_and_negated", "all_and", "all_xor"
    };
    for (int c = 0; c < 6; c++) {
      reset_arena();
      init_grid(0x100, 0x200, 0x180, 3, 2);
      const uint32_t init[6] = { 0u, 5u, 0u, 3u, 0xFFu, 2u };
      for (int i = 0; i < 6; i++) w32(PTR(0x200 + i * 4), init[i]);
      track_block(PTR(0x100), 0x140);
      uint32_t args[3] = { PTR(0x100), vals[c], ops[c] };
      call_6FD86B10(args[0], args[1], args[2]);
      emit_record(fp, 0x6FD86B10, "DRLGGRID_ApplyAllCellFlags", cids[c], args, 3, 0, 0);
    }
  }

  /* 9..14. 0x6FD86BD0..0x6FD86C20: 6 cell op functions */
  {
    const uint32_t vas[6] = { 0x6FD86BD0u, 0x6FD86BE0u, 0x6FD86BF0u, 0x6FD86C00u, 0x6FD86C10u, 0x6FD86C20u };
    const char *names[6] = {
      "DRLGGRID_OpAndNegated", "DRLGGRID_OpOverwriteIfZero", "DRLGGRID_OpXor",
      "DRLGGRID_OpAnd", "DRLGGRID_OpOr", "DRLGGRID_OpOverwrite"
    };
    const uint32_t masks[6] = { 0xFFFFFFFFu, 0xFFFFFFFFu, 0u, 0u, 0u, 0u };
    const uint32_t inits[4] = { 0u, 0xFF00FF0Fu, 0x12345678u, 0xFFFFFFFFu };
    const uint32_t vals[4]  = { 0x42u, 0x0F0F0F0Fu, 0u, 0x12345678u };
    const char *cids[4] = { "cell_zero", "cell_mask", "val_zero", "cell_all_ones" };
    for (int f = 0; f < 6; f++) {
      Fast2 fn = (Fast2)RVA(vas[f]);
      for (int c = 0; c < 4; c++) {
        reset_arena();
        uint32_t pCell = PTR(0x100);
        w32(pCell, inits[c]);
        track_block(pCell, 8);
        uint32_t args[2] = { pCell, vals[c] };
        uint32_t r = fn(args[0], args[1]);
        emit_record(fp, vas[f], names[f], cids[c], args, 2, r, masks[f]);
      }
    }
  }
}

static void emit_b013_part2(FILE *fp) {
  /* 15. 0x6FD86CD0: DRLGGRID_RasterizeThickLine */
  {
    const int32_t cfg[8][10] = {
      /* x1, y1, x2, y2, cx, cy, cw, ch, op, thick */
      { 2, 2, 2, 2, 0, 0, 6, 6, 0, 1 },
      { 1, 1, 4, 2, 0, 0, 6, 6, 0, 2 },
      { 1, 1, 2, 4, 0, 0, 6, 6, 3, 2 },
      { 0, 0, 5, 5, 2, 2, 3, 3, 0, 2 },
      { 4, 3, 1, 1, 0, 0, 6, 6, 0, 2 },
      { 3, 4, 1, 1, 0, 0, 6, 6, 0, 2 },
      { 1, 1, 3, 4, 0, 0, 6, 6, 0, 2 },
      { 1, 1, 4, 2, 0, 0, 6, 6, 0, 0 },
    };
    const char *cids[8] = {
      "degen_point",
      "xmajor_thick2",
      "ymajor_thick2",
      "clipped_origin_2_2",
      "xmajor_neg_dx_dy_ystep",
      "ymajor_neg_dx_dy_xstep",
      "ymajor_pos_xstep",
      "zero_thickness_noop"
    };
    for (int c = 0; c < 8; c++) {
      reset_arena();
      uint32_t s1 = PTR(0x100), s2 = PTR(0x120), clip = PTR(0x140);
      w32(s1 + 0, (uint32_t)cfg[c][0]); w32(s1 + 4, (uint32_t)cfg[c][1]); w32(s1 + 0x10, s2);
      w32(s2 + 0, (uint32_t)cfg[c][2]); w32(s2 + 4, (uint32_t)cfg[c][3]);
      for (int k = 0; k < 4; k++) w32(clip + k * 4, (uint32_t)cfg[c][4 + k]);
      init_grid(0x200, 0x300, 0x280, cfg[c][6], cfg[c][7]);
      track_block(PTR(0x100), 0x300);
      uint32_t args[6] = {
        s1, clip, PTR(0x200), 0x10u + (uint32_t)c,
        (uint32_t)cfg[c][8], (uint32_t)cfg[c][9]
      };
      call_6FD86CD0(args[0], args[1], args[2], args[3], args[4], args[5]);
      emit_record(fp, 0x6FD86CD0, "DRLGGRID_RasterizeThickLine", cids[c], args, 6, 0, 0);
    }
  }

  /* 16. 0x6FDD34D0: DRLGTILESUB_TestStampRoomTemplate */
  {
    Std5 fn = (Std5)RVA(0x6FDD34D0);
    const char *cids[4] = { "zero_height", "active_floor_ok", "active_floor_bad_mask", "active_type_extra_fail" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t ctx = PTR(0x100), box = PTR(0x160), lvlSub = PTR(0x200);
      w32(box + 0x00, 0); w32(box + 0x04, 0); w32(box + 0x08, 2);
      w32(box + 0x0C, (c == 0) ? 0u : 2u);
      init_grid(0x2F4, 0x400, 0x380, 2, 2); /* lvlSub + 0xF4 */
      init_grid(0x2A4, 0x500, 0x480, 2, 2); /* lvlSub + 0xA4 */
      init_grid(0x600, 0x700, 0x680, 4, 4); /* ctxFloorGrid */
      init_grid(0x800, 0x900, 0x880, 4, 4); /* extraGrid0 */
      w32(ctx + 0x24, PTR(0x600));
      w32(ctx + 0x14, PTR(0x800));
      w32(ctx + 0x2C, 1);
      if (c == 1) {
        w32(PTR(0x400 + 0), 0x02u);
        w32(PTR(0x700 + (1 * 4 + 1) * 4), 0x02u);
      } else if (c == 2) {
        w32(PTR(0x400 + 0), 0x02u);
        w32(PTR(0x700 + (1 * 4 + 1) * 4), 0x00000102u);
      } else if (c == 3) {
        w32(lvlSub + 0xAC, 2);
        w32(PTR(0x500 + 0), 0x01u);
        w32(PTR(0x700 + (1 * 4 + 1) * 4), 0x02u);
        w32(PTR(0x900 + (1 * 4 + 1) * 4), 0x01u);
      }
      track_block(PTR(0x100), 0x900);
      uint32_t args[5] = { 1, 1, ctx, box, lvlSub };
      uint32_t r = fn(args[0], args[1], args[2], args[3], args[4]);
      emit_record(fp, 0x6FDD34D0, "DRLGTILESUB_TestStampRoomTemplate", cids[c], args, 5, r, 0xFFFFFFFFu);
    }
  }

  /* 17. 0x6FDD37F0: DRLGTILESUB_MatchRoomTemplate */
  {
    const char *cids[4] = { "wall_match_only", "wall_mismatch", "floor_bit1_match", "type_bit0_mismatch" };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t ctx = PTR(0x100), box = PTR(0x160), lvlSub = PTR(0x200), ds1 = PTR(0x1C0);
      w32(box + 0x00, 0); w32(box + 0x04, 0); w32(box + 0x08, 2); w32(box + 0x0C, 2);
      w32(lvlSub + 0x50, ds1);
      init_grid(0x254, 0x400, 0x380, 2, 2); /* lvlSub pWallGrid0 */
      init_grid(0x2A4, 0x500, 0x480, 2, 2); /* lvlSub pTileTypeGrid0 */
      init_grid(0x2F4, 0x600, 0x580, 2, 2); /* lvlSub pFloorGrid */
      init_grid(0x700, 0x800, 0x780, 4, 4); /* ctx pWallGrid */
      init_grid(0x900, 0xA00, 0x980, 4, 4); /* ctx pTileTypeGrid */
      init_grid(0xB00, 0xC00, 0xB80, 4, 4); /* ctx pFloorGrid */
      w32(ctx + 0x04, PTR(0x700));
      w32(ctx + 0x14, PTR(0x900));
      w32(ctx + 0x24, PTR(0xB00));
      w32(PTR(0x400 + 0), 0x11u);
      w32(PTR(0x800 + (1 * 4 + 1) * 4), (c == 1) ? 0x22u : 0x11u);
      if (c == 2) {
        w32(ds1 + 0x18, 1);
        w32(PTR(0x600 + 0), 0x01200202u);
        w32(PTR(0xC00 + (1 * 4 + 1) * 4), 0x01200282u);
      } else if (c == 3) {
        w32(ds1 + 0x14, 1);
        w32(PTR(0x500 + 0), 0x00000101u);
        w32(PTR(0xA00 + (1 * 4 + 1) * 4), 0x00000201u);
      }
      track_block(PTR(0x100), 0xC00);
      uint32_t args[5] = { 1, lvlSub, 1, ctx, box };
      uint32_t r = call_6FDD37F0(args[0], args[1], args[2], args[3], args[4]);
      emit_record(fp, 0x6FDD37F0, "DRLGTILESUB_MatchRoomTemplate", cids[c], args, 5, r, 0xFFFFFFFFu);
    }
  }

  /* 18. 0x6FDD3990: DRLGTILESUB_ApplyRoomTemplateCallbacks */
  {
    uint32_t *pSgpt = (uint32_t *)RVA(0x6FDE9E1C);
    uint32_t *pPrest = (uint32_t *)RVA(0x6FDF0B3C);
    uint32_t savedSgpt = *pSgpt, savedPrest = *pPrest;
    const char *cids[5] = {
      "spawn_outdoor_preset5_and_floor",
      "spawn_act5_tundra_preset959_gridsize2",
      "type_ignore_idx_skip_spawn",
      "act5_map_minus5_skip_spawn",
      "offset_nonzero_and_prest_364_zero_grid2c"
    };
    for (int c = 0; c < 5; c++) {
      reset_arena();
      uint32_t pLevel = PTR(0x100), pOut = PTR(0x300), ctx = PTR(0x380), box = PTR(0x3E0);
      uint32_t lvlSub = PTR(0x400), ds1 = PTR(0x3C0);
      uint32_t dt = PTR(0x1000), prestArr = PTR(0x2000);
      w32(dt + 0xC68, 1000);
      *pSgpt = dt;
      *pPrest = prestArr;
      w32(pLevel + 0x14, pOut);
      w32(pLevel + 0x1D0, (c == 1) ? 0x75u : 0x73u); /* 0x75 = Tundra (117) */
      init_grid(0x304, 0x600, 0x540, 6, 6); /* pOut + 0x04 */
      init_grid(0x32C, 0x700, 0x580, 6, 6); /* pOut + 0x2C */
      for (int i = 0; i < 36; i++) {
        w32(PTR(0x600 + i * 4), 99u);
        w32(PTR(0x700 + i * 4), (c == 4) ? 0u : 0xF0777u);
      }
      w32(ctx + 0x00, pLevel);
      w32(ctx + 0x14, (uint32_t)-1);
      w32(ctx + 0x2C, (uint32_t)RVA(0x6FD922F0)); /* pfOnBit2 */
      w32(ctx + 0x30, (uint32_t)RVA(0x6FD922A0)); /* pfOnClear */
      w32(ctx + 0x34, (uint32_t)RVA(0x6FD92A70)); /* pfSpawnPreset */
      w32(box + 0x00, 0); w32(box + 0x04, 0); w32(box + 0x08, 2); w32(box + 0x0C, 2);
      w32(lvlSub + 0x4C, (c == 1) ? 2u : 1u);
      w32(lvlSub + 0x50, ds1);
      init_grid(0x4A4, 0x800, 0x7A0, 4, 4); /* lvlSub + 0xA4 (valType) */
      init_grid(0x4F4, 0x900, 0x7C0, 4, 4); /* lvlSub + 0xF4 (valFloor) */
      w32(ds1 + 0x14, 1);
      w32(ds1 + 0x18, 1);
      w32(PTR(0x900 + 4), 0x02u); /* (dx=1, dy=0) has bit 1 -> pfOnBit2 (0x6FD922F0) */
      uint32_t activePrestId = 5;
      uint32_t nOffsetArg = 0;
      if (c == 0) {
        /* Outdoor base preset: nBasePresetId = 4, byte1 = 2 (idx = 1) -> mappedId = 5 (border range 4..15) */
        w32(ctx + 0x10, 4);
        w32(PTR(0x800 + 0), 0x00000201u);
        activePrestId = 5;
        w32(prestArr + activePrestId * 0x1B0 + 0x28, 16); /* sizeX = 2 */
        w32(prestArr + activePrestId * 0x1B0 + 0x2C, 8);  /* sizeY = 1 */
      } else if (c == 1) {
        /* Act 5 pfMapPresetId (0x6FD90C20): style = 48 (0x30), seq = 1, Tundra -> mappedId = 959 */
        w32(ctx + 0x28, (uint32_t)RVA(0x6FD90C20));
        w32(PTR(0x800 + 0), (48u << 20) | (1u << 8) | 1u);
        activePrestId = 959;
        w32(prestArr + activePrestId * 0x1B0 + 0x28, 8);  /* sizeX = 1 */
        w32(prestArr + activePrestId * 0x1B0 + 0x2C, 16); /* sizeY = 2 */
      } else if (c == 2) {
        /* ignoreIdx == 2 skips pfSpawnPreset */
        w32(ctx + 0x10, 100);
        w32(ctx + 0x14, 2);
        w32(PTR(0x800 + 0), 0x00000301u); /* byte1 = 3 -> idx = 2 */
      } else if (c == 3) {
        /* Act 5 pfMapPresetId (0x6FD90C20): style = 48 (0x30), seq = 31 -> mappedId = -5 skips pfSpawnPreset */
        w32(ctx + 0x28, (uint32_t)RVA(0x6FD90C20));
        w32(PTR(0x800 + 0), (48u << 20) | (31u << 8) | 1u);
      } else if (c == 4) {
        /* Non-zero nOffset = 1 and preset 364 border marker on initially-zero grid2C */
        nOffsetArg = 1;
        w32(ctx + 0x10, 364);
        w32(PTR(0x800 + 0), 0x00000101u); /* byte1 = 1 -> idx = 0 -> mappedId = 364 */
        activePrestId = 364;
        w32(prestArr + activePrestId * 0x1B0 + 0x28, 16); /* sizeX = 2 */
        w32(prestArr + activePrestId * 0x1B0 + 0x2C, 8);  /* sizeY = 1 */
      }
      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block((uint32_t)RVA(0x6FDF0B3C), 4);
      track_block(dt + 0xC60, 0x10);
      track_block(prestArr + activePrestId * 0x1B0, 0x40);
      track_block(PTR(0x100), 0x900);
      uint32_t args[6] = { nOffsetArg, (c == 1) ? 3u : 1u, (c == 1) ? 3u : 1u, box, ctx, lvlSub };
      call_6FDD3990(args[0], args[1], args[2], args[3], args[4], args[5]);
      emit_record(fp, 0x6FDD3990, "DRLGTILESUB_ApplyRoomTemplateCallbacks", cids[c], args, 6, 0, 0);
    }
    *pSgpt = savedSgpt;
    *pPrest = savedPrest;
  }

  /* 19. 0x6FDD3B30: DRLGTILESUB_CheckRoomTemplateCallbacks */
  {
    uint32_t *pSgpt = (uint32_t *)RVA(0x6FDE9E1C);
    uint32_t *pPrest = (uint32_t *)RVA(0x6FDF0B3C);
    uint32_t savedSgpt = *pSgpt, savedPrest = *pPrest;
    const char *cids[8] = {
      "act5_pfCustomCheck_pass",
      "act5_pfCustomCheck_bit10_blocked",
      "type_preset_mismatch",
      "type_pfTestFree1_pass",
      "floor_pfTestFree4_blocked",
      "type_ignore_idx_skip_pass",
      "type_pfTestFree1_blocked",
      "floor_pfTestFree4_pass"
    };
    for (int c = 0; c < 8; c++) {
      reset_arena();
      uint32_t pLevel = PTR(0x100), pOut = PTR(0x300), ctx = PTR(0x380), box = PTR(0x3E0);
      uint32_t lvlSub = PTR(0x400), ds1 = PTR(0x3C0);
      uint32_t dt = PTR(0x1000), prestArr = PTR(0x2000);
      w32(dt + 0xC68, 20);
      w32(prestArr + 5 * 0x1B0 + 0x28, 16);
      w32(prestArr + 5 * 0x1B0 + 0x2C, 8);
      *pSgpt = dt;
      *pPrest = prestArr;
      w32(pLevel + 0x14, pOut);
      w32(pLevel + 0x1D0, 0x73u); /* non-Tundra */
      w32(pOut + 0x34, 4); w32(pOut + 0x38, 4);
      init_grid(0x32C, 0x600, 0x580, 4, 4); /* pOut + 0x2C */
      init_grid(0x700, 0x780, 0x740, 4, 4); /* ctx pPresetGrid */
      w32(ctx + 0x00, pLevel);
      w32(ctx + 0x08, PTR(0x700));
      w32(ctx + 0x10, 100);
      w32(ctx + 0x14, (uint32_t)-1);
      w32(ctx + 0x1C, (uint32_t)RVA(0x6FD92270)); /* pfTestFree1 */
      w32(ctx + 0x20, (uint32_t)RVA(0x6FD92370)); /* pfTestFree4 */
      w32(box + 0x00, 0); w32(box + 0x04, 0); w32(box + 0x08, 2); w32(box + 0x0C, 2);
      w32(lvlSub + 0x4C, 1); w32(lvlSub + 0x50, ds1);
      init_grid(0x4A4, 0x800, 0x7C0, 2, 2);
      init_grid(0x4F4, 0x900, 0x8C0, 2, 2);
      if (c == 0 || c == 1) {
        /* Exercise genuine pfCustomCheck = 0x6FD90DB0 */
        w32(ctx + 0x24, (uint32_t)RVA(0x6FD90DB0));
        w32(ds1 + 0x14, 1);
        /* (dx=0, dy=0) -> style=49, seq=2 -> mappedId=916; other 3 cells -> style=48, seq=31 -> mappedId=-5 */
        w32(PTR(0x800 + 0), (49u << 20) | (2u << 8) | 1u);
        w32(PTR(0x800 + 4), (48u << 20) | (31u << 8));
        w32(PTR(0x800 + 8), (48u << 20) | (31u << 8));
        w32(PTR(0x800 + 12), (48u << 20) | (31u << 8));
        w32(PTR(0x780 + (1 * 4 + 1) * 4), 916u); /* curPresetVal at (worldX=1, worldY=1) */
        if (c == 1) {
          w32(PTR(0x600 + (1 * 4 + 1) * 4), 0x0400u); /* bit 10 set -> blocked in 0x6FD90DB0 */
        }
      } else if (c == 2 || c == 3) {
        w32(ds1 + 0x14, 1);
        w32(PTR(0x800 + 0), 0x00000301u); /* idx = 2 -> expected 102 */
        w32(PTR(0x780 + (1 * 4 + 1) * 4), (c == 2) ? 999u : 102u);
      } else if (c == 4) {
        w32(ds1 + 0x18, 1);
        w32(PTR(0x900 + 0), 0x02u);
        w32(PTR(0x780 + (1 * 4 + 1) * 4), 5u);
        w32(PTR(0x600 + (1 * 4 + 1) * 4), 0x0080u); /* blocked in 0x6FD92370 */
      } else if (c == 5) {
        /* ignoreIdx == 2 skips preset mismatch */
        w32(ds1 + 0x14, 1);
        w32(ctx + 0x14, 2);
        w32(PTR(0x800 + 0), 0x00000301u); /* byte1 = 3 -> idx = 2 */
        w32(PTR(0x780 + (1 * 4 + 1) * 4), 999u);
      } else if (c == 6) {
        /* curPresetVal == 0 triggers pfTestFree1 (0x6FD92270), which returns 0 on blocked cell */
        w32(ds1 + 0x14, 1);
        w32(PTR(0x800 + 0), 0x00000301u);
        w32(PTR(0x780 + (1 * 4 + 1) * 4), 0u);
        w32(PTR(0x600 + (1 * 4 + 1) * 4), 0x0080u);
      } else if (c == 7) {
        /* floor bit 1 triggers pfTestFree4 (0x6FD92370), which passes when region is free */
        w32(ds1 + 0x18, 1);
        w32(PTR(0x900 + 0), 0x02u);
        w32(PTR(0x780 + (1 * 4 + 1) * 4), 5u);
      }
      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block((uint32_t)RVA(0x6FDF0B3C), 4);
      track_block(dt + 0xC60, 0x10);
      track_block(prestArr + 5 * 0x1B0, 0x40);
      track_block(PTR(0x100), 0x900);
      uint32_t args[5] = { ctx, 1, 1, box, lvlSub };
      uint32_t r = call_6FDD3B30(args[0], args[1], args[2], args[3], args[4]);
      emit_record(fp, 0x6FDD3B30, "DRLGTILESUB_CheckRoomTemplateCallbacks", cids[c], args, 5, r, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
    *pPrest = savedPrest;
  }

  /* 20. 0x6FD90C20: DRLGOUTROOM_MapAct5PresetId */
  {
    Fast3 fn = (Fast3)RVA(0x6FD90C20);
    const uint32_t lvls[5]   = { 0x73u, 0x75u, 0x73u, 0x73u, 0x75u };
    const uint32_t styles[5] = { 48u,   48u,   48u,   49u,   49u   };
    const uint32_t seqs[5]   = { 1u,    1u,    31u,   2u,    15u   };
    const char *cids[5] = {
      "style48_seq1_non_tundra",
      "style48_seq1_tundra",
      "style48_seq31_minus5",
      "style49_seq2_non_tundra",
      "style49_seq15_tundra"
    };
    for (int c = 0; c < 5; c++) {
      reset_arena();
      uint32_t pLevel = PTR(0x100);
      w32(pLevel + 0x1D0, lvls[c]);
      track_block(pLevel, 0x200);
      uint32_t args[3] = { pLevel, styles[c], seqs[c] };
      uint32_t r = fn(args[0], args[1], args[2]);
      emit_record(fp, 0x6FD90C20, "DRLGOUTROOM_MapAct5PresetId", cids[c], args, 3, r, 0xFFFFFFFFu);
    }
  }

  /* 21. 0x6FD90DB0: DRLGOUTROOM_CheckAct5Preset */
  {
    Fast6 fn = (Fast6)RVA(0x6FD90DB0);
    const char *cids[4] = {
      "seq31_minus5_pass",
      "preset_mismatch_fail",
      "preset_match_bit10_free_pass",
      "preset_match_bit10_blocked_fail"
    };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pLevel = PTR(0x100), pOut = PTR(0x300);
      w32(pLevel + 0x14, pOut);
      w32(pLevel + 0x1D0, 0x73u);
      init_grid(0x32C, 0x600, 0x580, 4, 4); /* pOut + 0x2C */
      uint32_t curPresetVal = 916u;
      uint32_t cellVal = (49u << 20) | (2u << 8) | 1u; /* maps to 916 */
      if (c == 0) {
        curPresetVal = 999u;
        cellVal = (48u << 20) | (31u << 8); /* maps to -5 -> returns 1 immediately */
      } else if (c == 1) {
        curPresetVal = 999u; /* mismatch against 916 -> returns 0 */
      } else if (c == 3) {
        w32(PTR(0x600 + (1 * 4 + 1) * 4), 0x0400u); /* bit 10 set -> blocked */
      }
      track_block(PTR(0x100), 0x600);
      uint32_t args[6] = { pLevel, 1, 1, curPresetVal, 0, cellVal };
      uint32_t r = fn(args[0], args[1], args[2], args[3], args[4], args[5]);
      emit_record(fp, 0x6FD90DB0, "DRLGOUTROOM_CheckAct5Preset", cids[c], args, 6, r, 0xFFFFFFFFu);
    }
  }

  /* 22. 0x6FD92920: DRLGOUTDOORS_PickPresetFileIndex */
  {
    uint32_t *pSgpt = (uint32_t *)RVA(0x6FDE9E1C);
    uint32_t *pPrest = (uint32_t *)RVA(0x6FDF0B3C);
    uint32_t savedSgpt = *pSgpt, savedPrest = *pPrest;
    const char *cids[5] = {
      "existing_node_hit_first",
      "existing_node_hit_second",
      "alloc_pow2_4files",
      "alloc_non_pow2_3files",
      "alloc_neg_files_le0"
    };
    for (int c = 0; c < 5; c++) {
      reset_arena();
      uint32_t pLevel = PTR(0x100), pOut = PTR(0x300), pDrlg = PTR(0x500);
      uint32_t dt = PTR(0x1000), prestArr = PTR(0x2000);
      w32(dt + 0xC68, 20);
      *pSgpt = dt;
      *pPrest = prestArr;
      w32(pLevel + 0x14, pOut);
      w32(pLevel + 0x1B4, pDrlg);
      w32(pLevel + 0x1C4, 0x12345678u);
      w32(pLevel + 0x1C8, 0x9ABCDEF0u);
      w32(pDrlg + 0x478, 0);
      w32(prestArr + 5 * 0x1B0 + 0x00, 5u);
      if (c == 0) {
        uint32_t node0 = PTR(0x400);
        w32(node0 + 0x00, 5u);
        w32(node0 + 0x04, 4u);
        w32(node0 + 0x08, 1u);
        w32(node0 + 0x0C, 0u);
        w32(pLevel + 0x1CC, node0);
      } else if (c == 1) {
        uint32_t node0 = PTR(0x400), node1 = PTR(0x420);
        w32(node0 + 0x00, 3u);
        w32(node0 + 0x04, 2u);
        w32(node0 + 0x08, 0u);
        w32(node0 + 0x0C, node1);
        w32(node1 + 0x00, 5u);
        w32(node1 + 0x04, 4u);
        w32(node1 + 0x08, 2u);
        w32(node1 + 0x0C, 0u);
        w32(pLevel + 0x1CC, node0);
      } else if (c == 2) {
        w32(prestArr + 5 * 0x1B0 + 0x40, 4u); /* power of 2 */
      } else if (c == 3) {
        w32(prestArr + 5 * 0x1B0 + 0x40, 3u); /* non-power of 2 */
      } else if (c == 4) {
        w32(prestArr + 5 * 0x1B0 + 0x40, (uint32_t)-2); /* <= 0, non-zero for idiv */
      }
      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block((uint32_t)RVA(0x6FDF0B3C), 4);
      track_block(dt + 0xC60, 0x10);
      track_block(prestArr + 5 * 0x1B0, 0x50);
      track_block(PTR(0x100), 0x380);
      track_block(pDrlg + 0x478, 4);
      if (c >= 2) {
        track_block(HEAP_ADDR, 0x10);
      }
      uint32_t args[2] = { 5u, pLevel };
      uint32_t r = call_6FD92920(args[0], args[1]);
      emit_record(fp, 0x6FD92920, "DRLGOUTDOORS_PickPresetFileIndex", cids[c], args, 2, r, 0xFFFFFFFFu);
    }
    *pSgpt = savedSgpt;
    *pPrest = savedPrest;
  }

  /* 23. 0x6FD92A70: DRLGOUTDOORS_SpawnPresetInGrid */
  {
    Fast6 fn = (Fast6)RVA(0x6FD92A70);
    uint32_t *pSgpt = (uint32_t *)RVA(0x6FDE9E1C);
    uint32_t *pPrest = (uint32_t *)RVA(0x6FDF0B3C);
    uint32_t savedSgpt = *pSgpt, savedPrest = *pPrest;
    const char *cids[4] = {
      "picked_explicit_border_id5",
      "picked_explicit_border_id364",
      "picked_explicit_non_border_id50",
      "picked_minus1_calls_6FD92920"
    };
    for (int c = 0; c < 4; c++) {
      reset_arena();
      uint32_t pLevel = PTR(0x100), pOut = PTR(0x300), pDrlg = PTR(0x800);
      uint32_t dt = PTR(0x1000), prestArr = PTR(0x2000);
      w32(dt + 0xC68, 400);
      *pSgpt = dt;
      *pPrest = prestArr;
      w32(pLevel + 0x14, pOut);
      w32(pLevel + 0x1B4, pDrlg);
      init_grid(0x304, 0x600, 0x540, 4, 4); /* pOut + 0x04 */
      init_grid(0x32C, 0x700, 0x580, 4, 4); /* pOut + 0x2C */
      for (int i = 0; i < 16; i++) {
        w32(PTR(0x600 + i * 4), 99u);
        w32(PTR(0x700 + i * 4), 0xF0777u);
      }
      uint32_t prestId = 5u;
      uint32_t pickedFile = 2u;
      uint32_t bBorder = 1u;
      if (c == 0) {
        prestId = 5u;
        pickedFile = 2u;
        bBorder = 1u; /* border id in [4..15] */
        w32(prestArr + prestId * 0x1B0 + 0x28, 16); /* sizeX = 2 */
        w32(prestArr + prestId * 0x1B0 + 0x2C, 8);  /* sizeY = 1 */
      } else if (c == 1) {
        prestId = 364u;
        pickedFile = 3u;
        bBorder = 1u; /* border id in [364..375] */
        w32(prestArr + prestId * 0x1B0 + 0x28, 8);  /* sizeX = 1 */
        w32(prestArr + prestId * 0x1B0 + 0x2C, 16); /* sizeY = 2 */
      } else if (c == 2) {
        prestId = 50u;
        pickedFile = 1u;
        bBorder = 1u; /* non-border id 50 */
        w32(prestArr + prestId * 0x1B0 + 0x28, 16); /* sizeX = 2 */
        w32(prestArr + prestId * 0x1B0 + 0x2C, 16); /* sizeY = 2 */
      } else if (c == 3) {
        prestId = 50u;
        pickedFile = (uint32_t)-1;
        bBorder = 0u;
        uint32_t node0 = PTR(0x400);
        w32(node0 + 0x00, 50u);
        w32(node0 + 0x04, 8u);
        w32(node0 + 0x08, 4u);
        w32(node0 + 0x0C, 0u);
        w32(pLevel + 0x1CC, node0);
        w32(prestArr + prestId * 0x1B0 + 0x28, 8); /* sizeX = 1 */
        w32(prestArr + prestId * 0x1B0 + 0x2C, 8); /* sizeY = 1 */
      }
      track_block((uint32_t)RVA(0x6FDE9E1C), 4);
      track_block((uint32_t)RVA(0x6FDF0B3C), 4);
      track_block(dt + 0xC60, 0x10);
      track_block(prestArr + prestId * 0x1B0, 0x40);
      track_block(PTR(0x100), 0x700);
      track_block(pDrlg + 0x478, 4);
      uint32_t args[6] = { pLevel, 1, 1, prestId, pickedFile, bBorder };
      fn(args[0], args[1], args[2], args[3], args[4], args[5]);
      emit_record(fp, 0x6FD92A70, "DRLGOUTDOORS_SpawnPresetInGrid", cids[c], args, 6, 0, 0);
    }
    *pSgpt = savedSgpt;
    *pPrest = savedPrest;
  }
}

static void emit_b013(FILE *fp) {
  emit_b013_part1(fp);
  emit_b013_part2(fp);
}

int main(int argc, char **argv) {
  const char *out_b010 = (argc > 1) ? argv[1] : "b010-vectors.ndjson";
  const char *out_b013 = (argc > 2) ? argv[2] : "b013-vectors.ndjson";

  HMODULE hMod = LoadLibraryA("D2Common.dll");
  if (!hMod) {
    fprintf(stderr, "LoadLibraryA(D2Common.dll) failed: %lu\n", GetLastError());
    return 1;
  }
  g_base = (uintptr_t)hMod;

  g_arena = (uint8_t *)VirtualAlloc((void *)ARENA_ADDR, ARENA_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if (!g_arena || (uintptr_t)g_arena != ARENA_ADDR) {
    fprintf(stderr, "VirtualAlloc at 0x%08X failed (got %p, err=%lu)\n", ARENA_ADDR, (void *)g_arena, GetLastError());
    return 2;
  }

  g_heap = (uint8_t *)VirtualAlloc((void *)HEAP_ADDR, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if (!g_heap || (uintptr_t)g_heap != HEAP_ADDR) {
    fprintf(stderr, "VirtualAlloc at 0x%08X failed (got %p, err=%lu)\n", HEAP_ADDR, (void *)g_heap, GetLastError());
    return 2;
  }

  /* Hook Fog.#10045 IAT slot at 0x6FDD90D0 so 0x6FD92920 allocations match SparseMemory113c.alloc(size) at 0x40000000 */
  DWORD oldProt = 0;
  VirtualProtect((void *)RVA(0x6FDD90D0), 4, PAGE_READWRITE, &oldProt);
  *(uint32_t *)RVA(0x6FDD90D0) = (uint32_t)(uintptr_t)&stub_fog_10045;

  FILE *fp10 = fopen(out_b010, "wb");
  if (!fp10) {
    fprintf(stderr, "fopen(%s) failed\n", out_b010);
    return 3;
  }
  emit_b010(fp10);
  fclose(fp10);

  FILE *fp13 = fopen(out_b013, "wb");
  if (!fp13) {
    fprintf(stderr, "fopen(%s) failed\n", out_b013);
    return 4;
  }
  emit_b013(fp13);
  fclose(fp13);

  printf("Emitted Lane C It3 vectors: %s and %s (D2Common base=0x%08X)\n", out_b010, out_b013, (unsigned)g_base);
  return 0;
}
