/*
 * k6-p16b-d2game-emitter.c — [K6-P16B] Real-DLL D2Game.dll Monster Spawn / AI / Pet Closure Emitter (15 Target VAs)
 *
 * Emits all 15 net-new target D2Game.dll VAs (>= 3 cases and >= 2 distinct non-degenerate
 * outcome signatures per VA). Compiled across -O2, -O2 -fno-omit-frame-pointer, -O1
 * (-m32 -Wall -Wextra -Werror) with naked thunk_invoke + 0 JMP hooks, running headless under
 * Wine against real v1.13c DLLs.
 *
 * NOTE for tools/oracle/k6/audit-dll-coverage.py:
 *   ONLY the 15 target VAs passed to run_and_emit(...) may appear as 0x6F[CD]xxxxx hex literals
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
#define ITEMS_TXTLINK_HDR_ADDR   (HASH_VTABLE_ADDR + 0x0100u)
#define ITEMS_TXTLINK_NODES_ADDR (HASH_VTABLE_ADDR + 0x0110u)

#define STAGE_BASE       0x30000000u
#define STAGE_FIXED_SIZE 0x00009000u
#define STAGE_CS_GAME    0x30010000u
#define STAGE_SETUP_BASE 0x30020000u
#define STAGE_TOTAL_SIZE 0x00100000u

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
#define HEAP_SIZE        0x00400000u

#define MAX_STACK        16
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
static uint32_t g_extra_cap_count = 0;

static __attribute__((unused)) void add_extra_cap(uint32_t canonAddr, uint32_t len) {
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
typedef void  (__stdcall *Com_SetStatListState_t)(void *pList, int32_t state);
typedef void  (__stdcall *Com_MergeStatLists_t)(void *pUnit, void *pSubList, int32_t bType);
typedef void  (__stdcall *Com_ToggleGfxState_t)(void *pUnit, int32_t state, int32_t bSet);
typedef void *(__stdcall *Com_AllocSkillList_t)(void *pPool);
typedef void  (__stdcall *Com_SetSkillLevel_t)(void *pUnit, int32_t skId, int32_t lvl, int32_t bRem, int32_t u5, int32_t u6);
typedef void *(__stdcall *Com_AllocInventory_t)(void *pPool, void *pOwner);
typedef int32_t(__stdcall *Com_PlaceItemInBodyLoc_t)(void *pInv, void *pItem, int32_t bodyLoc);
typedef void  (__stdcall *Com_PathSetTargetUnit_t)(void *pPath, void *pTarget);
typedef void *(__stdcall *Com_GetHirelingTxt_t)(int32_t nExp, int32_t wSubType, int32_t nLvl);

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
static Com_GetHirelingTxt_t     fn_GetHirelingTxt     = NULL;

static uint32_t g_item_sword   = 0;
static uint32_t g_item_jav     = 0;
static uint32_t g_item_armor   = 0;
static uint32_t g_item_shield  = 0;
static uint32_t g_merc_subtype = 0;

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

static AllocRec g_allocs[4096];
static uint32_t g_alloc_count = 0;

static void record_alloc(uint32_t ptr, uint32_t size) {
  if (g_alloc_count < 4096u) {
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
    fprintf(stderr, "[k6-p16b] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
      fprintf(stderr, "[k6-p16b] missing Fog.#%u\n", fogHooks[i].ord);
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
    fprintf(stderr, "[k6-p16b] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p16b] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_VA(0x99000u) + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p16b] short read at page %u\n", i);
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
        fprintf(stderr, "[k6-p16b] mem json buffer overflow\n");
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
    fprintf(stderr, "[k6-p16b] mem json cap overflow\n");
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
  g_setup_top        = STAGE_SETUP_BASE;
  g_heap_top         = HEAP_BASE;
  g_alloc_count      = 0u;
  g_extra_cap_count  = 0u;
  g_in_setup_phase   = 1;
  g_fake_tick_count  = 100000u;
  g_fake_qpc_lo      = 1234567u;
  g_fake_qpc_hi      = 0u;
  g_d2net_send_ok    = 1u;
  g_d2net_client_key = 0x11223344u;

  /* Reset mutable D2Game .data globals between cases */
  U32(game_global_live(D2GAME_VA(0x10D8BCu))) = 0u; /* 0x6FD2D8BC */
  U32(game_global_live(D2GAME_VA(0x10E34Cu))) = 0u; /* 0x6FD2E34C */
  U32(game_global_live(D2GAME_VA(0x10E360u))) = 0u; /* 0x6FD2E360 */
  memset((void *)(uintptr_t)game_global_live(D2GAME_VA(0x1101E0u)), 0, 0x20u);
  memset((void *)(uintptr_t)game_global_live(D2GAME_VA(0x110398u)), 0, 0x820u);
  U32(game_global_live(D2GAME_VA(0x1107B8u))) = 0u;
  memset((void *)(uintptr_t)game_global_live(D2GAME_VA(0x110C04u)), 0, 0x1008u);
  memset((void *)(uintptr_t)game_global_live(D2GAME_VA(0x111C0Cu)), 0, 0x40u);
  memset((void *)(uintptr_t)game_global_live(D2GAME_VA(0x111F7Cu)), 0, 0x24u);
  memset((void *)(uintptr_t)game_global_live(D2GAME_VA(0x119FA0u)), 0, 8u);

  U32(STAGE_GAME + 0x18u)      = STAGE_CS_GAME;
  U8(STAGE_GAME + 0x6Du)       = 0u;
  U32(STAGE_GAME + 0x70u)      = 1u;
  U16(STAGE_GAME + 0x78u)      = 100u;
  U32(STAGE_GAME + 0xA8u)      = 100u;
  U32(STAGE_GAME + 0xD0u)      = 0x13579BDFu;
  U32(STAGE_GAME + 0xD4u)      = 0x0000029Au;
  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
  U32(STAGE_CLIENT + 0x1A8u)   = STAGE_GAME;
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
    if (!g_item_sword  && code == 0x20647373u) g_item_sword  = id;
    if (!g_item_jav    && code == 0x2076616Au) g_item_jav    = id;
    if (!g_item_armor  && code == 0x20697571u) g_item_armor  = id;
    if (!g_item_shield && code == 0x206C6D73u) g_item_shield = id;
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
  for (uint32_t sub = 1u; sub < 50u; sub++) {
    uint32_t pH = (uint32_t)(uintptr_t)fn_GetHirelingTxt(1, (int32_t)sub, 10);
    if (pH != 0u && S32(pH + 0x78u) > 0) {
      g_merc_subtype = sub;
      break;
    }
  }
}

static void stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  uint32_t actNo = (levelId >= 109u) ? 4u : (levelId >= 103u) ? 3u : (levelId >= 75u) ? 2u : (levelId >= 40u) ? 1u : 0u;
  U32(pAct + 0x08u)         = actNo;
  U32(pAct + 0x10u)         = pRoom;
  U32(pAct + 0x48u)         = STAGE_DRLG0;
  U32(STAGE_DRLG0 + 0x47Cu) = pLevel;
  U32(STAGE_GAME + 0xBCu + actNo * 4u) = pAct;
  if (U32(STAGE_GAME + 0xBCu) == 0u) U32(STAGE_GAME + 0xBCu) = pAct;
  U32(pRoom + 0x10u)    = pRoomEx;
  U32(pRoom + 0x2Cu)    = pAct;
  U32(pRoom + 0x4Cu)    = 4800u;
  U32(pRoom + 0x50u)    = 4800u;
  U32(pRoom + 0x54u)    = 32u;
  U32(pRoom + 0x58u)    = 32u;
  U32(pRoom + 0x5Cu)    = 960u;
  U32(pRoom + 0x60u)    = 960u;
  U32(pRoom + 0x64u)    = 6u;
  U32(pRoom + 0x68u)    = 6u;
  U32(pRoom + 0x6Cu)    = 0x2468ACE1u;
  U32(pRoom + 0x70u)    = 0x0000029Au;
  U32(pRoomEx + 0x28u)  = 0x03100000u;
  U32(pRoomEx + 0x30u)  = pRoom;
  U32(pRoomEx + 0x34u)  = 960u;
  U32(pRoomEx + 0x38u)  = 960u;
  U32(pRoomEx + 0x3Cu)  = 6u;
  U32(pRoomEx + 0x40u)  = 6u;
  U32(pRoomEx + 0x58u)  = pLevel;
  U32(pLevel + 0x10u)   = pRoomEx;
  U32(pLevel + 0x1Cu)   = 960u;
  U32(pLevel + 0x20u)   = 960u;
  U32(pLevel + 0x24u)   = 6u;
  U32(pLevel + 0x28u)   = 6u;
  U32(pLevel + 0x1B4u)  = STAGE_DRLG0;
  U32(pLevel + 0x1D0u)  = levelId;
}

static uint32_t stage_room_with_coll(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  stage_room(pRoom, pRoomEx, pLevel, levelId);
  uint32_t pLog  = (uint32_t)(uintptr_t)bump_alloc(0x34u);
  uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x30u);
  U32(pLog + 0x00u)  = 1u;
  U32(pLog + 0x04u)  = 1u;
  U32(pLog + 0x30u)  = pNode;
  U32(pNode + 0x00u) = 960u;
  U32(pNode + 0x04u) = 960u;
  U32(pNode + 0x08u) = 966u;
  U32(pNode + 0x0Cu) = 966u;
  U32(pNode + 0x10u) = 960u;
  U32(pNode + 0x14u) = 960u;
  U32(pNode + 0x18u) = 966u;
  U32(pNode + 0x1Cu) = 966u;
  U32(pRoomEx + 0x64u) = pLog;

  uint32_t ppNear = (uint32_t)(uintptr_t)bump_alloc(8u);
  U32(ppNear)        = pRoom;
  U32(pRoom + 0x00u) = ppNear;
  U32(pRoom + 0x24u) = 1u;
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
  return pGrid;
}

static uint32_t stage_timer_with_chunk(uint32_t pGame) {
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

static void stage_mon_reg_ex(uint32_t lvlId) {
  if (lvlId < 140u && U32(STAGE_GAME + 0xF0u + lvlId * 4u) == 0u) {
    uint32_t pReg = (uint32_t)(uintptr_t)bump_alloc(0x300u);
    U8(pReg + 0x00u) = 1u;
    U8(pReg + 0x01u) = 5u;
    U32(STAGE_GAME + 0xF0u + lvlId * 4u) = pReg;
    if (lvlId != 0u && U32(STAGE_GAME + 0xF0u) == 0u) U32(STAGE_GAME + 0xF0u) = pReg;
    U32(STAGE_GAME + 0x10DCu) = pReg;
  }
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

static void insert_server_unit(uint32_t pGame, uint32_t pUnit) {
  static const uint32_t kHashOff[6] = { 0x1120u, 0x1320u, 0x1520u, 0x1920u, 0x1720u, 0x1B20u };
  uint32_t uType = U32(pUnit + 0x00u);
  if (uType >= 6u) return;
  uint32_t guid = U32(pUnit + 0x0Cu);
  uint32_t headAddr = (uType == 5u) ? (pGame + kHashOff[uType]) : (pGame + kHashOff[uType] + ((guid & 0x7Fu) << 2));
  uint32_t prev = 0u, cur = U32(headAddr);
  while (cur != 0u && U32(cur + 0x0Cu) > guid) {
    prev = cur; cur = U32(cur + 0xE4u);
  }
  U32(pUnit + 0xE4u) = cur;
  if (prev == 0u) U32(headAddr) = pUnit;
  else            U32(prev + 0xE4u) = pUnit;
}

static void link_unit_into_room(uint32_t pRoom, uint32_t pUnit) {
  U32(pUnit + 0xE8u) = U32(pRoom + 0x74u);
  U32(pRoom + 0x74u) = pUnit;
}

static uint32_t alloc_quest_record(void) {
  uint32_t pRec = (uint32_t)(uintptr_t)bump_alloc(0x14u);
  uint32_t pBuf = (uint32_t)(uintptr_t)bump_alloc(0x60u);
  U32(pRec + 0x00u) = pBuf;
  U32(pRec + 0x04u) = 0x300u;
  return pRec;
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
  if (pPath != 0u) stage_dynamic_path(pUnit, pPath, pRoom, x, y);
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

static void stage_state_on_unit(uint32_t pUnit, int32_t stateId, int32_t statId, int32_t val, int32_t expireFrame) {
  void *pList = fn_AllocStatList(NULL, expireFrame > 0 ? 2u : 0u, (uint32_t)expireFrame,
                                 (int32_t)U32(pUnit + 0x00u), (int32_t)U32(pUnit + 0x0Cu));
  if (stateId >= 0) fn_SetStatListState(pList, stateId);
  if (statId >= 0)  fn_SetStatIfValid(pList, statId, val, 0u);
  fn_MergeStatLists((void *)(uintptr_t)pUnit, pList, 1);
  if (stateId >= 0) fn_ToggleGfxState((void *)(uintptr_t)pUnit, stateId, 1);
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

static uint32_t alloc_pet_slots(uint32_t pPlayerUnit, uint32_t nPetTypes) {
  uint32_t pUData   = U32(pPlayerUnit + 0x14u);
  uint32_t pPetCtrl = STAGE_PETCTRL;
  uint32_t pBuckets = (uint32_t)(uintptr_t)bump_alloc(nPetTypes * 12u);
  U32(pPetCtrl + 0x00u) = pBuckets;
  U32(pPetCtrl + 0x04u) = nPetTypes;
  U32(pUData + 0x44u)   = pPetCtrl;
  uint32_t pCli = U32(pUData + 0x9Cu);
  if (pCli != 0u) U32(pCli + 0x44u) = pPetCtrl;
  return pBuckets;
}

static void add_pet_slot_node(uint32_t pBuckets, uint32_t petType, uint32_t pPetUnit, uint16_t hireId) {
  uint32_t pNode    = (uint32_t)(uintptr_t)bump_alloc(0x20u);
  uint32_t slotAddr = pBuckets + petType * 12u;
  U32(pNode + 0x00u) = U32(slotAddr + 0x00u);
  U32(pNode + 0x04u) = U32(pPetUnit + 0x0Cu);
  U32(pNode + 0x08u) = U32(pPetUnit + 0x0Cu);
  U16(pNode + 0x0Cu) = hireId;
  U32(pNode + 0x10u) = (uint32_t)hireId;
  U32(slotAddr + 0x00u) = pNode;
  U32(slotAddr + 0x04u) = U32(slotAddr + 0x04u) + 1u;
}

static uint32_t build_ai_tick_param(uint32_t pMonster, uint32_t nRange) {
  uint32_t pUData   = U32(pMonster + 0x14u);
  uint32_t pAiGen   = pUData ? U32(pUData + 0x28u) : 0u;
  uint32_t pAiParam = (uint32_t)(uintptr_t)bump_alloc(0x100u);
  uint32_t pTick    = (uint32_t)(uintptr_t)bump_alloc(0x40u);
  U32(pAiParam + 0x14u) = nRange;
  /* Defaults for 0x6FCCB360: maxTargetRange (+0x5C), townStall (+0x62), maxOwnerLeash (+0x6E) */
  for (uint32_t d = 0u; d < 3u; d++) {
    U16(pAiParam + 0x5Cu + d * 2u) = 35u;
    U16(pAiParam + 0x62u + d * 2u) = 15u;
    U16(pAiParam + 0x6Eu + d * 2u) = 45u;
  }
  U32(pTick + 0x00u) = pAiGen;
  U32(pTick + 0x1Cu) = pAiParam;
  return pTick;
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
            "[k6-p16b] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }
  int asserted = (g_thunk_faulted == 2);
  if (asserted != (expectAssert != 0)) {
    fprintf(stderr,
            "[k6-p16b] ASSERT MISMATCH at %s (0x%08X) case %d (%s): expected=%d got=%d line=0x%X\n",
            fnName, canonVa, caseIdx, label, expectAssert, asserted, g_assert_line);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!asserted) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-p16b] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
              fnName, canonVa, caseIdx, label, actualPop, spec->calleePop);
      TerminateProcess(GetCurrentProcess(), 33);
    }
  }

  canonicalize_d2game_ptrs_range(STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE);
  canonicalize_d2game_ptrs_range(STAGE_CS_GAME, STAGE_CS_GAME + 0x1000u);
  if (setupTop > STAGE_SETUP_BASE) canonicalize_d2game_ptrs_range(STAGE_SETUP_BASE, setupTop);
  if (g_heap_top > HEAP_BASE) canonicalize_d2game_ptrs_range(HEAP_BASE, g_heap_top);
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
          asserted ? "true" : "false",
          asserted ? g_assert_line : 0u,
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

/* ------------------------------- Cluster 1: AI, Target Scan, Pets, Portals, Quests (8 VAs) */

static void emit_cluster1_ai_pets_quests(void) {
  X86CallSpec c;
  int64_t ts[12];
  char lbl[64];

  /* 1. 0x6FC3DD40: AI_ThinkMercenaryMain_6FC3DD40_113c (ecx=pGame, edx=pUnit, [pAiTickParam], pop=4) */
  {
    const uint32_t va = 0x6FC3DD40u;
    const char *nm = "AI_ThinkMercenaryMain_6FC3DD40_113c";
    for (int k = 0; k < 5; k++) {
      reset_case();
      uint32_t lvl = (k == 4) ? 1u : 2u;
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
      stage_timer_with_chunk(STAGE_GAME);
      uint32_t cls  = (k == 1) ? 270u : 271u;
      uint32_t mode = (k == 3) ? 2u : 1u;
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x1001u + (uint32_t)k, mode, 4810u, 4810u, 0x11223344u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
      if (k >= 2) {
        uint16_t ox = (k == 2) ? 4920u : 4812u;
        uint16_t oy = (k == 2) ? 4920u : 4812u;
        stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x1010u + (uint32_t)k, 1u, ox, oy, STAGE_CLIENT);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
        link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
        set_hireling_owner(STAGE_UNIT0, STAGE_UNIT1);
        uint32_t pBuckets = alloc_pet_slots(STAGE_UNIT1, 16u);
        add_pet_slot_node(pBuckets, 7u, STAGE_UNIT0, 1u);
      }
      if (k == 4) {
        stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x1020u, 1u, 4816u, 4812u, 0x22334455u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT2);
        link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
      }
      uint32_t pTick = build_ai_tick_param(STAGE_UNIT0, (k == 4) ? 18u : 10u);
      c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
      c.nargs = 1u; c.args[0] = pTick; c.calleePop = 4u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pTick;
      snprintf(lbl, sizeof(lbl), "merc_think_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 3u, 0x00000000u, 0);
    }
  }

  /* 2. 0x6FCCB360: D2Game_6FCCB360_113c (ecx=pGame, edx=pUnit, [pAiTickParam], pop=4) */
  {
    const uint32_t va = 0x6FCCB360u;
    const char *nm = "D2Game_6FCCB360_113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      uint32_t lvl = (k == 1) ? 1u : 2u;
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
      stage_timer_with_chunk(STAGE_GAME);
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 357u, 0x1101u + (uint32_t)k, 1u, 4810u, 4810u, 0x33445566u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
      if (k >= 1) {
        uint16_t ox = (k == 3) ? 4900u : 4812u;
        uint16_t oy = (k == 3) ? 4900u : 4812u;
        stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x1110u + (uint32_t)k, 1u, ox, oy, STAGE_CLIENT);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
        link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
        set_hireling_owner(STAGE_UNIT0, STAGE_UNIT1);
        uint32_t pBuckets = alloc_pet_slots(STAGE_UNIT1, 16u);
        add_pet_slot_node(pBuckets, 1u, STAGE_UNIT0, 1u);
      }
      if (k == 2) {
        stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x1120u, 1u, 4814u, 4810u, 0x44556677u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT2);
        link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
      }
      uint32_t pTick = build_ai_tick_param(STAGE_UNIT0, 10u);
      c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
      c.nargs = 1u; c.args[0] = pTick; c.calleePop = 4u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pTick;
      snprintf(lbl, sizeof(lbl), "summon_ai_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 3u, 0x00000000u, 0);
    }
  }

  /* 3. 0x6FCD1820: AI_FindTargetScanRoomCallback113c (eax=pMonster, [pGame, bCheckLos5, bUseMode6, ppOutTarget, pnOutDist], pop=20) */
  {
    const uint32_t va = 0x6FCD1820u;
    const char *nm = "AI_FindTargetScanRoomCallback113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      uint32_t pMonArg = (k == 0) ? 0u : STAGE_UNIT0;
      if (k >= 1) {
        stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x1201u + (uint32_t)k, 1u, 4810u, 4810u, 0x55667788u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT0);
        link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
        if (k == 1) {
          stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x1210u, 1u, 4814u, 4810u, STAGE_CLIENT);
          insert_server_unit(STAGE_GAME, STAGE_UNIT1);
          link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
          U32(STAGE_UDATA0 + 0x38u) = 1u;
          U32(STAGE_UDATA0 + 0x34u) = 0x1210u;
        } else if (k == 2) {
          stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x1220u, 12u, 4814u, 4810u, 0x66778899u);
          insert_server_unit(STAGE_GAME, STAGE_UNIT1);
          U32(STAGE_UDATA0 + 0x38u) = 2u;
          U32(STAGE_UDATA0 + 0x34u) = 0x1220u;
        } else {
          stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x1230u, 1u, 4813u, 4812u, STAGE_CLIENT);
          insert_server_unit(STAGE_GAME, STAGE_UNIT1);
          link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
          stage_state_on_unit(STAGE_UNIT0, 0x69, 0xAC, 1, 0);
          U32(STAGE_UDATA0 + 0x38u) = 3u;
          U32(STAGE_UDATA0 + 0x34u) = 0u;
        }
      }
      uint32_t ppTgt = STAGE_SCRATCH + 0x00u;
      uint32_t pnDst = STAGE_SCRATCH + 0x04u;
      U32(ppTgt) = 0xDEADBEEFu;
      U32(pnDst) = 0xDEADBEEFu;
      c = make_call(); c.eax = pMonArg; c.nargs = 5u;
      c.args[0] = STAGE_GAME; c.args[1] = 1u; c.args[2] = (k == 3) ? 1u : 0u;
      c.args[3] = ppTgt; c.args[4] = pnDst; c.calleePop = 20u;
      ts[0] = pMonArg; ts[1] = STAGE_GAME; ts[2] = 1; ts[3] = (k == 3) ? 1 : 0;
      ts[4] = ppTgt; ts[5] = pnDst;
      snprintf(lbl, sizeof(lbl), "find_tgt_cb_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
    }
  }

  /* 4. 0x6FCD1C90: AI_FindNearestPlayerOrAlly113c (eax=pGame, [pMonster, pAiGen, pnOutDist, pbOutInMelee], pop=16) */
  {
    const uint32_t va = 0x6FCD1C90u;
    const char *nm = "AI_FindNearestPlayerOrAlly113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      uint32_t pMonArg = (k == 0) ? 0u : STAGE_UNIT0;
      uint32_t pAiGen  = 0u;
      if (k >= 1) {
        stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x1301u + (uint32_t)k, 1u, 4810u, 4810u, 0x778899AAu);
        insert_server_unit(STAGE_GAME, STAGE_UNIT0);
        link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
        pAiGen = U32(STAGE_UDATA0 + 0x28u);
        stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x1310u + (uint32_t)k, 1u, 4812u, 4811u, STAGE_CLIENT);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
        link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
        if (k == 1) {
          U32(STAGE_UDATA0 + 0x38u) = 1u;
          U32(STAGE_UDATA0 + 0x34u) = 0x1311u;
        } else if (k == 2) {
          stage_state_on_unit(STAGE_UNIT0, 0x69, 0xAC, 1, 0);
        } else {
          uint32_t pPlrNode = (uint32_t)(uintptr_t)bump_alloc(0x10u);
          U32(pPlrNode + 0x00u) = STAGE_UNIT1;
          U32(STAGE_GAME + 0x10F8u) = pPlrNode;
        }
      }
      uint32_t pnDst = STAGE_SCRATCH + 0x00u;
      uint32_t pbMel = STAGE_SCRATCH + 0x04u;
      U32(pnDst) = 0xDEADBEEFu;
      U32(pbMel) = 0xDEADBEEFu;
      c = make_call(); c.eax = STAGE_GAME; c.nargs = 4u;
      c.args[0] = pMonArg; c.args[1] = pAiGen; c.args[2] = pnDst; c.args[3] = pbMel; c.calleePop = 16u;
      ts[0] = STAGE_GAME; ts[1] = pMonArg; ts[2] = pAiGen; ts[3] = pnDst; ts[4] = pbMel; ts[5] = 1;
      snprintf(lbl, sizeof(lbl), "find_nearest_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 6u, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
    }
  }

  /* 5. 0x6FCB7F50: PETS_RegisterSummonPetAndClampCount_6FCB7F50_113c (eax=nPetType, [pGame, pPlayerUnit, pPetUnit, nMaxPets], pop=16) */
  {
    const uint32_t va = 0x6FCB7F50u;
    const char *nm = "PETS_RegisterSummonPetAndClampCount_6FCB7F50_113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_timer_with_chunk(STAGE_GAME);
      stage_mon_reg_ex(2u);
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x1401u + (uint32_t)k, 1u, 4810u, 4810u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 357u, 0x1410u + (uint32_t)k, 1u, 4812u, 4812u, 0x12121212u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      if (k == 1 || k == 2) {
        uint32_t pBuckets = alloc_pet_slots(STAGE_UNIT0, 16u);
        if (k == 2) {
          stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 357u, 0x1420u, 1u, 4813u, 4813u, 0x23232323u);
          insert_server_unit(STAGE_GAME, STAGE_UNIT2);
          link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
          add_pet_slot_node(pBuckets, 1u, STAGE_UNIT2, 357u);
        }
      }
      uint32_t petType = (k == 0) ? 0u : 1u;
      uint32_t maxPets = (k == 2) ? 1u : 3u;
      c = make_call(); c.eax = petType; c.nargs = 4u;
      c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.args[3] = maxPets;
      c.calleePop = 16u;
      ts[0] = petType; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME; ts[3] = STAGE_UNIT1; ts[4] = maxPets;
      snprintf(lbl, sizeof(lbl), "pets_reg_clamp_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 5u, 0x00000000u, 0);
    }
  }

  /* 6. 0x6FCBD5B0: ACT_FreeAllActRoomPortalLists113c (eax=pGame, pop=0) */
  {
    const uint32_t va = 0x6FCBD5B0u;
    const char *nm = "ACT_FreeAllActRoomPortalLists113c";
    for (int k = 0; k < 3; k++) {
      reset_case();
      if (k >= 1) {
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
        U32(STAGE_ACT0 + 0x58u) = (k == 2) ? 1u : 0u;
        uint32_t pNode0 = (uint32_t)(uintptr_t)bump_alloc(0x10u);
        U32(pNode0 + 0x00u) = 0x11u;
        U32(pNode0 + 0x04u) = 0x22u;
        U32(pNode0 + 0x08u) = 0u;
        U32(STAGE_ROOM0 + 0x18u) = pNode0;
      }
      c = make_call(); c.eax = STAGE_GAME;
      ts[0] = STAGE_GAME;
      snprintf(lbl, sizeof(lbl), "act_free_portals_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 1u, 0x00000000u, 0);
    }
  }

  /* 7. 0x6FC561E0: QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c ([pGame, nX, nY, pRoom, bSetFlag, nMonsterId], pop=24) */
  {
    const uint32_t va = 0x6FC561E0u;
    const char *nm = "QUESTS_SpawnQuestMonsterWithRetryRings_6FC561E0_113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_timer_with_chunk(STAGE_GAME);
      stage_mon_reg_ex(2u);
      uint32_t monId = (k == 0) ? 0xFFFFFFFFu : 1u;
      uint32_t x = (k == 2) ? 4792u : (k == 3) ? 4750u : 4812u;
      uint32_t y = 4812u;
      uint32_t bFlg = (k >= 2) ? 1u : 0u;
      c = make_call(); c.nargs = 6u;
      c.args[0] = STAGE_GAME; c.args[1] = x; c.args[2] = y;
      c.args[3] = STAGE_ROOM0; c.args[4] = bFlg; c.args[5] = monId;
      c.calleePop = 24u;
      ts[0] = STAGE_GAME; ts[1] = x; ts[2] = y;
      ts[3] = STAGE_ROOM0; ts[4] = bFlg; ts[5] = (int32_t)monId;
      snprintf(lbl, sizeof(lbl), "quest_spawn_rings_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
    }
  }

  /* 8. 0x6FC66F70: MONSTER_SpawnPresetOrEvilUrn113c (edi=nClassId, [pGame, pRoom, nX, nY, nMode], pop=20) */
  {
    const uint32_t va = 0x6FC66F70u;
    const char *nm = "MONSTER_SpawnPresetOrEvilUrn113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_timer_with_chunk(STAGE_GAME);
      stage_mon_reg_ex(2u);
      stage_quest_node(STAGE_QUEST0, 0x20u, STAGE_QUESTEX0, 0u);
      if (k == 3) U32(STAGE_QUEST0 + 0xE8u) = 0u;
      uint32_t cid = (k == 0) ? 0xFFFFFFFFu : (k >= 2) ? 0x1B2u : 1u;
      if (k == 2) U8(STAGE_QUEST0 + 0x08u) = 0u;
      if (k == 3) {
        uint32_t pBuf = U32(U32(STAGE_QUESTCTRL + 0x0Cu));
        U32(pBuf) = 0xFFFFFFFFu;
      }
      c = make_call(); c.edi = cid; c.nargs = 5u;
      c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = 4814u; c.args[3] = 4815u; c.args[4] = 1u;
      c.calleePop = 20u;
      ts[0] = (int32_t)cid; ts[1] = STAGE_GAME; ts[2] = STAGE_ROOM0;
      ts[3] = 4814; ts[4] = 4815; ts[5] = 1;
      snprintf(lbl, sizeof(lbl), "preset_evil_urn_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
    }
  }
}

/* ------------------------------- Cluster 2: Boss / Unique / Minion Pack Spawning (7 VAs) */

static void emit_cluster2_boss_packs(void) {
  X86CallSpec c;
  int64_t ts[12];
  char lbl[64];

  /* 9. 0x6FC44950: MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c (eax=bSafe, ecx=nMonHcIdx, edx=pCoordNode, [pGame, pRoom, nX, nY, dwArg14], pop=20) */
  {
    const uint32_t va = 0x6FC44950u;
    const char *nm = "MONUMOD_SpawnMinionOrUniqueMonster_6FC44950_113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_timer_with_chunk(STAGE_GAME);
      stage_mon_reg_ex(2u);
      uint32_t hcIdx  = (k == 0) ? 0xFFFFFFFFu : 1u;
      uint32_t pCoord = (k == 1) ? STAGE_SCRATCH : 0u;
      if (pCoord != 0u) {
        U32(pCoord + 0x00u) = 4812u;
        U32(pCoord + 0x04u) = 4812u;
      }
      uint32_t x = (k == 2) ? 0u : (k == 3) ? 9999u : 4812u;
      uint32_t y = (k == 2) ? 0u : (k == 3) ? 9999u : 4812u;
      uint32_t bSafe = (k == 2) ? 1u : 0u;
      c = make_call(); c.eax = bSafe; c.ecx = hcIdx; c.edx = pCoord; c.nargs = 5u;
      c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = x; c.args[3] = y; c.args[4] = 0xFFFFFFFFu;
      c.calleePop = 20u;
      ts[0] = (int32_t)hcIdx; ts[1] = pCoord; ts[2] = bSafe;
      ts[3] = STAGE_GAME; ts[4] = STAGE_ROOM0; ts[5] = x; ts[6] = y; ts[7] = -1;
      snprintf(lbl, sizeof(lbl), "spawn_minion_or_uniq_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 8u, 0xFFFFFFFFu, 0);
    }
  }

  /* 10. 0x6FC445A0: MONUMOD_SpawnBossMinionPack_6FC445A0_113c (eax=nMinCount, ebx=pBoss, [pGame, pCoordNode, nMaxCount], pop=12) */
  {
    const uint32_t va = 0x6FC445A0u;
    const char *nm = "MONUMOD_SpawnBossMinionPack_6FC445A0_113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_timer_with_chunk(STAGE_GAME);
      stage_mon_reg_ex(2u);
      uint32_t pBoss = (k == 0) ? 0u : STAGE_UNIT0;
      if (pBoss != 0u) {
        stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x2001u + (uint32_t)k, 1u, 4812u, 4812u, 0x31415927u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT0);
        link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
        U8(STAGE_UDATA0 + 0x16u) = 0x10u; /* boss bit without minion bit 4 */
        U8(STAGE_UDATA0 + 0x1Cu) = 5u;
      }
      uint32_t pCoord = (k == 2) ? STAGE_SCRATCH : 0u;
      if (pCoord != 0u) {
        U32(pCoord + 0x00u) = 4814u;
        U32(pCoord + 0x04u) = 4814u;
      }
      uint32_t minC = (k == 1) ? 2u : (k == 2) ? 1u : 0u;
      uint32_t maxC = (k == 1) ? 4u : (k == 2) ? 2u : 0u;
      c = make_call(); c.eax = minC; c.ebx = pBoss; c.nargs = 3u;
      c.args[0] = STAGE_GAME; c.args[1] = pCoord; c.args[2] = maxC; c.calleePop = 12u;
      ts[0] = STAGE_GAME; ts[1] = pCoord; ts[2] = pBoss; ts[3] = minC; ts[4] = maxC;
      snprintf(lbl, sizeof(lbl), "spawn_minion_pack_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 5u, 0x00000000u, 0);
    }
  }

  /* 11. 0x6FC446D0: MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c (eax=nClassId, ecx=pRoom, [pGame, nX, nY, dwAiArg, pUModBytes], pop=20) */
  {
    const uint32_t va = 0x6FC446D0u;
    const char *nm = "MONUMOD_SpawnSuperUniqueOrBoss_6FC446D0_113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_timer_with_chunk(STAGE_GAME);
      stage_mon_reg_ex(2u);
      uint32_t cid = (k == 0) ? 0xFFFFFFFFu : 1u;
      uint32_t x   = (k == 2) ? 0u : (k == 3) ? 9999u : 4812u;
      uint32_t y   = (k == 2) ? 0u : (k == 3) ? 9999u : 4812u;
      uint32_t aiA = (k == 3) ? 0u : 0xFFFFFFFFu;
      if (k == 1) {
        static const uint8_t u1[9] = { 5u, 9u, 17u, 26u, 30u, 0u, 0u, 0u, 0u };
        memcpy((void *)(uintptr_t)STAGE_SCRATCH, u1, 9);
      } else if (k == 2) {
        static const uint8_t u2[9] = { 18u, 23u, 25u, 27u, 36u, 37u, 38u, 0u, 0u };
        memcpy((void *)(uintptr_t)STAGE_SCRATCH, u2, 9);
      } else {
        static const uint8_t u3[9] = { 7u, 28u, 39u, 0u, 0u, 0u, 0u, 0u, 0u };
        memcpy((void *)(uintptr_t)STAGE_SCRATCH, u3, 9);
      }
      c = make_call(); c.eax = cid; c.ecx = STAGE_ROOM0; c.nargs = 5u;
      c.args[0] = STAGE_GAME; c.args[1] = x; c.args[2] = y; c.args[3] = aiA; c.args[4] = STAGE_SCRATCH;
      c.calleePop = 20u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = x; ts[3] = y;
      ts[4] = (int32_t)cid; ts[5] = STAGE_SCRATCH; ts[6] = (int32_t)aiA;
      snprintf(lbl, sizeof(lbl), "spawn_su_or_boss_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
    }
  }

  /* 12. 0x6FC44C70: MONUMOD_SpawnUniqueOrChampionBossPack_6FC44C70_113c (eax=nY, ecx=nX, esi=pGame, ebx=pCoordNode, [pRoom, nMonHcIdx, bIsChamp, bSafe], pop=16) */
  {
    const uint32_t va = 0x6FC44C70u;
    const char *nm = "MONUMOD_SpawnUniqueOrChampionBossPack_6FC44C70_113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_timer_with_chunk(STAGE_GAME);
      stage_mon_reg_ex(2u);
      uint32_t hcIdx  = (k == 0) ? 0xFFFFFFFFu : 1u;
      uint32_t pCoord = (k >= 2) ? STAGE_SCRATCH : 0u;
      if (pCoord != 0u) {
        U32(pCoord + 0x00u) = 4815u;
        U32(pCoord + 0x04u) = 4815u;
      }
      uint32_t x = (k == 3) ? 4816u : 4812u;
      uint32_t y = (k == 3) ? 4816u : 4812u;
      uint32_t bChamp = (k >= 2) ? 1u : 0u;
      uint32_t bSafe  = (k == 3) ? 1u : 0u;
      c = make_call(); c.eax = y; c.ecx = x; c.esi = STAGE_GAME; c.ebx = pCoord; c.nargs = 4u;
      c.args[0] = STAGE_ROOM0; c.args[1] = hcIdx; c.args[2] = bChamp; c.args[3] = bSafe;
      c.calleePop = 16u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = pCoord;
      ts[3] = x; ts[4] = y; ts[5] = bSafe; ts[6] = bChamp; ts[7] = (int32_t)hcIdx;
      snprintf(lbl, sizeof(lbl), "spawn_uniq_champ_pack_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 8u, 0xFFFFFFFFu, 0);
    }
  }

  /* 13. 0x6FC44E70: MONUMOD_SpawnPresetUniqueOrSuperUnique_6FC44E70_113c (eax=steps, edx=nX, ecx=nY, [pGame, pRoom, hcIdx, nameId, flag04, isSu, suId, pMods], pop=32) */
  {
    const uint32_t va = 0x6FC44E70u;
    const char *nm = "MONUMOD_SpawnPresetUniqueOrSuperUnique_6FC44E70_113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_timer_with_chunk(STAGE_GAME);
      stage_mon_reg_ex(2u);
      if (k == 2) stage_quest_node(STAGE_QUEST0, 5u, STAGE_QUESTEX0, 0u);
      if (k == 3) stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
      uint32_t hcIdx  = (k == 0) ? 0xFFFFFFFFu : 1u;
      uint32_t flag04 = (k == 1) ? 1u : 0u;
      uint32_t isSu   = (k >= 2) ? 1u : 0u;
      uint32_t suId   = (k == 2) ? 6u : (k == 3) ? 26u : 0u;
      static const uint8_t kMods[9] = { 5u, 30u, 9u, 0u, 0u, 0u, 0u, 0u, 0u };
      memcpy((void *)(uintptr_t)STAGE_SCRATCH, kMods, 9);
      c = make_call(); c.eax = 4u; c.edx = 4812u + (uint32_t)k; c.ecx = 4812u + (uint32_t)k; c.nargs = 8u;
      c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = hcIdx;
      c.args[3] = 0x100u + (uint32_t)k; c.args[4] = flag04; c.args[5] = isSu;
      c.args[6] = suId; c.args[7] = STAGE_SCRATCH;
      c.calleePop = 32u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = (int32_t)hcIdx;
      ts[3] = 4812 + k; ts[4] = 4812 + k; ts[5] = 4;
      ts[6] = 0x100 + k; ts[7] = flag04; ts[8] = isSu; ts[9] = suId; ts[10] = STAGE_SCRATCH;
      snprintf(lbl, sizeof(lbl), "spawn_preset_su_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 11u, 0xFFFFFFFFu, 0);
    }
  }

  /* 14. 0x6FC451F0: MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0_113c ([pGame, pRoom, nX, nY, nSuId], pop=20) */
  {
    const uint32_t va = 0x6FC451F0u;
    const char *nm = "MONUMOD_SpawnSuperUniqueMonsterPack_6FC451F0_113c";
    for (int k = 0; k < 4; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_timer_with_chunk(STAGE_GAME);
      stage_mon_reg_ex(2u);
      if (k == 0) U8(STAGE_GAME + 0x6Du) = 3u;
      else if (k >= 2) U8(STAGE_GAME + 0x6Du) = 1u;
      if (k == 2) U8(STAGE_GAME + 0x1D30u) = 1u;
      uint32_t suId = (k == 3) ? 1u : 0u;
      c = make_call(); c.nargs = 5u;
      c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = 4812u; c.args[3] = 4812u; c.args[4] = suId;
      c.calleePop = 20u;
      ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = 4812; ts[3] = 4812; ts[4] = suId;
      snprintf(lbl, sizeof(lbl), "spawn_su_pack_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
    }
  }

  /* 15. 0x6FC679B0: MONSTER_SpawnUniqueBossWithChampionMinionPack_6FC679B0_113c (eax=pCoordNode, ecx=pRoom, [pGame, nMonHcIdx], pop=8) */
  {
    const uint32_t va = 0x6FC679B0u;
    const char *nm = "MONSTER_SpawnUniqueBossWithChampionMinionPack_6FC679B0_113c";
    for (int k = 0; k < 3; k++) {
      reset_case();
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_timer_with_chunk(STAGE_GAME);
      stage_mon_reg_ex(2u);
      uint32_t hcIdx  = (k == 0) ? 0xFFFFFFFFu : 1u;
      uint32_t pCoord = (k == 2) ? STAGE_SCRATCH : 0u;
      if (pCoord != 0u) {
        U32(pCoord + 0x00u) = 4814u;
        U32(pCoord + 0x04u) = 4814u;
      }
      c = make_call(); c.eax = pCoord; c.ecx = STAGE_ROOM0; c.nargs = 2u;
      c.args[0] = STAGE_GAME; c.args[1] = hcIdx; c.calleePop = 8u;
      ts[0] = pCoord; ts[1] = STAGE_ROOM0; ts[2] = STAGE_GAME; ts[3] = (int32_t)hcIdx;
      snprintf(lbl, sizeof(lbl), "spawn_uboss_champ_pack_k%d", k);
      run_and_emit(va, nm, k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
    }
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
  void *pVtbl  = VirtualAlloc((void *)HASH_VTABLE_ADDR, 0x4000u,          MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE,       STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE,        HEAP_SIZE,        MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pVtbl != HASH_VTABLE_ADDR ||
      (uintptr_t)pStage != STAGE_BASE   || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-p16b] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
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
    fprintf(stderr, "[k6-p16b] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p16b] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
  fn_GetHirelingTxt     = (Com_GetHirelingTxt_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11156));

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_PlaceItemInBodyLoc ||
      !fn_PathSetTargetUnit || !fn_GetHirelingTxt) {
    fprintf(stderr, "[k6-p16b] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();
  (void)g_item_sword;
  (void)g_item_jav;
  (void)g_item_armor;
  (void)g_item_shield;
  (void)g_merc_subtype;
  (void)fn_AllocSkillList;
  (void)fn_SetSkillLevel;
  (void)fn_AllocInventory;
  (void)fn_PlaceItemInBodyLoc;
  (void)fn_PathSetTargetUnit;

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p16b] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_cluster1_ai_pets_quests();
  emit_cluster2_boss_packs();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p16b] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
