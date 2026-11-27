/*
 * k6-w15-d2game-emitter.c — [K6] Wave 15 Real-DLL Final Clean Lo-VA Sweeper
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables + D2Common .data/.bss + Items linker table
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert), Fog.#10042..10047 &
 * Storm.#401/#403/#405 (deterministic bump allocator), and KERNEL32!GetTickCount
 * + KERNEL32!QueryPerformanceCounter, and sweeps clean & newly-unblocked D2Game.dll
 * Lo-VAs (0x6FC20000..0x6FCBFFFF), emitting >= 3 non-degenerate vectors per VA.
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
#define STAGE_CS_GAME     0x30078000u /* Outside STAGE_FIXED_SIZE & STAGE_SETUP_BASE..setupTop */
#define STAGE_TOTAL_SIZE  0x00080000u

#define HEAP_BASE         0x40000000u
#define HEAP_SIZE         0x00200000u

/* Fixed staged object addresses inside 0x30000000..0x30008FFF */
#define STAGE_GAME        (STAGE_BASE + 0x0000u) /* 0x2000: D2GameStrc */
#define STAGE_CLIENT      (STAGE_BASE + 0x2000u) /* 0x0600: D2ClientStrc #0 */
#define STAGE_PKTNODE0    (STAGE_BASE + 0x2600u) /* 0x0210: D2PacketDataStrc #0 */
#define STAGE_PKTNODE1    (STAGE_BASE + 0x2810u) /* 0x0210: D2PacketDataStrc #1 */
#define STAGE_CLIENT1     (STAGE_BASE + 0x2A20u) /* 0x0580: D2ClientStrc #1 */
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
#define STAGE_SCRATCH     (STAGE_BASE + 0x8000u) /* 0x1000: out-params / packets / ctx */

#define U32(addr) (*(volatile uint32_t *)((uintptr_t)(addr)))
#define U16(addr) (*(volatile uint16_t *)((uintptr_t)(addr)))
#define U8(addr)  (*(volatile uint8_t  *)((uintptr_t)(addr)))
#define S32(addr) (*(volatile int32_t  *)((uintptr_t)(addr)))
#define S16(addr) (*(volatile int16_t  *)((uintptr_t)(addr)))

#define MAX_STACK 12
#define MAX_EXTRA_CAPS 4

static HMODULE g_hStorm = NULL;
static HMODULE g_hFog   = NULL;
static HMODULE g_hCom   = NULL;
static HMODULE g_hGame  = NULL;
static uintptr_t g_com_rebase  = 0;
static uintptr_t g_game_rebase = 0;

static int g_in_setup_phase = 1;
static uint32_t g_setup_top = STAGE_SETUP_BASE;
static uint32_t g_heap_top  = HEAP_BASE;

/* Deterministic host clock overrides */
static uint32_t g_fake_tick_count = 0u;
static uint32_t g_fake_qpc_lo     = 0u;
static uint32_t g_fake_qpc_hi     = 0u;

/* Optional extra D2Game global capture ranges (canonical preferred-base VAs) */
typedef struct {
  uint32_t canonAddr;
  uint32_t len;
} ExtraCap;

static ExtraCap g_extra_caps[MAX_EXTRA_CAPS];
static uint32_t g_extra_cap_count = 0u;

static void add_extra_cap(uint32_t canonAddr, uint32_t len) {
  if (g_extra_cap_count < MAX_EXTRA_CAPS && len > 0u) {
    g_extra_caps[g_extra_cap_count].canonAddr = canonAddr;
    g_extra_caps[g_extra_cap_count].len = len;
    g_extra_cap_count++;
  }
}

/* D2Common helper function pointers (resolved by ordinal on g_hCom) */
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
typedef int32_t(__stdcall *Com_PlaceItemInBodyLoc_t)(void *pInv, void *pItem, int32_t bodyLoc);
typedef void  (__stdcall *Com_PathSetTargetUnit_t)(void *pPath, void *pTarget);

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
static Com_PlaceItemInBodyLoc_t fn_PlaceItemInBodyLoc = NULL;
static Com_PathSetTargetUnit_t  fn_PathSetTargetUnit  = NULL;

static uint32_t g_item_sword = 0u;
static uint32_t g_item_bow   = 0u;
static uint32_t g_item_ring  = 0u;
static uint32_t g_item_armor = 0u;

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

uint32_t g_thunk_out_eax    = 0;
uint32_t g_thunk_saved_esp  = 0;
uint32_t g_thunk_saved_ebp  = 0;
uint32_t g_thunk_esp_before = 0;
uint32_t g_thunk_esp_after  = 0;

volatile LONG g_thunk_in_call = 0;
volatile LONG g_thunk_faulted = 0;
uint32_t g_fault_code  = 0;
uint32_t g_fault_eip   = 0;
uint32_t g_fault_addr  = 0;
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
      "leal -0x380(%esp), %edi\n\t"
      "xorl %eax, %eax\n\t"
      "movl $0xE0, %ecx\n\t"
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
      "movl %eax, _g_thunk_out_eax\n\t"
      "movl %esp, _g_thunk_esp_after\n\t"
      ".globl _thunk_resume\n\t"
      "_thunk_resume:\n\t"
      "movl _g_thunk_saved_esp, %esp\n\t"
      "movl _g_thunk_saved_ebp, %ebp\n\t"
      "popl %edi\n\t"
      "popl %esi\n\t"
      "popl %ebx\n\t"
      "popl %ebp\n\t"
      "ret\n\t");
}

static LONG WINAPI k6_veh(EXCEPTION_POINTERS *ep) {
  if (!g_thunk_in_call) return EXCEPTION_CONTINUE_SEARCH;
  DWORD code = ep->ExceptionRecord->ExceptionCode;
  if (code == EXCEPTION_ACCESS_VIOLATION ||
      code == EXCEPTION_INT_DIVIDE_BY_ZERO ||
      code == EXCEPTION_ILLEGAL_INSTRUCTION ||
      code == EXCEPTION_BREAKPOINT ||
      code == EXCEPTION_STACK_OVERFLOW ||
      code == EXCEPTION_PRIV_INSTRUCTION) {
    g_thunk_faulted = 1;
    g_fault_code    = (uint32_t)code;
    g_fault_eip     = (uint32_t)ep->ContextRecord->Eip;
    g_fault_addr    = (ep->ExceptionRecord->NumberParameters >= 2)
                          ? (uint32_t)ep->ExceptionRecord->ExceptionInformation[1]
                          : 0;
    ep->ContextRecord->Eip = (DWORD)(uintptr_t)&thunk_resume;
    ep->ContextRecord->Esp = (DWORD)g_thunk_saved_esp;
    ep->ContextRecord->Ebp = (DWORD)g_thunk_saved_ebp;
    return EXCEPTION_CONTINUE_EXECUTION;
  }
  return EXCEPTION_CONTINUE_SEARCH;
}

/* ------------------------------- Deterministic Allocator & Hooks */

typedef struct {
  uint32_t ptr;
  uint32_t size;
} AllocRec;

static AllocRec g_allocs[1024];
static uint32_t g_alloc_count = 0;

static void record_alloc(uint32_t ptr, uint32_t size) {
  if (g_alloc_count < 1024u) {
    g_allocs[g_alloc_count].ptr  = ptr;
    g_allocs[g_alloc_count].size = size;
    g_alloc_count++;
  }
}

static uint32_t lookup_alloc_size(uint32_t ptr) {
  for (uint32_t i = g_alloc_count; i > 0u; i--) {
    if (g_allocs[i - 1u].ptr == ptr) return g_allocs[i - 1u].size;
  }
  return 0u;
}

static void *bump_alloc(uint32_t size) {
  uint32_t sz = (size == 0u) ? 4u : size;
  uint32_t *cur = g_in_setup_phase ? &g_setup_top : &g_heap_top;
  uint32_t limit = g_in_setup_phase ? STAGE_CS_GAME : (HEAP_BASE + HEAP_SIZE);
  uint32_t p = (*cur + 3u) & ~3u;
  if (p + sz > limit) {
    fprintf(stderr, "[k6-w15] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
    TerminateProcess(GetCurrentProcess(), 21);
  }
  memset((void *)(uintptr_t)p, 0, sz);
  *cur = p + sz;
  record_alloc(p, sz);
  return (void *)(uintptr_t)p;
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

static void *__fastcall stub_fog_10042(uint32_t size, const char *file, int line, int z) {
  (void)file; (void)line; (void)z;
  return bump_alloc(size);
}
static void __fastcall stub_fog_10043(void *ptr, const char *file, int line, int z) {
  (void)ptr; (void)file; (void)line; (void)z;
}
static void *__fastcall stub_fog_10045(void *pool, uint32_t size, const char *file, int line, int z) {
  (void)pool; (void)file; (void)line; (void)z;
  return bump_alloc(size);
}
static void __fastcall stub_fog_10046(void *pool, void *ptr, const char *file, int line, int z) {
  (void)pool; (void)ptr; (void)file; (void)line; (void)z;
}
static void *__fastcall stub_fog_10047(void *pool, void *ptr, uint32_t newSize, const char *file, int line, int z) {
  (void)pool; (void)file; (void)line; (void)z;
  void *np = bump_alloc(newSize);
  if (ptr && newSize > 0u) {
    uint32_t oldSize = lookup_alloc_size((uint32_t)(uintptr_t)ptr);
    uint32_t copyLen = (oldSize > 0u && oldSize < newSize) ? oldSize : newSize;
    memcpy(np, ptr, copyLen);
  }
  return np;
}

static void *__stdcall stub_storm_401(uint32_t size, const char *file, int line, uint32_t flags) {
  (void)file; (void)line; (void)flags;
  if (size == 0u) return NULL;
  return bump_alloc(size);
}
static BOOL __stdcall stub_storm_403(void *ptr, const char *file, int line, uint32_t flags) {
  (void)ptr; (void)file; (void)line; (void)flags;
  return TRUE;
}
static void *__stdcall stub_storm_405(void *ptr, uint32_t newSize, const char *file, int line, uint32_t flags) {
  (void)file; (void)line;
  if ((flags & 0x10u) != 0u) return NULL;
  if (newSize == 0u) return NULL;
  void *np = bump_alloc(newSize);
  if (ptr) {
    uint32_t oldSize = lookup_alloc_size((uint32_t)(uintptr_t)ptr);
    uint32_t copyLen = (oldSize > 0u && oldSize < newSize) ? oldSize : newSize;
    memcpy(np, ptr, copyLen);
  }
  return np;
}

static void __fastcall stub_fog_10050(void *pCs, int line) {
  (void)pCs; (void)line;
}

static void __stdcall stub_EnterCriticalSection(void *pCs) {
  (void)pCs;
}

static void __stdcall stub_LeaveCriticalSection(void *pCs) {
  (void)pCs;
}

static DWORD __stdcall stub_GetTickCount(void) {
  return g_fake_tick_count;
}

static BOOL __stdcall stub_QueryPerformanceCounter(LARGE_INTEGER *lpOut) {
  if (lpOut) {
    lpOut->u.LowPart  = g_fake_qpc_lo;
    lpOut->u.HighPart = (LONG)g_fake_qpc_hi;
  }
  return TRUE;
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

static void install_hooks(void) {
  struct { uint32_t ord; void *fn; } fogHooks[] = {
    { 10024u, (void *)(uintptr_t)stub_fog_10024 },
    { 10042u, (void *)(uintptr_t)stub_fog_10042 },
    { 10043u, (void *)(uintptr_t)stub_fog_10043 },
    { 10045u, (void *)(uintptr_t)stub_fog_10045 },
    { 10046u, (void *)(uintptr_t)stub_fog_10046 },
    { 10047u, (void *)(uintptr_t)stub_fog_10047 },
    { 10050u, (void *)(uintptr_t)stub_fog_10050 },
  };
  for (size_t i = 0; i < sizeof(fogHooks) / sizeof(fogHooks[0]); i++) {
    void *orig = (void *)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(fogHooks[i].ord));
    if (!orig) {
      fprintf(stderr, "[k6-w15] missing Fog.#%u\n", fogHooks[i].ord);
      TerminateProcess(GetCurrentProcess(), 23);
    }
    hook_module_iat_ptr(g_hCom, orig, fogHooks[i].fn);
    hook_module_iat_ptr(g_hGame, orig, fogHooks[i].fn);
  }
  struct { uint32_t ord; void *fn; } stormHooks[] = {
    { 401u, (void *)(uintptr_t)stub_storm_401 },
    { 403u, (void *)(uintptr_t)stub_storm_403 },
    { 405u, (void *)(uintptr_t)stub_storm_405 },
  };
  for (size_t i = 0; i < sizeof(stormHooks) / sizeof(stormHooks[0]); i++) {
    void *orig = (void *)(uintptr_t)GetProcAddress(g_hStorm, MAKEINTRESOURCEA(stormHooks[i].ord));
    if (orig) {
      hook_module_iat_ptr(g_hGame, orig, stormHooks[i].fn);
    }
  }
  HMODULE hK32 = GetModuleHandleA("kernel32.dll");
  if (hK32) {
    void *origTick = (void *)(uintptr_t)GetProcAddress(hK32, "GetTickCount");
    if (origTick) {
      hook_module_iat_ptr(g_hCom, origTick, (void *)(uintptr_t)stub_GetTickCount);
      hook_module_iat_ptr(g_hGame, origTick, (void *)(uintptr_t)stub_GetTickCount);
    }
    void *origQpc = (void *)(uintptr_t)GetProcAddress(hK32, "QueryPerformanceCounter");
    if (origQpc) {
      hook_module_iat_ptr(g_hGame, origQpc, (void *)(uintptr_t)stub_QueryPerformanceCounter);
    }
    void *origEnterCs = (void *)(uintptr_t)GetProcAddress(hK32, "EnterCriticalSection");
    if (origEnterCs) {
      hook_module_iat_ptr(g_hGame, origEnterCs, (void *)(uintptr_t)stub_EnterCriticalSection);
    }
    void *origLeaveCs = (void *)(uintptr_t)GetProcAddress(hK32, "LeaveCriticalSection");
    if (origLeaveCs) {
      hook_module_iat_ptr(g_hGame, origLeaveCs, (void *)(uintptr_t)stub_LeaveCriticalSection);
    }
  }
}

/* ------------------------------- PAGEIMG Loader */

static void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-w15] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-w15] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_PREF_BASE + 0x99000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-w15] short read at page %u\n", i);
      TerminateProcess(GetCurrentProcess(), 12);
    }
    uint32_t va = 0;
    memcpy(&va, pageBuf, 4);
    if (va >= DATATBLS_BASE && va < DATATBLS_BASE + DATATBLS_SIZE) {
      memcpy((void *)(uintptr_t)va, pageBuf + 4, 4096);
    } else if (va >= (D2COM_PREF_BASE + 0x99000u) && va < (D2COM_PREF_BASE + 0xA3000u)) {
      memcpy((void *)(uintptr_t)(va + g_com_rebase), pageBuf + 4, 4096);
    }
  }
  fclose(fp);
}

/* ------------------------------- Staged Arena Memory Serializer */

static char g_pre_json[262144];

static uint8_t read_canon_byte(uint32_t addr, uint32_t startAddr, uint32_t endAddr) {
  uint32_t aligned = addr & ~3u;
  if (g_game_rebase != 0 && aligned >= startAddr && aligned + 4u <= endAddr) {
    uint32_t lo = (uint32_t)(uintptr_t)g_hGame;
    uint32_t hi = lo + 0x130000u;
    uint32_t v = U32(aligned);
    if (v >= lo && v < hi) {
      v -= (uint32_t)g_game_rebase;
      return (uint8_t)((v >> ((addr & 3u) * 8u)) & 0xFFu);
    }
  }
  return U8(addr);
}

static void format_mem_runs_range(
    char *out, size_t cap, size_t *lenPtr, uint32_t startAddr, uint32_t endAddr, int *first, uint32_t displayDelta) {
  static const char hexChars[] = "0123456789abcdef";
  size_t len = *lenPtr;
  uint32_t a = startAddr;
  while (a < endAddr) {
    uint32_t chunkEnd = (a + 16u <= endAddr) ? (a + 16u) : endAddr;
    int nz = 0;
    for (uint32_t k = a; k < chunkEnd; k++) {
      if (read_canon_byte(k, startAddr, endAddr) != 0) { nz = 1; break; }
    }
    if (!nz) { a = chunkEnd; continue; }
    uint32_t runStart = a;
    uint32_t runEnd   = chunkEnd;
    while (runEnd < endAddr && (runEnd - runStart) < 512u) {
      uint32_t nextEnd = (runEnd + 16u <= endAddr) ? (runEnd + 16u) : endAddr;
      int nextNz = 0;
      for (uint32_t k = runEnd; k < nextEnd; k++) {
        if (read_canon_byte(k, startAddr, endAddr) != 0) { nextNz = 1; break; }
      }
      if (!nextNz) break;
      runEnd = nextEnd;
    }
    int n = snprintf(out + len, cap - len, "%s{\"addr\":\"0x%08X\",\"hex\":\"", (*first ? "" : ","), runStart - displayDelta);
    len += (size_t)n;
    *first = 0;
    for (uint32_t k = runStart; k < runEnd; k++) {
      uint8_t b = read_canon_byte(k, startAddr, endAddr);
      if (len + 4 >= cap) {
        fprintf(stderr, "[k6-w15] stage json overflow\n");
        TerminateProcess(GetCurrentProcess(), 24);
      }
      out[len++] = hexChars[(b >> 4) & 0xFu];
      out[len++] = hexChars[b & 0xFu];
    }
    out[len++] = '"';
    out[len++] = '}';
    out[len] = '\0';
    a = runEnd;
  }
  *lenPtr = len;
}

static void capture_stage_json(char *out, size_t cap, uint32_t setupTop) {
  size_t len = 0;
  int first = 1;
  out[len++] = '[';
  out[len] = '\0';
  format_mem_runs_range(out, cap, &len, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, &first, 0u);
  if (setupTop > STAGE_SETUP_BASE) {
    format_mem_runs_range(out, cap, &len, STAGE_SETUP_BASE, setupTop, &first, 0u);
  }
  for (uint32_t i = 0u; i < g_extra_cap_count; i++) {
    uint32_t liveAddr = g_extra_caps[i].canonAddr + (uint32_t)g_game_rebase;
    format_mem_runs_range(out, cap, &len, liveAddr, liveAddr + g_extra_caps[i].len, &first, (uint32_t)g_game_rebase);
  }
  out[len++] = ']';
  out[len] = '\0';
}

/* ------------------------------- Staged World Builders */

static uint32_t game_global_live(uint32_t canonVa) {
  return canonVa + (uint32_t)g_game_rebase;
}

static void reset_case(void) {
  memset((void *)(uintptr_t)STAGE_BASE, 0, STAGE_FIXED_SIZE);
  g_in_setup_phase  = 1;
  g_setup_top       = STAGE_SETUP_BASE;
  g_heap_top        = HEAP_BASE;
  g_alloc_count     = 0u;
  g_extra_cap_count = 0u;
  g_fake_tick_count = 0u;
  g_fake_qpc_lo     = 0u;
  g_fake_qpc_hi     = 0u;

  U8(STAGE_GAME + 0x6Du)  = 0u;
  U32(STAGE_GAME + 0x70u) = 1u;
  U16(STAGE_GAME + 0x78u) = 100u; /* item format v1.13c */
  U32(STAGE_GAME + 0xA8u) = 100u;
  U32(STAGE_GAME + 0xD0u) = 0x13579BDFu;
  U32(STAGE_GAME + 0xD4u) = 0x0000029Au;

  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
  U32(STAGE_CLIENT + 0x1A8u)   = STAGE_GAME;
}

static uint32_t stage_timer_queue(void) {
  uint32_t pTimer = (uint32_t)(uintptr_t)bump_alloc(0xA20u);
  uint32_t pChunk = (uint32_t)(uintptr_t)bump_alloc(0x7088u);
  for (uint32_t i = 0; i < 15u; i++) {
    U32(pChunk + i * 0x30u + 0x1Cu) = pChunk + (i + 1u) * 0x30u;
  }
  U32(pChunk + 0x7080u) = pChunk;
  U32(pTimer + 0xA1Cu)  = pChunk;
  U32(STAGE_GAME + 0xB8u) = pTimer;
  return pTimer;
}

static void stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  U32(pAct + 0x08u)         = 1u;
  U32(pAct + 0x10u)         = pRoom;
  U32(pAct + 0x48u)         = STAGE_DRLG0;
  U32(STAGE_DRLG0 + 0x47Cu) = pLevel;
  for (uint32_t a = 0; a < 5u; a++) {
    if (U32(STAGE_GAME + 0xBCu + a * 4u) == 0u) {
      U32(STAGE_GAME + 0xBCu + a * 4u) = pAct;
    }
  }
  U32(pRoom + 0x10u)    = pRoomEx;
  U32(pRoom + 0x2Cu)    = pAct;
  U32(pRoom + 0x4Cu)    = 4800u;
  U32(pRoom + 0x50u)    = 4800u;
  U32(pRoom + 0x54u)    = 1000u;
  U32(pRoom + 0x58u)    = 1000u;
  U32(pRoom + 0x6Cu)    = 0x2468ACE1u;
  U32(pRoom + 0x70u)    = 0x0000029Au;
  U32(pRoomEx + 0x30u)  = pRoom;
  U32(pRoomEx + 0x58u)  = pLevel;
  U32(pLevel + 0x1B4u)  = STAGE_DRLG0;
  U32(pLevel + 0x1D0u)  = levelId;
}

static void stage_room_with_coll(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  stage_room(pRoom, pRoomEx, pLevel, levelId);
  uint32_t ppNear = (uint32_t)(uintptr_t)bump_alloc(8u);
  U32(ppNear) = pRoom;
  U32(pRoom + 0x00u) = ppNear;
  U32(pRoom + 0x24u) = 1u;
  uint32_t pColl = (uint32_t)(uintptr_t)bump_alloc(0x28u);
  uint32_t pMap  = (uint32_t)(uintptr_t)bump_alloc(32u * 32u * 2u);
  U32(pColl + 0x00u) = 4992u;
  U32(pColl + 0x04u) = 4992u;
  U32(pColl + 0x08u) = 32u;
  U32(pColl + 0x0Cu) = 32u;
  U32(pColl + 0x10u) = 998u;
  U32(pColl + 0x14u) = 998u;
  U32(pColl + 0x18u) = 6u;
  U32(pColl + 0x1Cu) = 6u;
  U32(pColl + 0x20u) = pMap;
  U32(pColl + 0x24u) = pMap + 32u * 32u * 2u;
  U32(pRoom + 0x20u) = pColl;
  U32(pRoom + 0x4Cu) = 4992u;
  U32(pRoom + 0x50u) = 4992u;
  U32(pRoom + 0x54u) = 32u;
  U32(pRoom + 0x58u) = 32u;
  U32(pRoom + 0x5Cu) = 998u;
  U32(pRoom + 0x60u) = 998u;
  U32(pRoom + 0x64u) = 6u;
  U32(pRoom + 0x68u) = 6u;
}

static void stage_dynamic_path(uint32_t pUnit, uint32_t pPath, uint32_t pRoom, uint16_t x, uint16_t y) {
  U32(pUnit + 0x2Cu)  = pPath;
  U16(pPath + 0x00u)  = 0x8000u;
  U16(pPath + 0x02u)  = x;
  U16(pPath + 0x04u)  = 0x8000u;
  U16(pPath + 0x06u)  = y;
  U32(pPath + 0x1Cu)  = pRoom;
  U32(pPath + 0x30u)  = pUnit;
  U32(pPath + 0x7Cu)  = 0x1800u;
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
  static const uint32_t kHashOff[6] = { 0x1120u, 0x1320u, 0x1520u, 0x1920u, 0x1720u, 0x1B20u };
  uint32_t uType = U32(pUnit + 0x00u);
  if (uType >= 6u) return;
  uint32_t guid = U32(pUnit + 0x0Cu);
  uint32_t headAddr = (uType == 5u)
                          ? (pGame + kHashOff[uType])
                          : (pGame + kHashOff[uType] + ((guid & 0x7Fu) << 2));
  uint32_t prev = 0u;
  uint32_t cur = U32(headAddr);
  while (cur != 0u && U32(cur + 0x0Cu) > guid) {
    prev = cur;
    cur = U32(cur + 0xE4u);
  }
  U32(pUnit + 0xE4u) = cur;
  if (prev == 0u) {
    U32(headAddr) = pUnit;
  } else {
    U32(prev + 0xE4u) = pUnit;
  }
}

static void stage_unit_common(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t uType, uint32_t classId, uint32_t guid, uint32_t mode,
    uint16_t x, uint16_t y, uint32_t seedLo) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  U32(pUnit + 0x00u) = uType;
  U32(pUnit + 0x04u) = classId;
  U32(pUnit + 0x0Cu) = guid;
  U32(pUnit + 0x10u) = mode;
  U32(pUnit + 0x14u) = pUData;
  U8(pUnit + 0x18u)  = 0u;
  U32(pUnit + 0x1Cu) = pAct;
  U32(pUnit + 0x20u) = seedLo ? seedLo : 0x12345679u;
  U32(pUnit + 0x24u) = 0x0000029Au;
  U32(pUnit + 0x28u) = seedLo ? seedLo : 0x12345679u;
  U32(pUnit + 0x80u) = STAGE_GAME;
  U32(pUnit + 0xC4u) = 0x00000004u;
  if (pPath != 0u) {
    if (uType == 2u || uType == 4u || uType == 5u) {
      stage_static_path(pUnit, pPath, pRoom, (int32_t)x, (int32_t)y);
    } else {
      stage_dynamic_path(pUnit, pPath, pRoom, x, y);
    }
  }
  if (uType == 2u && pUData != 0u) {
    uint32_t pObjectsBase = U32(D2COM_PREF_BASE + 0xA0B94u + g_com_rebase);
    uint32_t nObjectsCnt  = U32(D2COM_PREF_BASE + 0xA0B98u + g_com_rebase);
    if (classId < nObjectsCnt) {
      U32(pUData + 0x00u) = pObjectsBase + classId * 0x1C0u;
    }
  }
  fn_CreateStatListEx((void *)(uintptr_t)pUnit, 0u, NULL, (void *)(uintptr_t)STAGE_GAME);
}

static void stage_monster_full(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint32_t mode,
    uint16_t x, uint16_t y, uint32_t seedLo) {
  if (U32(STAGE_GAME + 0xF0u) == 0u) {
    U32(STAGE_GAME + 0xF0u) = (uint32_t)(uintptr_t)bump_alloc(0x300u);
  }
  stage_unit_common(pUnit, pUData, pPath, pRoom, 1u, classId, guid, mode, x, y, seedLo);
  if (pUData != 0u) {
    uint32_t pTables  = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
    uint32_t pMonBase = U32(pTables + 0xA78u);
    uint32_t nMonCnt  = U32(pTables + 0xA80u);
    if (classId < nMonCnt) {
      U32(pUData + 0x00u) = pMonBase + classId * 0x1A8u;
    }
    uint32_t pAiGen  = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    uint32_t pAiCtrl = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    U32(pUData + 0x28u) = pAiGen;
    U32(pUData + 0x2Cu) = pAiCtrl;
  }
}

static void stage_item_unit(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint32_t quality, uint32_t ilvl,
    uint16_t format, uint32_t seedLo) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 4u, classId, guid, 3u, 5000u, 5000u, seedLo);
  U32(pUData + 0x00u) = quality;
  U32(pUData + 0x04u) = seedLo ? seedLo : 0x12345679u;
  U32(pUData + 0x08u) = 0x0000029Au;
  U32(pUData + 0x0Cu) = 0u;
  U32(pUData + 0x10u) = seedLo ? seedLo : 0x12345679u;
  U32(pUData + 0x18u) = 0x00000010u; /* ITEMFLAG_IDENTIFIED */
  U32(pUData + 0x2Cu) = ilvl;
  U16(pUData + 0x30u) = format;
}

static void link_player_client(uint32_t pUnit, uint32_t pUData, uint32_t pCli, uint32_t guid) {
  U32(pUData + 0x9Cu) = pCli;
  U32(pCli + 0x00u)   = guid;
  U32(pCli + 0x04u)   = 4u;
  U32(pCli + 0x16Cu)  = 0u;
  U32(pCli + 0x170u)  = guid;
  U32(pCli + 0x174u)  = pUnit;
  U32(pCli + 0x1A8u)  = STAGE_GAME;
  U32(pCli + 0x3D4u)  = 1u;
  if (U32(STAGE_GAME + 0x88u) == 0u) {
    U32(STAGE_GAME + 0x88u) = pCli;
  }
}

static void stage_client_pkt_pool(uint32_t pCli) {
  uint32_t n0 = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  uint32_t n1 = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  U32(n0 + 0x204u) = n1;
  U32(pCli + 0x1C0u) = n0;
  U32(pCli + 0x1A8u) = STAGE_GAME;
}

static void stage_ai_param(
    uint32_t pAiParam, uint32_t pAiCtrl, uint32_t pTarget, uint32_t nDist, uint32_t bInMelee, uint32_t pMonStatsTxt) {
  U32(pAiParam + 0x00u) = pAiCtrl;
  U32(pAiParam + 0x08u) = pTarget;
  U32(pAiParam + 0x14u) = nDist;
  U32(pAiParam + 0x18u) = bInMelee;
  U32(pAiParam + 0x1Cu) = pMonStatsTxt;
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

static void canonicalize_d2game_ptrs_range(uint32_t startAddr, uint32_t endAddr) {
  uint32_t lo = (uint32_t)(uintptr_t)g_hGame;
  uint32_t hi = lo + 0x130000u;
  uint32_t delta = (uint32_t)g_game_rebase;
  uint32_t stkLo = (g_thunk_saved_esp > 0x4000u) ? (g_thunk_saved_esp - 0x4000u) : 0u;
  uint32_t stkHi = g_thunk_saved_esp + 0x1000u;
  for (uint32_t a = startAddr; a + 4u <= endAddr; a += 4u) {
    uint32_t v = U32(a);
    if (delta != 0u && v >= lo && v < hi) {
      U32(a) = v - delta;
    } else if (stkLo != 0u && v >= stkLo && v < stkHi) {
      U32(a) = 0x7E000000u;
    }
  }
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
  static char postJson[262144];
  static const char hexChars[] = "0123456789abcdef";

  uint32_t setupTop = (g_setup_top + 15u) & ~15u;
  capture_stage_json(g_pre_json, sizeof(g_pre_json), setupTop);

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
            "[k6-w15] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-w15] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-w15] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-w15] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
              fnName, canonVa, caseIdx, label, actualPop, spec->calleePop);
      TerminateProcess(GetCurrentProcess(), 33);
    }
  }

  canonicalize_d2game_ptrs_range(STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE);
  if (setupTop > STAGE_SETUP_BASE) {
    canonicalize_d2game_ptrs_range(STAGE_SETUP_BASE, setupTop);
  }
  if (g_heap_top > HEAP_BASE) {
    canonicalize_d2game_ptrs_range(HEAP_BASE, g_heap_top);
  }
  capture_stage_json(postJson, sizeof(postJson), setupTop);

  fprintf(g_out_fp,
          "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseIdx\":%d,\"label\":\"%s\",\"tsArgs\":[",
          canonVa, fnName, caseIdx, label);
  for (uint32_t i = 0; i < nTsArgs; i++) {
    fprintf(g_out_fp, "%s%lld", (i == 0 ? "" : ","), (long long)tsArgs[i]);
  }
  uint32_t maskedRet = g_thunk_out_eax & retMask;
  if (g_game_rebase != 0 && retMask == 0xFFFFFFFFu) {
    uint32_t lo = (uint32_t)(uintptr_t)g_hGame;
    if (maskedRet >= lo && maskedRet < lo + 0x130000u) {
      maskedRet -= (uint32_t)g_game_rebase;
    }
  }
  fprintf(g_out_fp, "],\"extraCaps\":[");
  for (uint32_t i = 0u; i < g_extra_cap_count; i++) {
    fprintf(g_out_fp, "%s{\"addr\":\"0x%08X\",\"len\":%u}",
            (i == 0u ? "" : ","), g_extra_caps[i].canonAddr, g_extra_caps[i].len);
  }
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

typedef struct {
  uint32_t dwCode;
  int32_t  nRow;
} TxtLinkNode;

typedef struct {
  int32_t      nRecords;
  uint32_t     dwPad;
  TxtLinkNode *pNodes;
} TxtLinkHeader;

static TxtLinkNode   g_items_txtlink_nodes[1024];
static TxtLinkHeader g_items_txtlink;

static void discover_table_ids(void) {
  reset_case();
  uint32_t nItems = U32(D2COM_PREF_BASE + 0x9FB94u + g_com_rebase);
  uint32_t pItems = U32(D2COM_PREF_BASE + 0x9FB98u + g_com_rebase);
  int32_t  nLink  = 0;
  for (uint32_t id = 0; id < nItems; id++) {
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    if (!g_item_sword && code == 0x20647373u) g_item_sword = id; /* 'ssd ' */
    if (!g_item_bow   && code == 0x20776273u) g_item_bow   = id; /* 'sbw ' */
    if (!g_item_ring  && code == 0x206E6972u) g_item_ring  = id; /* 'rin ' */
    if (!g_item_armor && code == 0x20697571u) g_item_armor = id; /* 'qui ' */
    if (nLink < 1024) {
      int32_t pos = nLink;
      while (pos > 0 && g_items_txtlink_nodes[pos - 1].dwCode > code) {
        g_items_txtlink_nodes[pos] = g_items_txtlink_nodes[pos - 1];
        pos--;
      }
      g_items_txtlink_nodes[pos].dwCode = code;
      g_items_txtlink_nodes[pos].nRow   = (int32_t)id;
      nLink++;
    }
  }
  g_items_txtlink.nRecords = nLink;
  g_items_txtlink.dwPad    = 0u;
  g_items_txtlink.pNodes   = g_items_txtlink_nodes;
  U32(D2COM_PREF_BASE + 0x9FF6Cu + g_com_rebase) = (uint32_t)(uintptr_t)&g_items_txtlink;
}

/* =========================================================================
 * BATCH 1 — 14 Trivial No-Op / StatusFilter / ReturnOne / AlwaysTrue VAs
 * ========================================================================= */
static void emit_batch_1_trivial(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[48];

  /* 1-2: mov eax, 1; ret 4 */
  static const struct { uint32_t va; const char *name; } kRet4One[] = {
    { 0x6FC4E5C0u, "OBJECTS_LevelHookAlwaysTrue113c" },
    { 0x6FC58EC0u, "MISSILES_SrvDo_ReturnOne_6FC58EC0_113c" },
  };
  for (size_t i = 0; i < sizeof(kRet4One) / sizeof(kRet4One[0]); i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U32(STAGE_SCRATCH) = 0x10100001u + (uint32_t)k * 0x111u;
      c = make_call();
      c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
      c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
      snprintf(lbl, sizeof(lbl), "ret4_one_k%d", k);
      run_and_emit(kRet4One[i].va, kRet4One[i].name, k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
    }
  }

  /* 3-5: ret (void) */
  static const struct { uint32_t va; const char *name; } kRet0Void[] = {
    { 0x6FC4E720u, "OBJECTS_InitFn05_NoOp113c" },
    { 0x6FC80180u, "ACT4_IntroCallback08Noop_6FC80180_113c" },
    { 0x6FC94890u, "MONSTER_EndModeS3Noop113c" },
  };
  for (size_t i = 0; i < sizeof(kRet0Void) / sizeof(kRet0Void[0]); i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U32(STAGE_SCRATCH) = 0x20200001u + (uint32_t)k * 0x222u;
      c = make_call();
      c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
      snprintf(lbl, sizeof(lbl), "ret0_void_k%d", k);
      run_and_emit(kRet0Void[i].va, kRet0Void[i].name, k, lbl, &c, ts, 2, 0u, 0);
    }
  }

  /* 6-7: xor eax, eax; ret */
  static const struct { uint32_t va; const char *name; } kRet0Zero[] = {
    { 0x6FC90170u, "PLRTRADE_TradeButtonNoopAction3_113c" },
    { 0x6FC90180u, "PLRTRADE_TradeButtonNoopAction2_113c" },
  };
  for (size_t i = 0; i < sizeof(kRet0Zero) / sizeof(kRet0Zero[0]); i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U32(STAGE_SCRATCH) = 0x30300001u + (uint32_t)k * 0x333u;
      c = make_call();
      c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
      snprintf(lbl, sizeof(lbl), "ret0_zero_k%d", k);
      run_and_emit(kRet0Zero[i].va, kRet0Zero[i].name, k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
    }
  }

  /* 8-9: xor al, al; ret 0xc */
  static const struct { uint32_t va; const char *name; } kStatusFilters[] = {
    { 0x6FC80170u, "ACT4_IntroStatusFilter_6FC80170_113c" },
    { 0x6FC80800u, "ACT1_IntroStatusFilter_6FC80800_113c" },
  };
  for (size_t i = 0; i < sizeof(kStatusFilters) / sizeof(kStatusFilters[0]); i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U32(STAGE_SCRATCH) = 0x40400001u + (uint32_t)k * 0x444u;
      c = make_call();
      c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0;
      c.nargs = 3;
      c.args[0] = STAGE_SCRATCH; c.args[1] = STAGE_SCRATCH + 0x20u; c.args[2] = STAGE_SCRATCH + 0x40u;
      c.calleePop = 0x0Cu;
      ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0;
      ts[2] = STAGE_SCRATCH; ts[3] = STAGE_SCRATCH + 0x20u; ts[4] = STAGE_SCRATCH + 0x40u;
      snprintf(lbl, sizeof(lbl), "status_filter_k%d", k);
      run_and_emit(kStatusFilters[i].va, kStatusFilters[i].name, k, lbl, &c, ts, 5, 0xFFu, 0);
    }
  }

  /* 10-12: mov eax, 1; ret 8 */
  static const struct { uint32_t va; const char *name; } kRet8One[] = {
    { 0x6FC97920u, "PLAYER_SkillModeNoopHandler_04_09_113c" },
    { 0x6FC97930u, "PLAYER_SkillModeNoopHandler_01_05_113c" },
    { 0x6FC97940u, "PLAYER_SkillModeNoopHandler_00_17_113c" },
  };
  for (size_t i = 0; i < sizeof(kRet8One) / sizeof(kRet8One[0]); i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U32(STAGE_SCRATCH) = 0x50500001u + (uint32_t)k * 0x555u;
      c = make_call();
      c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
      c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = (uint32_t)(k + 1);
      c.calleePop = 8u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = k + 1;
      snprintf(lbl, sizeof(lbl), "ret8_one_k%d", k);
      run_and_emit(kRet8One[i].va, kRet8One[i].name, k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
    }
  }

  /* 13-14: ret 4 (void) */
  static const struct { uint32_t va; const char *name; } kRet4Void[] = {
    { 0x6FC9B4E0u, "AITHINK_Fn146_UberMephistoNoop113c" },
    { 0x6FCBC990u, "MONAI_NoOpStub_6FCBC990_113c" },
  };
  for (size_t i = 0; i < sizeof(kRet4Void) / sizeof(kRet4Void[0]); i++) {
    for (int k = 0; k < 3; k++) {
      reset_case();
      U32(STAGE_SCRATCH) = 0x60600001u + (uint32_t)k * 0x666u;
      c = make_call();
      c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
      c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
      snprintf(lbl, sizeof(lbl), "ret4_void_k%d", k);
      run_and_emit(kRet4Void[i].va, kRet4Void[i].name, k, lbl, &c, ts, 3, 0u, 0);
    }
  }
}

/* =========================================================================
 * BATCH 2 — 17 Newly-Unblocked Item / Object / Rack / Affix / Ear VAs
 * ========================================================================= */
static void emit_batch_2_items_objects(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[48];

  /* [B2-01] 0x6FC2FFC0 ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(game_global_live(D2GAME_PREF_BASE + 0x119FA0u)) = 0u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x119FA4u)) = 0u;
    add_extra_cap(D2GAME_PREF_BASE + 0x119FA0u, 8u);
    U32(STAGE_SCRATCH + 0x00u) = 0x11111111u + (uint32_t)k * 0x22222223u;
    U32(STAGE_SCRATCH + 0x04u) = 0x0000029Au;
    uint32_t nLvl = (k == 0) ? 10u : (k == 1) ? 35u : 66u; /* k=2 asserts 0x180 */
    c = make_call();
    c.esi = STAGE_SCRATCH; c.edi = nLvl;
    c.nargs = 4;
    c.args[0] = STAGE_GAME; c.args[1] = 0xFFFFFFFFu; c.args[2] = 0u; c.args[3] = 0u;
    c.calleePop = 0x10u;
    ts[0] = STAGE_SCRATCH; ts[1] = (int64_t)nLvl; ts[2] = STAGE_GAME;
    ts[3] = -1; ts[4] = 0; ts[5] = 0;
    snprintf(lbl, sizeof(lbl), "roll_drop_k%d", k);
    run_and_emit(0x6FC2FFC0u, "ITEMS_RollWeightedDropClassIdByLevel_6FC2FFC0_113c",
                 k, lbl, &c, ts, 6, 0xFFFFFFFFu, (k == 2 ? 1 : 0));
  }

  /* [B2-02] 0x6FC30240 ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                    g_item_ring, 100u + (uint32_t)k, 4u, 30u + (uint32_t)k * 10u,
                    (k == 2 ? 0u : 100u), 0x12340001u + (uint32_t)k * 0x7777u);
    U32(STAGE_SCRATCH + 0x0Cu) = 30u + (uint32_t)k * 10u;
    if (k == 1) { U32(STAGE_SCRATCH + 0x68u) = 5u; } /* forced prefix */
    c = make_call();
    c.esi = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "magic_affix_strict_k%d", k);
    run_and_emit(0x6FC30240u, "ITEMS_RollAndApplyMagicAffixesStrict_6FC30240_113c",
                 k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B2-03] 0x6FC31E20 ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u + (uint32_t)k * 10u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x33330001u + (uint32_t)k * 0x12345u;
    U32(STAGE_SCRATCH + 0x00u) = 5004u;
    U32(STAGE_SCRATCH + 0x04u) = 5004u;
    c = make_call();
    c.esi = STAGE_GAME;
    c.nargs = 5;
    c.args[0] = STAGE_ROOM0; c.args[1] = STAGE_SCRATCH;
    c.args[2] = 0xFFFFFFFFu; c.args[3] = (uint32_t)(k == 1 ? 1 : 0); c.args[4] = 0u;
    c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = STAGE_SCRATCH;
    ts[3] = -1; ts[4] = (k == 1 ? 1 : 0); ts[5] = 0;
    snprintf(lbl, sizeof(lbl), "spawn_weapon_k%d", k);
    run_and_emit(0x6FC31E20u, "ITEMS_SpawnRandomCompactWeaponInRoomAtCoords_6FC31E20_113c",
                 k, lbl, &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [B2-04] 0x6FC31FB0 ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u + (uint32_t)k * 10u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x44440001u + (uint32_t)k * 0x12345u;
    U32(STAGE_SCRATCH + 0x00u) = 5005u;
    U32(STAGE_SCRATCH + 0x04u) = 5005u;
    c = make_call();
    c.eax = STAGE_SCRATCH; c.ecx = STAGE_ROOM0; c.ebx = STAGE_GAME;
    c.nargs = 3;
    c.args[0] = 0xFFFFFFFFu; c.args[1] = (uint32_t)(k == 1 ? 1 : 0); c.args[2] = 0u;
    c.calleePop = 0x0Cu;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_ROOM0; ts[2] = STAGE_GAME;
    ts[3] = -1; ts[4] = (k == 1 ? 1 : 0); ts[5] = 0;
    snprintf(lbl, sizeof(lbl), "spawn_armor_k%d", k);
    run_and_emit(0x6FC31FB0u, "ITEMS_SpawnRandomArmorInRoomAtCoords_6FC31FB0_113c",
                 k, lbl, &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [B2-05] 0x6FC32230 ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(game_global_live(D2GAME_PREF_BASE + 0x119FA0u)) = 0u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x119FA4u)) = 0u;
    add_extra_cap(D2GAME_PREF_BASE + 0x119FA0u, 8u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u + (uint32_t)k * 8u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x55550001u + (uint32_t)k * 0x23457u;
    U32(STAGE_SCRATCH + 0x00u) = 5006u;
    U32(STAGE_SCRATCH + 0x04u) = 5006u;
    uint32_t pOutDrop = STAGE_SCRATCH + 0x20u;
    c = make_call();
    c.eax = STAGE_SCRATCH;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = pOutDrop;
    c.calleePop = 0x0Cu;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_GAME; ts[2] = STAGE_ROOM0; ts[3] = pOutDrop;
    snprintf(lbl, sizeof(lbl), "spawn_room_drop_k%d", k);
    run_and_emit(0x6FC32230u, "ITEMS_SpawnRandomRoomDropAtCoords_6FC32230_113c",
                 k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B2-06] 0x6FC348A0 ITEMS_RollAutoMagicAffixId_6FC348A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                    g_item_ring, 200u + (uint32_t)k, 4u, 25u + (uint32_t)k * 10u, 0u,
                    0x77770001u + (uint32_t)k * 0x1357u);
    c = make_call();
    c.nargs = 6;
    c.args[0] = STAGE_UNIT0;
    c.args[1] = 1u;                 /* bAllowMagicOnly */
    c.args[2] = 1u;                 /* bForceRoll */
    c.args[3] = (k == 2 ? 1u : 0u); /* bApplyProps */
    c.args[4] = (k == 1 ? 0u : 1u); /* bIsPrefix */
    c.args[5] = 0u;                 /* nForcedIndex */
    c.calleePop = 0x18u;
    ts[0] = STAGE_UNIT0; ts[1] = 1; ts[2] = 1; ts[3] = (k == 2 ? 1 : 0);
    ts[4] = (k == 1 ? 0 : 1); ts[5] = 0;
    snprintf(lbl, sizeof(lbl), "roll_automagic_k%d", k);
    run_and_emit(0x6FC348A0u, "ITEMS_RollAutoMagicAffixId_6FC348A0_113c",
                 k, lbl, &c, ts, 6, 0xFFFFu, 0);
  }

  /* [B2-08] 0x6FC34BF0 ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t ilvl = (k == 0) ? 20u : (k == 1) ? 55u : 80u;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                    g_item_ring, 210u + (uint32_t)k, 8u, ilvl, 100u,
                    0x88880001u + (uint32_t)k * 0x3579u);
    U32(STAGE_SCRATCH + 0x0Cu) = ilvl;
    c = make_call();
    c.esi = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "crafted_affix_k%d", k);
    run_and_emit(0x6FC34BF0u, "ITEMS_RollAndApplyCraftedItemAffixes_6FC34BF0_113c",
                 k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B2-09] 0x6FC34F20 ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t ilvl = (k == 0) ? 25u : (k == 1) ? 50u : 75u;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                    (k == 2 ? g_item_sword : g_item_ring), 220u + (uint32_t)k, 6u, ilvl, 100u,
                    0x99990001u + (uint32_t)k * 0x468Au);
    U32(STAGE_SCRATCH + 0x0Cu) = ilvl;
    c = make_call();
    c.esi = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "rare_affix_k%d", k);
    run_and_emit(0x6FC34F20u, "ITEMS_RollAndApplyTemperedOrRareItemAffixes_6FC34F20_113c",
                 k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B2-10] 0x6FC7E940 ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 114u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      1u, 1u, 300u + (uint32_t)k, 1u, 5006u, 5006u, 0xA1A10001u + (uint32_t)k);
    U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u) = 0x21u;
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x09u)  = (k == 0) ? 0u : 1u;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0xA4u) = (k == 1) ? 1u : 0u;
    c = make_call();
    c.ecx = STAGE_GAME; c.eax = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "frozen_anya_k%d", k);
    run_and_emit(0x6FC7E940u, "ACT5Q3_SpawnFrozenAnyaMonsterObject_6FC7E940_113c",
                 k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [B2-11] 0x6FC8AFA0 OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      2u, 1u, 310u + (uint32_t)k, 1u, 5006u, 5006u, 0xB1B10001u + (uint32_t)k);
    uint32_t code = (k == 0) ? 0x7A7A7A7Au : (k == 1) ? 0x206E6972u : 0x20647373u;
    uint32_t qual = (k == 1) ? 2u : 4u;
    c = make_call();
    c.eax = code; c.ebx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = qual; c.calleePop = 8u;
    ts[0] = (int64_t)code; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME; ts[3] = (int64_t)qual;
    snprintf(lbl, sizeof(lbl), "obj_spawn_item_k%d", k);
    run_and_emit(0x6FC8AFA0u, "OBJ_SpawnItemByCodeNearUnit_6FC8AFA0_113c",
                 k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B2-12] 0x6FC8B070 ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      0u, 1u, 320u + (uint32_t)k, 1u, 5006u, 5006u, 0xC1C10001u + (uint32_t)k);
    uint32_t itemId = (k == 0) ? g_item_ring : (k == 1) ? g_item_sword : g_item_bow;
    c = make_call();
    c.nargs = 4;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = itemId; c.args[3] = 0u;
    c.calleePop = 0x10u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int64_t)itemId; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "cube_drop_k%d", k);
    run_and_emit(0x6FC8B070u, "ACT2Q2_SpawnCubeDropItemAndRemoveOld_6FC8B070_113c",
                 k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B2-13] 0x6FC8B280 OBJ_OperateFn20_WeaponRack_6FC8B280_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u + (uint32_t)k * 5u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0xD1D10001u + (uint32_t)k * 0x11111u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      2u, 1u, 330u + (uint32_t)k, (k == 2 ? 2u : 0u), 5006u, 5006u, 0xD1D10001u + (uint32_t)k);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "weapon_rack_k%d", k);
    run_and_emit(0x6FC8B280u, "OBJ_OperateFn20_WeaponRack_6FC8B280_113c",
                 k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-14] 0x6FC8B2E0 OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u + (uint32_t)k * 5u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0xE1E10001u + (uint32_t)k * 0x11111u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      2u, 1u, 340u + (uint32_t)k, (k == 2 ? 2u : 0u), 5006u, 5006u, 0xE1E10001u + (uint32_t)k);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "armor_stand_k%d", k);
    run_and_emit(0x6FC8B2E0u, "OBJ_OperateFn19_ArmorStand_6FC8B2E0_113c",
                 k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-15] 0x6FC8B430 OBJECTS_OperateGemShrine_6FC8B430_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      2u, 1u, 350u + (uint32_t)k, 0u, 5006u, 5006u, 0xF1F10001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0,
                      0u, 1u, 1u, 1u, 5006u, 5006u, 0x12345679u + (uint32_t)k * 0x10103u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "gem_shrine_k%d", k);
    run_and_emit(0x6FC8B430u, "OBJECTS_OperateGemShrine_6FC8B430_113c",
                 k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [B2-16] 0x6FC8BF00 OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      2u, 1u, 360u + (uint32_t)k, 0u, (uint16_t)(5006u + k), 5006u, 0x13130001u + (uint32_t)k);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "companion_a2_a0_k%d", k);
    run_and_emit(0x6FC8BF00u, "OBJ_SpawnCompanionObjectsA2AndA0_6FC8BF00_113c",
                 k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [B2-17] 0x6FC8DEC0 OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      2u, 13u, 370u + (uint32_t)k, (k == 2 ? 2u : 0u), 5006u, 5006u, 0x14140001u + (uint32_t)k);
    g_fake_tick_count = 0x1000u;
    U32(STAGE_UNIT0 + 0xD4u) = (k == 0) ? 0x0F00u : 0x0100u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x10u) = 13u;
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH; ts[1] = 0x1000;
    snprintf(lbl, sizeof(lbl), "toggle_door_k%d", k);
    run_and_emit(0x6FC8DEC0u, "OBJ_OperateToggleDoorWithCooldown_6FC8DEC0_113c",
                 k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }
}

/* =========================================================================
 * BATCH 3 — Clean Storm / Game / Trade / Party / NPC / Client / Loaded Items
 * ========================================================================= */
static void init_empty_tslist(uint32_t pList) {
  uint32_t pTail = pList + 0x04u;
  U32(pList + 0x00u) = 0u;
  U32(pList + 0x04u) = pTail;
  U32(pList + 0x08u) = ~pTail;
}

static void emit_batch_3_core_systems(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* [B3-01] 0x6FC22630 STORM_TSListArrayResize_6FC22630_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pArr = STAGE_SCRATCH;
    uint32_t oldCnt = (k == 0) ? 0u : (k == 1) ? 2u : 4u;
    uint32_t newCnt = (k == 0) ? 2u : (k == 1) ? 4u : 1u;
    uint32_t pOld = 0u;
    if (oldCnt > 0u) {
      pOld = (uint32_t)(uintptr_t)bump_alloc(oldCnt * 12u);
      for (uint32_t i = 0; i < oldCnt; i++) {
        init_empty_tslist(pOld + i * 12u);
      }
    }
    U32(pArr + 0x00u) = oldCnt;
    U32(pArr + 0x04u) = oldCnt;
    U32(pArr + 0x08u) = pOld;
    c = make_call();
    c.esi = pArr; c.eax = newCnt; c.calleePop = 0u;
    ts[0] = pArr; ts[1] = (int64_t)newCnt;
    snprintf(lbl, sizeof(lbl), "tslist_resize_k%d", k);
    run_and_emit(0x6FC22630u, "STORM_TSListArrayResize_6FC22630_113c",
                 k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [B3-02] 0x6FC222D0 STORM_TSHashTableGrowAndRehash_6FC222D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pTbl = STAGE_SCRATCH;
    uint32_t oldCnt = (k == 0) ? 1u : (k == 1) ? 2u : 4u;
    uint32_t pBuckets = (uint32_t)(uintptr_t)bump_alloc(oldCnt * 12u);
    for (uint32_t i = 0; i < oldCnt; i++) {
      init_empty_tslist(pBuckets + i * 12u);
    }
    U32(pTbl + 0x14u) = oldCnt;
    U32(pTbl + 0x18u) = oldCnt;
    U32(pTbl + 0x1Cu) = pBuckets;
    U32(pTbl + 0x24u) = oldCnt - 1u;
    c = make_call();
    c.nargs = 1; c.args[0] = pTbl; c.calleePop = 4u;
    ts[0] = pTbl;
    snprintf(lbl, sizeof(lbl), "tshash_grow_k%d", k);
    run_and_emit(0x6FC222D0u, "STORM_TSHashTableGrowAndRehash_6FC222D0_113c",
                 k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [B3-03] 0x6FC49BA0 GAME_LeaveGameCriticalSection_6FC49BA0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH) = 0x70700001u + (uint32_t)k;
    uint32_t pGameArg = (k == 0) ? 0u : STAGE_GAME;
    if (k == 2) {
      U32(STAGE_GAME + 0x18u) = STAGE_CS_GAME;
      EnterCriticalSection((CRITICAL_SECTION *)(uintptr_t)STAGE_CS_GAME);
    }
    c = make_call();
    c.eax = pGameArg; c.calleePop = 0u;
    ts[0] = pGameArg;
    snprintf(lbl, sizeof(lbl), "leave_game_cs_k%d", k);
    run_and_emit(0x6FC49BA0u, "GAME_LeaveGameCriticalSection_6FC49BA0_113c",
                 k, lbl, &c, ts, 1, 0u, (k < 2 ? 1 : 0));
  }

  /* [B3-04] 0x6FC4A210 GAME_SetGlobalSeed113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t seedVal = (k == 0) ? 0x12345678u : (k == 1) ? 0xDEADBEEFu : 0u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x10E354u)) = 0xFFFFFFFFu;
    add_extra_cap(D2GAME_PREF_BASE + 0x10E354u, 4u);
    c = make_call();
    c.nargs = 1; c.args[0] = seedVal; c.calleePop = 4u;
    ts[0] = (int64_t)seedVal;
    snprintf(lbl, sizeof(lbl), "set_global_seed_k%d", k);
    run_and_emit(0x6FC4A210u, "GAME_SetGlobalSeed113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [B3-05] 0x6FC4A220 GAME_ReserveGlobalGameSlot_6FC4A220_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x110C04u), 0, 0x1008u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x10E350u)) = (k == 2) ? 0x400u : 1u;
    if (k == 1) {
      U32(game_global_live(D2GAME_PREF_BASE + 0x110C08u)) = 0xFFFFFFFFu; /* slot 1 busy */
    }
    add_extra_cap(D2GAME_PREF_BASE + 0x10E350u, 4u);
    add_extra_cap(D2GAME_PREF_BASE + 0x110C04u, 0x20u);
    c = make_call();
    c.calleePop = 0u;
    snprintf(lbl, sizeof(lbl), "reserve_game_slot_k%d", k);
    run_and_emit(0x6FC4A220u, "GAME_ReserveGlobalGameSlot_6FC4A220_113c", k, lbl, &c, ts, 0, 0xFFFFu, 0);
  }

  /* [B3-06] 0x6FC4A900 GAME_InitSeed113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t forced = (k == 0) ? 0x11223344u : (k == 1) ? 0x55667788u : 0x0000007Fu;
    U32(game_global_live(D2GAME_PREF_BASE + 0x10E354u)) = forced;
    add_extra_cap(D2GAME_PREF_BASE + 0x10E354u, 4u);
    c = make_call();
    c.edi = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "init_game_seed_k%d", k);
    run_and_emit(0x6FC4A900u, "GAME_InitSeed113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [B3-07] 0x6FC4AAE0 GAME_LookupAndLockGameByKey_6FC4AAE0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH + 0x200u) = 0x80800001u + (uint32_t)k;
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C24u)) = 0u;
    add_extra_cap(D2GAME_PREF_BASE + 0x111C24u, 4u);
    if (k >= 1) {
      uint32_t pTbl = STAGE_SCRATCH;
      uint32_t pBuckets = (uint32_t)(uintptr_t)bump_alloc(4u * 12u);
      for (uint32_t i = 0; i < 4u; i++) init_empty_tslist(pBuckets + i * 12u);
      U32(pTbl + 0x14u) = 4u;
      U32(pTbl + 0x18u) = 4u;
      U32(pTbl + 0x1Cu) = pBuckets;
      U32(pTbl + 0x24u) = 3u;
      if (k == 2) {
        /* Link STAGE_GAME (key=5, pLock=0 -> asserts 0x112E) into bucket (5 & 3 = 1) */
        uint32_t pBkt = pBuckets + 12u;
        U32(STAGE_GAME + 0x00u) = 5u;
        U32(STAGE_GAME + 0x04u) = pBkt + 4u;
        U32(STAGE_GAME + 0x08u) = ~(pBkt + 4u);
        U32(pBkt + 0x04u) = STAGE_GAME + 4u;
        U32(pBkt + 0x08u) = STAGE_GAME;
        U32(STAGE_GAME + 0x18u) = 0u;
      }
      U32(game_global_live(D2GAME_PREF_BASE + 0x111C24u)) = pTbl;
    }
    uint32_t key = (k == 2) ? 5u : (uint32_t)(k + 1);
    c = make_call();
    c.nargs = 1; c.args[0] = key; c.calleePop = 4u;
    ts[0] = (int64_t)key;
    snprintf(lbl, sizeof(lbl), "lookup_lock_game_k%d", k);
    run_and_emit(0x6FC4AAE0u, "GAME_LookupAndLockGameByKey_6FC4AAE0_113c",
                 k, lbl, &c, ts, 1, 0xFFFFFFFFu, (k == 2 ? 1 : 0));
  }

  /* [B3-08] 0x6FC4ABD0 GAME_IsGameNameAvailable_6FC4ABD0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x110C04u), 0, 0x1008u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C24u)) = 0u;
    if (k == 1) {
      U32(game_global_live(D2GAME_PREF_BASE + 0x110C08u)) = 0xFFFFFFFFu;
    } else if (k == 2) {
      U32(game_global_live(D2GAME_PREF_BASE + 0x110C08u)) = 7u; /* lookup with pTable=0 -> 0 */
    }
    add_extra_cap(D2GAME_PREF_BASE + 0x111C24u, 4u);
    add_extra_cap(D2GAME_PREF_BASE + 0x110C04u, 0x10u);
    strcpy((char *)(uintptr_t)STAGE_SCRATCH, (k == 0) ? "GameAlpha" : (k == 1) ? "GameBeta" : "GameGamma");
    c = make_call();
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "game_name_avail_k%d", k);
    run_and_emit(0x6FC4ABD0u, "GAME_IsGameNameAvailable_6FC4ABD0_113c",
                 k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B3-09] 0x6FC4BC90 GAME_AssignUniqueGameName_6FC4BC90_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x110C04u), 0, 0x1008u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C24u)) = 0u;
    add_extra_cap(D2GAME_PREF_BASE + 0x111C24u, 4u);
    strcpy((char *)(uintptr_t)STAGE_SCRATCH, (k == 0) ? "BaalRun1" : (k == 1) ? "ChaosRun2" : "CowGame3");
    c = make_call();
    c.eax = STAGE_GAME; c.edi = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "assign_game_name_k%d", k);
    run_and_emit(0x6FC4BC90u, "GAME_AssignUniqueGameName_6FC4BC90_113c",
                 k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [B3-10] 0x6FC4C830 PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    if (k >= 1) {
      U32(STAGE_GAME + 0x88u) = STAGE_CLIENT;
      U32(STAGE_CLIENT + 0x16Cu) = 0u;
      U32(STAGE_CLIENT + 0x170u) = 99u;
      U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0; /* stale cache, flag 0x3D4 bit0 = 0 -> cleared */
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
      U32(STAGE_CLIENT + 0x3D4u) = 0u;
    }
    if (k == 2) {
      U32(STAGE_CLIENT + 0x4A8u) = STAGE_CLIENT1;
      U32(STAGE_CLIENT1 + 0x16Cu) = 0u;
      U32(STAGE_CLIENT1 + 0x170u) = 100u;
      U32(STAGE_CLIENT1 + 0x174u) = STAGE_UNIT1;
      U32(STAGE_CLIENT1 + 0x1A8u) = STAGE_GAME;
      U32(STAGE_CLIENT1 + 0x3D4u) = 0u;
    }
    c = make_call();
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "save_all_clients_k%d", k);
    run_and_emit(0x6FC4C830u, "PLAYERSAVE_SaveAllClientCharactersInGame_6FC4C830_113c",
                 k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [B3-11] 0x6FC4C910 PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH) = 0x91910001u + (uint32_t)k;
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    if (k >= 1) {
      U32(STAGE_CLIENT + 0x16Cu) = 0u;
      U32(STAGE_CLIENT + 0x170u) = 77u + (uint32_t)k;
      U32(STAGE_CLIENT + 0x174u) = (k == 1) ? 0u : STAGE_UNIT0; /* k=2 stale cache cleared */
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
      U32(STAGE_CLIENT + 0x3D4u) = 0u;
    }
    c = make_call();
    c.nargs = 2; c.args[0] = pCli; c.args[1] = STAGE_GAME; c.calleePop = 8u;
    ts[0] = pCli; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "save_client_others_k%d", k);
    run_and_emit(0x6FC4C910u, "PLAYERSAVE_SaveClientAndAllOtherPlayers_6FC4C910_113c",
                 k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [B3-12] 0x6FC587E0 PLAYER_DestroyPlayerUnitResources_6FC587E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      0u, (uint32_t)k, 10u + (uint32_t)k, 1u, 5006u, 5006u, 0x21210001u + (uint32_t)k);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    U32(STAGE_UDATA0 + 0x1Cu) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(STAGE_UDATA0 + 0x20u) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(STAGE_UDATA0 + 0x24u) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(STAGE_UDATA0 + 0x60u) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(STAGE_UDATA0 + 0x64u) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(STAGE_UDATA0 + 0x68u) = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    if (k == 2) {
      uint32_t pHover = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(STAGE_UNIT0 + 0xA4u) = pHover;
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.eax = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "destroy_player_res_k%d", k);
    run_and_emit(0x6FC587E0u, "PLAYER_DestroyPlayerUnitResources_6FC587E0_113c",
                 k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [B3-13] 0x6FC6A190 CLIENTS_AppendSaveDataChunk_6FC6A190_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x1107B8u), 0, 0x400u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C18u)) = (k == 0) ? 0u : 1u;
    add_extra_cap(D2GAME_PREF_BASE + 0x111C18u, 4u);
    add_extra_cap(D2GAME_PREF_BASE + 0x1107B8u, 0x10u);
    uint32_t pSaveBuf = STAGE_SCRATCH + 0x100u;
    uint32_t pChunk   = STAGE_SCRATCH + 0x200u;
    U32(pChunk + 0x00u) = 0x44332211u;
    U32(pChunk + 0x04u) = 0x88776655u;
    uint32_t curLen = (k == 1) ? 4u : 8u;
    uint32_t chunkSz = (k == 1) ? 4u : 8u;
    uint32_t totalSz = 16u;
    if (k >= 1) {
      U32(STAGE_CLIENT + 0x00u)   = 2u; /* bucket 2 */
      U32(STAGE_CLIENT + 0x17Cu)  = pSaveBuf;
      U32(STAGE_CLIENT + 0x180u)  = curLen;
      U32(pSaveBuf + 0x00u)       = 0xAA55AA55u;
      U32(game_global_live(D2GAME_PREF_BASE + 0x1107B8u + 8u)) = STAGE_CLIENT;
    }
    c = make_call();
    c.eax = 2u;
    c.nargs = 4;
    c.args[0] = pChunk; c.args[1] = chunkSz; c.args[2] = totalSz; c.args[3] = 0x1234u + (uint32_t)k;
    c.calleePop = 0x10u;
    ts[0] = 2; ts[1] = pChunk; ts[2] = (int64_t)chunkSz; ts[3] = (int64_t)totalSz; ts[4] = 0x1234 + k;
    snprintf(lbl, sizeof(lbl), "append_save_chunk_k%d", k);
    run_and_emit(0x6FC6A190u, "CLIENTS_AppendSaveDataChunk_6FC6A190_113c",
                 k, lbl, &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-14] 0x6FC6A9B0 CLIENTS_AllocAndLinkClient_6FC6A9B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x1107B8u), 0, 0x400u);
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x1103B8u), 0, 0x400u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C18u)) = (k == 0) ? 0u : 1u;
    add_extra_cap(D2GAME_PREF_BASE + 0x111C18u, 4u);
    add_extra_cap(D2GAME_PREF_BASE + 0x1107B8u, 0x10u);
    add_extra_cap(D2GAME_PREF_BASE + 0x1103B8u, 0x10u);
    uint32_t pChar = STAGE_SCRATCH;
    uint32_t pAcct = STAGE_SCRATCH + 0x40u;
    strcpy((char *)(uintptr_t)pChar, (k == 1) ? "AmazonA" : "PaladinB");
    strcpy((char *)(uintptr_t)pAcct, (k == 1) ? "AcctA" : "AcctB");
    U32(STAGE_GAME + 0x1D28u) = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    g_fake_tick_count = 0u;
    uint32_t cliId = (k == 2) ? 3u : 1u;
    c = make_call();
    c.eax = cliId;
    c.nargs = 6;
    c.args[0] = STAGE_GAME; c.args[1] = (uint32_t)k;
    c.args[2] = pChar; c.args[3] = pAcct;
    c.args[4] = 0x10u + (uint32_t)k; c.args[5] = 0u;
    c.calleePop = 0x18u;
    ts[0] = (int64_t)cliId; ts[1] = STAGE_GAME; ts[2] = k;
    ts[3] = pChar; ts[4] = pAcct; ts[5] = 0x10 + k; ts[6] = 0;
    snprintf(lbl, sizeof(lbl), "alloc_link_client_k%d", k);
    run_and_emit(0x6FC6A9B0u, "CLIENTS_AllocAndLinkClient_6FC6A9B0_113c",
                 k, lbl, &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B3-15] 0x6FC6B7F0 CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x1107B8u), 0, 0x400u);
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x1103B8u), 0, 0x400u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C18u)) = 1u;
    add_extra_cap(D2GAME_PREF_BASE + 0x111C18u, 4u);
    add_extra_cap(D2GAME_PREF_BASE + 0x1107B8u, 0x10u);
    U32(STAGE_SCRATCH) = 0x95950001u + (uint32_t)k;
    uint32_t pGameArg = (k == 0) ? 0u : STAGE_GAME;
    if (k == 2) {
      U32(STAGE_GAME + 0x88u)   = STAGE_CLIENT;
      U32(STAGE_GAME + 0x8Cu)   = 1u;
      U32(STAGE_CLIENT + 0x00u) = 2u;
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
      U32(game_global_live(D2GAME_PREF_BASE + 0x1107B8u + 8u)) = STAGE_CLIENT;
    }
    c = make_call();
    c.eax = 2u;
    c.nargs = 2; c.args[0] = pGameArg; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = 2; ts[1] = pGameArg; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "remove_client_k%d", k);
    run_and_emit(0x6FC6B7F0u, "CLIENTS_RemoveClientFromGameAndFree_6FC6B7F0_113c",
                 k, lbl, &c, ts, 3, 0u, (k == 0 ? 1 : 0));
  }

  /* [B3-16] 0x6FC72020 GAMETIME_GetElapsedMilliseconds_6FC72020_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(game_global_live(D2GAME_PREF_BASE + 0x1103A0u)) = 1000000u; /* freq lo */
    U32(game_global_live(D2GAME_PREF_BASE + 0x1103A4u)) = 0u;       /* freq hi */
    U32(game_global_live(D2GAME_PREF_BASE + 0x1103B0u)) = (k == 2) ? 1u : 0u; /* useQpc */
    add_extra_cap(D2GAME_PREF_BASE + 0x1103A0u, 0x14u);
    g_fake_tick_count = (k == 0) ? 12345u : 98765u;
    g_fake_qpc_lo     = 5000000u; /* 5000 ms at 1MHz */
    g_fake_qpc_hi     = 0u;
    c = make_call();
    c.calleePop = 0u;
    ts[0] = (int64_t)g_fake_tick_count; ts[1] = (int64_t)g_fake_qpc_lo; ts[2] = (int64_t)g_fake_qpc_hi;
    snprintf(lbl, sizeof(lbl), "gametime_ms_k%d", k);
    run_and_emit(0x6FC72020u, "GAMETIME_GetElapsedMilliseconds_6FC72020_113c",
                 k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-17] 0x6FC72390 GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(game_global_live(D2GAME_PREF_BASE + 0x1103B0u)) = 0u;
    g_fake_tick_count = 1000u + (uint32_t)k * 500u;
    uint32_t headLive = game_global_live(D2GAME_PREF_BASE + 0x110398u);
    if (k == 0) {
      U32(headLive + 0x00u) = 0u;
      U32(headLive + 0x04u) = 0u;
    } else if (k == 1) {
      U32(headLive + 0x00u) = headLive;
      U32(headLive + 0x04u) = headLive;
    } else {
      uint32_t pWorker = STAGE_SCRATCH + 0x100u;
      uint32_t pWLink  = pWorker + 0x10u;
      U32(pWorker + 0x08u) = pWorker + 0x08u; /* worker queue head empty */
      U32(pWorker + 0x0Cu) = pWorker + 0x08u;
      U32(pWLink + 0x00u)  = headLive;
      U32(pWLink + 0x04u)  = headLive;
      U32(headLive + 0x00u) = pWLink;
      U32(headLive + 0x04u) = pWLink;
    }
    add_extra_cap(D2GAME_PREF_BASE + 0x110398u, 0x1Cu);
    uint32_t pNode = STAGE_SCRATCH;
    c = make_call();
    c.ecx = pNode; c.edx = 0x10u + (uint32_t)k;
    c.nargs = 1; c.args[0] = 0x20u + (uint32_t)k; c.calleePop = 4u;
    ts[0] = pNode; ts[1] = 0x10 + k; ts[2] = 0x20 + k; ts[3] = (int64_t)g_fake_tick_count;
    snprintf(lbl, sizeof(lbl), "queue_worker_node_k%d", k);
    run_and_emit(0x6FC72390u, "GAMETIME_QueueTaskNodeToWorkerList_6FC72390_113c",
                 k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-18] 0x6FC74420 ITEMS_PlaceLoadedPlayerOrMercItem_6FC74420_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      0u, 1u, 1u, 1u, 5006u, 5006u, 0x31310001u + (uint32_t)k);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0,
                    g_item_ring, 50u + (uint32_t)k, 2u, 10u, 100u, 0x31320001u + (uint32_t)k);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U32(STAGE_UNIT1 + 0x10u) = (k == 0) ? 0u : (k == 1) ? 1u : 4u;
    if (k == 0) {
      U32(STAGE_PATH1 + 0x04u) = 0u; U32(STAGE_PATH1 + 0x08u) = 0u;
      U8(STAGE_UDATA1 + 0x45u) = 0u; /* inv page 0 */
    } else if (k == 1) {
      U8(STAGE_UDATA1 + 0x44u) = 6u; /* bodyLoc = left ring */
    }
    c = make_call();
    c.ecx = STAGE_UNIT1; c.eax = 0u;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = STAGE_UNIT1; ts[1] = 0; ts[2] = STAGE_GAME; ts[3] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "place_loaded_item_k%d", k);
    run_and_emit(0x6FC74420u, "ITEMS_PlaceLoadedPlayerOrMercItem_6FC74420_113c",
                 k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-19] 0x6FC745D0 ITEMS_PlaceLoadedPlayerItemWithSync_6FC745D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      0u, 1u, 1u, 1u, 5006u, 5006u, 0x32310001u + (uint32_t)k);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0,
                    g_item_ring, 60u + (uint32_t)k, 2u, 10u, 100u, 0x32320001u + (uint32_t)k);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U32(STAGE_UNIT1 + 0x10u) = (k == 0) ? 0u : (k == 1) ? 6u : 5u;
    if (k == 0) {
      U32(STAGE_PATH1 + 0x04u) = 0u; U32(STAGE_PATH1 + 0x08u) = 0u;
      U8(STAGE_UDATA1 + 0x45u) = 0u;
    }
    c = make_call();
    c.eax = 0u; c.ecx = STAGE_UNIT1; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = 0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_UNIT0; ts[3] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "place_loaded_sync_k%d", k);
    run_and_emit(0x6FC745D0u, "ITEMS_PlaceLoadedPlayerItemWithSync_6FC745D0_113c",
                 k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-20] 0x6FC74810 ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                      0u, 1u, 1u, 1u, 5006u, 5006u, 0x33310001u + (uint32_t)k);
    uint32_t pStream = STAGE_SCRATCH;
    uint32_t pOutBytes = STAGE_SCRATCH + 0x80u;
    U32(pOutBytes) = 0xAAAAAAAAu + (uint32_t)k * 0x11111111u;
    if (k == 0) {
      U16(pStream + 0x00u) = 0x1234u; /* bad magic -> 0x0E */
    } else {
      U16(pStream + 0x00u) = 0x4D4Au; /* 'JM' */
      U16(pStream + 0x02u) = 0u;      /* 0 items -> ok (0), outBytes=4 */
    }
    uint32_t bMerc = (k == 2) ? 1u : 0u;
    c = make_call();
    c.eax = pStream; c.ecx = STAGE_GAME;
    c.nargs = 5;
    c.args[0] = STAGE_UNIT0; c.args[1] = 0x60u; c.args[2] = 0x40u;
    c.args[3] = bMerc; c.args[4] = pOutBytes;
    c.calleePop = 0x14u;
    ts[0] = pStream; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0;
    ts[3] = 0x60; ts[4] = 0x40; ts[5] = (int64_t)bMerc; ts[6] = pOutBytes;
    snprintf(lbl, sizeof(lbl), "deserialize_jm_k%d", k);
    run_and_emit(0x6FC74810u, "ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c",
                 k, lbl, &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B3-21] 0x6FC90D90 PLRTRADE_TryInitiatePlayerTrade_6FC90D90_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5006u, 5006u, 0x41410001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 2u, 1u, 5007u, 5006u, 0x41420001u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    strcpy((char *)(uintptr_t)STAGE_UDATA0, "TraderA");
    strcpy((char *)(uintptr_t)STAGE_UDATA1, "TraderB");
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u);
    stage_client_pkt_pool(STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    g_fake_tick_count = 5000u;
    if (k == 0) {
      U8(STAGE_UNIT0 + 0x6Cu) = 1u; /* p1 busy -> early return */
    } else if (k == 1) {
      U8(STAGE_UNIT1 + 0x6Cu) = 1u; /* p2 busy -> sends 0x5A msg & updates +0x54 */
    }
    c = make_call();
    c.eax = STAGE_UNIT0; c.edi = STAGE_UNIT1;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_GAME; ts[3] = 5000;
    snprintf(lbl, sizeof(lbl), "try_init_trade_k%d", k);
    run_and_emit(0x6FC90D90u, "PLRTRADE_TryInitiatePlayerTrade_6FC90D90_113c",
                 k, lbl, &c, ts, 4, 0u, 0);
  }

  /* [B3-22] 0x6FC91330 PLRTRADE_RemoveTradeItemToCursorAndResetAccept_6FC91330_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5006u, 5006u, 0x42410001u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u);
    uint32_t pGameArg = STAGE_GAME;
    if (k == 0) {
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 1u; /* sends 0x77 0x0C */
    } else if (k == 1) {
      pGameArg = 0u; /* asserts 0x2D3 */
    } else {
      U32(STAGE_UNIT0 + 0x64u) = 999u; /* partner not found -> sends 0x77 */
    }
    c = make_call();
    c.ecx = pGameArg; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = pGameArg; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "remove_trade_item_k%d", k);
    run_and_emit(0x6FC91330u, "PLRTRADE_RemoveTradeItemToCursorAndResetAccept_6FC91330_113c",
                 k, lbl, &c, ts, 3, 0u, (k == 1 ? 1 : 0));
  }

  /* [B3-23] 0x6FC919A0 PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5006u, 5006u, 0x43410001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 2u, 1u, 5007u, 5006u, 0x43420001u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u);
    stage_client_pkt_pool(STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u);
    uint32_t nState = (uint32_t)(k + 1);
    c = make_call();
    c.eax = STAGE_GAME; c.esi = STAGE_UNIT0;
    c.nargs = 4;
    c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_UDATA0; c.args[2] = STAGE_UDATA1; c.args[3] = nState;
    c.calleePop = 0x10u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    ts[3] = STAGE_UDATA0; ts[4] = STAGE_UDATA1; ts[5] = (int64_t)nState;
    snprintf(lbl, sizeof(lbl), "abort_trade_k%d", k);
    run_and_emit(0x6FC919A0u, "PLRTRADE_AbortTradeAndRollbackBothPlayers_6FC919A0_113c",
                 k, lbl, &c, ts, 6, 0u, 0);
  }

  /* [B3-24] 0x6FC91E10 D2Game_6FC91E10_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5006u, 5006u, 0x44410001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 2u, 1u, 5007u, 5006u, 0x44420001u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u);
    stage_client_pkt_pool(STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u);
    U8(STAGE_CLIENT1 + 0x0Au) = (uint8_t)(k * 4u);
    U32(STAGE_SCRATCH) = 0x44440001u + (uint32_t)k;
    c = make_call();
    c.eax = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "trade_swap_items_k%d", k);
    run_and_emit(0x6FC91E10u, "D2Game_6FC91E10_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-25] 0x6FC93BA0 D2Game_6FC93BA0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 25u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u + (uint32_t)k, 1u, 5006u, 5006u, 0x45410001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 10u + (uint32_t)k, 1u, 5007u, 5006u, 0x45420001u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u + (uint32_t)k);
    stage_client_pkt_pool(STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 10u + (uint32_t)k);
    uint32_t pSnap1 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    uint32_t pSnap2 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    uint32_t pJm    = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U16(pJm + 0x00u) = 0x4D4Au; U16(pJm + 0x02u) = 0u;
    U32(pSnap1 + 0x00u) = 4u; U32(pSnap1 + 0x04u) = pJm; U32(pSnap1 + 0x08u) = 0u;
    U32(pSnap2 + 0x00u) = 4u; U32(pSnap2 + 0x04u) = pJm; U32(pSnap2 + 0x08u) = 0u;
    U32(pSnap1 + 0x0Cu) = (uint32_t)(100 * (k + 1));
    U32(pSnap2 + 0x0Cu) = (uint32_t)(200 * (k + 1));
    U32(STAGE_UDATA0 + 0x5Cu) = pSnap1;
    U32(STAGE_UDATA1 + 0x5Cu) = pSnap2;
    c = make_call();
    c.esi = STAGE_UNIT0; c.edi = STAGE_UNIT1;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UDATA0; c.args[2] = STAGE_UDATA1;
    c.calleePop = 0x0Cu;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_GAME;
    ts[3] = STAGE_UDATA0; ts[4] = STAGE_UDATA1;
    snprintf(lbl, sizeof(lbl), "trade_reset_k%d", k);
    run_and_emit(0x6FC93BA0u, "D2Game_6FC93BA0_113c", k, lbl, &c, ts, 5, 0u, 0);
  }

  /* [B3-26] 0x6FC93D90 PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5006u, 5006u, 0x46410001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 2u, 1u, 5007u, 5006u, 0x46420001u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 30, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 30, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 14, 5000, 0);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u);
    stage_client_pkt_pool(STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u);
    uint32_t pSnap1 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    uint32_t pSnap2 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    uint32_t pJm    = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U16(pJm + 0x00u) = 0x4D4Au; U16(pJm + 0x02u) = 0u;
    U32(pSnap1 + 0x00u) = 4u; U32(pSnap1 + 0x04u) = pJm; U32(pSnap1 + 0x08u) = 0u;
    U32(pSnap2 + 0x00u) = 4u; U32(pSnap2 + 0x04u) = pJm; U32(pSnap2 + 0x08u) = 0u;
    U32(pSnap1 + 0x0Cu) = (k == 0) ? 0u : (k == 1) ? 500u : 9999999u; /* k=2 not enough gold */
    U32(pSnap2 + 0x0Cu) = (k == 1) ? 250u : 0u;
    U32(STAGE_UDATA0 + 0x5Cu) = pSnap1;
    U32(STAGE_UDATA1 + 0x5Cu) = pSnap2;
    c = make_call();
    c.eax = STAGE_UDATA0; c.ecx = STAGE_UNIT1;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UDATA1;
    c.calleePop = 0x0Cu;
    ts[0] = STAGE_UDATA0; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    ts[3] = STAGE_GAME; ts[4] = STAGE_UDATA1;
    snprintf(lbl, sizeof(lbl), "exec_trade_swap_k%d", k);
    run_and_emit(0x6FC93D90u, "PLRTRADE_ExecutePlayerTradeSwap_6FC93D90_113c",
                 k, lbl, &c, ts, 5, 0u, 0);
  }

  /* [B3-27] 0x6FC98FA0 PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5006u, 5006u, 0x47410001u + (uint32_t)k);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10 + k * 5, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, k * 500, 0);
    c = make_call();
    c.eax = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "plrdeath_drop_k%d", k);
    run_and_emit(0x6FC98FA0u, "PLRDEATH_DropPlayerEquippedItemsAndGoldToCorpseOrGround_6FC98FA0_113c",
                 k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [B3-28] 0x6FCAF4E0 NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t statBase = game_global_live(D2GAME_PREF_BASE + 0x110200u);
    memset((void *)(uintptr_t)statBase, 0, 0x140u);
    uint32_t pSrc1 = STAGE_SCRATCH + 0x100u;
    uint32_t pSrc2 = STAGE_SCRATCH + 0x200u;
    U32(pSrc1 + 0x00u) = 0x11223344u; U32(pSrc1 + 0x04u) = 0x55667788u; U32(pSrc1 + 0x08u) = 0x99AABBCCu;
    U32(pSrc1 + 0x0Cu) = 0x10203040u; U32(pSrc1 + 0x10u) = 0x50607080u; U32(pSrc1 + 0x14u) = 0x90A0B0C0u;
    U32(pSrc2 + 0x00u) = 0xCAFEBABEu; U32(pSrc2 + 0x04u) = 0xFEEDFACEu;
    uint32_t idx = (k == 0) ? 0x11u : (uint32_t)(k - 1);
    if (k >= 1) {
      uint32_t rec = statBase + idx * 16u;
      U32(rec + 0x08u) = pSrc1;
      U32(rec + 0x0Cu) = (uint32_t)k;       /* nCount1 */
      U32(rec + 0x10u) = pSrc2;
      U32(rec + 0x14u) = (uint32_t)(3 - k); /* nCount2 */
    }
    add_extra_cap(D2GAME_PREF_BASE + 0x110200u, 0x30u);
    c = make_call();
    c.eax = idx;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = (int64_t)idx; ts[1] = STAGE_GAME; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "npc_clone_tables_k%d", k);
    run_and_emit(0x6FCAF4E0u, "NPCS_CloneMercAndVendorStaticTables_6FCAF4E0_113c",
                 k, lbl, &c, ts, 3, 0u, (k == 0 ? 1 : 0));
  }

  /* [B3-29] 0x6FCAFBE0 NPCS_InitGameNpcControl_6FCAFBE0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x110200u), 0, 0x140u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C0Cu)) = 0u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C10u)) = 0u;
    add_extra_cap(D2GAME_PREF_BASE + 0x111C0Cu, 8u);
    U32(STAGE_GAME + 0xD0u) = 0x51510001u + (uint32_t)k * 0x12345u;
    c = make_call();
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "npc_init_ctrl_k%d", k);
    run_and_emit(0x6FCAFBE0u, "NPCS_InitGameNpcControl_6FCAFBE0_113c",
                 k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [B3-30] 0x6FCBC160 PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 11u, 1u, 5006u, 5006u, 0x61610001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 22u, 1u, 5007u, 5006u, 0x61620001u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pPartyCtrl = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    uint32_t pSubParty  = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    uint32_t pMem0      = (uint32_t)(uintptr_t)bump_alloc(0x08u);
    uint32_t pMem1      = (uint32_t)(uintptr_t)bump_alloc(0x08u);
    U32(pMem0 + 0x00u) = 11u;
    U32(pMem0 + 0x04u) = (k == 2) ? pMem1 : 0u;
    U32(pMem1 + 0x00u) = 22u;
    U16(pSubParty + 0x00u) = 1u;
    U32(pSubParty + 0x04u) = pMem0;
    U32(pPartyCtrl + 0x04u) = pSubParty;
    U32(STAGE_GAME + 0x1D2Cu) = pPartyCtrl;
    U32(STAGE_SCRATCH) = 0x62620001u + (uint32_t)k;
    uint32_t wParty = (k == 0) ? 0xFFFFu : 1u;
    uint32_t cbLive = (0x6FCBC990u - D2GAME_PREF_BASE) + (uint32_t)(uintptr_t)g_hGame;
    c = make_call();
    c.esi = STAGE_GAME; c.eax = wParty; c.ebx = STAGE_SCRATCH;
    c.nargs = 1; c.args[0] = cbLive; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = (int64_t)wParty; ts[2] = 0x6FCBC990u; ts[3] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "party_foreach_k%d", k);
    run_and_emit(0x6FCBC160u, "PARTY_ForEachSubPartyPlayerUnit_6FCBC160_113c",
                 k, lbl, &c, ts, 4, 0u, 0);
  }
}

/* =========================================================================
 * BATCH 4 — 5 Skills/Combat + 19 MonAI VAs
 * ========================================================================= */
static void emit_batch_4_skills_combat_monai(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* [B4-01] 0x6FC460D0 MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                       1u, 400u + (uint32_t)k, 1u, (uint16_t)(5006u + k), 5006u, 0x71710001u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 5 + k * 10, 0);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "fe_bolts_k%d", k);
    run_and_emit(0x6FC460D0u, "MONUMOD_SpawnFireEnchantedBolts_6FC460D0_113c",
                 k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [B4-02] 0x6FC465E0 MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                       1u, 410u + (uint32_t)k, 1u, (uint16_t)(5006u + k), 5006u, 0x72720001u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10 + k * 5, 0);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "death_fire_exp_k%d", k);
    run_and_emit(0x6FC465E0u, "MONSTER_OnDeathSpawnFireExplosion75_6FC465E0_113c",
                 k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [B4-03] 0x6FC70800 SKILLS_ReleaseTrappedOrConvertedMonster_6FC70800_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                       1u, 420u + (uint32_t)k, 1u, (uint16_t)(5006u + k), 5006u, 0x73730001u + (uint32_t)k);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    c = make_call();
    c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "release_trapped_mon_k%d", k);
    run_and_emit(0x6FC70800u, "SKILLS_ReleaseTrappedOrConvertedMonster_6FC70800_113c",
                 k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [B4-04] 0x6FCB3270 SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5006u, 5006u, 0x74710001u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 2u, 1u, 5007u, 5006u, 0x74720001u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 500 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 500 << 8, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      U32(STAGE_UNIT0 + 0x38u) = (k == 1) ? (2u << 8) : (3u << 8);
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 260u; c.args[1] = (uint32_t)(k + 1); c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 260; ts[3] = k + 1;
    snprintf(lbl, sizeof(lbl), "dragon_claw_k%d", k);
    run_and_emit(0x6FCB3270u, "SKILLS_SrvDo_DragonClawDualStrike_6FCB3270_113c",
                 k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-05] 0x6FCB4370 SKILLS_SpawnNovaRingOfGuidedProjectiles_6FCB4370_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5006u, 5006u, 0x75710001u + (uint32_t)k);
    uint32_t nStep = (k == 0) ? 16u : (k == 1) ? 32u : 8u;
    uint32_t lowSeed = 0x13572468u + (uint32_t)k * 0x1111u;
    c = make_call();
    c.edx = lowSeed;
    c.nargs = 8;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = 39u;
    c.args[3] = 5006u; c.args[4] = 5006u; c.args[5] = 48u; c.args[6] = 5u; c.args[7] = nStep;
    c.calleePop = 0x20u;
    ts[0] = (int64_t)lowSeed; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = 39;
    ts[4] = 5006; ts[5] = 5006; ts[6] = 48; ts[7] = 5; ts[8] = (int64_t)nStep;
    snprintf(lbl, sizeof(lbl), "nova_ring_guided_k%d", k);
    run_and_emit(0x6FCB4370u, "SKILLS_SpawnNovaRingOfGuidedProjectiles_6FCB4370_113c",
                 k, lbl, &c, ts, 9, 0u, 0);
  }

  /* [B4-06] 0x6FC35E00 AI_ThinkBaalThroneSpawner_6FC35E00_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 510u, 1u, 5006u, 5006u, 0x80200001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x80200002u);
    uint32_t pAiCtrl = STAGE_SCRATCH + 0x100u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U32(pAiCtrl + 0x3Cu) = 1u;   /* already selected classId */
    U32(pAiCtrl + 0x14u) = 90u;  /* deltaFrames = 10 < minDelay=200 */
    U16(pMonTxt + 0x56u) = 200u; /* minDelay */
    U16(pMonTxt + 0x62u) = 5u;   /* maxSpawns */
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, (k == 0 ? 0u : STAGE_UNIT1), (k == 1 ? 30u : 5u), 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_baal_spawner_k%d", k);
    run_and_emit(0x6FC35E00u, "AI_ThinkBaalThroneSpawner_6FC35E00_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-08] 0x6FC35F90 AI_CastNextPatrolPointSkill_6FC35F90_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 520u, 1u, 5006u, 5006u, 0x80300001u);
    uint32_t pAiCtrl = STAGE_SCRATCH + 0x100u;
    uint32_t pSave   = STAGE_SCRATCH + 0x200u;
    if (k >= 1) {
      U32(pAiCtrl + 0x38u) = pSave;
      U32(pSave + 0x00u)   = (k == 1) ? 0u : 2u; /* k=1 idx>=count -> 0; k=2 pMonster=0 -> 0 */
    }
    U32(STAGE_SCRATCH + 0x00u) = pAiCtrl;
    uint32_t pMonArg = (k == 2) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.eax = STAGE_SCRATCH; c.ecx = STAGE_GAME;
    c.nargs = 1; c.args[0] = pMonArg; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_GAME; ts[2] = pMonArg;
    snprintf(lbl, sizeof(lbl), "ai_patrol_skill_k%d", k);
    run_and_emit(0x6FC35F90u, "AI_CastNextPatrolPointSkill_6FC35F90_113c",
                 k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B4-09] 0x6FC364A0 AI_ThinkPainWormSpawner_6FC364A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 530u, 1u, 5006u, 5006u, 0x80400001u);
    uint32_t pAiCtrl = STAGE_SCRATCH + 0x100u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u) = 5u;  /* maxSpawns */
    U16(pMonTxt + 0x5Cu) = 15u; /* maxDist */
    U16(pMonTxt + 0x170u) = (k == 1) ? 10u : 0xFFFFu;
    U32(pAiCtrl + 0x14u) = (k == 1) ? 200u : 50u; /* k=1 cooldown > gameFrame=100 */
    U32(pAiCtrl + 0x18u) = 1u;
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, (k == 0 ? 30u : 5u), 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_painworm_k%d", k);
    run_and_emit(0x6FC364A0u, "AI_ThinkPainWormSpawner_6FC364A0_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-10] 0x6FC366D0 AI_ThinkImpregnatedMonster_6FC366D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 540u + (uint32_t)k, 1u, 5006u, 5006u, 0x80500001u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = U32(STAGE_UDATA0 + 0x00u);
    if (k == 1) {
      U32(STAGE_UNIT0 + 0xC8u) |= (1u << 10);
      U32(STAGE_UNIT0 + 0x94u) = 1u;
      U32(STAGE_UNIT0 + 0x98u) = 9999u; /* host missing -> clears special AI & stalls */
    }
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, 0u, 10u + (uint32_t)k * 5u, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_impregnated_k%d", k);
    run_and_emit(0x6FC366D0u, "AI_ThinkImpregnatedMonster_6FC366D0_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-11] 0x6FC36E30 AI_ThinkPatrolAndAttack_6FC36E30_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 550u, 1u, 5006u, 5006u, 0x80600001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x80600002u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = (k == 0) ? 0u : U32(STAGE_UDATA0 + 0x00u);
    if (k == 1) {
      U32(STAGE_PATH0 + 0x1Cu) = 0u; /* pRoom == 0 -> early return */
    } else if (k == 2) {
      uint32_t pCmd = (uint32_t)(uintptr_t)bump_alloc(0x28u);
      U32(pCmd + 0x08u) = 0x0Au;
      U32(pCmd + 0x0Cu) = 5006u;
      U32(pCmd + 0x10u) = 5006u;
      U32(pAiCtrl + 0x20u) = pCmd;
      U32(pAiCtrl + 0x24u) = pCmd;
    }
    U32(STAGE_SCRATCH + 0x300u) = 0x80610001u + (uint32_t)k;
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, 10u, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_patrol_attack_k%d", k);
    run_and_emit(0x6FC36E30u, "AI_ThinkPatrolAndAttack_6FC36E30_113c",
                 k, lbl, &c, ts, 3, 0u, (k == 2 ? 1 : 0));
  }

  /* [B4-12] 0x6FC38730 AI_Thinker_PutridDefiler_6FC38730_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 560u, (k == 0 ? 12u : 1u), 5006u, 5006u, 0x80700001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x80700002u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u)  = 0u; /* aip1=0 -> skip infest scan */
    U16(pMonTxt + 0x5Cu)  = 0u; /* aip2=0 -> skip melee attack */
    U16(pMonTxt + 0x62u)  = 0u;
    U16(pMonTxt + 0x68u)  = 10u + (uint32_t)k * 6u; /* aip4 stall delay */
    U16(pMonTxt + 0x170u) = 0xFFFFu;
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, 2u, 1u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_putrid_defiler_k%d", k);
    run_and_emit(0x6FC38730u, "AI_Thinker_PutridDefiler_6FC38730_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-13] 0x6FC3AF80 AI_ThinkCurseCaster_6FC3AF80_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 570u, 1u, 5006u, 5006u, 0x80800001u + (uint32_t)k * 3u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x80800002u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u) = (k == 1) ? 100u : 0u; /* melee chance */
    U16(pMonTxt + 0x5Cu) = 10u; /* stall */
    U16(pMonTxt + 0x62u) = 0u;  /* curse chance */
    U16(pMonTxt + 0x68u) = 2u;  /* curse max dist */
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, 10u, (k == 2 ? 0u : 1u), pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_curse_caster_k%d", k);
    run_and_emit(0x6FC3AF80u, "AI_ThinkCurseCaster_6FC3AF80_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-14] 0x6FC3BCA0 AI_SpawnPackMinionOrStartMode_6FC3BCA0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 580u, 1u, 5006u, 5006u, 0x80900001u);
    uint32_t pAiCtrl = STAGE_SCRATCH + 0x100u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u) = 4u;  /* init count */
    U16(pMonTxt + 0x5Cu) = 15u; /* max dist */
    U32(pAiCtrl + 0x14u) = (k == 1) ? 0u : (k == 2) ? 200u : 50u;
    U32(pAiCtrl + 0x18u) = 3u;
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, 0u, (k <= 1 ? 30u : 5u), 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_spawn_pack_k%d", k);
    run_and_emit(0x6FC3BCA0u, "AI_SpawnPackMinionOrStartMode_6FC3BCA0_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-15] 0x6FC9D170 AI_FoulCrowNestSpawner_6FC9D170_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 590u, 1u, 5006u, 5006u, 0x80A00001u);
    uint32_t pAiCtrl = STAGE_SCRATCH + 0x100u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u)  = 50u; /* aip1 cooldown */
    U16(pMonTxt + 0x62u)  = 5u;  /* aip3 max spawns */
    U16(pMonTxt + 0x170u) = (k == 1) ? 10u : 0xFFFFu;
    U32(pAiCtrl + 0x14u)  = (k == 1) ? 80u : 0u; /* k=1 delta=20 < 50 -> stall */
    U32(pAiCtrl + 0x18u)  = 1u;
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, 0u, (k == 0 ? 30u : 5u), 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_foulcrow_nest_k%d", k);
    run_and_emit(0x6FC9D170u, "AI_FoulCrowNestSpawner_6FC9D170_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-16] 0x6FC9DB70 AI_SelfBuffOrSkillAndStrafe_6FC9DB70_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 600u, 1u, 5006u, 5006u, 0x80B00001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x80B00002u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    uint32_t pAiCtrl = STAGE_SCRATCH + 0x100u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x170u) = 0xFFFFu;
    U16(pMonTxt + 0x172u) = 0xFFFFu;
    U16(pMonTxt + 0x62u) = (k == 1) ? 100u : 0u;
    U16(pMonTxt + 0x68u) = 15u;
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, 5u, (k == 2 ? 0u : 1u), pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_selfbuff_strafe_k%d", k);
    run_and_emit(0x6FC9DB70u, "AI_SelfBuffOrSkillAndStrafe_6FC9DB70_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-17] 0x6FC9FB30 AI_ChargeRunOrTripleSkillMelee_6FC9FB30_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 610u, 1u, 5006u, 5006u, 0x80C00001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5012u, 5006u, 0x80C00002u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    uint32_t pMonStats2 = STAGE_SCRATCH + 0x400u;
    U8(pMonStats2 + 0x0Eu) = 2u;
    U16(pMonTxt + 0x6Eu) = 10u; /* aip5 */
    U16(pMonTxt + 0x56u) = (k == 2) ? 100u : 0u;
    U16(pMonTxt + 0x170u) = 0xFFFFu;
    U16(pMonTxt + 0x172u) = 0xFFFFu;
    U16(pMonTxt + 0x174u) = 0xFFFFu;
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, (k == 0 ? 20u : 2u), (k == 0 ? 0u : 1u), pMonTxt);
    U32(STAGE_SCRATCH + 0x20u) = pMonStats2;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_charge_triple_k%d", k);
    run_and_emit(0x6FC9FB30u, "AI_ChargeRunOrTripleSkillMelee_6FC9FB30_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-18] 0x6FCA00C0 AI_ThinkThreePhaseMeleeRetreat_6FCA00C0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 620u, 1u, 5006u, 5006u, 0x80D00001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x80D00002u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u) = (k == 1) ? 100u : 0u;
    U16(pMonTxt + 0x5Cu) = 10u;
    U16(pMonTxt + 0x62u) = 0u;
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, 5u, (k == 2 ? 0u : 1u), pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_3phase_melee_k%d", k);
    run_and_emit(0x6FCA00C0u, "AI_ThinkThreePhaseMeleeRetreat_6FCA00C0_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-19] 0x6FCA08A0 AI_ThinkMultiStrikeComboMelee_6FCA08A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 630u, 1u, 5006u, 5006u, 0x80E00001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x80E00002u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u) = 0u;
    U16(pMonTxt + 0x5Cu) = 10u + (uint32_t)k * 5u;
    U16(pMonTxt + 0x170u) = 0xFFFFu;
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, (k == 0 ? 10u : 2u), (k == 0 ? 0u : 1u), pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_multistrike_k%d", k);
    run_and_emit(0x6FCA08A0u, "AI_ThinkMultiStrikeComboMelee_6FCA08A0_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-20] 0x6FCA2EC0 AI_ThinkChargerRunOrAttack_6FCA2EC0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 640u, 1u, 5006u, 5006u, 0x80F00001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x80F00002u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u) = (k == 1) ? 100u : 0u;
    U16(pMonTxt + 0x5Cu) = 10u;
    U16(pMonTxt + 0x62u) = 0u;
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, 5u, (k == 2 ? 0u : 1u), pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_charger_k%d", k);
    run_and_emit(0x6FCA2EC0u, "AI_ThinkChargerRunOrAttack_6FCA2EC0_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-21] 0x6FCA3550 AI_Skeleton113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 650u, 1u, 5006u, 5006u, 0x81000001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x81000002u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u) = (k == 0) ? 100u : 0u; /* aip1 approach chance */
    U16(pMonTxt + 0x5Cu) = (k == 1) ? 100u : 0u; /* aip2 wander(4) vs wander(3) */
    U16(pMonTxt + 0x6Eu) = 10u;                  /* aip5 */
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, 10u, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_skeleton_k%d", k);
    run_and_emit(0x6FCA3550u, "AI_Skeleton113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-22] 0x6FCA4800 AI_ThinkPackFollowerMelee_6FCA4800_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 660u, 1u, 5006u, 5006u, 0x81100001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x81100002u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x5Cu) = 0u;                      /* atkChance=0 -> stall */
    U16(pMonTxt + 0x68u) = 8u + (uint32_t)k * 5u;   /* stallDelay=8,13,18 */
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, 2u, 1u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_pack_follower_k%d", k);
    run_and_emit(0x6FCA4800u, "AI_ThinkPackFollowerMelee_6FCA4800_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-23] 0x6FCA77B0 AI_ThinkBurrowerSpawner_6FCA77B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 670u, 1u, 5006u, 5006u, 0x81200001u);
    uint32_t pAiCtrl = STAGE_SCRATCH + 0x100u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x56u) = 5u + (uint32_t)k * 3u;
    U16(pMonTxt + 0x5Cu) = 20u + (uint32_t)k * 10u;
    if (k == 2) { U32(pAiCtrl + 0x14u) = 250u; } /* already initialized */
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, 0u, 10u, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_burrower_k%d", k);
    run_and_emit(0x6FCA77B0u, "AI_ThinkBurrowerSpawner_6FCA77B0_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [B4-24] 0x6FCA7BB0 AI_ThinkFetishShaman_6FCA7BB0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 680u, 1u, 5006u, 5006u, 0x81300001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x81300002u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    U16(pMonTxt + 0x170u) = 0xFFFFu; /* skill0 < 0 */
    U16(pMonTxt + 0x172u) = 0xFFFFu; /* skill1 < 0 */
    U16(pMonTxt + 0x56u) = (k == 1) ? 100u : 0u;
    U16(pMonTxt + 0x5Cu) = 15u;
    stage_ai_param(STAGE_SCRATCH, pAiCtrl, STAGE_UNIT1, 5u + (uint32_t)k * 3u, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_fetish_shaman_k%d", k);
    run_and_emit(0x6FCA7BB0u, "AI_ThinkFetishShaman_6FCA7BB0_113c",
                 k, lbl, &c, ts, 3, 0u, 0);
  }
}

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "Usage: %s <d2game-datatbls-113c.img> <out.ndjson>\n", argv[0]);
    return 1;
  }
  const char *imgPath = argv[1];
  const char *outPath = argv[2];

  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-w15] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
    fflush(stderr);
    return 1;
  }

  g_hStorm       = LoadLibraryA("Storm.dll");
  g_hFog         = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCmp   = LoadLibraryA("D2CMP.dll");
  g_hCom         = LoadLibraryA("D2Common.dll");
  HMODULE hNet   = LoadLibraryA("D2Net.dll");
  g_hGame        = LoadLibraryA("D2Game.dll");
  if (!g_hStorm || !g_hFog || !hLang || !hCmp || !g_hCom || !hNet || !g_hGame) {
    fprintf(stderr, "[k6-w15] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-w15] unexpected D2Common rebase: %p\n", (void *)g_hCom);
    fflush(stderr);
    return 3;
  }

  {
    typedef void(__fastcall *FogInitSys_t)(int, void *);
    FogInitSys_t pInit = (FogInitSys_t)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(10089));
    if (pInit) pInit(1, NULL);
  }

  /* Initialize Win32 critical sections used by D2Game global tables & per-game lock */
  InitializeCriticalSection((CRITICAL_SECTION *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x110BE8u));
  InitializeCriticalSection((CRITICAL_SECTION *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x110BB8u));
  InitializeCriticalSection((CRITICAL_SECTION *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x110BD0u));
  InitializeCriticalSection((CRITICAL_SECTION *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x111F58u));
  InitializeCriticalSection((CRITICAL_SECTION *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x111C58u));
  InitializeCriticalSection((CRITICAL_SECTION *)(uintptr_t)STAGE_CS_GAME);

  load_datatbls_img(imgPath);
  install_hooks();

  fn_CreateStatListEx   = (Com_CreateStatListEx_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11166));
  fn_SetUnitStat        = (Com_SetUnitStat_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10887));
  fn_AllocStatList      = (Com_AllocStatList_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11013));
  fn_SetStatIfValid     = (Com_SetStatIfValid_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10188));
  fn_SetStatListState   = (Com_SetStatListState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10785));
  fn_MergeStatLists     = (Com_MergeStatLists_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10807));
  fn_ToggleGfxState     = (Com_ToggleGfxState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10945));
  fn_AllocSkillList     = (Com_AllocSkillList_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10856));
  fn_SetSkillLevel      = (Com_SetSkillLevel_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10302));
  fn_AllocInventory     = (Com_AllocInventory_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10387));
  fn_PlaceItemInBodyLoc = (Com_PlaceItemInBodyLoc_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11041));
  fn_PathSetTargetUnit  = (Com_PathSetTargetUnit_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10336));

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_PlaceItemInBodyLoc || !fn_PathSetTargetUnit) {
    fprintf(stderr, "[k6-w15] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-w15] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_batch_1_trivial();
  emit_batch_2_items_objects();
  emit_batch_3_core_systems();
  emit_batch_4_skills_combat_monai();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-w15] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
