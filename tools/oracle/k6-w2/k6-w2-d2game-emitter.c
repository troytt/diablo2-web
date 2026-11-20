/*
 * k6-w2-d2game-emitter.c — Milestone #37 [K6] Wave 2 Real-DLL Differential Emitter
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables (0x20000000..0x206F7FFF + D2Common .data/.bss)
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert) and Fog.#10042/#10045/#10047
 * (deterministic bump allocator), and executes 110 real D2Game.dll functions in
 * 0x6FC80000..0x6FD15000 across normal, branching, boundary, S2C-queuing, PRNG,
 * heap-allocating, and Fog-assert cases.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define D2COM_PREF_BASE   0x6FD50000u
#define D2GAME_PREF_BASE  0x6FC20000u

#define DATATBLS_BASE     0x20000000u
#define DATATBLS_SIZE     0x00800000u

#define STAGE_BASE        0x30000000u
#define STAGE_FIXED_SIZE  0x00009000u
#define STAGE_SETUP_BASE  0x30020000u
#define STAGE_TOTAL_SIZE  0x00040000u

#define HEAP_BASE         0x40000000u
#define HEAP_SIZE         0x00200000u

/* Fixed staged object addresses inside 0x30000000..0x30008FFF */
#define STAGE_GAME        (STAGE_BASE + 0x0000u) /* 0x2000: D2GameStrc */
#define STAGE_CLIENT      (STAGE_BASE + 0x2000u) /* 0x0600: D2ClientStrc */
#define STAGE_PKTNODE0    (STAGE_BASE + 0x2600u) /* 0x0210: D2PacketDataStrc #0 */
#define STAGE_PKTNODE1    (STAGE_BASE + 0x2810u) /* 0x0210: D2PacketDataStrc #1 */
#define STAGE_UNIT0       (STAGE_BASE + 0x3000u) /* 0x0200: primary D2UnitStrc */
#define STAGE_UDATA0      (STAGE_BASE + 0x3200u) /* 0x0200: primary unit data */
#define STAGE_UNIT1       (STAGE_BASE + 0x3400u) /* 0x0200: secondary D2UnitStrc */
#define STAGE_UDATA1      (STAGE_BASE + 0x3600u) /* 0x0200: secondary unit data */
#define STAGE_UNIT2       (STAGE_BASE + 0x3800u) /* 0x0200: tertiary D2UnitStrc */
#define STAGE_UDATA2      (STAGE_BASE + 0x3A00u) /* 0x0200: tertiary unit data */
#define STAGE_PATH0       (STAGE_BASE + 0x4000u) /* 0x0300: path for UNIT0 */
#define STAGE_PATH1       (STAGE_BASE + 0x4300u) /* 0x0300: path for UNIT1 */
#define STAGE_PATH2       (STAGE_BASE + 0x4600u) /* 0x0300: path for UNIT2 */
#define STAGE_ROOM0       (STAGE_BASE + 0x5000u) /* 0x0100: D2ActiveRoomStrc #0 */
#define STAGE_ROOMEX0     (STAGE_BASE + 0x5100u) /* 0x0100: D2RoomExStrc #0 */
#define STAGE_LEVEL0      (STAGE_BASE + 0x5200u) /* 0x0200: D2DrlgLevelStrc #0 */
#define STAGE_ROOM1       (STAGE_BASE + 0x5400u) /* 0x0100: D2ActiveRoomStrc #1 */
#define STAGE_ROOMEX1     (STAGE_BASE + 0x5500u) /* 0x0100: D2RoomExStrc #1 */
#define STAGE_LEVEL1      (STAGE_BASE + 0x5600u) /* 0x0200: D2DrlgLevelStrc #1 */
#define STAGE_ACT0        (STAGE_BASE + 0x5800u) /* 0x0100: D2ActStrc #0 */
#define STAGE_ACT1        (STAGE_BASE + 0x5900u) /* 0x0100: D2ActStrc #1 */
#define STAGE_DRLG0       (STAGE_BASE + 0x5A00u) /* 0x0500: D2DrlgStrc #0 */
#define STAGE_DMG         (STAGE_BASE + 0x6000u) /* 0x0100: D2DamageStrc */
#define STAGE_QUESTCTRL   (STAGE_BASE + 0x6100u) /* 0x0100: pQuestControl */
#define STAGE_QUEST0      (STAGE_BASE + 0x6200u) /* 0x0200: D2QuestDataStrc */
#define STAGE_QUESTEX0    (STAGE_BASE + 0x6400u) /* 0x0200: pQuestDataEx */
#define STAGE_QUESTARG    (STAGE_BASE + 0x6600u) /* 0x0100: D2QuestArgStrc */
#define STAGE_QBITS0      (STAGE_BASE + 0x6700u) /* 0x0100: quest bit record + buffer */
#define STAGE_PETCTRL     (STAGE_BASE + 0x6800u) /* 0x0200: pPlayerPets + buckets/nodes */
#define STAGE_PARTYCTRL   (STAGE_BASE + 0x6A00u) /* 0x0200: pPartyControl + nodes */
#define STAGE_NPCCTRL     (STAGE_BASE + 0x6C00u) /* 0x1200: pNpcControl + 64*0x44 array */
#define STAGE_SCRATCH     (STAGE_BASE + 0x8000u) /* 0x1000: out-params / packets / ctx */

#define U32(addr) (*(volatile uint32_t *)((uintptr_t)(addr)))
#define U16(addr) (*(volatile uint16_t *)((uintptr_t)(addr)))
#define U8(addr)  (*(volatile uint8_t  *)((uintptr_t)(addr)))
#define S32(addr) (*(volatile int32_t  *)((uintptr_t)(addr)))
#define S16(addr) (*(volatile int16_t  *)((uintptr_t)(addr)))

#define MAX_STACK 12

static HMODULE g_hFog  = NULL;
static HMODULE g_hCom  = NULL;
static HMODULE g_hGame = NULL;
static uintptr_t g_com_rebase  = 0;
static uintptr_t g_game_rebase = 0;

/* Allocator cursor: points into STAGE_SETUP_BASE during setup, HEAP_BASE during call */
static int g_in_setup_phase = 1;
static uint32_t g_setup_top = STAGE_SETUP_BASE;
static uint32_t g_heap_top  = HEAP_BASE;

/* D2Common helper function pointers for deterministic pre-state construction */
typedef void *(__stdcall *Com_CreateStatListEx_t)(void *pOwner, uint32_t flags, void *pfnCb, void *pGame);
typedef void  (__stdcall *Com_SetUnitStat_t)(void *pUnit, int32_t statId, int32_t val, int32_t layer);
typedef void *(__stdcall *Com_AllocStatList_t)(void *pPool, uint32_t flags, uint32_t timeout, int32_t uType, int32_t guid);
typedef int32_t(__stdcall *Com_SetStatIfValid_t)(void *pList, int32_t statId, int32_t val, uint32_t param);
typedef void  (__stdcall *Com_SetStatListState_t)(void *pList, int32_t state);
typedef void  (__stdcall *Com_MergeStatLists_t)(void *pUnit, void *pSubList, int32_t bType);
typedef void  (__stdcall *Com_ToggleGfxState_t)(void *pUnit, int32_t state, int32_t bSet);
typedef void *(__stdcall *Com_AllocSkillList_t)(void *pPool);
typedef void  (__stdcall *Com_SetSkillLevel_t)(void *pUnit, int32_t skId, int32_t lvl, int32_t bRem, int32_t u5, int32_t u6);
typedef void *(__stdcall *Com_AllocInventory_t)(void *pPool, void *pOwner);
typedef void  (__stdcall *Com_SetCursorItem_t)(void *pInv, void *pItem);
typedef int32_t(__stdcall *Com_PlaceItemInBodyLoc_t)(void *pInv, void *pItem, int32_t bodyLoc);
typedef int32_t(__stdcall *Com_CheckItemTypeId_t)(void *pItem, int32_t itemType);
typedef int32_t(__stdcall *Com_UnitsIsDoor_t)(void *pUnit);

static Com_CreateStatListEx_t   fn_CreateStatListEx   = NULL;
static Com_SetUnitStat_t        fn_SetUnitStat        = NULL;
static Com_AllocStatList_t      fn_AllocStatList      = NULL;
static Com_SetStatIfValid_t     fn_SetStatIfValid     = NULL;
static Com_SetStatListState_t   fn_SetStatListState   = NULL;
static Com_MergeStatLists_t     fn_MergeStatLists     = NULL;
static Com_ToggleGfxState_t     fn_ToggleGfxState     = NULL;
static Com_AllocSkillList_t     fn_AllocSkillList     = NULL;
static Com_SetSkillLevel_t      fn_SetSkillLevel      = NULL;
static Com_AllocInventory_t     fn_AllocInventory     = NULL;
static Com_SetCursorItem_t      fn_SetCursorItem      = NULL;
static Com_PlaceItemInBodyLoc_t fn_PlaceItemInBodyLoc = NULL;
static Com_CheckItemTypeId_t    fn_CheckItemTypeId    = NULL;
static Com_UnitsIsDoor_t        fn_UnitsIsDoor        = NULL;

/* Discovered real v1.13c item/object IDs */
static uint32_t g_item_javelin = 0;
static uint32_t g_item_bow     = 0;
static uint32_t g_item_shield  = 0;
static uint32_t g_item_potion26 = 0;
static uint32_t g_item_ring    = 0;
static uint32_t g_item_soulstone = 0;
static uint32_t g_obj_door     = 0;

/* ------------------------------- Generic Register+Stack Thunk & VEH */

uint32_t g_thunk_target = 0;
uint32_t g_thunk_nargs  = 0;
uint32_t g_thunk_args[MAX_STACK];
uint32_t g_thunk_in_eax = 0;
uint32_t g_thunk_in_ecx = 0;
uint32_t g_thunk_in_edx = 0;
uint32_t g_thunk_in_ebx = 0;
uint32_t g_thunk_in_esi = 0;
uint32_t g_thunk_in_edi = 0;

uint32_t g_thunk_out_eax = 0;
uint32_t g_thunk_saved_esp = 0;
uint32_t g_thunk_saved_ebp = 0;
uint32_t g_thunk_esp_before = 0;
uint32_t g_thunk_esp_after  = 0;

volatile LONG g_thunk_in_call = 0;
volatile LONG g_thunk_faulted = 0; /* 0 = ok, 1 = hw exception, 2 = Fog.#10024 assert */
uint32_t g_fault_code = 0;
uint32_t g_fault_eip  = 0;
uint32_t g_fault_addr = 0;
uint32_t g_assert_line = 0;
uint32_t g_assert_a2   = 0;
static uint32_t g_total_emitted = 0;

void thunk_resume(void);

__attribute__((naked)) static void thunk_invoke(void) {
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
      /* Scrub 0x280 bytes below ESP for -O2 == -fno-omit-frame-pointer parity */
      "leal -0x280(%esp), %edi\n\t"
      "xorl %eax, %eax\n\t"
      "movl $0xA0, %ecx\n\t"
      "cld\n\t"
      "rep stosl\n\t"
      "movl %esp, _g_thunk_esp_before\n\t"
      "movl _g_thunk_in_eax, %eax\n\t"
      "movl _g_thunk_in_ecx, %ecx\n\t"
      "movl _g_thunk_in_edx, %edx\n\t"
      "movl _g_thunk_in_ebx, %ebx\n\t"
      "movl _g_thunk_in_esi, %esi\n\t"
      "movl _g_thunk_in_edi, %edi\n\t"
      "call *_g_thunk_target\n\t"
      "movl %esp, _g_thunk_esp_after\n\t"
      "movl %eax, _g_thunk_out_eax\n\t"
      ".globl _thunk_resume\n"
      "_thunk_resume:\n\t"
      "movl _g_thunk_saved_ebp, %ebp\n\t"
      "movl _g_thunk_saved_esp, %esp\n\t"
      "popl %edi\n\t"
      "popl %esi\n\t"
      "popl %ebx\n\t"
      "popl %ebp\n\t"
      "ret\n\t");
}

void record_fog_assert(void) {
  g_thunk_in_call = 0;
  g_thunk_faulted = 2;
  g_assert_line = g_assert_a2;
}

__attribute__((naked)) static void stub_fog_10024(void) {
  __asm__ volatile(
      "movl 12(%esp), %eax\n\t"
      "movl %eax, _g_assert_a2\n\t"
      "call _record_fog_assert\n\t"
      "jmp _thunk_resume\n\t");
}

static LONG CALLBACK k6_veh(EXCEPTION_POINTERS *ep) {
  DWORD code = ep->ExceptionRecord->ExceptionCode;
  if (!g_thunk_in_call) {
    if (code == EXCEPTION_ACCESS_VIOLATION ||
        code == EXCEPTION_INT_DIVIDE_BY_ZERO ||
        code == EXCEPTION_INT_OVERFLOW ||
        code == EXCEPTION_ILLEGAL_INSTRUCTION) {
      uintptr_t eip = (uintptr_t)ep->ExceptionRecord->ExceptionAddress;
      uintptr_t gameOff = (g_hGame && eip >= (uintptr_t)g_hGame && eip < (uintptr_t)g_hGame + 0x130000u)
                              ? (eip - g_game_rebase) : 0u;
      uintptr_t comOff  = (g_hCom && eip >= (uintptr_t)g_hCom && eip < (uintptr_t)g_hCom + 0xA5000u)
                              ? (eip - g_com_rebase) : 0u;
      uint32_t avAddr = (ep->ExceptionRecord->NumberParameters >= 2)
                            ? (uint32_t)ep->ExceptionRecord->ExceptionInformation[1] : 0u;
      fprintf(stderr,
              "[k6-w2] SETUP/INIT FAULT after %u emitted: code=0x%08lX eip=%p (game=0x%08lX com=0x%08lX) addr=0x%08X\n",
              g_total_emitted, (unsigned long)code, (void *)eip,
              (unsigned long)gameOff, (unsigned long)comOff, avAddr);
      fflush(stderr);
      TerminateProcess(GetCurrentProcess(), 99);
    }
    return EXCEPTION_CONTINUE_SEARCH;
  }
  if (code == EXCEPTION_ACCESS_VIOLATION ||
      code == EXCEPTION_INT_DIVIDE_BY_ZERO ||
      code == EXCEPTION_INT_OVERFLOW ||
      code == EXCEPTION_ILLEGAL_INSTRUCTION) {
    g_thunk_in_call = 0;
    g_thunk_faulted = 1;
    g_fault_code = (uint32_t)code;
    g_fault_eip  = (uint32_t)(uintptr_t)ep->ExceptionRecord->ExceptionAddress;
    g_fault_addr = (ep->ExceptionRecord->NumberParameters >= 2)
                       ? (uint32_t)ep->ExceptionRecord->ExceptionInformation[1]
                       : 0u;
    ep->ContextRecord->Eip = (DWORD)(uintptr_t)thunk_resume;
    ep->ContextRecord->Esp = g_thunk_saved_esp;
    ep->ContextRecord->Ebp = g_thunk_saved_ebp;
    return EXCEPTION_CONTINUE_EXECUTION;
  }
  return EXCEPTION_CONTINUE_SEARCH;
}

/* ------------------------------- Deterministic Bump Allocator (matches SparseMemory113c) */

static void *bump_alloc(uint32_t dwSize) {
  if (g_in_setup_phase) {
    uint32_t p = (g_setup_top + 3u) & ~3u;
    if (p + dwSize > STAGE_BASE + STAGE_TOTAL_SIZE) {
      fprintf(stderr, "[k6-w2] setup bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 21);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_setup_top = p + dwSize;
    return (void *)(uintptr_t)p;
  } else {
    uint32_t p = (g_heap_top + 3u) & ~3u;
    if (p + dwSize > HEAP_BASE + HEAP_SIZE) {
      fprintf(stderr, "[k6-w2] heap bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 22);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_heap_top = p + dwSize;
    return (void *)(uintptr_t)p;
  }
}

static void *__fastcall stub_fog_10042(uint32_t dwSize, const char *szFile, int nLine, int nZero) {
  (void)szFile; (void)nLine; (void)nZero;
  return bump_alloc(dwSize);
}

static int __fastcall stub_fog_10043(void *pMem, const char *szFile, int nLine, int nZero) {
  (void)pMem; (void)szFile; (void)nLine; (void)nZero;
  return 1;
}

static void *__fastcall stub_fog_10045(void *pPool, uint32_t dwSize, const char *szFile, int nLine, int nZero) {
  (void)pPool; (void)szFile; (void)nLine; (void)nZero;
  return bump_alloc(dwSize);
}

static int __fastcall stub_fog_10046(void *pPool, void *pMem, const char *szFile, int nLine, int nZero) {
  (void)pPool; (void)pMem; (void)szFile; (void)nLine; (void)nZero;
  return 1;
}

static void *__fastcall stub_fog_10047(void *pPool, void *pMem, uint32_t dwSize, const char *szFile, int nLine, int nZero) {
  (void)pPool; (void)szFile; (void)nLine; (void)nZero;
  if (dwSize == 0) return NULL;
  void *np = bump_alloc(dwSize);
  if (pMem) {
    /* Conservative copy when growing D2StatList / D2Inventory grid arrays */
    memcpy(np, pMem, dwSize);
  }
  return np;
}

static void hook_module_iat_ptr(HMODULE m, void *origFn, void *hookFn) {
  if (!m || !origFn || !hookFn) return;
  uint8_t *base = (uint8_t *)m;
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
        VirtualProtect(&thunk->u1.Function, sizeof(void *), PAGE_EXECUTE_READWRITE, &oldProt);
        thunk->u1.Function = (DWORD)(uintptr_t)hookFn;
        VirtualProtect(&thunk->u1.Function, sizeof(void *), oldProt, &oldProt);
      }
    }
  }
}

static void install_fog_hooks(void) {
  struct { uint32_t ord; void *fn; } hooks[] = {
    { 10024u, (void *)(uintptr_t)stub_fog_10024 },
    { 10042u, (void *)(uintptr_t)stub_fog_10042 },
    { 10043u, (void *)(uintptr_t)stub_fog_10043 },
    { 10045u, (void *)(uintptr_t)stub_fog_10045 },
    { 10046u, (void *)(uintptr_t)stub_fog_10046 },
    { 10047u, (void *)(uintptr_t)stub_fog_10047 },
  };
  for (size_t i = 0; i < sizeof(hooks) / sizeof(hooks[0]); i++) {
    void *orig = (void *)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(hooks[i].ord));
    if (!orig) {
      fprintf(stderr, "[k6-w2] missing Fog.#%u\n", hooks[i].ord);
      TerminateProcess(GetCurrentProcess(), 23);
    }
    hook_module_iat_ptr(g_hCom, orig, hooks[i].fn);
    hook_module_iat_ptr(g_hGame, orig, hooks[i].fn);
  }
}

/* ------------------------------- PAGEIMG Loader (d2game-datatbls-113c.img) */

static void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-w2] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-w2] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  /* Make D2Common .data/.bss (0x6FDE9000..0x6FDF2FFF) writable */
  DWORD oldProt = 0;
  VirtualProtect((void *)(0x6FDE9000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-w2] short read at page %u\n", i);
      TerminateProcess(GetCurrentProcess(), 12);
    }
    uint32_t va = *(const uint32_t *)pageBuf;
    const uint8_t *data = pageBuf + 4;
    if (va >= DATATBLS_BASE && va + 4096u <= DATATBLS_BASE + DATATBLS_SIZE) {
      memcpy((void *)(uintptr_t)va, data, 4096u);
    } else if (va >= 0x6FDE9000u && va <= 0x6FDF2000u) {
      memcpy((void *)(uintptr_t)(va + g_com_rebase), data, 4096u);
    }
  }
  fclose(fp);
}

/* ------------------------------- Pre/Post Snapshot & NDJSON Emission */

static char g_pre_json[131072];

static void format_mem_runs_range(char *out, size_t cap, size_t *pLen, uint32_t startAddr, uint32_t endAddr, int *pFirst) {
  static const char hexChars[] = "0123456789abcdef";
  uint32_t a = startAddr;
  while (a < endAddr) {
    /* Find next 16-byte chunk with any non-zero byte */
    uint32_t chunkEnd = (a + 16u <= endAddr) ? (a + 16u) : endAddr;
    int nz = 0;
    for (uint32_t k = a; k < chunkEnd; k++) {
      if (U8(k) != 0u) { nz = 1; break; }
    }
    if (!nz) {
      a = chunkEnd;
      continue;
    }
    /* Coalesce contiguous non-zero 16-byte chunks (up to 512 bytes per run) */
    uint32_t runStart = a;
    uint32_t runEnd = chunkEnd;
    while (runEnd < endAddr && (runEnd - runStart) < 512u) {
      uint32_t nextEnd = (runEnd + 16u <= endAddr) ? (runEnd + 16u) : endAddr;
      int nextNz = 0;
      for (uint32_t k = runEnd; k < nextEnd; k++) {
        if (U8(k) != 0u) { nextNz = 1; break; }
      }
      if (!nextNz) break;
      runEnd = nextEnd;
    }
    uint32_t len = runEnd - runStart;
    if (*pLen + 48u + len * 2u >= cap) {
      fprintf(stderr, "[k6-w2] JSON buffer overflow\n");
      TerminateProcess(GetCurrentProcess(), 25);
    }
    *pLen += (size_t)snprintf(out + *pLen, cap - *pLen,
                              "%s{\"addr\":\"0x%08X\",\"hex\":\"",
                              (*pFirst ? "" : ","), runStart);
    *pFirst = 0;
    for (uint32_t k = runStart; k < runEnd; k++) {
      uint8_t b = U8(k);
      out[(*pLen)++] = hexChars[(b >> 4) & 0xFu];
      out[(*pLen)++] = hexChars[b & 0xFu];
    }
    out[(*pLen)++] = '"';
    out[(*pLen)++] = '}';
    out[*pLen] = '\0';
    a = runEnd;
  }
}

static void capture_stage_json(char *out, size_t cap, uint32_t setupTop) {
  size_t len = 0;
  int first = 1;
  out[len++] = '[';
  out[len] = '\0';
  format_mem_runs_range(out, cap, &len, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, &first);
  if (setupTop > STAGE_SETUP_BASE) {
    format_mem_runs_range(out, cap, &len, STAGE_SETUP_BASE, setupTop, &first);
  }
  out[len++] = ']';
  out[len] = '\0';
}

/* ------------------------------- Staged World Builders */

static void reset_case(void) {
  memset((void *)(uintptr_t)STAGE_BASE, 0, STAGE_FIXED_SIZE);
  g_in_setup_phase = 1;
  g_setup_top = STAGE_SETUP_BASE;
  g_heap_top = HEAP_BASE;

  /* Default pGame difficulty = 0, expansion = 1, dwGameFrame = 100 */
  U8(STAGE_GAME + 0x6Du)  = 0u;
  U32(STAGE_GAME + 0x70u) = 1u;
  U32(STAGE_GAME + 0xA8u) = 100u;

  /* Pre-link 2 clean 0x208-byte S2C packet nodes on STAGE_CLIENT free-list (+0x1C0) */
  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
}

static void stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  U32(pAct + 0x08u)     = 1u; /* dwTownId */
  U32(pAct + 0x10u)     = pRoom;
  U32(pAct + 0x48u)     = STAGE_DRLG0;
  U32(STAGE_DRLG0 + 0x47Cu) = pLevel;
  if (U32(STAGE_GAME + 0xBCu) == 0u) {
    U32(STAGE_GAME + 0xBCu) = pAct;
  }
  U32(pRoom + 0x10u)    = pRoomEx;
  U32(pRoom + 0x2Cu)    = pAct; /* pAct / pActUpdateFlag */
  U32(pRoom + 0x4Cu)    = 4800u; /* nSubtileX */
  U32(pRoom + 0x50u)    = 4800u; /* nSubtileY */
  U32(pRoom + 0x54u)    = 1000u; /* nSubtileWidth */
  U32(pRoom + 0x58u)    = 1000u; /* nSubtileHeight */
  U32(pRoomEx + 0x30u)  = pRoom;
  U32(pRoomEx + 0x58u)  = pLevel;
  U32(pLevel + 0x1B4u)  = STAGE_DRLG0;
  U32(pLevel + 0x1D0u)  = levelId;
}

static void stage_dynamic_path(uint32_t pUnit, uint32_t pPath, uint32_t pRoom, uint16_t x, uint16_t y) {
  U32(pUnit + 0x2Cu)  = pPath;
  U16(pPath + 0x00u)  = 0x8000u;
  U16(pPath + 0x02u)  = x;
  U16(pPath + 0x04u)  = 0x8000u;
  U16(pPath + 0x06u)  = y;
  U32(pPath + 0x1Cu)  = pRoom;   /* D2DynamicPathStrc.pRoom */
  U32(pPath + 0x30u)  = pUnit;   /* D2DynamicPathStrc.pUnit */
  U32(pPath + 0x7Cu)  = 0x1800u; /* D2DynamicPathStrc.dwVelocity */
}

static void stage_static_path(uint32_t pUnit, uint32_t pPath, uint32_t pRoom, int32_t x, int32_t y) {
  U32(pUnit + 0x2Cu) = pPath;
  U32(pPath + 0x00u) = pRoom;
  S32(pPath + 0x04u) = x;
  S32(pPath + 0x08u) = y;
  S32(pPath + 0x0Cu) = x;
  S32(pPath + 0x10u) = y;
}

static void insert_server_unit(uint32_t pGame, uint32_t pUnit) {
  uintptr_t fn = 0x6FD00310u + g_game_rebase;
  __asm__ volatile(
      "call *%%ecx\n\t"
      : "+d"(pGame), "+S"(pUnit), "+c"(fn)
      :
      : "eax", "memory", "cc");
}

static void stage_unit_common(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t uType, uint32_t classId, uint32_t guid, uint32_t mode,
    uint16_t x, uint16_t y, uint32_t seedLo) {
  U32(pUnit + 0x00u) = uType;
  U32(pUnit + 0x04u) = classId;
  U32(pUnit + 0x0Cu) = guid;
  U32(pUnit + 0x10u) = mode;
  U32(pUnit + 0x14u) = pUData;
  U8(pUnit + 0x18u)  = 0u; /* nAct */
  U32(pUnit + 0x1Cu) = STAGE_GAME;
  U32(pUnit + 0x20u) = seedLo ? seedLo : 0x12345679u;
  U32(pUnit + 0x24u) = 0x0000029Au;
  U32(pUnit + 0x28u) = seedLo ? seedLo : 0x12345679u;
  U32(pUnit + 0xC4u) = 0x00000004u; /* UNITFLAG_TARGETABLE */
  if (pPath != 0u) {
    if (uType == 2u || uType == 4u || uType == 5u) {
      stage_static_path(pUnit, pPath, pRoom, (int32_t)x, (int32_t)y);
    } else {
      stage_dynamic_path(pUnit, pPath, pRoom, x, y);
    }
  }
  if (uType == 2u && pUData != 0u) {
    uint32_t pObjectsBase = U32(0x6FDF0B94u + g_com_rebase);
    uint32_t nObjectsCnt  = U32(0x6FDF0B98u + g_com_rebase);
    if (classId < nObjectsCnt) {
      U32(pUData + 0x00u) = pObjectsBase + classId * 0x1C0u;
    }
  }
  fn_CreateStatListEx((void *)(uintptr_t)pUnit, 0u, NULL, (void *)(uintptr_t)STAGE_GAME);
}

static uint32_t attach_skill(uint32_t pUnit, int32_t skillId, int32_t lvl) {
  if (U32(pUnit + 0xA8u) == 0u) {
    void *pList = fn_AllocSkillList(NULL);
    U32(pUnit + 0xA8u) = (uint32_t)(uintptr_t)pList;
  }
  fn_SetSkillLevel((void *)(uintptr_t)pUnit, skillId, lvl, 0, 0, 0);
  uint32_t pList = U32(pUnit + 0xA8u);
  uint32_t pSk = pList ? U32(pList + 0x04u) : 0u;
  while (pSk != 0u) {
    uint32_t pTxt = U32(pSk);
    if (pTxt != 0u && S16(pTxt) == (int16_t)skillId) return pSk;
    pSk = U32(pSk + 0x04u);
  }
  return 0u;
}

/* ------------------------------- Call Execution & Vector Writer */

typedef struct {
  uint32_t eax, ecx, edx, ebx, esi, edi;
  uint32_t nargs;
  uint32_t args[MAX_STACK];
  uint32_t calleePop;
} X86CallSpec;

static X86CallSpec make_call(void) {
  X86CallSpec s;
  memset(&s, 0, sizeof(s));
  return s;
}

static FILE *g_out_fp = NULL;

static void run_and_emit(
    uint32_t canonVa,
    const char *fnName,
    int caseIdx,
    const char *label,
    const X86CallSpec *spec,
    const int64_t *tsArgs,
    uint32_t nTsArgs,
    uint32_t retMask,
    int expectAssert) {
  static char postJson[131072];
  static const char hexChars[] = "0123456789abcdef";

  uint32_t setupTop = (g_setup_top + 15u) & ~15u;
  capture_stage_json(g_pre_json, sizeof(g_pre_json), setupTop);

  /* Switch allocator to runtime heap at 0x40000000 right before target call */
  g_in_setup_phase = 0;
  g_heap_top = HEAP_BASE;

  g_thunk_target = (uint32_t)((canonVa - D2GAME_PREF_BASE) + (uintptr_t)g_hGame);
  g_thunk_in_eax = spec->eax;
  g_thunk_in_ecx = spec->ecx;
  g_thunk_in_edx = spec->edx;
  g_thunk_in_ebx = spec->ebx;
  g_thunk_in_esi = spec->esi;
  g_thunk_in_edi = spec->edi;
  g_thunk_nargs  = spec->nargs;
  for (uint32_t i = 0; i < spec->nargs; i++) {
    g_thunk_args[i] = spec->args[i];
  }
  g_thunk_out_eax = 0;
  g_thunk_faulted = 0;
  g_assert_line   = 0;
  g_thunk_in_call = 1;

  thunk_invoke();
  g_thunk_in_call = 0;

  if (g_thunk_faulted == 1) {
    uintptr_t gameOff = (g_fault_eip >= (uintptr_t)g_hGame && g_fault_eip < (uintptr_t)g_hGame + 0x130000u)
                            ? (g_fault_eip - g_game_rebase)
                            : 0;
    fprintf(stderr,
            "[k6-w2] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-w2] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-w2] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-w2] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
              fnName, canonVa, caseIdx, label, actualPop, spec->calleePop);
      TerminateProcess(GetCurrentProcess(), 33);
    }
  }

  capture_stage_json(postJson, sizeof(postJson), setupTop);

  fprintf(g_out_fp,
          "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseIdx\":%d,\"label\":\"%s\",\"tsArgs\":[",
          canonVa, fnName, caseIdx, label);
  for (uint32_t i = 0; i < nTsArgs; i++) {
    fprintf(g_out_fp, "%s%lld", (i == 0 ? "" : ","), (long long)tsArgs[i]);
  }
  uint32_t maskedRet = g_thunk_out_eax & retMask;
  fprintf(g_out_fp,
          "],\"retMask\":\"0x%08X\",\"asserted\":%s,\"assertLine\":%u,\"ret\":\"0x%08X\","
          "\"setupTop\":\"0x%08X\",\"preMem\":%s,\"postMem\":%s,\"heapTop\":\"0x%08X\",\"heapHex\":\"",
          retMask,
          (g_thunk_faulted == 2 ? "true" : "false"),
          (g_thunk_faulted == 2 ? g_assert_line : 0u),
          maskedRet,
          setupTop,
          g_pre_json,
          postJson,
          g_heap_top);
  for (uint32_t a = HEAP_BASE; a < g_heap_top; a++) {
    uint8_t b = U8(a);
    fputc(hexChars[(b >> 4) & 0xFu], g_out_fp);
    fputc(hexChars[b & 0xFu], g_out_fp);
  }
  fprintf(g_out_fp, "\"}\n");
  g_total_emitted++;
}

/* ------------------------------- Startup Discovery of Canonical Item/Object IDs */

static void discover_table_ids(void) {
  reset_case();
  uint32_t nItems   = U32(0x6FDEFB94u + g_com_rebase);
  uint32_t pItems   = U32(0x6FDEFB98u + g_com_rebase);
  uint32_t nObjects = U32(0x6FDF0B98u + g_com_rebase);
  uint32_t pObjects = U32(0x6FDF0B94u + g_com_rebase);

  U32(STAGE_UNIT2 + 0x00u) = 4u;
  U32(STAGE_UNIT2 + 0x14u) = STAGE_UDATA2;
  for (uint32_t id = 0; id < nItems; id++) {
    U32(STAGE_UNIT2 + 0x04u) = id;
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    if (!g_item_soulstone && code == 0x20737361u) g_item_soulstone = id; /* "ass " */
    if (!g_item_javelin && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x2C)) g_item_javelin = id;
    if (!g_item_bow && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x1B)) g_item_bow = id;
    if (!g_item_shield && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x33)) g_item_shield = id;
    if (!g_item_potion26 && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x26)) g_item_potion26 = id;
    if (!g_item_ring && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x0A)) g_item_ring = id;
  }

  U32(STAGE_UNIT2 + 0x00u) = 2u;
  U32(STAGE_UNIT2 + 0x14u) = STAGE_UDATA2;
  for (uint32_t oid = 0; oid < nObjects; oid++) {
    U32(STAGE_UNIT2 + 0x04u)  = oid;
    U32(STAGE_UDATA2 + 0x00u) = pObjects + oid * 0x1C0u;
    if (fn_UnitsIsDoor((void *)(uintptr_t)STAGE_UNIT2) != 0) {
      g_obj_door = oid;
      break;
    }
  }
}

/* ------------------------------- 110 Target D2Game.dll VA Suites */

static void emit_all_110_vas(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [1] 0x6FCB0EA0 MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c (fastcall ecx=pMissile, edx=dwSeed, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pMis = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t seed = 0x13579BDFu + (uint32_t)k * 101u;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 67u, 50u, 0u, 5100u, 5100u, 11u);
      U16(STAGE_PATH0 + 0x10u) = 5112u; /* wTargetX */
      U16(STAGE_PATH0 + 0x12u) = 5108u; /* wTargetY */
      U16(STAGE_UDATA0 + 0x08u) = (k == 1) ? 25u : 120u; /* totalFrames (< 0x4E vs >= 0x4E clamp) */
      U16(STAGE_UDATA0 + 0x0Au) = (k == 1) ? 25u : 120u;
    }
    c.ecx = pMis; c.edx = seed;
    ts[0] = pMis; ts[1] = seed;
    run_and_emit(0x6FCB0EA0u, "MISSILE_InitGuidedPathAndFrames_6FCB0EA0_113c", k,
                 k == 0 ? "null" : k == 1 ? "frames_25" : "clamp_0x4d", &c, ts, 2, 0u, 0);
  }

  /* [2] 0x6FCB1040 MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c (fastcall ecx=pMissile, edx=nLowSeed, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pMis = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t seed = 0x2468ACE1u + (uint32_t)k * 777u;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 67u, 51u, 0u, 5200u, 5200u, 22u);
      U16(STAGE_PATH0 + 0x10u)  = 5220u; /* wTargetX (PATH_GetFirstPointX) */
      U16(STAGE_PATH0 + 0x12u)  = 5215u; /* wTargetY (PATH_GetFirstPointY) */
      U16(STAGE_UDATA0 + 0x08u) = (k == 1) ? 20u : 90u;
      U16(STAGE_UDATA0 + 0x0Au) = (k == 1) ? 20u : 90u;
    }
    c.ecx = pMis; c.edx = seed;
    ts[0] = pMis; ts[1] = seed;
    run_and_emit(0x6FCB1040u, "MISSILES_BuildRandomizedSpiralPath_6FCB1040_113c", k,
                 k == 0 ? "null" : k == 1 ? "spiral_20" : "spiral_clamp_77", &c, ts, 2, 0u, 0);
  }

  /* [3] 0x6FCBE4F0 SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c (edi=pUnit, esi=pMissile, ebx=pWeapon, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pM = STAGE_UNIT1;
    uint32_t pW = STAGE_UNIT2;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 33u); /* Barbarian */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 3u, 10u, 2u, 0u, 5002u, 5002u, 44u);
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_javelin, 3u, 1u, 0u, 0u, 55u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x13, 120, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x19, 10, 0);
      if (k == 2) {
        attach_skill(STAGE_UNIT0, 135, 8); /* Throwing Mastery lvl 8 */
      }
    }
    c.edi = pU; c.esi = pM; c.ebx = pW;
    ts[0] = pU; ts[1] = pM; ts[2] = pW;
    run_and_emit(0x6FCBE4F0u, "SKILLS_ApplyThrowingWeaponMasteryToMissile_6FCBE4F0_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "no_mastery" : "throw_mastery_lvl8", &c, ts, 3, 0u, 0);
  }

  /* [4] 0x6FCD32E0 MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c (eax=nSkillId, ebx=pMissile, stack=[pOwnerUnit, nSkillLevel], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    int32_t skId = (k == 0) ? -1 : (k == 1 ? 999 : (k == 2 ? 36 : 47));
    int32_t skLvl = (k == 3) ? 12 : 4;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 77u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 3u, (k == 3 ? 67u : 18u), 2u, 0u, 5005u, 5005u, 88u);
    c.eax = (uint32_t)skId; c.ebx = STAGE_UNIT1;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = (uint32_t)skLvl; c.calleePop = 8u;
    ts[0] = skId; ts[1] = STAGE_UNIT1; ts[2] = STAGE_UNIT0; ts[3] = skLvl;
    run_and_emit(0x6FCD32E0u, "MISSILE_ConfigureSkillRangeAndFrames_6FCD32E0_113c", k,
                 k == 0 ? "neg_skill" : k == 1 ? "oob_skill" : k == 2 ? "firebolt_lvl4" : "fireball_lvl12", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [5] 0x6FC8F740 MISSILE_SendSyncPacket73_6FC8F740_113c (ecx=pGame, esi=pMissile, stack=[pClient, bIncludeTargetPos], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pMis = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t incTgt = (k == 2) ? 1u : 0u;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 7u, 1u, 5100u, 5100u, 91u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 39u, 99u, 0u, 5104u, 5106u, 92u);
      U32(STAGE_UNIT0 + 0x94u) = 0u; /* ownerType = player */
      U32(STAGE_UNIT0 + 0x98u) = 7u; /* ownerGuid = 7 */
      U32(STAGE_UNIT0 + 0xC8u) = 0x400u; /* bit 10 set */
      U16(STAGE_PATH0 + 0x10u) = 5120u;
      U16(STAGE_PATH0 + 0x12u) = 5130u;
      U16(STAGE_UDATA0 + 0x0Cu) = 5u;  /* skilllvl */
      U16(STAGE_UDATA0 + 0x0Au) = 30u; /* remainingFrames */
    }
    c.ecx = STAGE_GAME; c.esi = pMis;
    c.nargs = 2; c.args[0] = STAGE_CLIENT; c.args[1] = incTgt; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pMis; ts[2] = STAGE_CLIENT; ts[3] = incTgt;
    run_and_emit(0x6FC8F740u, "MISSILE_SendSyncPacket73_6FC8F740_113c", k,
                 k == 0 ? "null" : k == 1 ? "pkt73_no_tgt" : "pkt73_with_tgt", &c, ts, 4, 0u, 0);
  }

  /* [6] 0x6FCF22C0 ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c (edi=pSkill, stack=[pUnit], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 101u);
    uint32_t pSk = 0u;
    if (k == 1) pSk = attach_skill(STAGE_UNIT0, 36, 3); /* Fire Bolt (not bow) */
    if (k == 2) pSk = attach_skill(STAGE_UNIT0, 6, 5);  /* Magic Arrow (itypea1=47 -> 0x30, bAnim=2) */
    c.edi = pSk; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = pSk; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCF22C0u, "ITEMS_IsUsableRangedMissileWeaponSkill_6FCF22C0_113c", k,
                 k == 0 ? "null_skill" : k == 1 ? "non_bow_skill" : "magic_arrow", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [7] 0x6FCFAE70 SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c (edi=pUnit, stack=[nManaGain], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 111u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 100 << 8, 0); /* maxmana */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 60 << 8, 0);  /* mana */
    int32_t gain = (k == 0) ? -256 : (k == 1 ? (20 << 8) : (70 << 8));
    c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = (uint32_t)gain; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = gain;
    run_and_emit(0x6FCFAE70u, "SUNITDMG_AddManaToUnitClamped_6FCFAE70_113c", k,
                 k == 0 ? "non_positive" : k == 1 ? "partial_gain" : "clamped_to_max", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [8] 0x6FCFCE00 SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c (eax=pAttacker, esi=nSkillId, ebx=nSkillLevel, stack=[pDmg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 0x55AA1234u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 80, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 90, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 15, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 30, 0);
    int32_t skId = (k == 0) ? -1 : (k == 1 ? 7 : 11); /* Fire Arrow vs Cold Arrow */
    int32_t skLvl = 6;
    c.eax = STAGE_UNIT0; c.esi = (uint32_t)skId; c.ebx = (uint32_t)skLvl;
    c.nargs = 1; c.args[0] = STAGE_DMG; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = skId; ts[2] = skLvl; ts[3] = STAGE_DMG;
    run_and_emit(0x6FCFCE00u, "SUNITDMG_RollSkillPhysAndElemDamage_6FCFCE00_113c", k,
                 k == 0 ? "neg_skill" : k == 1 ? "fire_arrow" : "cold_arrow", &c, ts, 4, 0u, 0);
  }

  /* [9] 0x6FCFAED0 SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c (ecx=pGame, edx=pMember, stack=[pExpCtx], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5100u, 5100u, 121u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 12u, 5110u, 5110u, 122u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 24, 0); /* STAT_LEVEL = 24 */
    U32(STAGE_SCRATCH + 0x00u) = STAGE_UNIT1; /* pDefender */
    U32(STAGE_SCRATCH + 0x24u) = 0u; /* count */
    U32(STAGE_SCRATCH + 0x28u) = 0u; /* sumLevels */
    uint32_t pMem = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 2) stage_dynamic_path(STAGE_UNIT0, STAGE_PATH0, STAGE_ROOM0, 7000u, 7000u); /* out of 2-screen exp range */
    c.ecx = STAGE_GAME; c.edx = pMem;
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pMem; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FCFAED0u, "SUNITDMG_CollectPartyExpMemberCallback_6FCFAED0_113c", k,
                 k == 0 ? "null_member" : k == 1 ? "in_range_add" : "out_of_range", &c, ts, 3, 0u, 0);
  }

  /* [10] 0x6FCCCA70 ITEMMODS_ApplyHealAfterDemonKill_6FCCCA70_113c (stdcall [pAttacker, pDefender, pDamage, nStatParam, nUnused], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 131u);
    /* classId 0 = Fallen (demon), classId 13 = Skeleton (undead, not demon) */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, (k == 1 ? 13u : 0u), 2u, 12u, 5002u, 5002u, 132u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 120 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 139, 15, 0); /* STAT_ITEM_DEMONHEAL */
    uint32_t pAtk = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t statParam = (139u << 16);
    c.nargs = 5; c.args[0] = pAtk; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_DMG; c.args[3] = statParam; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = pAtk; ts[1] = STAGE_UNIT1; ts[2] = STAGE_DMG; ts[3] = statParam; ts[4] = 0;
    run_and_emit(0x6FCCCA70u, "ITEMMODS_ApplyHealAfterDemonKill_6FCCCA70_113c", k,
                 k == 0 ? "null_atk" : k == 1 ? "non_demon" : "demon_heal", &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [11] 0x6FCCCB10 ITEMMODS_ApplyHealAfterKill_6FCCCB10_113c (stdcall 5 args, ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 141u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 13u, 2u, 12u, 5002u, 5002u, 142u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 2 ? 195 : 100) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 86, 12, 0); /* STAT_ITEM_HEALAFTERKILL */
    uint32_t pAtk = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t statParam = (86u << 16);
    c.nargs = 5; c.args[0] = pAtk; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_DMG; c.args[3] = statParam; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = pAtk; ts[1] = STAGE_UNIT1; ts[2] = STAGE_DMG; ts[3] = statParam; ts[4] = 0;
    run_and_emit(0x6FCCCB10u, "ITEMMODS_ApplyHealAfterKill_6FCCCB10_113c", k,
                 k == 0 ? "null_atk" : k == 1 ? "normal_heal" : "clamped_max_heal", &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [12] 0x6FCCCE60 ITEMMODS_ApplyKnockback_6FCCCE60_113c (stdcall 5 args, ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 0x00000001u + (uint32_t)k * 97u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, (k == 2 ? 0u : 50u), 2u, 1u, 5003u, 5003u, 152u);
    if (k > 0) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 81, 1, 0); /* STAT_ITEM_KNOCKBACK */
    uint32_t statParam = (81u << 16);
    c.nargs = 5; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_DMG; c.args[3] = statParam; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_DMG; ts[3] = statParam; ts[4] = 0;
    run_and_emit(0x6FCCCE60u, "ITEMMODS_ApplyKnockback_6FCCCE60_113c", k,
                 k == 0 ? "no_kb_stat" : k == 1 ? "kb_roll_a" : "kb_small_mon", &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [13] 0x6FCCF2E0 SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c (fastcall ecx=pGame, edx=ev, stack 5, ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 0x11223344u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 12u, 5003u, 5003u, 162u);
    if (k == 1) U8(STAGE_UDATA1 + 0x16u) = 0x04u; /* champion flag -> skip */
    if (k >= 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 112, (k == 2 ? 128 : 50), 0); /* STAT_ITEM_HOWL */
    uint32_t statAndLayer = (112u << 16);
    c.ecx = STAGE_GAME; c.edx = 0u;
    c.nargs = 5; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_UNIT1; c.args[2] = 0u; c.args[3] = statAndLayer; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = 0; ts[2] = STAGE_UNIT0; ts[3] = STAGE_UNIT1; ts[4] = 0; ts[5] = statAndLayer; ts[6] = 0;
    run_and_emit(0x6FCCF2E0u, "SUNITDMG_ProcHitMonsterFleeOrTaunt_6FCCF2E0_113c", k,
                 k == 0 ? "zero_chance" : k == 1 ? "champ_immune" : "proc_roll_hit", &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [14] 0x6FCD13B0 MONAI_IsUnitValidHostileCombatTarget_6FCD13B0_113c (edx=pTarget, stack=[pGame, pSelf], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 171u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 2u, (k == 1 ? 17u : 1u), 5004u, 5004u, 172u);
    uint32_t pTgt = (k == 0) ? 0u : STAGE_UNIT1;
    c.edx = pTgt; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = pTgt; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCD13B0u, "MONAI_IsUnitValidHostileCombatTarget_6FCD13B0_113c", k,
                 k == 0 ? "null_target" : k == 1 ? "dead_player" : "live_hostile_player", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [15] 0x6FCD22D0 ARENA_GetModeByte_6FCD22D0_113c (eax=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k > 0) {
      U32(STAGE_GAME + 0x1D28u) = STAGE_SCRATCH;
      U8(STAGE_SCRATCH + 0x0Cu) = (k == 1) ? 0u : 0x5Au;
    }
    c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FCD22D0u, "ARENA_GetModeByte_6FCD22D0_113c", k,
                 k == 0 ? "assert_null_arena" : k == 1 ? "mode_0" : "mode_0x5a", &c, ts, 1, 0xFFFFFFFFu, k == 0);
  }

  /* [16] 0x6FCD2480 ARENA_FreePlayerArenaUnit_6FCD2480_113c (eax=pPlayer, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 181u);
      if (k == 2) U32(STAGE_UDATA0 + 0x34u) = STAGE_SCRATCH;
    } else {
      U32(STAGE_UNIT0 + 0x00u) = 1u; /* monster -> UNITS_GetPlayerData == 0 -> assert 0x52 */
    }
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCD2480u, "ARENA_FreePlayerArenaUnit_6FCD2480_113c", k,
                 k == 0 ? "assert_non_player" : k == 1 ? "already_null" : "free_and_clear", &c, ts, 2, 0u, k == 0);
  }

  /* [17] 0x6FCD24D0 ARENA_AllocPlayerArenaUnit_6FCD24D0_113c (eax=pGame, stack=[pPlayer], ret 4) */
  for (int k = 0; k < 2; k++) {
    reset_case();
    c = make_call();
    if (k == 0) {
      U32(STAGE_UNIT0 + 0x00u) = 1u; /* non-player -> assert 0x4A */
    } else {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 191u);
    }
    c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCD24D0u, "ARENA_AllocPlayerArenaUnit_6FCD24D0_113c", k,
                 k == 0 ? "assert_non_player" : "alloc_8b", &c, ts, 2, 0u, k == 0);
  }

  /* [18] 0x6FCD2560 ARENA_AllocGameArenaCtrl_6FCD2560_113c (edi=pGame, eax=dwFlags, stack=[bMode], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t fl = (k == 0) ? 0u : (k == 1 ? 0xFFFFFFFFu : 0x00100105u);
    uint32_t md = (uint32_t)(k * 3);
    c.edi = STAGE_GAME; c.eax = fl; c.nargs = 1; c.args[0] = md; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = fl; ts[2] = md;
    run_and_emit(0x6FCD2560u, "ARENA_AllocGameArenaCtrl_6FCD2560_113c", k,
                 k == 0 ? "zero_flags" : k == 1 ? "mask_all_ones" : "mixed_flags", &c, ts, 3, 0u, 0);
  }

  /* [19] 0x6FCD2620 ARENA_CheckFlagBit8_6FCD2620_113c (eax=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k > 0) {
      U32(STAGE_GAME + 0x1D28u) = STAGE_SCRATCH;
      U32(STAGE_SCRATCH + 0x08u) = (k == 1) ? 0x0FFu : 0x100u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCD2620u, "ARENA_CheckFlagBit8_6FCD2620_113c", k,
                 k == 0 ? "assert_null" : k == 1 ? "bit8_clear" : "bit8_set", &c, ts, 1, 0xFFFFFFFFu, k == 0);
  }

  /* [20] 0x6FD00040 SUNIT_SetPlayerClientPtr_6FD00040_113c (eax=pUnit, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 1) U32(STAGE_UNIT0 + 0x00u) = 1u; /* monster -> assert 0x4bc */
    if (k == 2) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 201u);
    }
    c.eax = pU; c.nargs = 1; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = pU; ts[1] = STAGE_CLIENT;
    run_and_emit(0x6FD00040u, "SUNIT_SetPlayerClientPtr_6FD00040_113c", k,
                 k == 0 ? "assert_null_unit" : k == 1 ? "assert_non_player" : "set_client_ptr", &c, ts, 2, 0u, k < 2);
  }

  /* [21] 0x6FD00BD0 SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c (esi=pUnit, ecx=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 211u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 9u, 1u, 5005u, 5005u, 212u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT0; /* self target -> returns 0 */
      U32(STAGE_PATH0 + 0x5Cu) = 0u;
      U32(STAGE_PATH0 + 0x60u) = 1u;
    } else if (k == 2) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      U32(STAGE_PATH0 + 0x5Cu) = 1u;
      U32(STAGE_PATH0 + 0x60u) = 9u;
    }
    c.esi = STAGE_UNIT0; c.ecx = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FD00BD0u, "SUNIT_GetValidatedPathTargetUnit_6FD00BD0_113c", k,
                 k == 0 ? "no_target" : k == 1 ? "self_target_zero" : "valid_target", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [22] 0x6FC89650 OBJECTS_GrantUnitSkillPoints_6FC89650_113c (fastcall ecx=pGame, edx=pUnit, stack=[nDelta], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 221u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 5, 3, 0);
    int32_t delta = (k == 0) ? 1 : (k == 1 ? 2 : 0);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = (uint32_t)delta; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = delta;
    run_and_emit(0x6FC89650u, "OBJECTS_GrantUnitSkillPoints_6FC89650_113c", k,
                 k == 0 ? "grant_1" : k == 1 ? "grant_2" : "grant_0", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [23] 0x6FC89B00 SKILLS_CalcUnitSkillToHit_6FC89B00_113c (eax=pWeapon, ecx=pSkill, edx=pUnit, stack=[pOutToHit, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 231u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 100, 0);   /* DEX */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 150, 0);  /* TOHIT */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 119, 25, 0);  /* ITEM_TOHIT_PERCENT */
    uint32_t pSk = (k == 0) ? 0u : attach_skill(STAGE_UNIT0, 126, 5); /* Bash */
    uint32_t pWeap = 0u;
    if (k == 2 && g_item_potion26 != 0u) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_potion26, 5u, 1u, 0u, 0u, 232u);
      pWeap = STAGE_UNIT2;
    }
    c.eax = pWeap; c.ecx = pSk; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = pWeap; ts[1] = pSk; ts[2] = STAGE_UNIT0; ts[3] = STAGE_SCRATCH; ts[4] = 5;
    run_and_emit(0x6FC89B00u, "SKILLS_CalcUnitSkillToHit_6FC89B00_113c", k,
                 k == 0 ? "assert_null_skill" : k == 1 ? "bash_unarmed" : "throwing_potion_zero_base", &c, ts, 5, 0u, k == 0);
  }

  /* [24] 0x6FCB1240 SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c (ebx=pUnit, edi=nSkillId, stack=[nLevel], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 241u);
    int32_t skId = (k == 0) ? -1 : 254; /* Tiger Strike: auraState=122, passiveStat=318 */
    if (k == 2) {
      void *pSub = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
      fn_SetStatListState(pSub, 122);
      fn_SetStatIfValid(pSub, 318, 2, 0u); /* charge stage 2 */
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 0);
    }
    c.ebx = STAGE_UNIT0; c.edi = (uint32_t)skId; c.nargs = 1; c.args[0] = 5u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = skId; ts[2] = 5;
    run_and_emit(0x6FCB1240u, "SKILLS_EvalChargeScaledCalcByStage_6FCB1240_113c", k,
                 k == 0 ? "neg_skill" : k == 1 ? "tiger_strike_no_state" : "tiger_strike_stage2", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [25] 0x6FCB1400 SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c (stdcall [pUnit, pStatList, pDmg], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 251u);
    void *pSub = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
    if (k > 0) {
      fn_SetStatIfValid(pSub, 0x15E, 254, 0u); /* Tiger Strike */
      fn_SetStatIfValid(pSub, 0x15F, 6, 0u);   /* slvl 6 */
      fn_SetStatIfValid(pSub, 318, (k == 1 ? 1 : 3), 0u); /* stage 1 vs stage 3 */
    } else {
      fn_SetStatIfValid(pSub, 0x15E, -1, 0u);
    }
    U32(STAGE_DMG + 0x38u) = 50u;
    uint32_t pListAddr = (uint32_t)(uintptr_t)pSub;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pListAddr; c.args[2] = STAGE_DMG; c.calleePop = 0xCu;
    ts[0] = STAGE_UNIT0; ts[1] = pListAddr; ts[2] = STAGE_DMG;
    run_and_emit(0x6FCB1400u, "SKILLS_ApplyDelayedChargeAttackRatingBonus_6FCB1400_113c", k,
                 k == 0 ? "neg_skill" : k == 1 ? "stage1_bonus" : "stage3_bonus", &c, ts, 3, 0u, 0);
  }

  /* [26] 0x6FCB1610 SKILLS_RollMonsterConversionChance_6FCB1610_113c (esi=pMonster, stack=[pAttacker, nChance], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 261u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 3u, 2u, 1u, 5002u, 5002u, 0x778899AAu + (uint32_t)k);
    uint32_t pMon = (k == 0) ? 0u : STAGE_UNIT0;
    int32_t chance = (k == 1) ? 0 : 95;
    c.esi = pMon; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = (uint32_t)chance; c.calleePop = 8u;
    ts[0] = pMon; ts[1] = STAGE_UNIT1; ts[2] = chance;
    run_and_emit(0x6FCB1610u, "SKILLS_RollMonsterConversionChance_6FCB1610_113c", k,
                 k == 0 ? "null_mon" : k == 1 ? "chance_0" : "chance_95", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [27] 0x6FCB1B40 SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 271u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 1u, 5005u, 5005u, 272u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT0; U32(STAGE_PATH0 + 0x5Cu) = 0u; U32(STAGE_PATH0 + 0x60u) = 1u;
    } else if (k == 2) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1; U32(STAGE_PATH0 + 0x5Cu) = 1u; U32(STAGE_PATH0 + 0x60u) = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FCB1B40u, "SKILLS_SrvSt25_ValidateDistinctTarget_6FCB1B40_113c", k,
                 k == 0 ? "null_target" : k == 1 ? "self_target" : "distinct_target", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [28] 0x6FCB2060 SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c (ecx=pGame, edx=pUnit, stack 2, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1 ? 1u : 2u)); /* town lvl 1 vs Blood Moor lvl 2 */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 281u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0 ? 2u : 1u), 0u, 2u, 1u, 5005u, 5005u, 282u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    U32(STAGE_PATH0 + 0x5Cu) = (k == 0 ? 2u : 1u);
    U32(STAGE_PATH0 + 0x60u) = 2u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FCB2060u, "SKILLS_SrvSt22_ValidateNonTownPlayerOrMonsterTarget_6FCB2060_113c", k,
                 k == 0 ? "object_target_reject" : k == 1 ? "town_reject" : "wilderness_monster_ok", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [29] 0x6FCB6600 PETS_FindPetTypeByGuid_6FCB6600_113c (eax=pPlayer, ebx=dwPetGuid, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    if (k == 0) {
      U32(STAGE_UNIT0 + 0x00u) = 1u; /* assert 0x3dc */
    } else {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 291u);
      if (k >= 2) {
        uint32_t pBuckets = STAGE_PETCTRL + 0x10u; /* 20 * 12 = 240 bytes */
        uint32_t pNode    = STAGE_PETCTRL + 0x120u;
        U32(STAGE_UDATA0 + 0x44u) = STAGE_PETCTRL;
        U32(STAGE_PETCTRL + 0x00u) = pBuckets;
        U32(pBuckets + 4u * 12u) = pNode; /* petType 4 */
        U32(pNode + 0x04u) = 777u;
      }
    }
    uint32_t guid = (k == 3) ? 777u : 999u;
    c.eax = STAGE_UNIT0; c.ebx = guid;
    ts[0] = STAGE_UNIT0; ts[1] = guid;
    run_and_emit(0x6FCB6600u, "PETS_FindPetTypeByGuid_6FCB6600_113c", k,
                 k == 0 ? "assert_non_player" : k == 1 ? "null_pets" : k == 2 ? "not_found" : "found_type4", &c, ts, 2, 0xFFFFFFFFu, k == 0);
  }

  /* [30] 0x6FCB67B0 SUMMON_GetFirstPetGuidForType_6FCB67B0_113c (eax=pPlayer, esi=nPetType, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    int32_t petType = (k == 2) ? 99 : 4;
    if (k == 0) {
      U32(STAGE_UNIT0 + 0x00u) = 1u; /* assert 0x171 */
    } else {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 301u);
      if (k >= 2) {
        uint32_t pBuckets = STAGE_PETCTRL + 0x10u;
        uint32_t pNode    = STAGE_PETCTRL + 0x120u;
        U32(STAGE_UDATA0 + 0x44u) = STAGE_PETCTRL;
        U32(STAGE_PETCTRL + 0x00u) = pBuckets;
        U32(pBuckets + 4u * 12u) = pNode;
        U32(pNode + 0x04u) = 0xCAFEBABEu;
      }
    }
    c.eax = STAGE_UNIT0; c.esi = (uint32_t)petType;
    ts[0] = STAGE_UNIT0; ts[1] = petType;
    run_and_emit(0x6FCB67B0u, "SUMMON_GetFirstPetGuidForType_6FCB67B0_113c", k,
                 k == 0 ? "assert_non_player" : k == 1 ? "null_pets" : k == 2 ? "oob_type" : "found_guid", &c, ts, 2, 0xFFFFFFFFu, k == 0);
  }

  /* [31] 0x6FCB6810 PETS_SendPacket7A_UnsummonPet_6FCB6810_113c (edx=pPlayer, stack=[pPetNode], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pNode = STAGE_PETCTRL + 0x120u;
    U32(pNode + 0x00u) = 0x11223344u;
    U32(pNode + 0x04u) = 0x55667788u;
    U16(pNode + 0x08u) = 363u;
    U8(pNode + 0x0Cu)  = 4u;
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 311u);
      if (k == 2) U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    }
    c.edx = pPlr; c.nargs = 1; c.args[0] = pNode; c.calleePop = 4u;
    ts[0] = pPlr; ts[1] = pNode;
    run_and_emit(0x6FCB6810u, "PETS_SendPacket7A_UnsummonPet_6FCB6810_113c", k,
                 k == 0 ? "null_player" : k == 1 ? "null_client" : "queued_pkt7a", &c, ts, 2, 0u, 0);
  }

  /* [32] 0x6FCB6A40 PETS_GetFirstPetUnitByType_6FCB6A40_113c (eax=pPlayer, esi=nPetType, ebx=bIncludeFlag0, edi=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 321u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 363u, 88u, 1u, 5004u, 5004u, 322u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pBuckets = STAGE_PETCTRL + 0x10u;
    uint32_t pNode    = STAGE_PETCTRL + 0x120u;
    U32(STAGE_UDATA0 + 0x44u)  = STAGE_PETCTRL;
    U32(STAGE_PETCTRL + 0x00u) = pBuckets;
    U32(pBuckets + 4u * 12u)   = pNode;
    U8(pNode + 0x00u)          = 1u; /* flag bit 0 set */
    U32(pNode + 0x04u)         = 88u;
    int32_t petType = (k == 0) ? -1 : 4;
    uint32_t bInc   = (k == 2) ? 1u : 0u;
    c.eax = STAGE_UNIT0; c.esi = (uint32_t)petType; c.ebx = bInc; c.edi = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = petType; ts[2] = bInc; ts[3] = STAGE_GAME;
    run_and_emit(0x6FCB6A40u, "PETS_GetFirstPetUnitByType_6FCB6A40_113c", k,
                 k == 0 ? "neg_type" : k == 1 ? "skip_flag0" : "include_flag0_hit", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [33] 0x6FCB8390 SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c (edx=pUnit, ecx=pGame, stack 2, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 331u);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      if (k == 2 && g_item_shield != 0u) {
        stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_shield, 10u, 1u, 0u, 0u, 332u);
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 72, 20, 0); /* durability */
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 73, 20, 0); /* maxdurability */
        fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT2, 4); /* right arm slot 4 */
      }
    }
    c.edx = STAGE_UNIT0; c.ecx = STAGE_GAME; c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FCB8390u, "SKILLS_SrvSt36_HasEquippedShield_6FCB8390_113c", k,
                 k == 0 ? "null_inv" : k == 1 ? "empty_inv" : "shield_equipped", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [34] 0x6FCB88B0 SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c (edi=nSkillId, ebx=pTarget, stack=[pCaster, nSkillLevel, bRollChance], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 0xABCDEF01u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 1u, 5003u, 5003u, 342u);
    int32_t skId = (k == 0) ? -1 : 116; /* Conversion = 116 */
    uint32_t bRoll = (k == 2) ? 1u : 0u;
    c.edi = (uint32_t)skId; c.ebx = STAGE_UNIT1;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = 10u; c.args[2] = bRoll; c.calleePop = 0xCu;
    ts[0] = skId; ts[1] = STAGE_UNIT1; ts[2] = STAGE_UNIT0; ts[3] = 10; ts[4] = bRoll;
    run_and_emit(0x6FCB88B0u, "SKILLS_CanConvertMonsterAndRollChance_6FCB88B0_113c", k,
                 k == 0 ? "neg_skill" : k == 1 ? "no_roll_check" : "with_roll_check", &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [35] 0x6FCBC9A0 SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c (eax=pMonster, ecx=nMode, stack=[bCheckBossFlag], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 351u);
    if (k == 2) U8(STAGE_UDATA0 + 0x16u) = 0x02u; /* boss flag */
    int32_t mode = (k == 0) ? 1 : 0x0B;
    uint32_t chkBoss = (k >= 2) ? 1u : 0u;
    uint32_t pMon = (k == 3) ? 0u : STAGE_UNIT0;
    c.eax = pMon; c.ecx = (uint32_t)mode; c.nargs = 1; c.args[0] = chkBoss; c.calleePop = 4u;
    ts[0] = pMon; ts[1] = mode; ts[2] = chkBoss;
    run_and_emit(0x6FCBC9A0u, "SKILLS_CanMonsterReviveOrTeleportInMode_6FCBC9A0_113c", k,
                 k == 0 ? "mode1_always_ok" : k == 1 ? "mode11_no_boss_chk" : k == 2 ? "mode11_boss_blocked" : "mode11_null_mon", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [36] 0x6FCBCA00 SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c (edx=pSource, stack=[pCand, pBestCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 361u); /* Fallen */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, (k == 1 ? 13u : 1u), 2u, 1u, 5003u, 5004u, 362u); /* Skeleton vs Carver (same baseId 0!) */
    U32(STAGE_SCRATCH + 0x00u) = 0u;
    U32(STAGE_SCRATCH + 0x04u) = 100u;
    uint32_t pCand = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = pCand; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = pCand; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FCBCA00u, "SKILLS_FindClosestSameBaseMonsterCallback_6FCBCA00_113c", k,
                 k == 0 ? "same_ptr_skip" : k == 1 ? "diff_base_skip" : "same_base_update", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [37] 0x6FCBE330 SKILLS_ComputeMercSkillDamageAndToHit_6FCBE330_113c (esi=nSkillId, edi=pUnit, stack=[pOut], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 271u, 1u, 1u, 5000u, 5000u, 371u);
    int32_t skId = (k == 0) ? 10 : 126; /* Jab=10, Bash=126 */
    attach_skill(STAGE_UNIT0, skId, (k == 2 ? 9 : 3));
    c.esi = (uint32_t)skId; c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = skId; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FCBE330u, "SKILLS_ComputeMercSkillDamageAndToHit_6FCBE330_113c", k,
                 k == 0 ? "jab_lvl3" : k == 1 ? "bash_lvl3" : "bash_lvl9", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [38] 0x6FCBE730 SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c (eax=pUnit, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 1) stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 0u, 1u, 1u, 1u, 0u, 0u, 381u); /* Sorceress */
    if (k == 2) stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 1u, 0u, 1u, 1u, 0u, 0u, 382u); /* Fallen */
    if (k == 3) stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 2u, 0u, 1u, 0u, 0u, 0u, 383u); /* Object -> fallback 0x600 */
    c.eax = pU; ts[0] = pU;
    run_and_emit(0x6FCBE730u, "SKILLS_GetUnitBaseWalkVelocityShifted8_6FCBE730_113c", k,
                 k == 0 ? "null_default" : k == 1 ? "player_sorc" : k == 2 ? "monster_fallen" : "object_default", &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [39] 0x6FCBE970 SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c (eax=nSkillLevel, ecx=nSkillId, edx=pSkillsTxt, stack=[pGame, pUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 391u);
    uint32_t sgpt = U32(0x6FDE9E1Cu + g_com_rebase);
    uint32_t pSkillsBase = U32(sgpt + 0xB98u);
    int32_t skId = 41; /* Inferno */
    uint32_t pSkillsTxt = pSkillsBase + (uint32_t)skId * 0x23Cu;
    U32(STAGE_GAME + 0xA8u) = (k == 0) ? 0u : (k == 1 ? 103u : 250u);
    int32_t skLvl = (k == 2) ? 10 : 1;
    c.eax = (uint32_t)skLvl; c.ecx = (uint32_t)skId; c.edx = pSkillsTxt;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = skLvl; ts[1] = skId; ts[2] = pSkillsTxt; ts[3] = STAGE_GAME; ts[4] = STAGE_UNIT0;
    run_and_emit(0x6FCBE970u, "SKILLS_CalcNextChannelTriggerFrame_6FCBE970_113c", k,
                 k == 0 ? "frame_0" : k == 1 ? "frame_103" : "frame_250_lvl10", &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [40] 0x6FCBE9B0 SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c (eax=nSkillId, edx=nDuration, esi=pDmg, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    int32_t skId = (k == 0) ? -1 : (k == 1 ? 11 : (k == 2 ? 15 : 139)); /* Cold(4), Pois(5), Stun(9) */
    uint32_t dur = 75u + (uint32_t)k * 25u;
    c.eax = (uint32_t)skId; c.edx = dur; c.esi = STAGE_DMG;
    ts[0] = skId; ts[1] = dur; ts[2] = STAGE_DMG;
    run_and_emit(0x6FCBE9B0u, "SKILLS_SetElemDurationInDamageData_6FCBE9B0_113c", k,
                 k == 0 ? "neg_skill" : k == 1 ? "etype4_cold" : k == 2 ? "etype5_pois" : "etype9_stun", &c, ts, 3, 0u, 0);
  }

  /* [41] 0x6FCBEB30 SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c (eax=nSkillId, edx=pUnit, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, (k == 3 ? 1u : 0u), (k == 1 ? 1u : 4u), 1u, 1u, 0u, 0u, 411u);
    }
    int32_t skId = 36; /* Fire Bolt = Sorceress (class 1) */
    c.eax = (uint32_t)skId; c.edx = pU;
    ts[0] = skId; ts[1] = pU;
    run_and_emit(0x6FCBEB30u, "SKILLS_CheckPlayerClassMatchesSkillCharClass_6FCBEB30_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "sorc_match" : k == 2 ? "barb_mismatch" : "monster_reject", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [42] 0x6FCBED20 SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c (ecx=pUnit, eax=nManaCostFixed, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 421u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 150 << 8, 0); /* HP */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0); /* MaxHP */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, (k == 1 ? 5 : 50) << 8, 0); /* Mana */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 100 << 8, 0); /* MaxMana */
      if (k == 3) {
        void *pSub = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
        fn_SetStatListState(pSub, 0x72);
        U32((uintptr_t)pSub + 0x1Cu) = 36u;
        fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 0);
        fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x72, 1); /* Blood Mana */
      }
    }
    int32_t cost = 10 << 8;
    c.ecx = pU; c.eax = (uint32_t)cost;
    ts[0] = pU; ts[1] = cost;
    run_and_emit(0x6FCBED20u, "SKILLS_ConsumeSkillManaOrBloodMana_6FCBED20_113c", k,
                 k == 0 ? "null_unit_ok" : k == 1 ? "insufficient_mana" : k == 2 ? "deduct_mana" : "blood_mana_hp", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [43] 0x6FCBED70 SKILLS_TargetRingScanCallback_6FCBED70_113c (fastcall ecx=pFindData, edx=pCandidateUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pFind = STAGE_SCRATCH;
    uint32_t pCtx  = STAGE_SCRATCH + 0x40u;
    U32(pFind + 0x0Cu) = pCtx;
    U32(pCtx + 0x04u)  = 50u; /* bestAfterGuid */
    U32(pCtx + 0x0Cu)  = 20u; /* minGuid */
    U32(pCtx + 0x10u)  = 10u; /* prevGuid */
    U32(pCtx + 0x14u)  = 0u;  /* count */
    uint32_t pCand = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) U32(STAGE_UNIT0 + 0x0Cu) = (k == 1) ? 25u : 5u;
    c.ecx = pFind; c.edx = pCand;
    ts[0] = pFind; ts[1] = pCand;
    run_and_emit(0x6FCBED70u, "SKILLS_TargetRingScanCallback_6FCBED70_113c", k,
                 k == 0 ? "null_cand" : k == 1 ? "better_after_guid" : "new_min_guid", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [44] 0x6FCBEDB0 SKILLS_FindClosestUnitCallback_6FCBEDB0_113c (fastcall ecx=pFindArg, edx=pCandidateUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pFind = STAGE_SCRATCH;
    uint32_t pCtx  = STAGE_SCRATCH + 0x40u;
    U32(pFind + 0x0Cu) = pCtx;
    U32(pCtx + 0x04u)  = (k == 2) ? 10u : 500u; /* bestDistSq */
    U32(pCtx + 0x08u)  = 5000u; /* originX */
    U32(pCtx + 0x0Cu)  = 5000u; /* originY */
    U32(pCtx + 0x10u)  = 0u;    /* pfnFilter = NULL */
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0 ? 2u : 1u), 0u, 7u, 1u, 5006u, 5008u, 441u);
    c.ecx = pFind; c.edx = STAGE_UNIT0;
    ts[0] = pFind; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCBEDB0u, "SKILLS_FindClosestUnitCallback_6FCBEDB0_113c", k,
                 k == 0 ? "static_obj_closer" : k == 1 ? "dyn_mon_closer" : "farther_than_best", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [45] 0x6FCBF1A0 SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c (ebx=pUnit, eax=nSkillId, stack=[pDmg, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 0x13572468u + (uint32_t)k);
    U32(STAGE_DMG + 0x08u) = 256u;
    int32_t skId = (k == 0) ? -1 : 84; /* Bone Spear / Tornado / phys skill (or 91/126) */
    if (k == 2) skId = 67; /* Teeth */
    c.ebx = STAGE_UNIT0; c.eax = (uint32_t)skId;
    c.nargs = 2; c.args[0] = STAGE_DMG; c.args[1] = 8u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = skId; ts[2] = STAGE_DMG; ts[3] = 8;
    run_and_emit(0x6FCBF1A0u, "SKILLS_RollAndAddSkillPhysDamage_6FCBF1A0_113c", k,
                 k == 0 ? "neg_skill" : k == 1 ? "skill_84" : "skill_67", &c, ts, 4, 0u, 0);
  }

  /* [46] 0x6FCBF210 SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c (eax=nSkillId, edi=pAttacker, stack=[pDmg, nSkillLevel], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 0x24681357u + (uint32_t)k);
    int32_t skId = (k == 0) ? -1 : (k == 1 ? 36 : (k == 2 ? 49 : 39)); /* Fire Bolt, Lightning, Ice Bolt */
    c.eax = (uint32_t)skId; c.edi = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_DMG; c.args[1] = 6u; c.calleePop = 8u;
    ts[0] = skId; ts[1] = STAGE_UNIT0; ts[2] = STAGE_DMG; ts[3] = 6;
    run_and_emit(0x6FCBF210u, "SKILLS_RollAndAddSkillElemDamage_6FCBF210_113c", k,
                 k == 0 ? "neg_skill" : k == 1 ? "fire_bolt" : k == 2 ? "lightning" : "ice_bolt", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [47] 0x6FCC2EA0 SKILLS_SrvDo_Unsummon_6FCC2EA0_113c (fastcall ecx=pGame, edx=pPlayerUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 471u);
    if (k > 0) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, 0, 1);
      uint32_t pList = U32(STAGE_UNIT0 + 0xA8u);
      U32(pList + 0x0Cu) = pSk; /* pUsedSkill */
      U32(pSk + 0x18u)   = 999u; /* param1 = dwPetGuid */
      if (k == 2) {
        U32(STAGE_UDATA0 + 0x44u)  = STAGE_PETCTRL;
        U32(STAGE_PETCTRL + 0x00u) = STAGE_PETCTRL + 0x10u;
      }
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FCC2EA0u, "SKILLS_SrvDo_Unsummon_6FCC2EA0_113c", k,
                 k == 0 ? "no_used_skill" : k == 1 ? "null_pets_ok" : "empty_pets_ok", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [48] 0x6FCC3C80 SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c (esi=pTarget, stack=[pCaster], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 481u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, (k == 2 ? 146u : 0u), 2u, (k == 1 ? 12u : 1u), 5005u, 5005u, 482u);
    uint32_t pTgt = (k == 0) ? 0u : STAGE_UNIT1;
    c.esi = pTgt; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = pTgt; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCC3C80u, "SKILLS_IsMonsterEligibleForSkillTarget_6FCC3C80_113c", k,
                 k == 0 ? "null_target" : k == 1 ? "dead_monster" : k == 2 ? "npc_cain" : "hostile_fallen", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [49] 0x6FCC3D00 MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c (esi=pUnit, edx=nSkillId, stack=[nBaseBonus], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 491u);
      attach_skill(STAGE_UNIT0, 36, (k == 3 ? 40 : 10));
    }
    int32_t baseB = (k == 0) ? -10 : (k == 1 ? 4 : (k == 2 ? 12 : 30));
    c.esi = pU; c.edx = 36u; c.nargs = 1; c.args[0] = (uint32_t)baseB; c.calleePop = 4u;
    ts[0] = pU; ts[1] = 36; ts[2] = baseB;
    run_and_emit(0x6FCC3D00u, "MONAI_CalcClampedSkillBonusRadius_6FCC3D00_113c", k,
                 k == 0 ? "clamp_min_1" : k == 1 ? "mid_radius_a" : k == 2 ? "mid_radius_b" : "clamp_max_24", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [50] 0x6FCC3D60 SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c (eax=pCaster, ecx=nSkillId, edx=pTarget, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 501u);
    /* Skill 70 = Raise Skeleton (wSumMon=363, nPetType=4) */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, (k == 2 ? 363u : 0u), 55u, 12u, 5004u, 5004u, 502u);
    int32_t skId = (k == 0) ? -1 : (k == 1 ? 36 : 70);
    c.eax = STAGE_UNIT0; c.ecx = (uint32_t)skId; c.edx = STAGE_UNIT1;
    ts[0] = STAGE_UNIT0; ts[1] = skId; ts[2] = STAGE_UNIT1;
    run_and_emit(0x6FCC3D60u, "SKILLS_CanSummonTargetUnitForSkill_6FCC3D60_113c", k,
                 k == 0 ? "neg_skill" : k == 1 ? "non_summon_ok" : k == 2 ? "same_summon_class_reject" : "eligible_corpse", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [51] 0x6FCD2F80 SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c (ecx=pGame, edx=pUnit, stack 2, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) U32(STAGE_UNIT0 + 0xC4u) = (k == 1) ? 0u : 0x100u;
    c.ecx = STAGE_GAME; c.edx = pU; c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pU; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FCD2F80u, "SKILLS_SrvSt_SetUnitFlags0E_6FCD2F80_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "from_zero" : "preserve_bit8", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [52] 0x6FCD2FA0 SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c (ecx=pGame, edx=pUnit, stack 2, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) U32(STAGE_UNIT0 + 0xC4u) = (k == 1) ? 0x0Fu : 0x1FEu;
    c.ecx = STAGE_GAME; c.edx = pU; c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pU; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FCD2FA0u, "SKILLS_SrvSt_ClearUnitFlags0E_6FCD2FA0_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "clear_low_bits" : "preserve_upper", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [53] 0x6FCEB610 SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c (esi=nSkillId, edi=pUnit, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 531u); /* Sorceress */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0); /* level 10 */
    if (k == 3) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 5, 2, 0); /* 2 unspent skill pts */
      attach_skill(STAGE_UNIT0, 36, 0); /* Fire Bolt node present */
    }
    int32_t skId = (k == 0) ? -1 : (k == 1 ? 126 : 36); /* -1 -> 2, Barb Bash -> 3, Sorc Fire Bolt -> 3 or 0 */
    c.esi = (uint32_t)skId; c.edi = STAGE_UNIT0;
    ts[0] = skId; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCEB610u, "SKILLS_ValidateSkillAllocationEligibility_6FCEB610_113c", k,
                 k == 0 ? "neg_skill_ret2" : k == 1 ? "wrong_class_ret3" : k == 2 ? "no_pts_ret3" : "eligible_ret0", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [54] 0x6FC89940 OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c (eax=pRoom, ecx=nMonsterClassId, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2 ? 2u : 41u)); /* Act 1 lvl 2 vs Act 2 lvl 41 */
    uint32_t pRm = (k == 1) ? 0u : STAGE_ROOM0;
    int32_t mCls = (k == 0) ? 10 : 0xEA; /* Flying Scimitar = 0xEA */
    c.eax = pRm; c.ecx = (uint32_t)mCls;
    ts[0] = pRm; ts[1] = mCls;
    run_and_emit(0x6FC89940u, "OBJECTS_CanSpawnMonsterClassInRoom_6FC89940_113c", k,
                 k == 0 ? "other_class" : k == 1 ? "null_room" : k == 2 ? "act1_blocked" : "act2_allowed", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [55] 0x6FC89C60 OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c (ecx=pUnit, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 1) stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 0u, 1u, 1u, 17u, 0u, 0u, 551u); /* dead player */
    if (k == 2) stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 0u, 1u, 1u, 1u,  0u, 0u, 552u); /* live player */
    if (k == 3) stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 1u, 0u, 1u, 1u,  0u, 0u, 553u); /* live monster */
    c.ecx = pU; ts[0] = pU;
    run_and_emit(0x6FC89C60u, "OBJ_IsPlayerOrMonsterAlive_6FC89C60_113c", k,
                 k == 0 ? "null" : k == 1 ? "dead_player" : k == 2 ? "live_player" : "live_monster", &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [56] 0x6FC9B860 AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c (edx=pUnit, stack=[pCandidate, pCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 561u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 1u, 5003u, 5004u, 562u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 1000 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, (k == 2 ? 300 : 900) << 8, 0);
    U32(STAGE_SCRATCH + 0x04u) = 200u; /* maxSqDist */
    U32(STAGE_SCRATCH + 0x08u) = 50u;  /* 50% life threshold */
    uint32_t pCand = (k == 0) ? 0u : STAGE_UNIT1;
    c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = pCand; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = pCand; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC9B860u, "AI_ScanCallbackNearestLowLifeUnit_6FC9B860_113c", k,
                 k == 0 ? "null_cand" : k == 1 ? "above_threshold" : "low_life_match", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [57] 0x6FC9B9F0 AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c (ecx=pGame, edx=pSelf, stack=[pCand, pBestOut], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 571u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, (k == 1 ? 12u : 1u), 5003u, 5004u, 572u);
    U32(STAGE_SCRATCH + 0x04u) = 100u;
    uint32_t pCand = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = pCand; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pCand; ts[3] = STAGE_SCRATCH;
    run_and_emit(0x6FC9B9F0u, "AI_FindClosestEvilMonsterCallback_6FC9B9F0_113c", k,
                 k == 0 ? "null_cand" : k == 1 ? "dead_cand" : "evil_mon_match", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [58] 0x6FCAF820 SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c (eax=pNpcUnit, ecx=pGame, stack=[pOutIndex], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pArr = STAGE_NPCCTRL + 0x20u;
    U32(STAGE_GAME + 0x1D24u)    = STAGE_NPCCTRL;
    U32(STAGE_NPCCTRL + 0x04u)   = pArr;
    for (uint32_t i = 0; i < 64u; i++) U32(pArr + i * 0x44u) = 0xFFFFFFFFu;
    U32(pArr + 5u * 0x44u) = 148u; /* Akara at slot 5 */
    uint32_t pNpc = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      U32(STAGE_UNIT0 + 0x00u) = 1u;
      U32(STAGE_UNIT0 + 0x04u) = (k == 1) ? 148u : 999u;
    }
    c.eax = pNpc; c.ecx = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = pNpc; ts[1] = STAGE_GAME; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FCAF820u, "SUNITPROXY_FindNpcSlotByUnit_6FCAF820_113c", k,
                 k == 0 ? "null_unit_slot0" : k == 1 ? "found_slot5" : "missing_ret0", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [59] 0x6FCC38C0 MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c (fastcall ecx=pUnit1, edx=pUnit2, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, (k == 2 ? 2u : 3u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 591u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM1, 1u, 0u, 2u, 1u, 5005u, 5005u, 592u);
    uint32_t u1 = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t u2 = (k == 1) ? 0u : STAGE_UNIT1;
    c.ecx = u1; c.edx = u2;
    ts[0] = u1; ts[1] = u2;
    run_and_emit(0x6FCC38C0u, "MONAI_AreUnitsInSameRoomLevel_6FCC38C0_113c", k,
                 k == 0 ? "assert_u1_null" : k == 1 ? "assert_u2_null" : k == 2 ? "same_level" : "diff_level", &c, ts, 2, 0xFFFFFFFFu, k < 2);
  }

  /* [60] 0x6FCC3980 MONAI_ClearAiControlParam0_6FCC3980_113c (stdcall [pAiArgs], ret 4) */
  for (int k = 0; k < 2; k++) {
    reset_case();
    c = make_call();
    uint32_t pCtrl = STAGE_SCRATCH + 0x40u;
    U32(STAGE_SCRATCH) = pCtrl;
    U32(pCtrl + 0x14u) = (k == 0) ? 0xDEADBEEFu : 42u;
    U32(pCtrl + 0x18u) = 0x11223344u;
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCC3980u, "MONAI_ClearAiControlParam0_6FCC3980_113c", k,
                 k == 0 ? "clear_deadbeef" : "clear_42", &c, ts, 1, 0u, 0);
  }

  /* [61] 0x6FCC3990 MONAI_InitAiControlDefaultParams_6FCC3990_113c (stdcall [pAiArgs], ret 4) */
  for (int k = 0; k < 2; k++) {
    reset_case();
    c = make_call();
    uint32_t pCtrl = STAGE_SCRATCH + 0x40u;
    U32(STAGE_SCRATCH) = pCtrl;
    U32(pCtrl + 0x14u) = (uint32_t)k * 99u;
    U32(pCtrl + 0x18u) = 99u;
    U32(pCtrl + 0x1Cu) = 99u;
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCC3990u, "MONAI_InitAiControlDefaultParams_6FCC3990_113c", k,
                 k == 0 ? "init_from_zero" : "init_overwrite", &c, ts, 1, 0u, 0);
  }

  /* [62] 0x6FCC39B0 MONAI_InitAiControlFrameAndMinusOne_6FCC39B0_113c (ecx=pGame, stack=[pAiArgs], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pCtrl = STAGE_SCRATCH + 0x40u;
    U32(STAGE_SCRATCH)      = pCtrl;
    U32(STAGE_GAME + 0xA8u) = (k == 0) ? 0u : (k == 1 ? 333u : 0x7FFFFFFFu);
    c.ecx = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FCC39B0u, "MONAI_InitAiControlFrameAndMinusOne_6FCC39B0_113c", k,
                 k == 0 ? "frame_0" : k == 1 ? "frame_333" : "frame_max", &c, ts, 2, 0u, 0);
  }

  /* [63] 0x6FCC3AE0 MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c (eax=pUnit, ecx=pSkill, stack=[pAiArgs], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pCtrl = STAGE_SCRATCH + 0x40u;
    U32(STAGE_SCRATCH) = pCtrl;
    S32(pCtrl + 0x1Cu) = (k == 0) ? -9 : (k == 1 ? 9 : 21);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pSk = 0u;
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 631u);
      pSk = attach_skill(STAGE_UNIT0, 36, (k == 2 ? 11 : 4));
    }
    c.eax = pU; c.ecx = pSk; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = pU; ts[1] = pSk; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FCC3AE0u, "MONAI_CalcScaledAiTickDelay_6FCC3AE0_113c", k,
                 k == 0 ? "clamp_to_1" : k == 1 ? "mid_delay" : "high_delay", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [64] 0x6FCC3C30 MONAI_InitAiControlAip3AndRandomParity_6FCC3C30_113c (ecx=pGame, edx=pUnit, stack=[pAiArgs], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t sgpt = U32(0x6FDE9E1Cu + g_com_rebase);
    uint32_t pMonStats0 = U32(sgpt + 0xA78u);
    uint32_t pCtrl = STAGE_SCRATCH + 0x40u;
    U32(STAGE_SCRATCH + 0x00u) = pCtrl;
    U32(STAGE_SCRATCH + 0x1Cu) = pMonStats0;
    U8(STAGE_GAME + 0x6Du)     = (uint8_t)k; /* diff 0, 1, 2 */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 1u, 0u, 1u, 1u, 0u, 0u, 0x10203040u + (uint32_t)k);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FCC3C30u, "MONAI_InitAiControlAip3AndRandomParity_6FCC3C30_113c", k,
                 k == 0 ? "diff0" : k == 1 ? "diff1" : "diff2", &c, ts, 3, 0u, 0);
  }

  /* [65] 0x6FCC3E10 MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c (fastcall ecx=pUnit1, edx=pUnit2, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 651u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, 1u, (k == 3 ? 6500u : 5100u), 5000u, 652u);
    if (k == 1) U8(STAGE_UNIT1 + 0x18u) = 2u; /* different act */
    uint32_t u1 = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = u1; c.edx = STAGE_UNIT1;
    ts[0] = u1; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FCC3E10u, "MONAI_AreUnitsInSameActWithin1020Subtiles_6FCC3E10_113c", k,
                 k == 0 ? "assert_u1_null" : k == 1 ? "diff_act" : k == 2 ? "within_1020" : "beyond_1020", &c, ts, 2, 0xFFFFFFFFu, k == 0);
  }

  /* [66] 0x6FCCC910 MONAI_EnableState172OnTarget_6FCCC910_113c (stdcall 5 args, ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 661u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5003u, 5003u, 662u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pT = (k == 1) ? 0u : STAGE_UNIT1;
    c.nargs = 5; c.args[0] = pU; c.args[1] = pT; c.calleePop = 0x14u;
    ts[0] = pU; ts[1] = pT; ts[2] = 0; ts[3] = 0; ts[4] = 0;
    run_and_emit(0x6FCCC910u, "MONAI_EnableState172OnTarget_6FCCC910_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "null_target" : "set_state_0xac", &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [67] 0x6FCCC940 MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c (fastcall ecx=pTierSlopes, edx=nLevel, ret) */
  {
    static const int32_t lvls[6] = { 1, 10, 22, 38, 52, 75 };
    for (int k = 0; k < 6; k++) {
      reset_case();
      c = make_call();
      S32(STAGE_SCRATCH + 0x00u) = 4;
      S32(STAGE_SCRATCH + 0x04u) = 7;
      S32(STAGE_SCRATCH + 0x08u) = 11;
      S32(STAGE_SCRATCH + 0x0Cu) = 16;
      S32(STAGE_SCRATCH + 0x10u) = 23;
      c.ecx = STAGE_SCRATCH; c.edx = (uint32_t)lvls[k];
      ts[0] = STAGE_SCRATCH; ts[1] = lvls[k];
      char lbl[24];
      snprintf(lbl, sizeof(lbl), "lvl_%d", lvls[k]);
      run_and_emit(0x6FCCC940u, "MONSTATS_EvalPiecewiseFiveTierLinear_6FCCC940_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
    }
  }

  /* [68] 0x6FCCC9E0 MONAI_InventoryContainsItemPointer_6FCCC9E0_113c (eax=pUnit, edi=pTargetItem, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 681u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_ring, 10u, 0u, 0u, 0u, 682u);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      uint32_t invAddr = (uint32_t)(uintptr_t)pInv;
      if (k == 2) {
        U32(invAddr + 0x0Cu) = STAGE_UNIT2;
        U32(invAddr + 0x10u) = STAGE_UNIT2;
        U32(STAGE_UDATA2 + 0x5Cu) = invAddr;
      }
    }
    c.eax = STAGE_UNIT0; c.edi = STAGE_UNIT2;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT2;
    run_and_emit(0x6FCCC9E0u, "MONAI_InventoryContainsItemPointer_6FCCC9E0_113c", k,
                 k == 0 ? "null_inv" : k == 1 ? "not_in_inv" : "found_in_inv", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [69] 0x6FCCCA20 MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c (edx=pDestUnit, stack=[pItem, a2, a3, a4, a5], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 691u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_ring, 2u, 0u, 0u, 0u, 692u);
    /* ITEMS_GetItemCell reads pItemData + 0x40 (dwItemCell) */
    S32(STAGE_UDATA2 + 0x40u) = (k == 0) ? -1 : 0; /* stat 0 = STRENGTH */
    if (k == 2) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x47, 15, 0); /* STAT_VALUE = 15 */
    c.edx = STAGE_UNIT0; c.nargs = 5; c.args[0] = STAGE_UNIT2; c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT2; ts[2] = 0; ts[3] = 0; ts[4] = 0; ts[5] = 0;
    run_and_emit(0x6FCCCA20u, "MONAI_TransferItemCellStatFromItemToUnit_6FCCCA20_113c", k,
                 k == 0 ? "neg_stat" : k == 1 ? "zero_val" : "transfer_str_15", &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [70] 0x6FCD0840 MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c (eax=pUnit, edx=nSkillId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 1u, 0u, 1u, 1u, 0u, 0u, 701u); /* Fallen has skill 158 */
    int32_t skId = (k == 2) ? 158 : 36;
    c.eax = pU; c.edx = (uint32_t)skId;
    ts[0] = pU; ts[1] = skId;
    run_and_emit(0x6FCD0840u, "MONAI_MonsterHasSkillIdInMonStats_6FCD0840_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "missing_skill" : "has_skill_158", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [71] 0x6FCD0980 AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c (ebx=pUnit, stack=[nTargetX, nTargetY], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2 ? 2u : 1u), 0u, 1u, 1u, 5000u, 5000u, 711u);
    int32_t tx = (k == 0) ? 5000 : (k == 1 ? 5012 : 4985);
    int32_t ty = (k == 0) ? 5000 : (k == 1 ? 5005 : 5020);
    c.ebx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)tx; c.args[1] = (uint32_t)ty; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = tx; ts[2] = ty;
    run_and_emit(0x6FCD0980u, "AI_CalcApproxDistFromUnitToCoords_6FCD0980_113c", k,
                 k == 0 ? "zero_delta" : k == 1 ? "dyn_monster" : "static_object", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [72] 0x6FCD0BA0 MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c (fastcall ecx=pMonster, edx=pTargetUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pAiGen = STAGE_SCRATCH;
    uint32_t pMon = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 1u, 0u, 1u, 1u, 0u, 0u, 721u);
      U32(STAGE_UDATA0 + 0x28u) = pAiGen;
    }
    uint32_t pTgt = (k == 2) ? STAGE_UNIT1 : 0u;
    if (k == 2) {
      U32(STAGE_UNIT1 + 0x00u) = 0u;
      U32(STAGE_UNIT1 + 0x0Cu) = 0x7777u;
    }
    c.ecx = pMon; c.edx = pTgt;
    ts[0] = pMon; ts[1] = pTgt;
    run_and_emit(0x6FCD0BA0u, "MONAI_SetAiGeneralTargetGuidAndType_6FCD0BA0_113c", k,
                 k == 0 ? "null_mon" : k == 1 ? "clear_target" : "set_player_target", &c, ts, 2, 0u, 0);
  }

  /* [73] 0x6FCD0DB0 MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c (ecx=pGame, edx=pSelf, stack=[pCand, pCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 5u, 1u, 1u, 5000u, 5000u, 731u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, (k == 1 ? 6u : 5u), 2u, 1u, 5004u, 5003u, 732u);
    U32(STAGE_SCRATCH + 0x00u) = 5u;  /* target classId */
    U32(STAGE_SCRATCH + 0x04u) = 15u; /* max dist */
    U32(STAGE_SCRATCH + 0x08u) = 2u;  /* initial count */
    uint32_t pCand = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = pCand; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pCand; ts[3] = STAGE_SCRATCH;
    run_and_emit(0x6FCD0DB0u, "MONAI_CountSameClassAliveMonstersInRangeCallback_6FCD0DB0_113c", k,
                 k == 0 ? "null_cand" : k == 1 ? "diff_class" : "same_class_inc", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [74] 0x6FCD0DF0 MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c (ecx=pGame, edx=pSelf, stack=[pCand, pDoorOut], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 741u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, g_obj_door, 2u, (k == 1 ? 2u : 0u), 5003u, 5004u, 742u);
    U32(STAGE_SCRATCH + 0x04u) = 100u;
    uint32_t pCand = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = pCand; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pCand; ts[3] = STAGE_SCRATCH;
    run_and_emit(0x6FCD0DF0u, "MONAI_FindClosestClosedDoorCallback_6FCD0DF0_113c", k,
                 k == 0 ? "null_cand" : k == 1 ? "opened_door_skip" : "closed_door_match", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [75] 0x6FCD0E30 MONAI_MatchSpawnMode0MonsterWithinRadiusCallback_6FCD0E30_113c (ecx=pGame, edx=pSelf, stack=[pCand, pMaxRadiusPtr], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0u, 1u, 1u, 5000u, 5000u, 751u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0u, 2u, (k == 1 ? 1u : 0u), 5004u, 5003u, 752u);
    U32(STAGE_SCRATCH) = 20u;
    uint32_t pCand = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = pCand; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pCand; ts[3] = STAGE_SCRATCH;
    run_and_emit(0x6FCD0E30u, "MONAI_MatchSpawnMode0MonsterWithinRadiusCallback_6FCD0E30_113c", k,
                 k == 0 ? "null_cand" : k == 1 ? "mode1_skip" : "mode0_match", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [76] 0x6FCD6CE0 AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c (fastcall ecx=pUnit, edx=pSelfPtr, stack=[pOutCount], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_SCRATCH + 0x00u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x10u) = 5u;
    uint32_t pU = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    U32(STAGE_UNIT1 + 0x10u) = (k == 1) ? 0x0Cu : 1u;
    if (k == 3) pU = 0u;
    c.ecx = pU; c.edx = STAGE_SCRATCH; c.nargs = 1; c.args[0] = STAGE_SCRATCH + 0x10u; c.calleePop = 4u;
    ts[0] = pU; ts[1] = STAGE_SCRATCH; ts[2] = STAGE_SCRATCH + 0x10u;
    run_and_emit(0x6FCD6CE0u, "AIBAAL_CountLivingMinionCallback_6FCD6CE0_113c", k,
                 k == 0 ? "self_skip" : k == 1 ? "corpse_skip" : k == 2 ? "living_inc" : "null_skip", &c, ts, 3, 0u, 0);
  }

  /* [77] 0x6FCEA490 MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c (eax=pUnit, stack=[ppMonsterRegion], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t ppReg = STAGE_SCRATCH;
    uint32_t pReg1 = STAGE_SCRATCH + 0x100u;
    U32(ppReg + 0u) = pReg1;
    U32(ppReg + 4u) = pReg1;
    U32(pReg1 + 0x2D0u) = 10u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 1u, 0u, 1u, 1u, 0u, 0u, 771u);
    U32(STAGE_UDATA0 + 0x58u) = 1u; /* Act 1 */
    if (k == 1) U8(STAGE_UDATA0 + 0x5Cu) = 0x02u; /* skip bit */
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = pU; c.nargs = 1; c.args[0] = ppReg; c.calleePop = 4u;
    ts[0] = pU; ts[1] = ppReg;
    run_and_emit(0x6FCEA490u, "MONREG_DecrementActActiveEvilMonsterCount_6FCEA490_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "flag2_skip" : "evil_dec", &c, ts, 2, 0u, 0);
  }

  /* [78] 0x6FD13410 NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c (ebx=pMonster, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pMon = (k == 0) ? 0u : STAGE_UNIT0;
    if (k > 0) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 1u, 0u, 0x1234u, 1u, 0u, 0u, 781u);
      if (k == 2) {
        U8(STAGE_UDATA0 + 0x5Cu)  = 1u;
        U16(STAGE_UDATA0 + 0x14u) = 42u;
        U8(STAGE_UDATA0 + 0x16u)  = 4u;
        U8(STAGE_UDATA0 + 0x1Cu)  = 5u;
        U8(STAGE_UDATA0 + 0x1Du)  = 9u;
        U8(STAGE_UDATA0 + 0x1Eu)  = 17u;
      }
    }
    c.ebx = pMon; c.nargs = 1; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = pMon; ts[1] = STAGE_CLIENT;
    run_and_emit(0x6FD13410u, "NET_SendPacket57MonsterUniqueEnchants_6FD13410_113c", k,
                 k == 0 ? "null_mon" : k == 1 ? "not_unique" : "send_pkt57", &c, ts, 2, 0u, 0);
  }

  /* [79] 0x6FC802A0 ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c (eax=pQuestDataEx, ecx=bSecondList, edi=dwGuid, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    /* List 0: +0x00.. (count at +0x30), List 1: +0x34.. (count at +0x64) */
    U16(STAGE_QUESTEX0 + 0x30u) = 2u;
    U32(STAGE_QUESTEX0 + 0x00u) = 101u;
    U32(STAGE_QUESTEX0 + 0x04u) = 202u;
    U16(STAGE_QUESTEX0 + 0x64u) = 3u;
    U32(STAGE_QUESTEX0 + 0x34u) = 303u;
    U32(STAGE_QUESTEX0 + 0x38u) = 404u;
    U32(STAGE_QUESTEX0 + 0x3Cu) = 505u;
    uint32_t second = (k >= 2) ? 1u : 0u;
    uint32_t guid   = (k == 0) ? 101u : (k == 1 ? 999u : (k == 2 ? 303u : 505u));
    c.eax = STAGE_QUESTEX0; c.ecx = second; c.edi = guid;
    ts[0] = STAGE_QUESTEX0; ts[1] = second; ts[2] = guid;
    run_and_emit(0x6FC802A0u, "ACT1Q6_RemoveGuidFromSelectedList_6FC802A0_113c", k,
                 k == 0 ? "list0_swap_pop" : k == 1 ? "list0_miss" : k == 2 ? "list1_head" : "list1_tail", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [80] 0x6FC80390 ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c (eax=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k > 0) {
      U32(STAGE_GAME + 0x10F4u)   = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u)= STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u)   = 4u;
      U32(STAGE_QUEST0 + 0x18u)   = STAGE_QUESTEX0;
      U8(STAGE_QUESTEX0 + 0x93u)  = (k == 2) ? 1u : 0u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FC80390u, "ACT1Q4_IsCainSavedFlag93Set_6FC80390_113c", k,
                 k == 0 ? "no_quest_chain" : k == 1 ? "flag_clear" : "flag_set", &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [81] 0x6FC80400 ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c (fastcall ecx=pGame, edx=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 4u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 1u, 0u, 5333u, 5444u, 811u);
    if (k > 0) {
      U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u)    = 4u;
      U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
      U8(STAGE_QUESTEX0 + 0x67u)   = (k == 2) ? 1u : 0u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC80400u, "ACT1Q4_RecordUnitCoordsOnceAt9C_6FC80400_113c", k,
                 k == 0 ? "no_quest" : k == 1 ? "record_first_time" : "already_recorded", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [82] 0x6FC80450 ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c (fastcall ecx=pGame, edx=pUnit, stack=[pOutCoords], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 4u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 1u, 0u, 5111u, 5222u, 821u);
    if (k > 0) {
      U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u)    = 4u;
      U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
      U8(STAGE_QUESTEX0 + 0x95u)   = (k == 2) ? 1u : 0u;
      U32(STAGE_QUESTEX0 + 0x9Cu)  = 6001u;
      U32(STAGE_QUESTEX0 + 0xA0u)  = 6002u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC80450u, "ACT1Q4_GetTristramPortalTargetCoords_6FC80450_113c", k,
                 k == 0 ? "no_quest" : k == 1 ? "from_unit_path" : "from_saved_9c", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [83] 0x6FC804C0 ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c (eax=pGame, ecx=pOutCoords, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k > 0) {
      U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u)    = 4u;
      U8(STAGE_QUEST0 + 0x09u)     = 1u;
      U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
      U8(STAGE_QUESTEX0 + 0x96u)   = 1u;
      U8(STAGE_QUESTEX0 + 0x92u)   = (k == 1) ? 1u : 0u;
      U32(STAGE_QUESTEX0 + 0xA8u)  = 5777u;
      U32(STAGE_QUESTEX0 + 0xACu)  = 5888u;
    }
    c.eax = STAGE_GAME; c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FC804C0u, "ACT1Q4_GetCairnStonesTargetCoords_6FC804C0_113c", k,
                 k == 0 ? "no_quest" : k == 1 ? "already_opened_92" : "copy_coords", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [84] 0x6FC80A30 ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c (fastcall ecx=pQuest, edx=pQuestArg, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 42u, 1u, 5000u, 5000u, 841u);
    U32(STAGE_UDATA0 + 0x10u) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xE0u) = 6u; /* quest state id */
    U16(STAGE_QUEST0 + 0x9Cu) = 1u;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    /* Populate GUID lists at +0x00, +0x84, +0x108 (count at +0x80) */
    U16(STAGE_QUESTEX0 + 0x80u) = 1u;
    U32(STAGE_QUESTEX0 + 0x00u) = 42u;
    if (k == 2) {
      U16(STAGE_QUESTEX0 + 0x108u + 0x80u) = 1u;
      U32(STAGE_QUESTEX0 + 0x108u + 0x00u) = 42u;
    }
    if (k == 1) {
      /* Set bit (6<<4)+1 = 97 -> byte 12 bit 1 */
      U8(STAGE_QBITS0 + 0x10u + 12u) = 0x02u;
    }
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC80A30u, "ACT1Q6_Callback11_RemovePlayerGuid_6FC80A30_113c", k,
                 k == 0 ? "remove_list0" : k == 1 ? "qstate1_active" : "remove_list2_ret1", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [85] 0x6FCDA330 ACT4Q1_OnPlayerChangeLevel_6FCDA330_113c (fastcall ecx=pQuestData, edx=pQuestArg, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 851u);
    U32(STAGE_UDATA0 + 0x10u) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x09u)  = (k == 0) ? 0u : 1u;
    U8(STAGE_QUEST0 + 0x0Bu)  = (k == 1) ? 0x0Du : 2u;
    U8(STAGE_QUEST0 + 0x0Cu)  = 0u;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCDA330u, "ACT4Q1_OnPlayerChangeLevel_6FCDA330_113c", k,
                 k == 0 ? "inactive_q9" : k == 1 ? "state_0d_skip" : "advance_to_state1", &c, ts, 2, 0u, 0);
  }

  /* [86] 0x6FC89670 OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c (fastcall ecx=pGame, edx=pUnit, stack=[nLifeAdd], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 861u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 80 << 8, 0);
    int32_t add = (k == 0) ? 20 : (k == 1 ? 0 : 50);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = (uint32_t)add; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = add;
    run_and_emit(0x6FC89670u, "OBJECTS_AddUnitMaxAndCurrentLifeFixed8_6FC89670_113c", k,
                 k == 0 ? "add_20" : k == 1 ? "add_0" : "add_50", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [87] 0x6FC89730 OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c (fastcall ecx=pGame, edx=pUnit, stack=[nManaAdd], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 871u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 90 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 40 << 8, 0);
    int32_t add = (k == 0) ? 15 : (k == 1 ? 0 : 45);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = (uint32_t)add; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = add;
    run_and_emit(0x6FC89730u, "OBJECTS_AddUnitMaxAndCurrentManaFixed8_6FC89730_113c", k,
                 k == 0 ? "add_15" : k == 1 ? "add_0" : "add_45", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [88] 0x6FC897A0 SHRINES_ApplyManaExchangeEffect_6FC897A0_113c (fastcall ecx=pObjOperate, edx=pShrinesTxt, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 881u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, (k == 0 ? 0 : 80) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 120 << 8, 0);
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    uint32_t pShrine = STAGE_SCRATCH + 0x40u;
    U32(pShrine + 0x04u) = (k == 2) ? 100u : 50u;
    U32(pShrine + 0x08u) = (k == 2) ? 150u : 200u;
    c.ecx = STAGE_SCRATCH; c.edx = pShrine;
    ts[0] = STAGE_SCRATCH; ts[1] = pShrine;
    run_and_emit(0x6FC897A0u, "SHRINES_ApplyManaExchangeEffect_6FC897A0_113c", k,
                 k == 0 ? "zero_mana" : k == 1 ? "half_drain_2x" : "full_drain_150pct", &c, ts, 2, 0u, 0);
  }

  /* [89] 0x6FC89C00 OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c (ecx=pOperateArgs, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 891u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 0 ? 200 : 75) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 150 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, (k == 1 ? 150 : 30) << 8, 0);
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH; ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC89C00u, "OBJ_RestoreUnitLifeAndManaToMax_6FC89C00_113c", k,
                 k == 0 ? "already_full_hp" : k == 1 ? "restore_hp_only" : "restore_both", &c, ts, 1, 0u, 0);
  }

  /* [90] 0x6FC8FFC0 PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c (eax=pPlayer, stack=[pGame, dwItemGuid, dwField4], ret 0xC) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 901u);
    if (k >= 2) {
      U32(STAGE_UDATA0 + 0x5Cu) = STAGE_SCRATCH;
      if (k == 3) U32(STAGE_SCRATCH + 0x08u) = STAGE_SCRATCH + 0x40u;
    }
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = pPlr; c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = 0xAABBCCDDu; c.args[2] = 7u; c.calleePop = 0xCu;
    ts[0] = pPlr; ts[1] = STAGE_GAME; ts[2] = 0xAABBCCDDu; ts[3] = 7;
    run_and_emit(0x6FC8FFC0u, "PLRTRADE_PrependTradeItemNode_6FC8FFC0_113c", k,
                 k == 0 ? "assert_null_player" : k == 1 ? "no_trade_struct" : k == 2 ? "prepend_empty" : "prepend_existing", &c, ts, 4, 0u, k == 0);
  }

  /* [91] 0x6FC91170 CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c (eax=pSourcePlayer, ecx=pReceiverPlayer, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 911u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    uint32_t invAddr = (uint32_t)(uintptr_t)pInv;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u,
                        (k == 2 && g_item_soulstone ? g_item_soulstone : g_item_ring), 10u, 0u, 0u, 0u, 912u);
      U32(STAGE_UDATA2 + 0x00u) = 2u; /* normal quality */
      U8(STAGE_UDATA2 + 0x45u)  = 2u; /* invPage 2 = Cube */
      U32(invAddr + 0x0Cu) = STAGE_UNIT2;
      U32(invAddr + 0x10u) = STAGE_UNIT2;
      U32(STAGE_UDATA2 + 0x5Cu) = invAddr;
      U32(STAGE_UDATA0 + 0x10u) = STAGE_QBITS0;
      U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x10u;
    }
    c.eax = STAGE_UNIT0; c.ecx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FC91170u, "CUBE_CanPlayerPickupAllCubeItems_6FC91170_113c", k,
                 k == 0 ? "empty_cube" : k == 1 ? "normal_ring_in_cube" : "soulstone_in_cube", &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [92] 0x6FC97E70 PLAYER_CanLootCorpse_6FC97E70_113c (ecx=pPlayer, edx=pGame, eax=pCorpseUnit, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 10u, 1u, 5000u, 5000u, 921u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 20u, 17u, 5002u, 5002u, 922u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    /* INVENTORY_GetLeftItemGuid reads pInv + 0x20 */
    U32((uint32_t)(uintptr_t)pInv + 0x20u) = (k == 2) ? 10u : 99u;
    uint32_t pPlr  = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pCorp = (k == 1) ? 0u : STAGE_UNIT1;
    c.ecx = pPlr; c.edx = STAGE_GAME; c.eax = pCorp;
    ts[0] = pPlr; ts[1] = STAGE_GAME; ts[2] = pCorp;
    run_and_emit(0x6FC97E70u, "PLAYER_CanLootCorpse_6FC97E70_113c", k,
                 k == 0 ? "assert_null_player" : k == 1 ? "assert_null_corpse" : k == 2 ? "own_corpse_ok" : "unowned_corpse_deny", &c, ts, 3, 0xFFFFFFFFu, k < 2);
  }

  /* [93] 0x6FCAA690 NET_SendPacket9B_MercReviveInfo_6FCAA690_113c (eax=wMercNameId, ecx=dwReviveCost, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t nameId = (k == 1) ? 7u : 0x1234u;
    uint32_t cost   = (k == 1) ? 5000u : 50000u;
    c.eax = nameId; c.ecx = cost; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = nameId; ts[1] = cost; ts[2] = pCli;
    run_and_emit(0x6FCAA690u, "NET_SendPacket9B_MercReviveInfo_6FCAA690_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "merc_5000g" : "merc_50000g", &c, ts, 3, 0u, 0);
  }

  /* [94] 0x6FCAA9C0 NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c (eax=pOwner, ecx=pCorpse, stack=[pClient, bAssign], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_UNIT0 + 0x0Cu) = 11u;
    U32(STAGE_UNIT1 + 0x0Cu) = 22u;
    uint32_t pOwn  = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pCorp = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t bAsg  = (k == 2) ? 1u : 0u;
    c.eax = pOwn; c.ecx = pCorp; c.nargs = 2; c.args[0] = STAGE_CLIENT; c.args[1] = bAsg; c.calleePop = 8u;
    ts[0] = pOwn; ts[1] = pCorp; ts[2] = STAGE_CLIENT; ts[3] = bAsg;
    run_and_emit(0x6FCAA9C0u, "NET_SendPacket74_PlayerCorpseAssign_6FCAA9C0_113c", k,
                 k == 0 ? "null_units_neg1" : k == 1 ? "unassign_0" : "assign_1", &c, ts, 4, 0u, 0);
  }

  /* [95] 0x6FCAB9B0 NET_SendPacket10B_UnitByteStat_6FCAB9B0_113c (eax=wStatId, stack=[pClient, bPacketId, dwUnitGuid, dwStatVal], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t statId = (k == 0) ? 0xFFu : (k == 1 ? 12u : 93u);
    c.eax = statId;
    c.nargs = 4; c.args[0] = STAGE_CLIENT; c.args[1] = 0xA0u; c.args[2] = 77u; c.args[3] = 12345u; c.calleePop = 0x10u;
    ts[0] = statId; ts[1] = STAGE_CLIENT; ts[2] = 0xA0; ts[3] = 77; ts[4] = 12345;
    run_and_emit(0x6FCAB9B0u, "NET_SendPacket10B_UnitByteStat_6FCAB9B0_113c", k,
                 k == 0 ? "assert_stat_0xff" : k == 1 ? "stat_12" : "stat_93", &c, ts, 5, 0u, k == 0);
  }

  /* [96] 0x6FCABA10 NET_SendPacketA5_StateSkill_6FCABA10_113c (ecx=bUnitType, edx=dwUnitGuid, stack=[pClient, wSkillId], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t skId = (k == 1) ? 54u : 151u;
    c.ecx = 0u; c.edx = 42u; c.nargs = 2; c.args[0] = pCli; c.args[1] = skId; c.calleePop = 8u;
    ts[0] = 0; ts[1] = 42; ts[2] = pCli; ts[3] = skId;
    run_and_emit(0x6FCABA10u, "NET_SendPacketA5_StateSkill_6FCABA10_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "teleport_54" : "whirlwind_151", &c, ts, 4, 0u, 0);
  }

  /* [97] 0x6FCABF80 S2C_QueueLocationPacket11_6FCABF80_113c (eax=bPacketId, ecx=bUnitType, edx=dwUnitId, stack=[pClient, wX, wY, bFlag], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t wx = 5100u + (uint32_t)k * 10u;
    uint32_t wy = 5200u + (uint32_t)k * 20u;
    uint32_t fl = (k == 2) ? 1u : 0u;
    c.eax = 0x15u; c.ecx = 0u; c.edx = 99u;
    c.nargs = 4; c.args[0] = pCli; c.args[1] = wx; c.args[2] = wy; c.args[3] = fl; c.calleePop = 0x10u;
    ts[0] = 0x15; ts[1] = 0; ts[2] = 99; ts[3] = pCli; ts[4] = wx; ts[5] = wy; ts[6] = fl;
    run_and_emit(0x6FCABF80u, "S2C_QueueLocationPacket11_6FCABF80_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "reassign_flag0" : "reassign_flag1", &c, ts, 7, 0u, 0);
  }

  /* [98] 0x6FCBBC70 PARTY_SplitGoldPickupByCap_6FCBBC70_113c (eax=nGoldToAdd, ebx=pPlayer, stack=[pOutAdd, pOutRem], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 981u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0); /* lvl 10 -> cap 100,000 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 90000, 0); /* cur gold 90,000 */
    int32_t add = (k == 0) ? 5000 : (k == 1 ? 10000 : 25000);
    c.eax = (uint32_t)add; c.ebx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = STAGE_SCRATCH + 4u; c.calleePop = 8u;
    ts[0] = add; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = STAGE_SCRATCH + 4u;
    run_and_emit(0x6FCBBC70u, "PARTY_SplitGoldPickupByCap_6FCBBC70_113c", k,
                 k == 0 ? "under_cap" : k == 1 ? "exact_cap" : "overflow_split", &c, ts, 4, 0u, 0);
  }

  /* [99] 0x6FCBBCB0 PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c (eax=pSubParty, ecx=dwTargetUnitId, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t pSub = (k == 0) ? 0u : STAGE_PARTYCTRL;
    if (k > 0) {
      uint32_t m0 = STAGE_PARTYCTRL + 0x20u;
      uint32_t m1 = STAGE_PARTYCTRL + 0x30u;
      U32(STAGE_PARTYCTRL + 0x04u) = (k == 1) ? 0u : m0;
      U32(m0 + 0x00u) = 11u; U32(m0 + 0x04u) = m1;
      U32(m1 + 0x00u) = 22u; U32(m1 + 0x04u) = 0u;
    }
    uint32_t tgt = (k == 2) ? 22u : 99u;
    c.eax = pSub; c.ecx = tgt;
    ts[0] = pSub; ts[1] = tgt;
    run_and_emit(0x6FCBBCB0u, "PARTY_IsUnitInSubPartyNode_6FCBBCB0_113c", k,
                 k == 0 ? "assert_null_subparty" : k == 1 ? "empty_list" : k == 2 ? "found_member" : "missing_member", &c, ts, 2, 0xFFFFFFFFu, k == 0);
  }

  /* [100] 0x6FCBBD00 PARTY_FindSubPartyById_6FCBBD00_113c (eax=pGame, ecx=wPartyId, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    if (k > 0) {
      uint32_t n0 = STAGE_PARTYCTRL + 0x20u;
      uint32_t n1 = STAGE_PARTYCTRL + 0x40u;
      U32(STAGE_GAME + 0x1D2Cu)    = STAGE_PARTYCTRL;
      U32(STAGE_PARTYCTRL + 0x04u) = (k == 1) ? 0u : n0;
      U16(n0 + 0x00u) = 3u; U32(n0 + 0x08u) = n1;
      U16(n1 + 0x00u) = 5u; U32(n1 + 0x08u) = 0u;
    }
    uint32_t pid = (k == 2) ? 5u : 9u;
    c.eax = STAGE_GAME; c.ecx = pid;
    ts[0] = STAGE_GAME; ts[1] = pid;
    run_and_emit(0x6FCBBD00u, "PARTY_FindSubPartyById_6FCBBD00_113c", k,
                 k == 0 ? "assert_null_ctrl" : k == 1 ? "empty_parties" : k == 2 ? "found_id5" : "missing_id9", &c, ts, 2, 0xFFFFFFFFu, k == 0);
  }

  /* [101] 0x6FCBBD40 PARTY_AllocNextPartyId_6FCBBD40_113c (eax=pGame, ret 16-bit ax) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_GAME + 0x1D2Cu) = STAGE_PARTYCTRL;
    if (k == 0) {
      U16(STAGE_PARTYCTRL + 0x00u) = 0u; /* clamps < 3 to 3 */
    } else if (k == 1) {
      uint32_t n0 = STAGE_PARTYCTRL + 0x20u;
      U16(STAGE_PARTYCTRL + 0x00u) = 3u;
      U32(STAGE_PARTYCTRL + 0x04u) = n0;
      U16(n0 + 0x00u) = 3u; /* collision on 3 -> advances to 4 */
    } else {
      U16(STAGE_PARTYCTRL + 0x00u) = 0xFFFFu;
      uint32_t n0 = STAGE_PARTYCTRL + 0x20u;
      U32(STAGE_PARTYCTRL + 0x04u) = n0;
      U16(n0 + 0x00u) = 0xFFFFu; /* wraps 0xFFFF+1 -> 0 -> clamps to 3 */
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCBBD40u, "PARTY_AllocNextPartyId_6FCBBD40_113c", k,
                 k == 0 ? "clamp_to_3" : k == 1 ? "skip_used_3" : "wrap_ffff_to_3", &c, ts, 1, 0x0000FFFFu, 0);
  }

  /* [102] 0x6FCBBF70 PARTY_CreateAndLinkSubParty_6FCBBF70_113c (ebx=pGame, ret 16-bit ax) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k > 0) {
      U32(STAGE_GAME + 0x1D2Cu) = STAGE_PARTYCTRL;
      U16(STAGE_PARTYCTRL + 0x00u) = (k == 1) ? 0u : 7u;
    }
    c.ebx = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCBBF70u, "PARTY_CreateAndLinkSubParty_6FCBBF70_113c", k,
                 k == 0 ? "assert_null_ctrl" : k == 1 ? "alloc_first_id3" : "alloc_id7", &c, ts, 1, 0x0000FFFFu, k == 0);
  }

  /* [103] 0x6FCBE450 VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c (ebx=pX, edi=pY, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    static const int32_t vx[4] = { 0, 1, 10, -15 };
    static const int32_t vy[4] = { 0, -1, 6, 9 };
    S32(STAGE_SCRATCH + 0x00u) = vx[k];
    S32(STAGE_SCRATCH + 0x04u) = vy[k];
    c.ebx = STAGE_SCRATCH; c.edi = STAGE_SCRATCH + 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_SCRATCH + 4u;
    run_and_emit(0x6FCBE450u, "VECTOR_NormalizePerpendicularToMaxSq3_6FCBE450_113c", k,
                 k == 0 ? "zero_vec" : k == 1 ? "already_le3" : k == 2 ? "pos_halving" : "neg_halving", &c, ts, 2, 0u, 0);
  }

  /* [104] 0x6FCBE490 VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c (esi=pX, edx=pY, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    static const int32_t vx[4] = { 0, 1, 2, 5 };
    static const int32_t vy[4] = { 0, 0, 3, -4 };
    S32(STAGE_SCRATCH + 0x00u) = vx[k];
    S32(STAGE_SCRATCH + 0x04u) = vy[k];
    c.esi = STAGE_SCRATCH; c.edx = STAGE_SCRATCH + 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_SCRATCH + 4u;
    run_and_emit(0x6FCBE490u, "VECTOR_ScaleUpBelowSq4AndSq16_6FCBE490_113c", k,
                 k == 0 ? "zero_vec" : k == 1 ? "scale_4x" : k == 2 ? "scale_2x" : "no_scale_ge16", &c, ts, 2, 0u, 0);
  }

  /* [105] 0x6FCC3A20 STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c (stdcall [pUnit, nState], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 1051u);
    /* Group 1: states [10, 14, 20, 86, 88]; State 1 has wGroup == 0 */
    int32_t st = (k == 0) ? -1 : (k == 1 ? 1 : 10);
    if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 10, 1); /* only self active */
    if (k == 3) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 20, 1); /* Chilling Armor active in same group! */
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = (uint32_t)st; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = st;
    run_and_emit(0x6FCC3A20u, "STATES_HasOtherActiveStateInSameGroup_6FCC3A20_113c", k,
                 k == 0 ? "neg_state" : k == 1 ? "ungrouped_state" : k == 2 ? "only_self_active" : "other_in_group_active", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [106] 0x6FCDC990 INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c (eax=pUnit, stack=[dwItemGuid], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1061u);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      if (k >= 2) {
        stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_ring, 0x777u, 4u, 0u, 0u, 1062u);
        fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT2);
      }
    }
    uint32_t wantGuid = (k == 3) ? 0x777u : 0x888u;
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = wantGuid; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = wantGuid;
    run_and_emit(0x6FCDC990u, "INVENTORY_IsCursorItemMatchingGuid_6FCDC990_113c", k,
                 k == 0 ? "null_inv" : k == 1 ? "no_cursor" : k == 2 ? "guid_mismatch" : "guid_match", &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [107] 0x6FCEB4E0 PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c (ecx=pGame, edx=pPlayer, stack=[pPacket, nPacketLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1071u);
    U8(STAGE_SCRATCH) = 0x48u;
    if (k == 2) U32(STAGE_UDATA0 + 0x4Cu) = STAGE_SCRATCH + 0x20u;
    uint32_t pktLen = (k == 0) ? 5u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = pktLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = pktLen;
    run_and_emit(0x6FCEB4E0u, "PACKET_Srv48_ClearPlayerIntro_6FCEB4E0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "already_zero_ret2" : "clear_intro_ret0", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [108] 0x6FCEC960 C2S_Packet3A_AddStatPoint_6FCEC960_113c (ecx=pGame, edx=pPlayer, stack=[pPacket, nPacketLen], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 1081u); /* Sorc */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 1, 35, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 4, (k == 2 ? 0 : 10), 0); /* STAT_STATPTS */
    U8(STAGE_SCRATCH + 0u) = 0x3Au;
    U8(STAGE_SCRATCH + 1u) = (k == 1) ? 0x20u : 1u; /* statId 1 = Energy (0x20 invalid >= 16) */
    U8(STAGE_SCRATCH + 2u) = 2u; /* count - 1 = 2 -> spend 3 points */
    uint32_t pktLen = (k == 0) ? 2u : 3u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = pktLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = pktLen;
    run_and_emit(0x6FCEC960u, "C2S_Packet3A_AddStatPoint_6FCEC960_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "bad_stat_ret3" : k == 2 ? "no_pts_ret2" : "spend_3_energy_ret0", &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [109] 0x6FD0AE20 PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c (eax=nPoints, esi=pPlayerUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 1091u); /* Sorc */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 4, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 1, 35, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 60 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 60 << 8, 0);
    int32_t pts = (k == 0) ? 0 : (k == 1 ? 5 : -2);
    c.eax = (uint32_t)pts; c.esi = STAGE_UNIT0;
    ts[0] = pts; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FD0AE20u, "PLAYERSTATS_AllocateEnergyPoints_6FD0AE20_113c", k,
                 k == 0 ? "zero_pts" : k == 1 ? "add_5_pts" : "neg_2_pts_clamp", &c, ts, 2, 0u, 0);
  }

  /* [110] 0x6FD14260 OBJECTS_RollScaledByte19C_6FD14260_113c (eax=nMaxPct, edi=nMinPct, ecx=pObject, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 1u, 0u, 5000u, 5000u, 0xCAFE1234u + (uint32_t)k);
    uint32_t maxP = (k == 0) ? 10u : (k == 1 ? 50u : 200u);
    uint32_t minP = (k == 0) ? 20u : 50u;
    c.eax = maxP; c.edi = minP; c.ecx = STAGE_UNIT0;
    ts[0] = maxP; ts[1] = minP; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FD14260u, "OBJECTS_RollScaledByte19C_6FD14260_113c", k,
                 k == 0 ? "assert_min_gt_max" : k == 1 ? "equal_min_max" : "range_50_200", &c, ts, 3, 0xFFFFFFFFu, k == 0);
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-w2-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-w2] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
    fflush(stderr);
    return 1;
  }

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  g_hFog         = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCmp   = LoadLibraryA("D2CMP.dll");
  g_hCom         = LoadLibraryA("D2Common.dll");
  HMODULE hNet   = LoadLibraryA("D2Net.dll");
  g_hGame        = LoadLibraryA("D2Game.dll");
  if (!hStorm || !g_hFog || !hLang || !hCmp || !g_hCom || !hNet || !g_hGame) {
    fprintf(stderr, "[k6-w2] LoadLibraryA failed (%p %p %p %p %p %p %p)\n",
            (void *)hStorm, (void *)g_hFog, (void *)hLang, (void *)hCmp,
            (void *)g_hCom, (void *)hNet, (void *)g_hGame);
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-w2] unexpected D2Common rebase: %p\n", (void *)g_hCom);
    fflush(stderr);
    return 3;
  }

  /* Initialize Fog bitmasks & system tables before installing deterministic alloc/assert hooks */
  {
    typedef void(__fastcall *FogInitSys_t)(int, void *);
    FogInitSys_t pInit = (FogInitSys_t)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(10089));
    if (pInit) pInit(1, NULL);
  }

  load_datatbls_img(imgPath);
  install_fog_hooks();

  fn_CreateStatListEx   = (Com_CreateStatListEx_t)(uintptr_t)(0x6FD8AF00u + g_com_rebase);
  fn_SetUnitStat        = (Com_SetUnitStat_t)(uintptr_t)(0x6FD8A740u + g_com_rebase);
  fn_AllocStatList      = (Com_AllocStatList_t)(uintptr_t)(0x6FD88100u + g_com_rebase);
  fn_SetStatIfValid     = (Com_SetStatIfValid_t)(uintptr_t)(0x6FD8A7B0u + g_com_rebase);
  fn_SetStatListState   = (Com_SetStatListState_t)(uintptr_t)(0x6FD88060u + g_com_rebase);
  fn_MergeStatLists     = (Com_MergeStatLists_t)(uintptr_t)(0x6FD8A7D0u + g_com_rebase);
  fn_ToggleGfxState     = (Com_ToggleGfxState_t)(uintptr_t)(0x6FD84510u + g_com_rebase);
  fn_AllocSkillList     = (Com_AllocSkillList_t)(uintptr_t)(0x6FD9E3F0u + g_com_rebase);
  fn_SetSkillLevel      = (Com_SetSkillLevel_t)(uintptr_t)(0x6FDA2BC0u + g_com_rebase);
  fn_AllocInventory     = (Com_AllocInventory_t)(uintptr_t)(0x6FD6E710u + g_com_rebase);
  fn_SetCursorItem      = (Com_SetCursorItem_t)(uintptr_t)(0x6FD71790u + g_com_rebase);
  fn_PlaceItemInBodyLoc = (Com_PlaceItemInBodyLoc_t)(uintptr_t)(0x6FD71DA0u + g_com_rebase);
  fn_CheckItemTypeId    = (Com_CheckItemTypeId_t)(uintptr_t)(0x6FC2A430u + g_game_rebase);
  fn_UnitsIsDoor        = (Com_UnitsIsDoor_t)(uintptr_t)(0x6FC2AD6Cu + g_game_rebase);

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_SetCursorItem || !fn_PlaceItemInBodyLoc) {
    fprintf(stderr, "[k6-w2] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-w2] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_all_110_vas();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-w2] emitted %u vectors across 110 D2Game.dll VAs\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
