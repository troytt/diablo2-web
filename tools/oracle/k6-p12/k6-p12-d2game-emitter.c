/*
 * k6-p12-d2game-emitter.c — [K6-P12] Real-DLL D2Game.dll Parity Emitter (45 Target VAs)
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

#define HASH_VTABLE_ADDR  0x28000000u

#define STAGE_BASE        0x30000000u
#define STAGE_FIXED_SIZE  0x00009000u
#define STAGE_CS_GAME     0x30010000u
#define STAGE_SETUP_BASE  0x30020000u
#define STAGE_TOTAL_SIZE  0x00080000u

#define HEAP_BASE         0x40000000u
#define HEAP_SIZE         0x00200000u

/* Fixed staged object addresses inside 0x30000000..0x30008FFF */
#define STAGE_GAME        (STAGE_BASE + 0x0000u) /* 0x2000: D2GameStrc */
#define STAGE_CLIENT      (STAGE_BASE + 0x2000u) /* 0x0600: D2ClientStrc #0 */
#define STAGE_PKTNODE0    (STAGE_BASE + 0x2600u) /* 0x0210: D2PacketDataStrc #0 */
#define STAGE_PKTNODE1    (STAGE_BASE + 0x2810u) /* 0x0210: D2PacketDataStrc #1 */
#define STAGE_CLIENT1     (STAGE_BASE + 0x2A20u) /* 0x0500: D2ClientStrc #1 */
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
static HMODULE g_hNet   = NULL;
static HMODULE g_hGame  = NULL;
static uintptr_t g_com_rebase  = 0;
static uintptr_t g_game_rebase = 0;

static int g_in_setup_phase = 1;
static uint32_t g_setup_top = STAGE_SETUP_BASE;
static uint32_t g_heap_top  = HEAP_BASE;

typedef struct {
  uint32_t canonAddr;
  uint32_t len;
} ExtraCap;

static ExtraCap g_extra_caps[MAX_EXTRA_CAPS];
static uint32_t g_extra_cap_count = 0u;

static void add_extra_cap(uint32_t canonAddr, uint32_t len) {
  if (g_extra_cap_count < MAX_EXTRA_CAPS && len > 0u) {
    g_extra_caps[g_extra_cap_count].canonAddr = canonAddr;
    g_extra_caps[g_extra_cap_count].len       = len;
    g_extra_cap_count++;
  }
}

static uint32_t g_fake_tick_count  = 0u;
static uint32_t g_fake_qpc_lo      = 0u;
static uint32_t g_fake_qpc_hi      = 0u;
static uint32_t g_d2net_send_ok    = 1u;
static uint32_t g_d2net_client_key = 0u;

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

static uint32_t g_item_sword  = 0;
static uint32_t g_item_jav    = 0;
static uint32_t g_item_armor  = 0;
static uint32_t g_item_gem    = 0;
static uint32_t g_item_malus  = 0;
static uint32_t g_item_scroll = 0;

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
      "testl %eax, -0x1000(%esp)\n\t"
      "testl %eax, -0x2000(%esp)\n\t"
      "testl %eax, -0x2400(%esp)\n\t"
      "leal -0x2400(%esp), %edi\n\t"
      "xorl %eax, %eax\n\t"
      "movl $0x900, %ecx\n\t"
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

static AllocRec g_allocs[2048];
static uint32_t g_alloc_count = 0;

static void record_alloc(uint32_t ptr, uint32_t size) {
  if (g_alloc_count < 2048u) {
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
  uint32_t limit = g_in_setup_phase ? (STAGE_BASE + STAGE_TOTAL_SIZE) : (HEAP_BASE + HEAP_SIZE);
  uint32_t p = (*cur + 3u) & ~3u;
  if (p + sz > limit) {
    fprintf(stderr, "[k6-p12] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
static void __fastcall stub_fog_10050(void *pCs, int line) {
  (void)pCs; (void)line;
}
static uint32_t __stdcall stub_fog_10055(void) {
  return 0u;
}
static void __cdecl stub_fog_10142(void **ppPool, const char *szName, uint32_t nBlockSz, uint32_t nAlign) {
  (void)szName; (void)nBlockSz; (void)nAlign;
  if (ppPool) {
    *ppPool = bump_alloc(0x40u);
  }
}
static uint32_t __cdecl stub_fog_10147(void *pPool) {
  (void)pPool;
  return 0u;
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

static void __stdcall stub_d2net_10000(uint32_t dwClientId) {
  (void)dwClientId;
}
static uint32_t __stdcall stub_d2net_10002(uint32_t nZero, uint32_t dwClientId, void *pBuf, uint32_t nLen) {
  (void)nZero; (void)dwClientId; (void)pBuf;
  return g_d2net_send_ok ? nLen : 0u;
}
static uint32_t __stdcall stub_d2net_10015(uint32_t dwClientId) {
  (void)dwClientId;
  return g_d2net_client_key;
}
static void __stdcall stub_d2net_10021(uint32_t dwClientId, uint32_t dwGameKey) {
  (void)dwClientId;
  g_d2net_client_key = dwGameKey;
}

static void __stdcall stub_InitializeCriticalSection(void *pCs) { (void)pCs; }
static void __stdcall stub_EnterCriticalSection(void *pCs)      { (void)pCs; }
static void __stdcall stub_LeaveCriticalSection(void *pCs)      { (void)pCs; }
static void __stdcall stub_Sleep(DWORD ms)                      { (void)ms; }
static DWORD __stdcall stub_GetTickCount(void)                  { return g_fake_tick_count; }
static void __stdcall stub_GetSystemTimeAsFileTime(FILETIME *lpOut) {
  if (lpOut) {
    lpOut->dwLowDateTime  = 0xD53E8000u;
    lpOut->dwHighDateTime = 0x019DB1DEu;
  }
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
    { 10055u, (void *)(uintptr_t)stub_fog_10055 },
    { 10142u, (void *)(uintptr_t)stub_fog_10142 },
    { 10147u, (void *)(uintptr_t)stub_fog_10147 },
  };
  for (size_t i = 0; i < sizeof(fogHooks) / sizeof(fogHooks[0]); i++) {
    void *orig = (void *)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(fogHooks[i].ord));
    if (!orig) {
      fprintf(stderr, "[k6-p12] missing Fog.#%u\n", fogHooks[i].ord);
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
  struct { uint32_t ord; void *fn; } netHooks[] = {
    { 10000u, (void *)(uintptr_t)stub_d2net_10000 },
    { 10002u, (void *)(uintptr_t)stub_d2net_10002 },
    { 10015u, (void *)(uintptr_t)stub_d2net_10015 },
    { 10021u, (void *)(uintptr_t)stub_d2net_10021 },
  };
  for (size_t i = 0; i < sizeof(netHooks) / sizeof(netHooks[0]); i++) {
    void *orig = (void *)(uintptr_t)GetProcAddress(g_hNet, MAKEINTRESOURCEA(netHooks[i].ord));
    if (orig) {
      hook_module_iat_ptr(g_hGame, orig, netHooks[i].fn);
    }
  }
  HMODULE hK32 = GetModuleHandleA("kernel32.dll");
  if (hK32) {
    struct { const char *name; void *fn; int alsoCom; } k32Hooks[] = {
      { "GetTickCount",              (void *)(uintptr_t)stub_GetTickCount,              1 },
      { "GetSystemTimeAsFileTime",   (void *)(uintptr_t)stub_GetSystemTimeAsFileTime,   1 },
      { "QueryPerformanceCounter",   (void *)(uintptr_t)stub_QueryPerformanceCounter,   1 },
      { "InitializeCriticalSection", (void *)(uintptr_t)stub_InitializeCriticalSection, 0 },
      { "EnterCriticalSection",      (void *)(uintptr_t)stub_EnterCriticalSection,      0 },
      { "LeaveCriticalSection",      (void *)(uintptr_t)stub_LeaveCriticalSection,      0 },
      { "Sleep",                     (void *)(uintptr_t)stub_Sleep,                     0 },
    };
    for (size_t i = 0; i < sizeof(k32Hooks) / sizeof(k32Hooks[0]); i++) {
      void *orig = (void *)(uintptr_t)GetProcAddress(hK32, k32Hooks[i].name);
      if (orig) {
        if (k32Hooks[i].alsoCom) hook_module_iat_ptr(g_hCom, orig, k32Hooks[i].fn);
        hook_module_iat_ptr(g_hGame, orig, k32Hooks[i].fn);
      }
    }
  }
}

/* ------------------------------- PAGEIMG Loader */

static void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-p12] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p12] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_PREF_BASE + 0x99000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p12] short read at page %u\n", i);
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

static char g_pre_json[524288];

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
        fprintf(stderr, "[k6-p12] stage json overflow\n");
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
    uint32_t cAddr = g_extra_caps[i].canonAddr;
    uint32_t delta = (cAddr >= D2COM_PREF_BASE) ? (uint32_t)g_com_rebase : (uint32_t)g_game_rebase;
    uint32_t liveAddr = cAddr + delta;
    format_mem_runs_range(out, cap, &len, liveAddr, liveAddr + g_extra_caps[i].len, &first, delta);
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
  g_in_setup_phase   = 1;
  g_setup_top        = STAGE_SETUP_BASE;
  g_heap_top         = HEAP_BASE;
  g_alloc_count      = 0u;
  g_extra_cap_count  = 0u;
  g_fake_tick_count  = 0u;
  g_fake_qpc_lo      = 0u;
  g_fake_qpc_hi      = 0u;
  g_d2net_send_ok    = 1u;
  g_d2net_client_key = 0u;

  /* Reset mutable D2Game globals between cases */
  U32(game_global_live(D2GAME_PREF_BASE + 0x10E360u)) = 0u; /* 0x6FD2E360 gdwTicksPerSecond */
  U32(game_global_live(D2GAME_PREF_BASE + 0x111C1Cu)) = 0u; /* 0x6FD31C1C */
  U32(game_global_live(D2GAME_PREF_BASE + 0x111C20u)) = 0u; /* 0x6FD31C20 */
  U32(game_global_live(D2GAME_PREF_BASE + 0x111C34u)) = 0u; /* 0x6FD31C34 peakMempoolKB */
  U32(game_global_live(D2GAME_PREF_BASE + 0x111F88u)) = 0u; /* 0x6FD31F88 peakMempoolTick */
  U32(game_global_live(D2GAME_PREF_BASE + 0x111F90u)) = 0u; /* 0x6FD31F90 */
  U32(game_global_live(D2GAME_PREF_BASE + 0x111F94u)) = 0u; /* 0x6FD31F94 gdwGoldClassId */
  U8(game_global_live(D2GAME_PREF_BASE + 0x111F98u))  = 0u; /* 0x6FD31F98 */

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

static void stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  uint32_t actNo = (levelId >= 109u) ? 4u : (levelId >= 103u) ? 3u : (levelId >= 75u) ? 2u : (levelId >= 40u) ? 1u : 0u;
  U32(pAct + 0x08u)         = actNo;
  U32(pAct + 0x10u)         = pRoom;
  U32(pAct + 0x48u)         = STAGE_DRLG0;
  U32(STAGE_DRLG0 + 0x47Cu) = pLevel;
  U32(STAGE_GAME + 0xBCu + actNo * 4u) = pAct;
  if (U32(STAGE_GAME + 0xBCu) == 0u) {
    U32(STAGE_GAME + 0xBCu) = pAct;
  }
  U32(pRoom + 0x10u)    = pRoomEx;
  U32(pRoom + 0x2Cu)    = pAct;
  U32(pRoom + 0x4Cu)    = 4800u;
  U32(pRoom + 0x50u)    = 4800u;
  U32(pRoom + 0x54u)    = 1000u;
  U32(pRoom + 0x58u)    = 1000u;
  U32(pRoom + 0x5Cu)    = 960u;
  U32(pRoom + 0x60u)    = 960u;
  U32(pRoom + 0x64u)    = 200u;
  U32(pRoom + 0x68u)    = 200u;
  U32(pRoom + 0x6Cu)    = 0x2468ACE1u;
  U32(pRoom + 0x70u)    = 0x0000029Au;
  U32(pRoomEx + 0x30u)  = pRoom;
  U32(pRoomEx + 0x58u)  = pLevel;
  U32(pLevel + 0x1B4u)  = STAGE_DRLG0;
  U32(pLevel + 0x1D0u)  = levelId;
}

static void stage_room_logical_info(uint32_t pRoomEx) {
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

static void stage_room_with_coll(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  stage_room(pRoom, pRoomEx, pLevel, levelId);
  stage_room_logical_info(pRoomEx);
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

static void stage_room_link_unit(uint32_t pRoom, uint32_t pUnit) {
  uint32_t prev = U32(pRoom + 0x74u);
  U32(pUnit + 0xE8u) = prev;
  U32(pRoom + 0x74u) = pUnit;
}

static uint32_t stage_timer_with_chunk(uint32_t pGame, uint32_t markExhausted) {
  uint32_t pTimer = (uint32_t)(uintptr_t)bump_alloc(0xA20u);
  uint32_t pChunk = (uint32_t)(uintptr_t)bump_alloc(0x7088u);
  U32(pGame + 0x0B8u)  = pTimer;
  U32(pTimer + 0xA1Cu) = pChunk;
  if (!markExhausted) {
    U32(pChunk + 0x7080u) = pChunk;
    for (uint32_t i = 0; i + 1u < 0x258u; i++) {
      U32(pChunk + i * 0x30u + 0x1Cu) = pChunk + (i + 1u) * 0x30u;
    }
  }
  return pTimer;
}

static uint32_t pop_timer_free_node(uint32_t pTimer) {
  uint32_t pChunk = U32(pTimer + 0xA1Cu);
  uint32_t node   = U32(pChunk + 0x7080u);
  U32(pChunk + 0x7080u) = U32(node + 0x1Cu);
  U32(node + 0x1Cu) = 0u;
  return node;
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
    uint32_t classId, uint32_t guid, uint32_t mode, uint32_t quality,
    uint16_t x, uint16_t y, uint32_t seedLo) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 4u, classId, guid, mode, x, y, seedLo);
  if (pUData != 0u) {
    U32(pUData + 0x00u) = quality;
    U32(pUData + 0x04u) = seedLo ? seedLo : 0x12345679u;
    U32(pUData + 0x08u) = 0x0000029Au;
    U32(pUData + 0x0Cu) = seedLo ? seedLo : 0x12345679u;
    U32(pUData + 0x10u) = 0xFFFFFFFFu;
    U32(pUData + 0x14u) = 0x00000010u; /* IFLAG_IDENTIFIED */
    U32(pUData + 0x2Cu) = 12u;
    U16(pUData + 0x30u) = 100u;
    U8(pUData + 0x45u)  = 0xFFu;
  }
}

static uint32_t alloc_quest_record(void) {
  uint32_t pRec = (uint32_t)(uintptr_t)bump_alloc(0x14u);
  uint32_t pBuf = (uint32_t)(uintptr_t)bump_alloc(0x60u);
  U32(pRec + 0x00u) = pBuf;
  U32(pRec + 0x04u) = 0x300u;
  return pRec;
}

static void stage_player_full(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint32_t mode,
    uint16_t x, uint16_t y, uint32_t pClient) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 0u, classId, guid, mode, x, y, 0x13572469u);
  if (pUData != 0u) {
    U32(pUData + 0x00u) = 0x6F726548u;
    U32(pUData + 0x10u) = alloc_quest_record();
    U32(pUData + 0x14u) = alloc_quest_record();
    U32(pUData + 0x18u) = alloc_quest_record();
    for (uint32_t d = 0u; d < 3u; d++) {
      uint32_t pPair = (uint32_t)(uintptr_t)bump_alloc(8u);
      uint32_t pHold = (uint32_t)(uintptr_t)bump_alloc(0x14u);
      uint32_t pBits = (uint32_t)(uintptr_t)bump_alloc(8u);
      U32(pHold + 0x00u) = pBits;
      U32(pHold + 0x04u) = 0x40u;
      U32(pPair + 0x00u) = pHold;
      U32(pUData + 0x60u + d * 4u) = pPair;
    }
    U32(pUData + 0x9Cu) = pClient;
  }
  if (pClient != 0u) {
    U32(pClient + 0x00u)  = 1u;
    U32(pClient + 0x04u)  = 4u;
    U32(pClient + 0x16Cu) = 0u;
    U32(pClient + 0x170u) = guid;
    U32(pClient + 0x174u) = pUnit;
    U32(pClient + 0x1A8u) = STAGE_GAME;
    U8(pClient + 0x1ACu)  = 0u;
    U32(pClient + 0x1B4u) = pRoom;
  }
}

static void set_quest_bit(uint32_t pRec, uint32_t qId, uint32_t subBit) {
  uint32_t pBuf = U32(pRec);
  uint32_t bitIdx = (qId << 4) + subBit;
  U8(pBuf + (bitIdx >> 3)) = (uint8_t)(U8(pBuf + (bitIdx >> 3)) | (1u << (bitIdx & 7u)));
}

static void stage_quest_node(uint32_t pQuest, uint32_t qId, uint32_t pQuestEx, uint32_t pPrev) {
  uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(0x800u);
  uint32_t pGFlags  = (uint32_t)(uintptr_t)bump_alloc(0x80u);
  U32(pGFlags + 0x00u) = pGFlags + 0x10u;
  U32(pGFlags + 0x04u) = 0x300u;
  U32(pQuest + 0x00u)  = qId;
  U32(pQuest + 0x04u)  = STAGE_GAME;
  U32(pQuest + 0x18u)  = pQuestEx;
  U32(pQuest + 0xDCu)  = pMsgTbls;
  U32(pQuest + 0xE0u)  = qId;
  U32(pQuest + 0xF4u)  = pPrev;
  U32(STAGE_QUESTCTRL + 0x00u) = pQuest;
  U32(STAGE_QUESTCTRL + 0x08u) = 1u;
  U32(STAGE_QUESTCTRL + 0x0Cu) = pGFlags;
  U32(STAGE_QUESTCTRL + 0x18u) = 0x12345679u;
  U32(STAGE_QUESTCTRL + 0x1Cu) = 0x0000029Au;
  U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
}

static void stage_mon_reg(uint32_t lvlId) {
  if (lvlId < 140u && U32(STAGE_GAME + 0xF0u + lvlId * 4u) == 0u) {
    uint32_t pReg = (uint32_t)(uintptr_t)bump_alloc(0x300u);
    U8(pReg + 0x00u) = 1u;
    U8(pReg + 0x01u) = 5u;
    U32(STAGE_GAME + 0xF0u + lvlId * 4u) = pReg;
    if (lvlId != 0u && U32(STAGE_GAME + 0xF0u) == 0u) {
      U32(STAGE_GAME + 0xF0u) = pReg;
    }
  }
}

static void stage_obj_ctrl(uint32_t lvlId) {
  uint32_t pObjCtrl = U32(STAGE_GAME + 0x10F0u);
  if (pObjCtrl == 0u) {
    pObjCtrl = (uint32_t)(uintptr_t)bump_alloc(0x1120u);
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

static __attribute__((unused)) void stage_npc_ctrl(void) {
  if (U32(STAGE_GAME + 0x1D24u) != 0u) return;
  uint32_t pNpcCtrl = (uint32_t)(uintptr_t)bump_alloc(0x20u);
  uint32_t pEntries = (uint32_t)(uintptr_t)bump_alloc(0x44u * 0x40u);
  for (uint32_t i = 0u; i < 0x40u; i++) {
    U32(pEntries + i * 0x44u) = 0xFFFFFFFFu;
  }
  static const uint32_t kNpcs[] = { 0x1FFu, 0x200u, 0x201u, 0x202u, 0x203u, 0x1DAu, 0x1DBu, 0x1DCu, 0x92u, 0x94u, 0x9Au, 0x10Au };
  for (uint32_t i = 0u; i < (uint32_t)(sizeof(kNpcs) / sizeof(kNpcs[0])); i++) {
    U32(pEntries + i * 0x44u) = kNpcs[i];
  }
  U32(pNpcCtrl + 0x00u) = 0u;
  U32(pNpcCtrl + 0x04u) = pEntries;
  U32(STAGE_GAME + 0x1D24u) = pNpcCtrl;
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
static uint32_t      g_obj_trap = 0;

static void discover_table_ids(void) {
  reset_case();
  uint32_t nItems = U32(D2COM_PREF_BASE + 0x9FB94u + g_com_rebase);
  uint32_t pItems = U32(D2COM_PREF_BASE + 0x9FB98u + g_com_rebase);
  int32_t  nLink  = 0;
  for (uint32_t id = 0; id < nItems; id++) {
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    if (!g_item_sword  && code == 0x20647373u) g_item_sword  = id; /* 'ssd ' */
    if (!g_item_jav    && code == 0x2076616Au) g_item_jav    = id; /* 'jav ' */
    if (!g_item_armor  && code == 0x20706163u) g_item_armor  = id; /* 'cap ' */
    if (!g_item_gem    && code == 0x20766367u) g_item_gem    = id; /* 'gcv ' */
    if (!g_item_malus  && code == 0x206D6468u) g_item_malus  = id; /* 'hdm ' */
    if (!g_item_scroll && code == 0x20736B62u) g_item_scroll = id; /* 'bks ' */
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
  g_items_txtlink.dwPad    = 0;
  g_items_txtlink.pNodes   = g_items_txtlink_nodes;
  U32(D2COM_PREF_BASE + 0x9FF6Cu + g_com_rebase) = (uint32_t)(uintptr_t)&g_items_txtlink;

  uint32_t pObjectsBase = U32(D2COM_PREF_BASE + 0xA0B94u + g_com_rebase);
  uint32_t nObjectsCnt  = U32(D2COM_PREF_BASE + 0xA0B98u + g_com_rebase);
  for (uint32_t oid = 0; oid < nObjectsCnt; oid++) {
    uint32_t rng = U32(pObjectsBase + oid * 0x1C0u + 0x178u);
    if (rng >= 5u && rng <= 30u) {
      g_obj_trap = oid;
      break;
    }
  }
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
  if (delta == 0u) return;
  for (uint32_t a = startAddr; a + 4u <= endAddr; a += 4u) {
    uint32_t v = U32(a);
    if (v >= lo && v < hi && (v - lo) >= 0x1000u) {
      U32(a) = v - delta;
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
  static char postJson[524288];
  static const char hexChars[] = "0123456789abcdef";

  uint32_t setupTop = (g_setup_top + 15u) & ~15u;
  capture_stage_json(g_pre_json, sizeof(g_pre_json), setupTop);

  g_in_setup_phase = 0;
  g_heap_top = HEAP_BASE;

  if (canonVa >= D2COM_PREF_BASE) {
    g_thunk_target = (uint32_t)((canonVa - D2COM_PREF_BASE) + (uintptr_t)g_hCom);
  } else {
    g_thunk_target = (uint32_t)((canonVa - D2GAME_PREF_BASE) + (uintptr_t)g_hGame);
  }
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
            "[k6-p12] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-p12] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-p12] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-p12] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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

/* ------------------------------- Cluster 1: 6 Summon VAs */

static void emit_cluster1_summon(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* C1-1. 0x6FC63D40 SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c (ecx=pGame, edx=pUnit, s=[sk,lvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x1001u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = 5004u;
    U16(STAGE_PATH0 + 0x12u) = 5004u;
    int32_t sk = (k == 0) ? -1 : ((k == 1) ? 262 : 271);
    uint32_t lvl = (uint32_t)(2 + k * 2);
    if (sk > 0) {
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, sk, (int32_t)lvl, 0, 0, 0);
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "summon3traps_k%d", k);
    run_and_emit(0x6FC63D40u, "SKILLS_SrvDo_Summon3TrapsInTriangle_6FC63D40_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* C1-2. 0x6FC66560 SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c (ecx=pGame, edx=pUnit, s=[sk,lvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x1011u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = 5003u;
    U16(STAGE_PATH0 + 0x12u) = 5003u;
    int32_t sk = (k == 0) ? -1 : ((k == 1) ? 221 : 227);
    uint32_t lvl = (uint32_t)(1 + k * 2);
    if (sk > 0) {
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, sk, (int32_t)lvl, 0, 0, 0);
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "summon_pet_k%d", k);
    run_and_emit(0x6FC66560u, "SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* C1-3. 0x6FC66720 SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c (ecx=pGame, edx=pUnit, s=[sk,lvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x1021u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT0);
    int32_t sk = (k == 0) ? -1 : ((k == 1) ? 226 : 236);
    uint32_t lvl = (uint32_t)(1 + k * 2);
    if (sk > 0) {
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, sk, (int32_t)lvl, 0, 0, 0);
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "summon_spirit_k%d", k);
    run_and_emit(0x6FC66720u, "SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* C1-4. 0x6FC668A0 SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c (ecx=pGame, edx=pUnit, s=[sk,lvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x1031u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT0);
    int32_t sk = (k == 0) ? -1 : ((k == 1) ? 222 : 231);
    uint32_t lvl = (uint32_t)(1 + k * 2);
    if (sk > 0) {
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, sk, (int32_t)lvl, 0, 0, 0);
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "summon_vine_k%d", k);
    run_and_emit(0x6FC668A0u, "SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* C1-5. 0x6FC6D710 SKILLS_SrvDo_SummonDecoy_6FC6D710_113c (ecx=pGame, edx=pUnit, s=[sk,lvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x1041u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT0);
    int32_t sk = (k == 0) ? -1 : 28;
    uint32_t lvl = (k == 2) ? 6u : 2u;
    if (sk > 0) {
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, sk, (int32_t)lvl, 0, 0, 0);
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "summon_decoy_k%d", k);
    run_and_emit(0x6FC6D710u, "SKILLS_SrvDo_SummonDecoy_6FC6D710_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* C1-6. 0x6FC70E60 SKILLS_SpawnBoneWallSegment_6FC70E60_113c (eax=nSkillId, ecx=x, s=[pGame,pUnit,y,lvl], ret 16) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x1051u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t sk = (k == 0) ? 0u : 78u;
    uint32_t x  = 5004u + (uint32_t)k;
    uint32_t y  = 5004u + (uint32_t)k;
    uint32_t lvl = (k == 2) ? 6u : 3u;
    if (sk > 0u) {
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, (int32_t)sk, (int32_t)lvl, 0, 0, 0);
    }
    c = make_call();
    c.eax = sk; c.ecx = x;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = y; c.args[3] = lvl;
    c.calleePop = 16u;
    ts[0] = (int64_t)sk; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = (int64_t)x; ts[4] = (int64_t)y; ts[5] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "spawn_bwall_seg_k%d", k);
    run_and_emit(0x6FC70E60u, "SKILLS_SpawnBoneWallSegment_6FC70E60_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Cluster 2: 12 Quest Callback03_LevelChanged VAs */

typedef struct {
  uint32_t va;
  const char *name;
  uint32_t qId;
  uint32_t lvlA;
  uint32_t lvlB;
  uint8_t  initState;
} QuestCb03Spec;

static void emit_cluster2_quest_cb03(void) {
  static const QuestCb03Spec specs[12] = {
    { 0x6FC7A9B0u, "ACT4Q1_Callback03_LevelChanged113c",          0x28u, 0x6Du, 0x83u, 2u },
    { 0x6FC7AB60u, "ACT4Q2_Callback03_LevelChanged113c",          0x27u, 0x6Du, 0x78u, 2u },
    { 0x6FC7AD50u, "ACT4Q3_Callback03_LevelChanged113c",          0x26u, 0x6Du, 0x72u, 2u },
    { 0x6FC7B1E0u, "ACT4Q1_Callback03_AltLevelChanged113c",       0x24u, 0x6Fu, 0x70u, 2u },
    { 0x6FC7B380u, "ACT4Q2_Callback03_AltLevelChanged113c",       0x25u, 0x6Eu, 0x6Fu, 2u },
    { 0x6FC7F3F0u, "ACT4Q2_Hellforge_Callback03_LevelChanged113c",0x24u, 0x6Du, 0x70u, 2u },
    { 0x6FC83DD0u, "ACT1Q1_Callback03_LevelChanged113c",          0x06u, 0x22u, 0x25u, 2u },
    { 0x6FC842D0u, "ACT1Q2_Callback03_LevelChanged113c",          0x04u, 0x14u, 0x04u, 2u },
    { 0x6FC84D30u, "ACT1Q4_Callback03_LevelChanged113c",          0x05u, 0x18u, 0x19u, 2u },
    { 0x6FC84ED0u, "ACT1Q5_Callback03_LevelChanged113c",          0x02u, 0x11u, 0x03u, 2u },
    { 0x6FC85040u, "ACT1Q6_Callback03_LevelChanged113c",          0x01u, 0x08u, 0x02u, 1u },
    { 0x6FC884B0u, "ACT1Q3_Callback03_LevelChanged113c",          0x03u, 0x26u, 0x28u, 6u },
  };
  X86CallSpec c;
  int64_t ts[4];
  char lbl[64];

  for (size_t i = 0; i < 12; i++) {
    const QuestCb03Spec *sp = &specs[i];
    for (int k = 0; k < 3; k++) {
      reset_case();
      uint32_t actLvl = (sp->qId >= 0x20u) ? 0x6Du : 1u;
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, actLvl);
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x2001u + (uint32_t)i * 4u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      uint32_t pPrevQ = 0u;
      if (sp->qId != 0x24u && sp->qId >= 0x20u) {
        pPrevQ = (uint32_t)(uintptr_t)bump_alloc(0x100u);
        uint32_t pPrevEx = (uint32_t)(uintptr_t)bump_alloc(0x100u);
        U32(pPrevQ + 0x00u) = 0x24u;
        U32(pPrevQ + 0x04u) = STAGE_GAME;
        U32(pPrevQ + 0x18u) = pPrevEx;
        U32(pPrevQ + 0xDCu) = (uint32_t)(uintptr_t)bump_alloc(0x800u);
        U32(pPrevQ + 0xE0u) = 0x24u;
      }
      stage_quest_node(STAGE_QUEST0, sp->qId, STAGE_QUESTEX0, pPrevQ);
      U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 0u : 1u;
      U8(STAGE_QUEST0 + 0x0Bu) = 0u;
      U8(STAGE_QUEST0 + 0x0Cu) = sp->initState;
      if (k == 2) {
        U16(STAGE_QUEST0 + 0x9Cu) = 1u;
        U32(STAGE_QUEST0 + 0x1Cu) = U32(STAGE_UNIT0 + 0x0Cu);
        U8(STAGE_QUEST0 + 0x0Cu)  = (uint8_t)(sp->initState + 1u);
      }
      U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
      U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
      if (k == 0) {
        U32(STAGE_SCRATCH + 0x14u) = 1u;
        U32(STAGE_SCRATCH + 0x18u) = 1u;
      } else if (k == 1) {
        U32(STAGE_SCRATCH + 0x14u) = actLvl;
        U32(STAGE_SCRATCH + 0x18u) = sp->lvlA;
      } else {
        U32(STAGE_SCRATCH + 0x14u) = sp->lvlA;
        U32(STAGE_SCRATCH + 0x18u) = sp->lvlB;
      }
      c = make_call();
      c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
      ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
      snprintf(lbl, sizeof(lbl), "q%u_cb03_k%d", sp->qId, k);
      run_and_emit(sp->va, sp->name, k, lbl, &c, ts, 2u, 0u, 0);
    }
  }
}

/* ------------------------------- Cluster 3: 4 EVENT_Execute*Events113c VAs */

static void emit_cluster3_events(void) {
  X86CallSpec c;
  int64_t ts[4];
  char lbl[64];

  /* C3-1. 0x6FCAE9A0 EVENT_ExecuteMissileEvents113c (eax=bIsSlot, ecx=pHead, ebx=pTimer, s=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pTimer = stage_timer_with_chunk(STAGE_GAME, 0u);
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, 0u, STAGE_PATH0, STAGE_ROOM0, 3u, 1u, 0x3001u + (uint32_t)k, 0u, 5000u, 5000u, 0u);
    uint32_t bIsSlot = 0u;
    uint32_t pHead = 0u;
    if (k == 1) {
      uint32_t ev = pop_timer_free_node(pTimer);
      U8(ev + 0x00u)  = 1u;
      U16(ev + 0x02u) = 0x0008u;
      U32(ev + 0x04u) = 0xFFFFFFFFu;
      U32(ev + 0x08u) = STAGE_UNIT0;
      U32(ev + 0x0Cu) = 0x3001u + (uint32_t)k;
      U32(ev + 0x10u) = 1u;
      U32(ev + 0x2Cu) = game_global_live(D2GAME_PREF_BASE + 0xE0410u); /* 0x6FD00410 */
      U32(STAGE_UNIT0 + 0xDCu) = ev;
      U32(pTimer + 0xA0Cu) = ev; /* pPersistentHead[2] */
      bIsSlot = 0u; pHead = ev;
    } else if (k == 2) {
      uint32_t ev = pop_timer_free_node(pTimer);
      U8(ev + 0x00u)  = 1u;
      U16(ev + 0x02u) = 0u;
      U32(ev + 0x04u) = 100u;
      U32(ev + 0x08u) = STAGE_UNIT0;
      U32(ev + 0x0Cu) = 0x3001u + (uint32_t)k;
      U32(ev + 0x10u) = 1u;
      U32(ev + 0x2Cu) = game_global_live(D2GAME_PREF_BASE + 0xE0410u);
      U32(STAGE_UNIT0 + 0xDCu) = ev;
      uint32_t slot = 128u + (100u & 63u);
      U32(pTimer + 0x004u + slot * 4u) = ev;
      U32(pTimer + 0x504u + slot * 4u) = ev;
      bIsSlot = 1u; pHead = ev;
    }
    c = make_call();
    c.eax = bIsSlot; c.ecx = pHead; c.ebx = pTimer;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pTimer; ts[2] = 100u;
    snprintf(lbl, sizeof(lbl), "ev_exec_msl_k%d", k);
    run_and_emit(0x6FCAE9A0u, "EVENT_ExecuteMissileEvents113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* C3-2. 0x6FCAECC0 EVENT_ExecutePlayerEvents113c (eax=bIsSlot, ecx=pHead, ebx=pTimer, s=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pTimer = stage_timer_with_chunk(STAGE_GAME, 0u);
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x3011u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t bIsSlot = 0u;
    uint32_t pHead = 0u;
    if (k == 1) {
      uint32_t ev = pop_timer_free_node(pTimer);
      U8(ev + 0x00u)  = 3u;
      U16(ev + 0x02u) = 0x0008u;
      U32(ev + 0x04u) = 0xFFFFFFFFu;
      U32(ev + 0x08u) = STAGE_UNIT0;
      U32(ev + 0x0Cu) = 0x3011u + (uint32_t)k;
      U32(ev + 0x10u) = 1u;
      U32(ev + 0x2Cu) = game_global_live(D2GAME_PREF_BASE + 0xE0410u);
      U32(STAGE_UNIT0 + 0xDCu) = ev;
      U32(pTimer + 0xA04u) = ev; /* pPersistentHead[0] */
      bIsSlot = 0u; pHead = ev;
    } else if (k == 2) {
      uint32_t ev = pop_timer_free_node(pTimer);
      U8(ev + 0x00u)  = 3u;
      U16(ev + 0x02u) = 0u;
      U32(ev + 0x04u) = 100u;
      U32(ev + 0x08u) = STAGE_UNIT0;
      U32(ev + 0x0Cu) = 0x3011u + (uint32_t)k;
      U32(ev + 0x10u) = 1u;
      U32(ev + 0x2Cu) = game_global_live(D2GAME_PREF_BASE + 0xE0410u);
      U32(STAGE_UNIT0 + 0xDCu) = ev;
      uint32_t slot = 100u & 63u;
      U32(pTimer + 0x004u + slot * 4u) = ev;
      U32(pTimer + 0x504u + slot * 4u) = ev;
      bIsSlot = 1u; pHead = ev;
    }
    c = make_call();
    c.eax = bIsSlot; c.ecx = pHead; c.ebx = pTimer;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pTimer; ts[2] = 100u;
    snprintf(lbl, sizeof(lbl), "ev_exec_plr_k%d", k);
    run_and_emit(0x6FCAECC0u, "EVENT_ExecutePlayerEvents113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* C3-3. 0x6FCAEDD0 EVENT_ExecuteItemEvents113c (eax=bIsSlot, ecx=pHead, s=[pGame,pTimer], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pTimer = stage_timer_with_chunk(STAGE_GAME, 0u);
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 0x3021u + (uint32_t)k, 3u, 2u, 5000u, 5000u, 0u);
    uint32_t bIsSlot = 0u;
    uint32_t pHead = 0u;
    if (k == 1) {
      uint32_t ev = pop_timer_free_node(pTimer);
      U8(ev + 0x00u)  = 4u;
      U16(ev + 0x02u) = 0x0008u;
      U32(ev + 0x04u) = 0xFFFFFFFFu;
      U32(ev + 0x08u) = STAGE_UNIT0;
      U32(ev + 0x0Cu) = 0x3021u + (uint32_t)k;
      U32(ev + 0x10u) = 1u;
      U32(ev + 0x2Cu) = game_global_live(D2GAME_PREF_BASE + 0xE0410u);
      U32(STAGE_UNIT0 + 0xDCu) = ev;
      U32(pTimer + 0xA14u) = ev; /* pPersistentHead[4] */
      bIsSlot = 0u; pHead = ev;
    } else if (k == 2) {
      uint32_t ev = pop_timer_free_node(pTimer);
      U8(ev + 0x00u)  = 4u;
      U16(ev + 0x02u) = 0u;
      U32(ev + 0x04u) = 100u;
      U32(ev + 0x08u) = STAGE_UNIT0;
      U32(ev + 0x0Cu) = 0x3021u + (uint32_t)k;
      U32(ev + 0x10u) = 1u;
      U32(ev + 0x2Cu) = 0u;
      U32(STAGE_UNIT0 + 0xDCu) = ev;
      uint32_t slot = 256u + (100u & 63u);
      U32(pTimer + 0x004u + slot * 4u) = ev;
      U32(pTimer + 0x504u + slot * 4u) = ev;
      bIsSlot = 1u; pHead = ev;
    }
    c = make_call();
    c.eax = bIsSlot; c.ecx = pHead;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pTimer; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pTimer; ts[2] = 100u;
    snprintf(lbl, sizeof(lbl), "ev_exec_itm_k%d", k);
    run_and_emit(0x6FCAEDD0u, "EVENT_ExecuteItemEvents113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* C3-4. 0x6FCAEF20 EVENT_ExecuteObjectEvents113c (eax=bIsSlot, ecx=pHead, s=[pGame,pTimer], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pTimer = stage_timer_with_chunk(STAGE_GAME, 0u);
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 0x3031u + (uint32_t)k, 0u, 5000u, 5000u, 0u);
    uint32_t bIsSlot = 0u;
    uint32_t pHead = 0u;
    if (k == 1) {
      uint32_t ev = pop_timer_free_node(pTimer);
      U8(ev + 0x00u)  = 5u;
      U16(ev + 0x02u) = 0x0008u;
      U32(ev + 0x04u) = 0xFFFFFFFFu;
      U32(ev + 0x08u) = STAGE_UNIT0;
      U32(ev + 0x0Cu) = 0x3031u + (uint32_t)k;
      U32(ev + 0x10u) = 1u;
      U32(ev + 0x2Cu) = game_global_live(D2GAME_PREF_BASE + 0xE0410u);
      U32(STAGE_UNIT0 + 0xDCu) = ev;
      U32(pTimer + 0xA10u) = ev; /* pPersistentHead[3] */
      bIsSlot = 0u; pHead = ev;
    } else if (k == 2) {
      uint32_t ev = pop_timer_free_node(pTimer);
      U8(ev + 0x00u)  = 5u;
      U16(ev + 0x02u) = 0u;
      U32(ev + 0x04u) = 100u;
      U32(ev + 0x08u) = STAGE_UNIT0;
      U32(ev + 0x0Cu) = 0x3031u + (uint32_t)k;
      U32(ev + 0x10u) = 1u;
      U32(ev + 0x2Cu) = 0u;
      U32(STAGE_UNIT0 + 0xDCu) = ev;
      uint32_t slot = 192u + (100u & 63u);
      U32(pTimer + 0x004u + slot * 4u) = ev;
      U32(pTimer + 0x504u + slot * 4u) = ev;
      bIsSlot = 1u; pHead = ev;
    }
    c = make_call();
    c.eax = bIsSlot; c.ecx = pHead;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pTimer; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pTimer; ts[2] = 100u;
    snprintf(lbl, sizeof(lbl), "ev_exec_obj_k%d", k);
    run_and_emit(0x6FCAEF20u, "EVENT_ExecuteObjectEvents113c", k, lbl, &c, ts, 3u, 0u, 0);
  }
}

/* ------------------------------- Cluster 4 Part 1 (12 VAs) */

static void emit_cluster4_part1(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* 1. 0x6FC2BD10 OBJECT_CheckRespawnOrPortalInRoom113c (ecx=pArgs, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_obj_ctrl(k == 1 ? 1u : 2u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1) ? 1u : 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 0x4001u + (uint32_t)k, 0u, 5000u, 5000u, 0u);
    if (k == 2) {
      uint32_t pObjCtrl = U32(STAGE_GAME + 0x10F0u);
      uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pNode + 0x00u) = STAGE_ROOM0;
      U32(pNode + 0x04u) = 5000u;
      U32(pNode + 0x08u) = 5000u;
      U32(pNode + 0x0Cu) = 0u;
      U32(pObjCtrl + 0x1110u) = pNode;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    c = make_call();
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "obj_chk_respawn_k%d", k);
    run_and_emit(0x6FC2BD10u, "OBJECT_CheckRespawnOrPortalInRoom113c", k, lbl, &c, ts, 1u, 0u, 0);
  }

  /* 2. 0x6FC3EF50 MONSTER_PackPresetSaveData113c (edi=pUnit, s=[pDstCmd,pSaveHeader], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2) ? 0x137u : 1u, 0x4011u + (uint32_t)k, 1u, 5000u, 5000u, 0x1111u);
    uint32_t pAiGen  = U32(STAGE_UDATA0 + 0x28u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pCmd0 = (uint32_t)(uintptr_t)bump_alloc(0x28u);
    U32(pCmd0 + 0x00u) = pCmd0;
    U32(pCmd0 + 0x04u) = pCmd0;
    U32(pCmd0 + 0x08u) = (k == 0) ? 1u : 3u;
    U32(pCmd0 + 0x0Cu) = 10u + (uint32_t)k;
    U32(pCmd0 + 0x10u) = 5005u;
    U32(pCmd0 + 0x14u) = 5006u;
    U32(pAiGen + 0x00u) = 1u;
    U32(pAiGen + 0x08u) = (k == 2) ? 0u : pCmd0;
    U32(pAiCtrl + 0x08u) = pCmd0;
    uint32_t pDstCmd = STAGE_SCRATCH;
    uint32_t pSaveHdr = STAGE_SCRATCH + 0x200u;
    c = make_call();
    c.edi = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = pDstCmd; c.args[1] = pSaveHdr; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = pDstCmd; ts[2] = pSaveHdr;
    snprintf(lbl, sizeof(lbl), "mon_pack_save_k%d", k);
    run_and_emit(0x6FC3EF50u, "MONSTER_PackPresetSaveData113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* 3. 0x6FC49BE0 GAME_UpdateTickRateMetrics113c (esi=pGame, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_PREF_BASE + 0x10E360u, 4u);
    add_extra_cap(D2GAME_PREF_BASE + 0x111C34u, 4u);
    add_extra_cap(D2GAME_PREF_BASE + 0x111F88u, 4u);
    if (k == 0) {
      g_fake_tick_count = 1500u;
      U32(STAGE_GAME + 0xB4u) = 1000u;
      U32(STAGE_GAME + 0xB0u) = 12u;
    } else if (k == 1) {
      g_fake_tick_count = 5000u;
      U32(STAGE_GAME + 0xB4u) = 2000u;
      U32(STAGE_GAME + 0xB0u) = 60u;
    } else {
      g_fake_tick_count = 20000u;
      U32(STAGE_GAME + 0xB4u) = 10000u;
      U32(STAGE_GAME + 0xB0u) = 250u;
    }
    c = make_call();
    c.esi = STAGE_GAME;
    ts[0] = STAGE_GAME; ts[1] = (int64_t)g_fake_tick_count;
    snprintf(lbl, sizeof(lbl), "tick_rate_k%d", k);
    run_and_emit(0x6FC49BE0u, "GAME_UpdateTickRateMetrics113c", k, lbl, &c, ts, 2u, 0u, 0);
  }

  /* 4. 0x6FC4E750 OBJECT_SetAnimMode2Wrapper113c (ecx=pObjEvtArgs, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 0x4031u + (uint32_t)k, (uint32_t)k, 5000u, 5000u, 0u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "obj_mode2_k%d", k);
    run_and_emit(0x6FC4E750u, "OBJECT_SetAnimMode2Wrapper113c", k, lbl, &c, ts, 1u, 0u, 0);
  }

  /* 5. 0x6FC55EF0 QUESTS_OnMonsterKill113c (eax=pKiller, ecx=pGame, s=[pMonster], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x4041u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 2) ? 0x220u : 1u, 0x4045u + (uint32_t)k, 1u, 5004u, 5004u, 0u);
    if (k == 0) {
      U32(STAGE_PATH1 + 0x1Cu) = 0u;
    } else {
      stage_quest_node(STAGE_QUEST0, 6u, STAGE_QUESTEX0, 0u);
    }
    if (k == 2) {
      U8(STAGE_GAME + 0x6Au) = 3u;
    }
    uint32_t pKiller = (k == 2) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.eax = pKiller; c.ecx = STAGE_GAME;
    c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1; ts[2] = pKiller;
    snprintf(lbl, sizeof(lbl), "q_mon_kill_k%d", k);
    run_and_emit(0x6FC55EF0u, "QUESTS_OnMonsterKill113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* 6. 0x6FC320E0 ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c (eax=pCoords, ecx=pGame, s=[pRoom], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_PREF_BASE + 0x111F94u, 4u);
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 2u : 1u);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x00u) = (k == 0) ? 100u : (5000u + (uint32_t)k * 2u);
    U32(STAGE_SCRATCH + 0x04u) = (k == 0) ? 100u : (5000u + (uint32_t)k * 2u);
    c = make_call();
    c.eax = STAGE_SCRATCH; c.ecx = STAGE_GAME;
    c.nargs = 1; c.args[0] = STAGE_ROOM0; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_GAME; ts[2] = STAGE_ROOM0;
    snprintf(lbl, sizeof(lbl), "gold_pile_k%d", k);
    run_and_emit(0x6FC320E0u, "ITEMS_CreateGoldPileInRoomAtCoords_6FC320E0_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 7. 0x6FC3B950 AI_ThinkAct2SewerTownNpc_6FC3B950_113c (ecx=pGame, edx=pNpc, s=[pAiTickArgs], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0xB0u, 0x4061u + (uint32_t)k, 1u, 5000u, 5000u, 0u);
    if (k >= 1) {
      uint32_t pAiGen  = U32(STAGE_UDATA0 + 0x28u);
      uint32_t pCmd10  = (uint32_t)(uintptr_t)bump_alloc(0x28u);
      U32(pCmd10 + 0x00u) = pCmd10;
      U32(pCmd10 + 0x04u) = pCmd10;
      U32(pCmd10 + 0x08u) = 0x0Au;
      U32(pCmd10 + 0x0Cu) = 5000u;
      U32(pCmd10 + 0x10u) = 5000u;
      U32(pCmd10 + 0x18u) = (k == 2) ? 95u : 0u;
      U32(pAiGen + 0x08u) = pCmd10;
    }
    U32(STAGE_GAME + 0xA8u) = 100u;
    U32(STAGE_SCRATCH + 0x00u) = 0u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_sewer_npc_k%d", k);
    run_and_emit(0x6FC3B950u, "AI_ThinkAct2SewerTownNpc_6FC3B950_113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* 8. 0x6FC403D0 ITEMS_SaveItemToNodeAndFree_6FC403D0_113c (ebx=pItem, s=[pGame,pInactiveHolder,ppOutNode], ret 12) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cls = (k == 2) ? g_item_gem : g_item_sword;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x4071u + (uint32_t)k, 3u, 2u, 5000u, 5000u, 0x5555u + (uint32_t)k);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pHolder = (k == 0) ? 0u : (STAGE_SCRATCH + 0x100u);
    uint32_t ppOut   = (k == 0) ? STAGE_SCRATCH : 0u;
    if (k == 2) {
      U32(pHolder + 0x08u) = STAGE_SCRATCH + 0x200u;
    }
    c = make_call();
    c.ebx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = pHolder; c.args[2] = ppOut; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pHolder; ts[3] = ppOut;
    snprintf(lbl, sizeof(lbl), "save_item_free_k%d", k);
    run_and_emit(0x6FC403D0u, "ITEMS_SaveItemToNodeAndFree_6FC403D0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 9. 0x6FC43650 MONUMOD_SpectralHitMissileDamage_6FC43650_113c (ecx=pGame, edx=pTargetUnit, s=[0,pMonsterFlag], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 0) ? 1u : 3u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 0x4081u + (uint32_t)k, 1u, 5000u, 5000u, 0x1111u + (uint32_t)k * 999u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0C, 10 + k * 5, 0u);
    uint32_t flag = (k == 0) ? 0u : 1u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = flag; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = (int64_t)flag;
    snprintf(lbl, sizeof(lbl), "spectral_msl_k%d", k);
    run_and_emit(0x6FC43650u, "MONUMOD_SpectralHitMissileDamage_6FC43650_113c", k, lbl, &c, ts, 4u, 0u, 0);
  }

  /* 10. 0x6FC566A0 QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c (eax=dwItemCode, ecx=pGame, esi=pPlayer, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x4091u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    if (k >= 1) {
      uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = pInv;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_scroll, 0x4095u, 0u, 2u, 0u, 0u, 0u);
      U8(STAGE_UDATA1 + 0x45u) = 0u;
      U32(pInv + 0x0Cu) = STAGE_UNIT1;
      U32(pInv + 0x10u) = STAGE_UNIT1;
      U32(pInv + 0x28u) = 1u;
      U32(STAGE_UDATA1 + 0x5Cu) = pInv;
    }
    uint32_t pPlr = STAGE_UNIT0;
    uint32_t code = (k == 2) ? 0x20736B62u : 0x206D6468u;
    c = make_call();
    c.eax = code; c.ecx = STAGE_GAME; c.esi = pPlr;
    ts[0] = STAGE_GAME; ts[1] = pPlr; ts[2] = (int64_t)code;
    snprintf(lbl, sizeof(lbl), "q_del_item_k%d", k);
    run_and_emit(0x6FC566A0u, "QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* 11. 0x6FC68BA0 HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c (stdcall(pGame, pPlayer, pMerc, nNewLevel), ret 16) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x40A1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pGameArg = (k == 0) ? 0u : STAGE_GAME;
    uint32_t pMercArg = 0u;
    uint32_t lvlArg = 10u;
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x10Fu, 0x40A5u, 1u, 5002u, 5000u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0u);
      U32(STAGE_UNIT1 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
      U16(STAGE_UDATA1 + 0x0Cu) = 1u; /* nHirelingId */
      uint32_t pPetWrap = (uint32_t)(uintptr_t)bump_alloc(8u);
      uint32_t pPetArr  = (uint32_t)(uintptr_t)bump_alloc(0x80u);
      uint32_t pPetNode = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(pPetNode + 0x00u) = 0u;
      U32(pPetNode + 0x04u) = 0x40A5u;
      U32(pPetNode + 0x08u) = 1u;
      U32(pPetArr + 0x54u)  = pPetNode;
      U32(pPetWrap + 0x00u) = pPetArr;
      U32(STAGE_UDATA0 + 0x44u) = pPetWrap;
      pMercArg = STAGE_UNIT1;
    }
    c = make_call();
    c.nargs = 4; c.args[0] = pGameArg; c.args[1] = STAGE_UNIT0; c.args[2] = pMercArg; c.args[3] = lvlArg; c.calleePop = 16u;
    ts[0] = pGameArg; ts[1] = STAGE_UNIT0; ts[2] = pMercArg; ts[3] = (int64_t)lvlArg;
    snprintf(lbl, sizeof(lbl), "hire_lvlup_k%d", k);
    run_and_emit(0x6FC68BA0u, "HIRELING_LevelUpHirelingAndSyncSkills_6FC68BA0_113c", k, lbl, &c, ts, 4u, 0u, (k == 0) ? 1 : 0);
  }

  /* 12. 0x6FC824D0 ACT1_IntroCainActivate_6FC824D0_113c (ecx=pQuest, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x40B1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0) ? 1u : 0x10Au, 0x40B5u, 1u, 5002u, 5000u, 0u);
    stage_quest_node(STAGE_QUEST0, 1u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    if (k == 2) {
      set_quest_bit(U32(STAGE_QUESTCTRL + 0x0Cu), 1u, 0x0Du);
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a1_cain_intro_k%d", k);
    run_and_emit(0x6FC824D0u, "ACT1_IntroCainActivate_6FC824D0_113c", k, lbl, &c, ts, 2u, 0u, 0);
  }
}

/* ------------------------------- Cluster 4 Part 2 (11 VAs) */

static void emit_cluster4_part2(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* 13. 0x6FC86320 QUEST_Act1TownPortalUpdateState113c (ecx=pQuestEventArgs, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x40C1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 4u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x52u) = (k == 2) ? 1u : 0u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = (k == 2) ? 3u : 1u;
    c = make_call();
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "q_a1_tp_state_k%d", k);
    run_and_emit(0x6FC86320u, "QUEST_Act1TownPortalUpdateState113c", k, lbl, &c, ts, 1u, 0u, 0);
  }

  /* 14. 0x6FC97CB0 PLAYER_UpdateHpRegen113c (eax=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x40D1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    if (k == 0) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 50 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 74, 0, 0);
    } else if (k == 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 40 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 74, 20 << 8, 0);
    } else {
      void *pSl = fn_AllocStatList(NULL, 0x40u, 0u, 0, (int32_t)(0x40D1u + (uint32_t)k));
      fn_SetStatListState(pSl, 0x64);
      fn_SetStatIfValid(pSl, 74, 30 << 8, 0u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSl, 1);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x64, 1);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 90 << 8, 0);
    }
    c = make_call();
    c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "plr_hp_regen_k%d", k);
    run_and_emit(0x6FC97CB0u, "PLAYER_UpdateHpRegen113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, 0);
  }

  /* 15. 0x6FC99B10 PLAYER_Event3_RegenTick113c (ecx=pGame, edx=pUnit, s=[arg0,arg1], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t mode = (k == 0) ? 0u : 1u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x40E1u + (uint32_t)k, mode, 5000u, 5000u, STAGE_CLIENT);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 50 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 74, (k == 2) ? (25 << 8) : (5 << 8), 0);
    }
    if (k == 2) {
      U8(STAGE_UNIT0 + 0xC6u) |= 1u; /* dead flag -> skip regen after reschedule */
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)k; c.args[1] = (uint32_t)(k + 10); c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = k; ts[3] = k + 10;
    snprintf(lbl, sizeof(lbl), "plr_ev3_regen_k%d", k);
    run_and_emit(0x6FC99B10u, "PLAYER_Event3_RegenTick113c", k, lbl, &c, ts, 4u, 0u, 0);
  }

  /* 16. 0x6FC99A60 PLAYER_Event11_PeriodicTick113c (ecx=pGame, edx=pUnit, s=[0,0], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 50u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x40F1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "plr_ev11_tick_k%d", k);
    run_and_emit(0x6FC99A60u, "PLAYER_Event11_PeriodicTick113c", k, lbl, &c, ts, 2u, 0u, 0);
  }

  /* 17. 0x6FC98DD0 PLAYER_StartModeSkill113c (eax=pWeapon, s=[pGame,pPlayer], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x4101u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_UNIT1 + 0x60u) = pInv;
    uint32_t cls = (k == 0) ? g_item_sword : g_item_jav;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x4105u + (uint32_t)k, 1u, 2u, 0u, 0u, 0u);
    U32(STAGE_UDATA0 + 0x60u) = pInv;
    fn_PlaceItemInBodyLoc((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT0, 4);
    if (k == 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 70, 5, 0);
    } else if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 70, 1, 0);
    }
    c = make_call();
    c.eax = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "consume_throw_qty_k%d", k);
    run_and_emit(0x6FC98DD0u, "PLAYER_StartModeSkill113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* 18. 0x6FCE8990 ACT2Q4_JerhynPalaceNpcAiOverride_6FCE8990_113c (stdcall(pGame, pNpcUnit, pOutRunNormalAi, pOutStallAi), ret 16) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0xC9u, 0x4111u + (uint32_t)k, 1u, 5000u, 5000u, 0u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u)   = 1u;
      U8(STAGE_QUESTEX0 + 0x0Du) = 1u;
      U8(STAGE_QUESTEX0 + 0x12u) = 1u;
      U8(STAGE_QUESTEX0 + 0x13u) = (k == 2) ? 1u : 0u;
      U8(STAGE_QUESTEX0 + 0x1Au) = 1u;
      U32(STAGE_QUESTEX0 + 0x20u) = 5002u;
      U32(STAGE_QUESTEX0 + 0x24u) = 5002u;
    }
    uint32_t pOutRun   = STAGE_SCRATCH;
    uint32_t pOutStall = STAGE_SCRATCH + 4u;
    c = make_call();
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = pOutRun; c.args[3] = pOutStall; c.calleePop = 16u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pOutRun; ts[3] = pOutStall;
    snprintf(lbl, sizeof(lbl), "a2q4_jerhyn_ai_k%d", k);
    run_and_emit(0x6FCE8990u, "ACT2Q4_JerhynPalaceNpcAiOverride_6FCE8990_113c", k, lbl, &c, ts, 4u, 0u, 0);
  }

  /* 19. 0x6FCEFBC0 ITEMS_EquipMercBodyLocFromPlayerCursor_6FCEFBC0_113c (stdcall(pGame, pPlayer, pMerc, pCursorItem), ret 16) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 0) {
      U32(STAGE_GAME + 0x70u) = 0u;
    }
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x4121u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x10Fu, 0x4125u + (uint32_t)k, 1u, 5002u, 5000u, 0u);
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_armor, 0x4129u + (uint32_t)k, 4u, 2u, 0u, 0u, 0u);
    if (k == 2) {
      uint32_t pPlrInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = pPlrInv;
      U32(pPlrInv + 0x1Cu) = STAGE_UNIT2;
      U32(STAGE_UDATA2 + 0x60u) = pPlrInv;
      uint32_t pMercInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
      U32(STAGE_UNIT1 + 0x60u) = pMercInv;
    }
    c = make_call();
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.args[3] = STAGE_UNIT2; c.calleePop = 16u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_UNIT2;
    snprintf(lbl, sizeof(lbl), "equip_merc_k%d", k);
    run_and_emit(0x6FCEFBC0u, "ITEMS_EquipMercBodyLocFromPlayerCursor_6FCEFBC0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 20. 0x6FCFF7B0 SUNIT_ScheduleModeAnimEvents113c (esi=pUnit, s=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x4131u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_UNIT0 + 0x30u) = 0u;
    U32(STAGE_UNIT0 + 0x50u) = STAGE_SCRATCH;
    if (k == 0) {
      U16(STAGE_UNIT0 + 0x4Cu) = 0u;
    } else if (k == 1) {
      U16(STAGE_UNIT0 + 0x4Cu) = 0x0100u;
      U32(STAGE_UNIT0 + 0x48u) = 0x0800u;
      U8(STAGE_SCRATCH + 0x12u) = 1u;
      U8(STAGE_SCRATCH + 0x15u) = 4u;
    } else {
      U16(STAGE_UNIT0 + 0x4Cu) = 0x0200u;
      U32(STAGE_UNIT0 + 0x48u) = 0x0A00u;
      U8(STAGE_SCRATCH + 0x13u) = 2u;
    }
    c = make_call();
    c.esi = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "sched_anim_ev_k%d", k);
    run_and_emit(0x6FCFF7B0u, "SUNIT_ScheduleModeAnimEvents113c", k, lbl, &c, ts, 2u, 0u, 0);
  }

  /* 21. 0x6FD0FC60 SUNIT_UnlinkFromRoomUpdateList113c (edi=pGame, esi=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x4141u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    if (k == 0) {
      U32(STAGE_UNIT0 + 0xD0u) = 0x0Bu;
    } else if (k == 1) {
      uint32_t pHead = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pHead + 0x08u) = pNode;
      U32(pNode + 0x00u) = STAGE_UNIT0;
      U32(pNode + 0x0Cu) = pHead;
      U32(STAGE_GAME + 0x10F8u + 2u * 4u) = pHead;
      U32(STAGE_UNIT0 + 0xD0u) = 2u;
    } else {
      uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pNode + 0x00u) = STAGE_UNIT0;
      U32(STAGE_GAME + 0x10F8u + 9u * 4u) = pNode;
      U32(STAGE_UNIT0 + 0xD0u) = 9u;
    }
    c = make_call();
    c.edi = STAGE_GAME; c.esi = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "unlink_rm_upd_k%d", k);
    run_and_emit(0x6FD0FC60u, "SUNIT_UnlinkFromRoomUpdateList113c", k, lbl, &c, ts, 2u, 0u, 0);
  }

  /* 22. 0x6FD01110 SUNIT_ClearUnitInventoryItems113c (stdcall(pGame, pUnit), ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x4151u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    if (k == 2) {
      uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = pInv;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_armor, 0x4155u, 1u, 2u, 0u, 0u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_UDATA1 + 0x60u) = pInv;
      fn_PlaceItemInBodyLoc((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1, 1);
    }
    uint32_t pUnitArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pUnitArg; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pUnitArg;
    snprintf(lbl, sizeof(lbl), "clear_unit_inv_k%d", k);
    run_and_emit(0x6FD01110u, "SUNIT_ClearUnitInventoryItems113c", k, lbl, &c, ts, 2u, 0u, (k == 0) ? 1 : 0);
  }

  /* 23. 0x6FCF0D30 C2S_Packet49_WaypointInteract_6FCF0D30_113c (ecx=pGame, edx=pPlayer, s=[pPkt,nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x4161u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    U8(STAGE_SCRATCH + 0x00u)  = 0x49u;
    U32(STAGE_SCRATCH + 0x01u) = 0x9999u;
    U16(STAGE_SCRATCH + 0x05u) = 1u;
    uint32_t nLen = (k == 0) ? 5u : 9u;
    if (k == 1) {
      g_fake_tick_count = 0x1000u;
      U32(STAGE_UDATA0 + 0x160u) = 0x0500u;
      U32(STAGE_UNIT0 + 0x64u) = 0x9999u;
      U32(STAGE_UNIT0 + 0x68u) = 2u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
    } else if (k == 2) {
      g_fake_tick_count = 0x50000u;
      U32(STAGE_UDATA0 + 0x160u) = 0u;
      U32(STAGE_UNIT0 + 0x64u) = 0x9999u;
      U32(STAGE_UNIT0 + 0x68u) = 2u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x77u, 0x9999u, 0u, 5050u, 5050u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = (int64_t)nLen; ts[4] = (int64_t)g_fake_tick_count;
    snprintf(lbl, sizeof(lbl), "pkt49_wp_k%d", k);
    run_and_emit(0x6FCF0D30u, "C2S_Packet49_WaypointInteract_6FCF0D30_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }
}

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "Usage: %s <datatbls.img> <out.ndjson>\n", argv[0]);
    return 1;
  }
  const char *imgPath = argv[1];
  const char *outPath = argv[2];

  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE,    DATATBLS_SIZE,    MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pVtbl  = VirtualAlloc((void *)HASH_VTABLE_ADDR, 0x1000u,          MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE,       STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE,        HEAP_SIZE,        MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pVtbl != HASH_VTABLE_ADDR ||
      (uintptr_t)pStage != STAGE_BASE   || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-p12] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
    fflush(stderr);
    return 1;
  }

  g_hStorm       = LoadLibraryA("Storm.dll");
  g_hFog         = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCmp   = LoadLibraryA("D2CMP.dll");
  g_hCom         = LoadLibraryA("D2Common.dll");
  g_hNet         = LoadLibraryA("D2Net.dll");
  g_hGame        = LoadLibraryA("D2Game.dll");
  if (!g_hStorm || !g_hFog || !hLang || !hCmp || !g_hCom || !g_hNet || !g_hGame) {
    fprintf(stderr, "[k6-p12] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p12] unexpected D2Common rebase: %p\n", (void *)g_hCom);
    fflush(stderr);
    return 3;
  }

  {
    typedef void(__fastcall *FogInitSys_t)(int, void *);
    FogInitSys_t pInit = (FogInitSys_t)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(10089));
    if (pInit) pInit(1, NULL);
  }

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

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_PlaceItemInBodyLoc) {
    fprintf(stderr, "[k6-p12] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p12] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_cluster1_summon();
  emit_cluster2_quest_cb03();
  emit_cluster3_events();
  emit_cluster4_part1();
  emit_cluster4_part2();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p12] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
