/*
 * k6-p8-d2game-emitter.c — [K6-P8] Real-DLL D2Game.dll (Mission 1 + 26 Band B/C) Emitter (34 VAs)
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
    fprintf(stderr, "[k6-p8] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
  };
  for (size_t i = 0; i < sizeof(fogHooks) / sizeof(fogHooks[0]); i++) {
    void *orig = (void *)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(fogHooks[i].ord));
    if (!orig) {
      fprintf(stderr, "[k6-p8] missing Fog.#%u\n", fogHooks[i].ord);
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
    fprintf(stderr, "[k6-p8] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p8] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_PREF_BASE + 0x99000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p8] short read at page %u\n", i);
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
        fprintf(stderr, "[k6-p8] stage json overflow\n");
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

  /* Reset D2Game globals between cases */
  U32(game_global_live(D2GAME_PREF_BASE + 0x111C1Cu)) = 0u; /* 0x6FD31C1C */
  U32(game_global_live(D2GAME_PREF_BASE + 0x111C20u)) = 0u; /* 0x6FD31C20 */
  U32(game_global_live(D2GAME_PREF_BASE + 0x111F90u)) = 0u; /* 0x6FD31F90 */
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
  U32(pAct + 0x08u)         = 0u;
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

static void stage_room_near_self(uint32_t pRoom) {
  uint32_t ppNear = (uint32_t)(uintptr_t)bump_alloc(4u);
  U32(ppNear)        = pRoom;
  U32(pRoom + 0x00u) = ppNear;
  U32(pRoom + 0x24u) = 1u;
}

static void stage_room_link_unit(uint32_t pRoom, uint32_t pUnit) {
  uint32_t prev = U32(pRoom + 0x74u);
  U32(pUnit + 0xE8u) = prev;
  U32(pRoom + 0x74u) = pUnit;
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
  if (delta == 0u) return;
  for (uint32_t a = startAddr; a + 4u <= endAddr; a += 4u) {
    uint32_t v = U32(a);
    if (v >= lo && v < hi) {
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
            "[k6-p8] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-p8] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-p8] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-p8] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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
static uint32_t      g_obj_trap = 0;

static void discover_table_ids(void) {
  reset_case();
  uint32_t nItems = U32(D2COM_PREF_BASE + 0x9FB94u + g_com_rebase);
  uint32_t pItems = U32(D2COM_PREF_BASE + 0x9FB98u + g_com_rebase);
  int32_t  nLink  = 0;
  for (uint32_t id = 0; id < nItems; id++) {
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    if (!g_item_sword  && code == 0x20647373u) g_item_sword  = id; /* 'ssd ' */
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

static void stage_player_quest_item(
    uint32_t pPlayer, uint32_t pItem, uint32_t pItemData, uint32_t pItemPath,
    uint32_t itemClassId, uint32_t itemGuid) {
  uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)pPlayer);
  U32(pPlayer + 0x60u) = pInv;
  stage_item_unit(pItem, pItemData, pItemPath, STAGE_ROOM0, itemClassId, itemGuid, 0u, 2u, 0u, 0u, 0u);
  U8(pItemData + 0x45u) = 0u;
  U32(pInv + 0x0Cu) = pItem;
  U32(pInv + 0x10u) = pItem;
  U32(pInv + 0x28u) = 1u;
  U32(pItemData + 0x60u) = pInv;
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

static void stage_prog_charge_state(
    uint32_t pUnit, int32_t stateId, int32_t skillId, int32_t slvl, int32_t chargeStat, int32_t charges) {
  void *pSl = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
  fn_SetStatListState(pSl, stateId);
  fn_SetStatIfValid(pSl, 0x15E, skillId, 0u);
  fn_SetStatIfValid(pSl, 0x15F, slvl, 0u);
  fn_SetStatIfValid(pSl, chargeStat, charges, 0u);
  fn_MergeStatLists((void *)(uintptr_t)pUnit, pSl, 1);
  fn_ToggleGfxState((void *)(uintptr_t)pUnit, stateId, 1);
}

static uint32_t g_mon_aimode4 = 0u;
static uint32_t g_mon_aimode5 = 0u;
static uint32_t g_mon_crit    = 0u;
static uint32_t g_skill_delay = 0u;
static uint32_t g_skill_chg   = 0u;

static void discover_p8_ids(void) {
  uint32_t pTables   = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
  uint32_t pMonBase  = U32(pTables + 0xA78u);
  uint32_t nMonCnt   = U32(pTables + 0xA80u);
  uint32_t pStdAiTbl = game_global_live(0x6FD2E788u);
  uint8_t  bestCrit  = 0u;
  for (uint32_t id = 0; id < nMonCnt; id++) {
    uint32_t rec = pMonBase + id * 0x1A8u;
    int16_t wAi = S16(rec + 0x1Eu);
    if (wAi >= 0 && wAi < 0x94) {
      uint32_t aiMode = U32(pStdAiTbl + ((uint32_t)wAi << 4));
      if (!g_mon_aimode4 && aiMode == 4u) g_mon_aimode4 = id;
      if (!g_mon_aimode5 && aiMode == 5u) g_mon_aimode5 = id;
    }
    uint8_t crit = U8(rec + 0xA6u);
    if (crit > bestCrit) {
      bestCrit = crit;
      g_mon_crit = id;
    }
  }

  uint32_t pSkillsBase = U32(pTables + 0xB98u);
  uint32_t nSkillsCnt  = U32(pTables + 0xBA0u);
  int32_t  nStatesCnt  = S32(pTables + 0x0C4u);
  int32_t  nStatsCnt   = S32(pTables + 0xBD4u);
  uintptr_t fogBitMasks = (uintptr_t)GetProcAddress(g_hFog, "gdwBitMasks");
  uint8_t bm2 = fogBitMasks ? U8(fogBitMasks + 0x08u) : 0x04u;
  uint8_t bm56 = fogBitMasks ? (uint8_t)(U8(fogBitMasks + 0x14u) | U8(fogBitMasks + 0x18u)) : 0x60u;
  for (uint32_t sk = 1u; sk < nSkillsCnt; sk++) {
    uint32_t rec = pSkillsBase + sk * 0x23Cu;
    uint8_t flg4 = U8(rec + 0x04u);
    if (!g_skill_delay && (flg4 & bm56) != 0u) {
      g_skill_delay = sk;
    }
    if (!g_skill_chg && (flg4 & bm2) != 0u) {
      int16_t aSt  = S16(rec + 0x80u);
      int16_t aStat = S16(rec + 0x54u);
      if (aSt >= 0 && aSt < nStatesCnt && aStat >= 0 && aStat < nStatsCnt) {
        g_skill_chg = sk;
      }
    }
  }
  if (!g_skill_delay) g_skill_delay = 59u;
}

static void link_player_game_list(uint32_t pGame, uint32_t pPlayer, uint32_t slot) {
  uint32_t node = (uint32_t)(uintptr_t)bump_alloc(0x10u);
  U32(node + 0x00u) = pPlayer;
  U32(node + 0x08u) = U32(pGame + 0x10F8u + (slot & 7u) * 4u);
  U32(pGame + 0x10F8u + (slot & 7u) * 4u) = node;
}

static void emit_group_1_mission1(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[64];

  /* 1. 0x6FC41420 AIGENERAL_FlushAllAiCommands113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pMon = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
      pMon = STAGE_UNIT0;
      uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
      if (k == 2) {
        uint32_t n0 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
        U32(n0 + 0x00u) = n0; U32(n0 + 0x04u) = n0;
        U32(pAiGen + 0x20u) = n0; U32(pAiGen + 0x24u) = n0;
      } else if (k == 3) {
        uint32_t n0 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
        uint32_t n1 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
        uint32_t n2 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
        U32(n0 + 0x00u) = n1; U32(n0 + 0x04u) = n2;
        U32(n1 + 0x00u) = n2; U32(n1 + 0x04u) = n0;
        U32(n2 + 0x00u) = n0; U32(n2 + 0x04u) = n1;
        U32(pAiGen + 0x20u) = n0; U32(pAiGen + 0x24u) = n2;
      }
    }
    c = make_call(); c.edi = pMon; c.ebx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = pMon;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC41420u, "AIGENERAL_FlushAllAiCommands113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 2. 0x6FC883C0 ACT1Q4_OnPlayerEnterTristramWithCainUnrescued_6FC883C0_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 38u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    link_player_game_list(STAGE_GAME, STAGE_UNIT0, 0u);
    uint32_t pGlobalRec = alloc_quest_record();
    U32(STAGE_GAME + 0x10F4u)  = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = pGlobalRec;
    U32(STAGE_QUEST0 + 0x00u)  = 4u;
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xE0u)  = 4u;
    U8(STAGE_QUESTEX0 + 0x61u) = 1u;
    if (k == 0) {
      set_quest_bit(U32(STAGE_UDATA0 + 0x10u), 4u, 0u);
    } else if (k == 1) {
      set_quest_bit(U32(STAGE_UDATA0 + 0x10u), 4u, 1u);
    } else if (k == 2) {
      U8(STAGE_QUEST0 + 0x0Cu) = 6u;
    } else {
      U8(STAGE_QUEST0 + 0x0Cu) = 2u;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC883C0u, "ACT1Q4_OnPlayerEnterTristramWithCainUnrescued_6FC883C0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 3. 0x6FC8AE60 OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_trap, 1u, 1u, 5000u, 5000u, 0u);
    if (k == 1) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 17u, 5001u, 5000u, STAGE_CLIENT);
      stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT1);
      stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 3u, 1u, 5001u, 5000u, 0u);
      stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT2);
    } else if (k == 2) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 1u, 5001u, 5000u, STAGE_CLIENT);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 200 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 200 << 8, 0);
      stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT1);
    }
    c = make_call(); c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC8AE60u, "OBJECTS_ApplyLightningTrapDamageInRoom_6FC8AE60_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 4. 0x6FCBD160 AI_DispatchTargetByAiFlag113c */
  for (int k = 0; k < 6; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_near_self(STAGE_ROOM0);
    stage_timer_with_chunk(STAGE_GAME, 0u);
    uint32_t pCollGrid = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    uint32_t pCollBuf  = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    U32(pCollGrid + 0x00u) = 4990u;
    U32(pCollGrid + 0x04u) = 4990u;
    U32(pCollGrid + 0x08u) = 20u;
    U32(pCollGrid + 0x0Cu) = 20u;
    U32(pCollGrid + 0x24u) = pCollBuf;
    U32(STAGE_ROOM0 + 0x20u) = pCollGrid;

    uint32_t cls = 1u;
    if (k == 4) cls = g_mon_aimode4;
    if (k == 5) cls = g_mon_aimode5;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pParam  = STAGE_SCRATCH;
    U32(pParam + 0x00u) = pAiCtrl;
    if (k == 0) {
      U32(pAiCtrl + 0x00u) = 1u; /* aiMode 0 */
    } else if (k == 1) {
      U32(pAiCtrl + 0x00u) = 2u; /* aiMode 1, target found */
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 5002u, 5000u, STAGE_CLIENT);
      stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT1);
      link_player_game_list(STAGE_GAME, STAGE_UNIT1, 0u);
    } else if (k == 2) {
      U32(pAiCtrl + 0x00u) = 2u; /* aiMode 1, no target -> AI_Stall */
    } else if (k == 3) {
      U32(pAiCtrl + 0x00u) = 17u; /* aiMode 2, no target -> return 0 */
    } else {
      U32(pAiCtrl + 0x00u) = 0u; /* standard wAi -> aiMode 4 or 5, no target */
    }
    c = make_call(); c.esi = pParam; c.ebx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pParam; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBD160u, "AI_DispatchTargetByAiFlag113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 5. 0x6FCBD980 ROOM_DeactivateRoomForClient113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pRoom   = (k == 0) ? 0u : STAGE_ROOM0;
    uint32_t pClient = STAGE_CLIENT;
    if (k >= 1) {
      U32(STAGE_CLIENT + 0x00u)   = 1u;
      U32(STAGE_CLIENT + 0x04u)   = (k == 3) ? 1u : 4u;
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
      U32(STAGE_CLIENT + 0x1B4u) = STAGE_ROOM0;
      uint32_t ppClients = (uint32_t)(uintptr_t)bump_alloc(16u);
      U32(ppClients + 0x00u)     = STAGE_CLIENT;
      if (k == 2) U32(ppClients + 0x04u) = STAGE_CLIENT1;
      U32(STAGE_ROOM0 + 0x48u)   = ppClients;
      U32(STAGE_ROOM0 + 0x78u)   = (k == 2) ? 2u : 1u;
      if (k >= 2) {
        stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 9u, 1u, 5005u, 5005u, 0u);
        stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT0);
        stage_unit_common(STAGE_UNIT1, 0u, STAGE_PATH1, STAGE_ROOM0, 3u, 10u, 10u, 1u, 5006u, 5005u, 0u);
        stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT1);
      }
    }
    c = make_call(); c.edi = pRoom; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pClient; c.calleePop = 8u;
    ts[0] = pRoom; ts[1] = STAGE_GAME; ts[2] = pClient;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBD980u, "ROOM_DeactivateRoomForClient113c", k, lbl, &c, ts, 3u, 0x00000000u, (k == 0 ? 1 : 0));
  }

  /* 6. 0x6FCDDE60 NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 50000, 0);
    uint32_t npcCls  = (k == 3) ? 1u : 154u; /* Charsi=154 */
    uint32_t npcGuid = 200u;
    uint32_t argNpc  = (k == 0) ? 99u : npcGuid;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, npcGuid, 1u, 5002u, 5000u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
    U32(STAGE_UNIT0 + 0x64u) = npcGuid;
    U32(STAGE_UNIT0 + 0x68u) = 1u;
    stage_player_quest_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_sword, 77u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 72, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 73, 30, 0);
    uint32_t itemGuid = (k == 1) ? 888u : 77u;
    c = make_call(); c.eax = argNpc; c.ecx = STAGE_UNIT0; c.edx = STAGE_GAME;
    c.nargs = 2; c.args[0] = itemGuid; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = argNpc; ts[3] = itemGuid; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDDE60u, "NPCS_RepairPlayerItemOrAllItems_6FCDDE60_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 7. 0x6FCEF0A0 C2S_Packet35_NpcRepair_6FCEF0A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 50000, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 154u, 200u, 1u, 5002u, 5000u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
    U32(STAGE_UNIT0 + 0x64u) = 200u;
    U32(STAGE_UNIT0 + 0x68u) = 1u;
    stage_player_quest_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_sword, 77u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 72, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 73, 30, 0);
    U8(STAGE_SCRATCH + 0u)   = 0x35u;
    U32(STAGE_SCRATCH + 1u)  = (k == 1) ? 99u : 200u;
    U32(STAGE_SCRATCH + 5u)  = 77u;
    U32(STAGE_SCRATCH + 13u) = 0u;
    uint32_t pktLen = (k == 0) ? 10u : 17u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = pktLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = pktLen;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEF0A0u, "C2S_Packet35_NpcRepair_6FCEF0A0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 8. 0x6FD130C0 AI_FindNearestPlayerTarget113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room_near_self(STAGE_ROOM0);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 155u, 10u, 5u, 5000u, 5000u, 0u);
    if (k == 0) {
      U32(STAGE_PATH0 + 0x1Cu) = 0u; /* UNITS_GetRoom == 0 */
    } else if (k >= 2) {
      uint16_t px = (k == 2) ? 5010u : 5002u;
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 5u, px, 5000u, STAGE_CLIENT);
      stage_room_link_unit(STAGE_ROOM0, STAGE_UNIT1);
    }
    c = make_call(); c.esi = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD130C0u, "AI_FindNearestPlayerTarget113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }
}

static void stage_party_ctrl_with_player(
    uint32_t pGame, uint16_t partyId, uint32_t guid0, uint32_t guid1) {
  uint32_t pCtrl = (uint32_t)(uintptr_t)bump_alloc(0x10u);
  uint32_t pParty = (uint32_t)(uintptr_t)bump_alloc(0x10u);
  uint32_t pMem0 = (uint32_t)(uintptr_t)bump_alloc(0x0Cu);
  U32(pGame + 0x1D2Cu) = pCtrl;
  U32(pCtrl + 0x04u)   = pParty;
  U16(pParty + 0x00u)  = partyId;
  U32(pParty + 0x04u)  = pMem0;
  U32(pMem0 + 0x00u)   = guid0;
  if (guid1 != 0u) {
    uint32_t pMem1 = (uint32_t)(uintptr_t)bump_alloc(0x0Cu);
    U32(pMem1 + 0x00u) = guid1;
    U32(pMem0 + 0x04u) = pMem1;
  }
}

static void emit_group_2_bandbc(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[64];

  /* 9. 0x6FC79680 ACT5Intro_ActiveFilter_6FC79680_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    if (k == 2) {
      /* set intro bit for NPC 0x201 in difficulty 0 talk table */
      uint32_t pPair = U32(STAGE_UDATA0 + 0x60u);
      uint32_t pHold = U32(pPair);
      uint32_t pBits = U32(pHold);
      memset((void *)(uintptr_t)pBits, 0xFF, 8);
    }
    uint32_t npcId = (k == 0) ? 0x200u : 0x201u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = 0u; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = STAGE_QUEST0; ts[1] = (int64_t)npcId; ts[2] = STAGE_UNIT0; ts[3] = 0; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC79680u, "ACT5Intro_ActiveFilter_6FC79680_113c", k, lbl, &c, ts, 5u, 0x000000FFu, 0);
  }

  /* 10. 0x6FC7B0B0 ACT5Q3_ApplyScrollOfResistanceAcrossDifficulties_6FC7B0B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    if (k >= 1) set_quest_bit(U32(STAGE_UDATA0 + 0x10u), 0x25u, 7u);
    if (k == 2) {
      set_quest_bit(U32(STAGE_UDATA0 + 0x14u), 0x25u, 7u);
      set_quest_bit(U32(STAGE_UDATA0 + 0x18u), 0x25u, 7u);
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC7B0B0u, "ACT5Q3_ApplyScrollOfResistanceAcrossDifficulties_6FC7B0B0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 11. 0x6FC835B0 ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(0x6FD31C20u, 4u);
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_CLIENT + 0x04u) = 4u;
    U32(STAGE_GAME + 0x88u)   = STAGE_CLIENT;
    U32(game_global_live(0x6FD31C20u)) = (k == 2) ? 1u : 0u;
    if (k == 1) U8(STAGE_CLIENT + 0x04u) = 1u;
    c = make_call(); c.nargs = 1; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = STAGE_QUEST0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC835B0u, "ACT1Q4_BroadcastDebugQuestNotice_6FC835B0_113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 12. 0x6FC8E400 OBJ_ThinkEventLightningSpire_6FC8E400_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_with_chunk(STAGE_GAME, 0u);
    uint32_t pSeed = (uint32_t)(uintptr_t)bump_alloc(8u);
    U32(pSeed + 0x00u) = (k == 2) ? 0x76543211u : 0x11111111u;
    U32(pSeed + 0x04u) = 0x29Au;
    U32(STAGE_GAME + 0x10F0u) = pSeed;
    uint32_t mode = (k == 0) ? 1u : 2u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_trap, 1u, mode, 5000u, 5000u, 0u);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC8E400u, "OBJ_ThinkEventLightningSpire_6FC8E400_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 13. 0x6FC94C30 MONSTER_StartModeRun113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_PATH0 + 0x18u) = (k == 0) ? 0u : (k == 1 ? 2u : 4u);
    if (k == 2) {
      uint32_t pAtk = (uint32_t)(uintptr_t)bump_alloc(0x90u);
      U32(pAtk + 0x04u) = 1u; U32(pAtk + 0x08u) = 10u;
      U32(STAGE_UNIT0 + 0xACu) = pAtk;
    }
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC94C30u, "MONSTER_StartModeRun113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 14. 0x6FC94C60 MONSTER_StartModeWalk113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_PATH0 + 0x18u) = (k == 0) ? 0u : (k == 1 ? 3u : 5u);
    if (k == 2) {
      uint32_t pAtk = (uint32_t)(uintptr_t)bump_alloc(0x90u);
      U32(pAtk + 0x04u) = 1u; U32(pAtk + 0x08u) = 10u;
      U32(STAGE_UNIT0 + 0xACu) = pAtk;
    }
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC94C60u, "MONSTER_StartModeWalk113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 15. 0x6FC94F20 MONSTER_IsContinuousMode113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t pUnit = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t mode  = (k == 0) ? 2u : (k == 1 ? 2u : (k == 2 ? 13u : 4u));
    c = make_call(); c.eax = mode; c.ecx = pUnit; c.calleePop = 0u;
    ts[0] = pUnit; ts[1] = mode;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC94F20u, "MONSTER_IsContinuousMode113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 16. 0x6FC970E0 MONSTER_ApplyCritDamage113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t seed = (k == 1) ? 0x11111111u : 0x00000001u;
    uint32_t monCls = (k == 0) ? 0u : g_mon_crit;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, monCls, 10u, 1u, 5000u, 5000u, seed);
    /* Force roll100 < crit for k>=2 by staging a deterministic low-roll seed */
    if (k >= 2) {
      U32(STAGE_UNIT0 + 0x20u) = 0u;
      U32(STAGE_UNIT0 + 0x24u) = 1u; /* roll = (0 * 0x6ac690c5 + 1) % 100 = 1 < crit */
    }
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 5001u, 5000u, STAGE_CLIENT);
    U32(STAGE_DMG + 0x08u) = 100u;
    U32(STAGE_DMG + 0x10u) = 200u;
    U32(STAGE_DMG + 0x60u) = (k == 3) ? 0x10u : 0u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = STAGE_DMG; c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_DMG; ts[2] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC970E0u, "MONSTER_ApplyCritDamage113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 17. 0x6FC971D0 MONSTER_CheckSandLeaperMidAir113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cls = (k >= 2) ? 78u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 10u, 5u, 5000u, 5000u, 0u);
    U32(STAGE_DMG + 0x04u) = (k == 0) ? 0u : 0x04u;
    if (k == 3) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 1, 1); /* STATE_FREEZE=1 blocks knockback */
    }
    c = make_call(); c.ebx = STAGE_DMG; c.esi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_DMG; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC971D0u, "MONSTER_CheckSandLeaperMidAir113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 18. 0x6FC97820 PLAYER_Event0C_ExpireTimedStats113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_GAME + 0xA8u) = (k == 0) ? 50u : (k == 1 ? 150u : 300u);
    if (k >= 1) {
      void *pSl = fn_AllocStatList(NULL, 0x02u, 120u, 0, 1);
      fn_SetStatIfValid(pSl, 31, 25, 0u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSl, 1);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC97820u, "PLAYER_Event0C_ExpireTimedStats113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 19. 0x6FC97A50 PLAYER_UpdateStaminaRegen113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t mode = (k == 0) ? 1u : (k == 1 ? 2u : (k == 2 ? 2u : 3u));
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, mode, 5000u, 5000u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 800 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, (k == 1) ? 100 : (400 << 8), 0);
    if (k == 3) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 28, 1200, 0);
    c = make_call(); c.edi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC97A50u, "PLAYER_UpdateStaminaRegen113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 20. 0x6FC98760 PLAYER_ScheduleAttackActionFrameEvents113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, (k == 1) ? 19u : 1u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pGame = (k == 0) ? 0u : STAGE_GAME;
    uint32_t mode  = (k == 1) ? 19u : 6u;
    c = make_call(); c.ecx = pGame; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = mode; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = pGame; ts[1] = STAGE_UNIT0; ts[2] = -2; ts[3] = (int64_t)mode; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC98760u, "PLAYER_ScheduleAttackActionFrameEvents113c", k, lbl, &c, ts, 5u, 0x00000000u, (k == 0 ? 1 : 0));
  }

  /* 21. 0x6FC9AC50 MONSTER_BroadcastEventSoundToClients113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5002u, 5000u, 0u);
    U16(STAGE_UNIT0 + 0x6Eu) = (uint16_t)(12u + k);
    if (k == 1) U32(STAGE_UNIT0 + 0x70u) = STAGE_UNIT2; /* filtered out */
    if (k == 2) U32(STAGE_UNIT0 + 0x70u) = STAGE_UNIT1; /* matching client unit */
    c = make_call(); c.edi = STAGE_UNIT0; c.eax = STAGE_CLIENT; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_CLIENT; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC9AC50u, "MONSTER_BroadcastEventSoundToClients113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }
}

static void emit_group_3_bandbc(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[64];

  /* 22. 0x6FCADDA0 ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_CLIENT + 0x3D4u) = 1u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 50u, 0u, 2u, 0u, 0u, 0u);
    U8(STAGE_UDATA0 + 0x45u) = 0u;
    U32(STAGE_UDATA0 + 0x14u) = (k == 1) ? 0u : 0x10u;
    uint32_t cmd = (k <= 1) ? 0x38u : (k == 2 ? 0x39u : 0x00u);
    c = make_call(); c.eax = cmd; c.ecx = STAGE_UNIT0; c.edx = STAGE_CLIENT; c.calleePop = 0u;
    ts[0] = (int64_t)cmd; ts[1] = STAGE_UNIT0; ts[2] = STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCADDA0u, "ITEMS_SendPacket9C_Cmd38Or39_6FCADDA0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 23. 0x6FCADE50 ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_CLIENT + 0x3D4u) = 1u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 2) ? g_item_scroll : g_item_sword, 50u, 0u, 2u, 0u, 0u, 0u);
    uint32_t pCli = (k == 0) ? STAGE_CLIENT1 : STAGE_CLIENT;
    uint32_t flg  = (k == 2) ? 0x20u : 0u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = pCli; c.esi = STAGE_UNIT1; c.nargs = 1; c.args[0] = flg; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pCli; ts[2] = STAGE_UNIT1; ts[3] = (int64_t)flg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCADE50u, "ITEMS_SendBeltRemoveItemPacket0E_6FCADE50_113c", k, lbl, &c, ts, 4u, 0x00000000u, (k == 0 ? 1 : 0));
  }

  /* 24. 0x6FCADF70 ITEMS_SendCursorPutItemPacket04_6FCADF70_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_CLIENT + 0x3D4u) = 1u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 2) ? g_item_scroll : g_item_sword, 50u, 0u, 2u, 0u, 0u, 0u);
    uint32_t pCli = (k == 0) ? STAGE_CLIENT1 : STAGE_CLIENT;
    uint32_t flg  = (k == 2) ? 0x20u : 0u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = pCli; c.esi = STAGE_UNIT1; c.nargs = 1; c.args[0] = flg; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pCli; ts[2] = STAGE_UNIT1; ts[3] = (int64_t)flg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCADF70u, "ITEMS_SendCursorPutItemPacket04_6FCADF70_113c", k, lbl, &c, ts, 4u, 0x00000000u, (k == 0 ? 1 : 0));
  }

  /* 25. 0x6FCAE030 ITEMS_SendDropToGroundPacket02_6FCAE030_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_CLIENT + 0x3D4u) = 1u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 2) ? g_item_scroll : g_item_sword, 50u, 3u, 2u, 5001u, 5001u, 0u);
    uint32_t pCli = (k == 0) ? STAGE_CLIENT1 : STAGE_CLIENT;
    uint32_t flg  = (k == 2) ? 0x20u : 0u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = pCli; c.esi = STAGE_UNIT1; c.nargs = 1; c.args[0] = flg; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pCli; ts[2] = STAGE_UNIT1; ts[3] = (int64_t)flg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAE030u, "ITEMS_SendDropToGroundPacket02_6FCAE030_113c", k, lbl, &c, ts, 4u, 0x00000000u, (k == 0 ? 1 : 0));
  }

  /* 26. 0x6FCAE540 EVENT_AllocNodeWithGrowth113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pTimer = stage_timer_with_chunk(STAGE_GAME, (k == 2) ? 1u : 0u);
    if (k == 1) {
      uint32_t pChunk = U32(pTimer + 0xA1Cu);
      U32(pChunk + 0x7080u) = pChunk + 0x30u;
    }
    c = make_call(); c.esi = pTimer; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pTimer; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAE540u, "EVENT_AllocNodeWithGrowth113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 27. 0x6FCAE900 EVENT_DeleteEventByArg14_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t ev0 = (uint32_t)(uintptr_t)bump_alloc(0x30u);
    uint32_t ev1 = (uint32_t)(uintptr_t)bump_alloc(0x30u);
    U8(ev0 + 0x00u) = 8u; U16(ev0 + 0x02u) = 1u; U32(ev0 + 0x10u) = 1u; U32(ev0 + 0x14u) = 77u; U32(ev0 + 0x24u) = ev1;
    U8(ev1 + 0x00u) = 8u; U16(ev1 + 0x02u) = 1u; U32(ev1 + 0x10u) = 1u; U32(ev1 + 0x14u) = 99u; U32(ev1 + 0x24u) = 0u;
    U32(STAGE_UNIT0 + 0xDCu) = ev0;
    uint32_t pUnit = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t arg14 = (k == 2) ? 99u : 0u;
    c = make_call(); c.eax = pUnit; c.ebx = arg14; c.ecx = STAGE_GAME; c.nargs = 1; c.args[0] = 8u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pUnit; ts[2] = 8; ts[3] = (int64_t)arg14;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAE900u, "EVENT_DeleteEventByArg14_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 28. 0x6FCAF5C0 D2GAME_ARENA_FindPlayerSlotByUnit113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    uint32_t pArena = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    uint32_t pTbl   = (uint32_t)(uintptr_t)bump_alloc(0x40u * 0x44u);
    for (uint32_t s = 0u; s < 0x40u; s++) {
      U32(pTbl + s * 0x44u) = STAGE_UNIT2;
    }
    U32(pArena + 0x04u)       = pTbl;
    U32(STAGE_GAME + 0x1D24u) = pArena;
    U32(pTbl + 0u * 0x44u)    = STAGE_UNIT0;
    U32(pTbl + 5u * 0x44u)    = STAGE_UNIT1;
    uint32_t pTarget = (k == 0) ? STAGE_UNIT0 : (k == 1 ? STAGE_UNIT1 : (k == 2 ? 0xDEAD0001u : 0u));
    c = make_call(); c.eax = STAGE_SCRATCH; c.ecx = STAGE_GAME; c.esi = pTarget; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_GAME; ts[2] = pTarget;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAF5C0u, "D2GAME_ARENA_FindPlayerSlotByUnit113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (k == 3 ? 1 : 0));
  }

  /* 29. 0x6FCB1340 SKILLS_ResolveChargedSrvMissileId113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    if (k >= 2) {
      uint32_t pTbls = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
      uint32_t rec   = U32(pTbls + 0xB98u) + g_skill_chg * 0x23Cu;
      int16_t aSt    = S16(rec + 0x80u);
      int16_t aStat  = S16(rec + 0x54u);
      stage_prog_charge_state(STAGE_UNIT0, aSt, (int32_t)g_skill_chg, 5, aStat, (k == 2) ? 2 : 5);
    }
    int32_t skId = (k == 0) ? -1 : (int32_t)g_skill_chg;
    c = make_call(); c.eax = (uint32_t)skId; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = skId; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB1340u, "SKILLS_ResolveChargedSrvMissileId113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 30. 0x6FCB6F40 PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    if (k >= 1) {
      uint32_t pHold = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      uint32_t pEnt  = (uint32_t)(uintptr_t)bump_alloc(0x40u * 0x0Cu);
      U32(pHold + 0x00u)        = pEnt;
      U32(STAGE_UDATA0 + 0x44u) = pHold;
      if (k == 2) {
        U32(pEnt + 0x08u) = 99u;
        U32(pEnt + 0x14u) = 88u;
      }
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB6F40u, "PETS_ClampAllPlayerPetTypesToDefaultMax_6FCB6F40_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 31. 0x6FCBBEB0 D2GAME_PARTY_GetPartyIdForUnit113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 0) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    } else {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x1001u, 1u, 5000u, 5000u, STAGE_CLIENT);
    }
    if (k == 3) {
      stage_party_ctrl_with_player(STAGE_GAME, 3u, 0x1001u, 0u);
    }
    uint32_t pGame = (k == 1) ? 0u : STAGE_GAME;
    c = make_call(); c.eax = STAGE_UNIT0; c.edi = pGame; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = pGame;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBBEB0u, "D2GAME_PARTY_GetPartyIdForUnit113c", k, lbl, &c, ts, 2u, 0x0000FFFFu, (k <= 1 ? 1 : 0));
  }

  /* 32. 0x6FCBC1F0 PARTY_CountLivingPartyMembersInSameLevel113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 3u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 5000u, 5000u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k >= 1) {
      uint32_t rm1 = (k == 1) ? STAGE_ROOM0 : STAGE_ROOM1;
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, rm1, 1u, 0x102u, 1u, 5002u, 5000u, STAGE_CLIENT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_party_ctrl_with_player(STAGE_GAME, 1u, 0x101u, 0x102u);
    }
    c = make_call(); c.ebx = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBC1F0u, "PARTY_CountLivingPartyMembersInSameLevel113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 33. 0x6FCBE610 AURA_CheckCircleIntersectsRoom113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t x = (k == 2) ? 5300u : 5000u;
    uint32_t y = (k == 1) ? 5300u : 5000u;
    int32_t  r = (k == 1 || k == 2) ? -600 : (k == 3 ? 0 : 10);
    c = make_call(); c.eax = y; c.ecx = STAGE_ROOM0; c.edx = x; c.edi = (uint32_t)r; c.calleePop = 0u;
    ts[0] = (int64_t)y; ts[1] = STAGE_ROOM0; ts[2] = (int64_t)x; ts[3] = (int64_t)r;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBE610u, "AURA_CheckCircleIntersectsRoom113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 34. 0x6FCBF3B0 SKILLS_SetSkillDelayTimer113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_with_chunk(STAGE_GAME, 0u);
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, (int32_t)g_skill_delay, 5, 0, 0, 0);
    if (k == 3) {
      uint32_t ev0 = (uint32_t)(uintptr_t)bump_alloc(0x30u);
      U8(ev0 + 0x00u) = 8u; U16(ev0 + 0x02u) = 1u; U32(ev0 + 0x10u) = 0u; U32(ev0 + 0x14u) = 0xFFFFFFFFu;
      U32(STAGE_UNIT0 + 0xDCu) = ev0;
    }
    int32_t sk = (k == 0) ? -1 : (k == 1 ? 6 : (int32_t)g_skill_delay);
    uint32_t bReset = (k == 3) ? 1u : 0u;
    c = make_call();
    c.eax = (uint32_t)sk; c.ecx = STAGE_GAME;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = 5u; c.args[2] = bReset;
    c.calleePop = 12u;
    ts[0] = sk; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = 5; ts[4] = (int64_t)bReset;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBF3B0u, "SKILLS_SetSkillDelayTimer113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
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
    fprintf(stderr, "[k6-p8] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
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
    fprintf(stderr, "[k6-p8] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p8] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-p8] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();
  discover_p8_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p8] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_group_1_mission1();
  emit_group_2_bandbc();
  emit_group_3_bandbc();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p8] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
