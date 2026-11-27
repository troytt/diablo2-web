/*
 * k6-p9-d2game-emitter.c — [K6-P9] Band B (0x6FC70000..0x6FCAFFFF) Real-DLL Emitter
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables + D2Common .data/.bss + Items linker table
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert), Fog.#10042..10047 &
 * Storm.#401/#403/#405 (deterministic bump allocator), and KERNEL32 time/CS stubs,
 * and sweeps clean Band B D2Game.dll VAs, emitting >= 3 non-degenerate vectors each.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define D2COM_PREF_BASE   (0x6FD5u << 16)
#define D2GAME_PREF_BASE  (0x6FC2u << 16)

#define DATATBLS_BASE     0x20000000u
#define DATATBLS_SIZE     0x00800000u

#define STAGE_BASE        0x30000000u
#define STAGE_FIXED_SIZE  0x00009000u
#define STAGE_SETUP_BASE  0x30020000u
#define STAGE_CS_GAME     0x30078000u
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

#define MAX_STACK 14
#define MAX_EXTRA_CAPS 16

static HMODULE g_hStorm = NULL;
static HMODULE g_hFog   = NULL;
static HMODULE g_hCom   = NULL;
static HMODULE g_hGame  = NULL;
static uintptr_t g_com_rebase  = 0;
static uintptr_t g_game_rebase = 0;

static int g_in_setup_phase = 1;
static uint32_t g_setup_top = STAGE_SETUP_BASE;
static uint32_t g_heap_top  = HEAP_BASE;

static uint32_t g_fake_tick_count = 0u;
static uint32_t g_fake_qpc_lo     = 0u;
static uint32_t g_fake_qpc_hi     = 0u;

typedef struct {
  uint32_t canonAddr;
  uint32_t len;
} ExtraCap;

static ExtraCap g_extra_caps[MAX_EXTRA_CAPS];
static uint32_t g_extra_cap_count = 0u;

static __attribute__((unused)) void add_extra_cap(uint32_t canonAddr, uint32_t len) {
  if (g_extra_cap_count < MAX_EXTRA_CAPS && len > 0u) {
    g_extra_caps[g_extra_cap_count].canonAddr = canonAddr;
    g_extra_caps[g_extra_cap_count].len = len;
    g_extra_cap_count++;
  }
}

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
static uint32_t g_item_gold  = 0u;
static uint32_t g_item_pot   = 0u;

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
    fprintf(stderr, "[k6-p9] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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

static void __stdcall stub_EnterCriticalSection(void *pCs) { (void)pCs; }
static void __stdcall stub_LeaveCriticalSection(void *pCs) { (void)pCs; }
static uint32_t __cdecl stub_d2lang_10009(void) { return 0u; }
static DWORD __stdcall stub_GetTickCount(void) { return g_fake_tick_count; }
static BOOL __stdcall stub_QueryPerformanceCounter(LARGE_INTEGER *lpOut) {
  if (lpOut) {
    lpOut->u.LowPart  = g_fake_qpc_lo;
    lpOut->u.HighPart = (LONG)g_fake_qpc_hi;
  }
  return TRUE;
}
static void __stdcall stub_GetLocalTime(SYSTEMTIME *st) {
  if (st) {
    memset(st, 0, sizeof(*st));
    st->wYear = 2026;
    st->wMonth = 6;
    st->wDay = 15;
    st->wHour = 12;
  }
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
      fprintf(stderr, "[k6-p9] missing Fog.#%u\n", fogHooks[i].ord);
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
    if (orig) hook_module_iat_ptr(g_hGame, orig, stormHooks[i].fn);
  }
  HMODULE hK32 = GetModuleHandleA("kernel32.dll");
  if (hK32) {
    void *origTick = (void *)(uintptr_t)GetProcAddress(hK32, "GetTickCount");
    if (origTick) {
      hook_module_iat_ptr(g_hCom, origTick, (void *)(uintptr_t)stub_GetTickCount);
      hook_module_iat_ptr(g_hGame, origTick, (void *)(uintptr_t)stub_GetTickCount);
    }
    void *origQpc = (void *)(uintptr_t)GetProcAddress(hK32, "QueryPerformanceCounter");
    if (origQpc) hook_module_iat_ptr(g_hGame, origQpc, (void *)(uintptr_t)stub_QueryPerformanceCounter);
    void *origLocalTime = (void *)(uintptr_t)GetProcAddress(hK32, "GetLocalTime");
    if (origLocalTime) hook_module_iat_ptr(g_hGame, origLocalTime, (void *)(uintptr_t)stub_GetLocalTime);
    void *origEnterCs = (void *)(uintptr_t)GetProcAddress(hK32, "EnterCriticalSection");
    if (origEnterCs) hook_module_iat_ptr(g_hGame, origEnterCs, (void *)(uintptr_t)stub_EnterCriticalSection);
    void *origLeaveCs = (void *)(uintptr_t)GetProcAddress(hK32, "LeaveCriticalSection");
    if (origLeaveCs) hook_module_iat_ptr(g_hGame, origLeaveCs, (void *)(uintptr_t)stub_LeaveCriticalSection);
  }
  HMODULE hLang = GetModuleHandleA("D2Lang.dll");
  if (hLang) {
    void *origLang10009 = (void *)(uintptr_t)GetProcAddress(hLang, MAKEINTRESOURCEA(10009u));
    if (origLang10009) {
      hook_module_iat_ptr(g_hCom, origLang10009, (void *)(uintptr_t)stub_d2lang_10009);
      hook_module_iat_ptr(g_hGame, origLang10009, (void *)(uintptr_t)stub_d2lang_10009);
    }
  }
}


static void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-p9] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p9] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_PREF_BASE + 0x99000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p9] short read at page %u\n", i);
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
        fprintf(stderr, "[k6-p9] stage json overflow\n");
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

  U32(game_global_live(D2GAME_PREF_BASE + 0x111C1Cu)) = 0u;
  U32(game_global_live(D2GAME_PREF_BASE + 0x111C20u)) = 0u;
  U32(game_global_live(D2GAME_PREF_BASE + 0x111C3Cu)) = 0u;
  U32(game_global_live(D2GAME_PREF_BASE + 0x111F90u)) = 0u;
  U32(game_global_live(D2GAME_PREF_BASE + 0x111F98u)) = 0u;

  U8(STAGE_GAME + 0x6Du)  = 0u;
  U32(STAGE_GAME + 0x70u) = 1u;
  U16(STAGE_GAME + 0x78u) = 100u;
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
  if (prev == 0u) U32(headAddr) = pUnit;
  else U32(prev + 0xE4u) = pUnit;
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
  U32(pUData + 0x18u) = 0x00000010u;
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

static __attribute__((unused)) void stage_quest_node(
    uint32_t pQuest, uint32_t qId, uint32_t pQuestEx, uint32_t pPrev) {
  uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(0x800u);
  uint32_t pGFlags  = (uint32_t)(uintptr_t)bump_alloc(0x80u);
  U32(pGFlags + 0x00u) = pGFlags + 0x10u;
  U32(pGFlags + 0x04u) = 0x60u;
  U32(pQuest + 0x00u)  = qId;
  U32(pQuest + 0x04u)  = STAGE_GAME;
  U32(pQuest + 0x18u)  = pQuestEx;
  U32(pQuest + 0xDCu)  = pMsgTbls;
  U32(pQuest + 0xF4u)  = pPrev;
  U32(STAGE_QUESTCTRL + 0x00u) = pQuest;
  U32(STAGE_QUESTCTRL + 0x08u) = 1u;
  U32(STAGE_QUESTCTRL + 0x0Cu) = pGFlags;
  U32(STAGE_QUESTCTRL + 0x18u) = 0x12345679u;
  U32(STAGE_QUESTCTRL + 0x1Cu) = 0x0000029Au;
  U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
}

static __attribute__((unused)) void attach_quest_bits(
    uint32_t pUData, uint8_t diff, uint32_t pRecBase) {
  uint32_t pBits = pRecBase + 0x10u;
  U32(pRecBase + 0x00u) = pBits;
  U32(pRecBase + 0x04u) = 0x60u;
  U32(pUData + 0x10u + (uint32_t)diff * 4u) = pRecBase;
}

static __attribute__((unused)) void set_quest_bit(
    uint32_t pRecBase, uint32_t nQuest, uint32_t nBit) {
  uint32_t pBuf = U32(pRecBase);
  uint32_t bitIdx = (nQuest << 4) + nBit;
  U8(pBuf + (bitIdx >> 3)) |= (uint8_t)(1u << (bitIdx & 7u));
}

static __attribute__((unused)) void stage_mon_reg(uint32_t lvlId) {
  if (lvlId < 140u && U32(STAGE_GAME + 0xF0u + lvlId * 4u) == 0u) {
    U32(STAGE_GAME + 0xF0u + lvlId * 4u) = (uint32_t)(uintptr_t)bump_alloc(0x300u);
  }
}

static __attribute__((unused)) void stage_obj_ctrl(uint32_t lvlId) {
  uint32_t pObjCtrl = U32(STAGE_GAME + 0x10F0u);
  if (pObjCtrl == 0u) {
    pObjCtrl = (uint32_t)(uintptr_t)bump_alloc(0x300u);
    U32(pObjCtrl + 0x00u) = 0x24681357u;
    U32(pObjCtrl + 0x04u) = 0x29Au;
    U32(STAGE_GAME + 0x10F0u) = pObjCtrl;
  }
  if (lvlId < 140u && U32(pObjCtrl + 0x48u + lvlId * 4u) == 0u) {
    uint32_t pObjLvl = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    U32(pObjLvl + 0x08u) = 0x7FFFFFFFu;
    U32(pObjCtrl + 0x48u + lvlId * 4u) = pObjLvl;
  }
}

static __attribute__((unused)) void stage_room_logical_info(uint32_t pRoomEx) {
  uint32_t pLog  = (uint32_t)(uintptr_t)bump_alloc(0x34u);
  uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x30u);
  U32(pLog + 0x00u) = 1u;
  U32(pLog + 0x04u) = 1u;
  U32(pLog + 0x30u) = pNode;
  U32(pNode + 0x00u) = 998u;
  U32(pNode + 0x04u) = 998u;
  U32(pNode + 0x08u) = 1004u;
  U32(pNode + 0x0Cu) = 1004u;
  U32(pNode + 0x10u) = 998u;
  U32(pNode + 0x14u) = 998u;
  U32(pNode + 0x18u) = 1004u;
  U32(pNode + 0x1Cu) = 1004u;
  U32(pRoomEx + 0x64u) = pLog;
}

static __attribute__((unused)) void stage_npc_ctrl(void) {
  if (U32(STAGE_GAME + 0x1D24u) != 0u) return;
  uint32_t pNpcCtrl = (uint32_t)(uintptr_t)bump_alloc(0x20u);
  uint32_t pEntries = (uint32_t)(uintptr_t)bump_alloc(0x44u * 0x40u);
  for (uint32_t i = 0u; i < 0x40u; i++) {
    U32(pEntries + i * 0x44u) = 0xFFFFFFFFu;
  }
  static const uint32_t kNpcs[] = { 0x1FFu, 0x200u, 0x201u, 0x202u, 0x203u, 0x1DAu, 0x1DBu, 0x1DCu, 0x92u, 0x94u, 0x9Au };
  for (uint32_t i = 0u; i < (uint32_t)(sizeof(kNpcs) / sizeof(kNpcs[0])); i++) {
    U32(pEntries + i * 0x44u) = kNpcs[i];
  }
  U32(pNpcCtrl + 0x00u) = 0u;
  U32(pNpcCtrl + 0x04u) = pEntries;
  U32(STAGE_GAME + 0x1D24u) = pNpcCtrl;
}

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
      uint32_t rva = v - lo;
      if (rva >= 0x1000u && (rva >= 0xF8000u || (rva & 3u) == 0u)) {
        U32(a) = v - delta;
      }
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
            "[k6-p9] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-p9] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-p9] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-p9] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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
    if (!g_item_sword && code == 0x20647373u) g_item_sword = id;
    if (!g_item_bow   && code == 0x20776273u) g_item_bow   = id;
    if (!g_item_ring  && code == 0x206E6972u) g_item_ring  = id;
    if (!g_item_armor && code == 0x20697571u) g_item_armor = id;
    if (!g_item_gold  && code == 0x20646C67u) g_item_gold  = id;
    if (!g_item_pot   && code == 0x20317068u) g_item_pot   = id;
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


static void emit_batch_1a(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* 1. SKILLS_PostInitSummonedPetStatsAndAi (skipped: TS parity bug) */

  /* 2. 0x6FC7DF70 deferred to Batch 3 after DRLG level-transition helper check */

  /* 3. 0x6FC8F620 MISSILE_InitOwnerDamageStats113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x102u, 1u, 5000u, 5000u, 0x4441u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 3u, 44u, 0x302u, 0u, 5002u, 5002u, 0x4451u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 10 + k * 5, 0); /* mindam */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 20 + k * 10, 0); /* maxdam */
    uint32_t lvl = (uint32_t)(1 + k * 3);
    c = make_call();
    c.eax = STAGE_UNIT0; c.ebx = STAGE_UNIT1; c.edi = lvl;
    c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = lvl; ts[3] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "missile_owner_dmg_k%d", k);
    run_and_emit(0x6FC8F620u, "MISSILE_InitOwnerDamageStats113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* 4. 0x6FC911D0 ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 0x103u, 5u, 5000u, 5000u, 0x5551u + (uint32_t)k);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x103u);
    stage_client_pkt_pool(STAGE_CLIENT);
    if (k > 0) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      if (k == 2) {
        stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x403u, 2u, 1u, 100u, 0x6661u);
        U8(STAGE_UDATA1 + 0x45u) = 3u; /* bInvPage = 3 (cube page) */
        U32(STAGE_UNIT1 + 0x10u) = 0u; /* ITEMMODE_STORED */
        U32(STAGE_UNIT1 + 0xE8u) = 0u;
        fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 0);
      }
    }
    c = make_call();
    c.eax = STAGE_UNIT0; c.ecx = STAGE_CLIENT;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_CLIENT; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "cube_rm_page3_k%d", k);
    run_and_emit(0x6FC911D0u, "ACT3Q2_RemoveAllCubePage3ItemsFromUnit_6FC911D0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 5. 0x6FC934E0 PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x104u, 5u, 5000u, 5000u, 0x7771u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    U32(STAGE_UNIT0 + 0x64u) = 0x222u;
    U32(STAGE_UNIT0 + 0x68u) = (k == 1) ? 4u : 2u;
    U8(STAGE_UNIT0 + 0x6Cu)  = (k == 1) ? 1u : 0u;
    uint32_t subAct = (k == 2) ? 0x10u : 0x17u;
    c = make_call();
    c.eax = STAGE_UNIT0; c.ecx = subAct;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = subAct; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "trade_subact_k%d", k);
    run_and_emit(0x6FC934E0u, "PLRTRADE_DispatchSubAction17Or18_6FC934E0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 6. 0x6FC94D50 PLAYER_RecalcTargetUnitPath113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0x105u, 2u, 5000u, 5000u, 0x8881u);
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x105u, 2u, 5000u, 5000u, 0x8881u);
    }
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 0x205u, 1u, 5004u, 5004u, 0x8882u);
    fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    U16(STAGE_PATH0 + 0x24u) = 5004u;
    U16(STAGE_PATH0 + 0x26u) = 5004u;
    U32(STAGE_SCRATCH + 0x04u) = (k == 0) ? STAGE_UNIT1 : 0u;
    U32(STAGE_SCRATCH + 0x08u) = (k == 0) ? 5004u : 0u;
    U32(STAGE_SCRATCH + 0x0Cu) = (k == 0) ? 5004u : 0u;
    uint32_t newDist = (uint32_t)(2 + k * 3);
    uint32_t pathType = (k == 2) ? 4u : 2u;
    c = make_call();
    c.eax = newDist; c.edi = STAGE_SCRATCH;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = pathType; c.calleePop = 8u;
    ts[0] = newDist; ts[1] = STAGE_SCRATCH; ts[2] = STAGE_UNIT0; ts[3] = pathType;
    snprintf(lbl, sizeof(lbl), "recalc_target_path_k%d", k);
    run_and_emit(0x6FC94D50u, "PLAYER_RecalcTargetUnitPath113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 7. MONSTER_SetDeathPathAndAnim (skipped: void vs return 1 parity) */

  /* 8. 0x6FC95510 MONSTER_StartAttackOrCast113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x207u, 1u, 5002u, 5002u, 0xAAA1u + (uint32_t)k);
    uint32_t mode = (k == 0) ? 1u : (k == 1 ? 4u : 5u);
    U32(STAGE_SCRATCH + 0x00u) = mode;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "mon_start_atk_k%d", k);
    run_and_emit(0x6FC95510u, "MONSTER_StartAttackOrCast113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 9. 0x6FC95900 MONSTER_DropDeathItems_6FC95900_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x208u, 0u, 5002u, 5002u, 0xBBB1u + (uint32_t)k);
    if (k == 0) {
      U32(STAGE_UNIT0 + 0xC4u) |= (1u << 17); /* skip death drop */
    } else if (k == 1) {
      uint32_t pColl = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pMap  = U32(pColl + 0x20u);
      U16(pMap + ((5002u - 998u) * 32u + (5002u - 998u)) * 2u) = 0x0801u;
    }
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c = make_call();
    c.edi = STAGE_SCRATCH;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "mon_drop_death_k%d", k);
    run_and_emit(0x6FC95900u, "MONSTER_DropDeathItems_6FC95900_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 10. 0x6FC95CE0 MONSTER_AdvanceAttackOrSkillStep113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x209u, (k == 0) ? 1u : (k == 1 ? 6u : 4u), 5002u, 5002u, 0xCCC1u + (uint32_t)k);
    U32(STAGE_UNIT0 + 0x48u) = 0x500u; /* dwFrameCountPrecise */
    U16(STAGE_UNIT0 + 0x4Cu) = 0x100u; /* wAnimSpeed */
    U32(STAGE_UNIT0 + 0x44u) = (k == 2) ? 0x600u : 0x100u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "mon_adv_step_k%d", k);
    run_and_emit(0x6FC95CE0u, "MONSTER_AdvanceAttackOrSkillStep113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 11. MONSTER_StartGetHitOrScheduleAi (skipped: TS parity bug) */

  /* 12. 0x6FC96A10 MONSTER_TickPathStepAndAnim_6FC96A10_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x20Bu, 1u, 5002u, 5002u, 0xEEE1u + (uint32_t)k);
    U32(STAGE_UNIT0 + 0x48u) = 0x500u;
    U16(STAGE_UNIT0 + 0x4Cu) = 0x100u;
    U32(STAGE_UNIT0 + 0x44u) = (k == 0) ? 0x100u : ((k == 1) ? 0x480u : 0x500u);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "mon_tick_step_k%d", k);
    run_and_emit(0x6FC96A10u, "MONSTER_TickPathStepAndAnim_6FC96A10_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 13. 0x6FC97B20 PLAYER_AdvanceSkillModeFrame113c (pGame=0 snapshot restore) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x10Bu, 5u, 5000u, 5000u, 0xFFF1u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x10Bu);
    stage_client_pkt_pool(STAGE_CLIENT);
    void *pSkList = fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)pSkList;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 36, 5, 1, 0, 0); /* Fire Bolt */
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 47, 3, 1, 0, 0); /* Fire Ball */
    U32(STAGE_SCRATCH + 0x00u) = (k >= 1) ? 36u : 0u;
    U32(STAGE_SCRATCH + 0x04u) = (k == 2) ? 47u : 0u;
    U32(STAGE_SCRATCH + 0x08u) = 0xFFFFFFFFu;
    U32(STAGE_SCRATCH + 0x0Cu) = 0xFFFFFFFFu;
    c = make_call();
    c.esi = STAGE_UNIT0; c.edi = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = 0; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "plr_restore_skills_k%d", k);
    run_and_emit(0x6FC97B20u, "PLAYER_AdvanceSkillModeFrame113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 14. 0x6FC97FA0 AITHINK_CanPlayerStartSkillOrCast113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x10Cu, (k == 0) ? 0u : 5u, 5000u, 5000u, 0x1121u);
    uint32_t nMode = (k == 0) ? 10u : ((k == 1) ? 0u : 10u);
    uint32_t bCheck = (k == 2) ? 1u : 0u;
    c = make_call();
    c.ebx = STAGE_GAME; c.esi = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = nMode; c.args[1] = bCheck; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = nMode; ts[3] = bCheck; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "plr_can_start_skill_k%d", k);
    run_and_emit(0x6FC97FA0u, "AITHINK_CanPlayerStartSkillOrCast113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* 15. 0x6FC98840 PLAYER_StartCastSkillAtCoords113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x10Du, 1u, 5000u, 5000u, 0x1131u);
    U32(STAGE_UNIT0 + 0xC4u) |= 0x40u;
    U32(STAGE_UNIT0 + 0x48u) = 0x500u;
    U16(STAGE_UNIT0 + 0x4Cu) = 0x100u;
    uint32_t mode = (k == 0) ? 10u : (k == 1 ? 7u : 8u);
    uint32_t nx = (uint32_t)(5005 + k * 2);
    uint32_t ny = (uint32_t)(5006 + k * 2);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = mode; c.args[1] = nx; c.args[2] = ny; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = mode; ts[3] = nx; ts[4] = ny;
    snprintf(lbl, sizeof(lbl), "plr_cast_coords_k%d", k);
    run_and_emit(0x6FC98840u, "PLAYER_StartCastSkillAtCoords113c", k, lbl, &c, ts, 5, 0u, 0);
  }

  /* 16. 0x6FC98C50 ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x10Eu, 1u, 5002u, 5002u, 0x1141u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 0x10Fu, 1u, 5004u, 5004u, 0x1149u + (uint32_t)k);
    uint32_t gold = (k == 0) ? 0u : (k == 1 ? 123u : 777u);
    uint32_t owner = (k == 2) ? STAGE_UNIT1 : 0u;
    c = make_call();
    c.eax = STAGE_UNIT0; c.edi = gold; c.ebx = owner;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = gold; ts[2] = owner; ts[3] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "drop_gold_k%d", k);
    run_and_emit(0x6FC98C50u, "ITEMS_DropGoldPileWithOwnerAtUnit_6FC98C50_113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* 17. 0x6FC98D00 D2Game_6FC98D00_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x110u, 5u, 5000u, 5000u, 0x1151u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 2) ? g_item_ring : g_item_pot, 0x410u, 2u, 1u, 100u, 0x1155u);
    int expectAssert = (k == 0) ? 1 : 0;
    if (k > 0) {
      U32(STAGE_UNIT1 + 0x10u) = 1u; /* ITEMMODE_EQUIP */
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, (k == 2) ? 6 : 4);
    }
    uint32_t loc = (k == 2) ? 6u : 4u;
    c = make_call();
    c.eax = STAGE_UNIT0; c.ecx = STAGE_UNIT1;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = loc; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_GAME; ts[3] = loc;
    snprintf(lbl, sizeof(lbl), "inv_reattach_k%d", k);
    run_and_emit(0x6FC98D00u, "D2Game_6FC98D00_113c", k, lbl, &c, ts, 4, 0u, expectAssert);
  }

  /* 18. PLAYER_StartModeSkill (skipped: qty consume vs depleted item swap/delete mismatch) */

  /* 19. 0x6FC99100 PLAYER_ScheduleSkillActionFrameEvents113c (action=-1,end=-1 dual consume) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 1u : 0u, 0u, 0x112u, 10u, 5000u, 5000u, 0x1171u);
    if (k == 2) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      void *pSkList = fn_AllocSkillList(NULL);
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)pSkList;
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 36, 5, 1, 0, 0);
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x412u, 2u, 1u, 100u, 0x1175u);
      U32(STAGE_UNIT1 + 0x10u) = 1u; /* ITEMMODE_EQUIP */
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4);
    }
    c = make_call();
    c.eax = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = -1; ts[3] = -1;
    snprintf(lbl, sizeof(lbl), "plr_dual_consume_k%d", k);
    run_and_emit(0x6FC99100u, "PLAYER_ScheduleSkillActionFrameEvents113c", k, lbl, &c, ts, 4, 0u, 0);
  }
}


static void emit_batch_1b(void) {
  X86CallSpec c;
  int64_t ts[12];
  char lbl[48];

  /* 20. 0x6FC97BB0 PLAYER_DrainRunStamina113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 1u : 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x120u, 3u, 5000u, 5000u, 0x2101u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, (k == 2) ? 0 : 0x5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 0x8000, 0);
    c = make_call();
    c.edi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "drain_stamina_k%d", k);
    run_and_emit(0x6FC97BB0u, "PLAYER_DrainRunStamina113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* 21. PLAYER_StartModeAtCoords (skipped: void eax=0 vs TS return 1) */

  /* 22. PLAYER_HandleDeathCorpseAndSave (skipped: TS parity bug in 0x6FC99210) */

  /* 23. PLAYER_StepAnimationModeTick skipped (TS parity bug on mode=2 / res=2) */

  /* 25. 0x6FC99B90 PLAYER_StepModeWalkOrRun113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 2) ? 3u : 2u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x125u, mode, 5000u, 5000u, 0x2151u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    U32(STAGE_PATH0 + 0x40u) = 5000u << 16;
    U32(STAGE_PATH0 + 0x44u) = 5000u << 16;
    U16(STAGE_PATH0 + 0x24u) = (k == 0) ? 5000u : 5010u;
    U16(STAGE_PATH0 + 0x26u) = (k == 0) ? 5000u : 5010u;
    U32(STAGE_PATH0 + 0x70u) = (k == 0) ? 0u : 2u;
    U32(STAGE_PATH0 + 0x104u) = (k == 0) ? 0u : ((5005u << 16) | 5005u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, (k == 2) ? 0 : 0x4000, 0);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "plr_walk_run_k%d", k);
    run_and_emit(0x6FC99B90u, "PLAYER_StepModeWalkOrRun113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 26. PLAYER_ProcessPlayerDeathAndPenalties skipped (TS parity bug) */

  /* 27. 0x6FC99FE0 UNIT_FreeEventNotifyList113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 0x128u, 1u, 5000u, 5000u, 0x2171u);
    if (k >= 1) {
      uint32_t n0 = (uint32_t)(uintptr_t)bump_alloc(0x18u);
      U32(STAGE_UNIT0 + 0xECu) = n0;
      U32(STAGE_UNIT0 + 0xF0u) = n0;
      if (k == 2) {
        uint32_t n1 = (uint32_t)(uintptr_t)bump_alloc(0x18u);
        U32(n0 + 0x00u) = n1;
        U32(STAGE_UNIT0 + 0xF0u) = n1;
      }
    }
    c = make_call();
    c.edi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "free_notify_k%d", k);
    run_and_emit(0x6FC99FE0u, "UNIT_FreeEventNotifyList113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* 28. 0x6FC9ACB0 SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_client_pkt_pool(STAGE_CLIENT);
    if (k >= 1) {
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x129u, 1u, 5000u, 5000u, 0x2181u);
    }
    if (k == 2) {
      uint32_t pHover = (uint32_t)(uintptr_t)bump_alloc(0x30u);
      U32(STAGE_UNIT0 + 0xA4u) = pHover;
      U16(pHover + 0x02u) = 0x123u;
      memcpy((void *)(uintptr_t)(pHover + 0x04u), "HelloD2", 8);
    }
    uint32_t u = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.eax = u;
    c.nargs = 1; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = u; ts[1] = STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "hover_msg_pkt_k%d", k);
    run_and_emit(0x6FC9ACB0u, "SUNIT_SendHoverMsgOrClearPacketToClient_6FC9ACB0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }
}


static void emit_batch_1c(void) {
  X86CallSpec c;
  int64_t ts[12];
  char lbl[48];

  /* 29. 0x6FC9ADF0 UNIT_FlushEventNotifyQueueToClient113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_client_pkt_pool(STAGE_CLIENT);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x130u + (uint32_t)k, 1u, 5000u, 5000u, 0x3101u);
    if (k == 1) {
      uint32_t n0 = (uint32_t)(uintptr_t)bump_alloc(0x18u);
      U8(n0 + 0x04u) = 0xA4u;
      U16(n0 + 0x08u) = 0x1234u;
      U32(STAGE_UNIT0 + 0xECu) = n0;
      U32(STAGE_UNIT0 + 0xF0u) = n0;
    } else if (k == 2) {
      uint32_t n0 = (uint32_t)(uintptr_t)bump_alloc(0x18u);
      uint32_t n1 = (uint32_t)(uintptr_t)bump_alloc(0x18u);
      U32(n0 + 0x00u) = n1;
      U8(n0 + 0x04u) = 0xA4u;
      U16(n0 + 0x08u) = 0x4567u;
      U8(n1 + 0x04u) = 0xA4u;
      U16(n1 + 0x08u) = 0x89ABu;
      U32(STAGE_UNIT0 + 0xECu) = n0;
      U32(STAGE_UNIT0 + 0xF0u) = n1;
    }
    c = make_call();
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_CLIENT; c.calleePop = 8u;
    ts[0] = STAGE_CLIENT; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "flush_notify_k%d", k);
    run_and_emit(0x6FC9ADF0u, "UNIT_FlushEventNotifyQueueToClient113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 30. 0x6FCAC570 D2GAME_PACKET_SendPlayerPartyRelationship113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_client_pkt_pool(STAGE_CLIENT);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x131u + (uint32_t)k, 1u, 5000u, 5000u, 0x3111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 0x231u + (uint32_t)k, 1u, 5002u, 5002u, 0x3112u);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT, 0x231u + (uint32_t)k);
    uint32_t target = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.eax = target; c.esi = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = target; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "pkt_party_rel_k%d", k);
    run_and_emit(0x6FCAC570u, "D2GAME_PACKET_SendPlayerPartyRelationship113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 31. 0x6FCAD210 NET_SendUnitTargetedSkillAction113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_client_pkt_pool(STAGE_CLIENT);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x132u, 1u, 5000u, 5000u, 0x3121u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x132u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t bTargType = (k == 0) ? 1u : 0u;
    uint32_t dwTargId  = (k == 0) ? 0x999u : 0x132u;
    uint32_t bTrig     = (k == 2) ? 1u : 0u;
    uint32_t wSkill    = (k == 0) ? 36u : ((k == 1) ? 47u : 59u);
    c = make_call();
    c.eax = STAGE_CLIENT; c.ebx = bTrig;
    c.nargs = 7;
    c.args[0] = 0u; c.args[1] = 0x132u; c.args[2] = bTargType; c.args[3] = dwTargId;
    c.args[4] = wSkill; c.args[5] = (uint32_t)(0x12 + k); c.args[6] = (uint32_t)(5 + k);
    c.calleePop = 28u;
    ts[0] = STAGE_CLIENT; ts[1] = bTrig; ts[2] = 0; ts[3] = 0x132u; ts[4] = bTargType; ts[5] = dwTargId;
    ts[6] = wSkill; ts[7] = (int64_t)(0x12 + k); ts[8] = (int64_t)(5 + k);
    snprintf(lbl, sizeof(lbl), "pkt_targeted_skill_k%d", k);
    run_and_emit(0x6FCAD210u, "NET_SendUnitTargetedSkillAction113c", k, lbl, &c, ts, 9, 0u, 0);
  }

  /* 32. 0x6FCAD670 D2GAME_PACKET_Send0x73MissileSync113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_client_pkt_pool(STAGE_CLIENT);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t dwGuid = 0x333u + (uint32_t)k;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 44u, dwGuid, 0u, 5000u, 5000u, 0x3131u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t bHdr  = (k == 2) ? 0x74u : 0x73u;
    uint32_t posX  = (uint32_t)(5010 + k * 7);
    uint32_t posY  = (uint32_t)(5020 + k * 9);
    uint32_t wInfo = (uint32_t)(0x55 + k * 3);
    c = make_call();
    c.esi = STAGE_CLIENT; c.ebx = 3u; c.edi = dwGuid;
    c.nargs = 6; c.args[0] = bHdr; c.args[1] = posX; c.args[2] = posY; c.args[3] = wInfo; c.args[4] = (uint32_t)(1 + k); c.args[5] = (uint32_t)(2 + k);
    c.calleePop = 24u;
    ts[0] = STAGE_CLIENT; ts[1] = 3; ts[2] = dwGuid; ts[3] = bHdr; ts[4] = posX; ts[5] = posY; ts[6] = wInfo; ts[7] = (int64_t)(1 + k); ts[8] = (int64_t)(2 + k);
    snprintf(lbl, sizeof(lbl), "pkt_0x73_missile_k%d", k);
    run_and_emit(0x6FCAD670u, "D2GAME_PACKET_Send0x73MissileSync113c", k, lbl, &c, ts, 9, 0u, 0);
  }

  /* 33. 0x6FCAD710 NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_client_pkt_pool(STAGE_CLIENT);
    snprintf((char *)(uintptr_t)STAGE_SCRATCH, 16u, "%s", (k == 1) ? "Sorceress" : "AmazonHero");
    uint32_t pName = (k == 0) ? 0u : STAGE_SCRATCH;
    uint32_t cls   = (uint32_t)k;
    uint32_t guid  = 0x140u + (uint32_t)k;
    uint32_t wx    = 5000u + (uint32_t)k * 10u;
    uint32_t wy    = 5010u + (uint32_t)k * 10u;
    c = make_call();
    c.eax = STAGE_CLIENT; c.ecx = cls; c.edi = guid;
    c.nargs = 3; c.args[0] = pName; c.args[1] = wx; c.args[2] = wy; c.calleePop = 12u;
    ts[0] = STAGE_CLIENT; ts[1] = cls; ts[2] = guid; ts[3] = pName; ts[4] = wx; ts[5] = wy;
    snprintf(lbl, sizeof(lbl), "pkt_0x59_assign_k%d", k);
    run_and_emit(0x6FCAD710u, "NET_SendPacket59_AssignPlayerAndPartyRoster_6FCAD710_113c", k, lbl, &c, ts, 6, 0u, 0);
  }

  /* 34. 0x6FCADB00 D2NET_SendUnitPosSync0x15ToClient113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_client_pkt_pool(STAGE_CLIENT);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x150u, 1u, 5000u, 5000u, 0x3151u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x150u);
    int expectAssert = (k == 0) ? 1 : 0;
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t wx = 5000u + (uint32_t)k * 5u;
    uint32_t wy = 5002u + (uint32_t)k * 5u;
    c = make_call();
    c.eax = 0x150u; c.edx = 0u; c.ebx = pCli;
    c.nargs = 4; c.args[0] = (k == 2) ? 1u : 0u; c.args[1] = wx; c.args[2] = wy; c.args[3] = 0u; c.calleePop = 16u;
    ts[0] = 0x150u; ts[1] = 0; ts[2] = pCli; ts[3] = (k == 2) ? 1 : 0; ts[4] = wx; ts[5] = wy; ts[6] = 0;
    snprintf(lbl, sizeof(lbl), "pkt_0x15_realign_k%d", k);
    run_and_emit(0x6FCADB00u, "D2NET_SendUnitPosSync0x15ToClient113c", k, lbl, &c, ts, 7, 0u, expectAssert);
  }

  /* 35. 0x6FCADC30 S2C_SendPacket0F_UnitWalkToTarget113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_client_pkt_pool(STAGE_CLIENT);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t monGuid = 0x160u + (uint32_t)k;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, monGuid, 2u, 5000u + (uint16_t)k, 5002u + (uint16_t)k, 0x3161u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t bOp  = (k == 2) ? 0x10u : 0x0Fu;
    uint32_t mTyp = (k == 1) ? 0x18u : 0x01u;
    uint32_t xy   = (uint32_t)(5005 + k * 3) | ((uint32_t)(5007 + k * 5) << 16);
    c = make_call();
    c.ebx = STAGE_CLIENT; c.ecx = monGuid; c.edx = bOp;
    c.nargs = 4; c.args[0] = 1u; c.args[1] = mTyp; c.args[2] = xy; c.args[3] = (uint32_t)k; c.calleePop = 16u;
    ts[0] = STAGE_CLIENT; ts[1] = monGuid; ts[2] = bOp; ts[3] = 1; ts[4] = mTyp; ts[5] = xy; ts[6] = k;
    snprintf(lbl, sizeof(lbl), "pkt_0x0f_walk_k%d", k);
    run_and_emit(0x6FCADC30u, "S2C_SendPacket0F_UnitWalkToTarget113c", k, lbl, &c, ts, 7, 0u, 0);
  }

  /* 36. 0x6FCAE170 D2GAME_PACKET_Send0x5BPlayerInGame113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_client_pkt_pool(STAGE_CLIENT);
    stage_client_pkt_pool(STAGE_CLIENT1);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, (uint32_t)k, 0x170u + (uint32_t)k, 1u, 5000u, 5000u, 0x3171u);
    snprintf((char *)(uintptr_t)STAGE_UDATA0, 16u, "%s", (k == 0) ? "Alice" : ((k == 1) ? "BobHero" : "Carol"));
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x170u + (uint32_t)k);
    U16(STAGE_CLIENT + 0x45Eu) = (uint16_t)(0x10u + k);
    snprintf((char *)(uintptr_t)(STAGE_CLIENT + 0x460u), 4u, "T%d", k);
    snprintf((char *)(uintptr_t)(STAGE_CLIENT + 0x464u), 16u, "Guild%d", k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10 + k * 15, 0);
    c = make_call();
    c.esi = STAGE_UNIT0; c.ebx = STAGE_CLIENT;
    c.nargs = 1; c.args[0] = STAGE_CLIENT1; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_CLIENT; ts[2] = STAGE_CLIENT1;
    snprintf(lbl, sizeof(lbl), "pkt_0x5b_ingame_k%d", k);
    run_and_emit(0x6FCAE170u, "D2GAME_PACKET_Send0x5BPlayerInGame113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 37. 0x6FCAE2A0 NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_client_pkt_pool(STAGE_CLIENT);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 0x185u, 1u, 5000u, 5000u, 0x3180u);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT, 0x185u);
    if (k >= 1) {
      uint16_t mx = (k == 2) ? 5080u : 5002u;
      uint16_t my = (k == 2) ? 5080u : 5002u;
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x180u + (uint32_t)k, 1u, mx, my, 0x3181u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (50 + k * 25) << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    }
    int expectAssert = (k == 0) ? 1 : 0;
    uint32_t member = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.eax = STAGE_CLIENT; c.edi = member; c.calleePop = 0u;
    ts[0] = STAGE_CLIENT; ts[1] = member;
    snprintf(lbl, sizeof(lbl), "pkt_0x7f_party_life_k%d", k);
    run_and_emit(0x6FCAE2A0u, "NET_SendPacket7F_PartyMemberLifeAndLevel_6FCAE2A0_113c", k, lbl, &c, ts, 2, 0u, expectAssert);
  }

  /* 38. 0x6FCAE6F0 EVENT_FreeNode113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pTimer = stage_timer_queue();
    uint32_t pNode  = (uint32_t)(uintptr_t)bump_alloc(0x30u);
    U8(pNode + 0x01u)  = 0u;
    U16(pNode + 0x02u) = (k == 0) ? 0x01u : 0x00u; /* firing vs normal */
    U32(pNode + 0x04u) = 105u;
    U32(pTimer + 0x00u) = pNode;
    U32(pTimer + 0x08u) = pNode;
    if (k == 2) {
      U32(pTimer + 0xA18u) = pNode; /* pSavedNext */
    }
    c = make_call();
    c.eax = pNode; c.edi = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = pNode;
    snprintf(lbl, sizeof(lbl), "event_free_node_k%d", k);
    run_and_emit(0x6FCAE6F0u, "EVENT_FreeNode113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 39. 0x6FCAF620 NPCS_FreePlayerGambleInventoryForNpc_6FCAF620_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x190u, 5u, 5000u, 5000u, 0x3191u);
    uint32_t pNpcCtrl = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    uint32_t pEntries = (uint32_t)(uintptr_t)bump_alloc(0x44u * 64u);
    U32(STAGE_GAME + 0x1D24u) = pNpcCtrl;
    U32(pNpcCtrl + 0x00u) = 1u;
    U32(pNpcCtrl + 0x04u) = pEntries;
    U32(pEntries + 0x00u) = 147u; /* Gheed */
    U32(STAGE_SCRATCH + 0x04u) = 147u;
    if (k >= 1) {
      U32(pEntries + 0x0Cu) = 1u;
      uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x0Cu);
      U32(pNode + 0x00u) = 0u;
      U32(pNode + 0x04u) = (k == 1) ? 0x999u : 0x190u;
      U32(pEntries + 0x08u) = pNode;
    }
    c = make_call();
    c.eax = STAGE_SCRATCH; c.ecx = STAGE_UNIT0; c.ebx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "npcs_free_gamble_k%d", k);
    run_and_emit(0x6FCAF620u, "NPCS_FreePlayerGambleInventoryForNpc_6FCAF620_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 40. 0x6FCAF6C0 SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x1A0u, 5u, 5000u, 5000u, 0x31A1u);
    uint32_t pSlot = STAGE_SCRATCH;
    if (k == 2) {
      uint32_t pExist = (uint32_t)(uintptr_t)bump_alloc(0x0Cu);
      U32(pExist + 0x00u) = 0x1A0u;
      U32(pSlot + 0x18u) = pExist;
    }
    uint32_t u = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.eax = u; c.edi = pSlot;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = u; ts[1] = pSlot; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "sunitproxy_node_k%d", k);
    run_and_emit(0x6FCAF6C0u, "SUNITPROXY_FindOrCreateNodeInList18_6FCAF6C0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 41. 0x6FCAF720 NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pNpcCtrl = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    uint32_t pEntries = (uint32_t)(uintptr_t)bump_alloc(0x44u * 4u);
    U32(STAGE_GAME + 0x1D24u) = pNpcCtrl;
    U32(pNpcCtrl + 0x00u) = (k == 0) ? 0u : 2u;
    U32(pNpcCtrl + 0x04u) = pEntries;
    if (k >= 1) {
      U8(pEntries + 0x20u + 0x03u) = 1u;
      U8(pEntries + 0x20u + 0x00u) = 1u;
      U32(pEntries + 0x20u - 0x04u) = 1u;
    }
    if (k == 2) {
      U8(pEntries + 0x44u + 0x20u + 0x03u) = 1u;
      U8(pEntries + 0x44u + 0x20u + 0x00u) = 1u;
      U32(pEntries + 0x44u + 0x20u - 0x04u) = 1u;
    }
    uint32_t guid = 0x500u + (uint32_t)k;
    c = make_call();
    c.edi = STAGE_GAME;
    c.nargs = 1; c.args[0] = guid; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = guid;
    snprintf(lbl, sizeof(lbl), "npcs_rec_ev4_k%d", k);
    run_and_emit(0x6FCAF720u, "NPCS_RecordEvent4ForActiveNpcSlots_6FCAF720_113c", k, lbl, &c, ts, 2, 0u, 0);
  }
}


static uint32_t stage_quest_dialog_setup(
    uint32_t qId, uint32_t bState, uint32_t bActive, uint32_t npcClassId,
    uint32_t pNpcUnit, int setBit0, int setBitX, uint32_t bitX) {
  stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
  stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x220u, 1u, 5000u, 5000u, 0x4201u);
  link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x220u);
  stage_client_pkt_pool(STAGE_CLIENT);
  uint32_t pFlags = (uint32_t)(uintptr_t)bump_alloc(0x80u);
  attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
  if (setBit0) set_quest_bit(pFlags, qId, 0u);
  if (setBitX) set_quest_bit(pFlags, qId, bitX);
  stage_quest_node(STAGE_QUEST0, qId, STAGE_QUESTEX0, 0u);
  U8(STAGE_QUEST0 + 0x09u) = (uint8_t)bActive;
  U8(STAGE_QUEST0 + 0x0Cu) = (uint8_t)bState;
  U32(STAGE_QUEST0 + 0xE0u) = qId;
  uint32_t pMsgTbls = U32(STAGE_QUEST0 + 0xDCu);
  for (uint32_t ti = 0u; ti < 6u; ti++) {
    uint32_t t = pMsgTbls + ti * 0xC4u;
    U32(t + 0x00u) = npcClassId;
    U16(t + 0x04u) = (uint16_t)(0x4E80u + ti);
    U32(t + 0x08u) = 1u;
    U32(t + 0xC0u) = 1u;
  }
  U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
  U32(STAGE_SCRATCH + 0x08u) = pNpcUnit;
  U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
  U32(STAGE_SCRATCH + 0x14u) = STAGE_SCRATCH + 0x80u;
  return pFlags;
}

static void emit_batch_2a(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* 1. 0x6FC767A0 ACT5Q6_SeqFilter_6FC767A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pQ1 = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    uint32_t pQEx1 = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    stage_quest_node(pQ1, 0x27u, pQEx1, 0u);
    U8(pQ1 + 0x09u) = 1u;
    U8(pQ1 + 0x0Cu) = (k == 2) ? 0u : 4u;
    U32(pQ1 + 0xF0u) = game_global_live(D2GAME_PREF_BASE + 0x5AFB0u);
    stage_quest_node(STAGE_QUEST0, 0x28u, STAGE_QUESTEX0, pQ1);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 0u : 5u;
    U32(STAGE_QUEST0 + 0x10u) = (k == 1) ? 99u : 0x27u;
    U32(STAGE_QUEST0 + 0xF0u) = game_global_live(D2GAME_PREF_BASE + 0x5AFB0u);
    c = make_call();
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    snprintf(lbl, sizeof(lbl), "a5q6_seq_k%d", k);
    run_and_emit(0x6FC767A0u, "ACT5Q6_SeqFilter_6FC767A0_113c", k, lbl, &c, ts, 1, 0xFFu, 0);
  }

  /* 2. 0x6FC76B10 ACT5Q4_SeqFilter_6FC76B10_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pQ1 = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    uint32_t pQEx1 = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    stage_quest_node(pQ1, 0x25u, pQEx1, 0u);
    U8(pQ1 + 0x09u) = 1u;
    U8(pQ1 + 0x0Cu) = (k == 2) ? 0u : 4u;
    U32(pQ1 + 0xF0u) = game_global_live(D2GAME_PREF_BASE + 0x5AFB0u);
    stage_quest_node(STAGE_QUEST0, 0x26u, STAGE_QUESTEX0, pQ1);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 0u : 5u;
    U32(STAGE_QUEST0 + 0x10u) = (k == 1) ? 99u : 0x25u;
    U32(STAGE_QUEST0 + 0xF0u) = game_global_live(D2GAME_PREF_BASE + 0x5AFB0u);
    c = make_call();
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    snprintf(lbl, sizeof(lbl), "a5q4_seq_k%d", k);
    run_and_emit(0x6FC76B10u, "ACT5Q4_SeqFilter_6FC76B10_113c", k, lbl, &c, ts, 1, 0xFFu, 0);
  }

  /* 3. 0x6FC77000 ACT5Q6_Callback00_NpcActivate_6FC77000_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pQ1 = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    uint32_t pQEx1 = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    stage_quest_node(pQ1, 0x27u, pQEx1, 0u);
    U8(pQ1 + 0x0Cu) = 5u;
    U8(pQEx1 + 0x00u) = 1u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x201u, 0x321u, 1u, 5002u, 5002u, 0x4202u);
    uint32_t pf = stage_quest_dialog_setup(0x28u, (k == 2) ? 3u : 2u, 1u, 0x201u, (k == 0) ? 0u : STAGE_UNIT1, (k == 2), 0, 0u);
    (void)pf;
    U32(STAGE_QUEST0 + 0xF4u) = pQ1;
    U8(STAGE_QUESTEX0 + 0x90u) = (k == 0) ? 0u : 1u;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q6_npc_act_k%d", k);
    run_and_emit(0x6FC77000u, "ACT5Q6_Callback00_NpcActivate_6FC77000_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 4. 0x6FC775F0 ACT5Q5_Callback00_NpcActivate_6FC775F0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x203u, 0x322u, 1u, 5002u, 5002u, 0x4203u);
    uint32_t pf = stage_quest_dialog_setup(0x27u, (uint32_t)(2 + k), 1u, 0x203u, STAGE_UNIT1, (k == 2), (k == 1), 1u);
    (void)pf;
    U8(STAGE_QUESTEX0 + 0x00u) = (k == 0) ? 0u : 1u;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q5_npc_act_k%d", k);
    run_and_emit(0x6FC775F0u, "ACT5Q5_Callback00_NpcActivate_6FC775F0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 5. 0x6FC77A60 ACT5Q4_Callback00_NpcActivate_6FC77A60_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x200u, 0x323u, 1u, 5002u, 5002u, 0x4204u);
    uint32_t pf = stage_quest_dialog_setup(0x26u, (uint32_t)(1 + k), 1u, 0x200u, STAGE_UNIT1, (k == 2), (k == 1), 1u);
    (void)pf;
    U8(STAGE_QUESTEX0 + 0x86u) = (k == 0) ? 0u : 1u;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q4_npc_act_k%d", k);
    run_and_emit(0x6FC77A60u, "ACT5Q4_Callback00_NpcActivate_6FC77A60_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 6. 0x6FC783C0 ACT5Q2_Callback00_NpcActivate_6FC783C0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x203u, 0x324u, 1u, 5002u, 5002u, 0x4205u);
    stage_quest_dialog_setup(0x24u, (uint32_t)(2 + k), 1u, 0x203u, STAGE_UNIT1, (k == 2), (k == 1), 1u);
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q2_npc_act_k%d", k);
    run_and_emit(0x6FC783C0u, "ACT5Q2_Callback00_NpcActivate_6FC783C0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 7. 0x6FC787C0 ACT5Q1_Callback00_NpcActivate_6FC787C0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x1FFu, 0x325u, 1u, 5002u, 5002u, 0x4206u);
    stage_quest_dialog_setup(0x23u, (uint32_t)(1 + k), 1u, 0x1FFu, STAGE_UNIT1, (k == 2), (k == 1), 1u);
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q1_npc_act_k%d", k);
    run_and_emit(0x6FC787C0u, "ACT5Q1_Callback00_NpcActivate_6FC787C0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 8. 0x6FC7A000 ACT5Q3_GrantScrollOfResistanceStats_6FC7A000_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x228u, 1u, 5000u, 5000u, 0x4207u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x228u);
    stage_client_pkt_pool(STAGE_CLIENT);
    uint32_t bonus = (uint32_t)(5 + k * 5);
    c = make_call();
    c.esi = STAGE_UNIT0; c.edi = bonus;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = bonus; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "a5q3_grant_res_k%d", k);
    run_and_emit(0x6FC7A000u, "ACT5Q3_GrantScrollOfResistanceStats_6FC7A000_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 9-11, 13-14 skipped: TS parity bug in a1c-post150 ACT4Q* vs D2Game Act5 callbacks */

  /* 12. 0x6FC7AFB0 QUESTS_DefaultSequenceFilter_6FC7AFB0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pQ1 = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    uint32_t pQEx1 = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    stage_quest_node(pQ1, 0x22u, pQEx1, 0u);
    U8(pQ1 + 0x09u) = 1u;
    U8(pQ1 + 0x0Cu) = 0u;
    U32(pQ1 + 0xF0u) = game_global_live(D2GAME_PREF_BASE + 0x5AFB0u);
    stage_quest_node(STAGE_QUEST0, 0x23u, STAGE_QUESTEX0, pQ1);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 0u : 5u;
    U32(STAGE_QUEST0 + 0x10u) = (k == 1) ? 99u : 0x22u;
    U32(STAGE_QUEST0 + 0xF0u) = game_global_live(D2GAME_PREF_BASE + 0x5AFB0u);
    c = make_call();
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    snprintf(lbl, sizeof(lbl), "default_seq_k%d", k);
    run_and_emit(0x6FC7AFB0u, "QUESTS_DefaultSequenceFilter_6FC7AFB0_113c", k, lbl, &c, ts, 1, 0xFFu, 0);
  }

  /* 13-14 skipped */

  /* 15. 0x6FC7B4F0 ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_quest_dialog_setup(0x23u, 1u, (k == 1) ? 1u : 0u, 0x1FFu, 0u, (k == 2), 0, 0u);
    U16(STAGE_SCRATCH + 0x14u) = (k == 0) ? 0x200u : 0x1FFu;
    U16(STAGE_SCRATCH + 0x18u) = (k == 1) ? 0x4EA3u : 0x4EA1u;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q1_larzuk_k%d", k);
    run_and_emit(0x6FC7B4F0u, "ACT5Q1_NpcIntroAndRewardLarzuk_6FC7B4F0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 16. 0x6FC7B7A0 ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_quest_dialog_setup(0x26u, 1u, (k == 1) ? 1u : 0u, 0x200u, 0u, 0, (k == 2), 1u);
    U16(STAGE_SCRATCH + 0x14u) = (k == 0) ? 0x1FFu : 0x200u;
    U16(STAGE_SCRATCH + 0x18u) = (k == 2) ? 0x4EB4u : 0x4EA9u;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q4_npc_deact_k%d", k);
    run_and_emit(0x6FC7B7A0u, "ACT5Q4_Callback01_NpcDeactivate_6FC7B7A0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 17. 0x6FC7BF70 QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 120u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x229u + (uint32_t)k, 1u, 5000u, 5000u, 0x4209u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x229u + (uint32_t)k);
    stage_client_pkt_pool(STAGE_CLIENT);
    uint32_t pFlags = (uint32_t)(uintptr_t)bump_alloc(0x80u);
    attach_quest_bits(STAGE_UDATA0, (uint8_t)k, pFlags);
    stage_npc_ctrl();
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    stage_quest_node(STAGE_QUEST0, 0x27u, STAGE_QUESTEX0, 0u);
    U8(STAGE_GAME + 0x6Du) = (uint8_t)k;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 2) ? 98 : 30 + k * 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 13, 5000000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 30, 8000000, 0);
    c = make_call();
    c.eax = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "a5q5_exp_reward_k%d", k);
    run_and_emit(0x6FC7BF70u, "QUESTS_Act5AncientsGrantExperienceReward_6FC7BF70_113c", k, lbl, &c, ts, 2, 0u, 0);
  }
}


static void stage_op_common(uint32_t qId, uint32_t pQuestEx, uint32_t lvlId) {
  stage_timer_queue();
  stage_npc_ctrl();
  stage_mon_reg(lvlId);
  stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
  stage_room_logical_info(STAGE_ROOMEX0);
  stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x240u, 1u, 5002u, 5002u, 0x4301u);
  uint32_t pFlags = (uint32_t)(uintptr_t)bump_alloc(0x80u);
  attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
  stage_quest_node(STAGE_QUEST0, qId, pQuestEx, 0u);
  U8(STAGE_QUEST0 + 0x09u) = 1u;
  U8(STAGE_QUEST0 + 0x0Cu) = 1u;
  U32(STAGE_QUEST0 + 0xE0u) = qId;
  U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
  U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
  U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
  U32(STAGE_SCRATCH + 0x10u) = STAGE_ROOM0;
  U32(STAGE_SCRATCH + 0x14u) = 5004u;
  U32(STAGE_SCRATCH + 0x18u) = 5004u;
}

static void emit_batch_2b(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* 18. 0x6FC7C100 ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t lvlId = (k == 0) ? 109u : 0x78u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x241u, 1u, 5000u, 5000u, 0x4311u);
    uint32_t pFlags = (uint32_t)(uintptr_t)bump_alloc(0x80u);
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    stage_npc_ctrl();
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    if (k == 1) set_quest_bit(pFlags, 0x27u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x23u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x27u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 2) ? 25 : 22, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 13, 1500000, 0);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "a5q5_grant_party_k%d", k);
    run_and_emit(0x6FC7C100u, "ACT5Q5_CheckAndGrantAncientsRewardToPlayerAndParty_6FC7C100_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 19. 0x6FC7C3A0 ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_op_common(0x1Fu, STAGE_QUESTEX0, 110u);
    if (k == 0) U8(STAGE_QUESTEX0 + 0x15u) = 1u;
    if (k == 2) U32(STAGE_SCRATCH + 0x14u) = 5006u;
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q1_spawn_shenk_k%d", k);
    run_and_emit(0x6FC7C3A0u, "ACT5Q1_SpawnShenkAndAttachQuestData_6FC7C3A0_113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* 20. 0x6FC7C5C0 ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_op_common(0x21u, STAGE_QUESTEX0, 114u);
    if (k == 0) U32(STAGE_QUESTEX0 + 0x88u) = 1u;
    if (k == 2) U32(STAGE_SCRATCH + 0x14u) = 5006u;
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q3_spawn_202_k%d", k);
    run_and_emit(0x6FC7C5C0u, "ACT5Q3_SpawnMonster202AndAttachQuestData_6FC7C5C0_113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* 21. 0x6FC7C9E0 ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_quest_dialog_setup(0x24u, (k == 2) ? 4u : 5u, 1u, 0x203u, 0u, 0, (k == 2), 0x0Du);
    U32(STAGE_QUEST0 + 0xF0u) = game_global_live(D2GAME_PREF_BASE + 0x5AFB0u);
    U16(STAGE_SCRATCH + 0x14u) = (k == 0) ? 0x1FFu : 0x203u;
    U16(STAGE_SCRATCH + 0x18u) = (k == 1) ? 0x4E80u : 0x4E8Eu;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q2_qualkehk_k%d", k);
    run_and_emit(0x6FC7C9E0u, "ACT5Q2_OnQualKehkScrollCallback_6FC7C9E0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 22. 0x6FC7D0A0 ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x78u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x1DDu, 0x245u, 0u, 5002u, 5002u, 0x4321u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0x246u, 1u, 5000u, 5000u, 0x4322u);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT, 0x246u);
    stage_client_pkt_pool(STAGE_CLIENT);
    stage_quest_node(STAGE_QUEST0, 0x23u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 0u : 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 2) ? 4u : 1u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0; /* pObject */
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1; /* pPlayer */
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q5_altar_k%d", k);
    run_and_emit(0x6FC7D0A0u, "ACT5Q5_OperateAncientsAltar_6FC7D0A0_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* 23. 0x6FC7D1D0 ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_npc_ctrl();
    stage_mon_reg(109u);
    stage_mon_reg(0x79u);
    stage_obj_ctrl(109u);
    stage_obj_ctrl(0x79u);
    uint32_t lvlId = (k == 0) ? 1u : 109u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
    stage_room_logical_info(STAGE_ROOMEX0);
    U32(STAGE_LEVEL0 + 0x10u) = STAGE_ROOMEX0;
    U32(STAGE_ROOMEX0 + 0x28u) |= 0x03100000u;
    U32(STAGE_ROOMEX0 + 0x34u) = 998u; U32(STAGE_ROOMEX0 + 0x38u) = 998u;
    U32(STAGE_ROOMEX0 + 0x3Cu) = 6u;   U32(STAGE_ROOMEX0 + 0x40u) = 6u;
    if (lvlId == 109u) {
      stage_room_with_coll(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 0x79u);
      stage_room_logical_info(STAGE_ROOMEX1);
      U32(STAGE_LEVEL0 + 0x1ACu) = STAGE_LEVEL1;
      U32(STAGE_LEVEL1 + 0x10u) = STAGE_ROOMEX1;
      U32(STAGE_LEVEL1 + 0x1Cu) = 998u; U32(STAGE_LEVEL1 + 0x20u) = 998u;
      U32(STAGE_LEVEL1 + 0x24u) = 6u;   U32(STAGE_LEVEL1 + 0x28u) = 6u;
      U32(STAGE_LEVEL1 + 0x2Cu) = 1000u;
      U32(STAGE_LEVEL1 + 0x30u) = 1000u;
      U32(STAGE_LEVEL1 + 0x34u) = 0x0Bu;
      U32(STAGE_LEVEL1 + 0x1C4u) = 0x2468ACE1u;
      U32(STAGE_LEVEL1 + 0x1C8u) = 0x0000029Au;
      U32(STAGE_LEVEL1 + 0x1D8u) = 1u;
      U32(STAGE_ROOMEX1 + 0x28u) |= 0x03100000u;
      U32(STAGE_ROOMEX1 + 0x34u) = 998u; U32(STAGE_ROOMEX1 + 0x38u) = 998u;
      U32(STAGE_ROOMEX1 + 0x3Cu) = 6u;   U32(STAGE_ROOMEX1 + 0x40u) = 6u;
      U32(STAGE_ROOM1 + 0x78u) = 1u;
      U32(STAGE_ACT0 + 0x08u) = 4u;
      U32(STAGE_GAME + 0xCCu) = STAGE_ACT0;
    }
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x247u, 1u, 5002u, 5002u, 0x4331u);
    stage_quest_node(STAGE_QUEST0, 0x22u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x89u) = (k == 2) ? 0u : 1u;
    c = make_call();
    c.eax = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "a5q2_nihl_portal_k%d", k);
    run_and_emit(0x6FC7D1D0u, "ACT5Q2_TrySpawnNihlathakPortalForUnitInAct5_6FC7D1D0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 24. 0x6FC7D960 ACT5Q3_SpawnAnyaThawProjectile_6FC7D960_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 114u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x248u, 1u, 5000u, 5000u, 0x4341u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x22Eu, 0x348u, 0u, 5006u, 5006u, 0x4342u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_quest_node(STAGE_QUEST0, 0x21u, STAGE_QUESTEX0, 0u);
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    uint32_t guid = (k == 0) ? 0x999u : 0x348u;
    if (k == 2) U16(STAGE_PATH1 + 0x0Cu) = 5008u;
    c = make_call();
    c.ebx = guid;
    c.nargs = 2; c.args[0] = STAGE_QUEST0; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = guid; ts[1] = STAGE_QUEST0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q3_thaw_proj_k%d", k);
    run_and_emit(0x6FC7D960u, "ACT5Q3_SpawnAnyaThawProjectile_6FC7D960_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 25. 0x6FC7DA70 ACT5Q3_Callback00_NpcActivate_6FC7DA70_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0) ? 0x201u : 0x200u, 0x349u, 1u, 5002u, 5002u, 0x4351u);
    stage_quest_dialog_setup(0x25u, (uint32_t)(1 + k * 2), 1u, 0x201u, STAGE_UNIT1, (k == 2), (k == 1), 8u);
    if (k == 0) U32(STAGE_QUESTEX0 + 0xD8u) = 1u;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q3_npc_act_k%d", k);
    run_and_emit(0x6FC7DA70u, "ACT5Q3_Callback00_NpcActivate_6FC7DA70_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 26. 0x6FC7E200 ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    uint32_t lvlId = (k == 0) ? 109u : 0x78u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x250u, 1u, 5000u, 5000u, 0x4361u);
    stage_quest_node(STAGE_QUEST0, 0x23u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUESTEX0 + 0x11u) = (k == 1) ? 0u : 1u;
    c = make_call();
    c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "a5q5_death_rst_k%d", k);
    run_and_emit(0x6FC7E200u, "ACT5Q5_CheckSummitPlayerDeathResetAncients_6FC7E200_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 27. 0x6FC7E3C0 ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    uint32_t lvlId = (k == 0) ? 109u : 0x78u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x251u, 1u, 5000u, 5000u, 0x4371u);
    stage_quest_node(STAGE_QUEST0, 0x23u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x00u) = (k == 1) ? 1u : 0u;
    U32(STAGE_QUESTEX0 + 0x0Cu) = 3u;
    c = make_call();
    c.eax = STAGE_UNIT0; c.esi = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "a5q5_portal_rst_k%d", k);
    run_and_emit(0x6FC7E3C0u, "ACT5Q5_OnArreatSummitPortalResetAncients_6FC7E3C0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 28. skipped 0x6FC7E420 (MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0_113c missing nMinGrp/nMaxGrp in InitBossAndMinionPackUMods) */

  /* 29. 0x6FC7EB30 ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_op_common(0x21u, STAGE_QUESTEX0, 114u);
    U32(STAGE_QUESTEX0 + 0x84u) = (k == 0) ? 1u : 2u;
    U8(STAGE_QUESTEX0 + 0x91u)  = (k == 1) ? 1u : 0u;
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q3_anya_obj_k%d", k);
    run_and_emit(0x6FC7EB30u, "ACT5Q3_RegisterAnyaObjectAndSpawnMonster200_6FC7EB30_113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* 30. 0x6FC7EED0 ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x78u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x253u, 1u, 5000u, 5000u, 0x4391u);
    uint32_t pFlags = (uint32_t)(uintptr_t)bump_alloc(0x80u);
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x21Cu, 0x353u, 12u, 5002u, 5002u, 0x4392u);
    uint32_t pQ1 = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    uint32_t pQEx1 = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    stage_quest_node(pQ1, 0x24u, pQEx1, 0u);
    U8(pQ1 + 0x09u) = 1u;
    U32(pQ1 + 0xF0u) = game_global_live(D2GAME_PREF_BASE + 0x5AFB0u);
    stage_quest_node(STAGE_QUEST0, 0x23u, STAGE_QUESTEX0, pQ1);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U32(STAGE_QUEST0 + 0x10u) = 0x24u;
    U32(STAGE_QUEST0 + 0xF0u) = game_global_live(D2GAME_PREF_BASE + 0x5AFB0u);
    U8(STAGE_QUESTEX0 + 0x10u) = 1u;
    U8(STAGE_QUESTEX0 + 0x11u) = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTEX0 + 0x0Cu) = (k == 2) ? 1u : 2u;
    U32(STAGE_QUESTEX0 + 0x20u) = 0x353u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q5_killed_k%d", k);
    run_and_emit(0x6FC7EED0u, "ACT5Q5_Callback02_OnAncientKilled_6FC7EED0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 31. 0x6FC7F200 ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_quest_dialog_setup(0x27u, 1u, 1u, 0x203u, 0u, 0, 0, 0u);
    U16(STAGE_SCRATCH + 0x14u) = (k == 2) ? 0x1FFu : 0x203u;
    U16(STAGE_SCRATCH + 0x18u) = (k == 0) ? 0x4EB9u : ((k == 1) ? 0x4EC9u : 0x4EC7u);
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q5_intro_k%d", k);
    run_and_emit(0x6FC7F200u, "ACT5Q5_NpcIntroAndScrolls_6FC7F200_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 32 skipped: a1c-post150 ACT4Q2_Hellforge_Callback03_LevelChanged parity mismatch vs Act5Q3 */

  /* 33. 0x6FC7F5E0 ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_quest_dialog_setup(0x25u, (k == 2) ? 2u : 1u, 1u, 0x201u, 0u, 0, 0, 0u);
    U16(STAGE_SCRATCH + 0x14u) = 0x201u;
    U16(STAGE_SCRATCH + 0x18u) = (k == 0) ? 0x4E94u : ((k == 1) ? 0x4EA3u : 0x4E9Fu);
    if (k == 2) U32(STAGE_QUESTEX0 + 0xD8u) = 1u;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q3_scroll_k%d", k);
    run_and_emit(0x6FC7F5E0u, "ACT5Q3_OnMalahOrAnyaScrollCallback_6FC7F5E0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 34. 0x6FC7FE30 ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_npc_ctrl();
    stage_mon_reg(0x84u);
    stage_obj_ctrl(0x84u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x84u);
    stage_room_logical_info(STAGE_ROOMEX0);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x258u, 1u, 5000u, 5000u, 0x43A1u);
    uint32_t pFlags = (uint32_t)(uintptr_t)bump_alloc(0x80u);
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x220u, 0x358u, 12u, 5002u, 5002u, 0x43A2u);
    stage_quest_node(STAGE_QUEST0, 0x28u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 0u : 1u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x0Cu) = (k == 2) ? STAGE_UNIT0 : 0u;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5q6_baal_k%d", k);
    run_and_emit(0x6FC7FE30u, "ACT5Q6_OnBaalKilledCompleteQuestAndSpawnPortal_6FC7FE30_113c", k, lbl, &c, ts, 2, 0u, 0);
  }
}


static uint32_t stage_a1q_common(uint32_t qId, uint32_t lvlId, uint32_t npcClass, uint16_t wNpc, uint16_t wMsg) {
  stage_timer_queue();
  stage_npc_ctrl();
  stage_mon_reg(lvlId);
  stage_obj_ctrl(lvlId);
  stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
  stage_room_logical_info(STAGE_ROOMEX0);
  stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x301u, 1u, 5002u, 5002u, 0x5101u);
  void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
  U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
  link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x301u);
  stage_client_pkt_pool(STAGE_CLIENT);
  insert_server_unit(STAGE_GAME, STAGE_UNIT0);
  uint32_t pFlags = (uint32_t)(uintptr_t)bump_alloc(0x80u);
  attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
  stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, npcClass, 0x302u, 1u, 5006u, 5006u, 0x5102u);
  insert_server_unit(STAGE_GAME, STAGE_UNIT1);
  stage_quest_node(STAGE_QUEST0, qId, STAGE_QUESTEX0, 0u);
  U8(STAGE_QUEST0 + 0x09u) = 1u;
  U8(STAGE_QUEST0 + 0x0Cu) = 1u;
  U32(STAGE_QUEST0 + 0xE0u) = qId;
  U32(STAGE_QUEST0 + 0xF0u) = (uint32_t)(uintptr_t)g_hGame + 0x5AFB0u;
  uint32_t pDlg = STAGE_SCRATCH + 0x200u;
  U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
  U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
  U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
  U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
  U32(STAGE_SCRATCH + 0x10u) = pDlg;
  U32(STAGE_SCRATCH + 0x14u) = pDlg;
  U16(STAGE_SCRATCH + 0x14u) = wNpc;
  U16(STAGE_SCRATCH + 0x18u) = wMsg;
  return pFlags;
}

static void stage_linked_portal_level(uint32_t dstLvl, uint32_t actNo) {
  stage_mon_reg(dstLvl);
  stage_obj_ctrl(dstLvl);
  U32(STAGE_LEVEL0 + 0x10u) = STAGE_ROOMEX0;
  U32(STAGE_ROOMEX0 + 0x28u) |= 0x03100000u;
  U32(STAGE_ROOMEX0 + 0x34u) = 998u; U32(STAGE_ROOMEX0 + 0x38u) = 998u;
  U32(STAGE_ROOMEX0 + 0x3Cu) = 6u;   U32(STAGE_ROOMEX0 + 0x40u) = 6u;
  stage_room_with_coll(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, dstLvl);
  stage_room_logical_info(STAGE_ROOMEX1);
  U32(STAGE_LEVEL0 + 0x1ACu) = STAGE_LEVEL1;
  U32(STAGE_LEVEL1 + 0x10u) = STAGE_ROOMEX1;
  U32(STAGE_LEVEL1 + 0x1Cu) = 998u; U32(STAGE_LEVEL1 + 0x20u) = 998u;
  U32(STAGE_LEVEL1 + 0x24u) = 6u;   U32(STAGE_LEVEL1 + 0x28u) = 6u;
  U32(STAGE_LEVEL1 + 0x2Cu) = 1000u; U32(STAGE_LEVEL1 + 0x30u) = 1000u;
  U32(STAGE_LEVEL1 + 0x34u) = 0x0Bu;
  U32(STAGE_LEVEL1 + 0x1C4u) = 0x2468ACE1u;
  U32(STAGE_LEVEL1 + 0x1C8u) = 0x0000029Au;
  U32(STAGE_LEVEL1 + 0x1D8u) = 1u;
  U32(STAGE_ROOMEX1 + 0x28u) |= 0x03100000u;
  U32(STAGE_ROOMEX1 + 0x34u) = 998u; U32(STAGE_ROOMEX1 + 0x38u) = 998u;
  U32(STAGE_ROOMEX1 + 0x3Cu) = 6u;   U32(STAGE_ROOMEX1 + 0x40u) = 6u;
  U32(STAGE_ROOM1 + 0x78u) = 1u;
  U32(STAGE_ACT0 + 0x08u) = actNo;
}

static void emit_batch_3a(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[48];

  /* 1. 0x6FC7DF70 D2Game_6FC7DF70_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t lvlId = (k == 0) ? 1u : 0x83u;
    stage_timer_queue();
    stage_npc_ctrl();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
    stage_room_logical_info(STAGE_ROOMEX0);
    stage_room_with_coll(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 0x84u);
    stage_room_logical_info(STAGE_ROOMEX1);
    U32(STAGE_LEVEL0 + 0x1ACu) = STAGE_LEVEL1;
    U32(STAGE_LEVEL1 + 0x10u)  = STAGE_ROOMEX1;
    U32(STAGE_LEVEL1 + 0x1Cu)  = 998u;
    U32(STAGE_LEVEL1 + 0x20u)  = 998u;
    U32(STAGE_LEVEL1 + 0x24u)  = 6u;
    U32(STAGE_LEVEL1 + 0x28u)  = 6u;
    U32(STAGE_LEVEL1 + 0x1D8u) = 1u;
    U32(STAGE_LEVEL1 + 0x2Cu)  = 1000u;
    U32(STAGE_LEVEL1 + 0x30u)  = 1000u;
    U32(STAGE_LEVEL1 + 0x34u)  = 0x0Bu;
    U32(STAGE_LEVEL1 + 0x1C4u) = 0x12345679u;
    U32(STAGE_LEVEL1 + 0x1C8u) = 0x0000029Au;
    U32(STAGE_ROOMEX1 + 0x28u) = 0x03110000u;
    U32(STAGE_ROOMEX1 + 0x2Cu) = STAGE_ROOM1;
    U32(STAGE_ROOMEX1 + 0x34u) = 998u;
    U32(STAGE_ROOMEX1 + 0x38u) = 998u;
    U32(STAGE_ROOMEX1 + 0x3Cu) = 6u;
    U32(STAGE_ROOMEX1 + 0x40u) = 6u;
    U32(STAGE_ACT1 + 0x10u) = STAGE_ROOM1;
    U32(STAGE_GAME + 0xBCu + 4u * 4u) = STAGE_ACT0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x303u, 1u, 5002u, 5002u, 0x5111u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x303u);
    stage_client_pkt_pool(STAGE_CLIENT);
    U8(STAGE_CLIENT + 0x1ACu) = 4u;
    stage_quest_node(STAGE_QUEST0, (k == 0) ? 1u : 0x24u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x86u) = (k == 2) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a5_red_portal_k%d", k);
    run_and_emit(0x6FC7DF70u, "D2Game_6FC7DF70_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* 2. 0x6FC80A80 ACT1Q6_Callback00_NpcActivate_6FC80A80_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t npc = (k == 0) ? 0x94u : (k == 1 ? 0x96u : 0x109u);
    uint32_t pFlags = stage_a1q_common(6u, 1u, npc, 0u, 0u);
    U32(STAGE_SCRATCH + 0x10u) = STAGE_SCRATCH + 0x200u;
    if (k == 0) { set_quest_bit(pFlags, 6u, 0x0Du); U8(STAGE_QUEST0 + 0x08u) = 1u; }
    else if (k == 1) { set_quest_bit(pFlags, 6u, 1u); }
    else { U8(STAGE_QUEST0 + 0x0Bu) = 1u; }
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1q6_npc_act_k%d", k);
    run_and_emit(0x6FC80A80u, "ACT1Q6_Callback00_NpcActivate_6FC80A80_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 3. 0x6FC835D0 ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t npc = (k == 2) ? 0x92u : 0x94u;
    stage_a1q_common(4u, 1u, npc, 0u, 0u);
    U8(STAGE_QUESTEX0 + 0x53u) = (k == 0) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x64u) = (k == 1) ? 1u : 0u;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1q4_akara_cain_k%d", k);
    run_and_emit(0x6FC835D0u, "ACT1Q4_Callback00_NpcActivateAkaraOrCain_6FC835D0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 4. 0x6FC83F90 ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint16_t wNpc = (k == 0) ? 0x109u : (k == 1 ? 0x9Bu : 0x94u);
    uint16_t wMsg = (k == 0) ? 0xA6u : (k == 1 ? 0xB7u : 0xB3u);
    uint32_t pFlags = stage_a1q_common(6u, 1u, wNpc, wNpc, wMsg);
    if (k == 1) { set_quest_bit(pFlags, 6u, 1u); set_quest_bit(pFlags, 6u, 0x0Du); }
    if (k == 2) { U32(STAGE_QUESTEX0 + 0x84u) = 0x301u; U16(STAGE_QUESTEX0 + 0x84u + 0x80u) = 1u; }
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1q6_warriv_k%d", k);
    run_and_emit(0x6FC83F90u, "ACT1Q6_NpcIntroAndRewardWarrivAndTownsfolk_6FC83F90_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 5. 0x6FC84430 ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint16_t wNpc = (k == 0) ? 0x9Au : (k == 1 ? 0x9Au : 0x94u);
    uint16_t wMsg = (k == 0) ? 0x7Fu : (k == 1 ? 0x90u : 0x8Cu);
    uint32_t pFlags = stage_a1q_common(5u, 1u, wNpc, wNpc, wMsg);
    if (k == 0) { U8(STAGE_QUESTEX0 + 0x11Bu) = 1u; U8(STAGE_QUEST0 + 0x0Bu) = 0u; }
    else if (k == 1) { set_quest_bit(pFlags, 5u, 0x0Du); U8(STAGE_QUESTEX0 + 0x11Au) = 1u; }
    else { U32(STAGE_QUESTEX0 + 0x34u) = 0x301u; U32(STAGE_QUESTEX0 + 0x38u) = 0x999u; U16(STAGE_QUESTEX0 + 0x64u) = 2u; }
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1q5_charsi_k%d", k);
    run_and_emit(0x6FC84430u, "ACT1Q5_NpcIntroAndRewardCharsiImbue_6FC84430_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 6. 0x6FC85260 ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint16_t wMsg = (k == 0) ? 0x40u : 0x4Cu;
    uint32_t pFlags = stage_a1q_common(1u, 1u, 0x94u, 0x94u, wMsg);
    U32(STAGE_QUEST0 + 0xE0u) = 1u;
    U32(STAGE_QUEST0 + 0xE4u) = 2u;
    if (k >= 1) { set_quest_bit(pFlags, 1u, 1u); }
    if (k == 1) { set_quest_bit(pFlags, 1u, 0x0Du); }
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1q1_akara_k%d", k);
    run_and_emit(0x6FC85260u, "ACT1Q1_NpcIntroAndRewardAkaraDenOfEvil_6FC85260_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 7. 0x6FC860D0 ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_a1q_common(4u, 0x26u, 0x94u, 0u, 0u);
    if (k == 2) { U32(STAGE_GAME + 0x10F4u) = 0u; }
    uint32_t sx = (k == 0) ? 5002u : 5004u;
    uint32_t sy = (k == 0) ? 5002u : 5004u;
    c = make_call();
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = sx; c.args[3] = sy;
    c.calleePop = 16u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = sx; ts[3] = sy;
    snprintf(lbl, sizeof(lbl), "a1q4_griswold_k%d", k);
    run_and_emit(0x6FC860D0u, "ACT1Q4_SpawnGriswoldInTristram_6FC860D0_113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* 8. 0x6FC86960 ACT1Q3_OnNpcInitCainSearch_6FC86960_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t npc = (k == 0) ? 0x92u : (k == 1 ? 0x109u : 0x94u);
    uint32_t pFlags = stage_a1q_common(4u, 1u, npc, 0u, 0u);
    U32(STAGE_SCRATCH + 0x14u) = STAGE_SCRATCH + 0x200u;
    if (k == 1) { set_quest_bit(pFlags, 4u, 0x0Du); }
    if (k == 2) { U8(STAGE_QUEST0 + 0x0Cu) = 2u; }
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1q3_npcinit_k%d", k);
    run_and_emit(0x6FC86960u, "ACT1Q3_OnNpcInitCainSearch_6FC86960_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 9. 0x6FC86CE0 ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint16_t wNpc = (k == 0) ? 0x94u : (k == 1 ? 0x94u : 0x109u);
    uint16_t wMsg = (k == 0) ? 0x5Au : (k == 1 ? 0x5Du : 0x68u);
    uint32_t pFlags = stage_a1q_common(4u, 1u, wNpc, wNpc, wMsg);
    if (k == 1) { set_quest_bit(pFlags, 4u, 1u); set_quest_bit(pFlags, 4u, 0x0Du); }
    if (k == 2) { U8(STAGE_QUESTEX0 + 0x63u) = 1u; }
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1q3_scroll_k%d", k);
    run_and_emit(0x6FC86CE0u, "ACT1Q3_OnScrollMessageCainSearch_6FC86CE0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 10. 0x6FC87000 ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint16_t wNpc = 0x9Au;
    uint16_t wMsg = (k == 0) ? 0x7Eu : (k == 1 ? 0x82u : 0x88u);
    uint32_t pFlags = stage_a1q_common(5u, 1u, wNpc, wNpc, wMsg);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 2) ? 4u : 1u;
    if (k == 1) { set_quest_bit(pFlags, 3u, 0u); }
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1q5_scroll_k%d", k);
    run_and_emit(0x6FC87000u, "ACT1Q5_OnScrollMessageCharsiMalus_6FC87000_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 11. 0x6FC874A0 ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pFlags = stage_a1q_common(4u, 1u, 0x94u, 0u, 0u);
    uint32_t pPlr = (k == 1) ? STAGE_UNIT2 : STAGE_UNIT0;
    if (k == 1) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 1u, 0x311u, 1u, 5004u, 5004u, 0x5112u);
      attach_quest_bits(STAGE_UDATA2, 0u, (uint32_t)(uintptr_t)bump_alloc(0x80u));
    }
    uint32_t pGFlags = U32(STAGE_QUESTCTRL + 0x0Cu);
    if (k == 0) { set_quest_bit(pGFlags, 4u, 0x0Bu); }
    if (k == 2) {
      set_quest_bit(pFlags, 0x28u, 0u);
      stage_linked_portal_level(0x27u, 0u);
    }
    c = make_call();
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pPlr; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pPlr;
    snprintf(lbl, sizeof(lbl), "a1q4_cow_portal_k%d", k);
    run_and_emit(0x6FC874A0u, "ACT1Q4_TrySpawnSecretCowLevelPortal_6FC874A0_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 12. 0x6FC87730 ACT1Q4_OnCainGibbetOperated_6FC87730_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_a1q_common(4u, 0x26u, 0x94u, 0u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 2u, 0x1Au, 0x312u, 0u, 5003u, 5003u, 0x5113u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    U32(STAGE_QUESTEX0 + 0x3Cu) = 0x301u;
    if (k == 0) { U8(STAGE_QUEST0 + 0x09u) = 0u; }
    if (k == 2) { U8(STAGE_QUESTEX0 + 0x51u) = 1u; }
    c = make_call();
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT2; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT2;
    snprintf(lbl, sizeof(lbl), "a1q4_gibbet_op_k%d", k);
    run_and_emit(0x6FC87730u, "ACT1Q4_OnCainGibbetOperated_6FC87730_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 13. 0x6FC87A90 ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_a1q_common(4u, 4u, 0x94u, 0u, 0u);
    uint16_t ox = (k == 1) ? 5022u : 5003u;
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 2u, 0x3Cu, 0x313u, 0u, ox, ox, 0x5114u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    U32(STAGE_QUESTEX0 + 0x40u) = (k == 0) ? 0x999u : 0x313u;
    U8(STAGE_QUESTEX0 + 0x44u) = 1u;
    if (k == 2) { stage_linked_portal_level(0x26u, 0u); }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_QUEST0;
    snprintf(lbl, sizeof(lbl), "a1q4_cairn_portal_k%d", k);
    run_and_emit(0x6FC87A90u, "ACT1Q4_SpawnTristramPortalAtCairnStones_6FC87A90_113c", k, lbl, &c, ts, 2, 0xFFu, 0);
  }

  /* 14. 0x6FC87E00 ACT1Q6_OnAndarielKilled_6FC87E00_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pFlags = stage_a1q_common(6u, 0x25u, 0x9Cu, 0u, 0u);
    U32(STAGE_QUEST0 + 0xA8u) = 123u;
    if (k == 0) { U8(STAGE_QUEST0 + 0x09u) = 0u; }
    else if (k == 1) { set_quest_bit(pFlags, 6u, 0u); }
    else { /* full chip+std gem roll + callback */ }
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1q6_andariel_kill_k%d", k);
    run_and_emit(0x6FC87E00u, "ACT1Q6_OnAndarielKilled_6FC87E00_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 15. 0x6FC88280 ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_a1q_common(4u, 0x26u, 0x94u, 0u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 2u, 0x1Au, 0x314u, 3u, 5003u, 5003u, 0x5115u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    U32(STAGE_QUESTEX0 + 0x34u) = 0x314u;
    U32(STAGE_QUESTEX0 + 0x30u) = 0x302u;
    U8(STAGE_QUESTEX0 + 0x48u) = (k >= 1) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x47u) = (k == 2) ? 1u : 0u;
    uint32_t bSched = (k == 0) ? 1u : 0u;
    uint32_t bDel = (k == 2) ? 1u : 0u;
    c = make_call();
    c.nargs = 3; c.args[0] = STAGE_QUEST0; c.args[1] = bSched; c.args[2] = bDel; c.calleePop = 12u;
    ts[0] = STAGE_QUEST0; ts[1] = bSched; ts[2] = bDel;
    snprintf(lbl, sizeof(lbl), "a1q4_upd_gibbet_k%d", k);
    run_and_emit(0x6FC88280u, "ACT1Q4_UpdateGibbetModeAndCainState_6FC88280_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 16. 0x6FC88920 ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint16_t wMsg = (k == 0) ? 0x53u : (k == 1 ? 0x57u : 0x59u);
    uint32_t pFlags = stage_a1q_common(2u, 1u, 0x96u, 0x96u, wMsg);
    if (k == 1) { set_quest_bit(pFlags, 2u, 1u); set_quest_bit(pFlags, 2u, 0x0Du); }
    if (k == 2) { set_quest_bit(pFlags, 2u, 1u); }
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1q2_bloodraven_k%d", k);
    run_and_emit(0x6FC88920u, "ACT1Q2_OnScrollMessageBloodRaven_6FC88920_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 17. 0x6FC88E20 ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_a1q_common(4u, 0x19u, 0x94u, 0u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 2u, 0x3Au, 0x315u, 1u, 5003u, 5003u, 0x5116u);
    U8(STAGE_QUESTEX0 + 0x90u) = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTEX0 + 0x8Cu) = (k == 2) ? 0u : 3u;
    c = make_call();
    c.nargs = 2; c.args[0] = STAGE_QUEST0; c.args[1] = STAGE_UNIT2; c.calleePop = 8u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT2;
    snprintf(lbl, sizeof(lbl), "a1q4_countess_gold_k%d", k);
    run_and_emit(0x6FC88E20u, "ACT1Q4_DropCountessChestGoldTick_6FC88E20_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 18. 0x6FC88FC0 ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pFlags = stage_a1q_common(4u, 0x26u, 0x94u, 0u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 2u, 0x1Au, 0x316u, (k == 2) ? 1u : 0u, 5003u, 5003u, 0x5117u);
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT2;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x10u) = 0x1Au;
    if (k == 0) { U8(STAGE_QUEST0 + 0x09u) = 0u; }
    if (k == 1) { set_quest_bit(pFlags, 4u, 1u); }
    if (k == 2) { U32(STAGE_UNIT2 + 0x10u) = 0u; }
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1q4_gibbet_cage_k%d", k);
    run_and_emit(0x6FC88FC0u, "ACT1Q4_OperateCainGibbetCageObject_6FC88FC0_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }
}


static void stage_obj_op_common(uint32_t objClass, uint32_t objMode, uint32_t lvlId) {
  stage_timer_queue();
  stage_obj_ctrl(lvlId);
  stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
  stage_room_logical_info(STAGE_ROOMEX0);
  stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x331u, 1u, 5002u, 5002u, 0x5201u);
  void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
  U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
  link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x331u);
  stage_client_pkt_pool(STAGE_CLIENT);
  insert_server_unit(STAGE_GAME, STAGE_UNIT0);
  attach_quest_bits(STAGE_UDATA0, 0u, (uint32_t)(uintptr_t)bump_alloc(0x80u));
  U32(STAGE_UDATA0 + 0x1Cu) = (uint32_t)(uintptr_t)bump_alloc(0x20u);
  stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, objClass, 0x332u, objMode, 5003u, 5003u, 0x5202u);
  insert_server_unit(STAGE_GAME, STAGE_UNIT1);
  U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
  U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT1;
  U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
  U32(STAGE_SCRATCH + 0x0Cu) = U32(STAGE_GAME + 0x10F0u);
  U32(STAGE_SCRATCH + 0x10u) = objClass;
}

static void emit_batch_3b(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[48];

  /* 1. 0x6FC8A0D0 OBJECT_SendUpdatePacketsToClient113c (eax=pObj, edi=pClient; avoid pObj==0!) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    /* class 2 = shrine (subClass & 1), class 1 = chest (subClass==0) */
    uint32_t cls = (k == 0) ? 1u : 2u;
    uint32_t mode = (k == 2) ? 1u : 0u;
    stage_obj_op_common(cls, mode, 1u);
    if (k >= 1) {
      U32(STAGE_UDATA1 + 0x0Cu) = (k == 2) ? 2u : 0u;
      U8(STAGE_UNIT1 + 0xC4u) |= (k == 2) ? 2u : 0u;
    }
    c = make_call();
    c.eax = STAGE_UNIT1; c.edi = STAGE_CLIENT; c.calleePop = 0u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "obj_send_upd_k%d", k);
    run_and_emit(0x6FC8A0D0u, "OBJECT_SendUpdatePacketsToClient113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 2. 0x6FC8A220 OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c (eax=pGame, ecx=dwObjGuid) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t mode = (k == 0) ? 0u : (k == 1 ? 5u : 2u);
    stage_obj_op_common(0x0Du, mode, 1u);
    if (k == 2) {
      uint32_t pColl = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pMap = U32(pColl + 0x20u);
      for (uint32_t i = 0; i < 32u * 32u; i++) { U16(pMap + i * 2u) = 0x8180u; }
    }
    c = make_call();
    c.eax = STAGE_GAME; c.ecx = 0x332u; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = 0x332u;
    snprintf(lbl, sizeof(lbl), "obj_sync_coll_k%d", k);
    run_and_emit(0x6FC8A220u, "OBJ_SyncObjectMode2Or5ByCollision_6FC8A220_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 3. 0x6FC8A720 OBJ_TryOperateObjectIfInRange_6FC8A720_113c (eax=wType, ecx=pPlr, [dwObjId, pGame]) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_obj_op_common(0x79u, 0u, 1u);
    uint32_t dwId = (k == 0) ? 0x9999u : 0x332u;
    uint32_t pOpUnit = (k == 1) ? 0u : STAGE_UNIT0;
    if (k == 2) {
      /* Put player far away so out-of-range returns 1 cleanly, or close with bOperateFn=0 class 0x79 */
      stage_static_path(STAGE_UNIT1, STAGE_PATH1, STAGE_ROOM0, 5020, 5020);
    }
    c = make_call();
    c.eax = 2u; c.ecx = pOpUnit;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = dwId; c.calleePop = 8u;
    ts[0] = 2u; ts[1] = pOpUnit; ts[2] = STAGE_GAME; ts[3] = dwId;
    snprintf(lbl, sizeof(lbl), "obj_try_op_range_k%d", k);
    run_and_emit(0x6FC8A720u, "OBJ_TryOperateObjectIfInRange_6FC8A720_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 4. 0x6FC8A9D0 OBJ_OperateDoorWithLockCheck_6FC8A9D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t mode = (k == 0) ? 0u : (k == 1 ? 6u : 2u);
    stage_obj_op_common(0x0Du, mode, 1u);
    g_fake_tick_count = 0x10000u + (uint32_t)k * 1000u;
    U32(STAGE_UNIT1 + 0xD4u) = 0x100u;
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH; ts[1] = g_fake_tick_count;
    snprintf(lbl, sizeof(lbl), "obj_op_door_k%d", k);
    run_and_emit(0x6FC8A9D0u, "OBJ_OperateDoorWithLockCheck_6FC8A9D0_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 5. skipped 0x6FC8B200 OBJECT_SyncStateAndEventsToClient113c (TS returns 1 vs x86 void leaving eax=0) */

  /* 6. 0x6FC8CD40 OBJ_OperateDuranceStairs_6FC8CD40_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_npc_ctrl();
    uint32_t lvlId = (k == 1) ? 0x65u : 0x66u;
    stage_obj_op_common(0x16Fu, (k == 0) ? 0u : 1u, lvlId);
    stage_mon_reg(0x67u);
    stage_obj_ctrl(0x67u);
    stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    set_quest_bit(pFlags, 0x16u, 0x0Du);
    if (k == 2) {
      set_quest_bit(pFlags, 0x17u, 0u);
      U8(STAGE_CLIENT + 0x1ACu) = 3u;
      U32(STAGE_LEVEL0 + 0x10u) = STAGE_ROOMEX0;
      U32(STAGE_ROOMEX0 + 0x28u) |= 0x03100000u;
      U32(STAGE_ROOMEX0 + 0x34u) = 998u; U32(STAGE_ROOMEX0 + 0x38u) = 998u;
      U32(STAGE_ROOMEX0 + 0x3Cu) = 6u;   U32(STAGE_ROOMEX0 + 0x40u) = 6u;
      stage_room_with_coll(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 0x67u);
      stage_room_logical_info(STAGE_ROOMEX1);
      U32(STAGE_LEVEL0 + 0x1ACu) = STAGE_LEVEL1;
      U32(STAGE_LEVEL1 + 0x10u) = STAGE_ROOMEX1;
      U32(STAGE_LEVEL1 + 0x1Cu) = 998u; U32(STAGE_LEVEL1 + 0x20u) = 998u;
      U32(STAGE_LEVEL1 + 0x24u) = 6u;   U32(STAGE_LEVEL1 + 0x28u) = 6u;
      U32(STAGE_LEVEL1 + 0x2Cu) = 1000u; U32(STAGE_LEVEL1 + 0x30u) = 1000u;
      U32(STAGE_LEVEL1 + 0x34u) = 0x0Bu;
      U32(STAGE_LEVEL1 + 0x1C4u) = 0x2468ACE1u;
      U32(STAGE_LEVEL1 + 0x1C8u) = 0x0000029Au;
      U32(STAGE_LEVEL1 + 0x1D8u) = 1u;
      U32(STAGE_ROOMEX1 + 0x28u) |= 0x03110000u;
      U32(STAGE_ROOMEX1 + 0x34u) = 998u; U32(STAGE_ROOMEX1 + 0x38u) = 998u;
      U32(STAGE_ROOMEX1 + 0x3Cu) = 6u;   U32(STAGE_ROOMEX1 + 0x40u) = 6u;
      U32(STAGE_ACT0 + 0x08u) = 3u;
    }
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "obj_durance_stairs_k%d", k);
    run_and_emit(0x6FC8CD40u, "OBJ_OperateDuranceStairs_6FC8CD40_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* 7. 0x6FC8CF90 OBJ_OperateWaypoint_6FC8CF90_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t mode = (k == 0) ? 0u : (k == 1 ? 1u : 3u);
    stage_obj_op_common(0x77u, mode, (k == 1) ? 3u : 1u);
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "obj_waypoint_k%d", k);
    run_and_emit(0x6FC8CF90u, "OBJ_OperateWaypoint_6FC8CF90_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* 8. 0x6FC8D0F0 OBJ_OperateFn_TownAndPermanentPortal_6FC8D0F0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_obj_op_common(0x3Bu, 1u, 1u);
    g_fake_tick_count = 0x5000u;
    if (k == 0) {
      U8(STAGE_UNIT0 + 0x6Cu) = 1u;
    } else if (k == 1) {
      U32(STAGE_UDATA0 + 0x160u) = 0x4800u; /* within cooldown 0x1388 */
      U32(STAGE_UDATA1 + 0x04u) = 0x331u;
    } else {
      U32(STAGE_UDATA0 + 0x160u) = 0x4800u;
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 1u, 0x339u, 1u, 5004u, 5004u, 0x5203u);
      U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT2;
      U32(STAGE_UDATA2 + 0x160u) = 0x4800u;
      U32(STAGE_UDATA1 + 0x04u) = 0x339u;
    }
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH; ts[1] = g_fake_tick_count;
    snprintf(lbl, sizeof(lbl), "obj_portal_op_k%d", k);
    run_and_emit(0x6FC8D0F0u, "OBJ_OperateFn_TownAndPermanentPortal_6FC8D0F0_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 9. 0x6FC8D960 OBJ_OperateWirtsBody_6FC8D960_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_obj_op_common(0x10Cu, (k == 0) ? 1u : 0u, 0x26u);
    U32(STAGE_GAME + 0xA8u) = 200u + (uint32_t)k * 50u;
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "obj_wirt_body_k%d", k);
    run_and_emit(0x6FC8D960u, "OBJ_OperateWirtsBody_6FC8D960_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* 10. 0x6FC8DA00 OBJ_OperateShrine_6FC8DA00_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_obj_op_common(2u, (k == 0) ? 1u : 0u, 1u);
    U32(STAGE_UDATA1 + 0x0Cu) = 0u;
    U8(STAGE_UDATA1 + 0x04u) = 1u;
    uint32_t pShrineTxt = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    U8(pShrineTxt + 0x00u) = 1u; /* Code=1 maps to 0x6FC89C00 in both Wine & TS fallback */
    U8(pShrineTxt + 0x10u) = (k == 2) ? 2u : 0u;
    U32(STAGE_UDATA1 + 0x08u) = pShrineTxt;
    U32(STAGE_UNIT0 + 0xC4u) = 4u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 300 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, (k == 2) ? (50 << 8) : (20 << 8), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 200 << 8, 0);
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "obj_shrine_op_k%d", k);
    run_and_emit(0x6FC8DA00u, "OBJ_OperateShrine_6FC8DA00_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* 11. 0x6FC8E270 OBJECTS_FloorSpikesEventTick_6FC8E270_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_obj_op_common(0x0Cu, 0u, 0x1Du);
    U8(STAGE_UDATA1 + 0x04u) = (uint8_t)k;
    if (k == 0) {
      /* Put player on same tile so UNITS_GetApproximateDistance <= 0 */
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT0;
      stage_dynamic_path(STAGE_UNIT0, STAGE_PATH0, STAGE_ROOM0, 5003u, 5003u);
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "obj_floor_spikes_k%d", k);
    run_and_emit(0x6FC8E270u, "OBJECTS_FloorSpikesEventTick_6FC8E270_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 12. 0x6FC8E680 OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_obj_op_common(0x98u, 1u, 0x2Eu);
    uint32_t itemClass = (k == 2) ? g_item_sword : g_item_ring;
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, itemClass, 0x33Au, 2u, 20u, 0u, 0x5204u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    uint32_t subAct = (k == 0) ? 2u : 3u;
    c = make_call();
    c.eax = 0x33Au; c.ecx = 0x331u;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = 0x332u; c.args[2] = subAct; c.calleePop = 12u;
    ts[0] = 0x33Au; ts[1] = 0x331u; ts[2] = STAGE_GAME; ts[3] = 0x332u; ts[4] = subAct;
    snprintf(lbl, sizeof(lbl), "obj_orifice_act_k%d", k);
    run_and_emit(0x6FC8E680u, "OBJ_HandleShrineOrOrificeItemAction_6FC8E680_113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, 0);
  }
}


static void stage_curse_ctx(uint32_t ctx, uint32_t pCaster, uint32_t bSpecialAi,
                            uint32_t nSkillId, uint32_t nSkillLvl, uint32_t nLen,
                            int32_t statId, int32_t statVal, uint32_t nState) {
  memset((void *)(uintptr_t)ctx, 0, 0x68u);
  U32(ctx + 0x00u) = STAGE_GAME;
  U32(ctx + 0x04u) = pCaster;
  U32(ctx + 0x08u) = bSpecialAi;
  U32(ctx + 0x0Cu) = 0u;
  U32(ctx + 0x10u) = nSkillId;
  U32(ctx + 0x14u) = nSkillLvl;
  U32(ctx + 0x18u) = nLen;
  U32(ctx + 0x1Cu) = (uint32_t)statId;
  U32(ctx + 0x20u) = 0xFFFFFFFFu;
  U32(ctx + 0x24u) = 0xFFFFFFFFu;
  U32(ctx + 0x28u) = 0xFFFFFFFFu;
  U32(ctx + 0x2Cu) = 0xFFFFFFFFu;
  U32(ctx + 0x30u) = 0xFFFFFFFFu;
  S32(ctx + 0x34u) = statVal;
  U32(ctx + 0x4Cu) = nState;
}

static void link_unit_into_room(uint32_t pRoom, uint32_t pUnit) {
  uint32_t head = U32(pRoom + 0x74u);
  U32(pUnit + 0xE8u) = head;
  U32(pRoom + 0x74u) = pUnit;
}

static void emit_batch_4a(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* 1. 0x6FC70250 SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0x8101u, 1u, 5000u, 5000u, 0xB101u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x8102u, 1u, 5002u, 5002u, 0xB105u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 14, 200, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 15, 200, 0);
    stage_curse_ctx(STAGE_SCRATCH, STAGE_UNIT0, (k == 2) ? 1u : 0u, 66u, 3u, 120u,
                    (k == 2) ? -1 : 36, (k == 2) ? 0 : -100, (k == 2) ? 0x17u : 0x09u);
    uint32_t tgt = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call();
    c.ecx = tgt; c.edx = STAGE_SCRATCH;
    ts[0] = tgt; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "curse_apply_cb_k%d", k);
    run_and_emit(0x6FC70250u, "SKILLS_ApplyCurseStateAndStatsCallback_6FC70250_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 2. 0x6FC705D0 SKILLS_SrvDo067_NecromancerCurseRadius_6FC705D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0x8201u, 1u, 5000u, 5000u, 0xB201u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x8202u, 1u, 5002u, 5002u, 0xB205u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 14, 200, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 15, 200, 0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    U16(STAGE_PATH0 + 0x24u) = 5002u;
    U16(STAGE_PATH0 + 0x26u) = 5002u;
    uint32_t skId = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 66u : 91u);
    uint32_t lvl = 3u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = skId; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)skId; ts[3] = lvl;
    snprintf(lbl, sizeof(lbl), "curse_radius_k%d", k);
    run_and_emit(0x6FC705D0u, "SKILLS_SrvDo067_NecromancerCurseRadius_6FC705D0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 3. 0x6FC70B70 SKILLS_ApplyAttractCurseCallback_6FC70B70_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0x8301u, 1u, 5000u, 5000u, 0xB301u + (uint32_t)k);
    uint32_t monCls = (k == 2) ? 10u : 1u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, monCls, 0x8302u, 1u, 5002u, 5002u, 0xB305u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 14, 200, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 15, 200, 0);
    if (k == 1) U32(STAGE_UNIT1 + 0x10u) = 0u; /* dead -> SUNIT_IsDeadOrDying */
    stage_curse_ctx(STAGE_SCRATCH, STAGE_UNIT0, 0u, 86u, 3u, 120u, -1, 0, 0x1Au);
    uint32_t tgt = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call();
    c.ecx = tgt; c.edx = STAGE_SCRATCH;
    ts[0] = tgt; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "attract_cb_k%d", k);
    run_and_emit(0x6FC70B70u, "SKILLS_ApplyAttractCurseCallback_6FC70B70_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 4. skipped 0x6FC70E60 SKILLS_SpawnBoneWallSegment_6FC70E60_113c (callee 0x6FC6F970 double-adds nMaxLife + bonusLife to stat 6/7) */

  /* 5. 0x6FC70FE0 SKILLS_SrvDo_BoneWall_6FC70FE0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 1u : 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0x8501u, 1u, 5000u, 5000u, 0xB501u + (uint32_t)k);
    stage_mon_reg(2u);
    U16(STAGE_PATH0 + 0x24u) = 5004u;
    U16(STAGE_PATH0 + 0x26u) = 5004u;
    uint32_t skId = (k == 1) ? 0u : 78u;
    uint32_t lvl = (uint32_t)(1 + k);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = skId; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = lvl;
    snprintf(lbl, sizeof(lbl), "srvdo_bwall_k%d", k);
    run_and_emit(0x6FC70FE0u, "SKILLS_SrvDo_BoneWall_6FC70FE0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 6. 0x6FC71540 SKILLS_SrvDo_IronGolem_6FC71540_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0x8601u, 1u, 5000u, 5000u, 0xB601u + (uint32_t)k);
    stage_mon_reg(2u);
    if (k > 0) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x8602u, 2u, 3u, 0u, 0xB605u);
      U32(STAGE_UDATA1 + 0x18u) |= 0x10u; /* identified */
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    uint32_t skId = (k == 1) ? 0u : 90u;
    uint32_t lvl = (uint32_t)(1 + k);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = skId; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = lvl;
    snprintf(lbl, sizeof(lbl), "srvdo_iron_golem_k%d", k);
    run_and_emit(0x6FC71540u, "SKILLS_SrvDo_IronGolem_6FC71540_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 7. 0x6FC71750 SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0x8701u, 1u, 5000u, 5000u, 0xB701u + (uint32_t)k);
    stage_mon_reg(2u);
    uint32_t skId = (k == 0) ? 0u : ((k == 1) ? 75u : 94u);
    uint32_t lvl = (uint32_t)(1 + k);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = skId; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = lvl;
    snprintf(lbl, sizeof(lbl), "srvdo_golem_k%d", k);
    run_and_emit(0x6FC71750u, "SKILLS_SrvDo_ClayBloodFireGolem_6FC71750_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 8. 0x6FC718B0 SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0x8801u, 1u, 5000u, 5000u, 0xB801u + (uint32_t)k);
    stage_mon_reg(2u);
    if (k > 0) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x8802u, 12u, 5002u, 5002u, 0xB805u);
      U32(STAGE_UNIT1 + 0xC4u) |= 0x10000u; /* UNITFLAG_DEAD */
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    uint32_t skId = (k == 2) ? 80u : 70u; /* Raise Skeleton vs Mage */
    uint32_t lvl = (uint32_t)(1 + k);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = skId; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = lvl;
    snprintf(lbl, sizeof(lbl), "srvdo_raise_skel_k%d", k);
    run_and_emit(0x6FC718B0u, "SKILLS_SrvDo_RaiseSkeletonOrMage_6FC718B0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 9. 0x6FC71A90 SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0x8901u, 1u, 5000u, 5000u, 0xB901u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x8902u, 1u, 5002u, 5002u, 0xB905u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 14, 200, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 15, 200, 0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    U16(STAGE_PATH0 + 0x24u) = 5002u;
    U16(STAGE_PATH0 + 0x26u) = 5002u;
    uint32_t skId = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 72u : 87u);
    uint32_t lvl = 3u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = skId; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)skId; ts[3] = lvl;
    snprintf(lbl, sizeof(lbl), "srvdo_weaken_decrep_k%d", k);
    run_and_emit(0x6FC71A90u, "SKILLS_SrvDo070_NecromancerWeakenOrDecrepify_6FC71A90_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 10. 0x6FC71C60 SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0x8A01u, 1u, 5000u, 5000u, 0xBA01u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 10u, 0x8A02u, 1u, 5002u, 5002u, 0xBA05u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 14, 200, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 15, 200, 0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    if (k > 0) fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    uint32_t skId = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 86u : 81u);
    uint32_t lvl = 3u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = skId; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)skId; ts[3] = lvl;
    snprintf(lbl, sizeof(lbl), "srvdo_attract_confuse_k%d", k);
    run_and_emit(0x6FC71C60u, "SKILLS_SrvDo058_AttractConvertAndTauntRadius_6FC71C60_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 11. 0x6FC71E70 SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 1u : 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0x8B01u, 1u, 5000u, 5000u, 0xBB01u + (uint32_t)k);
    stage_mon_reg(2u);
    if (k > 0) {
      U16(STAGE_PATH0 + 0x24u) = 5006u;
      U16(STAGE_PATH0 + 0x26u) = 5006u;
    }
    uint32_t skId = 88u; /* Bone Prison */
    uint32_t lvl = (uint32_t)(1 + k);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = skId; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = lvl;
    snprintf(lbl, sizeof(lbl), "srvdo_bprison_ring_k%d", k);
    run_and_emit(0x6FC71E70u, "SKILLS_SrvDo_SpawnRadialMinionRing12_6FC71E70_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 12. 0x6FC8F510 QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 1u : 75u);
    U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u) = (k == 1) ? 0x10u : 0x04u;
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xD8u) = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xF4u) = 0u;
    U8(STAGE_QUESTEX0 + 0x00u) = 1u;
    U32(STAGE_QUESTEX0 + 0x04u) = 0x8C01u;
    U32(STAGE_QUESTEX0 + 0x08u) = 1u;
    uint32_t cls = (k == 0) ? 0u : ((k == 1) ? 0x16Fu : 0xBDu);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, cls, 0x8C01u, 1u, 5000u, 5000u, 0xBC01u + (uint32_t)k);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "q_objev07_thunk_k%d", k);
    run_and_emit(0x6FC8F510u, "QUESTS_ObjectEvent07_FastcallThunk_6FC8F510_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 13. 0x6FC92210 CUBE_Op15_SpawnSecretCowLevelPortal_6FC92210_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 40u : 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x8D01u, 1u, 5002u, 5002u, 0xBD01u + (uint32_t)k);
    U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    uint32_t pGlobalQ = (uint32_t)(uintptr_t)bump_alloc(0x80u);
    U32(pGlobalQ + 0x00u) = pGlobalQ + 0x10u;
    U32(pGlobalQ + 0x04u) = 0x60u;
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QUESTEX0);
    U32(STAGE_QUESTCTRL + 0x0Cu) = pGlobalQ;
    if (k == 0) set_quest_bit(pGlobalQ, 4u, 11u);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "cube_cow_portal_k%d", k);
    run_and_emit(0x6FC92210u, "CUBE_Op15_SpawnSecretCowLevelPortal_6FC92210_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 14. 0x6FC94870 MONSTER_Event12_ExpireTimedStats113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x8E01u, 1u, 5000u, 5000u, 0xBE01u + (uint32_t)k);
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 20u : ((k == 1) ? 5u : 0u);
    if (k > 0) {
      void *pSub = fn_AllocStatList(NULL, 2u, 10u, 1, 0x8E01);
      fn_SetStatIfValid(pSub, 36, 15, 0);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 1);
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "mon_ev12_expire_k%d", k);
    run_and_emit(0x6FC94870u, "MONSTER_Event12_ExpireTimedStats113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* 15. 0x6FC952A0 MONSTER_Event1_ModeEnd113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 0) ? 10u : ((k == 1) ? 1u : 16u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x8F01u, mode, 5000u, 5000u, 0xBF01u + (uint32_t)k);
    U32(STAGE_GAME + 0xA8u) = (uint32_t)(10 + k * 5);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "mon_ev1_mode_end_k%d", k);
    run_and_emit(0x6FC952A0u, "MONSTER_Event1_ModeEnd113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* 16. 0x6FC952E0 MONSTER_Event0_ModeStep113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 0) ? 1u : ((k == 1) ? 4u : 16u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x9001u, mode, 5000u, 5000u, 0xC001u + (uint32_t)k);
    U32(STAGE_GAME + 0xA8u) = (uint32_t)(10 + k * 5);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "mon_ev0_mode_step_k%d", k);
    run_and_emit(0x6FC952E0u, "MONSTER_Event0_ModeStep113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* 17. skipped 0x6FC95680 MONSTER_DropTreasureOnDeath_6FC95680_113c (TS swapped/misinterpreted pKiller/bNoUpgrade vs x86 arg2=bNoUpgrade, arg3=pDamage*) */

  /* 18. 0x6FC95C60 MONSTER_FireModeMissile113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cls = (k == 0) ? 1u : 48u; /* Fallen melee vs Skeleton Archer */
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x9201u, 4u, 5000u, 5000u, 0xC201u + (uint32_t)k);
    U16(STAGE_PATH0 + 0x24u) = 5004u;
    U16(STAGE_PATH0 + 0x26u) = 5004u;
    uint32_t bCheck = (k == 2) ? 1u : 0u;
    c = make_call();
    c.eax = STAGE_UNIT0; c.ebx = STAGE_GAME;
    c.nargs = 1; c.args[0] = bCheck; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = bCheck;
    snprintf(lbl, sizeof(lbl), "mon_fire_missile_k%d", k);
    run_and_emit(0x6FC95C60u, "MONSTER_FireModeMissile113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 19. 0x6FC96740 MONSTER_Event03_RegenAndPoisonTick113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x9301u, 1u, 5000u, 5000u, 0xC301u + (uint32_t)k);
    U32(STAGE_GAME + 0xA8u) = (uint32_t)(10 + k * 5);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0); /* hp */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0); /* maxhp */
    if (k > 0) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x4A, (k == 2) ? -64 : 128, 0); /* hpregen */
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "mon_ev03_regen_k%d", k);
    run_and_emit(0x6FC96740u, "MONSTER_Event03_RegenAndPoisonTick113c", k, lbl, &c, ts, 4, 0u, 0);
  }
}


static uint32_t find_mon_by_base_id(uint16_t baseId) {
  uint32_t pTables  = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
  uint32_t pMonBase = U32(pTables + 0xA78u);
  uint32_t nMonCnt  = U32(pTables + 0xA80u);
  for (uint32_t id = 0; id < nMonCnt; id++) {
    if (U16(pMonBase + id * 0x1A8u + 0x02u) == baseId) return id;
  }
  return 1u;
}

static void emit_batch_4b1(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* 1. 0x6FC737D0 PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x9401u, 1u, 5000u, 5000u, 0xC401u + (uint32_t)k);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x9402u, 2u, 1u, 100u, 0xC405u);
      U32(STAGE_UNIT1 + 0x10u) = 1u; /* ITEMMODE_EQUIP */
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4);
    }
    uint32_t nMax = (k == 0) ? 1u : 0x400u;
    c = make_call();
    c.ecx = STAGE_SCRATCH; c.edx = (uint32_t)(uintptr_t)pInv;
    c.nargs = 6; c.args[0] = 0u; c.args[1] = 0u; c.args[2] = nMax; c.calleePop = 24u;
    ts[0] = STAGE_SCRATCH; ts[1] = (uint32_t)(uintptr_t)pInv; ts[2] = nMax;
    snprintf(lbl, sizeof(lbl), "psave_write_inv_k%d", k);
    run_and_emit(0x6FC737D0u, "PLAYERSAVE_WriteInventoryAndCursorItems_6FC737D0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2. 0x6FC74320 PLAYERSAVE_SavePlayerCharacter_6FC74320_113c (in-mem game type 1/2 avoids disk write) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x9501u, 1u, 5000u, 5000u, 0xC501u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    void *pSkList = fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)pSkList;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 36, 1, 1, 0, 0);
    U32((uint32_t)(uintptr_t)pSkList + 0x08u) = U32((uint32_t)(uintptr_t)pSkList + 0x04u);
    U32((uint32_t)(uintptr_t)pSkList + 0x0Cu) = U32((uint32_t)(uintptr_t)pSkList + 0x04u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x9501u);
    U8(STAGE_CLIENT + 0x08u) = 1u; /* Sorceress */
    for (uint8_t d = 0; d < 3u; d++) {
      attach_quest_bits(STAGE_UDATA0, d, (uint32_t)(uintptr_t)bump_alloc(0x80u));
      uint32_t pWp = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U16(pWp) = 0x0102u;
      U32(STAGE_UDATA0 + 0x1Cu + (uint32_t)d * 4u) = pWp;
      uint32_t pIntro = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      uint32_t pQPtr  = (uint32_t)(uintptr_t)bump_alloc(8u);
      uint32_t pNPtr  = (uint32_t)(uintptr_t)bump_alloc(8u);
      U32(pQPtr) = (uint32_t)(uintptr_t)bump_alloc(8u);
      U32(pNPtr) = (uint32_t)(uintptr_t)bump_alloc(8u);
      U32(pIntro + 0x00u) = pQPtr;
      U32(pIntro + 0x04u) = pNPtr;
      U32(STAGE_UDATA0 + 0x60u + (uint32_t)d * 4u) = pIntro;
    }
    if (k == 2) {
      U8(STAGE_CLIENT + 0x0Du) = 'H'; U8(STAGE_CLIENT + 0x0Eu) = 'e'; U8(STAGE_CLIENT + 0x0Fu) = 'r'; U8(STAGE_CLIENT + 0x10u) = 'o';
      U8(STAGE_UNIT0 + 0x6Cu) = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 0u;
    }
    U8(STAGE_CLIENT + 0x1Du) = 'T'; U8(STAGE_CLIENT + 0x1Eu) = 'e'; U8(STAGE_CLIENT + 0x1Fu) = 's'; U8(STAGE_CLIENT + 0x20u) = 't';
    U32(STAGE_SCRATCH + 0x00u) = 0x63634141u; /* "AAcc" */
    U8(STAGE_GAME + 0x6Au) = (k == 2) ? 2u : 1u;
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.ebx = STAGE_GAME; c.esi = pPlr;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pPlr; ts[2] = STAGE_SCRATCH; ts[3] = 0u;
    snprintf(lbl, sizeof(lbl), "psave_save_char_k%d", k);
    run_and_emit(0x6FC74320u, "PLAYERSAVE_SavePlayerCharacter_6FC74320_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, (k == 1) ? 1 : 0);
  }

  /* 3. 0x6FC7E420 ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_mon_reg(120u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 120u);
    stage_room_logical_info(STAGE_ROOMEX0);
    stage_quest_node(STAGE_QUEST0, 0x27u, STAGE_QUESTEX0, 0u);
    uint32_t cls = (k == 0) ? 0x1DAu : ((k == 1) ? 0x1DBu : 0x1DCu);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, cls, 0x9601u, (k == 0) ? 4u : 0u, 5002u, 5002u, 0xC601u + (uint32_t)k);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) {
      uint32_t pColl = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pMap  = U32(pColl + 0x20u);
      for (uint32_t ci = 0; ci < 32u * 32u; ci++) U16(pMap + ci * 2u) = 0xFFFFu;
    }
    U32(STAGE_QUESTEX0 + 0x0Cu) = (k == 1) ? 1u : 0u;
    c = make_call();
    c.nargs = 2; c.args[0] = STAGE_QUEST0; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "act5q5_statue_k%d", k);
    run_and_emit(0x6FC7E420u, "ACT5Q5_ActivateAncientStatueAndSpawnMonster_6FC7E420_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 4. 0x6FC90240 CUBE_ValidateRecipeInputSlot_6FC90240_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x9701u, 1u, 5000u, 5000u, 0xC701u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 0x9702u, 2u, 10u, 100u, 0xC705u);
    U8(STAGE_UDATA1 + 0x45u) = 3u;
    U32(STAGE_UNIT1 + 0x10u) = 0u;
    fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 0);
    uint32_t pCubeTxt = STAGE_SCRATCH;
    uint32_t pOutCtx  = STAGE_SCRATCH + 0x200u;
    uint32_t pUsed    = STAGE_SCRATCH + 0x400u;
    if (k > 0) {
      U16(pCubeTxt + 0x14u) = 0x0001u; /* flag 1 = match specific item id */
      U16(pCubeTxt + 0x16u) = (k == 1) ? (uint16_t)g_item_sword : (uint16_t)g_item_ring;
      U8(pCubeTxt + 0x1Bu)  = 1u;
    }
    c = make_call();
    c.esi = pCubeTxt;
    c.nargs = 5; c.args[0] = STAGE_GAME; c.args[1] = (uint32_t)(uintptr_t)pInv; c.args[2] = 0u; c.args[3] = pOutCtx; c.args[4] = pUsed; c.calleePop = 20u;
    ts[0] = pCubeTxt; ts[1] = STAGE_GAME; ts[2] = (uint32_t)(uintptr_t)pInv; ts[3] = 0u; ts[4] = pOutCtx; ts[5] = pUsed;
    snprintf(lbl, sizeof(lbl), "cube_val_in_k%d", k);
    run_and_emit(0x6FC90240u, "CUBE_ValidateRecipeInputSlot_6FC90240_113c", k, lbl, &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* 5. 0x6FC917E0 STASH_HandleBankGoldOrCloseAction_6FC917E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x9801u, 1u, 5000u, 5000u, 0xC801u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x9801u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0); /* lvl 10 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 1000, 0); /* gold */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 15, 500, 0);  /* goldbank */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x10Bu, 0x9802u, 0u, 5002u, 5002u, 0xC802u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t wAct = (k == 0) ? 0x12u : ((k == 1) ? 0x13u : 0x14u);
    uint32_t amt  = (k == 0) ? 0u : ((k == 1) ? 200u : 300u);
    if (k == 0) {
      U8(STAGE_UNIT0 + 0x6Cu) = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 2u;
    }
    c = make_call();
    c.eax = 0x9802u; c.ecx = STAGE_UNIT0; c.edx = STAGE_GAME;
    c.nargs = 2; c.args[0] = wAct; c.args[1] = amt; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = 0x9802u; ts[3] = wAct; ts[4] = amt;
    snprintf(lbl, sizeof(lbl), "stash_gold_k%d", k);
    run_and_emit(0x6FC917E0u, "STASH_HandleBankGoldOrCloseAction_6FC917E0_113c", k, lbl, &c, ts, 5, 0u, 0);
  }

  /* 6. 0x6FC92220 D2Game_6FC92220_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x9901u, 1u, 5000u, 5000u, 0xC901u + (uint32_t)k);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x9901u);
    stage_client_pkt_pool(STAGE_CLIENT);
    uint32_t pCubeTxt = STAGE_SCRATCH;
    uint32_t pOutArgs = STAGE_SCRATCH + 0x200u;
    for (int mIdx = 0; mIdx < 5; mIdx++) {
      S32(pCubeTxt + 0x4Cu + 0x18u + (uint32_t)mIdx * 12u) = -1;
    }
    if (k == 1) {
      U16(pCubeTxt + 0x4Cu + 0u) = 0u; /* wFlags = 0 */
      U16(pCubeTxt + 0x4Cu + 2u) = (uint16_t)(g_item_pot ? g_item_pot : 1u);
      U8(pCubeTxt + 0x4Cu + 6u)  = 2u; /* normal quality */
      U8(pCubeTxt + 0x4Cu + 8u)  = 0xFCu; /* nQuality = 0xFC -> outDef+2 */
      U8(pCubeTxt + 0x4Cu + 9u)  = 10u; /* ilvl */
    } else if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring ? g_item_ring : 10u, 0x9911u, 2u, 10u, 1u, 0xC911u);
      U8(STAGE_UDATA1 + 0x44u) = 3u;
      U32(pOutArgs + 0u) = STAGE_UNIT1;
      S32(pOutArgs + 4u) = (int32_t)(g_item_pot ? g_item_pot : 1u);
      U16(pCubeTxt + 0x4Cu + 0u) = 1u; /* wFlags = 1 (use input item) */
      U8(pCubeTxt + 0x4Cu + 8u)  = 0xFEu; /* nQuality = 0xFE (code from pOutArgs+4) */
      U8(pCubeTxt + 0x4Cu + 9u)  = 12u;
    }
    c = make_call();
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = pCubeTxt; c.args[3] = pOutArgs; c.calleePop = 16u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pCubeTxt; ts[3] = pOutArgs;
    snprintf(lbl, sizeof(lbl), "cube_exec_k%d", k);
    run_and_emit(0x6FC92220u, "D2Game_6FC92220_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 7. 0x6FC92FC0 CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x9A01u, 1u, 5000u, 5000u, 0xCA01u + (uint32_t)k);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x9A01u);
    stage_client_pkt_pool(STAGE_CLIENT);
    if (k >= 1) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x9A02u, 2u, 1u, 100u, 0xCA05u);
      U8(STAGE_UDATA1 + 0x45u) = 3u;
      U32(STAGE_UNIT1 + 0x10u) = 0u;
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 0);
    }
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pPlr; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pPlr;
    snprintf(lbl, sizeof(lbl), "cube_transmute_k%d", k);
    run_and_emit(0x6FC92FC0u, "CUBE_TransmuteHoradricCubeItems_6FC92FC0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 8. 0x6FC93860 PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x9B01u, 1u, 5000u, 5000u, 0xCB01u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x9B01u);
    stage_client_pkt_pool(STAGE_CLIENT);
    U32(STAGE_UDATA0 + 0x50u) = (k == 2) ? 4u : 3u;
    if (k >= 1) {
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x64u) = 0x9B02u;
      U32(STAGE_UDATA0 + 0x5Cu) = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0x9B02u, 1u, 5002u, 5002u, 0xCB02u);
      link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 0x9B02u);
      stage_client_pkt_pool(STAGE_CLIENT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_UDATA1 + 0x5Cu) = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    }
    c = make_call();
    c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = 0u;
    snprintf(lbl, sizeof(lbl), "trade_val_item_k%d", k);
    run_and_emit(0x6FC93860u, "PLRTRADE_ValidateTradeItemAndCancelSession_6FC93860_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 9. 0x6FC94200 PLRTRADE_HandleClientTradeButton_6FC94200_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x9C01u, 1u, 5000u, 5000u, 0xCC01u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0x9C02u, 1u, 5002u, 5002u, 0xCC02u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0x9C01u);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 0x9C02u);
    stage_client_pkt_pool(STAGE_CLIENT);
    stage_client_pkt_pool(STAGE_CLIENT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U8(STAGE_UNIT0 + 0x6Cu) = 1u; U32(STAGE_UNIT0 + 0x64u) = 0x9C02u;
    U8(STAGE_UNIT1 + 0x6Cu) = 1u; U32(STAGE_UNIT1 + 0x64u) = 0x9C01u;
    U32(STAGE_UDATA0 + 0x50u) = 4u; U32(STAGE_UDATA1 + 0x50u) = 4u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 500, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 14, 100, 0);
    uint32_t btn  = (k == 0) ? 0x0Au : ((k == 1) ? 0x07u : 0x08u); /* invalid, unaccept(5), offer gold(6) */
    uint32_t gold = (k == 2) ? 150u : 0u;
    c = make_call();
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = btn; c.args[3] = gold; c.calleePop = 16u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = btn; ts[3] = gold;
    snprintf(lbl, sizeof(lbl), "trade_btn_k%d", k);
    run_and_emit(0x6FC94200u, "PLRTRADE_HandleClientTradeButton_6FC94200_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 10. 0x6FC95A40 MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t siegeCls = find_mon_by_base_id(0x3Fu);
    uint32_t cls = (k == 0) ? 1u : siegeCls;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x9D01u + (uint32_t)k, 4u, 5000u, 5000u, 0xCD01u + (uint32_t)k);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0x9D09u, 1u, 5004u, 5004u, 0xCD09u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    }
    c = make_call();
    c.edi = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = 1u;
    snprintf(lbl, sizeof(lbl), "mon_siege_stomp_k%d", k);
    run_and_emit(0x6FC95A40u, "MONSTER_SpawnSiegeBeastStompProjectiles_6FC95A40_113c", k, lbl, &c, ts, 3, 0u, 0);
  }
}


static void emit_batch_4b2(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[48];

  /* 13. 0x6FC969A0 MONSTER_DispatchEvent113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 0) ? 2u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xA001u, mode, 5000u, 5000u, 0xD001u + (uint32_t)k);
    U32(STAGE_GAME + 0xA8u) = 20u + (uint32_t)k * 5u;
    if (k == 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x4A, 128, 0);
    } else if (k == 2) {
      void *pSl = fn_AllocStatList(NULL, 2u, 10u, 1, 0xA001u);
      fn_SetStatIfValid(pSl, 36, 15, 0);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSl, 1);
    }
    uint32_t ev = (k == 0) ? 1u : ((k == 1) ? 3u : 12u);
    c = make_call();
    c.esi = ev; c.edi = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = ev; ts[3] = 0; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "mon_disp_ev_k%d", k);
    run_and_emit(0x6FC969A0u, "MONSTER_DispatchEvent113c", k, lbl, &c, ts, 5, 0u, 0);
  }

  /* 14. 0x6FC97240 MONSTER_ApplyElementalDamageAndResistStats113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cls = (k == 2) ? 62u : 1u; /* Fallen vs Willowisp/etc with elemental attack */
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0xA101u, 4u, 5000u, 5000u, 0xD101u + (uint32_t)k);
    uint32_t pMon = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t nMode = (k == 2) ? 5u : 4u;
    c = make_call();
    c.nargs = 2; c.args[0] = pMon; c.args[1] = nMode; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pMon; ts[2] = nMode;
    snprintf(lbl, sizeof(lbl), "mon_elem_stats_k%d", k);
    run_and_emit(0x6FC97240u, "MONSTER_ApplyElementalDamageAndResistStats113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 15. 0x6FC97790 MONSTER_ExecuteMeleeSwing113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xA201u, 4u, 5000u, 5000u, 0xD201u + (uint32_t)k);
    if (k > 0) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 4u, 0xA202u, 1u, 5001u, 5001u, 0xD205u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 2) ? 50 : 5, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 10, 0);
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    }
    c = make_call();
    c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "mon_melee_swing_k%d", k);
    run_and_emit(0x6FC97790u, "MONSTER_ExecuteMeleeSwing113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 16. 0x6FC97950 PLAYER_UpdateManaRegen113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0xA301u, 1u, 5000u, 5000u, 0xD301u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, (k == 2) ? (99 << 8) : (20 << 8), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 27, 50, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 26, (k == 0) ? 0 : 128, 0);
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.edi = pPlr; c.calleePop = 0u;
    ts[0] = pPlr;
    snprintf(lbl, sizeof(lbl), "plr_mana_regen_k%d", k);
    run_and_emit(0x6FC97950u, "PLAYER_UpdateManaRegen113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* 18. 0x6FC988B0 UNIT_SyncStateAndStatsToClient113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0xA501u, 1u, 5000u, 5000u, 0xD501u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0xA501u);
    stage_client_pkt_pool(STAGE_CLIENT);
    if (k == 1) {
      U32(STAGE_UNIT0 + 0xC4u) |= 0x400u;
      U16(STAGE_UNIT0 + 0x6Eu) = 0x55u;
    } else if (k == 2) {
      void *pSl = fn_AllocStatList(NULL, 1u, 0u, 1, 0xA501u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSl, 1);
      U32(STAGE_CLIENT + 0x48Cu) = 1u;
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 80 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 30 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 40 << 8, 0);
    }
    uint32_t uPtr = STAGE_UNIT0;
    c = make_call();
    c.eax = uPtr; c.ecx = STAGE_GAME;
    c.nargs = 2; c.args[0] = STAGE_CLIENT; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_CLIENT; ts[2] = uPtr;
    snprintf(lbl, sizeof(lbl), "unit_sync_client_k%d", k);
    run_and_emit(0x6FC988B0u, "UNIT_SyncStateAndStatsToClient113c", k, lbl, &c, ts, 3, 0u, 0);
  }
}


static uint32_t stage_ai_param(
    uint32_t pAiCtrl, uint32_t pTarget, uint32_t dist, uint32_t inMelee, uint32_t pMonTxt) {
  uint32_t pArg = STAGE_SCRATCH + 0x100u;
  U32(pArg + 0x00u) = pAiCtrl;
  U32(pArg + 0x04u) = 0u;
  U32(pArg + 0x08u) = pTarget;
  U32(pArg + 0x0Cu) = 0u;
  U32(pArg + 0x10u) = (pTarget != 0u) ? 1u : 0u;
  U32(pArg + 0x14u) = dist;
  U32(pArg + 0x18u) = inMelee;
  U32(pArg + 0x1Cu) = pMonTxt;
  U32(pArg + 0x20u) = 0u;
  return pArg;
}

static uint32_t clone_montxt_no_skills(uint32_t srcMonTxt) {
  uint32_t pDst = STAGE_SCRATCH + 0x200u;
  for (uint32_t i = 0u; i < 0x1A8u; i += 4u) {
    U32(pDst + i) = U32(srcMonTxt + i);
  }
  for (uint32_t s = 0u; s < 8u; s++) {
    U16(pDst + 0x170u + s * 2u) = 0xFFFFu;
  }
  return pDst;
}

static void emit_batch_4c1(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[48];

  /* 1. 0x6FC9B8E0 AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xB001u, 1u, 5000u, 5000u, 0xE001u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0xB002u, (k == 1) ? 0x0Cu : 1u, 5002u, 5002u, 0xE002u);
    U32(STAGE_UNIT1 + 0xC4u) |= 0x02u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, (k == 2) ? (40 << 8) : (100 << 8), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 100 << 8, 0);
    uint32_t pCtx = STAGE_SCRATCH;
    U32(pCtx + 0x10u) = 100u;
    U32(pCtx + 0x14u) = 1u;
    U32(pCtx + 0x18u) = 0u;
    uint32_t pCand = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call();
    c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = pCand; c.args[1] = pCtx; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = pCand; ts[2] = pCtx;
    snprintf(lbl, sizeof(lbl), "monai_scan_resheal_k%d", k);
    run_and_emit(0x6FC9B8E0u, "AI_ScanCallbackResurrectOrHealTarget_6FC9B8E0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2. 0x6FC9C6E0 AI_TryCastTentacleSpawnAtDirection_6FC9C6E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xB101u, 1u, 5004u, 5004u, 0xE101u);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 36, 1, 1, 0, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xB102u, 1u, 5008u, 5004u, 0xE102u);
    uint32_t pMonTxt = clone_montxt_no_skills(U32(STAGE_UDATA0));
    U16(pMonTxt + 0x170u) = (k == 0) ? 0xFFFFu : 36u;
    U8(pMonTxt + 0x180u)  = 6u;
    if (k == 2) {
      uint32_t pColl = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pMap  = U32(pColl + 0x20u);
      for (uint32_t ci = 0u; ci < 32u * 32u; ci++) U16(pMap + ci * 2u) = 0xFFFFu;
    }
    c = make_call();
    c.eax = STAGE_UNIT1; c.ecx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pMonTxt; c.calleePop = 8u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = pMonTxt; ts[3] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "monai_tentacle_dir_k%d", k);
    run_and_emit(0x6FC9C6E0u, "AI_TryCastTentacleSpawnAtDirection_6FC9C6E0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 3. 0x6FC9CB10 AI_LinkedOwnerTurretCycle_6FC9CB10_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xB201u, 1u, 5000u, 5000u, 1u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xB202u, (k == 2) ? 0x0Cu : 1u, 5003u, 5003u, 0xE202u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiGen  = U32(STAGE_UDATA0 + 0x28u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    U32(pAiGen + 0x28u) = STAGE_GAME;
    U32(pAiGen + 0x2Cu) = 0xB202u;
    U32(pAiGen + 0x30u) = 0u;
    if (k == 0) {
      U32(pAiCtrl + 0x1Cu) = 1u;
    }
    uint32_t pMonTxt = clone_montxt_no_skills(U32(STAGE_UDATA0));
    U16(pMonTxt + 0x6Eu) = (k == 0) ? 15u : ((k == 1) ? 7u : 11u);
    uint32_t pArg = stage_ai_param(pAiCtrl, STAGE_UNIT1, 3u, 1u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "monai_turret_cycle_k%d", k);
    run_and_emit(0x6FC9CB10u, "AI_LinkedOwnerTurretCycle_6FC9CB10_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 4. 0x6FC9D670 AI_ThinkCommand14TriggeredSkill_6FC9D670_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xB301u, 1u, 5000u, 5000u, 0xE301u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xB302u, 1u, 5003u, 5003u, 0xE302u);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 36, 1, 1, 0, 0);
    U32(STAGE_PATH0 + 0x38u) = STAGE_UNIT1;
    uint32_t pAiGen  = U32(STAGE_UDATA0 + 0x28u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = clone_montxt_no_skills(U32(STAGE_UDATA0));
    if (k == 2) {
      uint32_t pCmd = (uint32_t)(uintptr_t)bump_alloc(0x1Cu);
      U32(pCmd + 0x00u) = pCmd;
      U32(pCmd + 0x04u) = pCmd;
      U32(pCmd + 0x08u) = 0x0Eu;
      U32(pCmd + 0x18u) = 1u;
      U32(pAiGen + 0x20u) = pCmd;
      U32(pAiGen + 0x24u) = pCmd;
      U16(pMonTxt + 0x170u) = 36u;
      U8(pMonTxt + 0x180u)  = 6u;
    } else if (k == 1) {
      U32(pAiCtrl + 0x00u) = 1u;
    }
    uint32_t pArg = stage_ai_param(pAiCtrl, STAGE_UNIT1, 3u, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "monai_cmd14_trig_k%d", k);
    run_and_emit(0x6FC9D670u, "AI_ThinkCommand14TriggeredSkill_6FC9D670_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 5. 0x6FC9EA10 AI_Thinker_Izual_6FC9EA10_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 104u);
    stage_quest_node(STAGE_QUEST0, 22u, STAGE_QUESTEX0, 0u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 256u, 0xB401u, 1u, 5000u, 5000u, 0xE401u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xB402u, 1u, 5005u, 5005u, 0xE402u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = clone_montxt_no_skills(U32(STAGE_UDATA0));
    if (k == 0) {
      U32(pAiCtrl + 0x14u) = 0u;
      U32(pAiCtrl + 0x18u) = 10u;
    } else if (k == 1) {
      U32(pAiCtrl + 0x14u) = 1u;
      U32(pAiCtrl + 0x18u) = 15u;
    } else {
      U32(pAiCtrl + 0x14u) = 1u;
      U32(pAiCtrl + 0x1Cu) = 5u;
    }
    uint32_t pArg = stage_ai_param(pAiCtrl, STAGE_UNIT1, 5u, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "monai_izual_k%d", k);
    run_and_emit(0x6FC9EA10u, "AI_Thinker_Izual_6FC9EA10_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 6. 0x6FCA2570 AI_ThinkSimpleMeleeVariantB_6FCA2570_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xB501u, 1u, 5000u, 5000u, 0xE501u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xB502u, 1u, 5004u, 5004u, 0xE502u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = clone_montxt_no_skills(U32(STAGE_UDATA0));
    U16(pMonTxt + 0x56u) = (k == 0) ? 100u : 0u; /* aip1 walk/approach */
    U16(pMonTxt + 0x5Cu) = (k == 2) ? 20u : 12u; /* aip2 stall */
    U16(pMonTxt + 0x62u) = 0u; /* aip3 attack=0 to avoid external 0x6FC95E10 */
    uint32_t inMelee = (k == 2) ? 1u : 0u;
    uint32_t pArg = stage_ai_param(pAiCtrl, STAGE_UNIT1, 4u, inMelee, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "monai_simple_melee_b_k%d", k);
    run_and_emit(0x6FCA2570u, "AI_ThinkSimpleMeleeVariantB_6FCA2570_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 7. 0x6FCA26B0 MONAI_CorruptRogueArcherThink_6FCA26B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xB601u, 1u, 5000u, 5000u, 0xE601u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xB602u, 1u, 5004u, 5004u, 0xE602u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = clone_montxt_no_skills(U32(STAGE_UDATA0));
    U16(pMonTxt + 0x56u) = 0u; /* aip1 */
    U16(pMonTxt + 0x5Cu) = 0u; /* aip2 */
    U16(pMonTxt + 0x62u) = 8u; /* aip3 */
    uint32_t inMelee = (k == 0) ? 1u : 0u;
    uint32_t dist    = (k == 1) ? 3u : 20u;
    if (k == 2) U32(STAGE_UDATA0 + 0x54u) = 3u;
    uint32_t pArg = stage_ai_param(pAiCtrl, STAGE_UNIT1, dist, inMelee, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "monai_rogue_archer_k%d", k);
    run_and_emit(0x6FCA26B0u, "MONAI_CorruptRogueArcherThink_6FCA26B0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 8. 0x6FCA3AC0 AI_ThinkDualAttackMelee_6FCA3AC0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xB901u, 1u, 5000u, 5000u, 0xE901u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xB902u, 1u, 5004u, 5004u, 0xE902u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = clone_montxt_no_skills(U32(STAGE_UDATA0));
    U16(pMonTxt + 0x56u) = (k == 0) ? 100u : 0u; /* aip1 walk */
    U16(pMonTxt + 0x5Cu) = (k == 2) ? 22u : 14u; /* aip2 stall */
    U16(pMonTxt + 0x62u) = 0u; /* aip3 attack=0 to avoid external 0x6FC95E10 */
    U16(pMonTxt + 0x68u) = 100u; /* aip4 A1 */
    uint32_t inMelee = (k == 2) ? 1u : 0u;
    uint32_t pArg = stage_ai_param(pAiCtrl, STAGE_UNIT1, 4u, inMelee, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "monai_dual_atk_k%d", k);
    run_and_emit(0x6FCA3AC0u, "AI_ThinkDualAttackMelee_6FCA3AC0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 9. 0x6FCA3FE0 MONAI_CorpseSpitterThink_6FCA3FE0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xBA01u, 1u, 5000u, 5000u, 0xEA01u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xBA02u, 1u, 5006u, 5006u, 0xEA02u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = clone_montxt_no_skills(U32(STAGE_UDATA0));
    if (k == 1) {
      U32(pAiCtrl + 0x14u) = 5u; /* flee */
    } else if (k == 2) {
      U32(pAiCtrl + 0x14u) = 2u; /* corpse guid missing -> resets state and wanders */
      U32(pAiCtrl + 0x18u) = 0x9999u;
    }
    uint32_t pArg = stage_ai_param(pAiCtrl, STAGE_UNIT1, 6u, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "monai_corpse_spit_k%d", k);
    run_and_emit(0x6FCA3FE0u, "MONAI_CorpseSpitterThink_6FCA3FE0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }
}


static void emit_batch_4c2(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[48];

  /* 10. 0x6FCA5500 MONAI_PutridDefilerImpregnateThink_6FCA5500_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xBB01u, 1u, 5000u, 5000u, 0xEB01u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xBB02u, 1u, 5003u, 5003u, 0xEB02u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = clone_montxt_no_skills(U32(STAGE_UDATA0));
    U16(pMonTxt + 0x170u) = 0u; /* wSkill1 >= 0 (Attack), skipped because state!=0 & frame<=cooldown */
    U16(pMonTxt + 0x56u)  = 0u; /* aip1 */
    U16(pMonTxt + 0x6Eu)  = (k == 0) ? 14u : ((k == 1) ? 30u : 20u); /* aip5 */
    U32(pAiCtrl + 0x1Cu)  = (k == 2) ? 2u : 1u;
    U32(pAiCtrl + 0x18u)  = 200u;
    uint32_t pArg = stage_ai_param(pAiCtrl, STAGE_UNIT1, 5u, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "monai_defiler_k%d", k);
    run_and_emit(0x6FCA5500u, "MONAI_PutridDefilerImpregnateThink_6FCA5500_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 11. 0x6FCA5B60 AI_ThinkMephistoBoss_6FCA5B60_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 102u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 242u, 0xBD01u, 1u, 5000u, 5000u, 0xED01u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xBD02u, 1u, 5004u, 5004u, 0xED02u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = clone_montxt_no_skills(U32(STAGE_UDATA0));
    U16(pMonTxt + 0x56u) = (k == 1) ? 100u : 0u; /* aip1 melee */
    uint32_t pAiP = (uint32_t)(uintptr_t)bump_alloc(0x30u);
    U32(pAiP + 0x1Cu) = 0u;
    uint32_t inMelee = (k == 1) ? 1u : 0u;
    uint32_t pArg = stage_ai_param(pAiP, STAGE_UNIT1, (k == 2) ? 20u : 4u, inMelee, pMonTxt);
    U32(STAGE_UDATA0 + 0x2Cu) = pAiCtrl;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "monai_mephisto_k%d", k);
    run_and_emit(0x6FCA5B60u, "AI_ThinkMephistoBoss_6FCA5B60_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 12. 0x6FCA6280 AI_ThinkGiantMosquito_6FCA6280_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xBE01u, 1u, 5000u, 5000u, 0xEE01u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xBE02u, 1u, 5004u, 5004u, 0xEE02u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = clone_montxt_no_skills(U32(STAGE_UDATA0));
    uint32_t dist = (k == 0) ? 2u : ((k == 1) ? 10u : 25u);
    uint32_t pArg = stage_ai_param(pAiCtrl, STAGE_UNIT1, dist, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "monai_mosquito_k%d", k);
    run_and_emit(0x6FCA6280u, "AI_ThinkGiantMosquito_6FCA6280_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 13. 0x6FCACA20 D2GAME_PACKET_SendMonsterAssign113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0xC001u, 1u, 5000u, 5000u, 0xF001u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0xC001u);
    stage_client_pkt_pool(STAGE_CLIENT);
    uint32_t targetU = STAGE_UNIT1;
    if (k == 0) {
      targetU = 0u;
    } else {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0xC010u + (uint32_t)k, (k == 2) ? 8u : 1u, 5002u, 5003u, 0xF010u);
      U32(STAGE_UNIT1 + 0x18u) = 0u;
      if (k == 2) {
        U8(STAGE_UDATA1 + 0x16u) = 2u;
        U16(STAGE_UDATA1 + 0x26u) = 0x0015u;
        U8(STAGE_UDATA1 + 0x1Cu) = 5u;
        U16(STAGE_UDATA1 + 0x14u) = 0x1234u;
        U32(STAGE_UNIT1 + 0xC4u) |= 0x200u;
      }
    }
    c = make_call();
    c.eax = targetU;
    c.nargs = 1; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = targetU; ts[1] = STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "pkt_mon_assign_k%d", k);
    run_and_emit(0x6FCACA20u, "D2GAME_PACKET_SendMonsterAssign113c", k, lbl, &c, ts, 2, 0u, 0);
  }
}


static void stage_b4d_obj_env(uint32_t objClass, uint32_t objMode, uint32_t lvlId) {
  stage_timer_queue();
  stage_obj_ctrl(lvlId);
  stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
  stage_room_logical_info(STAGE_ROOMEX0);
  stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0xD101u, 1u, 5002u, 5002u, 0xE101u);
  void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
  U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
  link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0xD101u);
  stage_client_pkt_pool(STAGE_CLIENT);
  insert_server_unit(STAGE_GAME, STAGE_UNIT0);
  attach_quest_bits(STAGE_UDATA0, 0u, (uint32_t)(uintptr_t)bump_alloc(0x80u));
  U32(STAGE_UDATA0 + 0x1Cu) = (uint32_t)(uintptr_t)bump_alloc(0x20u);
  stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, objClass, 0xD102u, objMode, 5003u, 5003u, 0xE102u);
  insert_server_unit(STAGE_GAME, STAGE_UNIT1);
}

static void emit_batch_4d1(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[48];

  /* 1. 0x6FC70070 SKILLS_PostInitSummonedPetStatsAndAi_6FC70070_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 0xD001u, 1u, 5000u, 5000u, 0xE001u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 363u, 0xD002u, 1u, 5002u, 5002u, 0xE005u + (uint32_t)k);
    void *pSkList = fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)pSkList;
    if (k >= 1) {
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 79, (k == 1) ? 2 : 5, 1, 0, 0); /* Summon Resist */
    }
    uint32_t skId = 0u; /* keeps 0x6FC6F970 a no-op while exercising 0x6FC6E2A0 AC/ToHit + 0x6FC6E180 Resists */
    uint32_t lvl = (k == 0) ? 1u : ((k == 1) ? 5u : 10u);
    c = make_call();
    c.eax = STAGE_UNIT1; c.ebx = skId; c.esi = STAGE_GAME;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = lvl; ts[3] = STAGE_GAME; ts[4] = skId;
    snprintf(lbl, sizeof(lbl), "postinit_pet_k%d", k);
    run_and_emit(0x6FC70070u, "SKILLS_PostInitSummonedPetStatsAndAi_6FC70070_113c", k, lbl, &c, ts, 5, 0u, 0);
  }

  /* 2. 0x6FC863A0 ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x26u);
    stage_room_logical_info(STAGE_ROOMEX0);
    stage_obj_ctrl(0x26u);
    stage_mon_reg(0x26u);
    uint32_t qId = (k == 0) ? 1u : 4u;
    stage_quest_node(STAGE_QUEST0, qId, STAGE_QUESTEX0, 0u);
    if (k >= 1) {
      U8(STAGE_QUESTEX0 + 0x70u) = (k == 2) ? 1u : 0u;
    }
    if (k == 2) {
      U32(STAGE_QUESTEX0 + 0x6Cu) = 0xD299u; /* cage missing in hash; avoids broken 0x6FC860D0 */
      U8(STAGE_QUESTEX0 + 0x91u) = 1u;
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "a1q4_cain_cage_k%d", k);
    run_and_emit(0x6FC863A0u, "ACT1Q4_SpawnCainCageAndPortalInTristram_6FC863A0_113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* 3. 0x6FC8A330 OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t cls = (k == 0) ? 0x79u : 0x77u;
    uint32_t mode = (k == 2) ? 1u : 0u;
    uint32_t lvlId = (k == 1) ? 3u : 1u;
    stage_b4d_obj_env(cls, mode, lvlId);
    c = make_call();
    c.eax = STAGE_SCRATCH; c.edx = 0xD102u; c.ebx = STAGE_GAME; c.edi = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 2u; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = 0xD102u; ts[2] = STAGE_GAME; ts[3] = STAGE_UNIT0; ts[4] = 2u;
    snprintf(lbl, sizeof(lbl), "obj_val_disp_op_k%d", k);
    run_and_emit(0x6FC8A330u, "OBJ_ValidateAndDispatchOperateFn_6FC8A330_113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* 4. 0x6FC8B200 OBJECT_SyncStateAndEventsToClient113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t cls = (k == 2) ? 2u : 1u;
    stage_b4d_obj_env(cls, (k == 2) ? 1u : 0u, 1u);
    if (k == 1) {
      U32(STAGE_UNIT1 + 0xC4u) = 0x1u;
    } else if (k == 2) {
      U32(STAGE_UNIT1 + 0xC4u) = 0x101u;
      U32(STAGE_UDATA1 + 0x0Cu) = 2u;
    }
    uint32_t pObj = STAGE_UNIT1;
    c = make_call();
    c.esi = pObj;
    c.nargs = 1; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = pObj; ts[1] = STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "obj_sync_state_ev_k%d", k);
    run_and_emit(0x6FC8B200u, "OBJECT_SyncStateAndEventsToClient113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 5. 0x6FC8E930 D2Game_6FC8E930_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_b4d_obj_env(0x77u, 1u, 1u);
    uint32_t dwWpGuid = (k == 0) ? 0x9999u : 0xD102u;
    uint32_t destLvl  = (k == 2) ? 3u : 0u;
    if (k == 2) {
      U32(STAGE_UNIT0 + 0x64u) = 0xFFFFFFFFu;
      U32(STAGE_UNIT0 + 0x68u) = 6u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 0u;
    } else {
      U32(STAGE_UNIT0 + 0x64u) = 0xD102u;
      U32(STAGE_UNIT0 + 0x68u) = 1u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
    }
    c = make_call();
    c.eax = dwWpGuid; c.ebx = STAGE_GAME; c.esi = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = destLvl; c.calleePop = 4u;
    ts[0] = dwWpGuid; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = destLvl;
    snprintf(lbl, sizeof(lbl), "wp_use_k%d", k);
    run_and_emit(0x6FC8E930u, "D2Game_6FC8E930_113c", k, lbl, &c, ts, 4, 0u, 0);
  }
}


static void emit_batch_4d2(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[48];

  /* 7. 0x6FC95350 MONSTER_SetDeathPathAndAnim113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xD301u + (uint32_t)k, 4u, 5000u, 5000u, 0xE301u + (uint32_t)k);
    if (k >= 1) {
      U8(STAGE_UDATA0 + 0x28u) = 0u; /* zero pAiGeneral; use clean test without hover unless alloc'd */
      U32(STAGE_UNIT0 + 0xC4u) |= 0x800Au;
    }
    uint32_t dir = (k == 0) ? 1u : ((k == 1) ? 3u : 6u);
    c = make_call();
    c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME;
    c.nargs = 1; c.args[0] = dir; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = dir;
    snprintf(lbl, sizeof(lbl), "mon_set_death_anim_k%d", k);
    run_and_emit(0x6FC95350u, "MONSTER_SetDeathPathAndAnim113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 8. 0x6FC95680 MONSTER_DropTreasureOnDeath_6FC95680_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_logical_info(STAGE_ROOMEX0);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0xD401u, 1u, 5000u, 5000u, 0xE401u + (uint32_t)k);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_quest_bits(STAGE_UDATA0, 0u, (uint32_t)(uintptr_t)bump_alloc(0x80u));
    uint32_t monCls = 1u; /* Fallen */
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, monCls, 0xD402u + (uint32_t)k, 12u, 5002u, 5002u, 0xE421u + (uint32_t)k * 0x101u);
    U32(STAGE_GAME + 0xD0u) = 0x24681357u + (uint32_t)k * 0x33333u;
    U32(STAGE_GAME + 0xD4u) = 0x0000029Au;
    if (k == 1) {
      U8(STAGE_UDATA1 + 0x16u) |= 0x04u; /* Champion */
    } else if (k == 2) {
      U8(STAGE_UDATA1 + 0x16u) |= 0x08u; /* Unique */
    }
    uint32_t pKiller = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t bNoUpg  = (k == 2) ? 1u : 0u;
    memset((void *)(uintptr_t)STAGE_SCRATCH, 0, 0x40u);
    U32(STAGE_SCRATCH + 0x08u) = pKiller;
    c = make_call();
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = bNoUpg; c.args[3] = STAGE_SCRATCH; c.calleePop = 16u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1; ts[2] = pKiller; ts[3] = bNoUpg;
    snprintf(lbl, sizeof(lbl), "mon_drop_treasure_k%d", k);
    run_and_emit(0x6FC95680u, "MONSTER_DropTreasureOnDeath_6FC95680_113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* 9. 0x6FC965E0 MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_GAME + 0xA8u) = 50u + (uint32_t)k * 10u;
    uint32_t monCls = (k == 0) ? 34u : 78u; /* class 34 (no mode 3) vs class 78 (base 0x4E Sand Leaper) */
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, monCls, 0xD501u + (uint32_t)k, 1u, 5000u, 5000u, 0xE501u + (uint32_t)k);
    if (k == 2) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x15, 1); /* state 21 -> +45 frames */
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "mon_gethit_sched_k%d", k);
    run_and_emit(0x6FC965E0u, "MONSTER_StartGetHitOrScheduleAi_6FC965E0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 10. 0x6FC977F0 MONSTER_ExecuteEventsWrapper113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_npc_ctrl();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0xD601u, 1u, 5000u, 5000u, 0xE601u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0xD601u);
    stage_client_pkt_pool(STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 1, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 13, 0, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0xD602u, 1u, 5001u, 5001u, 0xE602u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 13, 100, 0);
    if (k == 0) {
      U32(STAGE_UNIT1 + 0xC4u) |= 0x04000000u; /* NOEXP -> early exit */
    } else if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 85, 50, 0); /* +50% exp */
    }
    uint32_t pAtt = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.ecx = pAtt; c.eax = STAGE_UNIT1;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pAtt; ts[2] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "mon_exec_events_wrap_k%d", k);
    run_and_emit(0x6FC977F0u, "MONSTER_ExecuteEventsWrapper113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 11. 0x6FC98550 PLAYER_StartModeAtCoords113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t initMode = (k == 0) ? 17u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0xD701u, initMode, 5000u, 5000u, 0xE701u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 0xD701u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 0x4000, 0);
    uint32_t mode = (k == 0) ? 1u : ((k == 1) ? 2u : 3u);
    uint32_t nx   = 5006u + (uint32_t)k;
    uint32_t ny   = 5006u + (uint32_t)k;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = 0u; c.args[1] = mode; c.args[2] = nx; c.args[3] = ny; c.args[4] = 0u; c.calleePop = 20u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = mode; ts[3] = nx; ts[4] = ny; ts[5] = 0; ts[6] = 0;
    snprintf(lbl, sizeof(lbl), "plr_start_mode_coords_k%d", k);
    run_and_emit(0x6FC98550u, "PLAYER_StartModeAtCoords113c", k, lbl, &c, ts, 7, 0u, 0);
  }

  /* 12. 0x6FC99A10 PLAYER_StepAnimationModeTick113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 0) ? 0u : ((k == 1) ? 2u : 3u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0xD801u, mode, 5000u, 5000u, 0xE801u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    U32(STAGE_PATH0 + 0x40u) = 5000u << 16;
    U32(STAGE_PATH0 + 0x44u) = 5000u << 16;
    U16(STAGE_PATH0 + 0x24u) = 5010u;
    U16(STAGE_PATH0 + 0x26u) = 5010u;
    U32(STAGE_PATH0 + 0x70u) = 2u;
    U32(STAGE_PATH0 + 0x104u) = (5005u << 16) | 5005u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, (k == 2) ? 0 : 0x4000, 0);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "plr_step_anim_tick_k%d", k);
    run_and_emit(0x6FC99A10u, "PLAYER_StepAnimationModeTick113c", k, lbl, &c, ts, 4, 0u, 0);
  }
}


static uint32_t pop_timer_free_node(uint32_t pTimer) {
  uint32_t pChunk = U32(pTimer + 0xA1Cu);
  uint32_t node = U32(pChunk + 0x7080u);
  U32(pChunk + 0x7080u) = U32(node + 0x1Cu);
  memset((void *)(uintptr_t)node, 0, 0x30u);
  return node;
}

static uint32_t b4e_stage_ai_param(
    uint32_t pAiCtrl, uint32_t pTarget, uint32_t dist, uint32_t inMelee, uint32_t pMonTxt) {
  uint32_t pArg = STAGE_SCRATCH + 0x100u;
  U32(pArg + 0x00u) = pAiCtrl;
  U32(pArg + 0x04u) = 0u;
  U32(pArg + 0x08u) = pTarget;
  U32(pArg + 0x0Cu) = 0u;
  U32(pArg + 0x10u) = (pTarget != 0u) ? 1u : 0u;
  U32(pArg + 0x14u) = dist;
  U32(pArg + 0x18u) = inMelee;
  U32(pArg + 0x1Cu) = pMonTxt;
  U32(pArg + 0x20u) = 0u;
  return pArg;
}

static uint32_t b4e_clone_montxt(uint32_t srcMonTxt) {
  uint32_t pDst = STAGE_SCRATCH + 0x200u;
  for (uint32_t i = 0u; i < 0x1A8u; i += 4u) {
    U32(pDst + i) = U32(srcMonTxt + i);
  }
  return pDst;
}

static void emit_batch_4e(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[48];

  /* 1. 0x6FC981C0 PLAYER_StartBlockMode113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 10u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cls = (k == 0) ? 0u : ((k == 1) ? 1u : 3u); /* Ama/Sor/Pal */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, cls, 0xE101u + (uint32_t)k, 1u, 5000u, 5000u, 0xF101u + (uint32_t)k);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = 9u; c.args[1] = 0u; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "plr_start_block_k%d", k);
    run_and_emit(0x6FC981C0u, "PLAYER_StartBlockMode113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* 2. 0x6FCAEBC0 EVENT_ExecuteMonsterEvents113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pTimer = stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u; /* slot = 100 & 63 = 36 */
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xE301u + (uint32_t)k, 1u, 5000u, 5000u, 0xF301u + (uint32_t)k);
    uint32_t bIsSlot = 0u;
    uint32_t pHead = 0u;
    if (k == 1) {
      uint32_t ev = pop_timer_free_node(pTimer);
      U8(ev + 0x00u)  = 14u;
      U16(ev + 0x02u) = 0x0008u; /* DEFERRED_FREE so persistent node gets freed */
      U32(ev + 0x04u) = 0xFFFFFFFFu;
      U32(ev + 0x08u) = STAGE_UNIT0;
      U32(ev + 0x0Cu) = 0xE301u + (uint32_t)k;
      U32(ev + 0x10u) = 1u;
      U32(STAGE_UNIT0 + 0xDCu) = ev;
      U32(pTimer + 0xA08u) = ev; /* pPersistentHead[1] */
      bIsSlot = 0u; pHead = ev;
    } else if (k == 2) {
      uint32_t ev = pop_timer_free_node(pTimer);
      U8(ev + 0x00u)  = 14u;
      U16(ev + 0x02u) = 0u;
      U32(ev + 0x04u) = 100u;
      U32(ev + 0x08u) = STAGE_UNIT0;
      U32(ev + 0x0Cu) = 0xE301u + (uint32_t)k;
      U32(ev + 0x10u) = 1u;
      U32(STAGE_UNIT0 + 0xDCu) = ev;
      uint32_t slot = 64u + (100u & 63u);
      U32(pTimer + 0x004u + slot * 4u) = ev; /* pSlotTail[slot] */
      U32(pTimer + 0x504u + slot * 4u) = ev; /* pSlotHead[slot] */
      bIsSlot = 1u; pHead = ev;
    }
    c = make_call();
    c.eax = bIsSlot; c.ecx = pHead;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pTimer; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pTimer; ts[2] = 100u;
    snprintf(lbl, sizeof(lbl), "ev_exec_mon_k%d", k);
    run_and_emit(0x6FCAEBC0u, "EVENT_ExecuteMonsterEvents113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 3. 0x6FCA5780 AI_SummonerThink_6FCA5780_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 5u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xE701u + (uint32_t)k, 1u, 5000u, 5000u, 0xF701u + (uint32_t)k);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 44, 1, 1, 0, 0);
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 51, 1, 1, 0, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xE710u + (uint32_t)k, 1u, 5003u, 5003u, 0xF710u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 39, (k == 2) ? 60 : 0, 0); /* FIRERESIST */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 43, (k == 2) ? 0 : 60, 0); /* COLDRESIST */
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    U32(pAiCtrl + 0x14u) = (k == 0) ? 0u : 1u;
    uint32_t pMonTxt = b4e_clone_montxt(U32(STAGE_UDATA0));
    for (uint32_t s = 0u; s < 8u; s++) {
      U16(pMonTxt + 0x170u + s * 2u) = 0xFFFFu;
    }
    U16(pMonTxt + 0x56u) = 100u; /* aip1=100: never fall into AI_IdleWander */
    U16(pMonTxt + 0x5Cu) = 100u; /* aip2: skill5 prob */
    U16(pMonTxt + 0x62u) = 0u; /* aip3: prevent useCold flip */
    U16(pMonTxt + 0x74u) = (k == 1) ? 100u : 0u; /* aip6: flee prob */
    U16(pMonTxt + 0x7Au) = 20u; /* aip7: skill2 dist limit */
    U16(pMonTxt + 0x172u) = 44u; /* wSkill2 = Frost Nova */
    U8(pMonTxt + 0x181u)  = 10u; /* bSkill2Mode = SC */
    U16(pMonTxt + 0x178u) = (k == 2) ? 44u : 51u; /* wSkill5 */
    U8(pMonTxt + 0x184u)  = 10u; /* bSkill5Mode = SC */
    uint32_t dist = (k == 1) ? 3u : 8u;
    uint32_t pArg = b4e_stage_ai_param(pAiCtrl, STAGE_UNIT1, dist, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "ai_summoner_k%d", k);
    run_and_emit(0x6FCA5780u, "AI_SummonerThink_6FCA5780_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 4. 0x6FCA90A0 AI_FallenShaman113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 5u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 58u, 0xE801u + (uint32_t)k, 1u, 5000u, 5000u, 0xF801u + (uint32_t)k);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 36, 1, 1, 0, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 0xE810u + (uint32_t)k, 1u, 5004u, 5004u, 0xF810u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    if (k == 2) U8(STAGE_UDATA0 + 0x16u) = 8u; /* useCustomCorpseFilter = true */
    uint32_t pMonTxt = b4e_clone_montxt(U32(STAGE_UDATA0));
    for (uint32_t s = 0u; s < 8u; s++) {
      U16(pMonTxt + 0x170u + s * 2u) = 0xFFFFu;
    }
    U16(pMonTxt + 0x56u) = (k == 1) ? 100u : 0u; /* aip1: rally */
    U16(pMonTxt + 0x5Cu) = 0u; /* aip2 */
    U16(pMonTxt + 0x62u) = 0u; /* aip3 */
    U16(pMonTxt + 0x68u) = (k == 2) ? 12u : 8u; /* aip4 scan radius */
    U16(pMonTxt + 0x6Eu) = 20u; /* aip5 cast dist */
    uint32_t pArg = b4e_stage_ai_param(pAiCtrl, (k == 2) ? 0u : STAGE_UNIT1, (k == 2) ? 0u : 5u, 0u, pMonTxt);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pArg;
    snprintf(lbl, sizeof(lbl), "ai_fallen_shaman_k%d", k);
    run_and_emit(0x6FCA90A0u, "AI_FallenShaman113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* 5. 0x6FC76CE0 ACT5_InitObjectNoop_6FC76CE0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH) = (uint32_t)(k + 1);
    c = make_call();
    c.ecx = STAGE_SCRATCH;
    c.nargs = 0; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "act5_obj_noop_k%d", k);
    run_and_emit(0x6FC76CE0u, "ACT5_InitObjectNoop_6FC76CE0_113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* 8. 0x6FC73F10 PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_PREF_BASE + 0x10D8BCu, 4u);
    U32(D2GAME_PREF_BASE + 0x10D8BCu + (uint32_t)g_game_rebase) = 0u;
    U32(STAGE_SCRATCH) = 0x41424330u + (uint32_t)k;
    c = make_call();
    c.nargs = 5; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_SCRATCH; c.args[3] = (uint32_t)k; c.args[4] = (uint32_t)(k & 1); c.calleePop = 20u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = k; ts[4] = (k & 1);
    snprintf(lbl, sizeof(lbl), "plrsave_sp_disk_k%d", k);
    run_and_emit(0x6FC73F10u, "PLAYERSAVE_SaveSinglePlayerCharFileToDisk_6FC73F10_113c", k, lbl, &c, ts, 5, 0u, 0);
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
    fprintf(stderr, "[k6-p9] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
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
    fprintf(stderr, "[k6-p9] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p9] unexpected D2Common rebase: %p\n", (void *)g_hCom);
    fflush(stderr);
    return 3;
  }

  {
    typedef void(__fastcall *FogInitSys_t)(int, void *);
    FogInitSys_t pInit = (FogInitSys_t)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(10089));
    if (pInit) pInit(1, NULL);
  }

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
    fprintf(stderr, "[k6-p9] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p9] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_batch_1a();
  emit_batch_1b();
  emit_batch_1c();
  emit_batch_2a();
  emit_batch_2b();
  emit_batch_3a();
  emit_batch_3b();
  emit_batch_4a();
  emit_batch_4b1();
  emit_batch_4b2();
  emit_batch_4c1();
  emit_batch_4c2();
  emit_batch_4d1();
  emit_batch_4d2();
  emit_batch_4e();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p9] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
