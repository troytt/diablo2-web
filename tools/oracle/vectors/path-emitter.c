/*
 * path-emitter.c — Real-DLL D2TV Vector & Page-Touched World Image Emitter for [K1-6] PATH.
 *
 * Builds the canonical Act 0 Level 1 (Rogue Encampment) world for seed 12345,
 * diff 0 in a deterministic fixed-base VirtualAlloc arena (`0x20000000`) with:
 *   - `pGame` on a `PAGE_NOACCESS` tripwire page
 *   - `kernel32!GetTickCount` IAT-patched to `0x00010000`
 *   - All 35 `RoomEx` rooms activated in list order via `0x6FDCC270`
 *
 * Drives `#11003 PATH_AllocDynamicPath` -> `#10647 PATH_SetType` ->
 * `#10286 PATH_SetTargetPos` -> `#10334 PATH_FindSubpath` across all 18
 * PATHTYPEs (`0..17`), 6 unit configurations (player, monster size 1/2,
 * monster class 0x26 special case, missile), and 64 start/target pairs
 * plus explicit assert vectors (`6,924` vectors total), using `PAGE_NOACCESS`
 * + VEH page-touch tracking to capture the minimal union of 4 KiB pages read
 * or written by the pathfinders.
 *
 * Emits:
 *   - `PATHVEC` (`path-vectors-113c.d2tv.gz`, 460 B x 6,924 records)
 *   - `PAGEIMG` (`path-world-town-s12345.img.gz`, 4,100 B = `u32 va + 4096 B` per page)
 */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "vector-format.h"

#define ARENA_BASE       0x20000000u
#define ARENA_SIZE       0x04000000u /* 64 MiB */
#define ARENA_PAGES      (ARENA_SIZE >> 12)
#define META_PAGE_VA     0x1FFFF000u
#define META_PAGE_MAGIC  0x57485450u /* 'PTHW' */
#define D2COM_PREF_BASE  0x6FD50000u

/* ------------------------------- Arena & Page-Touch Tracking */

static uint8_t *g_arena = NULL;
static uint32_t g_cursor = 0;
static uint8_t  g_touched_arena[ARENA_PAGES];
static uint8_t  g_touched_d2com[256];
static uintptr_t g_d2com_base = 0;
static uint32_t  g_d2com_size = 0;
static volatile LONG g_page_trace_active = 0;

static void *arena_alloc(uint32_t sz) {
  uint32_t realSz = sz ? sz : 4u;
  uint32_t aligned = (g_cursor + 16u + 15u) & ~15u;
  if (aligned + realSz + 16u > ARENA_SIZE) {
    fprintf(stderr, "[path-emitter] Arena exhausted (cursor=%u, req=%u)\n", g_cursor, realSz);
    fflush(stderr);
    TerminateProcess(GetCurrentProcess(), 5);
  }
  uint8_t *p = g_arena + aligned;
  *(uint32_t *)(p - 12) = g_cursor;
  *(uint32_t *)(p - 8)  = 0xCAFEBABEu;
  *(uint32_t *)(p - 4)  = realSz;
  memset(p, 0, realSz);
  g_cursor = aligned + realSz;
  return p;
}

static void arena_try_pop(void *p) {
  if (!p || g_page_trace_active) return;
  uintptr_t addr = (uintptr_t)p;
  if (addr < ARENA_BASE + 16u || addr >= ARENA_BASE + g_cursor) return;
  uint8_t *bp = (uint8_t *)p;
  if (*(uint32_t *)(bp - 8) != 0xCAFEBABEu) return;
  uint32_t oldSz = *(uint32_t *)(bp - 4);
  uint32_t prevCur = *(uint32_t *)(bp - 12);
  if ((uint32_t)(bp - g_arena) + oldSz == g_cursor && prevCur < g_cursor) {
    g_cursor = prevCur;
  }
}

static void *__fastcall hk_fog_10042(uint32_t sz, const char *f, int l, int z) {
  (void)f; (void)l; (void)z;
  return arena_alloc(sz);
}

static int __fastcall hk_fog_10043(void *p, const char *f, int l, int z) {
  (void)f; (void)l; (void)z;
  arena_try_pop(p);
  return 1;
}

static void *__fastcall hk_fog_10045(void *pool, uint32_t sz, const char *f, int l, int z) {
  (void)pool; (void)f; (void)l; (void)z;
  return arena_alloc(sz);
}

static int __fastcall hk_fog_10046(void *pool, void *p, const char *f, int l, int z) {
  (void)pool; (void)f; (void)l; (void)z;
  arena_try_pop(p);
  return 1;
}

static void *__fastcall hk_fog_10047(void *pool, void *p, uint32_t sz, const char *f, int l, int z) {
  (void)pool; (void)f; (void)l; (void)z;
  if (!p) return arena_alloc(sz);
  if (sz == 0) {
    arena_try_pop(p);
    return NULL;
  }
  uintptr_t addr = (uintptr_t)p;
  if (addr >= ARENA_BASE + 16u && addr < ARENA_BASE + g_cursor &&
      *(uint32_t *)((uint8_t *)p - 8) == 0xCAFEBABEu) {
    uint8_t *bp = (uint8_t *)p;
    uint32_t oldSz = *(uint32_t *)(bp - 4);
    uint32_t off = (uint32_t)(bp - g_arena);
    if (off + oldSz == g_cursor && off + sz + 16u <= ARENA_SIZE) {
      if (sz > oldSz) {
        memset(bp + oldSz, 0, sz - oldSz);
      }
      *(uint32_t *)(bp - 4) = sz;
      g_cursor = off + sz;
      return p;
    }
    void *np = arena_alloc(sz);
    memcpy(np, p, oldSz < sz ? oldSz : sz);
    return np;
  }
  return arena_alloc(sz);
}

static DWORD WINAPI stub_GetTickCount(void) {
  return 0x00010000u;
}

/* ------------------------------- Thunk, VEH & Assert Unwind */

volatile uint32_t g_thunk_target = 0;
volatile uint32_t g_thunk_nargs = 0;
volatile uint32_t g_thunk_args[8];
volatile uint32_t g_thunk_out_eax = 0;
volatile uint32_t g_thunk_saved_esp = 0;
volatile uint32_t g_thunk_saved_ebp = 0;

volatile LONG g_thunk_in_call = 0;
volatile LONG g_thunk_faulted = 0; /* 0 = ok, 1 = hardware exception, 2 = fogAssert */
volatile uint32_t g_fault_code = 0;
volatile uint32_t g_fault_eip_va = 0;
volatile uint32_t g_fault_line = 0;
volatile uint32_t g_assert_eip = 0;
volatile uint32_t g_assert_line = 0;

void path_thunk_resume(void);

__attribute__((naked, noinline)) static void path_thunk_invoke(void) {
  __asm__ volatile(
      "pushl %ebp\n\t"
      "pushl %ebx\n\t"
      "pushl %esi\n\t"
      "pushl %edi\n\t"
      "movl %esp, _g_thunk_saved_esp\n\t"
      "movl %ebp, _g_thunk_saved_ebp\n\t"
      "movl _g_thunk_nargs, %ecx\n\t"
      "1:\n\t"
      "testl %ecx, %ecx\n\t"
      "jz 2f\n\t"
      "decl %ecx\n\t"
      "pushl _g_thunk_args(,%ecx,4)\n\t"
      "jmp 1b\n\t"
      "2:\n\t"
      "call *_g_thunk_target\n\t"
      "movl %eax, _g_thunk_out_eax\n\t"
      ".globl _path_thunk_resume\n"
      "_path_thunk_resume:\n\t"
      "movl _g_thunk_saved_ebp, %ebp\n\t"
      "movl _g_thunk_saved_esp, %esp\n\t"
      "popl %edi\n\t"
      "popl %esi\n\t"
      "popl %ebx\n\t"
      "popl %ebp\n\t"
      "ret\n\t");
}

static uint32_t ptr_to_canon_va(uintptr_t p) {
  if (p >= g_d2com_base && p < g_d2com_base + g_d2com_size) {
    return (uint32_t)(D2COM_PREF_BASE + (p - g_d2com_base));
  }
  return (uint32_t)p;
}

void record_path_fog_assert(void) {
  g_thunk_in_call = 0;
  g_thunk_faulted = 2;
  g_fault_code = 0xE0000024u;
  g_fault_eip_va = ptr_to_canon_va((uintptr_t)g_assert_eip);
  g_fault_line = g_assert_line;
}

__attribute__((naked, noinline)) static void stub_fog_10024(void) {
  __asm__ volatile(
      "movl 0(%esp), %eax\n\t"
      "movl %eax, _g_assert_eip\n\t"
      "movl 12(%esp), %eax\n\t"
      "movl %eax, _g_assert_line\n\t"
      "call _record_path_fog_assert\n\t"
      "jmp _path_thunk_resume\n\t");
}

static LONG CALLBACK path_veh(EXCEPTION_POINTERS *ep) {
  DWORD code = ep->ExceptionRecord->ExceptionCode;
  if (code == EXCEPTION_ACCESS_VIOLATION &&
      ep->ExceptionRecord->NumberParameters >= 2 &&
      g_page_trace_active) {
    uintptr_t av = (uintptr_t)ep->ExceptionRecord->ExceptionInformation[1];
    uintptr_t page = av & ~0xFFFu;
    if (page >= ARENA_BASE && page < ARENA_BASE + ARENA_SIZE) {
      DWORD old = 0;
      VirtualProtect((void *)page, 4096, PAGE_READWRITE, &old);
      g_touched_arena[(page - ARENA_BASE) >> 12] = 1;
      return EXCEPTION_CONTINUE_EXECUTION;
    }
    if (page >= g_d2com_base && page < g_d2com_base + g_d2com_size) {
      DWORD old = 0;
      VirtualProtect((void *)page, 4096, PAGE_EXECUTE_READWRITE, &old);
      g_touched_d2com[(page - g_d2com_base) >> 12] = 1;
      return EXCEPTION_CONTINUE_EXECUTION;
    }
  }
  if (!g_thunk_in_call) return EXCEPTION_CONTINUE_SEARCH;
  if (code == EXCEPTION_ACCESS_VIOLATION ||
      code == EXCEPTION_INT_DIVIDE_BY_ZERO ||
      code == EXCEPTION_INT_OVERFLOW ||
      code == EXCEPTION_ILLEGAL_INSTRUCTION ||
      code == EXCEPTION_PRIV_INSTRUCTION ||
      code == EXCEPTION_STACK_OVERFLOW) {
    g_thunk_in_call = 0;
    g_thunk_faulted = 1;
    g_fault_code = (uint32_t)code;
    g_fault_eip_va = ptr_to_canon_va((uintptr_t)ep->ExceptionRecord->ExceptionAddress);
    g_fault_line = 0;
    ep->ContextRecord->Eip = (DWORD)(uintptr_t)path_thunk_resume;
    ep->ContextRecord->Esp = g_thunk_saved_esp;
    ep->ContextRecord->Ebp = g_thunk_saved_ebp;
    return EXCEPTION_CONTINUE_EXECUTION;
  }
  return EXCEPTION_CONTINUE_SEARCH;
}

static uint32_t call_stdcall_n(void *fn, uint32_t nargs,
                               uint32_t a0, uint32_t a1, uint32_t a2,
                               uint32_t a3, uint32_t a4, uint32_t a5) {
  g_thunk_target = (uint32_t)(uintptr_t)fn;
  g_thunk_nargs = nargs;
  g_thunk_args[0] = a0;
  g_thunk_args[1] = a1;
  g_thunk_args[2] = a2;
  g_thunk_args[3] = a3;
  g_thunk_args[4] = a4;
  g_thunk_args[5] = a5;
  g_thunk_out_eax = 0;
  g_thunk_faulted = 0;
  g_fault_code = 0;
  g_fault_eip_va = 0;
  g_fault_line = 0;
  g_thunk_in_call = 1;
  __asm__ volatile("" ::: "memory");
  path_thunk_invoke();
  __asm__ volatile("" ::: "memory");
  g_thunk_in_call = 0;
  return g_thunk_out_eax;
}

typedef struct {
  DWORD *slot;
  DWORD origVal;
} IatPatch;

static IatPatch g_iat_patches[32];
static int g_num_iat_patches = 0;

static void hook_iat_entry(HMODULE mod, void *origFn, void *newFn) {
  uint8_t *base = (uint8_t *)mod;
  IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)base;
  IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)(base + dos->e_lfanew);
  DWORD impRva = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT].VirtualAddress;
  if (!impRva) return;
  IMAGE_IMPORT_DESCRIPTOR *imp = (IMAGE_IMPORT_DESCRIPTOR *)(base + impRva);
  for (; imp->Name; imp++) {
    IMAGE_THUNK_DATA32 *thunk = (IMAGE_THUNK_DATA32 *)(base + imp->FirstThunk);
    for (; thunk->u1.Function; thunk++) {
      if ((void *)(uintptr_t)thunk->u1.Function == origFn) {
        DWORD oldProt = 0;
        VirtualProtect(&thunk->u1.Function, 4, PAGE_READWRITE, &oldProt);
        if (g_num_iat_patches < 32) {
          g_iat_patches[g_num_iat_patches].slot = &thunk->u1.Function;
          g_iat_patches[g_num_iat_patches].origVal = thunk->u1.Function;
          g_num_iat_patches++;
        }
        thunk->u1.Function = (DWORD)(uintptr_t)newFn;
        VirtualProtect(&thunk->u1.Function, 4, oldProt, &oldProt);
      }
    }
  }
}

static void restore_iat_entries(void) {
  for (int i = 0; i < g_num_iat_patches; i++) {
    DWORD oldProt = 0;
    VirtualProtect(g_iat_patches[i].slot, 4, PAGE_READWRITE, &oldProt);
    *g_iat_patches[i].slot = g_iat_patches[i].origVal;
    VirtualProtect(g_iat_patches[i].slot, 4, oldProt, &oldProt);
  }
}

/* ------------------------------- Record Layouts */

#define PATH_PREFLAG_SET_PREV_TYPE   (1u << 0)
#define PATH_PREFLAG_SET_TARGET_UNIT (1u << 1)
#define PATH_PREFLAG_SET_VELOCITY    (1u << 2)
#define PATH_PREFLAG_SKIP_SET_TYPE   (1u << 3)

#pragma pack(push, 1)

typedef struct {
  /* Input specification (32 bytes) */
  uint8_t  pathType;                /* +0x00: 0..17 */
  uint8_t  unitType;                /* +0x01: 0=player, 1=monster, 3=missile */
  uint16_t classId;                 /* +0x02 */
  uint8_t  a2;                      /* +0x04: 3rd arg to #10334 */
  uint8_t  bAllocFlag;              /* +0x05: 6th arg to #11003 */
  uint8_t  nDistMax;                /* +0x06: +0x91 override (0xFF = keep default) */
  uint8_t  nStepNum;                /* +0x07: +0x90 override (0 = keep default) */
  uint32_t preFlags;                /* +0x08: PATH_PREFLAG_* */
  uint16_t startX;                  /* +0x0C */
  uint16_t startY;                  /* +0x0E */
  uint16_t targetX;                 /* +0x10 */
  uint16_t targetY;                 /* +0x12 */
  int32_t  velOverride;             /* +0x14: +0x7C override when PREFLAG_SET_VELOCITY */
  uint8_t  prevPathType;            /* +0x18: +0x40 override when PREFLAG_SET_PREV_TYPE */
  int8_t   targetDx;                /* +0x19: target unit X offset from startX */
  int8_t   targetDy;                /* +0x1A: target unit Y offset from startY */
  uint8_t  reservedIn;              /* +0x1B: 0 */
  uint32_t unitSeedLo;              /* +0x1C: unit +0x20 initial PRNG seed */

  /* Output observation (428 bytes) */
  int32_t  ret;                     /* +0x20: return value of #10334 (-1 on fault/assert) */
  uint8_t  faultKind;               /* +0x24: 0=none, 1=exception, 2=fogAssert */
  uint8_t  faultStage;              /* +0x25: 0=none, 1=alloc, 2=setType, 3=setTarget, 4=recalc */
  uint16_t wCollidedWithMask;       /* +0x26: pPath +0x54 */
  uint32_t faultCode;               /* +0x28 */
  uint32_t faultEipVa;              /* +0x2C */
  uint32_t faultLine;               /* +0x30 */
  uint32_t dwPathType;              /* +0x34: pPath +0x3C */
  uint32_t dwPrevPathType;          /* +0x38: pPath +0x40 */
  uint32_t dwFlags;                 /* +0x3C: pPath +0x34 */
  uint8_t  nDirection;              /* +0x40: pPath +0x64 */
  uint8_t  nNewDirection;           /* +0x41: pPath +0x65 */
  uint8_t  outDistMax;              /* +0x42: pPath +0x91 */
  uint8_t  outInitFScore;           /* +0x43: pPath +0x92 */
  int32_t  curRoomIdx;              /* +0x44: canonical ActiveRoom index of pPath +0x1C (-1 if NULL) */
  int32_t  outTargetX;              /* +0x48: pPath +0x10 */
  int32_t  outTargetY;              /* +0x4C: pPath +0x14 */
  uint32_t dwCurrentPointIdx;       /* +0x50: pPath +0x24 */
  uint32_t dwPathPoints;            /* +0x54: pPath +0x28 */
  uint32_t dwUnitSize;              /* +0x58: pPath +0x44 */
  uint32_t dwCollisionPattern;      /* +0x5C: pPath +0x48 */
  uint32_t nFootprintCollisionMask; /* +0x60: pPath +0x4C */
  uint32_t nMoveTestCollisionMask;  /* +0x64: pPath +0x50 */
  uint16_t wPathPoints[156];        /* +0x68: pPath +0x9C (312 bytes = 78 (x,y) pairs) */
  uint32_t nSavedStepsCount;        /* +0x1A0: pPath +0x1D4 */
  uint16_t wSavedSteps[20];         /* +0x1A4: pPath +0x1D8 (40 bytes = 10 (x,y) pairs) */
} PathVectorRecord;                 /* 460 bytes */

typedef struct {
  uint32_t va;
  uint8_t  data[4096];
} PageImageRecord;                  /* 4100 bytes */

typedef struct {
  uint32_t magic;            /* +0x00: 0x57485450 ('PTHW') */
  uint32_t version;          /* +0x04: 1 */
  uint32_t seed;             /* +0x08: 12345 */
  uint32_t diff;             /* +0x0C: 0 */
  uint32_t pActVa;           /* +0x10 */
  uint32_t pDrlgVa;          /* +0x14 */
  uint32_t pLevelVa;         /* +0x18 */
  uint32_t pUnitVa;          /* +0x1C */
  uint32_t pTargetUnitVa;    /* +0x20 */
  uint32_t pPathVa;          /* +0x24 */
  uint32_t nActiveRooms;     /* +0x28: 35 */
  uint32_t activeRoomVas[64];/* +0x2C: first nActiveRooms populated */
} PathWorldMetaHeader;

#pragma pack(pop)

/* ------------------------------- DLL Typedefs & Helpers */

typedef void(__fastcall *Fog_InitLogPrefix_t)(const char *);
typedef void(__fastcall *Fog_InitFileSystem_t)(int, void *);
typedef void(__fastcall *Fog_InitSystem_t)(int, void *);
typedef void(__stdcall *Fog_VoidStd_t)(void);
typedef int(__stdcall *Fog_IsExpansion_t)(void);
typedef BOOL(__stdcall *SFileOpenArchive_t)(const char *, DWORD, DWORD, HANDLE *);
typedef BOOL(__stdcall *SMemFree_t)(void *, const char *, int, DWORD);
typedef int(__fastcall *D2Lang_Init_t)(int, const char *, int);
typedef int(__stdcall *InitTables_t)(int, int, int);
typedef void *(__stdcall *LoadAct_t)(uint32_t, uint32_t, uint32_t, void *, uint32_t, void *, uint32_t, void *, void *);
typedef int(__stdcall *RemoveColl_t)(void *, int);
typedef void(__stdcall *RemoveRoom_t)(void *);

static inline uint32_t rd32(const uint8_t *p, int off) {
  return *(const uint32_t *)(p + off);
}
static inline int32_t rdi32(const uint8_t *p, int off) {
  return *(const int32_t *)(p + off);
}
static inline uint16_t rd16(const uint8_t *p, int off) {
  return *(const uint16_t *)(p + off);
}

static uint8_t *call_activate_roomex(uintptr_t fnActivate, uint8_t *pRoomEx) {
  uint8_t *activeRoom = NULL;
  __asm__ volatile(
    "call *%[fn]"
    : "=a"(activeRoom)
    : "a"(pRoomEx), [fn] "r"(fnActivate)
    : "ecx", "edx", "memory", "cc"
  );
  return activeRoom;
}

/* ------------------------------- Canonical Unit & Start/Target Tables */

typedef struct {
  uint8_t  unitType;
  uint16_t classId;
  uint8_t  a2;
} UnitConfig;

static const UnitConfig kUnitConfigs[6] = {
  { 0,  4, 0 }, /* Player: Paladin (size 2, pattern 1) */
  { 0,  1, 0 }, /* Player: Sorceress (size 2, pattern 1) */
  { 1,  1, 1 }, /* Monster: Returned (size 1, a2=1) */
  { 1, 15, 1 }, /* Monster: size 2 (a2=1) */
  { 1, 38, 1 }, /* Monster: classId 0x26 special case at 0x6FD8618B (pattern 5, mask 0x804) */
  { 3,  1, 0 }, /* Missile: unitType 3 (size 1, pattern 1, mask 0) */
};

typedef struct {
  uint16_t sx, sy;
  uint16_t tx, ty;
} CoordPair;

/* 64 diverse start/target subtile pairs across Rogue Encampment (L1, seed 12345) */
static const CoordPair kCoordPairs[64] = {
  /* 0: 0-distance */
  { 5653, 5918, 5653, 5918 },
  /* 1..8: 1 subtile in each of 8 directions */
  { 5653, 5918, 5654, 5918 },
  { 5653, 5918, 5654, 5919 },
  { 5653, 5918, 5653, 5919 },
  { 5653, 5918, 5652, 5919 },
  { 5653, 5918, 5652, 5918 },
  { 5653, 5918, 5652, 5917 },
  { 5653, 5918, 5653, 5917 },
  { 5653, 5918, 5654, 5917 },
  /* 9..16: 6 subtiles in each of 8 directions */
  { 5653, 5918, 5659, 5918 },
  { 5653, 5918, 5659, 5924 },
  { 5653, 5918, 5653, 5924 },
  { 5653, 5918, 5647, 5924 },
  { 5653, 5918, 5647, 5918 },
  { 5653, 5918, 5647, 5912 },
  { 5653, 5918, 5653, 5912 },
  { 5653, 5918, 5659, 5912 },
  /* 17..32: Non-colinear knight/corner turns (exercises IDA* >=2 corners) */
  { 5653, 5918, 5663, 5920 },
  { 5653, 5918, 5663, 5915 },
  { 5653, 5918, 5645, 5923 },
  { 5653, 5918, 5645, 5914 },
  { 5653, 5918, 5656, 5928 },
  { 5653, 5918, 5650, 5928 },
  { 5653, 5918, 5657, 5908 },
  { 5653, 5918, 5649, 5908 },
  { 5653, 5918, 5668, 5923 },
  { 5653, 5918, 5668, 5911 },
  { 5653, 5918, 5641, 5925 },
  { 5653, 5918, 5641, 5910 },
  { 5648, 5914, 5661, 5919 },
  { 5660, 5922, 5646, 5915 },
  { 5644, 5924, 5659, 5913 },
  { 5658, 5912, 5645, 5925 },
  /* 33..44: Cross-room paths across adjacent L1 ActiveRooms */
  { 5653, 5918, 5635, 5918 },
  { 5653, 5918, 5635, 5922 },
  { 5653, 5918, 5678, 5918 },
  { 5653, 5918, 5682, 5921 },
  { 5653, 5918, 5653, 5895 },
  { 5653, 5918, 5656, 5895 },
  { 5653, 5918, 5653, 5945 },
  { 5653, 5918, 5657, 5945 },
  { 5630, 5915, 5662, 5920 },
  { 5662, 5920, 5630, 5915 },
  { 5690, 5930, 5665, 5922 },
  { 5665, 5922, 5690, 5930 },
  /* 45..54: Into walls, obstacles, and along walls */
  { 5653, 5918, 5653, 5882 },
  { 5653, 5918, 5620, 5918 },
  { 5653, 5918, 5695, 5918 },
  { 5653, 5918, 5653, 5960 },
  { 5642, 5905, 5665, 5905 },
  { 5665, 5905, 5642, 5905 },
  { 5642, 5932, 5665, 5932 },
  { 5665, 5932, 5642, 5932 },
  { 5610, 5910, 5635, 5925 },
  { 5685, 5905, 5660, 5920 },
  /* 55..59: Max distance / beyond 78-point buffer */
  { 5653, 5918, 5745, 5918 },
  { 5653, 5918, 5560, 5918 },
  { 5653, 5918, 5653, 6010 },
  { 5653, 5918, 5730, 5995 },
  { 5653, 5918, 5575, 5850 },
  /* 60..63: Target outside all rooms / unreachable void */
  { 5653, 5918, 1000, 1000 },
  { 5653, 5918, 9000, 9000 },
  { 5653, 5918, 5400, 5918 },
  { 5653, 5918, 5653, 5700 },
};

static uint8_t *find_room_for_pos(uint8_t **activeRooms, int nRooms, int x, int y) {
  for (int i = 0; i < nRooms; i++) {
    uint8_t *r = activeRooms[i];
    if (!r) continue;
    int rx = rdi32(r, 0x4C);
    int ry = rdi32(r, 0x50);
    int rw = rdi32(r, 0x54);
    int rh = rdi32(r, 0x58);
    if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) {
      return r;
    }
  }
  return activeRooms[0];
}

static int find_room_index(uint8_t **activeRooms, int nRooms, const uint8_t *ptr) {
  if (!ptr) return -1;
  for (int i = 0; i < nRooms; i++) {
    if (activeRooms[i] == ptr) return i;
  }
  return -1;
}

static void execute_one_vector(
    void *fnAllocPath,
    void *fnSetType,
    void *fnSetTgt,
    void *fnRecalc,
    RemoveColl_t fnRemoveColl,
    RemoveRoom_t fnRemoveRoom,
    uint8_t **activeRooms,
    int nActiveRooms,
    uint8_t *pUnit,
    uint8_t *pTargetUnit,
    uint32_t pathAllocCursor,
    PathVectorRecord *rec) {
  uint8_t *startRoom = find_room_for_pos(activeRooms, nActiveRooms, rec->startX, rec->startY);

  /* Prepare primary synthetic D2UnitStrc (0xF4 bytes) */
  memset(pUnit, 0, 0x100);
  *(uint32_t *)(pUnit + 0x00) = (uint32_t)rec->unitType;
  *(uint32_t *)(pUnit + 0x04) = (uint32_t)rec->classId;
  *(uint32_t *)(pUnit + 0x0C) = 1u;
  *(uint32_t *)(pUnit + 0x10) = 1u; /* Neutral animMode so #10775 removes footprint */
  *(uint32_t *)(pUnit + 0x20) = rec->unitSeedLo;
  *(uint32_t *)(pUnit + 0x24) = 666u;

  /* Prepare optional target D2UnitStrc */
  memset(pTargetUnit, 0, 0x100);
  uint8_t *pTgtPath = pTargetUnit + 0x100;
  memset(pTgtPath, 0, 0x100);
  if (rec->preFlags & PATH_PREFLAG_SET_TARGET_UNIT) {
    uint16_t tx = (uint16_t)((int)rec->startX + (int)rec->targetDx);
    uint16_t ty = (uint16_t)((int)rec->startY + (int)rec->targetDy);
    *(uint32_t *)(pTargetUnit + 0x00) = 1u;
    *(uint32_t *)(pTargetUnit + 0x04) = 1u;
    *(uint32_t *)(pTargetUnit + 0x0C) = 2u;
    *(uint32_t *)(pTargetUnit + 0x10) = 1u;
    *(uint32_t *)(pTargetUnit + 0x2C) = (uint32_t)(uintptr_t)pTgtPath;
    *(uint16_t *)(pTgtPath + 0x02) = tx;
    *(uint16_t *)(pTgtPath + 0x06) = ty;
    *(uint32_t *)(pTgtPath + 0x1C) = (uint32_t)(uintptr_t)startRoom;
  }

  /* Reset bump cursor so #11003 allocates pPath at the exact deterministic VA */
  g_cursor = pathAllocCursor;

  /* Stage 1: #11003 PATH_AllocDynamicPath(NULL, startRoom, startX, startY, pUnit, bAllocFlag) */
  call_stdcall_n(
      fnAllocPath, 6,
      0u,
      (uint32_t)(uintptr_t)startRoom,
      (uint32_t)rec->startX,
      (uint32_t)rec->startY,
      (uint32_t)(uintptr_t)pUnit,
      (uint32_t)rec->bAllocFlag);

  uint8_t *pPath = *(uint8_t **)(pUnit + 0x2C);
  if (g_thunk_faulted || !pPath) {
    rec->ret = -1;
    rec->faultKind = (uint8_t)g_thunk_faulted;
    rec->faultStage = 1;
    rec->faultCode = g_fault_code;
    rec->faultEipVa = g_fault_eip_va;
    rec->faultLine = g_fault_line;
    return;
  }

  /* Apply pre-state overrides before #10647 PATH_SetType */
  if (rec->nDistMax != 0xFFu) {
    pPath[0x91] = rec->nDistMax;
  }
  if (rec->nStepNum != 0u) {
    pPath[0x90] = rec->nStepNum;
  }
  if (rec->preFlags & PATH_PREFLAG_SET_PREV_TYPE) {
    *(uint32_t *)(pPath + 0x3C) = (uint32_t)rec->prevPathType;
  }
  if (rec->preFlags & PATH_PREFLAG_SET_TARGET_UNIT) {
    *(uint32_t *)(pPath + 0x58) = (uint32_t)(uintptr_t)pTargetUnit;
  }
  if (rec->preFlags & PATH_PREFLAG_SET_VELOCITY) {
    *(int32_t *)(pPath + 0x7C) = rec->velOverride;
  }

  /* Stage 2: #10647 PATH_SetType(pPath, pathType) */
  if (!(rec->preFlags & PATH_PREFLAG_SKIP_SET_TYPE)) {
    call_stdcall_n(fnSetType, 2, (uint32_t)(uintptr_t)pPath, (uint32_t)rec->pathType, 0, 0, 0, 0);
    if (g_thunk_faulted) {
      rec->ret = -1;
      rec->faultKind = (uint8_t)g_thunk_faulted;
      rec->faultStage = 2;
      rec->faultCode = g_fault_code;
      rec->faultEipVa = g_fault_eip_va;
      rec->faultLine = g_fault_line;
      goto snapshot_path;
    }
  }

  /* Re-apply nStepNum in case PATH_SetType modified +0x90..+0x93 */
  if (rec->nStepNum != 0u) {
    pPath[0x90] = rec->nStepNum;
  }
  if (rec->nDistMax != 0xFFu) {
    pPath[0x91] = rec->nDistMax;
  }

  /* Stage 3: #10286 PATH_SetTargetPos(pPath, targetX, targetY) */
  call_stdcall_n(fnSetTgt, 3, (uint32_t)(uintptr_t)pPath, (uint32_t)rec->targetX, (uint32_t)rec->targetY, 0, 0, 0);
  if (g_thunk_faulted) {
    rec->ret = -1;
    rec->faultKind = (uint8_t)g_thunk_faulted;
    rec->faultStage = 3;
    rec->faultCode = g_fault_code;
    rec->faultEipVa = g_fault_eip_va;
    rec->faultLine = g_fault_line;
    goto snapshot_path;
  }

  /* Stage 4: #10334 PATH_FindSubpath(pPath, pUnit, a2) */
  {
    uint32_t retVal = call_stdcall_n(
        fnRecalc, 3,
        (uint32_t)(uintptr_t)pPath,
        (uint32_t)(uintptr_t)pUnit,
        (uint32_t)rec->a2,
        0, 0, 0);
    if (g_thunk_faulted) {
      rec->ret = -1;
      rec->faultKind = (uint8_t)g_thunk_faulted;
      rec->faultStage = 4;
      rec->faultCode = g_fault_code;
      rec->faultEipVa = g_fault_eip_va;
      rec->faultLine = g_fault_line;
      goto snapshot_path;
    }
    rec->ret = (int32_t)retVal;
    rec->faultKind = 0;
    rec->faultStage = 0;
  }

snapshot_path:
  rec->wCollidedWithMask       = rd16(pPath, 0x54);
  rec->dwPathType              = rd32(pPath, 0x3C);
  rec->dwPrevPathType          = rd32(pPath, 0x40);
  rec->dwFlags                 = rd32(pPath, 0x34);
  rec->nDirection              = pPath[0x64];
  rec->nNewDirection           = pPath[0x65];
  rec->outDistMax              = pPath[0x91];
  rec->outInitFScore           = pPath[0x92];
  rec->curRoomIdx              = find_room_index(activeRooms, nActiveRooms, *(uint8_t **)(pPath + 0x1C));
  rec->outTargetX              = rdi32(pPath, 0x10);
  rec->outTargetY              = rdi32(pPath, 0x14);
  rec->dwCurrentPointIdx       = rd32(pPath, 0x24);
  rec->dwPathPoints            = rd32(pPath, 0x28);
  rec->dwUnitSize              = rd32(pPath, 0x44);
  rec->dwCollisionPattern      = rd32(pPath, 0x48);
  rec->nFootprintCollisionMask = rd32(pPath, 0x4C);
  rec->nMoveTestCollisionMask  = rd32(pPath, 0x50);
  memcpy(rec->wPathPoints, pPath + 0x9C, sizeof(rec->wPathPoints));
  rec->nSavedStepsCount        = rd32(pPath, 0x1D4);
  memcpy(rec->wSavedSteps, pPath + 0x1D8, sizeof(rec->wSavedSteps));

  fnRemoveColl(pUnit, 1);
  fnRemoveRoom(pUnit);
}

static int write_d2tv_file(const char *path, const char *kind, uint16_t flags,
                           uint32_t recSize, uint32_t recCount, uint64_t seed,
                           const void *payload) {
  FILE *fp = fopen(path, "wb");
  if (!fp) {
    fprintf(stderr, "[path-emitter] Failed to open '%s' for writing\n", path);
    return -1;
  }
  D2TVHeader hdr;
  d2tv_init_header(&hdr, kind, recSize, recCount, seed);
  hdr.flags = flags;
  if (fwrite(&hdr, sizeof(hdr), 1, fp) != 1) {
    fclose(fp);
    return -1;
  }
  size_t totalBytes = (size_t)recSize * (size_t)recCount;
  if (totalBytes > 0 && fwrite(payload, 1, totalBytes, fp) != totalBytes) {
    fclose(fp);
    return -1;
  }
  fclose(fp);
  return 0;
}

int main(int argc, char **argv) {
  if (sizeof(PathVectorRecord) != 460 || sizeof(PageImageRecord) != 4100) {
    fprintf(stderr, "[path-emitter] Struct size mismatch (%u, %u)!\n",
            (unsigned)sizeof(PathVectorRecord), (unsigned)sizeof(PageImageRecord));
    return 2;
  }

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX);
  g_arena = (uint8_t *)VirtualAlloc((void *)ARENA_BASE, ARENA_SIZE, MEM_RESERVE | MEM_COMMIT, PAGE_READWRITE);
  if ((uintptr_t)g_arena != ARENA_BASE) {
    fprintf(stderr, "[path-emitter] VirtualAlloc at 0x%08x failed (got %p)\n", ARENA_BASE, (void *)g_arena);
    return 2;
  }

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  HMODULE hFog   = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCom   = LoadLibraryA("D2Common.dll");
  HMODULE hK32   = GetModuleHandleA("kernel32.dll");
  if (!hStorm || !hFog || !hLang || !hCom || !hK32) {
    fprintf(stderr, "[path-emitter] Failed to load 1.13c DLLs\n");
    return 3;
  }

  IMAGE_NT_HEADERS32 *ntCom = (IMAGE_NT_HEADERS32 *)((uint8_t *)hCom + ((IMAGE_DOS_HEADER *)hCom)->e_lfanew);
  g_d2com_base = (uintptr_t)hCom;
  g_d2com_size = ntCom->OptionalHeader.SizeOfImage;

  /* Pin D2Common.dll's MSVC /GS __security_cookie (0x6FDE9950) to canonical 0xBB40E64E */
  *(uint32_t *)((uint8_t *)hCom - D2COM_PREF_BASE + 0x6FDE9950u) = 0xBB40E64Eu;

  /* Route all D2Common Fog allocations into the deterministic 0x20000000 arena */
  hook_iat_entry(hCom, (void *)GetProcAddress(hFog, MAKEINTRESOURCEA(10042)), (void *)hk_fog_10042);
  hook_iat_entry(hCom, (void *)GetProcAddress(hFog, MAKEINTRESOURCEA(10043)), (void *)hk_fog_10043);
  hook_iat_entry(hCom, (void *)GetProcAddress(hFog, MAKEINTRESOURCEA(10045)), (void *)hk_fog_10045);
  hook_iat_entry(hCom, (void *)GetProcAddress(hFog, MAKEINTRESOURCEA(10046)), (void *)hk_fog_10046);
  hook_iat_entry(hCom, (void *)GetProcAddress(hFog, MAKEINTRESOURCEA(10047)), (void *)hk_fog_10047);
  hook_iat_entry(hCom, (void *)GetProcAddress(hFog, MAKEINTRESOURCEA(10024)), (void *)stub_fog_10024);
  hook_iat_entry(hCom, (void *)GetProcAddress(hK32, "GetTickCount"), (void *)stub_GetTickCount);

  SMemFree_t pFree = (SMemFree_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(403));
  SFileOpenArchive_t pOpen = (SFileOpenArchive_t)(void (*)(void))GetProcAddress(hStorm, MAKEINTRESOURCEA(266));
  {
    IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)hStorm;
    IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)((uint8_t *)hStorm + dos->e_lfanew);
    uintptr_t rb = (uintptr_t)hStorm - nt->OptionalHeader.ImageBase;
    void **pp = (void **)(0x6FC43120u + rb);
    if (*pp) {
      pFree(*pp, "p", 1, 0);
      *pp = NULL;
    }
  }
  ((Fog_InitLogPrefix_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10021)))("D2");
  ((Fog_InitFileSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10101)))(0, NULL);
  ((Fog_InitSystem_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10089)))(1, NULL);
  ((Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10082)))();
  ((Fog_VoidStd_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10218)))();

  static const char *const kMpqs[6] = {
    "d2data.mpq", "d2char.mpq", "d2sfx.mpq", "d2speech.mpq", "d2exp.mpq", "Patch_D2.mpq"
  };
  static const DWORD kPrio[6] = {1000, 1000, 1000, 1000, 3000, 5000};
  for (int i = 0; i < 6; i++) {
    HANDLE h = 0;
    if (!pOpen(kMpqs[i], kPrio[i], 0, &h)) {
      pOpen(kMpqs[i], kPrio[i], 2, &h);
    }
  }

  int isExp = ((Fog_IsExpansion_t)(void (*)(void))GetProcAddress(hFog, MAKEINTRESOURCEA(10227)))();
  ((D2Lang_Init_t)(void (*)(void))GetProcAddress(hLang, MAKEINTRESOURCEA(10008)))(0, NULL, isExp);
  if (!((InitTables_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10943)))(0, 0, 0)) {
    fprintf(stderr, "[path-emitter] DATATBLS_LoadAllTxts (#10943) failed\n");
    return 4;
  }

  AddVectoredExceptionHandler(1, path_veh);

  /* Page-align the start of the Act 0 L1 world in the arena */
  uint32_t actStartCursor = (g_cursor + 0xFFFu) & ~0xFFFu;
  g_cursor = actStartCursor;

  LoadAct_t LoadAct       = (LoadAct_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10951));
  void *fnAllocPath       = (void *)GetProcAddress(hCom, MAKEINTRESOURCEA(11003));
  void *fnSetType         = (void *)GetProcAddress(hCom, MAKEINTRESOURCEA(10647));
  void *fnSetTgt          = (void *)GetProcAddress(hCom, MAKEINTRESOURCEA(10286));
  void *fnRecalc          = (void *)GetProcAddress(hCom, MAKEINTRESOURCEA(10334));
  RemoveColl_t RemoveColl = (RemoveColl_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(10775));
  RemoveRoom_t RemoveRoom = (RemoveRoom_t)(void (*)(void))GetProcAddress(hCom, MAKEINTRESOURCEA(11016));

  uintptr_t fnActivate = (uintptr_t)hCom - D2COM_PREF_BASE + 0x6FDCC270u;
  void *pGame = VirtualAlloc((void *)0x1FFE0000u, 0x2000, MEM_RESERVE | MEM_COMMIT, PAGE_NOACCESS);
  if (!pGame) {
    pGame = (void *)0x1FFE0000u;
  }

  uint8_t *pAct = (uint8_t *)LoadAct(0, 12345u, 0, pGame, 0, NULL, 1u, NULL, NULL);
  uint8_t *pDrlg = *(uint8_t **)(pAct + 0x48);
  uint8_t *pLevel = *(uint8_t **)(pDrlg + 0x47C);
  while (pLevel && rd32(pLevel, 0x1D0) != 1u) {
    pLevel = *(uint8_t **)(pLevel + 0x1AC);
  }

  uint8_t *activeRooms[64];
  int nActiveRooms = 0;
  for (uint8_t *r = *(uint8_t **)(pLevel + 0x10); r && nActiveRooms < 64; r = *(uint8_t **)(r + 0x24)) {
    uint8_t *ar = call_activate_roomex(fnActivate, r);
    activeRooms[nActiveRooms++] = ar;
  }

  /* Page-align the end of the L1 world and reserve dedicated page for pUnit, pTargetUnit, pPath */
  uint32_t worldEndCursor = (g_cursor + 0xFFFu) & ~0xFFFu;
  uint32_t unitPageCursor = worldEndCursor;
  uint8_t *pUnit          = g_arena + unitPageCursor + 0x000u;
  uint8_t *pTargetUnit    = g_arena + unitPageCursor + 0x200u;
  uint32_t pathAllocCur   = unitPageCursor + 0x400u;
  uint32_t pPathVa        = ARENA_BASE + ((pathAllocCur + 16u + 15u) & ~15u);
  uint32_t totalSnapPages = (unitPageCursor >> 12);

  /* Save pristine snapshot of the mutable world slice [actStartCursor, worldEndCursor) */
  uint32_t worldSliceBytes = worldEndCursor - actStartCursor;
  uint8_t *worldSnapshot = (uint8_t *)malloc(worldSliceBytes);
  if (!worldSnapshot) {
    fprintf(stderr, "[path-emitter] Failed to allocate worldSnapshot\n");
    return 5;
  }
  memcpy(worldSnapshot, g_arena + actStartCursor, worldSliceBytes);

  /* Arm PAGE_NOACCESS across [0, worldEndCursor) and D2Common .rdata/.data (>= +0x89000) */
  DWORD oldProt = 0;
  VirtualProtect(g_arena, worldEndCursor, PAGE_NOACCESS, &oldProt);
  VirtualProtect((uint8_t *)hCom + 0x89000u, g_d2com_size - 0x89000u, PAGE_NOACCESS, &oldProt);
  g_touched_arena[unitPageCursor >> 12] = 1;
  g_page_trace_active = 1;

  /* Build the 6,924-vector test matrix (18 pathTypes x 6 unitConfigs x 64 pairs + 12 explicit pre-state/assert cases) */
  const uint32_t matrixCount = 18u * 6u * 64u;
  const uint32_t extraCount  = 12u;
  const uint32_t totalRecs   = matrixCount + extraCount;
  PathVectorRecord *records  = (PathVectorRecord *)calloc(totalRecs, sizeof(PathVectorRecord));
  if (!records) {
    fprintf(stderr, "[path-emitter] Out of memory allocating PathVectorRecord array\n");
    return 5;
  }

  uint32_t vecIdx = 0;
  for (uint8_t t = 0; t < 18; t++) {
    for (int uIdx = 0; uIdx < 6; uIdx++) {
      for (int pIdx = 0; pIdx < 64; pIdx++) {
        PathVectorRecord *rec = &records[vecIdx++];
        rec->pathType   = t;
        rec->unitType   = kUnitConfigs[uIdx].unitType;
        rec->classId    = kUnitConfigs[uIdx].classId;
        rec->a2         = kUnitConfigs[uIdx].a2;
        rec->bAllocFlag = 0;
        rec->nDistMax   = (t == 4 && kUnitConfigs[uIdx].unitType == 3) ? 14u : 0xFFu;
        rec->nStepNum   = (t == 8 || t == 10 || t == 11) ? 12u : 0u;
        rec->preFlags   = (t == 8 && (pIdx & 1)) ? PATH_PREFLAG_SET_TARGET_UNIT : 0u;
        rec->startX     = kCoordPairs[pIdx].sx;
        rec->startY     = kCoordPairs[pIdx].sy;
        rec->targetX    = kCoordPairs[pIdx].tx;
        rec->targetY    = kCoordPairs[pIdx].ty;
        rec->velOverride = 0;
        rec->prevPathType = 0;
        rec->targetDx   = (t == 8 && (pIdx & 1)) ? -3 : 0;
        rec->targetDy   = (t == 8 && (pIdx & 1)) ? -2 : 0;
        rec->reservedIn = 0;
        rec->unitSeedLo = 12345u + (uint32_t)pIdx;
      }
    }
  }

  /* 12 explicit edge-case / documented Fog.#10024 assertion vectors */
  {
    /* 0..1: prevPathType == 11 -> SetType asserts at line 0x871 (2161) */
    for (int i = 0; i < 2; i++) {
      PathVectorRecord *rec = &records[vecIdx++];
      rec->pathType = (uint8_t)(i == 0 ? 0 : 7);
      rec->unitType = 0; rec->classId = 4; rec->a2 = 0;
      rec->nDistMax = 0xFFu; rec->nStepNum = 0;
      rec->preFlags = PATH_PREFLAG_SET_PREV_TYPE;
      rec->prevPathType = 11;
      rec->startX = 5653; rec->startY = 5918;
      rec->targetX = 5663; rec->targetY = 5920;
      rec->unitSeedLo = 12345u;
    }
    /* 2..3: prevPathType == 8 -> SetType asserts at line 0x872 (2162) */
    for (int i = 0; i < 2; i++) {
      PathVectorRecord *rec = &records[vecIdx++];
      rec->pathType = (uint8_t)(i == 0 ? 0 : 7);
      rec->unitType = 0; rec->classId = 4; rec->a2 = 0;
      rec->nDistMax = 0xFFu; rec->nStepNum = 0;
      rec->preFlags = PATH_PREFLAG_SET_PREV_TYPE;
      rec->prevPathType = 8;
      rec->startX = 5653; rec->startY = 5918;
      rec->targetX = 5663; rec->targetY = 5920;
      rec->unitSeedLo = 12345u;
    }
    /* 4..5: pathType == 4 with nDistMax >= 0x4E -> SetType asserts at line 0x873 (2163) */
    for (int i = 0; i < 2; i++) {
      PathVectorRecord *rec = &records[vecIdx++];
      rec->pathType = 4;
      rec->unitType = (uint8_t)i; rec->classId = 4; rec->a2 = (uint8_t)i;
      rec->nDistMax = (uint8_t)(0x4Eu + i); rec->nStepNum = 0;
      rec->preFlags = 0;
      rec->startX = 5653; rec->startY = 5918;
      rec->targetX = 5663; rec->targetY = 5920;
      rec->unitSeedLo = 12345u;
    }
    /* 6..7: bAllocFlag == 1 (sets dwFlags |= 0x10 in AllocDynamicPath) */
    for (int i = 0; i < 2; i++) {
      PathVectorRecord *rec = &records[vecIdx++];
      rec->pathType = (uint8_t)(i == 0 ? 0 : 7);
      rec->unitType = 0; rec->classId = 4; rec->a2 = 0;
      rec->bAllocFlag = 1;
      rec->nDistMax = 0xFFu; rec->nStepNum = 0;
      rec->preFlags = 0;
      rec->startX = 5653; rec->startY = 5918;
      rec->targetX = 5663; rec->targetY = 5920;
      rec->unitSeedLo = 12345u;
    }
    /* 8..9: Leap (t=9) with custom velocity overrides (0x1000, 0x400) */
    for (int i = 0; i < 2; i++) {
      PathVectorRecord *rec = &records[vecIdx++];
      rec->pathType = 9;
      rec->unitType = 0; rec->classId = 4; rec->a2 = 0;
      rec->nDistMax = 0xFFu; rec->nStepNum = 0;
      rec->preFlags = PATH_PREFLAG_SET_VELOCITY;
      rec->velOverride = i == 0 ? 0x1000 : 0x400;
      rec->startX = 5653; rec->startY = 5918;
      rec->targetX = 5663; rec->targetY = 5922;
      rec->unitSeedLo = 12345u;
    }
    /* 10..11: Default pathType from AllocDynamicPath (skip SetType: player->7, monster->2) */
    for (int i = 0; i < 2; i++) {
      PathVectorRecord *rec = &records[vecIdx++];
      rec->pathType = (uint8_t)(i == 0 ? 7 : 2);
      rec->unitType = (uint8_t)i; rec->classId = (uint16_t)(i == 0 ? 4 : 1); rec->a2 = (uint8_t)i;
      rec->nDistMax = 0xFFu; rec->nStepNum = 0;
      rec->preFlags = PATH_PREFLAG_SKIP_SET_TYPE;
      rec->startX = 5653; rec->startY = 5918;
      rec->targetX = 5663; rec->targetY = 5920;
      rec->unitSeedLo = 12345u;
    }
  }

  uint32_t actStartPage = actStartCursor >> 12;
  uint32_t worldEndPage = worldEndCursor >> 12;

  /* Execute all vectors, restoring any touched world pages before each vector */
  for (uint32_t i = 0; i < totalRecs; i++) {
    for (uint32_t p = actStartPage; p < worldEndPage; p++) {
      if (g_touched_arena[p]) {
        uint32_t pageOff = p << 12;
        memcpy(g_arena + pageOff, worldSnapshot + (pageOff - actStartCursor), 4096u);
      }
    }
    execute_one_vector(
        fnAllocPath, fnSetType, fnSetTgt, fnRecalc, RemoveColl, RemoveRoom,
        activeRooms, nActiveRooms, pUnit, pTargetUnit, pathAllocCur, &records[i]);
  }

  g_page_trace_active = 0;
  restore_iat_entries();

  /* Restore pristine world pages one final time before dumping PAGEIMG */
  for (uint32_t p = actStartPage; p < worldEndPage; p++) {
    if (g_touched_arena[p]) {
      uint32_t pageOff = p << 12;
      memcpy(g_arena + pageOff, worldSnapshot + (pageOff - actStartCursor), 4096u);
    }
  }
  memset(g_arena + unitPageCursor, 0, 4096u);

  /* Verify PATHTYPE coverage table before writing outputs */
  uint32_t nonFaultByType[18] = {0};
  uint32_t posRetByType[18]   = {0};
  uint32_t assertByType[18]   = {0};
  for (uint32_t i = 0; i < totalRecs; i++) {
    uint8_t t = records[i].pathType;
    if (t >= 18) continue;
    if (records[i].faultKind == 0) {
      nonFaultByType[t]++;
      if (records[i].ret > 0 && records[i].dwPathPoints > 0) {
        posRetByType[t]++;
      }
    } else if (records[i].faultKind == 2) {
      assertByType[t]++;
    }
  }

  for (int t = 0; t < 18; t++) {
    printf("[path-emitter] type %2d: nonFault=%4u posRet=%4u fogAssert=%4u\n",
           t, nonFaultByType[t], posRetByType[t], assertByType[t]);
    if (t < 17 && posRetByType[t] == 0) {
      fprintf(stderr, "[path-emitter] ERROR: PATHTYPE %d has 0 positive-return vectors!\n", t);
      TerminateProcess(GetCurrentProcess(), 15);
    }
    if (t == 17 && assertByType[t] == 0) {
      fprintf(stderr, "[path-emitter] ERROR: PATHTYPE 17 has 0 fogAssert vectors!\n");
      TerminateProcess(GetCurrentProcess(), 16);
    }
  }

  /* Collect all touched 4 KiB pages into PAGEIMG (1 meta page + arena pages + D2Common pages) */
  uint32_t nArenaTouched = 0;
  uint32_t nD2ComTouched = 0;
  for (uint32_t p = 0; p <= totalSnapPages; p++) {
    if (g_touched_arena[p]) nArenaTouched++;
  }
  uint32_t d2comPages = (g_d2com_size + 0xFFFu) >> 12;
  for (uint32_t p = 0; p < d2comPages; p++) {
    if (g_touched_d2com[p]) nD2ComTouched++;
  }

  uint32_t totalPageRecs = 1u + nArenaTouched + nD2ComTouched;
  PageImageRecord *pageRecs = (PageImageRecord *)calloc(totalPageRecs, sizeof(PageImageRecord));
  if (!pageRecs) {
    fprintf(stderr, "[path-emitter] Out of memory allocating PageImageRecord array\n");
    return 5;
  }

  uint32_t pOut = 0;
  /* Record 0: Metadata page at META_PAGE_VA (0x1FFFF000) */
  pageRecs[pOut].va = META_PAGE_VA;
  PathWorldMetaHeader *meta = (PathWorldMetaHeader *)pageRecs[pOut].data;
  meta->magic         = META_PAGE_MAGIC;
  meta->version       = 1u;
  meta->seed          = 12345u;
  meta->diff          = 0u;
  meta->pActVa        = (uint32_t)(uintptr_t)pAct;
  meta->pDrlgVa       = (uint32_t)(uintptr_t)pDrlg;
  meta->pLevelVa      = (uint32_t)(uintptr_t)pLevel;
  meta->pUnitVa       = (uint32_t)(uintptr_t)pUnit;
  meta->pTargetUnitVa = (uint32_t)(uintptr_t)pTargetUnit;
  meta->pPathVa       = pPathVa;
  meta->nActiveRooms  = (uint32_t)nActiveRooms;
  for (int i = 0; i < nActiveRooms; i++) {
    meta->activeRoomVas[i] = (uint32_t)(uintptr_t)activeRooms[i];
  }
  pOut++;

  /* Touched arena pages */
  for (uint32_t p = 0; p <= totalSnapPages; p++) {
    if (!g_touched_arena[p]) continue;
    pageRecs[pOut].va = ARENA_BASE + (p << 12);
    memcpy(pageRecs[pOut].data, g_arena + (p << 12), 4096u);
    pOut++;
  }

  /* Touched D2Common pages (mapped to canonical preferred base 0x6FD50000) */
  for (uint32_t p = 0; p < d2comPages; p++) {
    if (!g_touched_d2com[p]) continue;
    pageRecs[pOut].va = D2COM_PREF_BASE + (p << 12);
    uint32_t copyBytes = 4096u;
    if ((p << 12) + copyBytes > g_d2com_size) {
      copyBytes = g_d2com_size - (p << 12);
    }
    memcpy(pageRecs[pOut].data, (const uint8_t *)hCom + (p << 12), copyBytes);
    pOut++;
  }

  const char *outVecPath = argc > 1 ? argv[1] : "path-vectors-113c.d2tv";
  const char *outImgPath = argc > 2 ? argv[2] : "path-world-town-s12345.img";
  uint16_t hdrFlags = (uint16_t)(isExp ? 1u : 0u);

  if (write_d2tv_file(outVecPath, "PATHVEC", hdrFlags,
                      sizeof(PathVectorRecord), totalRecs, 12345ULL, records) != 0) {
    TerminateProcess(GetCurrentProcess(), 17);
  }
  if (write_d2tv_file(outImgPath, "PAGEIMG", hdrFlags,
                      sizeof(PageImageRecord), totalPageRecs, 12345ULL, pageRecs) != 0) {
    TerminateProcess(GetCurrentProcess(), 18);
  }

  printf("[path-emitter] Done: PATHVEC=%u recs, PAGEIMG=%u pages (%u arena + %u d2com + 1 meta)\n",
         totalRecs, totalPageRecs, nArenaTouched, nD2ComTouched);
  fflush(stdout);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
