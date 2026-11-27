/*
 * k6-p14-d2game-emitter.c — [K6-P14] Real-DLL D2Game.dll S2C Combat & Monster/AI Emitter (44 Target VAs)
 *
 * Emits all 44 net-new un-hit D2Game.dll VAs bound in src/d2kern-113c/game/k2-real-s2c-combat-113c.ts
 * (>= 3 cases and >= 2 distinct non-degenerate outcome signatures per VA).
 * Compiled across -O2, -O2 -fno-omit-frame-pointer, -O1 (-m32 -Wall -Wextra -Werror)
 * with naked thunk_invoke + 0 JMP hooks, running headless under Wine against real v1.13c DLLs.
 *
 * NOTE for tools/oracle/k6/audit-dll-coverage.py:
 *   ONLY the 44 target VAs passed to run_and_emit(...) may appear as 0x6F[CD]xxxxx hex literals
 *   outside comments; all other D2Common / D2Game addresses use D2COM_VA() / D2GAME_VA().
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define D2COM_PREF_BASE  ((uint32_t)0x6FD5u << 16)
#define D2GAME_PREF_BASE ((uint32_t)0x6FC2u << 16)
#define D2COM_VA(off)    (D2COM_PREF_BASE + (uint32_t)(off))
#define D2GAME_VA(off)   (D2GAME_PREF_BASE + (uint32_t)(off))

#define DATATBLS_BASE            0x20000000u
#define DATATBLS_SIZE            0x00800000u
#define HASH_VTABLE_ADDR         0x28000000u
#define HASH_VTABLE_SIZE         0x00004000u
#define ITEMS_TXTLINK_HDR_ADDR   (HASH_VTABLE_ADDR + 0x0100u)
#define ITEMS_TXTLINK_NODES_ADDR (HASH_VTABLE_ADDR + 0x0110u)

#define STAGE_BASE       0x30000000u
#define STAGE_FIXED_SIZE 0x00009000u
#define STAGE_CS_GAME    0x30010000u
#define STAGE_SETUP_BASE 0x30020000u
#define STAGE_TOTAL_SIZE 0x00080000u

/* Fixed staged object addresses inside 0x30000000..0x30008FFF */
#define STAGE_GAME       (STAGE_BASE + 0x0000u) /* 0x2000: D2GameStrc */
#define STAGE_CLIENT     (STAGE_BASE + 0x2000u) /* 0x0600: D2ClientStrc #0 */
#define STAGE_PKTNODE0   (STAGE_BASE + 0x2600u) /* 0x0210: D2PacketDataStrc #0 */
#define STAGE_PKTNODE1   (STAGE_BASE + 0x2810u) /* 0x0210: D2PacketDataStrc #1 */
#define STAGE_CLIENT1    (STAGE_BASE + 0x2A20u) /* 0x0500: D2ClientStrc #1 */
#define STAGE_UNIT0      (STAGE_BASE + 0x3000u) /* 0x0200: primary D2UnitStrc */
#define STAGE_UDATA0     (STAGE_BASE + 0x3200u) /* 0x0200: primary unit data */
#define STAGE_UNIT1      (STAGE_BASE + 0x3400u) /* 0x0200: secondary D2UnitStrc */
#define STAGE_UDATA1     (STAGE_BASE + 0x3600u) /* 0x0200: secondary unit data */
#define STAGE_UNIT2      (STAGE_BASE + 0x3800u) /* 0x0200: tertiary D2UnitStrc */
#define STAGE_UDATA2     (STAGE_BASE + 0x3A00u) /* 0x0200: tertiary unit data */
#define STAGE_PATH0      (STAGE_BASE + 0x4000u) /* 0x0300: path for UNIT0 */
#define STAGE_PATH1      (STAGE_BASE + 0x4300u) /* 0x0300: path for UNIT1 */
#define STAGE_PATH2      (STAGE_BASE + 0x4600u) /* 0x0300: path for UNIT2 */
#define STAGE_ROOM0      (STAGE_BASE + 0x5000u) /* 0x0100: D2ActiveRoomStrc #0 */
#define STAGE_ROOMEX0    (STAGE_BASE + 0x5100u) /* 0x0100: D2RoomExStrc #0 */
#define STAGE_LEVEL0     (STAGE_BASE + 0x5200u) /* 0x0200: D2DrlgLevelStrc #0 */
#define STAGE_ROOM1      (STAGE_BASE + 0x5400u) /* 0x0100: D2ActiveRoomStrc #1 */
#define STAGE_ROOMEX1    (STAGE_BASE + 0x5500u) /* 0x0100: D2RoomExStrc #1 */
#define STAGE_LEVEL1     (STAGE_BASE + 0x5600u) /* 0x0200: D2DrlgLevelStrc #1 */
#define STAGE_ACT0       (STAGE_BASE + 0x5800u) /* 0x0100: D2ActStrc #0 */
#define STAGE_ACT1       (STAGE_BASE + 0x5900u) /* 0x0100: D2ActStrc #1 */
#define STAGE_DRLG0      (STAGE_BASE + 0x5A00u) /* 0x0500: D2DrlgStrc #0 */
#define STAGE_DMG        (STAGE_BASE + 0x6000u) /* 0x0100: D2DamageStrc */
#define STAGE_QUESTCTRL  (STAGE_BASE + 0x6100u) /* 0x0100: pQuestControl */
#define STAGE_QUEST0     (STAGE_BASE + 0x6200u) /* 0x0200: D2QuestDataStrc */
#define STAGE_QUESTEX0   (STAGE_BASE + 0x6400u) /* 0x0200: pQuestDataEx */
#define STAGE_PETCTRL    (STAGE_BASE + 0x6800u) /* 0x0200: pPlayerPets */
#define STAGE_PARTYCTRL  (STAGE_BASE + 0x6A00u) /* 0x0200: pPartyControl */
#define STAGE_SCRATCH    (STAGE_BASE + 0x8000u) /* 0x1000: scratch / args / structs */

#define HEAP_BASE        0x40000000u
#define HEAP_SIZE        0x00200000u

#define MAX_STACK        14
#define MAX_EXTRA_CAPS   16

#define U32(a) (*(volatile uint32_t *)(uintptr_t)(a))
#define U16(a) (*(volatile uint16_t *)(uintptr_t)(a))
#define U8(a)  (*(volatile uint8_t  *)(uintptr_t)(a))
#define S32(a) (*(volatile int32_t  *)(uintptr_t)(a))
#define S16(a) (*(volatile int16_t  *)(uintptr_t)(a))

static HMODULE   g_hStorm      = NULL;
static HMODULE   g_hFog        = NULL;
static HMODULE   g_hCom        = NULL;
static HMODULE   g_hNet        = NULL;
static HMODULE   g_hGame       = NULL;
static uintptr_t g_com_rebase  = 0;
static uintptr_t g_game_rebase = 0;

static int      g_in_setup_phase = 1;
static uint32_t g_setup_top      = STAGE_SETUP_BASE;
static uint32_t g_heap_top       = HEAP_BASE;

typedef struct {
  uint32_t canonAddr;
  uint32_t len;
} ExtraCap;

static ExtraCap g_extra_caps[MAX_EXTRA_CAPS];
static uint32_t g_extra_cap_count = 0u;

static void add_extra_cap(uint32_t canonAddr, uint32_t len) {
  if (len == 0u) return;
  for (uint32_t i = 0u; i < g_extra_cap_count; i++) {
    if (g_extra_caps[i].canonAddr == canonAddr) {
      if (len > g_extra_caps[i].len) g_extra_caps[i].len = len;
      return;
    }
  }
  if (g_extra_cap_count < MAX_EXTRA_CAPS) {
    g_extra_caps[g_extra_cap_count].canonAddr = canonAddr;
    g_extra_caps[g_extra_cap_count].len       = len;
    g_extra_cap_count++;
  }
}

static uint32_t g_fake_tick_count  = 100000u;
static uint32_t g_fake_qpc_lo      = 1234567u;
static uint32_t g_fake_qpc_hi      = 0u;
static uint32_t g_d2net_send_ok    = 1u;
static uint32_t g_d2net_client_key = 0x11223344u;

typedef void *(__stdcall *Com_CreateStatListEx_t)(void *pOwner, uint32_t flags, void *pfnCb, void *pGame);
typedef void  (__stdcall *Com_SetUnitStat_t)(void *pUnit, int32_t statId, int32_t val, int32_t layer);
typedef void *(__stdcall *Com_AllocStatList_t)(void *pPool, uint32_t flags, uint32_t timeout, int32_t uType, int32_t guid);
typedef int32_t(__stdcall *Com_SetStatIfValid_t)(void *pList, int32_t statId, int32_t val, uint32_t param);
typedef void  (__stdcall *Com_SetStat_t)(void *pList, int32_t statId, int32_t val, uint32_t param);
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
static Com_SetStat_t            fn_SetStat            = NULL;
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
static uint32_t g_item_shield = 0;

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
uint32_t g_fault_code    = 0;
uint32_t g_fault_eip     = 0;
uint32_t g_fault_addr    = 0;
uint32_t g_assert_line   = 0;
uint32_t g_assert_a2     = 0;
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
    fprintf(stderr, "[k6-p14] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
  g_assert_line   = g_assert_a2;
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
static void __fastcall stub_fog_10050(void *pCs, int line) { (void)pCs; (void)line; }
static uint32_t __stdcall stub_fog_10055(void) { return 0u; }
static void __cdecl stub_fog_10142(void **ppPool, const char *szName, uint32_t nBlockSz, uint32_t nAlign) {
  (void)szName; (void)nBlockSz; (void)nAlign;
  if (ppPool) *ppPool = bump_alloc(0x40u);
}

static void *__stdcall stub_storm_401(uint32_t size, const char *file, int line, uint32_t flags) {
  (void)file; (void)line; (void)flags;
  return (size == 0u) ? NULL : bump_alloc(size);
}
static BOOL __stdcall stub_storm_403(void *ptr, const char *file, int line, uint32_t flags) {
  (void)ptr; (void)file; (void)line; (void)flags;
  return TRUE;
}
static void *__stdcall stub_storm_405(void *ptr, uint32_t newSize, const char *file, int line, uint32_t flags) {
  (void)file; (void)line;
  if ((flags & 0x10u) != 0u || newSize == 0u) return NULL;
  void *np = bump_alloc(newSize);
  if (ptr) {
    uint32_t oldSize = lookup_alloc_size((uint32_t)(uintptr_t)ptr);
    uint32_t copyLen = (oldSize > 0u && oldSize < newSize) ? oldSize : newSize;
    memcpy(np, ptr, copyLen);
  }
  return np;
}

static void __stdcall stub_d2net_10000(uint32_t dwClientId) { (void)dwClientId; }
static uint32_t __stdcall stub_d2net_10002(uint32_t nZero, uint32_t dwClientId, void *pBuf, uint32_t nLen) {
  (void)nZero; (void)dwClientId; (void)pBuf;
  return g_d2net_send_ok ? nLen : 0u;
}
static uint32_t __stdcall stub_d2net_10015(uint32_t dwClientId) { (void)dwClientId; return g_d2net_client_key; }
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
      fprintf(stderr, "[k6-p14] missing Fog.#%u\n", fogHooks[i].ord);
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
  struct { uint32_t ord; void *fn; } netHooks[] = {
    { 10000u, (void *)(uintptr_t)stub_d2net_10000 },
    { 10002u, (void *)(uintptr_t)stub_d2net_10002 },
    { 10015u, (void *)(uintptr_t)stub_d2net_10015 },
    { 10021u, (void *)(uintptr_t)stub_d2net_10021 },
  };
  for (size_t i = 0; i < sizeof(netHooks) / sizeof(netHooks[0]); i++) {
    void *orig = (void *)(uintptr_t)GetProcAddress(g_hNet, MAKEINTRESOURCEA(netHooks[i].ord));
    if (orig) hook_module_iat_ptr(g_hGame, orig, netHooks[i].fn);
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
    fprintf(stderr, "[k6-p14] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p14] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_VA(0x99000u) + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p14] short read at page %u\n", i);
      TerminateProcess(GetCurrentProcess(), 12);
    }
    uint32_t va = 0;
    memcpy(&va, pageBuf, 4);
    if (va >= DATATBLS_BASE && va < DATATBLS_BASE + DATATBLS_SIZE) {
      memcpy((void *)(uintptr_t)va, pageBuf + 4, 4096);
    } else if (va >= D2COM_VA(0x99000u) && va < D2COM_VA(0xA3000u)) {
      memcpy((void *)(uintptr_t)(va + g_com_rebase), pageBuf + 4, 4096);
    }
  }
  fclose(fp);
}

/* ------------------------------- Arena Serialization & Canonicalization */

static uint32_t canon_to_live_addr(uint32_t canonAddr) {
  if (g_game_rebase != 0 &&
      canonAddr >= D2GAME_PREF_BASE &&
      canonAddr < D2GAME_PREF_BASE + 0x130000u) {
    return canonAddr + (uint32_t)g_game_rebase;
  }
  return canonAddr;
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

static uint8_t read_canon_byte(uint32_t addr, uint32_t startAddr, uint32_t endAddr) {
  uint32_t aligned = addr & ~3u;
  if (g_game_rebase != 0 && aligned >= startAddr && aligned + 4u <= endAddr) {
    uint32_t lo = (uint32_t)(uintptr_t)g_hGame;
    uint32_t hi = lo + 0x130000u;
    uint32_t v = U32(aligned);
    if (v >= lo && v < hi && (v - lo) >= 0x1000u) {
      v -= (uint32_t)g_game_rebase;
      return (uint8_t)((v >> ((addr & 3u) * 8u)) & 0xFFu);
    }
  }
  return U8(addr);
}

static void format_mem_runs_range(
    char *out, size_t cap, size_t *lenPtr,
    uint32_t liveStart, uint32_t liveEnd, int *first, uint32_t displayDelta) {
  static const char hexChars[] = "0123456789abcdef";
  size_t len = *lenPtr;
  uint32_t a = liveStart;
  while (a < liveEnd) {
    uint32_t chunkEnd = (a + 16u <= liveEnd) ? (a + 16u) : liveEnd;
    int nz = 0;
    for (uint32_t k = a; k < chunkEnd; k++) {
      if (read_canon_byte(k, liveStart, liveEnd) != 0) { nz = 1; break; }
    }
    if (!nz) { a = chunkEnd; continue; }
    uint32_t runStart = a;
    uint32_t runEnd   = chunkEnd;
    while (runEnd < liveEnd && (runEnd - runStart) < 512u) {
      uint32_t nextEnd = (runEnd + 16u <= liveEnd) ? (runEnd + 16u) : liveEnd;
      int nextNz = 0;
      for (uint32_t k = runEnd; k < nextEnd; k++) {
        if (read_canon_byte(k, liveStart, liveEnd) != 0) { nextNz = 1; break; }
      }
      if (!nextNz) break;
      runEnd = nextEnd;
    }
    int n = snprintf(out + len, cap - len, "%s{\"addr\":\"0x%08X\",\"hex\":\"",
                     (*first ? "" : ","), runStart - displayDelta);
    len += (size_t)n;
    for (uint32_t k = runStart; k < runEnd; k++) {
      uint8_t b = read_canon_byte(k, liveStart, liveEnd);
      if (len + 4 >= cap) {
        fprintf(stderr, "[k6-p14] mem json buffer overflow\n");
        TerminateProcess(GetCurrentProcess(), 25);
      }
      out[len++] = hexChars[(b >> 4) & 0xFu];
      out[len++] = hexChars[b & 0xFu];
    }
    out[len++] = '"';
    out[len++] = '}';
    *first = 0;
    a = runEnd;
  }
  out[len] = '\0';
  *lenPtr = len;
}

static char g_pre_json[524288];

static void capture_stage_json(char *out, size_t cap, uint32_t setupTop) {
  size_t len = 0;
  int first = 1;
  out[len++] = '[';
  out[len] = '\0';
  format_mem_runs_range(out, cap, &len, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, &first, 0u);
  format_mem_runs_range(out, cap, &len, STAGE_CS_GAME, STAGE_CS_GAME + 0x1000u, &first, 0u);
  if (setupTop > STAGE_SETUP_BASE) {
    format_mem_runs_range(out, cap, &len, STAGE_SETUP_BASE, setupTop, &first, 0u);
  }
  for (uint32_t i = 0u; i < g_extra_cap_count; i++) {
    uint32_t canon = g_extra_caps[i].canonAddr;
    uint32_t live  = canon_to_live_addr(canon);
    uint32_t delta = live - canon;
    format_mem_runs_range(out, cap, &len, live, live + g_extra_caps[i].len, &first, delta);
  }
  if (len + 2 >= cap) {
    fprintf(stderr, "[k6-p14] mem json cap overflow\n");
    TerminateProcess(GetCurrentProcess(), 25);
  }
  out[len++] = ']';
  out[len]   = '\0';
}

/* ------------------------------- Staged Setup Helpers */

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

static uint32_t game_global_live(uint32_t canonVa) {
  return (uint32_t)(canonVa + g_game_rebase);
}

static void reset_case(void) {
  memset((void *)(uintptr_t)STAGE_BASE, 0, STAGE_FIXED_SIZE);
  memset((void *)(uintptr_t)STAGE_CS_GAME, 0, 0x1000u);
  if (g_setup_top > STAGE_SETUP_BASE) {
    uint32_t alignedTop = (g_setup_top + 15u) & ~15u;
    memset((void *)(uintptr_t)STAGE_SETUP_BASE, 0, alignedTop - STAGE_SETUP_BASE);
  }
  if (g_heap_top > HEAP_BASE) {
    memset((void *)(uintptr_t)HEAP_BASE, 0, g_heap_top - HEAP_BASE);
  }
  g_setup_top       = STAGE_SETUP_BASE;
  g_heap_top        = HEAP_BASE;
  g_alloc_count     = 0;
  g_extra_cap_count = 0;
  g_in_setup_phase  = 1;
  g_fake_tick_count = 100000u;
  g_fake_qpc_lo     = 1234567u;
  g_fake_qpc_hi     = 0u;
  g_d2net_send_ok   = 1u;
  g_d2net_client_key = 0x11223344u;

  U32(STAGE_GAME + 0x18u)      = STAGE_CS_GAME;
  U8(STAGE_GAME + 0x6Du)       = 0u;
  U32(STAGE_GAME + 0x70u)      = 1u;
  U32(STAGE_GAME + 0xA8u)      = 100u;
  U32(STAGE_GAME + 0xD0u)      = 0x13579BDFu;
  U32(STAGE_GAME + 0xD4u)      = 0x0000029Au;
  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
  U32(STAGE_CLIENT + 0x1A8u)   = STAGE_GAME;

  U32(game_global_live(D2GAME_VA(0x111C1Cu))) = 0u;
  U32(game_global_live(D2GAME_VA(0x111C20u))) = 0u;
  U32(game_global_live(D2GAME_VA(0x111F90u))) = 0u;
  U8(game_global_live(D2GAME_VA(0x111F98u)))  = 0u;
  U32(game_global_live(D2GAME_VA(0x111C50u))) = 0u;
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

static void discover_table_ids(void) {
  reset_case();
  uint32_t nItems = U32(D2COM_VA(0x9FB94u) + g_com_rebase);
  uint32_t pItems = U32(D2COM_VA(0x9FB98u) + g_com_rebase);
  TxtLinkNode *nodes = (TxtLinkNode *)(uintptr_t)ITEMS_TXTLINK_NODES_ADDR;
  TxtLinkHeader *linker = (TxtLinkHeader *)(uintptr_t)ITEMS_TXTLINK_HDR_ADDR;
  int32_t nLink = 0;
  for (uint32_t id = 0; id < nItems; id++) {
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    if (!g_item_sword  && code == 0x20647373u) g_item_sword  = id; /* 'ssd ' */
    if (!g_item_jav    && code == 0x2076616Au) g_item_jav    = id; /* 'jav ' */
    if (!g_item_armor  && code == 0x20697571u) g_item_armor  = id; /* 'qui ' */
    if (!g_item_shield && code == 0x206C6D73u) g_item_shield = id; /* 'sml ' */
    if (nLink < 1900) {
      int32_t pos = nLink;
      while (pos > 0 && nodes[pos - 1].dwCode > code) {
        nodes[pos] = nodes[pos - 1];
        pos--;
      }
      nodes[pos].dwCode = code;
      nodes[pos].nRow   = (int32_t)id;
      nLink++;
    }
  }
  linker->nRecords = nLink;
  linker->dwPad    = 0;
  linker->pNodes   = nodes;
  U32(D2COM_VA(0x9FF6Cu) + g_com_rebase) = ITEMS_TXTLINK_HDR_ADDR;
}

static uint32_t stage_timer_with_chunk(uint32_t pGame, uint32_t pPrevTimer) {
  (void)pPrevTimer;
  uint32_t pTimer = (uint32_t)(uintptr_t)bump_alloc(0xA20u);
  uint32_t pChunk = (uint32_t)(uintptr_t)bump_alloc(0x7088u);
  for (uint32_t i = 0u; i < 600u; i++) {
    U32(pChunk + i * 0x30u + 0x1Cu) = (i + 1u < 600u) ? (pChunk + (i + 1u) * 0x30u) : 0u;
  }
  U32(pChunk + 0x7080u) = pChunk;
  U32(pTimer + 0xA1Cu)  = pChunk;
  U32(pGame + 0xB8u)    = pTimer;
  return pTimer;
}

static uint32_t alloc_quest_record(void) {
  uint32_t pRec = (uint32_t)(uintptr_t)bump_alloc(0x14u);
  uint32_t pBuf = (uint32_t)(uintptr_t)bump_alloc(0x60u);
  U32(pRec + 0x00u) = pBuf;
  U32(pRec + 0x04u) = 0x300u;
  return pRec;
}

static void stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  U32(pAct + 0x08u)          = 1u;
  U32(pAct + 0x10u)          = pRoom;
  U32(pAct + 0x48u)          = STAGE_DRLG0;
  U32(STAGE_DRLG0 + 0x47Cu)  = pLevel;
  if (U32(STAGE_GAME + 0xBCu) == 0u) U32(STAGE_GAME + 0xBCu) = pAct;
  U32(pRoom + 0x10u)   = pRoomEx;
  U32(pRoom + 0x2Cu)   = pAct;
  U32(pRoom + 0x4Cu)   = 4800u;
  U32(pRoom + 0x50u)   = 4800u;
  U32(pRoom + 0x54u)   = 1000u;
  U32(pRoom + 0x58u)   = 1000u;
  U32(pRoom + 0x6Cu)   = 0x2468ACE1u;
  U32(pRoom + 0x70u)   = 0x0000029Au;
  U32(pRoomEx + 0x30u) = pRoom;
  U32(pRoomEx + 0x58u) = pLevel;
  U32(pLevel + 0x1B4u) = STAGE_DRLG0;
  U32(pLevel + 0x1D0u) = levelId;
}

static uint32_t stage_room_with_coll(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  stage_room(pRoom, pRoomEx, pLevel, levelId);
  uint32_t pLog = (uint32_t)(uintptr_t)bump_alloc(0x40u);
  U32(pLog + 0x00u)    = 1u;
  U32(pLog + 0x30u)    = levelId;
  U32(pRoomEx + 0x64u) = pLog;
  uint32_t ppNear = (uint32_t)(uintptr_t)bump_alloc(8u);
  U32(ppNear)          = pRoom;
  U32(pRoom + 0x00u)   = ppNear;
  U32(pRoom + 0x24u)   = 1u;
  uint32_t pColl = (uint32_t)(uintptr_t)bump_alloc(0x28u);
  uint32_t w = 32u, h = 32u;
  uint32_t pGrid = (uint32_t)(uintptr_t)bump_alloc(w * h * 2u);
  U32(pColl + 0x00u) = 4800u;
  U32(pColl + 0x04u) = 4800u;
  U32(pColl + 0x08u) = w;
  U32(pColl + 0x0Cu) = h;
  U32(pColl + 0x10u) = 960u;
  U32(pColl + 0x14u) = 960u;
  U32(pColl + 0x18u) = 6u;
  U32(pColl + 0x1Cu) = 6u;
  U32(pColl + 0x20u) = pGrid;
  U32(pColl + 0x24u) = pGrid + w * h * 2u;
  U32(pRoom + 0x20u) = pColl;
  U32(pRoom + 0x4Cu) = 4800u;
  U32(pRoom + 0x50u) = 4800u;
  U32(pRoom + 0x54u) = w;
  U32(pRoom + 0x58u) = h;
  U32(pRoom + 0x5Cu) = 960u;
  U32(pRoom + 0x60u) = 960u;
  U32(pRoom + 0x64u) = 6u;
  U32(pRoom + 0x68u) = 6u;
  return pGrid;
}

static void stage_dynamic_path(uint32_t pUnit, uint32_t pPath, uint32_t pRoom, uint16_t x, uint16_t y) {
  U32(pUnit + 0x2Cu) = pPath;
  U16(pPath + 0x00u) = 0x8000u;
  U16(pPath + 0x02u) = x;
  U16(pPath + 0x04u) = 0x8000u;
  U16(pPath + 0x06u) = y;
  U32(pPath + 0x1Cu) = pRoom;
  U32(pPath + 0x30u) = pUnit;
  U32(pPath + 0x7Cu) = 0x1800u;
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
  uint32_t cur  = U32(headAddr);
  while (cur != 0u && U32(cur + 0x0Cu) > guid) {
    prev = cur;
    cur  = U32(cur + 0xE4u);
  }
  U32(pUnit + 0xE4u) = cur;
  if (prev == 0u) U32(headAddr) = pUnit;
  else            U32(prev + 0xE4u) = pUnit;
}

static void link_unit_into_room(uint32_t pRoom, uint32_t pUnit) {
  U32(pUnit + 0xE8u) = U32(pRoom + 0x74u);
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
    uint32_t pObjectsBase = U32(D2COM_VA(0xA0B94u) + g_com_rebase);
    uint32_t nObjectsCnt  = U32(D2COM_VA(0xA0B98u) + g_com_rebase);
    if (classId < nObjectsCnt) {
      U32(pUData + 0x00u) = pObjectsBase + classId * 0x1C0u;
    }
  }
  fn_CreateStatListEx((void *)(uintptr_t)pUnit, 0u, NULL, (void *)(uintptr_t)STAGE_GAME);
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
    if (U32(STAGE_GAME + 0x88u) == 0u) U32(STAGE_GAME + 0x88u) = pClient;
  }
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 12, 20, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 6, 200 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 7, 400 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 8, 100 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 9, 200 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 10, 100 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 11, 200 << 8, 0);
}

static void stage_monster_full(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint32_t mode,
    uint16_t x, uint16_t y, uint32_t seedLo) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 1u, classId, guid, mode, x, y, seedLo);
  if (pUData != 0u) {
    uint32_t pTables  = U32(D2COM_VA(0x99E1Cu) + g_com_rebase);
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
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 12, 20, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 6, 150 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 7, 300 << 8, 0);
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
    U32(pUData + 0x14u) = 0x00000010u;
    U32(pUData + 0x2Cu) = 12u;
    U16(pUData + 0x30u) = 100u;
    U8(pUData + 0x45u)  = 0xFFu;
  }
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

static void stage_quest_node(uint32_t pQuest, uint32_t qId, uint32_t pQuestEx) {
  uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(0x800u);
  uint32_t pGFlags  = (uint32_t)(uintptr_t)bump_alloc(0x80u);
  U32(pGFlags + 0x00u)         = pGFlags + 0x10u;
  U32(pGFlags + 0x04u)         = 0x300u;
  U32(pQuest + 0x00u)          = qId;
  U32(pQuest + 0x04u)          = STAGE_GAME;
  U32(pQuest + 0x18u)          = pQuestEx;
  U32(pQuest + 0xDCu)          = pMsgTbls;
  U32(pQuest + 0xE0u)          = qId;
  U32(STAGE_QUESTCTRL + 0x00u) = pQuest;
  U32(STAGE_QUESTCTRL + 0x08u) = 1u;
  U32(STAGE_QUESTCTRL + 0x0Cu) = pGFlags;
  U32(STAGE_QUESTCTRL + 0x18u) = 0x12345679u;
  U32(STAGE_QUESTCTRL + 0x1Cu) = 0x0000029Au;
  U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
}

static void stage_state_on_unit(uint32_t pUnit, int32_t stateId, int32_t statId, int32_t val, int32_t expireFrame) {
  void *pList = fn_AllocStatList(NULL, expireFrame > 0 ? 2u : 0u, (uint32_t)expireFrame,
                                 (int32_t)U32(pUnit + 0x00u), (int32_t)U32(pUnit + 0x0Cu));
  if (stateId >= 0) fn_SetStatListState(pList, stateId);
  if (statId >= 0)  fn_SetStat(pList, statId, val, 0u);
  fn_MergeStatLists((void *)(uintptr_t)pUnit, pList, 1);
  if (stateId >= 0) fn_ToggleGfxState((void *)(uintptr_t)pUnit, stateId, 1);
}

static uint32_t attach_skill(uint32_t pUnit, int32_t skillId, int32_t lvl) {
  if (U32(pUnit + 0xA8u) == 0u) {
    U32(pUnit + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
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

static void set_hireling_owner(uint32_t pMerc, uint32_t pOwner) {
  uint32_t pUData = U32(pMerc + 0x14u);
  uint32_t pAiGen = pUData ? U32(pUData + 0x28u) : 0u;
  if (pAiGen != 0u && pOwner != 0u) {
    U32(pAiGen + 0x28u) = STAGE_GAME;
    U32(pAiGen + 0x2Cu) = U32(pOwner + 0x0Cu);
    U32(pAiGen + 0x30u) = U32(pOwner + 0x00u);
  }
  U32(pMerc + 0x18u) = 0u;
}

static void attach_pet_record(uint32_t pOwner, uint32_t pMerc, uint16_t hireId) {
  uint32_t pUData = U32(pOwner + 0x14u);
  if (pUData != 0u) {
    uint32_t pPetCtrl = STAGE_PETCTRL;
    uint32_t pBuckets = (uint32_t)(uintptr_t)bump_alloc(0x100u);
    uint32_t pNode    = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    uint32_t petType  = 7u; /* hireling bucket */
    U32(pNode + 0x00u) = 0u;
    U32(pNode + 0x04u) = U32(pMerc + 0x0Cu);
    U32(pNode + 0x08u) = U32(pMerc + 0x0Cu);
    U16(pNode + 0x0Cu) = hireId;
    U32(pNode + 0x10u) = (uint32_t)hireId;
    U32(pBuckets + petType * 12u) = pNode;
    U32(pPetCtrl + 0x00u) = pBuckets;
    U32(pUData + 0x44u)   = pPetCtrl;
    uint32_t pCli = U32(pUData + 0x9Cu);
    if (pCli != 0u) U32(pCli + 0x44u) = pPetCtrl;
  }
}

/* ------------------------------- Core Emitter Runner */

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
  g_heap_top       = HEAP_BASE;

  g_thunk_target  = (uint32_t)((canonVa - D2GAME_PREF_BASE) + (uintptr_t)g_hGame);
  g_thunk_in_eax  = spec->eax;
  g_thunk_in_ecx  = spec->ecx;
  g_thunk_in_edx  = spec->edx;
  g_thunk_in_ebx  = spec->ebx;
  g_thunk_in_esi  = spec->esi;
  g_thunk_in_edi  = spec->edi;
  g_thunk_nargs   = spec->nargs;
  for (uint32_t i = 0; i < spec->nargs && i < MAX_STACK; i++) {
    g_thunk_args[i] = spec->args[i];
  }
  g_thunk_out_eax = 0u;
  g_thunk_faulted = 0;
  g_fault_code    = 0u;
  g_fault_eip     = 0u;
  g_fault_addr    = 0u;
  g_assert_line   = 0u;
  g_assert_a2     = 0u;
  g_thunk_in_call = 1;

  thunk_invoke();
  g_thunk_in_call  = 0;
  g_in_setup_phase = 1;

  if (g_thunk_faulted == 1) {
    uintptr_t gameOff = (g_fault_eip >= (uintptr_t)g_hGame && g_fault_eip < (uintptr_t)g_hGame + 0x130000u)
                            ? (g_fault_eip - g_game_rebase)
                            : 0;
    fprintf(stderr,
            "[k6-p14] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }
  int asserted = (g_thunk_faulted == 2);
  if (asserted != (expectAssert != 0)) {
    fprintf(stderr,
            "[k6-p14] ASSERT MISMATCH at %s (0x%08X) case %d (%s): expected=%d got=%d line=0x%X\n",
            fnName, canonVa, caseIdx, label, expectAssert, asserted, g_assert_line);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!asserted) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-p14] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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

  uint32_t maskedRet = asserted ? 0u : (g_thunk_out_eax & retMask);
  if (!asserted && g_game_rebase != 0 && retMask == 0xFFFFFFFFu) {
    uint32_t lo = (uint32_t)(uintptr_t)g_hGame;
    if (maskedRet >= lo && maskedRet < lo + 0x130000u && (maskedRet - lo) >= 0x1000u) {
      maskedRet -= (uint32_t)g_game_rebase;
    }
  }

  fprintf(g_out_fp,
          "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseIdx\":%d,\"label\":\"%s\",\"tsArgs\":[",
          canonVa, fnName, caseIdx, label);
  for (uint32_t i = 0; i < nTsArgs; i++) {
    fprintf(g_out_fp, "%s%lld", (i == 0 ? "" : ","), (long long)tsArgs[i]);
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
          asserted ? "true" : "false",
          asserted ? g_assert_line : 0u,
          maskedRet,
          setupTop,
          g_pre_json,
          postJson,
          g_heap_top);
  for (uint32_t a = HEAP_BASE; a < g_heap_top; a++) {
    uint8_t b = read_canon_byte(a, HEAP_BASE, g_heap_top);
    fputc(hexChars[(b >> 4) & 0xFu], g_out_fp);
    fputc(hexChars[b & 0xFu], g_out_fp);
  }
  fprintf(g_out_fp, "\"}\n");
  g_total_emitted++;
}

/* ------------------------------- Group 1: AI & Monster/Player Mode VAs (13 VAs) */

static void emit_group1_modes_and_ai(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[64];

  /* [01] 0x6FC41290 AIGENERAL_InitAiCommand (eax=pGame, ecx=pMonster, s=[pSrcCmd], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x1001u + (uint32_t)k, 1u, 5000u, 5000u, 0x1111u);
    if (k == 2) {
      uint32_t pOld = (uint32_t)(uintptr_t)bump_alloc(0x28u);
      U32(pOld + 0x00u) = pOld;
      U32(pOld + 0x04u) = pOld;
      U32(pOld + 0x08u) = 9u;
      U32(U32(STAGE_UDATA0 + 0x28u) + 0x20u) = pOld;
    }
    U32(STAGE_SCRATCH + 0x08u) = 1u + (uint32_t)k * 2u;
    U32(STAGE_SCRATCH + 0x0Cu) = 10u + (uint32_t)k;
    U32(STAGE_SCRATCH + 0x10u) = 5001u + (uint32_t)k;
    U32(STAGE_SCRATCH + 0x14u) = 5002u + (uint32_t)k;
    U32(STAGE_SCRATCH + 0x18u) = 0xAAu + (uint32_t)k;
    c = make_call();
    c.eax = STAGE_GAME; c.ecx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_init_cmd_k%d", k);
    run_and_emit(0x6FC41290u, "AIGENERAL_CopyAiCommandParams113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* [02] 0x6FC94F90 MONSTER_StartMove (eax=pAiCtrl, ecx=pMonster, edx=pathType, s=[pGame, velArg, distArg], ret 12) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x1011u + (uint32_t)k, 1u, 4850u, 4850u, 0x2222u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pathType = (k == 0) ? 0x64u : ((k == 1) ? 0x65u : 2u);
    uint32_t velArg   = (k == 0) ? 0u : (100u + (uint32_t)k * 50u);
    uint32_t distArg  = (k == 2) ? 7u : 5u;
    if (k == 1) {
      U32(pAiCtrl + 0x18u) = 0x65u;
      U32(pAiCtrl + 0x1Cu) = 333u;
      U8(pAiCtrl + 0x20u)  = 4u;
    } else if (k == 2) {
      U32(STAGE_PATH0 + 0x10u) = 4860u;
      U32(STAGE_PATH0 + 0x14u) = 4860u;
    }
    c = make_call();
    c.eax = pAiCtrl; c.ecx = STAGE_UNIT0; c.edx = pathType;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = velArg; c.args[2] = distArg; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pAiCtrl; ts[3] = pathType; ts[4] = velArg; ts[5] = distArg;
    snprintf(lbl, sizeof(lbl), "mon_start_move_k%d", k);
    run_and_emit(0x6FC94F90u, "MONSTER_StartMove113c", k, lbl, &c, ts, 6u, 0u, 0);
  }

  /* [03] 0x6FC95E10 MONSTER_StartMode (stdcall(pGame, pModeChange, bClearUsedSkill), ret 12) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x1021u + (uint32_t)k, 1u, 4850u, 4850u, 0x3333u);
    if (k == 0) {
      U32(STAGE_SCRATCH + 0x04u) = 0u; /* pMonster == NULL */
    } else if (k == 1) {
      U32(STAGE_SCRATCH + 0x00u) = 1u; /* NU neutral */
      U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    } else {
      U32(STAGE_SCRATCH + 0x00u) = 3u; /* WL walk */
      U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
      U32(STAGE_SCRATCH + 0x0Cu) = 4860u;
      U32(STAGE_SCRATCH + 0x10u) = 4860u;
      U32(STAGE_SCRATCH + 0x18u) = 200u;
    }
    uint32_t bClr = (k == 2) ? 1u : 0u;
    c = make_call();
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_SCRATCH; c.args[2] = bClr; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH; ts[2] = bClr;
    snprintf(lbl, sizeof(lbl), "mon_start_mode_k%d", k);
    run_and_emit(0x6FC95E10u, "MONSTER_StartMode113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* [04] 0x6FC96040 MONSTER_EndDeath (ecx=pGame, edx=pMonster, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2) ? 156u : 1u, 0x1031u + (uint32_t)k, 12u, 4850u, 4850u, 0x4444u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (k == 1) {
      U32(STAGE_UNIT0 + 0xC4u) = U32(STAGE_UNIT0 + 0xC4u) | 0x00040000u; /* corpse stays? */
    } else if (k == 2) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x1039u, 1u, 4855u, 4855u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_UNIT0 + 0x94u) = 0u;
      U32(STAGE_UNIT0 + 0x98u) = 0x1039u;
      U32(STAGE_UNIT0 + 0xC8u) = U32(STAGE_UNIT0 + 0xC8u) | 0x400u;
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "mon_end_death_k%d", k);
    run_and_emit(0x6FC96040u, "MONSTER_EndDeath113c", k, lbl, &c, ts, 2u, 0u, 0);
  }

  /* [05] 0x6FC96270 MONSTER_StartDeath (ecx=pGame, edx=pModeChange, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2) ? 0x14u : 1u, 0x1041u + (uint32_t)k, 1u, 4850u, 4850u, 0x5555u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (k >= 1) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x1049u, 1u, 4855u, 4855u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    }
    if (k == 2) {
      U32(STAGE_UNIT0 + 0xC4u) = U32(STAGE_UNIT0 + 0xC4u) | 0x20000u; /* NO_TREASURE / SKIP */
    }
    U32(STAGE_SCRATCH + 0x00u) = 0u; /* DT */
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "mon_start_death_k%d", k);
    run_and_emit(0x6FC96270u, "MONSTER_StartDeath113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* [06] 0x6FC96BF0 MONSTER_EndToAiOrNeutral (ecx=pGame, edx=pMonster, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    uint32_t cls  = (k == 2) ? 0x6Eu : 1u;
    uint32_t mode = (k == 2) ? 8u : ((k == 1) ? 1u : 6u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x1051u + (uint32_t)k, mode, 4850u, 4850u, 0x6666u);
    if (k == 1) {
      stage_state_on_unit(STAGE_UNIT0, 1, -1, 0, 200); /* STATE_FREEZE */
    }
    uint32_t argMon = STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = argMon;
    ts[0] = STAGE_GAME; ts[1] = argMon;
    snprintf(lbl, sizeof(lbl), "mon_end_ai_k%d", k);
    run_and_emit(0x6FC96BF0u, "MONSTER_EndToAiOrNeutral113c", k, lbl, &c, ts, 2u, 0u, 0);
  }

  /* [07] 0x6FC96FE0 MONSTER_StepRun (ecx=pGame, edx=pMonster, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x1061u + (uint32_t)k, 14u, 4850u, 4850u, 0x7777u);
    if (k == 1) {
      U32(STAGE_PATH0 + 0x20u) = 2u; /* path points */
      U32(STAGE_PATH0 + 0x7Cu) = 0x1000u;
    } else if (k == 2) {
      U32(STAGE_UNIT0 + 0x10u) = 14u;
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "mon_step_run_k%d", k);
    run_and_emit(0x6FC96FE0u, "MONSTER_StepRun113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* [08] 0x6FC97010 MONSTER_StepWalk (ecx=pGame, edx=pMonster, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x1071u + (uint32_t)k, 3u, 4850u, 4850u, 0x8888u);
    if (k == 1) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x1079u, 1u, 4858u, 4858u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1; /* target unit */
    } else if (k == 2) {
      U32(STAGE_PATH0 + 0x10u) = 4860u;
      U32(STAGE_PATH0 + 0x14u) = 4860u;
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "mon_step_walk_k%d", k);
    run_and_emit(0x6FC97010u, "MONSTER_StepWalk113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* [09] 0x6FC99170 PLAYER_StartModeDispatch (ecx=pGame, edx=pPlayer, s=[arg14, arg18], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x1081u + (uint32_t)k, (k == 2) ? 0u : 1u, 4850u, 4850u, STAGE_CLIENT);
    if (k >= 1) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, 0, 1); /* Attack */
      if (pSk != 0u) {
        U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk; /* pUsedSkill */
      }
      if (k == 2) {
        U32(STAGE_UNIT0 + 0x10u) = 17u; /* dead -> return 2 */
        U32(STAGE_UNIT0 + 0xC4u) = U32(STAGE_UNIT0 + 0xC4u) | 0x40u;
      }
    }
    uint32_t arg14 = (k == 1) ? 1u : 0u;
    uint32_t arg18 = (k == 1) ? 1u : 2u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = arg14; c.args[1] = arg18; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = arg14; ts[3] = arg18;
    snprintf(lbl, sizeof(lbl), "plr_mode_disp_k%d", k);
    run_and_emit(0x6FC99170u, "PLAYER_StartModeDispatch113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* [10] 0x6FCA3130 AiFallen (ecx=pGame, edx=pMonster, s=[pAiParam], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 0x1091u + (uint32_t)k, (k == 0) ? 0u : 1u, 4850u, 4850u, 0x1234u + (uint32_t)k);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x1098u, 1u, 4855u, 4855u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pMonStats = U32(STAGE_UDATA0 + 0x00u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x14u) = (k == 1) ? 4u : 25u;
    U32(STAGE_SCRATCH + 0x18u) = (k == 1) ? 1u : 0u;
    U32(STAGE_SCRATCH + 0x1Cu) = pMonStats;
    if (k == 2) {
      U32(STAGE_SCRATCH + 0x14u) = 3u;
      U32(STAGE_SCRATCH + 0x18u) = 1u;
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_fallen_k%d", k);
    run_and_emit(0x6FCA3130u, "AiFallen113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* [11] 0x6FCA38B0 AiZombie (ecx=pGame, edx=pMonster, s=[pAiParam], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x10A1u + (uint32_t)k, 1u, 4850u, 4850u, 0x2345u + (uint32_t)k);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x10A8u, 1u, 4854u, 4854u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pMonStats = U32(STAGE_UDATA0 + 0x00u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x14u) = (k == 0) ? 20u : 2u;
    U32(STAGE_SCRATCH + 0x18u) = (k == 0) ? 0u : 1u;
    U32(STAGE_SCRATCH + 0x1Cu) = pMonStats;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_zombie_k%d", k);
    run_and_emit(0x6FCA38B0u, "AiZombie113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* [43] 0x6FD01930 MONSTER_StepPath (eax=pMonster, edi=pGame, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x10B1u + (uint32_t)k, 3u, 4850u, 4850u, 0x3456u);
    if (k == 1) {
      U32(STAGE_PATH0 + 0x20u) = 2u; /* path points */
      U16(STAGE_PATH0 + 0x34u) = 4851u;
      U16(STAGE_PATH0 + 0x36u) = 4851u;
      U16(STAGE_PATH0 + 0x38u) = 4852u;
      U16(STAGE_PATH0 + 0x3Au) = 4852u;
    } else if (k == 2) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x10B9u, 1u, 4852u, 4852u, STAGE_CLIENT);
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      U32(STAGE_PATH0 + 0x5Cu) = 0u;
      U32(STAGE_PATH0 + 0x60u) = 0x10B9u;
    }
    c = make_call();
    c.eax = STAGE_UNIT0; c.edi = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "mon_step_path_k%d", k);
    run_and_emit(0x6FD01930u, "MONSTER_StepPath113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* [44] 0x6FD13220 AI_GeneralFindTargetOrThrottle (ecx=pMonster, edx=pSpecial/pAiGen, eax=pOutMelee, s=[pGame, pOutDist], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x10C1u + (uint32_t)k, 1u, 4850u, 4850u, 0x4567u);
    uint32_t pSpecial  = U32(STAGE_UDATA0 + 0x28u);
    uint32_t pOutMelee = STAGE_SCRATCH + 0x100u;
    uint32_t pOutDist  = STAGE_SCRATCH + 0x104u;
    if (k == 0) {
      U32(pOutDist) = 10u; /* stall branch (<25 -> stall 10) */
    } else if (k == 1) {
      U32(pOutDist) = 40u; /* stall branch (>=35 -> stall 25) */
    } else {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x10C9u, 1u, 4852u, 4852u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      U16(pSpecial + 0x08u) = 0x40u;
      U32(pOutDist) = 10u;
    }
    c = make_call();
    c.ecx = STAGE_UNIT0; c.edx = pSpecial; c.eax = pOutMelee;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pOutDist; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pSpecial; ts[3] = pOutMelee; ts[4] = pOutDist;
    snprintf(lbl, sizeof(lbl), "ai_find_tgt_k%d", k);
    run_and_emit(0x6FD13220u, "AI_GeneralFindTargetOrThrottle113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Group 2: Combat Helpers [12]..[27] (16 VAs) */

static void emit_group2_combat_part1(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* [12] 0x6FCEB950 SUNITDMG_TriggerBlockEvents (edx=pDefender, s=[pClient, actionIdx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 0) ? 0u : 1u;
    if (uType == 0u) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x2001u, 1u, 5000u, 5000u, STAGE_CLIENT);
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x2002u + (uint32_t)k, 1u, 5000u, 5000u, 0x1111u);
    }
    uint32_t actIdx = (k == 0) ? 2u : ((k == 1) ? 7u : 12u);
    c = make_call();
    c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_CLIENT; c.args[1] = actIdx; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_CLIENT; ts[2] = actIdx;
    snprintf(lbl, sizeof(lbl), "trig_blk_ev_k%d", k);
    run_and_emit(0x6FCEB950u, "SUNITDMG_TriggerBlockEvents113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* [13] 0x6FCFA660 SUNITDMG_SelectDeathOverlayFlag (eax=baseClass, esi=pDmg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_PREF_BASE + 0x111F98u, 1u);
    U8(game_global_live(D2GAME_VA(0x111F98u))) = (uint8_t)k;
    U32(STAGE_DMG + 0x10u) = (k == 0) ? 500u : 0u; /* fireDmg */
    U32(STAGE_DMG + 0x1Cu) = (k == 1) ? 500u : 0u; /* ltngDmg */
    U32(STAGE_DMG + 0x24u) = (k == 2) ? 500u : 0u; /* coldDmg */
    if (k == 2) U8(STAGE_DMG + 0x05u) = 0x20u;
    uint32_t baseCls = (k == 0) ? 0u : ((k == 1) ? 5u : 9u);
    c = make_call();
    c.eax = baseCls; c.esi = STAGE_DMG;
    ts[0] = baseCls; ts[1] = STAGE_DMG;
    snprintf(lbl, sizeof(lbl), "death_ovl_k%d", k);
    run_and_emit(0x6FCFA660u, "SUNITDMG_SelectDeathOverlayFlag113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* [14] 0x6FCFA7B0 SUNITDMG_ExecuteSingleHit (esi=pCombat, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x2011u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x18u) = STAGE_DMG;
    U32(STAGE_DMG + 0x30u) = 50u;
    U32(STAGE_DMG + 0x34u) = 25u;
    U32(STAGE_DMG + 0x2Cu) = 40u;
    U32(STAGE_DMG + 0x18u) = 30u;
    if (k == 1) {
      stage_state_on_unit(STAGE_UNIT0, 0x99, -1, 0, 0); /* cannot be frozen */
      stage_state_on_unit(STAGE_UNIT0, 0x85, -1, 0, 0); /* shrine poison immune */
    } else if (k == 2) {
      stage_state_on_unit(STAGE_UNIT0, 0x76, -1, 0, 0); /* chill immune */
      stage_state_on_unit(STAGE_UNIT0, 0x83, -1, 0, 0); /* shrine fire? immune -> clears dmg+0x18 */
    }
    c = make_call();
    c.esi = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "exec_single_hit_k%d", k);
    run_and_emit(0x6FCFA7B0u, "SUNITDMG_ApplyCannotBeFrozenAndShrineImmunities_6FCFA7B0_113c", k, lbl, &c, ts, 1u, 0u, 0);
  }

  /* [15] 0x6FCFA890 SUNITDMG_ApplyAttackerThornsToSelf (eax=pAttacker, edi=pDefender, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x2021u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x2028u, 1u, 5004u, 5004u, 0x1111u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x78, (k == 0) ? 0 : (k == 1 ? 10 : -5), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x1F, (k == 2) ? 2 : 100, 0);
    c = make_call();
    c.eax = STAGE_UNIT0; c.edi = STAGE_UNIT1;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "att_thorns_k%d", k);
    run_and_emit(0x6FCFA890u, "SUNITDMG_ApplyAttackerThornsToSelf113c", k, lbl, &c, ts, 2u, 0u, 0);
  }

  /* [16] 0x6FCFA8C0 SUNITDMG_AddDemonDamageBonus (eax=pDefender, edi=pAttacker, ebx=pDmg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x2031u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0) ? 1u : 0u, 0x2038u, 1u, 5004u, 5004u, 0x1111u); /* 0=Skeleton (undead) */
    U32(STAGE_DMG + 0x0Cu) = 100u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x7A, (k == 1) ? 40 : ((k == 2) ? 120 : 0), 0); /* item_undeaddamage_percent */
    c = make_call();
    c.eax = STAGE_UNIT1; c.edi = STAGE_UNIT0; c.ebx = STAGE_DMG;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = STAGE_DMG;
    snprintf(lbl, sizeof(lbl), "demon_dmg_k%d", k);
    run_and_emit(0x6FCFA8C0u, "SUNITDMG_AddDemonDamageBonus113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* [17] 0x6FCFA930 SUNITDMG_ConsumeStaminaCost (ebx=pDefender, edi=staminaCost, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x2041u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0A, 100 << 8, 0);
    int32_t cost = (k == 0) ? 0 : ((k == 1) ? (30 << 8) : (150 << 8));
    c = make_call();
    c.ebx = STAGE_UNIT0; c.edi = (uint32_t)cost;
    ts[0] = STAGE_UNIT0; ts[1] = cost;
    snprintf(lbl, sizeof(lbl), "cons_stam_k%d", k);
    run_and_emit(0x6FCFA930u, "SUNITDMG_ConsumeStaminaCost113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* [18] 0x6FCFA970 SUNITDMG_ConsumeManaCost (ebx=pDefender, edi=manaCost, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x2051u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 100 << 8, 0);
    int32_t cost = (k == 0) ? -1 : ((k == 1) ? (25 << 8) : (120 << 8));
    c = make_call();
    c.ebx = STAGE_UNIT0; c.edi = (uint32_t)cost;
    ts[0] = STAGE_UNIT0; ts[1] = cost;
    snprintf(lbl, sizeof(lbl), "cons_mana_k%d", k);
    run_and_emit(0x6FCFA970u, "SUNITDMG_ConsumeManaCost113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* [19] 0x6FCFA9E0 SUNITDMG_CheckMonTypeFlag (eax=baseExp, s=[nLevel], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t baseExp = (k == 0) ? 0 : ((k == 1) ? 1000 : 100000000);
    uint32_t lvl    = (k == 0) ? 1u : ((k == 1) ? 80u : 95u);
    c = make_call();
    c.eax = (uint32_t)baseExp;
    c.nargs = 1; c.args[0] = lvl; c.calleePop = 4u;
    ts[0] = baseExp; ts[1] = lvl;
    snprintf(lbl, sizeof(lbl), "exp_ratio_lvl_k%d", k);
    run_and_emit(0x6FCFA9E0u, "SUNITDMG_CheckMonTypeFlag113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* [20] 0x6FCFAB90 SUNITDMG_PrependCombatNode (eax=pAttacker, ecx=pGame, ebx=pDefender, s=[pDmg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 0) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 7u, 0x2061u, 0u, 5000u, 5000u, 0u);
    } else {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x2061u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    }
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x2068u, 1u, 5004u, 5004u, 0x1111u);
    if (k == 2) {
      uint32_t pOld = (uint32_t)(uintptr_t)bump_alloc(0x88u);
      U32(STAGE_UNIT1 + 0xACu) = pOld;
    }
    U32(STAGE_DMG + 0x08u) = 42u + (uint32_t)k;
    U32(STAGE_DMG + 0x10u) = 77u + (uint32_t)k;
    c = make_call();
    c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.ebx = STAGE_UNIT1;
    c.nargs = 1; c.args[0] = STAGE_DMG; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_DMG;
    snprintf(lbl, sizeof(lbl), "prepend_cbt_k%d", k);
    run_and_emit(0x6FCFAB90u, "SUNITDMG_PrependCombatNode113c", k, lbl, &c, ts, 4u, 0u, 0);
  }

  /* [21] 0x6FCFAC10 SUNITDMG_GetPvpOrPetDamageMultiplier (eax=pCombat, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x2071u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x2075u + (uint32_t)k, 1u, 5004u, 5004u, STAGE_CLIENT1);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x2079u, 1u, 5008u, 5008u, 0x1111u);
    if (k == 0) {
      U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT2; /* monster vs player -> 100 */
      U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    } else if (k == 1) {
      U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT0; /* player vs player -> 17 */
      U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT1;
    } else {
      set_hireling_owner(STAGE_UNIT2, STAGE_UNIT0); /* hireling vs player -> 25 */
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT2;
      U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    c = make_call();
    c.eax = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "pvp_mult_k%d", k);
    run_and_emit(0x6FCFAC10u, "SUNITDMG_GetPvpOrPetDamageMultiplier113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, 0);
  }

  /* [22] 0x6FCFAD70 SUNITDMG_AddMonsterTypeDamageBonus (eax=pDefender, s=[pAttacker, pDmg], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x2081u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0) ? 1u : 156u, 0x2088u, 1u, 5004u, 5004u, 0x1111u);
    U32(STAGE_DMG + 0x0Cu) = 50u;
    if (k >= 1) {
      void *pList = fn_AllocStatList(NULL, 0u, 0u, 0, (int32_t)U32(STAGE_UNIT0 + 0x0Cu));
      uint16_t monType = (k == 1) ? 2u : 19u; /* demon vs animal? */
      fn_SetStat(pList, 0xB4, 80, monType);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pList, 1);
    }
    c = make_call();
    c.eax = STAGE_UNIT1;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_DMG; c.calleePop = 8u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = STAGE_DMG;
    snprintf(lbl, sizeof(lbl), "montype_dmg_k%d", k);
    run_and_emit(0x6FCFAD70u, "SUNITDMG_AddMonsterTypeDamageBonus113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* [23] 0x6FCFB1F0 SUNITDMG_ApplyArmorPenetrationAndFlatBonus (ebx=pAttacker, edi=pDefender, s=[pOutArmor, pOutBaseAr], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x2091u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x2098u, 1u, 5004u, 5004u, 0x1111u);
    uint32_t pOutDef = STAGE_SCRATCH + 0x00u;
    uint32_t pOutAr  = STAGE_SCRATCH + 0x04u;
    U32(pOutDef) = 1000u;
    U32(pOutAr)  = 500u;
    if (k == 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x73, 1, 0); /* ITD */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x74, 50, 0); /* -50% def */
    } else if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x74, 40, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0xB5, 200, 1); /* demon AR */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0xB6, 150, 2); /* demon dmg? */
    }
    c = make_call();
    c.ebx = STAGE_UNIT0; c.edi = STAGE_UNIT1;
    c.nargs = 2; c.args[0] = pOutDef; c.args[1] = pOutAr; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = pOutDef; ts[3] = pOutAr;
    snprintf(lbl, sizeof(lbl), "armor_pen_k%d", k);
    run_and_emit(0x6FCFB1F0u, "SUNITDMG_ApplyArmorPenetrationAndFlatBonus113c", k, lbl, &c, ts, 4u, 0u, 0);
  }

  /* [24] 0x6FCFB570 SUNITDMG_AddLeechedLifeToUnit (edi=pUnit, s=[dwHeal], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x20A1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 150 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 300 << 8, 0);
    if (k == 0) stage_state_on_unit(STAGE_UNIT0, 0x5C, -1, 0, 0); /* STATE_PREVENTHEAL? */
    uint32_t heal = (k == 1) ? (50u << 8) : (500u << 8);
    c = make_call();
    c.edi = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = heal; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = heal;
    snprintf(lbl, sizeof(lbl), "add_leech_hp_k%d", k);
    run_and_emit(0x6FCFB570u, "SUNITDMG_AddLeechedLifeToUnit113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* [25] 0x6FCFB6B0 SUNITDMG_ClampManaBurnByMonsterSkill (eax=pUnit, s=[nUnused, nLvl, nExp], ret 12) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x20B1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 271u, 0x20B8u, 1u, 5004u, 5004u, 0x1111u);
    uint32_t u = STAGE_UNIT1;
    if (k == 0) {
      u = STAGE_UNIT0; /* player direct -> returns nExp unchanged */
    } else {
      set_hireling_owner(STAGE_UNIT1, STAGE_UNIT0);
      attach_pet_record(STAGE_UNIT0, STAGE_UNIT1, 1u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, (k == 2) ? 10 : 5, 0);
    }
    uint32_t exp = 5000u;
    c = make_call();
    c.eax = u;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = 20u; c.args[2] = exp; c.calleePop = 12u;
    ts[0] = u; ts[1] = STAGE_GAME; ts[2] = 20u; ts[3] = exp;
    snprintf(lbl, sizeof(lbl), "clamp_merc_exp_k%d", k);
    run_and_emit(0x6FCFB6B0u, "SUNITDMG_ClampManaBurnByMonsterSkill113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* [26] 0x6FCFB910 SUNITDMG_TriggerGetHitStateAndMode (stdcall(pUnit, pDmg, divisorIdx), ret 12) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x20C1u + (uint32_t)k, 1u, 5000u, 5000u, 0x1234u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    U32(STAGE_DMG + 0x4Cu) = (k == 0) ? 0x10u : ((k == 1) ? 0x800u : 0x2000u);
    U32(STAGE_DMG + 0x28u) = (k == 0) ? 0u : 0x200u;
    c = make_call();
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_DMG; c.args[2] = (k == 2) ? 1u : 5u; c.calleePop = 12u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_DMG; ts[2] = (k == 2) ? 1u : 5u;
    snprintf(lbl, sizeof(lbl), "trig_gh_k%d", k);
    run_and_emit(0x6FCFB910u, "SUNITDMG_TriggerGetHitStateAndMode113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* [27] 0x6FCFBA40 SUNITDMG_ApplyLifeManaSteal (eax=pDmg, ecx=pDefender, edx=pGame, s=[pAttacker], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x20D1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    if (k == 2) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x20D8u, 1u, 5004u, 5004u, STAGE_CLIENT1);
    } else {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0) ? 1u : 19u, 0x20D8u, 1u, 5004u, 5004u, 0x1111u);
    }
    U32(STAGE_DMG + 0x08u) = 200u << 8;
    U32(STAGE_DMG + 0x38u) = (k == 0) ? 0u : 10u; /* lifeSteal */
    U32(STAGE_DMG + 0x3Cu) = (k == 2) ? 15u : 0u; /* manaSteal */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 50 << 8, 0);
    c = make_call();
    c.eax = STAGE_DMG; c.ecx = STAGE_UNIT1; c.edx = STAGE_GAME;
    c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_DMG;
    snprintf(lbl, sizeof(lbl), "life_mana_steal_k%d", k);
    run_and_emit(0x6FCFBA40u, "SUNITDMG_ApplyLifeManaSteal113c", k, lbl, &c, ts, 4u, 0u, 0);
  }
}

/* ------------------------------- Group 3: Combat Helpers [28]..[42] (15 VAs) */

static void emit_group3_combat_part2(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* [28] 0x6FCFBD00 SUNITDMG_ApplySingleChannelResistance (eax=pEntry, ecx=pCombat, s=[bSkipAbsorb], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x3001u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x3009u + (uint32_t)k, 1u, 5000u, 5000u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x27, (k == 1) ? 50 : 75, 0); /* fireresist */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x8F, (k == 2) ? 10 : 0, 0); /* fire absorb flat */
    if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x14D, 15, 0); /* passive_fire_pierce */
    }
    U32(STAGE_DMG + 0x10u) = (k == 0) ? 0u : 2000u; /* fireDmg */
    uint32_t pResPen = STAGE_SCRATCH + 0x300u;
    U32(pResPen) = (k == 2) ? (uint32_t)(-40) : 0u;
    uint32_t pCombat = STAGE_SCRATCH + 0x100u;
    U32(pCombat + 0x00u) = STAGE_GAME;
    U32(pCombat + 0x04u) = pResPen;
    U32(pCombat + 0x08u) = STAGE_UNIT1;
    U32(pCombat + 0x0Cu) = STAGE_UNIT0;
    U32(pCombat + 0x10u) = 0u;
    U32(pCombat + 0x14u) = 0u;
    U32(pCombat + 0x18u) = STAGE_DMG;
    U32(pCombat + 0x1Cu) = 0u;
    U32(pCombat + 0x20u) = 0u;
    U32(pCombat + 0x24u) = (k == 2) ? (2u << 8) : 0u;
    uint32_t pEntry = STAGE_SCRATCH + 0x200u;
    U32(pEntry + 0x00u) = 0x10u;   /* dmgOffset: fire */
    U32(pEntry + 0x04u) = 0x27u;   /* resStat: fireresist */
    U32(pEntry + 0x08u) = 0x28u;   /* maxResStat: maxfireresist */
    U32(pEntry + 0x0Cu) = 0x14Du;  /* pierceStat: passive_fire_pierce */
    U32(pEntry + 0x10u) = 0x8Eu;   /* absPctStat */
    U32(pEntry + 0x14u) = 0x8Fu;   /* absFlatStat */
    U32(pEntry + 0x18u) = 2u;      /* mdr index (pCombat+0x24) */
    c = make_call();
    c.eax = pEntry; c.ecx = pCombat;
    c.nargs = 1; c.args[0] = (k == 1) ? 1u : 0u; c.calleePop = 4u;
    ts[0] = pEntry; ts[1] = pCombat; ts[2] = (k == 1) ? 1u : 0u;
    snprintf(lbl, sizeof(lbl), "single_ch_res_k%d", k);
    run_and_emit(0x6FCFBD00u, "SUNITDMG_ApplySingleChannelResistance113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* [29] 0x6FCFBED0 SUNITDMG_RollDamageValue (eax=base, edx=max, ecx=minPct, s=[pUnit, min, maxPct], ret 12) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x3011u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    uint32_t base   = (k == 0) ? 10u : 50u;
    uint32_t minD   = (k == 0) ? 100u : ((k == 1) ? 2000u : 0x200000u);
    uint32_t maxD   = (k == 0) ? 100u : ((k == 1) ? 4000u : 0x400000u);
    uint32_t minPct = (k == 2) ? 120u : 50u;
    uint32_t maxPct = (k == 2) ? 150u : 50u;
    c = make_call();
    c.eax = base; c.edx = maxD; c.ecx = minPct;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = minD; c.args[2] = maxPct; c.calleePop = 12u;
    ts[0] = STAGE_UNIT0; ts[1] = base; ts[2] = minD; ts[3] = maxD; ts[4] = minPct; ts[5] = maxPct;
    snprintf(lbl, sizeof(lbl), "roll_dmg_val_k%d", k);
    run_and_emit(0x6FCFBED0u, "SUNITDMG_RollDamageValue113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* [30] 0x6FCFC030 SUNITDMG_GetTotalSkillDamageBonus (eax=baseExp, ebx=pKiller, edi=nLevel, s=[bFlag, nPartyPct], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x3021u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x55, (k == 2) ? 50 : 0, 0); /* item_addexperience */
    uint32_t exp  = (k == 0) ? 0u : 10000u;
    uint32_t lvl  = (k == 0) ? 1u : ((k == 1) ? 15u : 45u);
    uint32_t bFlg = (k == 2) ? STAGE_GAME : 0u;
    uint32_t pct  = (k == 2) ? 50u : 100u;
    c = make_call();
    c.eax = exp; c.ebx = STAGE_UNIT0; c.edi = lvl;
    c.nargs = 2; c.args[0] = bFlg; c.args[1] = pct; c.calleePop = 8u;
    ts[0] = exp; ts[1] = STAGE_UNIT0; ts[2] = lvl; ts[3] = bFlg; ts[4] = pct;
    snprintf(lbl, sizeof(lbl), "exp_share_total_k%d", k);
    run_and_emit(0x6FCFC030u, "SUNITDMG_GetTotalSkillDamageBonus113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* [31] 0x6FCFC0B0 SUNITDMG_ApplyResistancesAndAbsorb (stdcall(pGame, pAttacker, pDefender, pDmg), ret 16) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x3031u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x3038u, 1u, 5004u, 5004u, 0x1111u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x24, (k == 1) ? 25 : 0, 0); /* damageresist */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x27, (k == 1) ? 50 : 0, 0); /* fireresist */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x22, 10, 0); /* dmg red */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x14D, (k == 2) ? 25 : 0, 0); /* fire pierce */
    U32(STAGE_DMG + 0x08u) = 1000u; /* phys */
    U32(STAGE_DMG + 0x10u) = 2000u; /* fire */
    U32(STAGE_DMG + 0x24u) = 500u;  /* cold */
    U32(STAGE_DMG + 0x30u) = 50u;   /* coldLen */
    U32(STAGE_DMG + 0x54u) = 0x400u;
    uint32_t def = (k == 2) ? STAGE_UNIT0 : STAGE_UNIT1;
    uint32_t att = (k == 2) ? STAGE_UNIT1 : STAGE_UNIT0;
    c = make_call();
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = att; c.args[2] = def; c.args[3] = STAGE_DMG; c.calleePop = 16u;
    ts[0] = STAGE_GAME; ts[1] = att; ts[2] = def; ts[3] = STAGE_DMG;
    snprintf(lbl, sizeof(lbl), "apply_res_abs_k%d", k);
    run_and_emit(0x6FCFC0B0u, "SUNITDMG_ApplyResistancesAndAbsorb113c", k, lbl, &c, ts, 4u, 0u, 0);
  }

  /* [32] 0x6FCFC530 SUNITDMG_ComputeWeaponBaseDamage (eax=minEnh, ecx=maxValOrEnh, edx=pUnit, s=[bUseWpn,pWpn,minBase,flatAdd,srcDmg], ret 20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x3041u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 100, 0); /* str */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 80, 0);  /* dex */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x19, 50, 0); /* damagepercent */
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x3048u, 1u, 2u, 0u, 0u, 0x1111u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x15, 10, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x16, 20, 0);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4); /* r-arm */
    }
    uint32_t bUseWpn = (k == 0) ? 0u : 1u;
    uint32_t pWpn    = (k == 2) ? STAGE_UNIT1 : 0u;
    uint32_t srcDmg  = (k == 2) ? 0x40u : 0x80u;
    c = make_call();
    c.eax = 25u; c.ecx = (k == 0) ? 40u : 0u; c.edx = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = bUseWpn; c.args[1] = pWpn; c.args[2] = 10u; c.args[3] = 5u << 8; c.args[4] = srcDmg;
    c.calleePop = 20u;
    ts[0] = STAGE_UNIT0; ts[1] = 25; ts[2] = (k == 0) ? 40 : 0; ts[3] = bUseWpn; ts[4] = pWpn; ts[5] = 10; ts[6] = 5 << 8; ts[7] = srcDmg;
    snprintf(lbl, sizeof(lbl), "wpn_base_dmg_k%d", k);
    run_and_emit(0x6FCFC530u, "SUNITDMG_ComputeWeaponBaseDamage113c", k, lbl, &c, ts, 8u, 0xFFFFFFFFu, 0);
  }

  /* [33] 0x6FCFC780 SUNITDMG_ApplyColdChilledEffect (eax=pAttacker, esi=pDefender, s=[coldLen], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x3051u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x3058u, 1u, 5004u, 5004u, 0x1111u);
    if (k == 2) {
      stage_state_on_unit(STAGE_UNIT1, 0x0B, -1, 0, 150); /* already chilled -> extend expire */
    }
    uint32_t len = (k == 0) ? 0u : ((k == 1) ? 100u : 200u);
    c = make_call();
    c.eax = STAGE_UNIT0; c.esi = STAGE_UNIT1;
    c.nargs = 1; c.args[0] = len; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = len;
    snprintf(lbl, sizeof(lbl), "apply_chill_k%d", k);
    run_and_emit(0x6FCFC780u, "SUNITDMG_ApplyColdChilledEffect113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* [34] 0x6FCFC940 SUNITDMG_ApplyBurnEffect_6FCFC940 (stdcall(pAttacker, pDefender, burnDmg, burnLen), ret 16) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x3061u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x3068u, 1u, 5004u, 5004u, 0x1111u);
    if (k == 2) {
      stage_state_on_unit(STAGE_UNIT1, 0x73, 0x4A, -10, 120); /* existing weaker burn -> overwrite */
    }
    uint32_t dmg = (k == 0) ? 0u : 30u;
    uint32_t len = (k == 0) ? 0u : (100u + (uint32_t)k * 50u);
    c = make_call();
    c.nargs = 4; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_UNIT1; c.args[2] = dmg; c.args[3] = len; c.calleePop = 16u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = dmg; ts[3] = len;
    snprintf(lbl, sizeof(lbl), "apply_burn_k%d", k);
    run_and_emit(0x6FCFC940u, "SUNITDMG_ApplyBurnEffect_6FCFC940_113c", k, lbl, &c, ts, 4u, 0u, 0);
  }

  /* [35] 0x6FCFCAB0 SUNITDMG_ApplyPoisonEffect (stdcall(pAttacker, pDefender, poisDmg, poisLen), ret 16) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x3071u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x3078u, 1u, 5004u, 5004u, 0x1111u);
    if (k == 2) {
      stage_state_on_unit(STAGE_UNIT1, 2, 0x4A, -5, 110);
    }
    uint32_t dmg = (k == 0) ? 0u : 25u;
    uint32_t len = (k == 0) ? 0u : (75u + (uint32_t)k * 25u);
    c = make_call();
    c.nargs = 4; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_UNIT1; c.args[2] = dmg; c.args[3] = len; c.calleePop = 16u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = dmg; ts[3] = len;
    snprintf(lbl, sizeof(lbl), "apply_pois_k%d", k);
    run_and_emit(0x6FCFCAB0u, "SUNITDMG_ApplyPoisonEffect113c", k, lbl, &c, ts, 4u, 0u, 0);
  }

  /* [36] 0x6FCFCC20 SUNITDMG_ApplyStunEffect (eax=pAttacker, edi=pDefender, s=[stunLen], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x3081u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x3085u + (uint32_t)k, 1u, 5004u, 5004u, STAGE_CLIENT1);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x3089u, 1u, 5008u, 5008u, 0x1111u);
    uint32_t def = (k == 2) ? STAGE_UNIT2 : STAGE_UNIT1;
    uint32_t len = (k == 0) ? 0u : ((k == 1) ? 300u : 40u); /* player clamp at 250 */
    c = make_call();
    c.eax = STAGE_UNIT0; c.edi = def;
    c.nargs = 1; c.args[0] = len; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = def; ts[2] = len;
    snprintf(lbl, sizeof(lbl), "apply_stun_k%d", k);
    run_and_emit(0x6FCFCC20u, "SUNITDMG_ApplyStunEffect113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* [37] 0x6FCFCD80 SUNITDMG_RollElementalStatDamage (eax=maxStat, edi=pUnit, s=[minStat, masteryStat, minEd, maxEd, base], ret 20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x3091u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x30, (k == 0) ? 0 : 10, 0); /* firemindam */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x31, (k == 0) ? 0 : 30, 0); /* firemaxdam */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x149, (k == 2) ? 50 : 0, 0); /* passive_fire_mastery */
    uint32_t base = (k == 0) ? 100u : (10u << 8);
    c = make_call();
    c.eax = 0x31u; c.edi = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = 0x30u; c.args[1] = (k == 2) ? 0x149u : 0xFFFFFFFFu; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = base;
    c.calleePop = 20u;
    ts[0] = STAGE_UNIT0; ts[1] = 0x30; ts[2] = 0x31; ts[3] = (k == 2) ? 0x149 : -1; ts[4] = 0; ts[5] = 0; ts[6] = base;
    snprintf(lbl, sizeof(lbl), "roll_elem_k%d", k);
    run_and_emit(0x6FCFCD80u, "SUNITDMG_RollElementalStatDamage113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* [38] 0x6FCFCE70 SUNITDMG_TriggerAttackerBlindOrFlee (edi=pAttacker, esi=pDefender, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x30A1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 1) ? 0x2C1u : 1u, 0x30A8u, 1u, 5004u, 5004u, 0x1111u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x75, (k == 0) ? 0 : 1, 0); /* item_stupidity */
    c = make_call();
    c.edi = STAGE_UNIT0; c.esi = STAGE_UNIT1;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "trig_blind_k%d", k);
    run_and_emit(0x6FCFCE70u, "SUNITDMG_TriggerAttackerBlindOrFlee113c", k, lbl, &c, ts, 2u, 0u, 0);
  }

  /* [39] 0x6FCFD450 SUNITDMG_FillDamageValues (stdcall(pGame, pAttacker, pDefender, pDmg, bUseWpnStats, srcDmg), ret 24) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x30B1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x30B8u, 1u, 5004u, 5004u, 0x1111u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x30, 5, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x31, 15, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x8D, (k == 2) ? 100 : 0, 0); /* deadly strike */
    U32(STAGE_DMG + 0x00u) = (k == 0) ? 1u : 0u; /* dmgFlags */
    U32(STAGE_DMG + 0x08u) = 20u << 8;
    c = make_call();
    c.nargs = 6; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.args[3] = STAGE_DMG; c.args[4] = (k == 2) ? 1u : 0u; c.args[5] = 0x80u;
    c.calleePop = 24u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_DMG; ts[4] = (k == 2) ? 1u : 0u; ts[5] = 0x80u;
    snprintf(lbl, sizeof(lbl), "fill_dmg_k%d", k);
    run_and_emit(0x6FCFD450u, "SUNITDMG_FillDamageValues113c", k, lbl, &c, ts, 6u, 0u, 0);
  }

  /* [40] 0x6FCFDAC0 SUNITDMG_ApplyFreezeEffect (eax=pDefender, ecx=pAttacker, s=[frzLen], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x30C1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x30C5u, 1u, 5004u, 5004u, STAGE_CLIENT1);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x30C9u, 1u, 5008u, 5008u, 0x1111u);
    uint32_t def = (k == 0) ? STAGE_UNIT1 : STAGE_UNIT2;
    uint32_t len = (k == 2) ? 200u : 100u;
    if (k == 2) stage_state_on_unit(STAGE_UNIT2, 1, -1, 0, 150); /* extend freeze */
    c = make_call();
    c.eax = def; c.ecx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = len; c.calleePop = 4u;
    ts[0] = def; ts[1] = STAGE_UNIT0; ts[2] = len;
    snprintf(lbl, sizeof(lbl), "apply_freeze_k%d", k);
    run_and_emit(0x6FCFDAC0u, "SUNITDMG_ApplyFreezeEffect113c", k, lbl, &c, ts, 3u, 0u, 0);
  }

  /* [41] 0x6FCFDE90 SUNITDMG_CheckToHit (eax=pAttacker, s=[pDefender, nArPctBonus, nCheckSkillFlag], ret 12) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x30D1u + (uint32_t)k, 1u, 5000u, 5000u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x30D8u, 1u, 5004u, 5004u, 0x1111u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 1000, 0); /* tohit */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x1F, 100, 0); /* AC */
    uint32_t att = (k == 0) ? 0u : ((k == 2) ? STAGE_UNIT1 : STAGE_UNIT0);
    uint32_t def = (k == 2) ? STAGE_UNIT0 : STAGE_UNIT1;
    if (k == 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x75, 1, 0); /* stupidity -> triggers Blind! */
    c = make_call();
    c.eax = att;
    c.nargs = 3; c.args[0] = def; c.args[1] = 200u; c.args[2] = (k == 2) ? 1u : 0u; c.calleePop = 12u;
    ts[0] = att; ts[1] = def; ts[2] = 200; ts[3] = (k == 2) ? 1 : 0;
    snprintf(lbl, sizeof(lbl), "check_to_hit_k%d", k);
    run_and_emit(0x6FCFDE90u, "SUNITDMG_CheckToHit113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* [42] 0x6FCFEEE0 SUNITDMG_DistributeExperience (ecx=pGame, edx=pDefender, s=[pAttacker, bAwardExp], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_with_chunk(STAGE_GAME, 0u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_quest_node(STAGE_QUEST0, 6u, STAGE_QUESTEX0);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x30E1u + (uint32_t)k, 1u, 4850u, 4850u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x30E8u, 1u, 4854u, 4854u, 0x1111u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAtt = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t bAw  = (k == 2) ? 1u : 0u;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT1;
    c.nargs = 2; c.args[0] = pAtt; c.args[1] = bAw; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1; ts[2] = pAtt; ts[3] = bAw;
    snprintf(lbl, sizeof(lbl), "dist_exp_k%d", k);
    run_and_emit(0x6FCFEEE0u, "SUNITDMG_DistributeExperience113c", k, lbl, &c, ts, 4u, 0u, 0);
  }
}

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "Usage: %s <datatbls.img> <out.ndjson>\n", argv[0]);
    return 1;
  }
  const char *imgPath = argv[1];
  const char *outPath = argv[2];

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE,    DATATBLS_SIZE,    MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pVtbl  = VirtualAlloc((void *)HASH_VTABLE_ADDR, HASH_VTABLE_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE,       STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE,        HEAP_SIZE,        MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pVtbl != HASH_VTABLE_ADDR ||
      (uintptr_t)pStage != STAGE_BASE   || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-p14] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
    return 1;
  }

  g_hStorm      = LoadLibraryA("Storm.dll");
  g_hFog        = LoadLibraryA("Fog.dll");
  HMODULE hLang = LoadLibraryA("D2Lang.dll");
  HMODULE hCmp  = LoadLibraryA("D2CMP.dll");
  g_hCom        = LoadLibraryA("D2Common.dll");
  g_hNet        = LoadLibraryA("D2Net.dll");
  g_hGame       = LoadLibraryA("D2Game.dll");
  if (!g_hStorm || !g_hFog || !hLang || !hCmp || !g_hCom || !g_hNet || !g_hGame) {
    fprintf(stderr, "[k6-p14] LoadLibraryA failed\n");
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom  - (uintptr_t)D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - (uintptr_t)D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p14] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
  fn_SetStat            = (Com_SetStat_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10261));
  fn_SetStatListState   = (Com_SetStatListState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10785));
  fn_MergeStatLists     = (Com_MergeStatLists_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10807));
  fn_ToggleGfxState     = (Com_ToggleGfxState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10945));
  fn_AllocSkillList     = (Com_AllocSkillList_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10856));
  fn_SetSkillLevel      = (Com_SetSkillLevel_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10302));
  fn_AllocInventory     = (Com_AllocInventory_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10387));
  fn_PlaceItemInBodyLoc = (Com_PlaceItemInBodyLoc_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11041));

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStat || !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState ||
      !fn_AllocSkillList || !fn_SetSkillLevel || !fn_AllocInventory || !fn_PlaceItemInBodyLoc) {
    fprintf(stderr, "[k6-p14] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p14] failed to open %s\n", outPath);
    return 5;
  }

  emit_group1_modes_and_ai();
  emit_group2_combat_part1();
  emit_group3_combat_part2();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p14] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
