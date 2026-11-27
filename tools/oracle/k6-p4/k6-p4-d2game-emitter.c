/*
 * k6-p4-d2game-emitter.c — [K6-P4] Real-DLL D2Game.dll (0x6FC40000..0x6FCBFFFF) Emitter (150 VAs)
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

static uint32_t g_fake_tick_count   = 0u;
static uint32_t g_fake_qpc_lo       = 0u;
static uint32_t g_fake_qpc_hi       = 0u;
static uint32_t g_d2net_send_ok     = 1u;
static uint32_t g_d2net_client_key  = 0u;

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
typedef int32_t(__stdcall *Com_SerializeItemToBuf_t)(void *pItem, void *pBuf, int32_t nMax, int32_t bSrv, int32_t bSock, int32_t bUnk);
typedef void  (__stdcall *Com_DecodeCompactV96_t)(const void *pBuf, int32_t nLen, int32_t bCoords, void *pHdr);

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
static Com_SerializeItemToBuf_t fn_SerializeItemToBuf = NULL;
static Com_DecodeCompactV96_t   fn_DecodeCompactV96   = NULL;

static uint32_t g_item_sword = 0;
static uint32_t g_item_bow   = 0;
static uint32_t g_item_ring  = 0;
static uint32_t g_item_armor = 0;
static uint32_t g_item_gold  = 0;
static uint32_t g_item_wand  = 0;
static uint32_t g_item_gem   = 0;

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
    fprintf(stderr, "[k6-p4] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
      fprintf(stderr, "[k6-p4] missing Fog.#%u\n", fogHooks[i].ord);
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
    fprintf(stderr, "[k6-p4] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p4] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_PREF_BASE + 0x99000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p4] short read at page %u\n", i);
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
        fprintf(stderr, "[k6-p4] stage json overflow\n");
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

  /* Reset D2Game combat/AI globals between cases */
  U32(game_global_live(D2GAME_PREF_BASE + 0x111F90u)) = 0u;
  U8(game_global_live(D2GAME_PREF_BASE + 0x111F98u))  = 0u;

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

static uint32_t __attribute__((unused)) stage_game_mon_region(uint32_t levelId) {
  uint32_t pReg = (uint32_t)(uintptr_t)bump_alloc(0x2E8u);
  U8(pReg + 0x00u) = 1u;
  U8(pReg + 0x01u) = 5u;
  U32(STAGE_GAME + 0xF0u + levelId * 4u) = pReg;
  if (levelId != 0u && U32(STAGE_GAME + 0xF0u) == 0u) {
    U32(STAGE_GAME + 0xF0u) = pReg;
  }
  return pReg;
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
  U32(pRoom + 0x6Cu)    = 0x2468ACE1u;
  U32(pRoom + 0x70u)    = 0x0000029Au;
  U32(pRoomEx + 0x30u)  = pRoom;
  U32(pRoomEx + 0x58u)  = pLevel;
  U32(pLevel + 0x1B4u)  = STAGE_DRLG0;
  U32(pLevel + 0x1D0u)  = levelId;
}

static void stage_room_with_coll(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  stage_room(pRoom, pRoomEx, pLevel, levelId);
  uint32_t pLog = (uint32_t)(uintptr_t)bump_alloc(0x40u);
  U32(pLog + 0x00u) = 1u;
  U32(pRoomEx + 0x64u) = pLog;
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

static void link_unit_into_room(uint32_t pRoom, uint32_t pUnit) {
  uint32_t prevHead = U32(pRoom + 0x74u);
  U32(pUnit + 0xE8u) = prevHead;
  U32(pRoom + 0x74u) = pUnit;
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
    U32(pUData + 0x2Cu) = 12u;         /* dwItemLevel */
    U16(pUData + 0x30u) = 100u;        /* wItemFormat = 100 (expansion) */
    U8(pUData + 0x45u)  = 0xFFu;       /* nInvPage */
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
            "[k6-p4] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-p4] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-p4] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-p4] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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
    if (!g_item_gold  && code == 0x20646C67u) g_item_gold  = id; /* 'gld ' */
    if (!g_item_wand  && code == 0x20646E77u) g_item_wand  = id; /* 'wnd ' */
    if (!g_item_gem   && code == 0x20766367u) g_item_gem   = id; /* 'gcv ' */
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

static void stage_missile_full(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint16_t x, uint16_t y) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 3u, classId, guid, 0u, x, y, 0x2468ACE1u);
  if (pUData != 0u) {
    U16(pUData + 0x0Au) = 1u;
    U16(pUData + 0x0Cu) = 3u;
    U16(pUData + 0x0Eu) = 20u;
    U16(pUData + 0x10u) = 15u;
  }
}

static void emit_group_1_d2game_p4(void) {
  X86CallSpec c;
  int64_t ts[12];
  char lbl[64];
  memset(ts, 0, sizeof(ts));
  /* OBJECTS_SetUnitField7CDword4_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 10u, 0u, 5000u, 5000u, 0u);
    if (k > 0) U32(STAGE_UNIT0 + 0x7Cu) = STAGE_SCRATCH;
    uint32_t val = 0x111u * (uint32_t)(k + 1);
    c = make_call(); c.ecx = STAGE_UNIT0; c.nargs = 1; c.args[0] = val; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = (int64_t)val;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC4E4F0u, "OBJECTS_SetUnitField7CDword4_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* MONSTER_CountInteractingPlayers113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pInt = STAGE_SCRATCH;
    if (k >= 1) {
      U32(STAGE_SCRATCH) = STAGE_SCRATCH + 0x20u;
      U32(STAGE_SCRATCH + 0x20u) = STAGE_UNIT0;
      if (k == 2) {
        U32(STAGE_SCRATCH + 0x28u) = STAGE_SCRATCH + 0x40u;
        U32(STAGE_SCRATCH + 0x40u) = STAGE_UNIT1;
      }
    }
    c = make_call(); c.ecx = pInt; c.calleePop = 0u;
    ts[0] = pInt;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC68390u, "MONSTER_CountInteractingPlayers113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, (0));
  }
  /* SKILLS_IsDimVisionOrTerrorState113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t stId = (k == 0) ? 0x17u : (k == 1 ? 0x38u : 0x05u);
    c = make_call(); c.eax = stId; c.calleePop = 0u;
    ts[0] = (int64_t)stId;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6DF80u, "SKILLS_IsDimVisionOrTerrorState113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, (0));
  }
  /* MISSILE_DestroyDataAndEvents113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pMis = 0u;
    if (k > 0) {
      pMis = STAGE_UNIT0;
      stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u + (uint32_t)k, 5000u, 5000u);
    }
    c = make_call(); c.esi = pMis; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pMis; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC8F880u, "MISSILE_DestroyDataAndEvents113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* PARTY_CountLivingPartyMemberCallback113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_SCRATCH) = (uint32_t)(k * 3);
    uint32_t pUnit = 0u;
    if (k == 1) {
      pUnit = STAGE_UNIT0;
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    } else if (k == 2) {
      pUnit = STAGE_UNIT0;
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0u, 5000u, 5000u, STAGE_CLIENT);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = pUnit; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pUnit; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBC000u, "PARTY_CountLivingPartyMemberCallback113c", k, lbl, &c, ts, 3u, 0x00000000u, (0));
  }
  /* NET_SendPacket77_ButtonAction_6FCAB340_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t bAct = (k == 1) ? 0x10u : 0x15u;
    c = make_call(); c.eax = bAct; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = (int64_t)bAct; ts[1] = pCli;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAB340u, "NET_SendPacket77_ButtonAction_6FCAB340_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* ARENA_CountPlayersInLevelCallback113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_SCRATCH + 0x00u) = (k == 1) ? 2u : 5u;
    U32(STAGE_SCRATCH + 0x04u) = (uint32_t)k;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAF410u, "ARENA_CountPlayersInLevelCallback113c", k, lbl, &c, ts, 3u, 0x00000000u, (0));
  }
  /* SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 1) ? 0x0Cu : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, mode, 5000u, 5000u, 0u);
    U32(STAGE_UNIT0 + 0xC4u) = 0x00001004u;
    U32(STAGE_SCRATCH + 0x00u) = 0x1002u;
    U32(STAGE_SCRATCH + 0x0Cu) = 5000u;
    U32(STAGE_SCRATCH + 0x10u) = 5000u;
    U32(STAGE_SCRATCH + 0x14u) = 10u;
    uint32_t pU = (k == 2) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ecx = pU; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = pU; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBE2E0u, "SKILLS_CorpseSearchFilterCallback_6FCBE2E0_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* S2C_QueueByteDwordPacket6_6FCAC3B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t bPkt = 0x1Fu;
    uint32_t bSub = (uint32_t)(k + 1);
    uint32_t dwVal = 0x10203040u + (uint32_t)k;
    c = make_call(); c.eax = bPkt; c.ecx = bSub; c.edx = dwVal; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = (int64_t)bPkt; ts[1] = (int64_t)bSub; ts[2] = (int64_t)(int32_t)dwVal; ts[3] = pCli;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAC3B0u, "S2C_QueueByteDwordPacket6_6FCAC3B0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, (0));
  }
  /* MONSTER_IsNextModeEndWithin5Frames113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    if (k >= 1) {
      U8(STAGE_SCRATCH + 0x00u)  = 1u;
      U32(STAGE_SCRATCH + 0x04u) = (k == 1) ? 90u : 98u;
      U32(STAGE_UNIT0 + 0xDCu)   = STAGE_SCRATCH;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC97E00u, "MONSTER_IsNextModeEndWithin5Frames113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* ROOM_WakeRoomMonsters113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    }
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 11u, 1u, 5002u, 5002u, 0u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    c = make_call(); c.eax = STAGE_ROOM0; c.esi = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_ROOM0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBD950u, "ROOM_WakeRoomMonsters113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* MONSTER_CheckTypeFlagsMask113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U16(STAGE_UDATA0 + 0x16u) = 0x0008u;
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t wM = (k == 1) ? 0x0008u : 0x0004u;
    c = make_call(); c.eax = pU; c.nargs = 1; c.args[0] = wM; c.calleePop = 4u;
    ts[0] = pU; ts[1] = (int64_t)wM;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC42A80u, "MONSTER_CheckTypeFlagsMask113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* D2NET_SendPacket0x06BytesToClient113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH + 0x00u) = 0x11223344u + (uint32_t)k;
    U16(STAGE_SCRATCH + 0x04u) = (uint16_t)(0x5566u + (uint32_t)k);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call(); c.eax = STAGE_SCRATCH; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = pCli;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAA770u, "D2NET_SendPacket0x06BytesToClient113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* NET_SendPacketBuffer6B_6FCAACD0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH + 0x00u) = 0xA1B2C3D4u + (uint32_t)k;
    U16(STAGE_SCRATCH + 0x04u) = (uint16_t)(0x0102u + (uint32_t)k);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call(); c.eax = STAGE_SCRATCH; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = pCli;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAACD0u, "NET_SendPacketBuffer6B_6FCAACD0_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* SUMMON_GetPetTypeBucketPtr_6FCB6540_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH) = STAGE_SCRATCH + 0x100u;
    int32_t nType = (k == 0) ? -1 : k;
    c = make_call(); c.eax = (uint32_t)nType; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = nType; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB6540u, "SUMMON_GetPetTypeBucketPtr_6FCB6540_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* UNITROOM_IsClientInUnitRoom113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_ROOM0 + 0x48u) = STAGE_SCRATCH;
    U32(STAGE_SCRATCH) = STAGE_CLIENT;
    U32(STAGE_ROOM0 + 0x78u) = (k == 0) ? 0u : 1u;
    uint32_t pCli = (k == 2) ? STAGE_CLIENT1 : STAGE_CLIENT;
    c = make_call(); c.eax = STAGE_UNIT0; c.esi = pCli; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = pCli;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC69A50u, "UNITROOM_IsClientInUnitRoom113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* CLIENTS_GetClientGame_6FC69A80_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_CLIENT1 + 0x1A8u) = 0u;
    uint32_t pCli = (k == 0) ? 0u : (k == 1 ? STAGE_CLIENT : STAGE_CLIENT1);
    c = make_call(); c.eax = pCli; c.calleePop = 0u;
    ts[0] = pCli;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC69A80u, "CLIENTS_GetClientGame_6FC69A80_113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }
  /* SPLAYER_GetClientActNo113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U8(STAGE_CLIENT + 0x1ACu) = (uint8_t)(k + 1);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call(); c.eax = pCli; c.calleePop = 0u;
    ts[0] = pCli;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC69DB0u, "SPLAYER_GetClientActNo113c", k, lbl, &c, ts, 1u, 0x000000FFu, (k == 0 ? 1 : 0));
  }
  /* NET_SendPacketBuffer40B_6FCAB3D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    for (uint32_t i = 0u; i < 10u; i++) U32(STAGE_SCRATCH + i * 4u) = 0x100u * (uint32_t)(k + 1) + i;
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call(); c.eax = STAGE_SCRATCH; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = pCli;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAB3D0u, "NET_SendPacketBuffer40B_6FCAB3D0_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* SUNIT_FindItemEventNode113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_SCRATCH + 0x04u) = 3u; U32(STAGE_SCRATCH + 0x08u) = 100u; U32(STAGE_SCRATCH + 0x0Cu) = 7u;
    U32(STAGE_SCRATCH + 0x1Cu) = STAGE_SCRATCH + 0x40u;
    U32(STAGE_SCRATCH + 0x44u) = 5u; U32(STAGE_SCRATCH + 0x48u) = 200u; U32(STAGE_SCRATCH + 0x4Cu) = 9u;
    U32(STAGE_UNIT0 + 0x90u) = STAGE_SCRATCH;
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t evT = (k == 1) ? 3u : 5u;
    uint32_t gId = (k == 1) ? 100u : 200u;
    uint32_t p0c = (k == 1) ? 7u : 9u;
    c = make_call(); c.eax = pU; c.edx = evT; c.edi = gId; c.esi = p0c; c.calleePop = 0u;
    ts[0] = pU; ts[1] = (int64_t)evT; ts[2] = (int64_t)gId; ts[3] = (int64_t)p0c;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC570E0u, "SUNIT_FindItemEventNode113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, (0));
  }
  /* MISSILE_MatchTargetCollideKillMode113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t mode = (uint32_t)k;
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = mode; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = (int64_t)mode;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC58FB0u, "MISSILE_MatchTargetCollideKillMode113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* PLRTRADE_IsInteractingWithValidPlayer113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 2u, 5u, 5002u, 5002u, STAGE_CLIENT1);
    if (k >= 1) {
      U32(STAGE_UNIT0 + 0x64u) = 2u;
      U32(STAGE_UNIT0 + 0x68u) = 0u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
    }
    if (k == 2) insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    c = make_call(); c.ecx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC90D60u, "PLRTRADE_IsInteractingWithValidPlayer113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* MONSTER_ClearStepEvents113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 2) {
      /* Pre-populate an active step event (type=0, arg14=0) via EVENT_CreateNode layout */
      uint32_t pTimer = U32(STAGE_GAME + 0xB8u);
      uint32_t pChunk = U32(pTimer + 0xA1Cu);
      U8(pChunk + 0x00u)  = 0u;
      U32(pChunk + 0x04u) = 110u;
      U32(pChunk + 0x08u) = STAGE_UNIT0;
      U32(pChunk + 0x0Cu) = 10u;
      U32(pChunk + 0x10u) = 1u;
      U32(pChunk + 0x14u) = 0u;
      U32(pTimer + 0xA1Cu) = U32(pChunk + 0x1Cu);
      U32(pChunk + 0x1Cu) = 0u;
      U32(STAGE_UNIT0 + 0xDCu) = pChunk;
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = pU; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = pU;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC95320u, "MONSTER_ClearStepEvents113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* AIGENERAL_GetPackLeaderUnit113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 20u, 1u, 5002u, 5002u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    U32(pAiGen + 0x28u) = STAGE_GAME;
    U32(pAiGen + 0x2Cu) = (k == 1) ? 20u : 99u;
    U32(pAiGen + 0x30u) = 1u;
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ecx = pU; c.calleePop = 0u;
    ts[0] = pU;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC41260u, "AIGENERAL_GetPackLeaderUnit113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, (0));
  }
  /* PLAYER_IsBusyWithCursorOrNpcInteract113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    if (k == 1) U8(STAGE_UNIT0 + 0x6Cu) = 1u;
    if (k == 2) U32(STAGE_UDATA0 + 0x4Cu) = 7u;
    uint32_t pP = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.esi = pP; c.calleePop = 0u;
    ts[0] = pP;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57680u, "PLAYER_IsBusyWithCursorOrNpcInteract113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, (0));
  }
  /* MONSTER_GetSuperUniqueId113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U8(STAGE_UDATA0 + 0x16u)  = (k == 1) ? 0x02u : 0x00u;
    U16(STAGE_UDATA0 + 0x26u) = 5u;
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = pU; c.calleePop = 0u;
    ts[0] = pU;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC43220u, "MONSTER_GetSuperUniqueId113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, (0));
  }
  /* NET_ShouldSyncTrackedStatDelta_6FCAA330_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH + 0x04u) = 100u;
    U8(STAGE_SCRATCH + 0x0Cu)  = 2u;
    uint32_t nVal = (k == 0) ? 100u : (k == 1 ? 103u : 120u);
    c = make_call(); c.eax = STAGE_SCRATCH; c.edx = nVal; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH; ts[1] = (int64_t)(int32_t)nVal;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAA330u, "NET_ShouldSyncTrackedStatDelta_6FCAA330_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 0u, 5000u, 5000u, 0u);
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)(k * 20);
    uint32_t uMod = (k == 1) ? 5u : 0x12u;
    uint32_t bUniq = (k == 2) ? 1u : 0u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = uMod; c.args[1] = bUniq; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int64_t)uMod; ts[3] = (int64_t)bUniq;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC41A90u, "MONUMOD_ScheduleDeathEvent4UnlessMod18_6FC41A90_113c", k, lbl, &c, ts, 4u, 0x00000000u, (0));
  }
  /* MONUMOD_ApplyChampionFanaticStats_6FC43810_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 2560, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 2560, 0);
    uint32_t uMod = (k == 2) ? 0x24u : 0x25u;
    uint32_t bBoss = (k == 0) ? 0u : 1u;
    c = make_call(); c.ecx = STAGE_UNIT0; c.edx = uMod; c.nargs = 1; c.args[0] = bBoss; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = (int64_t)uMod; ts[2] = (int64_t)bBoss;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC43810u, "MONUMOD_ApplyChampionFanaticStats_6FC43810_113c", k, lbl, &c, ts, 3u, 0x00000000u, (0));
  }
  /* QUESTS_GuidListAdd113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    if (k >= 1) {
      U32(STAGE_SCRATCH + 0x00u) = 0x11u;
      U16(STAGE_SCRATCH + 0x80u) = 1u;
    }
    uint32_t guid = (k == 2) ? 0x22u : 0x11u;
    c = make_call(); c.eax = STAGE_SCRATCH; c.esi = guid; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH; ts[1] = (int64_t)guid;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC53880u, "QUESTS_GuidListAdd113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* QUESTS_GuidListRemove113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    if (k >= 1) {
      U32(STAGE_SCRATCH + 0x00u) = 0x11u;
      U32(STAGE_SCRATCH + 0x04u) = 0x22u;
      U16(STAGE_SCRATCH + 0x80u) = 2u;
    }
    uint32_t guid = (k == 1) ? 0x11u : 0x99u;
    c = make_call(); c.ecx = STAGE_SCRATCH; c.eax = guid; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH; ts[1] = (int64_t)guid;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC53830u, "QUESTS_GuidListRemove113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* QUESTS_FreeUnitQuestChain113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    if (k >= 1) {
      U32(STAGE_UNIT0 + 0x90u) = STAGE_SCRATCH;
      U32(STAGE_SCRATCH + 0x04u) = 0x55u + (uint32_t)k;
      if (k == 2) U32(STAGE_SCRATCH + 0x1Cu) = STAGE_SCRATCH + 0x40u;
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.edi = STAGE_GAME; c.ebx = pU; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = pU;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57220u, "QUESTS_FreeUnitQuestChain113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* PLRTRADE_CountCubePageItemsInInventory113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    if (k >= 1) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 50u, 0u, 2u, 0u, 0u, 0u);
      U8(STAGE_UDATA1 + 0x45u) = (k == 1) ? 3u : 0u;
      U32(pInv + 0x0Cu) = STAGE_UNIT1;
    }
    c = make_call(); c.eax = pInv; c.calleePop = 0u;
    ts[0] = pInv;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC90190u, "PLRTRADE_CountCubePageItemsInInventory113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, (0));
  }
  /* ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_SCRATCH + 0x14u) = (k == 0) ? 0x94u : 0x9Bu;
    U16(STAGE_SCRATCH + 0x18u) = (k == 2) ? 5u : 0u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC82490u, "ACT1Q0_Callback12_WarrivIntroSetState0_6FC82490_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* EVENT_GetNextEventFrame113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U8(STAGE_SCRATCH + 0x00u)  = 2u;
    U32(STAGE_SCRATCH + 0x04u) = 150u;
    U32(STAGE_SCRATCH + 0x24u) = STAGE_SCRATCH + 0x40u;
    U8(STAGE_SCRATCH + 0x40u)  = 2u;
    U32(STAGE_SCRATCH + 0x44u) = 120u;
    U32(STAGE_UNIT0 + 0xDCu)   = STAGE_SCRATCH;
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t t  = (k == 1) ? 2u : 3u;
    c = make_call(); c.eax = pU; c.esi = t; c.calleePop = 0u;
    ts[0] = pU; ts[1] = (int64_t)t;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAE490u, "EVENT_GetNextEventFrame113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* ITEMS_RegisterItemEventCallback113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    int32_t evId = (k == 0) ? -1 : k;
    uint32_t guid = 50u + (uint32_t)k;
    c = make_call();
    c.eax = (uint32_t)evId; c.ecx = guid; c.edx = 4u; c.esi = STAGE_UNIT0;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = 2u; c.args[2] = 11u + (uint32_t)k; c.args[3] = 22u;
    c.calleePop = 0x10u;
    ts[0] = evId; ts[1] = (int64_t)guid; ts[2] = 4; ts[3] = STAGE_UNIT0;
    ts[4] = STAGE_GAME; ts[5] = 2; ts[6] = 11 + k; ts[7] = 22;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBE290u, "ITEMS_RegisterItemEventCallback113c", k, lbl, &c, ts, 8u, 0xFFFFFFFFu, (0));
  }
  /* NET_SendPacket60_PortalInfo_6FCAAAE0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x3Bu, 0x55u + (uint32_t)k, 2u, 5000u, 5000u, 0u);
    U8(STAGE_UDATA0 + 0x04u) = (uint8_t)(2u + (uint32_t)k);
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call(); c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pCli;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAAAE0u, "NET_SendPacket60_PortalInfo_6FCAAAE0_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* MONSTER_PromotePlayerInteractToTradeState113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_UDATA0 + 0x30u) = STAGE_SCRATCH;
    if (k >= 1) {
      U32(STAGE_SCRATCH)         = STAGE_SCRATCH + 0x20u;
      U32(STAGE_SCRATCH + 0x20u) = STAGE_UNIT1;
      U32(STAGE_SCRATCH + 0x24u) = (k == 1) ? 1u : 0u;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC68710u, "MONSTER_PromotePlayerInteractToTradeState113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* MONSTER_IsPlayerInteractInTradeState113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_UDATA0 + 0x30u) = STAGE_SCRATCH;
    if (k >= 1) {
      U32(STAGE_SCRATCH)         = STAGE_SCRATCH + 0x20u;
      U32(STAGE_SCRATCH + 0x20u) = STAGE_UNIT1;
      U32(STAGE_SCRATCH + 0x24u) = (k == 1) ? 2u : 1u;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC686D0u, "MONSTER_IsPlayerInteractInTradeState113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 1) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 10u, mode, 5000u, 5000u, 0u);
    uint32_t pO = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = pO; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = pO;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC89DA0u, "OBJ_FinishOperatingToOpenedMode_6FC89DA0_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
}

static void emit_group_2_d2game_p4(void) {
  X86CallSpec c;
  int64_t ts[12];
  char lbl[64];
  memset(ts, 0, sizeof(ts));
  /* MISSILE_CollideFilterPlayerOrMonster113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_UNIT0 + 0xC4u) = 0x0000000Cu;
    if (k == 2) U32(STAGE_UNIT0 + 0x00u) = 2u;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 20u, 5000u, 5000u);
    uint32_t pTables = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
    uint32_t pMisTxt = U32(pTables + 0xB64u) + 1u * 0x1A4u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x08u) = 0u;
    U32(STAGE_SCRATCH + 0x0Cu) = pMisTxt;
    uint32_t pCtx = (k == 0) ? 0u : STAGE_SCRATCH;
    c = make_call(); c.ecx = STAGE_UNIT0; c.edx = pCtx; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = pCtx;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC5AD30u, "MISSILE_CollideFilterPlayerOrMonster113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* PLAYER_SetPlayerDataField48_6FC57480_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pP = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t val = 0x50u + (uint32_t)k;
    c = make_call(); c.eax = pP; c.nargs = 1; c.args[0] = val; c.calleePop = 4u;
    ts[0] = pP; ts[1] = (int64_t)val;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57480u, "PLAYER_SetPlayerDataField48_6FC57480_113c", k, lbl, &c, ts, 2u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* MONSTER_SavePrevMode113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_UDATA0 + 0x54u) = (k == 0) ? 20u : (k == 1 ? 13u : 2u);
    uint32_t prevM = (k == 1) ? 3u : 5u;
    c = make_call(); c.ecx = STAGE_UNIT0; c.eax = prevM; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = (int64_t)prevM;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC95260u, "MONSTER_SavePrevMode113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* NET_SendPacket103B_QuestRecord_6FCAAD40_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pQ = alloc_quest_record();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t guid = 10u + (uint32_t)k;
    c = make_call();
    c.eax = 0x28u; c.ecx = 1u; c.edx = guid;
    c.nargs = 3; c.args[0] = pCli; c.args[1] = pQ; c.args[2] = (uint32_t)k;
    c.calleePop = 0x0Cu;
    ts[0] = 0x28; ts[1] = 1; ts[2] = (int64_t)guid; ts[3] = pCli; ts[4] = pQ; ts[5] = k;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAAD40u, "NET_SendPacket103B_QuestRecord_6FCAAD40_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, (0));
  }
  /* QUESTS_GetQuestData_6FC53F30_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL)      = STAGE_QUEST0;
    U32(STAGE_QUEST0)         = 5u;
    int32_t qId = (k == 0) ? -1 : (k == 1 ? 5 : 9);
    c = make_call(); c.eax = STAGE_GAME; c.ecx = (uint32_t)qId; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = qId;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC53F30u, "QUESTS_GetQuestData_6FC53F30_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }
  /* MONSTER_StartGetHitMode113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 0) ? 0u : 1u;
    uint32_t clsId = (k == 2) ? 0x160u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, clsId, 10u, mode, 5000u, 5000u, 0u);
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC95210u, "MONSTER_StartGetHitMode113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* QUESTS_CheckGlobalQuestState_6FC538D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pQ = alloc_quest_record();
    U32(STAGE_GAME + 0x10F4u)      = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x08u)   = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu)   = pQ;
    if (k == 2) {
      uint32_t pBuf = U32(pQ);
      U8(pBuf + 0u) = 0x02u; /* quest 0 state 1 */
    }
    c = make_call(); c.eax = STAGE_GAME; c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = 0; ts[2] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC538D0u, "QUESTS_CheckGlobalQuestState_6FC538D0_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }
  /* QUESTS_SetGlobalQuestState_6FC53920_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pQ = alloc_quest_record();
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x08u) = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = pQ;
    uint32_t st = (uint32_t)k;
    c = make_call(); c.eax = STAGE_GAME; c.nargs = 2; c.args[0] = 1u; c.args[1] = st; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = 1; ts[2] = (int64_t)st;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC53920u, "QUESTS_SetGlobalQuestState_6FC53920_113c", k, lbl, &c, ts, 3u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 1u : 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 20u, 0x0Cu, 5002u, 5002u, 0u);
    U32(STAGE_UNIT1 + 0xC4u) = 0x00001004u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 95u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 95; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6EF20u, "SKILLS_SrvSt15_CheckRevivableCorpseOutsideTown_6FC6EF20_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, (0));
  }
  /* AIGENERAL_InitBossGroup113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t bMem = (k == 1) ? 1u : 0u;
    uint32_t bBoss = (k == 2) ? 1u : 0u;
    c = make_call();
    c.eax = pU; c.edx = 1u;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = 55u + (uint32_t)k; c.args[2] = bMem; c.args[3] = bBoss;
    c.calleePop = 0x10u;
    ts[0] = pU; ts[1] = 1; ts[2] = STAGE_GAME; ts[3] = 55 + k; ts[4] = (int64_t)bMem; ts[5] = (int64_t)bBoss;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC40D90u, "AIGENERAL_InitBossGroup113c", k, lbl, &c, ts, 6u, 0x00000000u, (0));
  }
  /* QUESTS_CountLivingUnitsInRoomCallback113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_SCRATCH) = 10u;
    uint32_t mode = (k == 2) ? 0u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, mode, 5000u, 5000u, 0u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.edx = pU; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = pU; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57810u, "QUESTS_CountLivingUnitsInRoomCallback113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* PLAYER_SetClientSkillHotkeySlot113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pP = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t slot = (uint32_t)k;
    c = make_call();
    c.eax = pP; c.esi = slot;
    c.nargs = 3; c.args[0] = 36u + (uint32_t)k; c.args[1] = (uint32_t)(k & 1); c.args[2] = 0xFFFFFFFFu;
    c.calleePop = 0x0Cu;
    ts[0] = pP; ts[1] = (int64_t)slot; ts[2] = 36 + k; ts[3] = k & 1; ts[4] = -1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57890u, "PLAYER_SetClientSkillHotkeySlot113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, (0));
  }
  /* MISSILES_AddElemDamageByEType_6FC59260_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t misId = (k == 1) ? 6u : 22u; /* Fire bolt vs Ice bolt */
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, misId, 20u, 5000u, 5000u);
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t amt = 256u * (uint32_t)(k + 1);
    c = make_call(); c.eax = pM; c.esi = STAGE_DMG; c.edi = amt; c.calleePop = 0u;
    ts[0] = pM; ts[1] = STAGE_DMG; ts[2] = (int64_t)amt;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC59260u, "MISSILES_AddElemDamageByEType_6FC59260_113c", k, lbl, &c, ts, 3u, 0x00000000u, (0));
  }
  /* ACT1Q4_CheckCainTownNpcAlert113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 7u, 5u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_QUEST0 + 0x18u)   = STAGE_QUESTEX0;
    U32(STAGE_QUESTEX0 + 0x34u) = 7u;
    U16(STAGE_QUESTEX0 + 0x64u) = (k == 0) ? 0u : 1u;
    uint32_t npcId = (k == 1) ? 0x94u : 0x9Bu;
    c = make_call();
    c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = 0u; c.args[2] = 0u;
    c.calleePop = 0x0Cu;
    ts[0] = STAGE_QUEST0; ts[1] = (int64_t)npcId; ts[2] = STAGE_UNIT0; ts[3] = 0; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC80F20u, "ACT1Q4_CheckCainTownNpcAlert113c", k, lbl, &c, ts, 5u, 0x000000FFu, (0));
  }
  /* PLAYER_SetNeutralOrTownNeutralMode113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t lvl = (k == 1) ? 1u : 2u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 0) ? 0u : STAGE_ROOM0, 0u, 1u, 2u, 5000u, 5000u, STAGE_CLIENT);
    if (k == 0) U32(STAGE_PATH0 + 0x1Cu) = 0u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = 3u; c.args[1] = 0u; c.args[2] = 0u;
    c.calleePop = 0x0Cu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 3; ts[3] = 0; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC982F0u, "PLAYER_SetNeutralOrTownNeutralMode113c", k, lbl, &c, ts, 5u, 0x00000000u, (0));
  }
  /* OBJECTS_InitFn22_InitBrazierAndScheduleEvent0_6FC536F0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 1) ? 0u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 19u, 10u, mode, 5000u, 5000u, 0u);
    U32(STAGE_GAME + 0xA8u)    = 100u + (uint32_t)(k * 10);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    U32(STAGE_SCRATCH + 0x10u) = U32(STAGE_UDATA0);
    c = make_call(); c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC536F0u, "OBJECTS_InitFn22_InitBrazierAndScheduleEvent0_6FC536F0_113c", k, lbl, &c, ts, 1u, 0x00000000u, (0));
  }
  /* CURSES_ScaleImmuneMonsterResistPenalty113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 39, (k == 2) ? 110 : 50, 0);
    uint32_t statId = (k == 0) ? 10u : 39u;
    int32_t val = -50;
    c = make_call(); c.edi = statId; c.ebx = (uint32_t)val; c.esi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)statId; ts[1] = val; ts[2] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6E230u, "CURSES_ScaleImmuneMonsterResistPenalty113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (0));
  }
  /* NET_SendPacket47_UnitRelator1_6FCAAEC0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u + (uint32_t)k, 1u, 5000u, 5000u, 0u);
    uint32_t pU   = (k == 1) ? 0u : STAGE_UNIT0;
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call(); c.eax = pU; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = pU; ts[1] = pCli;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAAEC0u, "NET_SendPacket47_UnitRelator1_6FCAAEC0_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pPair = U32(STAGE_UDATA0 + 0x60u);
    uint32_t pHold = U32(pPair);
    uint32_t pBits = U32(pHold);
    U8(pBits) = (k == 1) ? 0xFFu : 0x00u;
    uint32_t npcId = (k == 2) ? 0x94u : 0x93u;
    c = make_call(); c.eax = STAGE_UNIT0; c.esi = npcId; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = (int64_t)npcId; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC89590u, "QUESTS_GetPlayerNpcIntroFlag_6FC89590_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (0));
  }
  /* SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 2u, 5000u, 5000u, 0u);
    int32_t velPct = 15 + k * 10;
    c = make_call(); c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = (uint32_t)velPct; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = velPct;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBE7B0u, "SKILLS_ApplyVelocityStatListAndRefreshAnimMode_6FCBE7B0_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* QUESTS_SendQuestItemState2_5D_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pP = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t qId = (uint32_t)(k + 1);
    c = make_call(); c.eax = pP; c.nargs = 1; c.args[0] = qId; c.calleePop = 4u;
    ts[0] = pP; ts[1] = (int64_t)qId;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC54B20u, "QUESTS_SendQuestItemState2_5D_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* PLAYER_SetActiveDualWeaponStatLists113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 50u, 1u, 2u, 0u, 0u, 0u);
    fn_PlaceItemInBodyLoc((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1, 4);
    uint32_t bEn = (k == 0) ? 0u : 1u;
    if (k >= 1) {
      void *pSub = fn_AllocStatList(NULL, 0x40u, 0u, 4, 50);
      fn_SetStatIfValid(pSub, 21, 10 * k, 0u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT1, pSub, 0);
    }
    c = make_call(); c.eax = bEn; c.ebx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)bEn; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57260u, "PLAYER_SetActiveDualWeaponStatLists113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* NET_SendPacket7A_SummonChange_6FCAB290_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call();
    c.ecx = (uint32_t)(k & 1);
    c.nargs = 5; c.args[0] = pCli; c.args[1] = 2u; c.args[2] = 100u + (uint32_t)k; c.args[3] = 1u; c.args[4] = 70u;
    c.calleePop = 0x14u;
    ts[0] = k & 1; ts[1] = pCli; ts[2] = 2; ts[3] = 100 + k; ts[4] = 1; ts[5] = 70;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAB290u, "NET_SendPacket7A_SummonChange_6FCAB290_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, (0));
  }
  /* NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u + (uint32_t)k, 1u, 5000u, 5000u, 0u);
    uint32_t pU   = (k == 1) ? 0u : STAGE_UNIT0;
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call(); c.eax = pU; c.nargs = 2; c.args[0] = pCli; c.args[1] = (uint32_t)k; c.calleePop = 8u;
    ts[0] = pU; ts[1] = pCli; ts[2] = k;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAAE60u, "NET_SendPacket48_UnitRequestStatus_6FCAAE60_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (0));
  }
  /* S2C_SendPacket0E_UnitCorpseState113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call();
    c.ecx = 0x0Eu; c.edx = 10u + (uint32_t)k;
    c.nargs = 6; c.args[0] = pCli; c.args[1] = (uint32_t)k; c.args[2] = 5000u; c.args[3] = 5004u; c.args[4] = 1u; c.args[5] = 0u;
    c.calleePop = 0x18u;
    ts[0] = 0x0E; ts[1] = 10 + k; ts[2] = pCli; ts[3] = k; ts[4] = 5000; ts[5] = 5004; ts[6] = 1; ts[7] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAC100u, "S2C_SendPacket0E_UnitCorpseState113c", k, lbl, &c, ts, 8u, 0x00000000u, (0));
  }
  /* QUESTS_AddNpcDialogTextNodes113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pHdr = STAGE_SCRATCH;
    uint32_t pTbl = STAGE_SCRATCH + 0x100u;
    U32(STAGE_QUEST0 + 0xDCu) = pTbl;
    U32(pTbl + 0x00u) = 0x94u; U16(pTbl + 0x04u) = 0x1234u; U32(pTbl + 0x08u) = 1u;
    U32(pTbl + 0x0Cu) = 0x94u; U16(pTbl + 0x10u) = 0x1235u; U32(pTbl + 0x14u) = 2u;
    U32(pTbl + 0xC0u) = (k == 0) ? 0u : (uint32_t)k;
    c = make_call(); c.ecx = STAGE_QUEST0; c.eax = 0u; c.nargs = 2; c.args[0] = pHdr; c.args[1] = 0x94u; c.calleePop = 8u;
    ts[0] = STAGE_QUEST0; ts[1] = 0; ts[2] = pHdr; ts[3] = 0x94;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC53EB0u, "QUESTS_AddNpcDialogTextNodes113c", k, lbl, &c, ts, 4u, 0x00000000u, (0));
  }
  /* SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    if (k >= 1) {
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, (k == 1) ? 145 : 36, 3, 0, 0, 0); /* 145=Iron Skin passive */
    }
    c = make_call(); c.ebx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBE370u, "SKILLS_RefreshPassiveSkillsAndIconsOnUnit_6FCBE370_113c", k, lbl, &c, ts, 1u, 0x00000000u, (0));
  }
  /* QUESTS_SendGameQuestStatePacket29_6FC55030_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pQ = alloc_quest_record();
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x08u) = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = pQ;
    uint32_t pCli = (k == 1) ? STAGE_CLIENT : 0u;
    c = make_call(); c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = pCli; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pCli;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC55030u, "QUESTS_SendGameQuestStatePacket29_6FC55030_113c", k, lbl, &c, ts, 2u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 10u, 1u, 5002u, 5002u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pAiGen = U32(STAGE_UDATA1 + 0x28u);
    U32(pAiGen + 0x28u) = STAGE_GAME;
    U32(pAiGen + 0x2Cu) = 1u;
    U32(pAiGen + 0x30u) = 0u;
    U32(STAGE_UDATA1 + 0x40u) = 50u;
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t nVal = (k == 1) ? 50u : 80u;
    c = make_call(); c.eax = STAGE_UNIT1; c.ecx = pPlr; c.edx = nVal; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT1; ts[1] = pPlr; ts[2] = (int64_t)nVal; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAE110u, "NET_ShouldSyncUnitStatDeltaToPlayer_6FCAE110_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }
  /* MISSILES_InitChargedBoltPath_6FC61F50_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u);
    U16(STAGE_UDATA0 + 0x0Eu) = (k == 2) ? 90u : 20u;
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ecx = pM; c.edx = (uint32_t)(k * 7); c.calleePop = 0u;
    ts[0] = pM; ts[1] = k * 7;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC61F50u, "MISSILES_InitChargedBoltPath_6FC61F50_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* AIGENERAL_LinkMinionToLeader113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 20u + (uint32_t)k, 1u, 5002u, 5002u, 0u);
    uint32_t pLdr = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pMin = (k == 2) ? 0u : STAGE_UNIT1;
    c = make_call(); c.eax = pLdr; c.edi = pMin; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pLdr; ts[1] = pMin; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC40CF0u, "AIGENERAL_LinkMinionToLeader113c", k, lbl, &c, ts, 3u, 0x00000000u, (0));
  }
  /* NET_SendPacket81_AssignMerc_6FCAB220_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call();
    c.edx = 200u + (uint32_t)k;
    c.nargs = 6; c.args[0] = pCli; c.args[1] = 1u; c.args[2] = 1u; c.args[3] = 0x10F; c.args[4] = 0x123456u; c.args[5] = 99u;
    c.calleePop = 0x18u;
    ts[0] = 200 + k; ts[1] = pCli; ts[2] = 1; ts[3] = 1; ts[4] = 0x10F; ts[5] = 0x123456; ts[6] = 99;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAB220u, "NET_SendPacket81_AssignMerc_6FCAB220_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, (0));
  }
  /* ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_PREF_BASE + 0x10F0C8u, 0x48u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 50u, 0u, 2u, 0u, 0u, 0u);
    U32(STAGE_UNIT0 + 0xC8u)  = 0xFFFFFFFFu;
    U32(STAGE_UDATA0 + 0x14u) = (k == 1) ? 0xFFFFFFFFu : 0x00000010u;
    uint32_t pI = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.edi = pI; c.calleePop = 0u;
    ts[0] = pI;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBB340u, "ITEMS_ClearAllDupeAndCommandFlags_6FCBB340_113c", k, lbl, &c, ts, 1u, 0x00000000u, (0));
  }
  /* MISSILES_SrvHit_RollKnockbackResult_6FC59670_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u);
    U32(STAGE_UNIT0 + 0x20u) = 0x10000001u + (uint32_t)(k * 0x12345u);
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = pM; c.nargs = 2; c.args[0] = 0u; c.args[1] = STAGE_DMG; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pM; ts[2] = 0; ts[3] = STAGE_DMG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC59670u, "MISSILES_SrvHit_RollKnockbackResult_6FC59670_113c", k, lbl, &c, ts, 4u, 0x00000000u, (0));
  }
  /* ROOM_SleepRoomMonsters113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
      if (k == 2) {
        uint32_t pTimer = U32(STAGE_GAME + 0xB8u);
        uint32_t pChunk = U32(pTimer + 0xA1Cu);
        U8(pChunk + 0x00u) = 2u; U32(pChunk + 0x04u) = 110u; U32(pChunk + 0x08u) = STAGE_UNIT0;
        U32(pTimer + 0xA1Cu) = U32(pChunk + 0x1Cu);
        U32(pChunk + 0x1Cu) = 0u;
        U32(STAGE_UNIT0 + 0xDCu) = pChunk;
      }
    }
    c = make_call(); c.eax = STAGE_ROOM0; c.ecx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_ROOM0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBD8E0u, "ROOM_SleepRoomMonsters113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* S2C_SendPacket0D_UnitStop113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call();
    c.ecx = 0x6Cu; c.edx = 10u + (uint32_t)k;
    c.nargs = 7; c.args[0] = pCli; c.args[1] = 1u; c.args[2] = 0u; c.args[3] = 2u; c.args[4] = (uint32_t)k; c.args[5] = 5000u; c.args[6] = 5002u;
    c.calleePop = 0x1Cu;
    ts[0] = 0x6C; ts[1] = 10 + k; ts[2] = pCli; ts[3] = 1; ts[4] = 0; ts[5] = 2; ts[6] = k; ts[7] = 5000; ts[8] = 5002;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAC090u, "S2C_SendPacket0D_UnitStop113c", k, lbl, &c, ts, 9u, 0x00000000u, (0));
  }
  /* MONSTER_ApplyModeVelocityOverride113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 2u, 5000u, 5000u, 0u);
    U32(STAGE_SCRATCH + 0x10u) = (k == 0) ? 0u : (uint32_t)(10 + k * 5);
    c = make_call(); c.eax = STAGE_SCRATCH; c.edi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC94CE0u, "MONSTER_ApplyModeVelocityOverride113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* EVENT_CreateNodeWithGrowth113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u + (uint32_t)k, 1u, 5000u, 5000u, 0u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = STAGE_GAME; c.ecx = pU; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = pU;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAE680u, "EVENT_CreateNodeWithGrowth113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* QUESTS_AttachQuestToUnit_6FC53F80_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t pQ = (k == 0) ? 0u : STAGE_QUEST0;
    if (k == 2) {
      U32(STAGE_SCRATCH) = STAGE_QUEST0;
      U32(STAGE_UNIT0 + 0x74u) = STAGE_SCRATCH;
    }
    c = make_call(); c.esi = pQ; c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pQ; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC53F80u, "QUESTS_AttachQuestToUnit_6FC53F80_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }
  /* UNITMSG_QueuePacket23SetSkill_6FC9A020_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    c = make_call();
    c.esi = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = (uint32_t)(k & 1); c.args[1] = 36u + (uint32_t)k; c.args[2] = 0xFFFFFFFFu;
    c.calleePop = 0x0Cu;
    ts[0] = STAGE_UNIT0; ts[1] = k & 1; ts[2] = 36 + k; ts[3] = -1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC9A020u, "UNITMSG_QueuePacket23SetSkill_6FC9A020_113c", k, lbl, &c, ts, 4u, 0x00000000u, (0));
  }
}

static void emit_group_3_d2game_p4(void) {
  X86CallSpec c;
  int64_t ts[12];
  char lbl[64];
  memset(ts, 0, sizeof(ts));
  /* MONSTER_ShouldSyncBossLifeBarDelta_6FCAD500_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 10u, 1u, 5002u, 5002u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pAiGen = U32(STAGE_UDATA1 + 0x28u);
    U32(pAiGen + 0x28u) = STAGE_GAME;
    U32(pAiGen + 0x2Cu) = 1u;
    U32(pAiGen + 0x30u) = 0u;
    U32(STAGE_UDATA1 + 0x40u) = 50u;
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t nv = (k == 1) ? 50u : 90u;
    c = make_call(); c.eax = pM; c.edi = nv; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = pM; ts[1] = (int64_t)nv; ts[2] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAD500u, "MONSTER_ShouldSyncBossLifeBarDelta_6FCAD500_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (0));
  }
  /* QUESTS_SendPlayerQuestLogPacket28_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, (k == 0) ? 0u : STAGE_CLIENT);
    if (k == 2) {
      uint32_t q0 = U32(STAGE_UDATA0 + 0x10u);
      U8(U32(q0)) = 0x05u;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC54C00u, "QUESTS_SendPlayerQuestLogPacket28_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* AI_LookupDispatchTableRow113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t specIdx = (uint32_t)k;
    c = make_call(); c.ecx = STAGE_UNIT0; c.edi = specIdx; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = (int64_t)specIdx;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBD0F0u, "AI_LookupDispatchTableRow113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* CLIENTS_GetPlayerUnit113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    if (k == 2) insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t bSkip = (k == 0) ? 1u : 0u;
    c = make_call(); c.esi = STAGE_CLIENT; c.nargs = 1; c.args[0] = bSkip; c.calleePop = 4u;
    ts[0] = STAGE_CLIENT; ts[1] = (int64_t)bSkip;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6AD10u, "CLIENTS_GetPlayerUnit113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 2560, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 2560, 0);
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t bBoss = (k == 2) ? 1u : 0u;
    c = make_call(); c.ecx = pM; c.edx = 0x10u; c.nargs = 1; c.args[0] = bBoss; c.calleePop = 4u;
    ts[0] = pM; ts[1] = 0x10; ts[2] = (int64_t)bBoss;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC42FA0u, "MONUMOD_ApplyExtraHealthBonus_6FC42FA0_113c", k, lbl, &c, ts, 3u, 0x00000000u, (0));
  }
  /* QUESTS_SendNpcMessagePacket27_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 1u, 77u, 0u, 5002u, 5002u, 0u);
    uint32_t pP = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pO = (k == 2) ? STAGE_UNIT1 : 0u;
    uint32_t wM = 100u + (uint32_t)k;
    c = make_call(); c.eax = pP; c.ecx = pO; c.nargs = 1; c.args[0] = wM; c.calleePop = 4u;
    ts[0] = pP; ts[1] = pO; ts[2] = (int64_t)wM;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC54B80u, "QUESTS_SendNpcMessagePacket27_113c", k, lbl, &c, ts, 3u, 0x00000000u, (0));
  }
  /* ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = (k == 2) ? 0x94u : 0x93u;
    U16(STAGE_SCRATCH + 0x18u) = (k == 0) ? 0x01u : (k == 1 ? 0x2Du : 0x0Bu);
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC82F00u, "ACT1_IntroCallback12_MarkNpcIntroDone_6FC82F00_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* MONSTER_InitModeChangeStrc113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t nM = (k == 0) ? 16u : (k == 1 ? 1u : 2u);
    c = make_call(); c.edi = STAGE_UNIT0; c.esi = STAGE_SCRATCH; c.nargs = 1; c.args[0] = nM; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH; ts[2] = (int64_t)nM;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC95070u, "MONSTER_InitModeChangeStrc113c", k, lbl, &c, ts, 3u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* D2NET_SendUnitMovePacket0x10BytesToClient113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call();
    c.ecx = 0x67u; c.edx = 10u + (uint32_t)k;
    c.nargs = 8;
    c.args[0] = pCli; c.args[1] = 1u; c.args[2] = 5010u + (uint32_t)k; c.args[3] = 5020u;
    c.args[4] = 0u; c.args[5] = 8u; c.args[6] = 5000u; c.args[7] = 5000u;
    c.calleePop = 0x20u;
    ts[0] = 0x67; ts[1] = 10 + k; ts[2] = pCli; ts[3] = 1;
    ts[4] = 5010 + k; ts[5] = 5020; ts[6] = 0; ts[7] = 8; ts[8] = 5000; ts[9] = 5000;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAC010u, "D2NET_SendUnitMovePacket0x10BytesToClient113c", k, lbl, &c, ts, 10u, 0x00000000u, (0));
  }
  /* MISSILE_ApplyFriendlyOwnerTimedSkillAura_6FC5EA60_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 5002u, 5002u, STAGE_CLIENT);
    if (k >= 1) {
      U32(STAGE_UNIT0 + 0xC8u) = 0x00000400u;
      U32(STAGE_UNIT0 + 0x94u) = 0u;
      U32(STAGE_UNIT0 + 0x98u) = 1u;
      if (k == 2) insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = pM; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pM; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC5EA60u, "MISSILE_ApplyFriendlyOwnerTimedSkillAura_6FC5EA60_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (0));
  }
  /* SKILLS_ClampLifeManaStaminaToMaxAndRefreshAnim_6FCBE6B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 2560, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 0) ? 1280 : (k == 1 ? 5120 : 2560), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 1024, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, (k == 2) ? 2048 : 512, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 1024, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 512, 0);
    c = make_call(); c.esi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBE6B0u, "SKILLS_ClampLifeManaStaminaToMaxAndRefreshAnim_6FCBE6B0_113c", k, lbl, &c, ts, 1u, 0x00000000u, (0));
  }
  /* QUESTS_AttachUnitToQuest_6FC55890_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL)      = STAGE_QUEST0;
    U32(STAGE_QUEST0)         = 3u;
    int32_t qId = (k == 0) ? -1 : (k == 1 ? 3 : 9);
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = (uint32_t)qId; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = qId; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC55890u, "QUESTS_AttachUnitToQuest_6FC55890_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }
  /* MISSILE_CanCollideWithUnit113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_UNIT0 + 0xC4u) = (k == 2) ? 0x00000004u : 0x0000000Cu;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 20u, 5000u, 5000u);
    uint32_t pTables = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
    uint32_t pMisTxt = U32(pTables + 0xB64u) + 1u * 0x1A4u;
    uint32_t pTgt = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.esi = pTgt; c.edi = 0u; c.ebx = pMisTxt;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1;
    c.calleePop = 8u;
    ts[0] = pTgt; ts[1] = 0; ts[2] = pMisTxt; ts[3] = STAGE_GAME; ts[4] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC5AA20u, "MISSILE_CanCollideWithUnit113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, (0));
  }
  /* ITEMEVENT_RemoveByTypeAndState113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U16(STAGE_SCRATCH + 0x02u) = (k == 2) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x04u) = 3u;
    U32(STAGE_SCRATCH + 0x08u) = 7u;
    U32(STAGE_UNIT0 + 0x90u)   = STAGE_SCRATCH;
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.edi = pU; c.ebx = STAGE_GAME; c.nargs = 2; c.args[0] = 3u; c.args[1] = 7u; c.calleePop = 8u;
    ts[0] = pU; ts[1] = STAGE_GAME; ts[2] = 3; ts[3] = 7;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57110u, "ITEMEVENT_RemoveByTypeAndState113c", k, lbl, &c, ts, 4u, 0x00000000u, (0));
  }
  /* ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0x94u : 0x109u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xA8u)    = 0x77u;
    U8(STAGE_QUESTEX0 + 0x195u)  = (k == 1) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x08u)   = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC83190u, "ACT1Q6_Callback00_NpcActivateCain_6FC83190_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0x9Bu : 0x94u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_QUEST0 + 0x04u)   = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)   = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xA8u)   = 0x88u;
    U8(STAGE_QUESTEX0 + 0x86u)  = (k == 1) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x08u)  = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC83C40u, "ACT1Q1_Callback00_NpcActivateAkara_6FC83C40_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 50u + (uint32_t)k, 0u, 2u, 0u, 0u, 0u);
    U8(STAGE_UDATA1 + 0x45u) = 0u;
    U8(STAGE_UDATA1 + 0x46u) = 1u;
    uint32_t pCli = (k == 0) ? STAGE_CLIENT1 : STAGE_CLIENT;
    c = make_call(); c.eax = STAGE_UNIT1; c.edi = STAGE_UNIT0; c.ebx = pCli; c.nargs = 1; c.args[0] = (uint32_t)k; c.calleePop = 4u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = pCli; ts[3] = k;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAC810u, "NET_SendPacket9D_ItemAction05WithNodePage_6FCAC810_113c", k, lbl, &c, ts, 4u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t nM = (k == 1) ? 4u : 0u;
    c = make_call(); c.eax = pU; c.nargs = 1; c.args[0] = nM; c.calleePop = 4u;
    ts[0] = pU; ts[1] = (int64_t)nM;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBF120u, "SKILLS_CanMonsterUseSkillInMode_6FCBF120_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* UNIT_QueueSkillCastNotify99_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    c = make_call();
    c.esi = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = 36u + (uint32_t)k; c.args[1] = 3u; c.args[2] = 1u; c.args[3] = 10u + (uint32_t)k; c.args[4] = (uint32_t)(k & 1);
    c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = 36 + k; ts[2] = 3; ts[3] = 1; ts[4] = 10 + k; ts[5] = k & 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC9A4C0u, "UNIT_QueueSkillCastNotify99_113c", k, lbl, &c, ts, 6u, 0x00000000u, (0));
  }
  /* MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2) ? 0x10Fu : 1u, 10u, 1u, 5000u, 5000u, 0u);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x15, 10, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x16, 20, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x17, 5, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x18, 8, 0);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 1u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 1; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC41B30u, "MONUMOD_AddSecondaryDamageToBaseStats_6FC41B30_113c", k, lbl, &c, ts, 4u, 0x00000000u, (0));
  }
  /* MONSTER_ModeChangeCorpse_6FC95460_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, (k == 0) ? 0u : 1u, 5000u, 5000u, 0u);
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U8(STAGE_SCRATCH + 0x14u)  = (k == 2) ? 1u : 0u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC95460u, "MONSTER_ModeChangeCorpse_6FC95460_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0x94u : 0x96u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xA8u)  = 0x55u;
    U8(STAGE_QUESTEX0 + 0x03u) = (k == 1) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC83AD0u, "ACT1Q2_Callback00_NpcActivateKashya_6FC83AD0_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0x1FFu : 0x203u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_QUEST0 + 0x04u)   = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)   = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xA8u)   = 0x66u;
    U8(STAGE_QUESTEX0 + 0x84u)  = (k >= 1) ? 1u : 0u;
    U32(STAGE_QUESTEX0 + 0xA8u) = (k == 2) ? 6u : 2u;
    U32(STAGE_SCRATCH + 0x08u)  = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC7A530u, "ACT5Q2_Callback00_NpcActivateQualKehk_6FC7A530_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0x1FFu : 0x203u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x01u) = (k == 1) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC79BE0u, "ACT5Q5_Callback00_NpcActivateQualKehk_6FC79BE0_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0x1FFu : 0x209u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x98u) = (k == 2) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC7D920u, "ACT5Q6_Callback00_NpcActivateTyraelSpawnPortal_6FC7D920_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    int32_t skId = (k == 0) ? -1 : (k == 1 ? 71 : 81); /* Dim Vision vs Terror/Confuse */
    c = make_call(); c.eax = (uint32_t)skId; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = skId; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC700A0u, "SKILLS_ApplyCurseSpecialMonsterAiState_6FC700A0_113c", k, lbl, &c, ts, 3u, 0x00000000u, (0));
  }
  /* PETS_FindPetArgByGuid_6FCB6570_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    if (k >= 1) {
      uint32_t pWrap = STAGE_SCRATCH;
      uint32_t pBuckets = STAGE_SCRATCH + 0x20u;
      uint32_t pNode = STAGE_SCRATCH + 0x200u;
      U32(pWrap) = pBuckets;
      U32(STAGE_UDATA0 + 0x44u) = pWrap;
      U32(pBuckets + 0x0Cu) = pNode;
      U32(pNode + 0x04u) = 77u;
    }
    uint32_t petGuid = (k == 1) ? 77u : 99u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = petGuid; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = (int64_t)petGuid;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB6570u, "PETS_FindPetArgByGuid_6FCB6570_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* UNITEVENT_RegisterTimerOrItemEventNode113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.esi = pU;
    c.nargs = 7;
    c.args[0] = STAGE_GAME; c.args[1] = (uint32_t)(k + 1); c.args[2] = 10u; c.args[3] = 20u;
    c.args[4] = 0u; c.args[5] = 4u; c.args[6] = 50u + (uint32_t)k;
    c.calleePop = 0x1Cu;
    ts[0] = pU; ts[1] = STAGE_GAME; ts[2] = k + 1; ts[3] = 10; ts[4] = 20; ts[5] = 0; ts[6] = 4; ts[7] = 50 + k;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57190u, "UNITEVENT_RegisterTimerOrItemEventNode113c", k, lbl, &c, ts, 8u, 0xFFFFFFFFu, (0));
  }
  /* MONSTER_QueuePacket0xAB_LifeNotify113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    uint32_t pct = 0x20u * (uint32_t)(k + 1);
    c = make_call(); c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = pct; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = (int64_t)pct;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC9A260u, "MONSTER_QueuePacket0xAB_LifeNotify113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t dur = (k == 0) ? 0u : (uint32_t)(15 * k);
    c = make_call(); c.eax = dur; c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)dur; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBFF70u, "SKILLS_ApplySkillDelayState121OnPlayer_6FCBFF70_113c", k, lbl, &c, ts, 3u, 0x00000000u, (0));
  }
  /* MISSILE_InitDataAndPersistentEvent113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u);
    U32(STAGE_UNIT0 + 0x14u) = 0u;
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t uId = 30u + (uint32_t)k;
    c = make_call(); c.eax = pM; c.edi = STAGE_GAME; c.nargs = 1; c.args[0] = uId; c.calleePop = 4u;
    ts[0] = pM; ts[1] = STAGE_GAME; ts[2] = (int64_t)uId;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC8F8A0u, "MISSILE_InitDataAndPersistentEvent113c", k, lbl, &c, ts, 3u, 0x00000000u, (0));
  }
  /* AIGENERAL_AllocAiCommand113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    if (k == 2) {
      uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
      U32(STAGE_SCRATCH + 0x14u) = STAGE_SCRATCH;
      U32(STAGE_SCRATCH + 0x18u) = STAGE_SCRATCH;
      U32(pAiGen + 0x18u) = STAGE_SCRATCH;
      U32(pAiGen + 0x1Cu) = STAGE_SCRATCH;
    }
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = pM; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pM;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC40F30u, "AIGENERAL_AllocAiCommand113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, (0));
  }
  /* MISSILE_RollMasteryStatRange113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 48, 100, 0); /* firemindam */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 49, 200, 0); /* firemaxdam */
      if (k == 2) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 329, 50, 0); /* passive_fire_mastery */
    }
    int32_t mast = (k == 2) ? 329 : -1;
    c = make_call(); c.eax = 49u; c.ecx = (uint32_t)mast; c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = 48u; c.calleePop = 8u;
    ts[0] = 49; ts[1] = mast; ts[2] = STAGE_UNIT0; ts[3] = 48;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC59B40u, "MISSILE_RollMasteryStatRange113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, (0));
  }
  /* ACT1_IntroNpcActivate_6FC82E50_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2) ? 1u : 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0) ? 0x9Bu : 0x94u, 10u, 1u, 5002u, 5002u, 0u);
    uint32_t pHdr = STAGE_SCRATCH + 0x80u;
    uint32_t pTbl = STAGE_SCRATCH + 0x100u;
    U32(STAGE_QUEST0 + 0xDCu) = pTbl;
    U32(pTbl + 0x00u) = 0x94u; U16(pTbl + 0x04u) = 0x200u; U32(pTbl + 0x08u) = 1u; U32(pTbl + 0xC0u) = 1u;
    U32(pTbl + 0xC4u + 0x00u) = 0x94u; U16(pTbl + 0xC4u + 0x04u) = 0x201u; U32(pTbl + 0xC4u + 0x08u) = 2u; U32(pTbl + 0xC4u + 0xC0u) = 1u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = pHdr;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC82E50u, "ACT1_IntroNpcActivate_6FC82E50_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* OBJECTS_RollChestTrapType113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 2u : 80u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 10u, 0u, 5000u, 5000u, 0u);
    uint32_t pSeed = STAGE_SCRATCH + 0x40u;
    U32(pSeed + 0x00u) = (k == 1) ? 1u : (0x12345679u + (uint32_t)(k * 999u));
    U32(pSeed + 0x04u) = 0u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    U32(STAGE_SCRATCH + 0x0Cu) = pSeed;
    c = make_call(); c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC4EA40u, "OBJECTS_RollChestTrapType113c", k, lbl, &c, ts, 1u, 0x00000000u, (0));
  }
  /* ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0xE0u)  = 39u;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_SCRATCH + 0x18u) = (k == 0) ? 0x100u : (uint16_t)(0x4ECFu + (uint32_t)(k - 1));
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC77270u, "ACT5Q5_Callback12_NpcScrollSetState_6FC77270_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 10u, 1u, 5002u, 5002u, 0u);
    U32(STAGE_UNIT1 + 0xC4u) = (k == 2) ? 0x00000004u : 0x0000000Eu;
    uint32_t pTgt = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call(); c.esi = pTgt; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = pTgt; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6ECD0u, "SKILLS_CanCurseAffectTargetUnit_6FC6ECD0_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (0));
  }
  /* REGPOP_GetSpawnBoxSubtiles113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pCoord = 0u;
    if (k >= 1) {
      pCoord = STAGE_SCRATCH + 0x40u;
      U32(pCoord + 0x10u) = 1000u + (uint32_t)(k * 2);
      U32(pCoord + 0x14u) = 1000u;
      U32(pCoord + 0x18u) = 1010u + (uint32_t)(k * 4);
      U32(pCoord + 0x1Cu) = 1012u;
    }
    uint32_t oX = STAGE_SCRATCH, oY = STAGE_SCRATCH + 4u, oW = STAGE_SCRATCH + 8u, oH = STAGE_SCRATCH + 12u;
    c = make_call();
    c.eax = pCoord; c.edi = oX; c.esi = oY; c.ebx = oH;
    c.nargs = 2; c.args[0] = STAGE_ROOM0; c.args[1] = oW;
    c.calleePop = 8u;
    ts[0] = pCoord; ts[1] = STAGE_ROOM0; ts[2] = oX; ts[3] = oY; ts[4] = oW; ts[5] = oH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC66C30u, "REGPOP_GetSpawnBoxSubtiles113c", k, lbl, &c, ts, 6u, 0x00000000u, (0));
  }
  /* ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0x200u : 0x1FFu, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x08u) = (k == 1) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x16u) = (k == 2) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC7A720u, "ACT5Q1_Callback00_NpcActivateLarzuk_6FC7A720_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0x1FFu : 0x200u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x86u) = (k == 1) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC7D520u, "ACT5Q4_OnAnyaNpcInteract_6FC7D520_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
}

static void emit_group_4_d2game_p4(void) {
  X86CallSpec c;
  int64_t ts[12];
  char lbl[64];
  memset(ts, 0, sizeof(ts));
  /* AITHINK_CanPlayerSwitchToMode113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t curM = (k == 0) ? 0u : (k == 1 ? 1u : 7u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, curM, 5000u, 5000u, STAGE_CLIENT);
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = STAGE_GAME; c.esi = 2u; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = 2;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC98340u, "AITHINK_CanPlayerSwitchToMode113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (0));
  }
  /* OBJECTS_OperateBankStash_6FC91290_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 2u : 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x10Bu, 77u, 0u, 5002u, 5002u, 0u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x10u) = (k == 0) ? 5u : 0x10Bu;
    c = make_call(); c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC91290u, "OBJECTS_OperateBankStash_6FC91290_113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, (0));
  }
  /* ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, (k == 0) ? 0u : STAGE_CLIENT);
    U32(STAGE_GAME + 0x10F4u)   = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL)        = STAGE_QUEST0;
    U32(STAGE_QUEST0)           = 0x24u;
    U32(STAGE_QUEST0 + 0x18u)   = STAGE_QUESTEX0;
    U16(STAGE_QUESTEX0 + 0xA4u) = (uint16_t)(100u + (uint32_t)k);
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC78A40u, "ACT5Q6_SendPacket50Quest24WordA4_6FC78A40_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pWrap = STAGE_SCRATCH;
    uint32_t pBuckets = STAGE_SCRATCH + 0x20u;
    U32(pWrap) = pBuckets;
    U32(STAGE_UDATA0 + 0x44u) = pWrap;
    uint32_t pP = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t maxCnt = (uint32_t)(k + 2);
    c = make_call(); c.eax = 3u; c.ebx = pP; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = maxCnt; c.calleePop = 8u;
    ts[0] = 3; ts[1] = pP; ts[2] = STAGE_GAME; ts[3] = (int64_t)maxCnt;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB6EA0u, "PETS_ClampPlayerPetTypeMaxAndUnsummonExcess_6FCB6EA0_113c", k, lbl, &c, ts, 4u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* SKILLS_CheckSkillManaAndCharges113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    if (k >= 1) {
      uint32_t pSkList = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
      U32(STAGE_UNIT0 + 0xA8u) = pSkList;
      if (k == 2) {
        fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 36, 1, 0, 0, 0); /* Fire Bolt */
        U32(pSkList + 0x0Cu) = U32(pSkList + 0x04u); /* pUsedSkill = pFirstSkill */
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 2560, 0);
      }
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ebx = pU; c.calleePop = 0u;
    ts[0] = pU;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBEC80u, "SKILLS_CheckSkillManaAndCharges113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, (0));
  }
  /* MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 2560, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 2560, 0);
    int32_t pct = 25 * (k + 1);
    c = make_call(); c.ebx = STAGE_UNIT0; c.edi = (uint32_t)pct; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = pct;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC41EC0u, "MONUMOD_ScaleMonsterMaxAndCurLife_6FC41EC0_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* OBJECTS_InitFn11_InitTownPortal_6FC53330_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 41u : 2u);
    uint32_t mode = (k == 1) ? 1u : 2u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x3Bu, 10u, mode, 5000u, 5000u, 0u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    U32(STAGE_SCRATCH + 0x10u) = U32(STAGE_UDATA0);
    U32(STAGE_SCRATCH + 0x14u) = 5000u;
    U32(STAGE_SCRATCH + 0x18u) = 5000u;
    c = make_call(); c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC53330u, "OBJECTS_InitFn11_InitTownPortal_6FC53330_113c", k, lbl, &c, ts, 1u, 0x00000000u, (0));
  }
  /* MONSTER_ModeChangeKnockback_6FC95160_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t clsId = (k == 0) ? 0x160u : 1u;
    uint32_t mode  = (k == 1) ? 0u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, clsId, 10u, mode, 5000u, 5000u, 0u);
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC95160u, "MONSTER_ModeChangeKnockback_6FC95160_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (0));
  }
  /* SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 20u, 1u, 5012u, 5016u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 1) fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    if (k == 2) {
      U16(STAGE_PATH0 + 0x10u) = 5020u;
      U16(STAGE_PATH0 + 0x12u) = 5024u;
    }
    uint32_t oX = STAGE_SCRATCH, oY = STAGE_SCRATCH + 4u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.ebx = oX; c.nargs = 1; c.args[0] = oY; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = oX; ts[3] = oY;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBFA30u, "SKILLS_GetUnitTargetOrFirstPathCoords_6FCBFA30_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, (0));
  }
  /* SKILLS_ApplySummonResistStatList_6FC6E180_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x16Bu, 20u, 1u, 5002u, 5002u, 0u);
    if (k >= 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x15D, 20 * k, 0);
    c = make_call(); c.eax = STAGE_UNIT0; c.edi = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6E180u, "SKILLS_ApplySummonResistStatList_6FC6E180_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* ACT1Q5_Callback00_NpcActivateCharsi_6FC83870_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0x94u : 0x9Au, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x02u) = (k == 1) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x03u) = (k == 2) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC83870u, "ACT1Q5_Callback00_NpcActivateCharsi_6FC83870_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* QUESTS_AllocBitBufferPair_6FC89360_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_GAME + 0x1Cu) = (uint32_t)k;
    if (k == 1) U32(STAGE_SCRATCH) = 1u;
    if (k == 2) U32(STAGE_SCRATCH) = 2u;
    c = make_call(); c.esi = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC89360u, "QUESTS_AllocBitBufferPair_6FC89360_113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, (0));
  }
  /* OBJECTS_InitChestLockAndSeed113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 2u : 80u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 10u, 0u, 5000u, 5000u, 0u);
    uint32_t pSeed = STAGE_SCRATCH + 0x40u;
    U32(pSeed + 0x00u) = 0x11111111u * (uint32_t)(k + 1);
    U32(pSeed + 0x04u) = 0x29Au;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    U32(STAGE_SCRATCH + 0x0Cu) = pSeed;
    U32(STAGE_SCRATCH + 0x10u) = U32(STAGE_UDATA0);
    c = make_call(); c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC4ECB0u, "OBJECTS_InitChestLockAndSeed113c", k, lbl, &c, ts, 1u, 0x00000000u, (0));
  }
  /* ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0x1FFu : 0x201u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_QUEST0 + 0x04u)   = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x09u)    = 1u;
    U32(STAGE_QUEST0 + 0x18u)   = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0xACu)  = (k == 1) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x101u) = (k == 2) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x08u)  = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC7A0A0u, "ACT5Q3_Callback00_NpcActivateMalah_6FC7A0A0_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, (k == 0) ? 0u : STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 1024, 0);
    U32(STAGE_CLIENT + 0x3D4u) = (k == 2) ? 0x07u : 0x03u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC98230u, "PLAYER_FinalizeDeathStateAndEvents_6FC98230_113c", k, lbl, &c, ts, 2u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* PETS_AllocAndInitPlayerPetTable_6FCB7120_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (uint32_t)k, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pP = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ebx = STAGE_GAME; c.nargs = 1; c.args[0] = pP; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pP;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB7120u, "PETS_AllocAndInitPlayerPetTable_6FCB7120_113c", k, lbl, &c, ts, 2u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_with_coll(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 2) ? STAGE_ROOM1 : STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 0u);
    U32(STAGE_CLIENT + 0x1B4u) = (k == 0) ? 0u : STAGE_ROOM0;
    c = make_call(); c.ecx = STAGE_CLIENT; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_CLIENT; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC4A9F0u, "CLIENT_SendUnitRemoveIfInNearRoom_6FC4A9F0_113c", k, lbl, &c, ts, 2u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* SKILLS_InitNecroWarriorSkeletonComponents_6FC6E960_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x16Bu, 20u, 1u, 5002u, 5002u, 0u);
    U32(STAGE_UNIT0 + 0x20u) = 0x11111111u * (uint32_t)(k + 1);
    int32_t slvl = (k == 0) ? 1 : (k == 1 ? 5 : 15);
    c = make_call(); c.eax = 70u; c.ecx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = (uint32_t)slvl; c.calleePop = 8u;
    ts[0] = 70; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6E960u, "SKILLS_InitNecroWarriorSkeletonComponents_6FC6E960_113c", k, lbl, &c, ts, 4u, 0x00000000u, (0));
  }
  /* SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 20u, (k == 1) ? 0x0Cu : 1u, 5002u, 5002u, 0u);
      U32(STAGE_UNIT1 + 0xC4u) = 0x00001004u;
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    int32_t slvl = (k == 0) ? 0 : 3;
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = (uint32_t)slvl; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT0; ts[2] = slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBE810u, "SKILLS_FindFirstCorpseInRadius10_6FCBE810_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (0));
  }
  /* ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_GAME + 0x10F4u)  = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL)       = STAGE_QUEST0;
    U32(STAGE_QUEST0)          = 0x1Fu;
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U32(STAGE_SCRATCH + 0x00u) = 2u;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_SCRATCH + 0x10u;
    U32(STAGE_SCRATCH + 0x10u) = 5000u;
    U32(STAGE_SCRATCH + 0x14u) = 5004u;
    uint32_t pSave = (k == 0) ? 0u : STAGE_SCRATCH;
    if (k == 2) U32(STAGE_SCRATCH + 0x10u) = 5010u;
    c = make_call(); c.eax = STAGE_GAME; c.edx = pSave; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = pSave;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC7A5C0u, "ACT5Q1_InitPresetQuestObject21F_6FC7A5C0_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_GAME + 0x10F4u)  = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL)       = STAGE_QUEST0;
    U32(STAGE_QUEST0)          = 0x21u;
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U32(STAGE_SCRATCH + 0x00u) = 2u;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_SCRATCH + 0x10u;
    U32(STAGE_SCRATCH + 0x10u) = 5000u + (uint32_t)(k * 8);
    U32(STAGE_SCRATCH + 0x14u) = 5004u;
    uint32_t pSave = (k == 0) ? 0u : STAGE_SCRATCH;
    c = make_call(); c.eax = STAGE_GAME; c.edx = pSave; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = pSave;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC79D30u, "ACT5Q3_InitPresetQuestObject1CD_6FC79D30_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_GAME + 0x10F4u)  = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL)       = STAGE_QUEST0;
    U32(STAGE_QUEST0)          = 0x21u;
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U32(STAGE_SCRATCH + 0x00u) = 2u;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_SCRATCH + 0x10u;
    U32(STAGE_SCRATCH + 0x10u) = 5020u + (uint32_t)(k * 8);
    U32(STAGE_SCRATCH + 0x14u) = 5024u;
    uint32_t pSave = (k == 0) ? 0u : STAGE_SCRATCH;
    c = make_call(); c.eax = STAGE_GAME; c.edx = pSave; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = pSave;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC79E10u, "ACT5Q3_InitPresetQuestObject1CB_6FC79E10_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 1u : 2u);
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u);
    U32(STAGE_UDATA0 + 0x28u) = (k == 1) ? 4u : 1u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC5B140u, "MISSILE_SrvHit_GuidedProjectileCheck_6FC5B140_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (0));
  }
  /* NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x3Bu, 77u, 2u, 5002u, 5002u, 0u);
    U32(STAGE_UNIT1 + 0x7Cu)   = STAGE_SCRATCH;
    U32(STAGE_SCRATCH + 0x04u) = 1u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k == 2) insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    c = make_call(); c.eax = pG; c.edi = 77u; c.nargs = 2; c.args[0] = STAGE_CLIENT; c.args[1] = 88u; c.calleePop = 8u;
    ts[0] = pG; ts[1] = 77; ts[2] = STAGE_CLIENT; ts[3] = 88;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCAD040u, "NET_SendPacket82_PortalOwnerInfo_6FCAD040_113c", k, lbl, &c, ts, 4u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* ACT5Intro_Callback00_NpcActivate_6FC796B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2) ? 4u : 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0) ? 0x1FFu : 0x201u, 10u, 1u, 5002u, 5002u, 0u);
    uint32_t pHdr = STAGE_SCRATCH + 0x80u;
    uint32_t pTbl = STAGE_SCRATCH + 0x100u;
    U32(STAGE_QUEST0 + 0xDCu) = pTbl;
    U32(pTbl + 0x00u) = 0x201u; U16(pTbl + 0x04u) = 0x4E45u; U32(pTbl + 0x08u) = 1u; U32(pTbl + 0xC0u) = 1u;
    U32(pTbl + 0xC4u + 0x00u) = 0x201u; U16(pTbl + 0xC4u + 0x04u) = 0x4E47u; U32(pTbl + 0xC4u + 0x08u) = 2u; U32(pTbl + 0xC4u + 0xC0u) = 1u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = pHdr;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC796B0u, "ACT5Intro_Callback00_NpcActivate_6FC796B0_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 5u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = (k == 2) ? 0x202u : 0x200u;
    U16(STAGE_SCRATCH + 0x18u) = (k == 0) ? 0x0001u : (k == 1 ? 0x4E2Eu : 0x4E55u);
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC797B0u, "ACT5Intro_Callback02_ScrollMessage_6FC797B0_113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* PLAYER_StartWalkOrRunMode113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1) ? 1u : 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    c = make_call(); c.eax = 2u; c.ecx = STAGE_UNIT0; c.nargs = 1; c.args[0] = pG; c.calleePop = 4u;
    ts[0] = 2; ts[1] = STAGE_UNIT0; ts[2] = pG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC98610u, "PLAYER_StartWalkOrRunMode113c", k, lbl, &c, ts, 3u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* PLAYER_SetPathTargetCoordsAndWalk113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t tX = (k == 1) ? 5000u : 5008u;
    c = make_call();
    c.ecx = pG; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = 2u; c.args[1] = tX; c.args[2] = 5000u;
    c.calleePop = 0x0Cu;
    ts[0] = pG; ts[1] = STAGE_UNIT0; ts[2] = 2; ts[3] = (int64_t)tX; ts[4] = 5000;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC98710u, "PLAYER_SetPathTargetCoordsAndWalk113c", k, lbl, &c, ts, 5u, 0x00000000u, (k == 0 ? 1 : 0));
  }
  /* MISSILE_ApplyNextHitDelayState113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* Missile 59 = Nova (has NextDelay bNextHit=1 at +0x188!) */
    uint32_t misId = (k == 0) ? 6u : 59u;
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, misId, 20u, 5000u, 5000u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 10u + (uint32_t)k, 1u, 5002u, 5002u, 0u);
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)(k * 10);
    c = make_call(); c.ecx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC5E590u, "MISSILE_ApplyNextHitDelayState113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
  }
  /* MISSILE_RollInitialPierceCount113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 5000u, 5000u, STAGE_CLIENT);
    /* Missile 1 = Arrow (bPierce bit 3 in +0x04 set!) */
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 20u, 5000u, 5000u);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x148, 12345 + k * 777, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0xA6, (k == 1) ? 50 : 100, 0);
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC8F660u, "MISSILE_RollInitialPierceCount113c", k, lbl, &c, ts, 2u, 0x00000000u, (0));
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
    fprintf(stderr, "[k6-p4] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
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
    fprintf(stderr, "[k6-p4] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p4] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
  fn_PathSetTargetUnit  = (Com_PathSetTargetUnit_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10336));
  fn_SerializeItemToBuf = (Com_SerializeItemToBuf_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10987));
  fn_DecodeCompactV96   = (Com_DecodeCompactV96_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11105));

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_PlaceItemInBodyLoc || !fn_PathSetTargetUnit ||
      !fn_SerializeItemToBuf || !fn_DecodeCompactV96) {
    fprintf(stderr, "[k6-p4] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p4] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_group_1_d2game_p4();
  emit_group_2_d2game_p4();
  emit_group_3_d2game_p4();
  emit_group_4_d2game_p4();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p4] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
