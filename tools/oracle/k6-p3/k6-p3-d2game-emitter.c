/*
 * k6-p3-d2game-emitter.c — [K6-P3] Real-DLL D2Game Hi-VA Vector Emitter (150 VAs)
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables + D2Common .data/.bss from
 * d2game-datatbls-113c.img, hooks external OS/Fog/Storm/D2Net runtime boundaries,
 * and executes 150 net-new D2Game.dll Hi-VAs (0x6FCC0000..0x6FD142D0) with >= 3
 * non-degenerate vectors per VA (>= 450 total vectors).
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
#define STAGE_CLIENT      (STAGE_BASE + 0x2000u) /* 0x0500: D2ClientStrc #0 */
#define STAGE_CLIENT1     (STAGE_BASE + 0x2500u) /* 0x0500: D2ClientStrc #1 */
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
#define STAGE_PKTNODE0    (STAGE_BASE + 0x6800u) /* 0x0210: D2PacketDataStrc #0 */
#define STAGE_PKTNODE1    (STAGE_BASE + 0x6A10u) /* 0x0210: D2PacketDataStrc #1 */
#define STAGE_PKTNODE2    (STAGE_BASE + 0x6C20u) /* 0x0210: D2PacketDataStrc #2 */
#define STAGE_PKTNODE3    (STAGE_BASE + 0x6E30u) /* 0x0210: D2PacketDataStrc #3 */
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
typedef void  (__stdcall *Com_SetCursorItem_t)(void *pInv, void *pItem);
typedef void  (__stdcall *Com_PathSetTargetUnit_t)(void *pPath, void *pTarget);
typedef void   (__stdcall *Com_SetSkillCharges_t)(void *pSkill, int32_t nCharges);
typedef int32_t(__stdcall *Com_AutoPlaceIntoBeltSlot_t)(void *pInv, void *pItem, int32_t nBeltSlot);
typedef void   (__stdcall *Com_SetOrClearCmdFlags_t)(void *pItem, uint32_t dwFlag, int32_t bSet);

static Com_CreateStatListEx_t      fn_CreateStatListEx      = NULL;
static Com_SetUnitStat_t           fn_SetUnitStat           = NULL;
static Com_AllocStatList_t         fn_AllocStatList         = NULL;
static Com_SetStatIfValid_t        fn_SetStatIfValid        = NULL;
static Com_SetStatListState_t      fn_SetStatListState      = NULL;
static Com_MergeStatLists_t        fn_MergeStatLists        = NULL;
static Com_ToggleGfxState_t        fn_ToggleGfxState        = NULL;
static Com_AllocSkillList_t        fn_AllocSkillList        = NULL;
static Com_SetSkillLevel_t         fn_SetSkillLevel         = NULL;
static Com_AllocInventory_t        fn_AllocInventory        = NULL;
static Com_PlaceItemInBodyLoc_t    fn_PlaceItemInBodyLoc    = NULL;
static Com_SetCursorItem_t         fn_SetCursorItem         = NULL;
static Com_PathSetTargetUnit_t     fn_PathSetTargetUnit     = NULL;
static Com_SetSkillCharges_t       fn_SetSkillCharges       = NULL;
static Com_AutoPlaceIntoBeltSlot_t fn_AutoPlaceIntoBeltSlot = NULL;
static Com_SetOrClearCmdFlags_t    fn_SetOrClearCmdFlags    = NULL;

static uint32_t g_item_sword   = 0;
static uint32_t g_item_bow     = 0;
static uint32_t g_item_arrows  = 0;
static uint32_t g_item_ring    = 0;
static uint32_t g_item_armor   = 0;
static uint32_t g_item_gold    = 0;
static uint32_t g_item_hp1     = 0;
static uint32_t g_item_tsc     = 0;
static uint32_t g_item_tbk     = 0;
static uint32_t g_item_isc     = 0;
static uint32_t g_item_bbb     = 0;
static uint32_t g_item_g33     = 0;
static uint32_t g_item_subtype = 0;

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
    fprintf(stderr, "[k6-p3] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
      fprintf(stderr, "[k6-p3] missing Fog.#%u\n", fogHooks[i].ord);
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

/* ------------------------------- PAGEIMG Loader & Stage Serializer */

static void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-p3] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p3] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_PREF_BASE + 0x99000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p3] short read at page %u\n", i);
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
        fprintf(stderr, "[k6-p3] stage json overflow\n");
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

  U32(game_global_live(D2GAME_PREF_BASE + 0x111F90u)) = 0u;
  U8(game_global_live(D2GAME_PREF_BASE + 0x111F98u))  = 0u;
  U32(game_global_live(D2GAME_PREF_BASE + 0x111C08u)) = 0u;

  U8(STAGE_GAME + 0x6Du)  = 0u;
  U32(STAGE_GAME + 0x70u) = 1u;
  U16(STAGE_GAME + 0x78u) = 100u;
  U32(STAGE_GAME + 0xA8u) = 100u;
  U32(STAGE_GAME + 0xD0u) = 0x13579BDFu;
  U32(STAGE_GAME + 0xD4u) = 0x0000029Au;

  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_PKTNODE1 + 0x204u) = STAGE_PKTNODE2;
  U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
  U32(STAGE_CLIENT + 0x1A8u)   = STAGE_GAME;
  U32(STAGE_CLIENT + 0x1ACu)   = STAGE_GAME;
  U32(STAGE_CLIENT1 + 0x1C0u)  = STAGE_PKTNODE3;
  U32(STAGE_CLIENT1 + 0x1A8u)  = STAGE_GAME;
  U32(STAGE_CLIENT1 + 0x1ACu)  = STAGE_GAME;
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
  uint32_t chk = U32(headAddr);
  while (chk != 0u) {
    if (chk == pUnit) return;
    chk = U32(chk + 0xE4u);
  }
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

static void link_player_client(
    uint32_t pPlayer, uint32_t pUData, uint32_t pClient, uint32_t clientId, uint32_t nextClient) {
  U32(pUData + 0x9Cu)   = pClient;
  U32(pClient + 0x00u)  = clientId;
  U32(pClient + 0x04u)  = 4u;
  U32(pClient + 0x16Cu) = U32(pPlayer + 0x00u);
  U32(pClient + 0x170u) = U32(pPlayer + 0x0Cu);
  U32(pClient + 0x174u) = pPlayer;
  U32(pClient + 0x1A8u) = STAGE_GAME;
  U32(pClient + 0x1ACu) = STAGE_GAME;
  U32(pClient + 0x4A8u) = nextClient;
  insert_server_unit(STAGE_GAME, pPlayer);
}

static void attach_quest_bits(uint32_t pUData, uint8_t diff, uint32_t pRecBase) {
  uint32_t pBits = pRecBase + 0x10u;
  U32(pRecBase + 0x00u) = pBits;
  U32(pRecBase + 0x04u) = 0x60u;
  U32(pUData + 0x10u + (uint32_t)diff * 4u) = pRecBase;
}

static void set_quest_bit(uint32_t pRecBase, uint32_t nQuest, uint32_t nBit) {
  uint32_t pBuf = U32(pRecBase);
  uint32_t bitIdx = (nQuest << 4) + nBit;
  U8(pBuf + (bitIdx >> 3)) |= (uint8_t)(1u << (bitIdx & 7u));
}

static void stage_quest_node(uint32_t pQuest, uint32_t qId, uint32_t pQuestEx, uint32_t pPrev) {
  uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(0x200u);
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
  U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
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
    U32(pUData + 0x14u) = 0x00000010u;
    U32(pUData + 0x2Cu) = 12u;
    U16(pUData + 0x30u) = 100u;
    U8(pUData + 0x45u)  = 0xFFu;
  }
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
            "[k6-p3] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-p3] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-p3] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-p3] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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
  /* D2Game:0x6FCAD570 (NET_SendPacket22) allocates 12B on the stack and leaves
     bytes [2] and [10] uninitialized (matching normalizeS2c22UninitPad113c). */
  {
    static const uint32_t kPktNodes[4] = {
      STAGE_PKTNODE0, STAGE_PKTNODE1, STAGE_PKTNODE2, STAGE_PKTNODE3
    };
    for (int pi = 0; pi < 4; pi++) {
      uint32_t node = kPktNodes[pi];
      uint32_t nLen = U32(node + 0x00u);
      if (nLen > 0u && nLen <= 0x200u && (nLen % 12u) == 0u) {
        int all22 = 1;
        for (uint32_t off = 0u; off < nLen; off += 12u) {
          if (U8(node + 0x04u + off) != 0x22u) { all22 = 0; break; }
        }
        if (all22) {
          for (uint32_t off = 0u; off < nLen; off += 12u) {
            U8(node + 0x04u + off + 2u)  = 0u;
            U8(node + 0x04u + off + 10u) = 0u;
          }
        }
      }
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
    uint8_t  subT = U8(pItems + id * 0x1A8u + 0x137u);
    if (!g_item_sword   && code == 0x20647373u) g_item_sword   = id; /* 'ssd ' */
    if (!g_item_bow     && code == 0x20776273u) g_item_bow     = id; /* 'sbw ' */
    if (!g_item_arrows  && code == 0x20767161u) g_item_arrows  = id; /* 'aqv ' */
    if (!g_item_ring    && code == 0x206E6972u) g_item_ring    = id; /* 'rin ' */
    if (!g_item_armor   && code == 0x20697571u) g_item_armor   = id; /* 'qui ' */
    if (!g_item_gold    && code == 0x20646C67u) g_item_gold    = id; /* 'gld ' */
    if (!g_item_hp1     && code == 0x20317068u) g_item_hp1     = id; /* 'hp1 ' */
    if (!g_item_tsc     && code == 0x20637374u) g_item_tsc     = id; /* 'tsc ' */
    if (!g_item_tbk     && code == 0x206B6274u) g_item_tbk     = id; /* 'tbk ' */
    if (!g_item_isc     && code == 0x20637369u) g_item_isc     = id; /* 'isc ' */
    if (!g_item_bbb     && code == 0x20626262u) g_item_bbb     = id; /* 'bbb ' */
    if (!g_item_g33     && code == 0x20333367u) g_item_g33     = id; /* 'g33 ' */
    if (!g_item_subtype && subT != 0u)          g_item_subtype = id;
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

/* Extra D2Common inventory helper pointers (resolved in main) */
typedef int32_t(__stdcall *Com_AutoPlaceInBelt_t)(void *pInv, void *pItem);
typedef int32_t(__stdcall *Com_PlaceInGridCell_t)(
    void *pInv, void *pItem, int32_t nX, int32_t nY, int32_t nInvRecId, int32_t u0, int32_t nPage);
typedef void(__stdcall *Com_AppendItemGuidNode_t)(void *pInv, void *pItem);

static Com_AutoPlaceInBelt_t    fn_AutoPlaceInBelt    = NULL;
static Com_PlaceInGridCell_t    fn_PlaceInGridCell    = NULL;
static Com_AppendItemGuidNode_t fn_AppendItemGuidNode = NULL;

/* ------------------------------- Group 1: VAs [001]..[025] */

static void emit_group_1(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[64];

  /* [001] 0x6FD0B070 PARTY_SendRosterUpdateCallback_6FD0B070_113c (edx=pRecipient, s0=pTarget, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 101u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    uint32_t pTarget = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u + (uint32_t)k, 1u, 5004u, 5004u, 102u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, k == 1 ? 7 : 33, 0);
      pTarget = STAGE_UNIT1;
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = pTarget; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pTarget;
    snprintf(lbl, sizeof(lbl), "party_roster_cb_k%d", k);
    run_and_emit(0x6FD0B070u, "PARTY_SendRosterUpdateCallback_6FD0B070_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [002] 0x6FCCF5F0 MONSTER_GetPlayerCountExpBonusPct113c (eax=nPlayers, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_PREF_BASE + 0xFB5F0u, 0x48u);
    int32_t n = (k == 0) ? 1 : (k == 1 ? 4 : 10);
    c = make_call(); c.eax = (uint32_t)n;
    ts[0] = n;
    snprintf(lbl, sizeof(lbl), "mon_exp_bonus_k%d", k);
    run_and_emit(0x6FCCF5F0u, "MONSTER_GetPlayerCountExpBonusPct113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [003] 0x6FCCF5D0 MONSTER_GetPlayerCountHpBonusPct113c (eax=nPlayers, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_PREF_BASE + 0xFB5F0u, 0x48u);
    int32_t n = (k == 0) ? 1 : (k == 1 ? 5 : 11);
    c = make_call(); c.eax = (uint32_t)n;
    ts[0] = n;
    snprintf(lbl, sizeof(lbl), "mon_hp_bonus_k%d", k);
    run_and_emit(0x6FCCF5D0u, "MONSTER_GetPlayerCountHpBonusPct113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [004] 0x6FCFF9A0 SUNIT_IsUnitInActiveClientRoom113c (eax=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, k == 0 ? 0u : STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 11u, 1u, 5000u, 5000u, 104u);
    U32(STAGE_ROOM0 + 0x78u) = (k == 2) ? 2u : 0u;
    c = make_call(); c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "sunit_active_room_k%d", k);
    run_and_emit(0x6FCFF9A0u, "SUNIT_IsUnitInActiveClientRoom113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [005] 0x6FCCF710 MONSTER_SetLastHitModeField54_113c (eax=pUnit, s0=dwValue, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pU = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, k == 1 ? 0u : 1u, 1u, 12u, 1u, 5000u, 5000u, 105u);
      pU = STAGE_UNIT0;
    }
    uint32_t val = (k == 2) ? 0x13u : 7u;
    c = make_call(); c.eax = pU; c.nargs = 1; c.args[0] = val; c.calleePop = 4u;
    ts[0] = pU; ts[1] = val;
    snprintf(lbl, sizeof(lbl), "mon_set_f54_k%d", k);
    run_and_emit(0x6FCCF710u, "MONSTER_SetLastHitModeField54_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [006] 0x6FCEBD30 PACKET_Srv40_RequestQuestLog_6FCEBD30_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 13u, 1u, 5000u, 5000u, 106u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 1u, 0u);
    U8(STAGE_SCRATCH) = 0x40u;
    uint32_t nLen = (k == 0) ? 2u : 1u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt40_quest_log_k%d", k);
    run_and_emit(0x6FCEBD30u, "PACKET_Srv40_RequestQuestLog_6FCEBD30_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [007] 0x6FCF4550 UNITROOM_BroadcastGroundItemIfUpdated113c (eax=pItem, ebx=pClient, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 14u, 1u, 5000u, 5000u, 107u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    uint32_t pItm = 0u;
    if (k >= 1) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 50u + (uint32_t)k, 3u, 2u, 5002u, 5002u, 207u);
      U32(STAGE_UNIT1 + 0xC4u) = (k == 1) ? 0x04u : 0x05u;
      pItm = STAGE_UNIT1;
    }
    c = make_call(); c.eax = pItm; c.ebx = STAGE_CLIENT;
    ts[0] = pItm; ts[1] = STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "unitroom_bcast_item_k%d", k);
    run_and_emit(0x6FCF4550u, "UNITROOM_BroadcastGroundItemIfUpdated113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [008] 0x6FCD8B50 ACT4Prologue_ActiveFilter_6FCD8B50_113c (ecx=pQuest, edx=nNpc, s0=pPlr, s1=pFlags, s2=pNpc, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 0x18u, 0u);
    uint32_t npcId = (k == 0) ? 100u : 0x16Fu;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a4prol_filter_k%d", k);
    run_and_emit(0x6FCD8B50u, "ACT4Prologue_ActiveFilter_6FCD8B50_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [009] 0x6FCE2590 ACT2Q0_ActiveFilter_6FCE2590_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 8u, 0u);
    uint32_t npcId = (k == 0) ? 100u : 0xC9u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a2q0_filter_k%d", k);
    run_and_emit(0x6FCE2590u, "ACT2Q0_ActiveFilter_6FCE2590_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [010] 0x6FD03000 ACT3Q1_HratliIntroActiveFilter113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 0x10u, 0u);
    uint32_t npcId = (k == 0) ? 100u : 0xFDu;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a3q1_hratli_filter_k%d", k);
    run_and_emit(0x6FD03000u, "ACT3Q1_HratliIntroActiveFilter113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [011] 0x6FCFF6C0 SUNIT_GetUnitField78_113c (eax=pUnit, ret 0, al) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 15u, 1u, 5000u, 5000u, 111u);
    U8(STAGE_UNIT0 + 0x78u) = (k == 0) ? 0u : (k == 1 ? 7u : 0xABu);
    c = make_call(); c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "sunit_get_f78_k%d", k);
    run_and_emit(0x6FCFF6C0u, "SUNIT_GetUnitField78_113c", k, lbl, &c, ts, 1, 0xFFu, 0);
  }

  /* [012] 0x6FD055C0 ACT3_CainIntroActiveFilter_6FD055C0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 16u, 1u, 5000u, 5000u, 112u);
    stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
    uint32_t pIntro = STAGE_SCRATCH + 0x200u;
    U32(pIntro + 0x00u) = pIntro + 0x10u;
    U32(pIntro + 0x10u) = pIntro + 0x20u;
    if (k == 2) memset((void *)(uintptr_t)(pIntro + 0x20u), 0xFF, 16u);
    U32(STAGE_UDATA0 + 0x60u) = pIntro;
    uint32_t npcId = (k == 0) ? 100u : 0xF5u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = 0u; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = 0; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a3_cain_intro_k%d", k);
    run_and_emit(0x6FD055C0u, "ACT3_CainIntroActiveFilter_6FD055C0_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [013] 0x6FCD0BE0 MONSTER_HasAlwaysChaseFlag113c (eax=pUnit, ret 0) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    uint32_t pU = 0u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 17u, 1u, 5000u, 5000u, 113u);
      U32(STAGE_UDATA0 + 0x54u) = (k == 1) ? 1u : (k == 2 ? 3u : 0x13u);
      pU = STAGE_UNIT0;
    }
    c = make_call(); c.eax = pU;
    ts[0] = pU;
    snprintf(lbl, sizeof(lbl), "mon_always_chase_k%d", k);
    run_and_emit(0x6FCD0BE0u, "MONSTER_HasAlwaysChaseFlag113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [014] 0x6FCFF780 D2GAME_SUNIT_GetGameFromUnit113c (eax=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 18u, 1u, 5000u, 5000u, 114u);
    U32(STAGE_UNIT0 + 0x80u) = (k == 0) ? 0u : (k == 1 ? STAGE_GAME : STAGE_SCRATCH);
    c = make_call(); c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "sunit_get_game_k%d", k);
    run_and_emit(0x6FCFF780u, "D2GAME_SUNIT_GetGameFromUnit113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [015] 0x6FCEC9D0 PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 19u, 1u, 5000u, 5000u, 115u);
    if (k == 2) stage_quest_node(STAGE_QUEST0, 1u, STAGE_QUESTEX0, 0u);
    U8(STAGE_SCRATCH + 0x00u)  = 0x2Fu;
    U32(STAGE_SCRATCH + 0x01u) = 99u;
    U16(STAGE_SCRATCH + 0x05u) = 0x50u;
    uint32_t nLen = (k == 0) ? 5u : 9u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt2f_npc_qmsg_k%d", k);
    run_and_emit(0x6FCEC9D0u, "PACKET_Srv2F_NpcQuestMessage_6FCEC9D0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [016] 0x6FCE3EC0 ACT2Q2_Callback03_LevelChanged113c (ecx=pQuest, edx=pArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 77u, 1u, 5000u, 5000u, 116u);
    U16(STAGE_QUEST0 + 0x9Cu) = 2u;
    U32(STAGE_QUEST0 + 0x1Cu) = 77u;
    U32(STAGE_QUEST0 + 0x20u) = 88u;
    U32(STAGE_SCRATCH + 0x0Cu) = (k == 2) ? 0u : STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = (k == 0) ? 1u : 0x28u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a2q2_lvlchg_k%d", k);
    run_and_emit(0x6FCE3EC0u, "ACT2Q2_Callback03_LevelChanged113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [017] 0x6FD03E00 ACT3Q0_Callback03_LevelChanged113c (ecx=pQuest, edx=pArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 78u, 1u, 5000u, 5000u, 117u);
    U16(STAGE_QUEST0 + 0x9Cu) = 2u;
    U32(STAGE_QUEST0 + 0x1Cu) = 78u;
    U32(STAGE_QUEST0 + 0x20u) = 89u;
    U32(STAGE_SCRATCH + 0x0Cu) = (k == 2) ? 0u : STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = (k == 0) ? 1u : 0x4Bu;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a3q0_lvlchg_k%d", k);
    run_and_emit(0x6FD03E00u, "ACT3Q0_Callback03_LevelChanged113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [018] 0x6FCD23D0 ARENA_GetPlayerArenaFlags113c (eax=pPlayer, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 21u, 1u, 5000u, 5000u, 118u);
    U32(STAGE_UDATA0 + 0x34u)  = STAGE_SCRATCH;
    U32(STAGE_SCRATCH + 0x04u) = (k == 0) ? 0u : (k == 1 ? 0x04u : 0x800u);
    c = make_call(); c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "arena_get_flags_k%d", k);
    run_and_emit(0x6FCD23D0u, "ARENA_GetPlayerArenaFlags113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [019] 0x6FCD97A0 ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 22u, 1u, 5000u, 5000u, 119u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_SCRATCH + 0x14u) = (k == 0) ? 100u : 0x16Fu;
    U16(STAGE_SCRATCH + 0x18u) = (k == 2) ? 0x298u : 100u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a4prol_scroll_k%d", k);
    run_and_emit(0x6FCD97A0u, "ACT4Prologue_Callback11_ScrollMessage_6FCD97A0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [020] 0x6FCE2720 ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 23u, 1u, 5000u, 5000u, 120u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_SCRATCH + 0x14u) = (k == 0) ? 100u : 0x17Au;
    U16(STAGE_SCRATCH + 0x18u) = (k == 2) ? 0x12Fu : 100u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a2q7_set_q31_k%d", k);
    run_and_emit(0x6FCE2720u, "ACT2Q7_Callback_SetQuest31State0_6FCE2720_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [021] 0x6FCED630 C2S_UnpackAndValidateUnitPacket113c (eax=pPkt, ecx=nLen, ebx=pOutId, s0=pGame, s1=pPlr, s2=pOutType, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 24u, 1u, 5000u, 5000u, 121u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 25u, 1u, 5004u, 5004u, 221u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x02u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 6u : 1u;
    U32(STAGE_SCRATCH + 0x05u) = 25u;
    uint32_t pOutType = STAGE_SCRATCH + 0x20u;
    uint32_t pOutId   = STAGE_SCRATCH + 0x24u;
    U32(pOutType) = 0xAAu; U32(pOutId) = 0xBBu;
    uint32_t nLen = (k == 0) ? 5u : 9u;
    c = make_call(); c.eax = STAGE_SCRATCH; c.ecx = nLen; c.ebx = pOutId;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = pOutType; c.calleePop = 0xCu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen; ts[4] = pOutType; ts[5] = pOutId;
    snprintf(lbl, sizeof(lbl), "c2s_unpack_unit_k%d", k);
    run_and_emit(0x6FCED630u, "C2S_UnpackAndValidateUnitPacket113c", k, lbl, &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [022] 0x6FCE1B60 ACT2Q2_IsQuestPastState01_6FCE1B60_113c (eax=pGame, ret 0, al) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = (k == 1) ? 1u : 2u;
    }
    c = make_call(); c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "a2q2_past01_k%d", k);
    run_and_emit(0x6FCE1B60u, "ACT2Q2_IsQuestPastState01_6FCE1B60_113c", k, lbl, &c, ts, 1, 0xFFu, 0);
  }

  /* [023] 0x6FCF1BC0 ITEMS_HasSocketedSubItems113c (eax=pItem, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pItm = 0u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_subtype, 25u, 0u, 2u, 5000u, 5000u, 123u);
      if (k == 2) {
        void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
        U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
        U32((uint32_t)(uintptr_t)pInv + 0x28u) = 1u;
      }
      pItm = STAGE_UNIT0;
    }
    c = make_call(); c.eax = pItm;
    ts[0] = pItm;
    snprintf(lbl, sizeof(lbl), "items_has_socketed_k%d", k);
    run_and_emit(0x6FCF1BC0u, "ITEMS_HasSocketedSubItems113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [024] 0x6FCCF610 D2GAME_MONSTER_HasComponentChoices113c (eax=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 26u, 1u, 5000u, 5000u, 124u);
    if (k == 1) U8(STAGE_UDATA0 + 0x04u) = 2u;
    if (k == 2) U8(STAGE_UDATA0 + 0x13u) = 5u;
    c = make_call(); c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "mon_has_comp_k%d", k);
    run_and_emit(0x6FCCF610u, "D2GAME_MONSTER_HasComponentChoices113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [025] 0x6FCEA5B0 MONREG_IncrementSpawnCount113c (eax=pUnit, ecx=bSkip, s0=ppMonReg, s1=pRoom, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 27u, 1u, 5000u, 5000u, 125u);
    uint32_t pReg = (uint32_t)(uintptr_t)bump_alloc(0x2E8u);
    U32(pReg + 0x2CCu) = (k == 2) ? 9u : 0u;
    U32(STAGE_GAME + 0xF0u + 1u * 4u) = pReg;
    uint32_t bSkip = (k == 0) ? 1u : 0u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = bSkip;
    c.nargs = 2; c.args[0] = STAGE_GAME + 0xF0u; c.args[1] = STAGE_ROOM0; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = bSkip; ts[2] = STAGE_GAME + 0xF0u; ts[3] = STAGE_ROOM0;
    snprintf(lbl, sizeof(lbl), "monreg_inc_spawn_k%d", k);
    run_and_emit(0x6FCEA5B0u, "MONREG_IncrementSpawnCount113c", k, lbl, &c, ts, 4, 0u, 0);
  }
}

/* ------------------------------- Group 2: VAs [026]..[050] */

static void emit_group_2(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[64];

  /* [026] 0x6FCF0910 D2Game_6FCF0910_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 30u, 1u, 5000u, 5000u, 126u);
    U8(STAGE_SCRATCH + 0x00u)  = 0x13u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 6u : 1u;
    U32(STAGE_SCRATCH + 0x05u) = 999u;
    uint32_t nLen = (k == 0) ? 4u : 9u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "c2s_6fcf0910_k%d", k);
    run_and_emit(0x6FCF0910u, "D2Game_6FCF0910_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [027] 0x6FD00A20 SUNIT_GetOwnerUnit113c (eax=pUnit, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pU = 0u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 31u, 1u, 5000u, 5000u, 127u);
      if (k == 2) {
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 55u, 1u, 5002u, 5002u, 227u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
        U32(STAGE_UNIT0 + 0xC8u) = 0x400u;
        U32(STAGE_UNIT0 + 0x94u) = 0u;
        U32(STAGE_UNIT0 + 0x98u) = 55u;
      }
      pU = STAGE_UNIT0;
    }
    c = make_call(); c.eax = pU; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pU; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "sunit_get_owner_k%d", k);
    run_and_emit(0x6FD00A20u, "SUNIT_GetOwnerUnit113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [028] 0x6FCC1240 AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 32u, 1u, 5000u, 5000u, 128u);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 33u, 12u, 5002u, 5002u, 228u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    uint32_t flt = (k == 2) ? 0x8583u : 0u;
    uint32_t ctr = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t rad = (k == 2) ? 8u : 5u;
    c = make_call(); c.eax = flt; c.ecx = ctr; c.edx = STAGE_DMG;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = 5000u; c.args[2] = 5000u; c.args[3] = rad; c.calleePop = 0x10u;
    ts[0] = flt; ts[1] = ctr; ts[2] = STAGE_DMG; ts[3] = STAGE_GAME; ts[4] = 5000; ts[5] = 5000; ts[6] = rad;
    snprintf(lbl, sizeof(lbl), "auras_radial_dmg_k%d", k);
    run_and_emit(0x6FCC1240u, "AURAS_ApplyRadialDamageWithDefaultFilter_6FCC1240_113c", k, lbl, &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [029] 0x6FCEB370 PACKET_CheckUnitsInDifferentActs113c (eax=pUnit1, s0=pUnit2, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t l1 = (k == 2) ? 75u : 1u;
    uint32_t l2 = (k == 0) ? 2u : (k == 1 ? 40u : 103u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, l1);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, l2);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 34u, 1u, 5000u, 5000u, 129u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM1, 0u, 2u, 35u, 1u, 5000u, 5000u, 229u);
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "pkt_diff_acts_k%d", k);
    run_and_emit(0x6FCEB370u, "PACKET_CheckUnitsInDifferentActs113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [030] 0x6FCF1470 C2S_HandlePacket4F_TradeButton_6FCF1470_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 36u, 1u, 5000u, 5000u, 130u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U8(STAGE_SCRATCH + 0x00u)  = 0x4Fu;
    U16(STAGE_SCRATCH + 0x01u) = (k == 2) ? 7u : 2u;
    U16(STAGE_SCRATCH + 0x03u) = 0u;
    U16(STAGE_SCRATCH + 0x05u) = (k == 2) ? 100u : 0u;
    uint32_t nLen = (k == 0) ? 4u : 7u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt4f_trade_btn_k%d", k);
    run_and_emit(0x6FCF1470u, "C2S_HandlePacket4F_TradeButton_6FCF1470_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [031] 0x6FCF4630 ITEMS_OnUnequipScrollOrTome113c (eax=pItem, ecx=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, k == 0 ? 1u : 0u, 1u, 37u, 1u, 5000u, 5000u, 131u);
    if (k >= 1) {
      link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
      uint32_t pSk = attach_skill(STAGE_UNIT0, 219, 1);
      fn_SetSkillCharges((void *)(uintptr_t)pSk, 3);
    }
    uint32_t cid = (k == 2) ? g_item_tsc : g_item_sword;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 71u, 0u, 2u, 5000u, 5000u, 231u);
    U16(STAGE_UDATA1 + 0x3Eu) = 0u;
    c = make_call(); c.eax = STAGE_UNIT1; c.ecx = STAGE_UNIT0;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_unequip_scroll_k%d", k);
    run_and_emit(0x6FCF4630u, "ITEMS_OnUnequipScrollOrTome113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [032] 0x6FCF4670 ITEMS_OnEquipScrollOrTome113c (eax=pItem, ecx=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, k == 0 ? 1u : 0u, 1u, 38u, 1u, 5000u, 5000u, 132u);
    if (k >= 1) {
      link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
      uint32_t pSk = attach_skill(STAGE_UNIT0, 219, 1);
      fn_SetSkillCharges((void *)(uintptr_t)pSk, 3);
    }
    uint32_t cid = (k == 2) ? g_item_tsc : g_item_sword;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 72u, 0u, 2u, 5000u, 5000u, 232u);
    U16(STAGE_UDATA1 + 0x3Eu) = 0u;
    c = make_call(); c.eax = STAGE_UNIT1; c.ecx = STAGE_UNIT0;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_equip_scroll_k%d", k);
    run_and_emit(0x6FCF4670u, "ITEMS_OnEquipScrollOrTome113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [033] 0x6FCE1F90 ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c (eax=pGame, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x0Fu) = (k == 2) ? 1u : 0u;
      U8(STAGE_QUESTEX0 + 0x10u) = 0u;
    }
    c = make_call(); c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "a2q4_horazon_k%d", k);
    run_and_emit(0x6FCE1F90u, "ACT2Q4_ActivateHorazonJournal_6FCE1F90_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [034] 0x6FCE5440 ACT2Q2_ActiveFilter_6FCE5440_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 39u, 1u, 5000u, 5000u, 134u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 1) set_quest_bit(pFlags, 0x0Au, 1u);
    uint32_t npcId = (k == 0) ? 100u : 0xF4u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a2q2_filter_k%d", k);
    run_and_emit(0x6FCE5440u, "ACT2Q2_ActiveFilter_6FCE5440_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [035] 0x6FCFF9C0 SUNIT_GetNewUnitId113c (edx=pGame, ecx=unitType, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t uType = (k == 0) ? 0u : (k == 1 ? 1u : 4u);
    U32(STAGE_GAME + 0x90u + uType * 4u) = (k == 0) ? 0u : (k == 1 ? 41u : 0xFFFFFFFEu);
    c = make_call(); c.edx = STAGE_GAME; c.ecx = uType;
    ts[0] = STAGE_GAME; ts[1] = uType;
    snprintf(lbl, sizeof(lbl), "sunit_new_id_k%d", k);
    run_and_emit(0x6FCFF9C0u, "SUNIT_GetNewUnitId113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [036] 0x6FD028C0 ACT3Q6_MephistoActiveFilter113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 1) ? 1u : 0u;
    if (k == 2) set_quest_bit(pFlags, 0x16u, 0x0Bu);
    uint32_t npcId = (k == 1) ? 0xFFu : 100u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a3q6_meph_filter_k%d", k);
    run_and_emit(0x6FD028C0u, "ACT3Q6_MephistoActiveFilter113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [037] 0x6FD10220 D2GAME_PARTY_SetPlayerRelationState113c (edi=pOwner, esi=pTarget, s0=state, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 137u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, k == 2 ? 20u : 99u, 1u, 5004u, 5004u, 237u);
    U32(STAGE_UDATA0 + 0x38u)  = STAGE_SCRATCH;
    U32(STAGE_SCRATCH + 0x00u) = 20u;
    U32(STAGE_SCRATCH + 0x0Cu) = 1u;
    uint32_t pTgt = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c = make_call(); c.edi = STAGE_UNIT0; c.esi = pTgt; c.nargs = 1; c.args[0] = 8u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pTgt; ts[2] = 8;
    snprintf(lbl, sizeof(lbl), "party_set_rel_k%d", k);
    run_and_emit(0x6FD10220u, "D2GAME_PARTY_SetPlayerRelationState113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [038] 0x6FCFFA90 SUNIT_IsDeadOrDying113c (eax=pUnit, ret 0) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    uint32_t pU = 0u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      uint32_t uT = (k == 1) ? 0u : 1u;
      uint32_t md = (k == 2) ? 12u : 2u;
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uT, 1u, 40u, md, 5000u, 5000u, 138u);
      pU = STAGE_UNIT0;
    }
    c = make_call(); c.eax = pU;
    ts[0] = pU;
    snprintf(lbl, sizeof(lbl), "sunit_is_dead_k%d", k);
    run_and_emit(0x6FCFFA90u, "SUNIT_IsDeadOrDying113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [039] 0x6FD101D0 PARTY_GetPlayerRelationState113c (edi=pOwner, esi=pTarget, ret 0, ax) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 139u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, k == 2 ? 20u : 99u, 1u, 5004u, 5004u, 239u);
    U32(STAGE_UDATA0 + 0x38u)  = STAGE_SCRATCH;
    U32(STAGE_SCRATCH + 0x00u) = 20u;
    U16(STAGE_SCRATCH + 0x0Cu) = 8u;
    uint32_t pTgt = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c = make_call(); c.edi = STAGE_UNIT0; c.esi = pTgt;
    ts[0] = STAGE_UNIT0; ts[1] = pTgt;
    snprintf(lbl, sizeof(lbl), "party_get_rel_k%d", k);
    run_and_emit(0x6FD101D0u, "PARTY_GetPlayerRelationState113c", k, lbl, &c, ts, 2, 0xFFFFu, 0);
  }

  /* [040] 0x6FCD27D0 D2GAME_ARENA_ClearPlayerArenaFlags113c (eax=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 41u, 1u, 5000u, 5000u, 140u);
    uint32_t pArena = STAGE_SCRATCH + (uint32_t)k * 0x10u;
    U32(pArena + 0x00u) = 0x10u + (uint32_t)k;
    U32(pArena + 0x04u) = 0x100u + (uint32_t)k * 5u;
    U32(STAGE_UDATA0 + 0x34u) = pArena;
    c = make_call(); c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "arena_clear_flags_k%d", k);
    run_and_emit(0x6FCD27D0u, "D2GAME_ARENA_ClearPlayerArenaFlags113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [041] 0x6FCD08A0 MONAI_GetUnitMeleeVelocity_6FCD08A0_113c (ecx=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pU = 0u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, k == 1 ? 0u : 1u, 1u, 42u, 1u, 5000u, 5000u, 141u);
      pU = STAGE_UNIT0;
    }
    c = make_call(); c.ecx = pU;
    ts[0] = pU;
    snprintf(lbl, sizeof(lbl), "monai_melee_vel_k%d", k);
    run_and_emit(0x6FCD08A0u, "MONAI_GetUnitMeleeVelocity_6FCD08A0_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [042] 0x6FCCF8D0 MONSTER_DeleteAiAndRegenEvents113c (eax=pGame, ebx=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pU = 0u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 43u, 1u, 5000u, 5000u, 142u);
      uint32_t e0 = STAGE_SCRATCH;
      uint32_t e1 = STAGE_SCRATCH + 0x40u;
      U8(e0 + 0x00u)  = (k == 1) ? 0u : 2u;
      U8(e0 + 0x02u)  = 1u;
      U32(e0 + 0x24u) = (k == 2) ? e1 : 0u;
      U8(e1 + 0x00u)  = 3u;
      U8(e1 + 0x02u)  = 1u;
      U32(STAGE_UNIT0 + 0xDCu) = e0;
      pU = STAGE_UNIT0;
    }
    c = make_call(); c.eax = STAGE_GAME; c.ebx = pU;
    ts[0] = STAGE_GAME; ts[1] = pU;
    snprintf(lbl, sizeof(lbl), "mon_del_ai_regen_k%d", k);
    run_and_emit(0x6FCCF8D0u, "MONSTER_DeleteAiAndRegenEvents113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [043] 0x6FCFFFD0 SUNIT_SetUnitEventSound113c (esi=pUnit, s0=wSound, s1=pSrc, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 44u, 1u, 5000u, 5000u, 143u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 45u, 1u, 5002u, 5002u, 243u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t wS = (k == 2) ? 30u : 25u;
    uint32_t pS = (k == 2) ? STAGE_UNIT1 : 0u;
    c = make_call(); c.esi = pU; c.nargs = 2; c.args[0] = wS; c.args[1] = pS; c.calleePop = 8u;
    ts[0] = pU; ts[1] = wS; ts[2] = pS;
    snprintf(lbl, sizeof(lbl), "sunit_event_sound_k%d", k);
    run_and_emit(0x6FCFFFD0u, "SUNIT_SetUnitEventSound113c", k, lbl, &c, ts, 3, 0u, k == 0 ? 1 : 0);
  }

  /* [044] 0x6FD00750 MONSTER_ClearModeEvents113c (eax=pGame, ebx=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pU = 0u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 46u, 1u, 5000u, 5000u, 144u);
      uint32_t e0 = STAGE_SCRATCH;
      uint32_t e1 = STAGE_SCRATCH + 0x40u;
      U8(e0 + 0x00u)  = (k == 1) ? 2u : 0u;
      U8(e0 + 0x02u)  = 1u;
      U32(e0 + 0x24u) = (k == 2) ? e1 : 0u;
      U8(e1 + 0x00u)  = 1u;
      U8(e1 + 0x02u)  = 1u;
      U32(STAGE_UNIT0 + 0xDCu) = e0;
      pU = STAGE_UNIT0;
    }
    c = make_call(); c.eax = STAGE_GAME; c.ebx = pU;
    ts[0] = STAGE_GAME; ts[1] = pU;
    snprintf(lbl, sizeof(lbl), "mon_clr_mode_ev_k%d", k);
    run_and_emit(0x6FD00750u, "MONSTER_ClearModeEvents113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [045] 0x6FCC09A0 SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 47u, 1u, 5000u, 5000u, 145u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    int32_t sk = (k == 0) ? -1 : (k == 1 ? 0 : 56);
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = (uint32_t)sk;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = sk; ts[2] = STAGE_GAME; ts[3] = 5;
    snprintf(lbl, sizeof(lbl), "skills_delay_plr_k%d", k);
    run_and_emit(0x6FCC09A0u, "SKILLS_EvalAndApplySkillDelayOnPlayer_6FCC09A0_113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* [046] 0x6FCFAE20 SUNITDMG_GetDefenderColdEffect113c (eax=pDefender, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 2u : 0u;
    uint32_t pDef = 0u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, k == 1 ? 0u : 1u, 1u, 48u, 1u, 5000u, 5000u, 146u);
      pDef = STAGE_UNIT0;
    }
    c = make_call(); c.eax = pDef; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pDef; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "sunitdmg_cold_eff_k%d", k);
    run_and_emit(0x6FCFAE20u, "SUNITDMG_GetDefenderColdEffect113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [047] 0x6FCEBD50 PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c (edx=pPlayer, s0=pPkt, s1=nLen, ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 49u, 1u, 5000u, 5000u, 147u);
    if (k == 2) U32(STAGE_UNIT0 + 0xC4u) |= 0x400u;
    U8(STAGE_SCRATCH + 0x00u)  = 0x3Fu;
    U16(STAGE_SCRATCH + 0x01u) = (k == 1) ? 5u : 0x1Au;
    uint32_t nLen = (k == 0) ? 2u : 3u;
    c = make_call(); c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH; ts[2] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt3f_voice_k%d", k);
    run_and_emit(0x6FCEBD50u, "PACKET_Recv3F_PlayVoicePhrase_6FCEBD50_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [048] 0x6FCF40F0 UNITROOM_SendDroppedGroundItemToClient113c (edi=pItem, ebx=pClient, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 50u, 1u, 5000u, 5000u, 148u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    uint32_t pItm = 0u;
    if (k >= 1) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 75u, k == 1 ? 0u : 3u, 2u, 5002u, 5002u, 248u);
      pItm = STAGE_UNIT1;
    }
    c = make_call(); c.edi = pItm; c.ebx = STAGE_CLIENT;
    ts[0] = pItm; ts[1] = STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "unitroom_send_drop_k%d", k);
    run_and_emit(0x6FCF40F0u, "UNITROOM_SendDroppedGroundItemToClient113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [049] 0x6FCF1A50 ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c (eax=pUnit, edi=pPrim, ebx=pSec, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 51u, 1u, 5000u, 5000u, 149u);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      if (k == 2) {
        stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 76u, 1u, 2u, 5000u, 5000u, 249u);
        fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4);
      }
    }
    U32(STAGE_SCRATCH + 0x00u) = 0xAAu;
    U32(STAGE_SCRATCH + 0x04u) = 0xBBu;
    c = make_call(); c.eax = STAGE_UNIT0; c.edi = STAGE_SCRATCH; c.ebx = STAGE_SCRATCH + 0x04u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH; ts[2] = STAGE_SCRATCH + 0x04u;
    snprintf(lbl, sizeof(lbl), "items_prim_sec_wpn_k%d", k);
    run_and_emit(0x6FCF1A50u, "ITEMS_GetPrimaryAndSecondaryWeapon_6FCF1A50_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [050] 0x6FCD8810 ACT4Q2_ActiveFilter_6FCD8810_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    stage_quest_node(STAGE_QUEST0, 0x1Bu, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    if (k == 2) set_quest_bit(pFlags, 0x1Bu, 0u);
    uint32_t npcId = (k == 0) ? 100u : 0xF6u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a4q2_filter_k%d", k);
    run_and_emit(0x6FCD8810u, "ACT4Q2_ActiveFilter_6FCD8810_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }
}

/* ------------------------------- Group 3: VAs [051]..[075] */

static void emit_group_3(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[64];

  /* [051] 0x6FCF3950 ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c (eax=pItem, edi=pUnit, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 60u, 1u, 5000u, 5000u, 151u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_hp1, 80u + (uint32_t)k, 2u, 2u, 0u, 0u, 251u + (uint32_t)k);
    fn_AutoPlaceIntoBeltSlot(pInv, (void *)(uintptr_t)STAGE_UNIT1, k);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    c = make_call(); c.eax = STAGE_UNIT1; c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "items_consume_belt_k%d", k);
    run_and_emit(0x6FCF3950u, "ITEMS_ConsumeBeltItemAndNotify0F_6FCF3950_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [052] 0x6FCE3260 ACT2Q4_IsPalaceCellarAllowed_6FCE3260_113c (eax=pGame, ret 0, al) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    if (k >= 1) {
      uint32_t qA = (uint32_t)(uintptr_t)bump_alloc(0x100u);
      uint32_t q9 = (uint32_t)(uintptr_t)bump_alloc(0x100u);
      U32(q9 + 0x00u) = 0x09u; U32(q9 + 0x04u) = STAGE_GAME; U8(q9 + 0x09u) = 1u; U8(q9 + 0x0Cu) = 1u;
      U32(qA + 0x00u) = 0x0Au; U32(qA + 0x04u) = STAGE_GAME; U8(qA + 0x09u) = 1u; U8(qA + 0x0Cu) = 1u; U32(qA + 0xF4u) = q9;
      stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, qA);
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = 1u;
      U8(STAGE_QUESTEX0 + 0x0Du) = (k == 2) ? 1u : 0u;
    }
    c = make_call(); c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "a2q4_palace_allowed_k%d", k);
    run_and_emit(0x6FCE3260u, "ACT2Q4_IsPalaceCellarAllowed_6FCE3260_113c", k, lbl, &c, ts, 1, 0xFFu, 0);
  }

  /* [053] 0x6FCEFB30 C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 61u, 1u, 5000u, 5000u, 153u);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 148u, 85u, 1u, 5200u, 5200u, 253u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    U8(STAGE_SCRATCH + 0x00u)  = 0x38u;
    U32(STAGE_SCRATCH + 0x01u) = 1u;
    U32(STAGE_SCRATCH + 0x05u) = 85u;
    U32(STAGE_SCRATCH + 0x09u) = 0u;
    uint32_t nLen = (k == 0) ? 5u : 0x0Du;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt38_npc_menu_k%d", k);
    run_and_emit(0x6FCEFB30u, "C2S_HandlePacket38_NpcMenuRequest_6FCEFB30_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [054] 0x6FCE4A40 ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 62u, 1u, 5000u, 5000u, 154u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_SCRATCH + 0x14u) = (k == 0) ? 100u : 0x179u;
    U16(STAGE_SCRATCH + 0x18u) = (k == 2) ? 0x3Bu : 10u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a2q7_scroll_state_k%d", k);
    run_and_emit(0x6FCE4A40u, "ACT2Q7_Callback_ScrollMessageSetState_6FCE4A40_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [055] 0x6FCEF510 C2S_Packet60_SwapWeapons_6FCEF510_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t md = (k == 2) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 63u, md, 5000u, 5000u, 155u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 2560, 0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    uint32_t pSk = attach_skill(STAGE_UNIT0, 0, 1);
    uint32_t pList = U32(STAGE_UNIT0 + 0xA8u);
    U32(pList + 0x08u) = pSk;
    U32(pList + 0x0Cu) = pSk;
    if (k == 1) U32(STAGE_GAME + 0x70u) = 0u;
    U8(STAGE_SCRATCH) = 0x60u;
    uint32_t nLen = (k == 0) ? 2u : 1u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt60_swap_wpn_k%d", k);
    run_and_emit(0x6FCEF510u, "C2S_Packet60_SwapWeapons_6FCEF510_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [056] 0x6FD053F0 ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 64u, 1u, 5000u, 5000u, 156u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 1) ? 1u : 0u;
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    uint32_t npcId = (k == 0) ? 100u : 0xFEu;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a3q4_alkor_alert_k%d", k);
    run_and_emit(0x6FD053F0u, "ACT3Q4_CheckAlkorQuestAlert_6FD053F0_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [057] 0x6FCF39B0 ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c (eax=pItem, ecx=pUnit, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 65u, 1u, 5000u, 5000u, 157u);
    if (k >= 1) link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    uint32_t cid = (k == 2) ? g_item_hp1 : g_item_ring;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 86u + (uint32_t)k, 0u, 2u, 0u, 0u, 257u);
    U8(STAGE_UDATA1 + 0x45u) = 0u;
    fn_PlaceInGridCell(pInv, (void *)(uintptr_t)STAGE_UNIT1, k == 2 ? 1 : 0, 0, 16, 0, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    c = make_call(); c.eax = STAGE_UNIT1; c.ecx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "items_consume_grid_k%d", k);
    run_and_emit(0x6FCF39B0u, "ITEMS_ConsumeGridItemAndNotify9D_6FCF39B0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [058] 0x6FCDD810 NPC_OnHealerNpcInteract_6FCDD810_113c (eax=pNpc, s0=pPlayer, s1=pGame, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_PREF_BASE + 0x111C08u, 4u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 66u, 1u, 5000u, 5000u, 158u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 80 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 20 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 60 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 30 << 8, 0);
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, k == 1 ? 150u : 0x94u, 89u, 1u, 5002u, 5002u, 258u);
      pNpc = STAGE_UNIT1;
    }
    c = make_call(); c.eax = pNpc; c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_GAME; c.calleePop = 8u;
    ts[0] = pNpc; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "npc_healer_interact_k%d", k);
    run_and_emit(0x6FCDD810u, "NPC_OnHealerNpcInteract_6FCDD810_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [059] 0x6FD02AB0 ACT3Q5_BlackenedTempleActiveFilter113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_quest_node(STAGE_QUEST0, 0x15u, STAGE_QUESTEX0, 0u);
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 0) set_quest_bit(pFlags, 0x15u, 0u);
    if (k == 1) U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    if (k == 2) set_quest_bit(pFlags, 0x15u, 4u);
    uint32_t npcId = (k == 2) ? 0xF5u : 0xFFu;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a3q5_temple_filter_k%d", k);
    run_and_emit(0x6FD02AB0u, "ACT3Q5_BlackenedTempleActiveFilter113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [060] 0x6FCF08B0 D2Game_6FCF08B0_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 67u, 1u, 5000u, 5000u, 160u);
    U8(STAGE_SCRATCH + 0x00u)  = 0x14u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 6u : (k == 2 ? 0u : 1u);
    U32(STAGE_SCRATCH + 0x05u) = (k == 2) ? 67u : 999u;
    U32(STAGE_SCRATCH + 0x09u) = 0u;
    uint32_t nLen = (k == 0) ? 5u : 0x0Du;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "c2s_6fcf08b0_k%d", k);
    run_and_emit(0x6FCF08B0u, "D2Game_6FCF08B0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [061] 0x6FCE32C0 ACT2Q4_InitArcanePortalObject_6FCE32C0_113c (ecx=pInteractArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 74u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 60u, 68u, 0u, 5000u, 5000u, 161u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
      U16(STAGE_QUESTEX0 + 0x40u) = (k == 1) ? 1u : 2u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a2q4_arcane_portal_k%d", k);
    run_and_emit(0x6FCE32C0u, "ACT2Q4_InitArcanePortalObject_6FCE32C0_113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [062] 0x6FCFA750 SUNITDMG_FreeAttackerCombatList113c (edi=pUnit, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 69u, 1u, 5000u, 5000u, 162u);
    if (k == 1) {
      uint32_t c0 = STAGE_SCRATCH;
      U32(c0 + 0x04u) = 1u; U32(c0 + 0x08u) = 69u;
      U32(STAGE_UNIT0 + 0xACu) = c0;
    } else if (k == 2) {
      uint32_t c0 = STAGE_SCRATCH;
      uint32_t c1 = STAGE_SCRATCH + 0x90u;
      U32(c0 + 0x04u) = 0u; U32(c0 + 0x08u) = 99u; U32(c0 + 0x84u) = c1;
      U32(c1 + 0x04u) = 1u; U32(c1 + 0x08u) = 69u;
      U32(STAGE_UNIT0 + 0xACu) = c0;
    }
    c = make_call(); c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "sunitdmg_free_cbt_k%d", k);
    run_and_emit(0x6FCFA750u, "SUNITDMG_FreeAttackerCombatList113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [063] 0x6FCF1830 D2GAME_ITEMS_CheckEquipAndAmmoRequirements113c (eax=pUnit, ebx=pItem, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 70u, 1u, 5000u, 5000u, 163u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 120, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 120, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 50, 0);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    uint32_t cid = (k == 0) ? g_item_sword : g_item_bow;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 90u, 0u, 2u, 0u, 0u, 263u);
    if (k == 2) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_arrows, 91u, 1u, 2u, 0u, 0u, 363u);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT2, 5);
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = STAGE_UNIT1;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "items_chk_equip_ammo_k%d", k);
    run_and_emit(0x6FCF1830u, "D2GAME_ITEMS_CheckEquipAndAmmoRequirements113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [064] 0x6FCFF620 SUNIT_FindValidNextRoomInAct113c (esi=pUnit, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, k == 0 ? 0u : 1u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 71u, 1u, 5000u, 5000u, 164u);
    U32(STAGE_PATH0 + 0x20u) = (k == 2) ? STAGE_ROOM0 : STAGE_ROOM1;
    c = make_call(); c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "sunit_valid_next_room_k%d", k);
    run_and_emit(0x6FCFF620u, "SUNIT_FindValidNextRoomInAct113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [065] 0x6FD05F00 ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 72u, 1u, 5000u, 5000u, 165u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k >= 1) set_quest_bit(pFlags, 0x14u, 0u);
    if (k == 2) set_quest_bit(pFlags, 0x14u, 0x0Du);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "a3q1_golden_bird_cb_k%d", k);
    run_and_emit(0x6FD05F00u, "ACT3Q1_SendGoldenBirdQuestAlertCallback_6FD05F00_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [066] 0x6FCFFAE0 SUNIT_SetLastKillerInfo_6FCFFAE0_113c (eax=pUnit, s0=nInteractUnitType, s1=dwInteractUnitId, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 73u, 1u, 5000u, 5000u, 166u);
    memcpy((void *)(uintptr_t)STAGE_UDATA0, "Hero", 5u);
    if (k == 0) {
      U32(STAGE_UNIT0 + 0x64u) = 0x7777u;
      U32(STAGE_UNIT0 + 0x68u) = 9u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
    }
    uint32_t uType = (k == 2) ? 2u : 1u;
    uint32_t uGuid = (k == 2) ? 0x3344u : 0x1122u;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = uType; c.args[1] = uGuid; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = uType; ts[2] = uGuid;
    snprintf(lbl, sizeof(lbl), "sunit_set_killer_k%d", k);
    run_and_emit(0x6FCFFAE0u, "SUNIT_SetLastKillerInfo_6FCFFAE0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [067] 0x6FCC1630 SKILLS_StartPlayerSkillAnimOrCast113c (ecx=pGame, edx=pUnit, s0=skId, s1=skLvl, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, (uint32_t)k, 75u, 1u, 5000u, 5000u, 167u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k == 1) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 92u, 1u, 2u, 0u, 0u, 267u);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "skills_start_plr_anim_k%d", k);
    run_and_emit(0x6FCC1630u, "SKILLS_StartPlayerSkillAnimOrCast113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [068] 0x6FCE2750 ACT2Q7_ActiveFilter_6FCE2750_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 76u, 1u, 5000u, 5000u, 168u);
    stage_quest_node(STAGE_QUEST0, 0x1Eu, STAGE_QUESTEX0, 0u);
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 0x1Eu, 0u);
    uint32_t npcId = (k == 0) ? 100u : 0x179u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a2q7_filter_k%d", k);
    run_and_emit(0x6FCE2750u, "ACT2Q7_ActiveFilter_6FCE2750_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [069] 0x6FD001A0 MONSTER_UpdateMonsterRoomAllyCount113c (esi=pUnit, eax=newA, edx=oldA, ecx=bRef, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 77u, 1u, 5000u, 5000u, 169u);
    U32(STAGE_UDATA0 + 0x58u) = 1u;
    uint32_t pReg = (uint32_t)(uintptr_t)bump_alloc(0x2E8u);
    U32(pReg + 0x2CCu) = 5u;
    U32(STAGE_GAME + 0xF0u + 1u * 4u) = pReg;
    U32(STAGE_ROOM0 + 0x28u) = 2u;
    uint32_t newA = (k == 1) ? 2u : 0u;
    uint32_t oldA = (k == 2) ? 2u : 0u;
    uint32_t bRef = (k == 2) ? 1u : 0u;
    c = make_call(); c.esi = STAGE_UNIT0; c.eax = newA; c.edx = oldA; c.ecx = bRef;
    ts[0] = STAGE_UNIT0; ts[1] = newA; ts[2] = oldA; ts[3] = bRef;
    snprintf(lbl, sizeof(lbl), "mon_ally_cnt_k%d", k);
    run_and_emit(0x6FD001A0u, "MONSTER_UpdateMonsterRoomAllyCount113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* [070] 0x6FCDC920 STATES_PurgeExpStateStatLists_6FCDC920_113c (ebx=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 78u, 1u, 5000u, 5000u, 170u);
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 1, 1);
    } else if (k == 2) {
      void *pSub = fn_AllocStatList(NULL, 0x40u, 0u, 0, 78);
      fn_SetStatListState(pSub, 137);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 1);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 137, 1);
    }
    c = make_call(); c.ebx = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "states_purge_exp_k%d", k);
    run_and_emit(0x6FCDC920u, "STATES_PurgeExpStateStatLists_6FCDC920_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [071] 0x6FCDCB20 NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c (ecx=pGame, eax=pNpc, edi=maxCap, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U8(STAGE_GAME + 0x6Du) = (k == 0) ? 1u : 0u;
    uint32_t pCtrl = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    uint32_t pTbl  = (uint32_t)(uintptr_t)bump_alloc(0x40u * 0x44u);
    for (uint32_t s = 0; s < 0x40u; s++) U32(pTbl + s * 0x44u) = 900u + s;
    U32(pTbl + 0x00u) = 148u;
    U8(pTbl + 0x22u)  = 0u;
    U32(pCtrl + 0x04u) = pTbl;
    U32(STAGE_GAME + 0x1D24u) = pCtrl;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, k == 2 ? 198u : 148u, 79u, 1u, 5000u, 5000u, 171u);
    c = make_call(); c.ecx = STAGE_GAME; c.eax = STAGE_UNIT0; c.edi = 30u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 30;
    snprintf(lbl, sizeof(lbl), "npctrade_clamp_cap_k%d", k);
    run_and_emit(0x6FCDCB20u, "NPCTRADE_ClampNormalActLevelCap_6FCDCB20_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [072] 0x6FD002A0 SUNIT_RemoveServerUnit113c (edx=pGame, esi=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 172u);
    if (k >= 1) insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 138u, 1u, 5002u, 5002u, 272u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    c = make_call(); c.edx = STAGE_GAME; c.esi = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "sunit_remove_srv_k%d", k);
    run_and_emit(0x6FD002A0u, "SUNIT_RemoveServerUnit113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [073] 0x6FCDCE60 NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c (esi=pItem, edi=pNpc, s0=bAppend, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 148u, 81u, 1u, 5000u, 5000u, 173u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    uint32_t cid = (k == 2) ? g_item_subtype : g_item_ring;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 93u, 0u, 2u, 0u, 0u, 273u);
    if (k == 2) {
      void *pSubInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
      U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)pSubInv;
      U32((uint32_t)(uintptr_t)pSubInv + 0x28u) = 1u;
    }
    uint32_t bApp = (k == 0) ? 0u : 1u;
    c = make_call(); c.esi = STAGE_UNIT1; c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = bApp; c.calleePop = 4u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = bApp;
    snprintf(lbl, sizeof(lbl), "npc_append_sold_k%d", k);
    run_and_emit(0x6FCDCE60u, "NPC_FlagAndAppendSoldItemToNpcInv_6FCDCE60_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [074] 0x6FCE2520 ACT2Q1_ActiveFilter_6FCE2520_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_quest_node(STAGE_QUEST0, 9u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 9u;
    U8(STAGE_QUEST0 + 0x09u)  = 1u;
    U8(STAGE_QUEST0 + 0x0Cu)  = 1u;
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 9u, 0u);
    uint32_t npcId = (k == 0) ? 100u : 0xB0u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a2q1_filter_k%d", k);
    run_and_emit(0x6FCE2520u, "ACT2Q1_ActiveFilter_6FCE2520_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [075] 0x6FCECDB0 C2S_ValidateBeltItemOwnership_6FCECDB0_113c (eax=pGame, ecx=itemGuid, s0=pPlayer, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 82u, 1u, 5000u, 5000u, 175u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_hp1, 95u, 2u, 2u, 0u, 0u, 275u);
      fn_AutoPlaceInBelt(pInv, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    c = make_call(); c.eax = pG; c.ecx = 95u; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = pG; ts[1] = 95; ts[2] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "c2s_val_belt_own_k%d", k);
    run_and_emit(0x6FCECDB0u, "C2S_ValidateBeltItemOwnership_6FCECDB0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, k == 0 ? 1 : 0);
  }
}

/* ------------------------------- Group 4: VAs [076]..[100] */

static void emit_group_4(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[64];

  /* [076] 0x6FCD9730 ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c (ecx=pQuest, edx=pNpcParams, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 100u, 1u, 5000u, 5000u, 176u);
    stage_quest_node(STAGE_QUEST0, 0x18u, STAGE_QUESTEX0, 0u);
    uint32_t pMsgTbl = U32(STAGE_QUEST0 + 0xDCu);
    U32(pMsgTbl + 0x00u) = 0x16Fu; U16(pMsgTbl + 0x04u) = 0x298u; U32(pMsgTbl + 0x08u) = 1u; U32(pMsgTbl + 0xC0u) = 1u;
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 1) set_quest_bit(pFlags, 0x18u, 0u);
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x16Fu, 101u, 1u, 5002u, 5002u, 276u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a4q0_tyrael_dlg_k%d", k);
    run_and_emit(0x6FCD9730u, "ACT4Q0_InitTyraelIntroDialog_6FCD9730_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [077] 0x6FCECF00 C2S_ValidateStoredItem_6FCECF00_113c (eax=pGame, ecx=itemGuid, s0=pPlayer, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 102u, 1u, 5000u, 5000u, 177u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 103u, 0u, 2u, 0u, 0u, 277u);
      U8(STAGE_UDATA1 + 0x45u) = 0u;
      fn_PlaceInGridCell(pInv, (void *)(uintptr_t)STAGE_UNIT1, 0, 0, 16, 0, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    c = make_call(); c.eax = pG; c.ecx = 103u; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = pG; ts[1] = 103; ts[2] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "c2s_val_stored_k%d", k);
    run_and_emit(0x6FCECF00u, "C2S_ValidateStoredItem_6FCECF00_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, k == 0 ? 1 : 0);
  }

  /* [078] 0x6FD003A0 SUNIT_GetServerUnit113c (ecx=pGame, eax=uType, edx=uId, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uT = (k == 2) ? 5u : 1u;
    uint32_t uI = (k == 2) ? 7u : 42u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uT, 1u, uI, 1u, 5000u, 5000u, 178u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.eax = uT; c.edx = uI;
    ts[0] = STAGE_GAME; ts[1] = uT; ts[2] = uI;
    snprintf(lbl, sizeof(lbl), "sunit_get_srv_k%d", k);
    run_and_emit(0x6FD003A0u, "SUNIT_GetServerUnit113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [079] 0x6FCECF70 C2S_ValidateCursorItem_6FCECF70_113c (eax=pGame, ecx=itemGuid, s0=pPlayer, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 104u, 1u, 5000u, 5000u, 179u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 105u, 4u, 2u, 0u, 0u, 279u);
      fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    c = make_call(); c.eax = pG; c.ecx = 105u; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = pG; ts[1] = 105; ts[2] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "c2s_val_cursor_k%d", k);
    run_and_emit(0x6FCECF70u, "C2S_ValidateCursorItem_6FCECF70_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, k == 0 ? 1 : 0);
  }

  /* [080] 0x6FCEEC70 C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 106u, 1u, 5000u, 5000u, 180u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_hp1, 107u, 4u, 2u, 0u, 0u, 280u);
      fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    U8(STAGE_SCRATCH + 0x00u)  = 0x23u;
    U32(STAGE_SCRATCH + 0x01u) = 107u;
    U32(STAGE_SCRATCH + 0x05u) = 0u;
    uint32_t nLen = (k == 0) ? 4u : 9u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt23_cur_to_belt_k%d", k);
    run_and_emit(0x6FCEEC70u, "C2S_Packet23_PlaceCursorItemIntoBelt_6FCEEC70_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [081] 0x6FCFA480 ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c (ecx=pGame, edx=pItem, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 2500u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (k == 0) ? g_item_ring : g_item_sword;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 108u, 1u, 2u, 0u, 0u, 181u);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 73, 20, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 72, 10, 0);
      if (k == 2) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0xFC, 100, 0);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_replenish_tick_k%d", k);
    run_and_emit(0x6FCFA480u, "ITEMS_ProcessItemDurabilityAndStackReplenish_6FCFA480_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [082] 0x6FCD8AE0 ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_quest_node(STAGE_QUEST0, 0x19u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 0u : 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    uint32_t npcId = (k == 2) ? 0x196u : 0x16Fu;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a4q1_npc_ind_k%d", k);
    run_and_emit(0x6FCD8AE0u, "ACT4Q1_HasActiveQuestNpcIndicator_6FCD8AE0_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [083] 0x6FCED480 C2S_Packet30_CancelNpcInteract_6FCED480_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 109u, 1u, 5000u, 5000u, 183u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 148u, 110u, 1u, 5002u, 5002u, 283u);
      U32(STAGE_UDATA1 + 0x30u) = STAGE_SCRATCH + 0x200u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    U8(STAGE_SCRATCH + 0x00u)  = 0x30u;
    U32(STAGE_SCRATCH + 0x05u) = 110u;
    uint32_t nLen = (k == 0) ? 4u : 9u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt30_cancel_npc_k%d", k);
    run_and_emit(0x6FCED480u, "C2S_Packet30_CancelNpcInteract_6FCED480_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [084] 0x6FCEE440 C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 111u, 1u, 5000u, 5000u, 184u);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 148u, 112u, 1u, 5002u, 5002u, 284u);
      U32(STAGE_UDATA1 + 0x30u) = STAGE_SCRATCH + 0x200u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    U8(STAGE_SCRATCH + 0x00u)  = 0x2Fu;
    U32(STAGE_SCRATCH + 0x05u) = 112u;
    uint32_t nLen = (k == 0) ? 4u : 9u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "c2s_trig_mon_spawn_k%d", k);
    run_and_emit(0x6FCEE440u, "C2S_PacketTriggerMonsterSpawnNode_6FCEE440_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [085] 0x6FCE1E10 ACT2Q5_ActiveFilter_6FCE1E10_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 0x0Du, 1u);
    uint32_t npcId = (k == 0) ? 100u : 0xB0u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a2q5_filter_k%d", k);
    run_and_emit(0x6FCE1E10u, "ACT2Q5_ActiveFilter_6FCE1E10_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [086] 0x6FCE4620 ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 113u, 1u, 5000u, 5000u, 186u);
    stage_quest_node(STAGE_QUEST0, 8u, STAGE_QUESTEX0, 0u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_SCRATCH + 0x14u) = (k == 0) ? 100u : (k == 1 ? 0xC9u : 0xF4u);
    U16(STAGE_SCRATCH + 0x18u) = (k == 1) ? 0xFDu : 0x7Du;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a2q0_scroll_done_k%d", k);
    run_and_emit(0x6FCE4620u, "ACT2Q0_Callback_ScrollMessageCompleteIntro_6FCE4620_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [087] 0x6FCD8B90 ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 114u, 1u, 5000u, 5000u, 187u);
    stage_quest_node(STAGE_QUEST0, 0x1Bu, STAGE_QUESTEX0, 0u);
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) { set_quest_bit(pFlags, 0x1Bu, 0u); set_quest_bit(pFlags, 0x1Au, 0u); }
    uint32_t npcId = (k == 0) ? 100u : 0x198u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a4q2_hadriel_ind_k%d", k);
    run_and_emit(0x6FCD8B90u, "ACT4Q2_HasHadrielQuestIndicator_6FCD8B90_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [088] 0x6FCDCD90 NPC_TransferInventoryItemsToOwner_6FCDCD90_113c (eax=pSrcInv, ebx=pDestUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 148u, 115u, 1u, 5000u, 5000u, 188u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 148u, 116u, 1u, 5002u, 5002u, 288u);
    void *pSrc  = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    void *pDest = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pSrc;
    U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)pDest;
    if (k >= 1) {
      uint32_t cid = (k == 2) ? g_item_subtype : g_item_ring;
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, cid, 117u, 0u, 2u, 0u, 0u, 388u);
      U8(STAGE_UDATA2 + 0x45u) = 0u;
      fn_PlaceInGridCell(pSrc, (void *)(uintptr_t)STAGE_UNIT2, 0, 0, 16, 0, 0);
      if (k == 2) {
        void *pSub = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT2);
        U32(STAGE_UNIT2 + 0x60u) = (uint32_t)(uintptr_t)pSub;
        U32((uint32_t)(uintptr_t)pSub + 0x28u) = 1u;
      }
    }
    c = make_call(); c.eax = (uint32_t)(uintptr_t)pSrc; c.ebx = STAGE_UNIT1;
    ts[0] = (uint32_t)(uintptr_t)pSrc; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "npc_xfer_inv_k%d", k);
    run_and_emit(0x6FCDCD90u, "NPC_TransferInventoryItemsToOwner_6FCDCD90_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [089] 0x6FCECE20 C2S_ValidateInventoryOrCursorItem_6FCECE20_113c (eax=pGame, ecx=itemGuid, edi=pPlayer, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 118u, 1u, 5000u, 5000u, 189u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 119u, 4u, 2u, 0u, 0u, 289u);
      fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    c = make_call(); c.eax = pG; c.ecx = 119u; c.edi = STAGE_UNIT0;
    ts[0] = pG; ts[1] = 119; ts[2] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "c2s_val_inv_or_cur_k%d", k);
    run_and_emit(0x6FCECE20u, "C2S_ValidateInventoryOrCursorItem_6FCECE20_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, k == 0 ? 1 : 0);
  }

  /* [090] 0x6FCEBED0 NET_SendEventMessage5A_Type0E_113c (eax=pPlayer, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pPlr = 0u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, k == 1 ? 1u : 0u, 1u, 120u, 1u, 5000u, 5000u, 190u);
      if (k == 2) link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
      pPlr = STAGE_UNIT0;
    }
    c = make_call(); c.eax = pPlr;
    ts[0] = pPlr;
    snprintf(lbl, sizeof(lbl), "net_send_5a_0e_k%d", k);
    run_and_emit(0x6FCEBED0u, "NET_SendEventMessage5A_Type0E_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [091] 0x6FD054C0 ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, k == 1 ? 1u : 4u, 121u, 1u, 5000u, 5000u, 191u);
    stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
    uint32_t pMsgTbl = U32(STAGE_QUEST0 + 0xDCu);
    U32(pMsgTbl + 0x00u) = 0xFDu; U16(pMsgTbl + 0x04u) = 0x1D1u; U32(pMsgTbl + 0x08u) = 1u; U32(pMsgTbl + 0xC0u) = 1u;
    U32(pMsgTbl + 0xC4u) = 0xFDu; U16(pMsgTbl + 0xC8u) = 0x1D2u; U32(pMsgTbl + 0xCCu) = 1u; U32(pMsgTbl + 0x184u) = 1u;
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xFDu, 122u, 1u, 5002u, 5002u, 291u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a3q0_hratli_dlg_k%d", k);
    run_and_emit(0x6FD054C0u, "ACT3Q0_AddHratliIntroDialogNodes_6FD054C0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [092] 0x6FCDA100 ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 123u, 1u, 5000u, 5000u, 192u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    stage_quest_node(STAGE_QUEST0, 0x19u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x11u) = (k == 2) ? 1u : 0u;
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x16Fu, 124u, 1u, 5002u, 5002u, 292u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a4q1_tyrael_talk_k%d", k);
    run_and_emit(0x6FCDA100u, "ACT4Q1_OnTyraelTalkCallback_6FCDA100_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [093] 0x6FCE61C0 ACT2Q1_OnAtmaTalkCallback_6FCE61C0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 125u, 1u, 5000u, 5000u, 193u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    stage_quest_node(STAGE_QUEST0, 9u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x08u) = (k == 2) ? 1u : 0u;
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xB0u, 126u, 1u, 5002u, 5002u, 293u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a2q1_atma_talk_k%d", k);
    run_and_emit(0x6FCE61C0u, "ACT2Q1_OnAtmaTalkCallback_6FCE61C0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [094] 0x6FD11A90 AI_FindNearestPlayerCallback113c (ecx=pGame, edx=pMon, s0=pCand, s1=pCtx, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 127u, 1u, 5000u, 5000u, 194u);
    uint32_t pCand = 0u;
    if (k >= 1) {
      uint16_t px = (k == 1) ? 5100u : 5003u;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 128u, 1u, px, 5000u, 294u);
      pCand = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x00u) = 0u;
    U32(STAGE_SCRATCH + 0x04u) = 0x7FFFFFFFu;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = pCand; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pCand; ts[3] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_nearest_plr_cb_k%d", k);
    run_and_emit(0x6FD11A90u, "AI_FindNearestPlayerCallback113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [095] 0x6FCF4360 ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c (ecx=pGame, eax=pUnit, esi=pItem, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 129u, 1u, 5000u, 5000u, 195u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, k == 2 ? g_item_tsc : g_item_ring, 130u, 3u, 2u, 5000u, 5000u, 295u);
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    c = make_call(); c.ecx = pG; c.eax = STAGE_UNIT0; c.esi = STAGE_UNIT1;
    ts[0] = pG; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "items_autostack_k%d", k);
    run_and_emit(0x6FCF4360u, "ITEMS_AutoStackGroundItemOrScroll_6FCF4360_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, k == 0 ? 1 : 0);
  }

  /* [096] 0x6FCF17B0 ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c (esi=pItem, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (k == 0) ? g_item_sword : (k == 1 ? g_item_tbk : g_item_isc);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 131u, 0u, 2u, 0u, 0u, 196u);
    U16(STAGE_UDATA0 + 0x3Eu) = (k == 2) ? 1u : 0u;
    c = make_call(); c.esi = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_book_skid_k%d", k);
    run_and_emit(0x6FCF17B0u, "ITEMS_GetBookOrScrollSkillId_6FCF17B0_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [097] 0x6FCF1AA0 ITEMS_GetScrollOrTomeSkillId113c (esi=pItem, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (k == 0) ? g_item_sword : (k == 1 ? g_item_tsc : g_item_tbk);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 132u, 0u, 2u, 0u, 0u, 197u);
    U16(STAGE_UDATA0 + 0x3Eu) = 0u;
    c = make_call(); c.esi = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_scroll_tome_skid_k%d", k);
    run_and_emit(0x6FCF1AA0u, "ITEMS_GetScrollOrTomeSkillId113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [098] 0x6FCEA530 MONREG_UpdateActiveCountOnMode113c (edx=pUnit, ebx=oldM, edi=newM, s0=ppMonReg, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 133u, 1u, 5000u, 5000u, 198u);
    U32(STAGE_UDATA0 + 0x58u) = 1u;
    uint32_t pReg = (uint32_t)(uintptr_t)bump_alloc(0x2E8u);
    U32(pReg + 0x2CCu) = 5u;
    U32(STAGE_GAME + 0xF0u + 1u * 4u) = pReg;
    uint32_t oldM = (k == 1) ? 1u : 0u;
    uint32_t newM = (k == 0) ? 1u : 0u;
    c = make_call(); c.edx = STAGE_UNIT0; c.ebx = oldM; c.edi = newM;
    c.nargs = 1; c.args[0] = STAGE_GAME + 0xF0u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = oldM; ts[2] = newM; ts[3] = STAGE_GAME + 0xF0u;
    snprintf(lbl, sizeof(lbl), "monreg_upd_mode_k%d", k);
    run_and_emit(0x6FCEA530u, "MONREG_UpdateActiveCountOnMode113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* [099] 0x6FCD0B20 MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c (esi=pUnit, edi=nMode, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pU = 0u;
    uint32_t md = (k == 2) ? 0x13u : 1u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 134u, 1u, 5000u, 5000u, 199u);
      pU = STAGE_UNIT0;
    }
    c = make_call(); c.esi = pU; c.edi = md;
    ts[0] = pU; ts[1] = md;
    snprintf(lbl, sizeof(lbl), "monai_can_tp_k%d", k);
    run_and_emit(0x6FCD0B20u, "MONAI_CanMonsterTeleportOrUseSkillInMode_6FCD0B20_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [100] 0x6FCD15E0 MONAI_FindClosestLoSHostileMeleeAndRangedTargetCallback_6FCD15E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 19u, 135u, 1u, 5000u, 5000u, 200u);
    uint32_t pCand = 0u;
    if (k >= 1) {
      uint16_t px = (k == 1) ? 5003u : 5010u;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 136u, 1u, px, 5000u, 300u);
      pCand = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x04u) = (k == 2) ? 2u : 100u;
    U32(STAGE_SCRATCH + 0x0Cu) = 100u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = pCand; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pCand; ts[3] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "monai_closest_los_k%d", k);
    run_and_emit(0x6FCD15E0u, "MONAI_FindClosestLoSHostileMeleeAndRangedTargetCallback_6FCD15E0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }
}


/* ------------------------------- Group 5: VAs [101]..[125] */

static void emit_group_5(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[64];

  /* [101] 0x6FD05540 ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 140u, 1u, 5000u, 5000u, 201u);
    stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_SCRATCH + 0x14u) = (k == 0) ? 100u : 0xFDu;
    U16(STAGE_SCRATCH + 0x18u) = (k == 1) ? 10u : 0x1D1u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a3q0_hratli_done_k%d", k);
    run_and_emit(0x6FD05540u, "ACT3Q0_OnHratliIntroSpeechDone_6FD05540_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [102] 0x6FCE5DB0 ACT2Q4_OnDrognanTalkCallback_6FCE5DB0_113c (ecx=pQuest, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 141u, 1u, 5000u, 5000u, 202u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    stage_quest_node(STAGE_QUEST0, 0x0Cu, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x04u) = (k == 2) ? 1u : 0u;
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xB1u, 142u, 1u, 5002u, 5002u, 302u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a2q4_drognan_talk_k%d", k);
    run_and_emit(0x6FCE5DB0u, "ACT2Q4_OnDrognanTalkCallback_6FCE5DB0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [103] 0x6FCF2540 ITEMS_CompactBeltColumnDown_6FCF2540_113c (eax=nBeltSlot, s0=pUnit, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 143u, 1u, 5000u, 5000u, 203u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k >= 1) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_hp1, 144u + (uint32_t)k, 2u, 2u, 0u, 0u, 303u);
      fn_AutoPlaceIntoBeltSlot(pInv, (void *)(uintptr_t)STAGE_UNIT1, k == 1 ? 0 : 5);
    }
    uint32_t slot = (k == 2) ? 1u : 0u;
    c = make_call(); c.eax = slot; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = slot; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_compact_belt_k%d", k);
    run_and_emit(0x6FCF2540u, "ITEMS_CompactBeltColumnDown_6FCF2540_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [104] 0x6FD00660 SUNIT_CanPlayerTargetUnitWithSkill113c (eax=pTarget, s0=pGame, s1=pPlr, s2=skId, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 146u, 1u, 5000u, 5000u, 204u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 147u, 1u, 5002u, 5002u, 304u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    /* Build party table: UNIT0 in party 1; UNIT1 in party 2 (k==1) or party 1 (k==2) */
    U32(STAGE_GAME + 0x1D2Cu)  = STAGE_SCRATCH;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_SCRATCH + 0x10u;
    U16(STAGE_SCRATCH + 0x10u) = 1u;
    U32(STAGE_SCRATCH + 0x14u) = STAGE_SCRATCH + 0x30u;
    U32(STAGE_SCRATCH + 0x18u) = STAGE_SCRATCH + 0x20u;
    U32(STAGE_SCRATCH + 0x30u) = 146u;
    U32(STAGE_SCRATCH + 0x34u) = (k == 2) ? (STAGE_SCRATCH + 0x38u) : 0u;
    U32(STAGE_SCRATCH + 0x38u) = 147u;
    U16(STAGE_SCRATCH + 0x20u) = 2u;
    U32(STAGE_SCRATCH + 0x24u) = (k == 1) ? (STAGE_SCRATCH + 0x40u) : 0u;
    U32(STAGE_SCRATCH + 0x40u) = 147u;
    uint32_t pTgt = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t skId = 52u;
    c = make_call(); c.eax = pTgt;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = skId; c.calleePop = 0xCu;
    ts[0] = pTgt; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = skId;
    snprintf(lbl, sizeof(lbl), "sunit_can_plr_tgt_sk_k%d", k);
    run_and_emit(0x6FD00660u, "SUNIT_CanPlayerTargetUnitWithSkill113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [105] 0x6FCF24B0 ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c (ebx=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pU = 0u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 147u, 1u, 5000u, 5000u, 205u);
      if (k == 2) {
        void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
        U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
        U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
        stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 148u, 1u, 2u, 0u, 0u, 305u);
        fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4);
      }
      pU = STAGE_UNIT0;
    }
    c = make_call(); c.ebx = pU;
    ts[0] = pU;
    snprintf(lbl, sizeof(lbl), "items_refresh_inv_stats_k%d", k);
    run_and_emit(0x6FCF24B0u, "ITEMS_RefreshAllInventoryItemStatListsAndSkills_6FCF24B0_113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [106] 0x6FCF0F80 C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 149u, 1u, 5000u, 5000u, 206u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_hp1, 150u, 2u, 2u, 0u, 0u, 306u);
      fn_AutoPlaceInBelt(pInv, (void *)(uintptr_t)STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_ring, 151u, 4u, 2u, 0u, 0u, 406u);
      fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT2);
    }
    U8(STAGE_SCRATCH + 0x00u)  = 0x24u;
    U32(STAGE_SCRATCH + 0x01u) = 150u;
    uint32_t nLen = (k == 0) ? 4u : 5u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt24_belt_to_cur_k%d", k);
    run_and_emit(0x6FCF0F80u, "C2S_Packet24_RemoveBeltItemToCursor_6FCF0F80_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [107] 0x6FD0FE40 SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c (ecx=pGame, edi=pUnit, ebx=nBucket, s0=arg4, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 152u, 1u, 5000u, 5000u, 207u);
    U32(STAGE_UNIT0 + 0xD0u) = 0x0Bu;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 153u, 1u, 5002u, 5002u, 307u);
      uint32_t pHead = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pHead + 0x00u) = STAGE_UNIT1;
      U32(STAGE_GAME + 0x10F8u + 2u * 4u) = pHead;
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t bkt = (k == 1) ? 8u : 2u;
    c = make_call(); c.ecx = STAGE_GAME; c.edi = pU; c.ebx = bkt;
    c.nargs = 1; c.args[0] = 77u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pU; ts[2] = bkt; ts[3] = 77;
    snprintf(lbl, sizeof(lbl), "subparty_ins_after_k%d", k);
    run_and_emit(0x6FD0FE40u, "SUBPARTY_InsertUnitAfterBucketHead_6FD0FE40_113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* [108] 0x6FCE25F0 ACT2Q8_ActiveFilter_6FCE25F0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 154u, 1u, 5000u, 5000u, 208u);
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    set_quest_bit(U32(STAGE_QUESTCTRL + 0x0Cu), 0x0Bu, 0x0Du);
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 0x0Eu, 0u);
    uint32_t npcId = (k == 0) ? 100u : 0x17Au;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a2q8_filter_k%d", k);
    run_and_emit(0x6FCE25F0u, "ACT2Q8_ActiveFilter_6FCE25F0_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [109] 0x6FCD07B0 UNITS_GetOctileDistanceToCoordinates113c (eax=pUnit, s0=nX, s1=nY, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 155u, 1u, 5000u, 5000u, 209u);
    int32_t nx = (k == 0) ? 5000 : (k == 1 ? 5010 : 4996);
    int32_t ny = (k == 0) ? 5000 : (k == 1 ? 5004 : 5012);
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)nx; c.args[1] = (uint32_t)ny; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = nx; ts[2] = ny;
    snprintf(lbl, sizeof(lbl), "units_octile_dist_k%d", k);
    run_and_emit(0x6FCD07B0u, "UNITS_GetOctileDistanceToCoordinates113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [110] 0x6FCEB690 C2S_CheckCoordDeltaExceeded113c (eax=pUnit, ebx=maxDelta, s0=nX, s1=nY, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uT = (k == 2) ? 2u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uT, 1u, 156u, 1u, 5000u, 5000u, 210u);
    uint32_t nx = (k == 0) ? 5005u : (k == 1 ? 5020u : 5002u);
    uint32_t ny = (k == 2) ? 5015u : 5004u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = 10u;
    c.nargs = 2; c.args[0] = nx; c.args[1] = ny; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = nx; ts[2] = ny; ts[3] = 10;
    snprintf(lbl, sizeof(lbl), "c2s_coord_delta_k%d", k);
    run_and_emit(0x6FCEB690u, "C2S_CheckCoordDeltaExceeded113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [111] 0x6FD00B40 MONSTER_RegisterContinuousModeEvent113c (eax=pGame, s0=pUnit, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uT = (k == 1) ? 0u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uT, 1u, 157u + (uint32_t)k, 1u, 5000u, 5000u, 211u);
    if (k == 2) {
      uint32_t e0 = STAGE_SCRATCH;
      U8(e0 + 0x00u) = 2u; U8(e0 + 0x02u) = 1u;
      U32(STAGE_UNIT0 + 0xDCu) = e0;
    }
    c = make_call(); c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "mon_reg_cont_ev_k%d", k);
    run_and_emit(0x6FD00B40u, "MONSTER_RegisterContinuousModeEvent113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [112] 0x6FCEBF50 C2S_UnpackAndValidateLocationPacket113c (eax=pPkt, esi=pPlr, s0=pGame, s1=nLen, s2=pX, s3=pY, ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 160u, 1u, 5000u, 5000u, 212u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    U8(STAGE_SCRATCH + 0x00u)  = 0x01u;
    U16(STAGE_SCRATCH + 0x01u) = (k == 2) ? 5200u : 5005u;
    U16(STAGE_SCRATCH + 0x03u) = 5004u;
    uint32_t pOutX = STAGE_SCRATCH + 0x20u;
    uint32_t pOutY = STAGE_SCRATCH + 0x24u;
    U16(pOutX) = 0x99u; U16(pOutY) = 0x99u;
    uint32_t nLen = (k == 0) ? 4u : 5u;
    c = make_call(); c.eax = STAGE_SCRATCH; c.esi = STAGE_UNIT0;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = nLen; c.args[2] = pOutX; c.args[3] = pOutY; c.calleePop = 0x10u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen; ts[4] = pOutX; ts[5] = pOutY;
    snprintf(lbl, sizeof(lbl), "c2s_unpack_loc_k%d", k);
    run_and_emit(0x6FCEBF50u, "C2S_UnpackAndValidateLocationPacket113c", k, lbl, &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [113] 0x6FCCF840 MONSTER_GetDifficultyAndPlayerBonus113c (edi=pGame, ecx=pUnit, esi=pOut, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_PREF_BASE + 0xFB5F0u, 0x48u);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 3u : 0u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (k == 0) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 161u, 1u, 5000u, 5000u, 213u);
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 161u, 1u, 5000u, 5000u, 213u);
    }
    c = make_call(); c.edi = STAGE_GAME; c.ecx = STAGE_UNIT0; c.esi = STAGE_SCRATCH;
    ts[0] = STAGE_GAME;
    ts[1] = STAGE_SCRATCH + 0x0Cu; ts[2] = STAGE_SCRATCH + 0x10u;
    ts[3] = STAGE_SCRATCH + 0x04u; ts[4] = STAGE_SCRATCH + 0x00u;
    ts[5] = STAGE_UNIT0;           ts[6] = STAGE_SCRATCH + 0x08u;
    snprintf(lbl, sizeof(lbl), "mon_diff_plr_bonus_k%d", k);
    run_and_emit(0x6FCCF840u, "MONSTER_GetDifficultyAndPlayerBonus113c", k, lbl, &c, ts, 7, 0u, 0);
  }

  /* [114] 0x6FCF2BE0 ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c (eax=pItem, edi=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 162u, 1u, 5000u, 5000u, 214u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    uint32_t cid = (k == 0) ? g_item_sword : g_item_tsc;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 163u, 0u, 2u, 0u, 0u, 314u);
    U16(STAGE_UDATA1 + 0x3Eu) = 0u;
    if (k == 2) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, 219, 1);
      fn_SetSkillCharges((void *)(uintptr_t)pSk, 5);
    }
    c = make_call(); c.eax = STAGE_UNIT1; c.edi = STAGE_UNIT0;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_zero_scroll_chg_k%d", k);
    run_and_emit(0x6FCF2BE0u, "ITEMS_ZeroScrollOrTomeSkillChargesAndSync22_6FCF2BE0_113c", k, lbl, &c, ts, 2, 0u, k == 1 ? 1 : 0);
  }

  /* [115] 0x6FD0AEE0 PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c (eax=pPlr, edi=nStatId, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 164u, 1u, 5000u, 5000u, 215u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    if (k >= 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 4, 5, 0);
    uint32_t stId = (k == 2) ? 2u : 0u;
    c = make_call(); c.eax = STAGE_UNIT0; c.edi = stId;
    ts[0] = STAGE_UNIT0; ts[1] = stId;
    snprintf(lbl, sizeof(lbl), "plrstats_spend_pt_k%d", k);
    run_and_emit(0x6FD0AEE0u, "PLAYERSTATS_SpendSingleStatPoint_6FD0AEE0_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [116] 0x6FCCCBA0 ITEMMODS_ApplyManaAfterKill_6FCCCBA0_113c (stdcall 5 args, ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 165u, 1u, 5000u, 5000u, 216u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 166u, 1u, 5002u, 5002u, 316u);
    if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 138, 5, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 100 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 20 << 8, 0);
    }
    uint32_t pAtt = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t param = 138u << 16;
    c = make_call(); c.nargs = 5;
    c.args[0] = pAtt; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_DMG; c.args[3] = param; c.args[4] = 0u;
    c.calleePop = 0x14u;
    ts[0] = pAtt; ts[1] = STAGE_UNIT1; ts[2] = STAGE_DMG; ts[3] = param; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "itemmods_maek_k%d", k);
    run_and_emit(0x6FCCCBA0u, "ITEMMODS_ApplyManaAfterKill_6FCCCBA0_113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [117] 0x6FCEF480 C2S_Packet3C_SelectSkill113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 167u, 1u, 5000u, 5000u, 217u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    attach_skill(STAGE_UNIT0, 0, 1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x3Cu;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 999u : 0u;
    U32(STAGE_SCRATCH + 0x05u) = 0xFFFFFFFFu;
    uint32_t nLen = (k == 0) ? 4u : 9u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt3c_sel_skill_k%d", k);
    run_and_emit(0x6FCEF480u, "C2S_Packet3C_SelectSkill113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [118] 0x6FCF12E0 D2Game_6FCF12E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 168u, 1u, 5000u, 5000u, 218u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U8(STAGE_SCRATCH + 0x00u)  = 0x1Cu;
    U16(STAGE_SCRATCH + 0x01u) = (k == 1) ? 0u : 4u;
    uint32_t nLen = (k == 0) ? 2u : 3u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "c2s_6fcf12e0_k%d", k);
    run_and_emit(0x6FCF12E0u, "D2Game_6FCF12E0_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [119] 0x6FCEEF40 C2S_Packet50_DropPlayerGold_6FCEEF40_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 169u, 1u, 5000u, 5000u, 219u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 170u, 1u, 5002u, 5002u, 319u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 0u;
      U32(STAGE_UNIT0 + 0x64u) = 170u;
    }
    U8(STAGE_SCRATCH + 0x00u)  = 0x50u;
    U32(STAGE_SCRATCH + 0x01u) = 999u;
    U32(STAGE_SCRATCH + 0x05u) = 50u;
    uint32_t nLen = (k == 0) ? 4u : 9u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt50_drop_gold_k%d", k);
    run_and_emit(0x6FCEEF40u, "C2S_Packet50_DropPlayerGold_6FCEEF40_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [120] 0x6FD056E0 ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 171u, 1u, 5000u, 5000u, 220u);
    uint32_t pIntro = STAGE_SCRATCH + 0x200u;
    U32(pIntro + 0x00u) = pIntro + 0x10u;
    U32(pIntro + 0x10u) = pIntro + 0x20u;
    U32(STAGE_UDATA0 + 0x60u) = pIntro;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = (k == 0) ? 100u : (k == 1 ? 0xF5u : 0xFEu);
    U16(STAGE_SCRATCH + 0x18u) = (k == 1) ? 0x1CAu : 0x1F6u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a3_kurast_intro_done_k%d", k);
    run_and_emit(0x6FD056E0u, "ACT3_OnKurastNpcIntroSpeechDone_6FD056E0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [121] 0x6FCD9DE0 ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 172u, 1u, 5000u, 5000u, 221u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    stage_quest_node(STAGE_QUEST0, 0x1Bu, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x02u) = 1u;
    U8(STAGE_QUESTEX0 + 0x1Cu) = (k == 2) ? 1u : 0u;
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xF6u, 173u, 1u, 5002u, 5002u, 321u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a4q2_tgt0f6_cb_k%d", k);
    run_and_emit(0x6FCD9DE0u, "ACT4Q2_OnQuestTarget0F6Callback_6FCD9DE0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [122] 0x6FCDB1B0 ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 174u, 1u, 5000u, 5000u, 222u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    stage_quest_node(STAGE_QUEST0, 0x1Cu, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x00u) = (k == 2) ? 1u : 0u;
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x16Fu, 175u, 1u, 5002u, 5002u, 322u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a4q3_tyrael_portal_k%d", k);
    run_and_emit(0x6FCDB1B0u, "ACT4Q3_OnTyraelTalkOpenHarrogathPortal_6FCDB1B0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [123] 0x6FD06CF0 ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 176u, 1u, 5000u, 5000u, 223u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x01u) = 1u;
    U8(STAGE_QUESTEX0 + 0x07u) = 1u;
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, k == 1 ? 0xFDu : 0xFFu, 177u, 1u, 5002u, 5002u, 323u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a3q2_gidbinn_alert_k%d", k);
    run_and_emit(0x6FD06CF0u, "ACT3Q2_OnNpcActivatedSendGidbinnAlert_6FD06CF0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [124] 0x6FD00A60 SUNIT_AreUnitsHostileOrUnaligned113c (eax=pUnit1, ecx=pUnit2, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 178u, 1u, 5000u, 5000u, 224u);
    uint32_t pU2 = STAGE_UNIT0;
    if (k == 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 179u, 1u, 5002u, 5002u, 324u);
      pU2 = STAGE_UNIT1;
    } else if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 179u, 1u, 5002u, 5002u, 324u);
      pU2 = STAGE_UNIT1;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = pU2;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pU2; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "sunit_hostile_unaligned_k%d", k);
    run_and_emit(0x6FD00A60u, "SUNIT_AreUnitsHostileOrUnaligned113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [125] 0x6FCD8C00 ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c (ecx=pQuestData, edx=pNpcParams, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 107u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 180u, 1u, 5000u, 5000u, 225u);
    stage_quest_node(STAGE_QUEST0, 0x1Bu, STAGE_QUESTEX0, 0u);
    uint32_t pMsgTbl = U32(STAGE_QUEST0 + 0xDCu);
    U32(pMsgTbl + 0x00u) = 0x198u; U16(pMsgTbl + 0x04u) = 0x2A0u; U32(pMsgTbl + 0x08u) = 1u; U32(pMsgTbl + 0xC0u) = 1u;
    U32(pMsgTbl + 0xC4u) = 0x198u; U16(pMsgTbl + 0xC8u) = 0x2A1u; U32(pMsgTbl + 0xCCu) = 1u; U32(pMsgTbl + 0x184u) = 1u;
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 0x1Bu, 0u);
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x198u, 181u, 1u, 5002u, 5002u, 325u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a4q2_hadriel_dlg_k%d", k);
    run_and_emit(0x6FCD8C00u, "ACT4Q2_InitHadrielNpcDialog_6FCD8C00_113c", k, lbl, &c, ts, 2, 0u, 0);
  }
}

/* ------------------------------- Group 6: VAs [126]..[150] */

static void emit_group_6(void) {
  X86CallSpec c;
  int64_t ts[10];
  char lbl[64];

  /* [126] 0x6FD00570 SUNIT_AreUnitsInSamePartyOrAligned113c (eax=pUnit2, ecx=pUnit1, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 182u, 1u, 5000u, 5000u, 226u);
    uint32_t pU1 = STAGE_UNIT0;
    if (k == 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 183u, 1u, 5002u, 5002u, 326u);
      pU1 = STAGE_UNIT1;
    } else if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 183u, 1u, 5002u, 5002u, 326u);
      pU1 = STAGE_UNIT1;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = pU1;
    ts[0] = STAGE_UNIT0; ts[1] = pU1;
    snprintf(lbl, sizeof(lbl), "sunit_same_party_aligned_k%d", k);
    run_and_emit(0x6FD00570u, "SUNIT_AreUnitsInSamePartyOrAligned113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [127] 0x6FCE2080 ACT2Q4_ActiveFilter_6FCE2080_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_quest_node(STAGE_QUEST0, 0x0Cu, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    uint32_t npcId = (k == 0) ? 100u : (k == 1 ? 0x14Bu : 0xB1u);
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a2q4_filter_k%d", k);
    run_and_emit(0x6FCE2080u, "ACT2Q4_ActiveFilter_6FCE2080_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [128] 0x6FD102F0 D2GAME_PARTY_EnsurePlayerRelationNode113c (eax=pUnitA, ecx=pUnitB, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 184u, 1u, 5000u, 5000u, 228u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    uint32_t pB = STAGE_UNIT0;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 185u, 1u, 5002u, 5002u, 328u);
      if (k == 1) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 7, 1);
      pB = STAGE_UNIT1;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = pB;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pB; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "party_ensure_rel_k%d", k);
    run_and_emit(0x6FD102F0u, "D2GAME_PARTY_EnsurePlayerRelationNode113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [129] 0x6FCD8970 ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_quest_node(STAGE_QUEST0, 0x1Au, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 0x1Au, 0u);
    uint32_t npcId = (k == 0) ? 100u : (k == 1 ? 0x16Fu : 0xF6u);
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a4q1_has_ind_k%d", k);
    run_and_emit(0x6FCD8970u, "ACT4Q1_HasNpcQuestIndicator_6FCD8970_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [130] 0x6FD055F0 ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, k == 2 ? 2u : 1u, 186u, 1u, 5000u, 5000u, 230u);
    stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
    uint32_t pMsgTbl = U32(STAGE_QUEST0 + 0xDCu);
    U32(pMsgTbl + 0x00u) = 0xFEu; U16(pMsgTbl + 0x04u) = 0x1F5u; U32(pMsgTbl + 0x08u) = 1u; U32(pMsgTbl + 0xC0u) = 1u;
    U32(pMsgTbl + 0xC4u) = 0xFEu; U16(pMsgTbl + 0xC8u) = 0x1F6u; U32(pMsgTbl + 0xCCu) = 1u; U32(pMsgTbl + 0x184u) = 1u;
    uint32_t pIntro = STAGE_SCRATCH + 0x200u;
    U32(pIntro + 0x00u) = pIntro + 0x10u;
    U32(pIntro + 0x10u) = pIntro + 0x20u;
    U32(STAGE_UDATA0 + 0x60u) = pIntro;
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xFEu, 187u, 1u, 5002u, 5002u, 330u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a3_kurast_intro_dlg_k%d", k);
    run_and_emit(0x6FD055F0u, "ACT3_AddKurastNpcIntroDialogNodes_6FD055F0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [131] 0x6FCF31D0 ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c (eax=pItem, s0=pUnit, s1=delta, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 188u, 1u, 5000u, 5000u, 231u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    uint32_t cid = (k == 2) ? g_item_tsc : g_item_sword;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 189u, 0u, 2u, 0u, 0u, 331u);
    U16(STAGE_UDATA1 + 0x3Eu) = 0u;
    if (k == 2) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, 219, 1);
      fn_SetSkillCharges((void *)(uintptr_t)pSk, 2);
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = STAGE_UNIT1;
    c.nargs = 2; c.args[0] = pU; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT1; ts[1] = pU; ts[2] = 3;
    snprintf(lbl, sizeof(lbl), "items_add_scroll_chg_k%d", k);
    run_and_emit(0x6FCF31D0u, "ITEMS_AddScrollOrTomeSkillChargesAndSync22_6FCF31D0_113c", k, lbl, &c, ts, 3, 0u, k == 0 ? 1 : 0);
  }

  /* [132] 0x6FCED6D0 C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c (eax=pGame, ecx=guid, edx=pPlr, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 190u, 1u, 5000u, 5000u, 232u);
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 191u, 3u, 2u, 5002u, 5002u, 332u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    c = make_call(); c.eax = pG; c.ecx = 191u; c.edx = STAGE_UNIT0;
    ts[0] = pG; ts[1] = 191; ts[2] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "c2s_val_item_mode_k%d", k);
    run_and_emit(0x6FCED6D0u, "C2S_ValidateItemInteractionByAnimMode_6FCED6D0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, k == 0 ? 1 : 0);
  }

  /* [133] 0x6FCF1890 D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c (eax=pUnit, esi=pOutSnapshot, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 192u, 1u, 5000u, 5000u, 233u);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (40 + k * 10) << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, (20 + k * 5) << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, (30 + k * 5) << 8, 0);
    }
    if (k == 2) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, 36, 1);
      uint32_t pList = U32(STAGE_UNIT0 + 0xA8u);
      U32(pList + 0x08u) = pSk;
      U32(pList + 0x0Cu) = pSk;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.esi = STAGE_SCRATCH;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "items_snap_stats_sk_k%d", k);
    run_and_emit(0x6FCF1890u, "D2GAME_ITEMS_SnapshotUnitStatsAndSkills113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [134] 0x6FCE2680 ACT2Q8_Callback00_NpcActivate_6FCE2680_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 193u, 1u, 5000u, 5000u, 234u);
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    uint32_t pMsgTbl = U32(STAGE_QUEST0 + 0xDCu);
    U32(pMsgTbl + 0x00u) = 0x17Au; U16(pMsgTbl + 0x04u) = 0x130u; U32(pMsgTbl + 0x08u) = 1u; U32(pMsgTbl + 0xC0u) = 1u;
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 1) set_quest_bit(pFlags, 0x0Eu, 0u);
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x17Au, 194u, 1u, 5002u, 5002u, 334u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a2q8_npc_act_k%d", k);
    run_and_emit(0x6FCE2680u, "ACT2Q8_Callback00_NpcActivate_6FCE2680_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [135] 0x6FCE2250 ACT2Q3_ActiveFilter_6FCE2250_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x0Bu;
    U8(STAGE_QUEST0 + 0x0Cu)  = 1u;
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 0x0Bu, 1u);
    uint32_t npcId = (k == 0) ? 100u : (k == 1 ? 0xB1u : 0xAFu);
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a2q3_filter_k%d", k);
    run_and_emit(0x6FCE2250u, "ACT2Q3_ActiveFilter_6FCE2250_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [136] 0x6FCE4690 ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, k == 2 ? 1u : 0u, 195u, 1u, 5000u, 5000u, 236u);
    stage_quest_node(STAGE_QUEST0, 8u, STAGE_QUESTEX0, 0u);
    uint32_t pMsgTbl = U32(STAGE_QUEST0 + 0xDCu);
    U32(pMsgTbl + 0x00u) = 0xB1u; U16(pMsgTbl + 0x04u) = 0x11Du; U32(pMsgTbl + 0x08u) = 1u; U32(pMsgTbl + 0xC0u) = 1u;
    U32(pMsgTbl + 0xC4u) = 0xB1u; U16(pMsgTbl + 0xC8u) = 0x11Eu; U32(pMsgTbl + 0xCCu) = 1u; U32(pMsgTbl + 0x184u) = 1u;
    uint32_t pIntro = STAGE_SCRATCH + 0x200u;
    U32(pIntro + 0x00u) = pIntro + 0x10u;
    U32(pIntro + 0x10u) = pIntro + 0x20u;
    U32(STAGE_UDATA0 + 0x60u) = pIntro;
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xB1u, 196u, 1u, 5002u, 5002u, 336u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a2intro_npc_dlg_k%d", k);
    run_and_emit(0x6FCE4690u, "ACT2Intro_Callback_NpcActivateDialog_6FCE4690_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [137] 0x6FD04030 ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 197u, 1u, 5000u, 5000u, 237u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 0) set_quest_bit(pFlags, 0x14u, 0u);
    if (k == 2) {
      uint32_t nItm = U32(D2COM_PREF_BASE + 0x9FB94u + g_com_rebase);
      uint32_t pItm = U32(D2COM_PREF_BASE + 0x9FB98u + g_com_rebase);
      uint32_t g34 = g_item_ring;
      for (uint32_t id = 0; id < nItm; id++) {
        if (U32(pItm + id * 0x1A8u + 0x80u) == 0x20343367u) { g34 = id; break; }
      }
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g34, 198u, 0u, 2u, 0u, 0u, 337u);
      U8(STAGE_UDATA1 + 0x45u) = 0u;
      fn_PlaceInGridCell(pInv, (void *)(uintptr_t)STAGE_UNIT1, 0, 0, 16, 0, 0);
    }
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = 0xFEu;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = 0xFE; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a3q1_gbird_filter_k%d", k);
    run_and_emit(0x6FD04030u, "ACT3Q1_GoldenBirdActiveFilter_6FD04030_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [138] 0x6FCED0E0 PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c (eax=pClient, ebx=pPlayerUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_PREF_BASE + 0x102DD0u, 0x20u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 199u, 1u, 5000u, 5000u, 238u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 25, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 60, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 45, 0);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    U8(STAGE_CLIENT + 0x3D4u) = 1u;
    uint32_t pCli = 0u;
    if (k == 1) {
      pCli = STAGE_CLIENT;
    } else if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 200u, 1u, 5002u, 5002u, 338u);
      link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u, 0u);
      U8(STAGE_CLIENT1 + 0x3D4u) = 1u;
      pCli = STAGE_CLIENT1;
    }
    c = make_call(); c.eax = pCli; c.ebx = STAGE_UNIT0;
    ts[0] = pCli; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "plrmodes_sync_base_k%d", k);
    run_and_emit(0x6FCED0E0u, "PLRMODES_SyncBaseStatsToOtherClient_6FCED0E0_113c", k, lbl, &c, ts, 2, 0u, k == 0 ? 1 : 0);
  }

  /* [139] 0x6FD04500 ACT3Q2_GidbinnActiveFilter_6FD04500_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 201u, 1u, 5000u, 5000u, 239u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 0x13u, 6u);
    uint32_t npcId = (k == 0) ? 100u : (k == 1 ? 0xFDu : 0xFCu);
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = npcId; ts[2] = STAGE_UNIT0; ts[3] = pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "a3q2_gidbinn_filter_k%d", k);
    run_and_emit(0x6FD04500u, "ACT3Q2_GidbinnActiveFilter_6FD04500_113c", k, lbl, &c, ts, 5, 0xFFu, 0);
  }

  /* [140] 0x6FD07940 ACT3Q3_OnNpcSpeechComplete_6FD07940_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 202u, 1u, 5000u, 5000u, 240u);
    stage_quest_node(STAGE_QUEST0, 0x12u, STAGE_QUESTEX0, 0u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_SCRATCH + 0x100u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_SCRATCH + 0x14u) = (k == 0) ? 100u : 0xF5u;
    U16(STAGE_SCRATCH + 0x18u) = (k == 1) ? 0x220u : 0x21Fu;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a3q3_speech_done_k%d", k);
    run_and_emit(0x6FD07940u, "ACT3Q3_OnNpcSpeechComplete_6FD07940_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [141] 0x6FCE4780 ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 203u, 1u, 5000u, 5000u, 241u);
    uint32_t pIntro = STAGE_SCRATCH + 0x200u;
    U32(pIntro + 0x00u) = pIntro + 0x10u;
    U32(pIntro + 0x10u) = pIntro + 0x20u;
    U32(STAGE_UDATA0 + 0x60u) = pIntro;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = (k == 0) ? 100u : (k == 1 ? 0xAFu : 0xB1u);
    U16(STAGE_SCRATCH + 0x18u) = (k == 1) ? 0xD7u : 0x11Eu;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a2intro_set_flag_k%d", k);
    run_and_emit(0x6FCE4780u, "ACT2Intro_Callback_ScrollMessageSetNpcIntro_6FCE4780_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [142] 0x6FCCCDA0 ITEMEVENT_ManaAfterKill113c (stdcall 5 args, ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 204u, 1u, 5000u, 5000u, 242u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 205u, 1u, 5002u, 5002u, 342u);
    U32(STAGE_DMG + 0x4Cu) = (k == 1) ? 0u : (100u << 8);
    if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 114, 25, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 100 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 20 << 8, 0);
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t param = 114u << 16;
    c = make_call(); c.nargs = 5;
    c.args[0] = pU; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_DMG; c.args[3] = param; c.args[4] = 0u;
    c.calleePop = 0x14u;
    ts[0] = pU; ts[1] = STAGE_UNIT1; ts[2] = STAGE_DMG; ts[3] = param; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "itemev_dmg_to_mana_k%d", k);
    run_and_emit(0x6FCCCDA0u, "ITEMEVENT_ManaAfterKill113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [143] 0x6FCE4570 ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 206u, 1u, 5000u, 5000u, 243u);
    stage_quest_node(STAGE_QUEST0, 8u, STAGE_QUESTEX0, 0u);
    uint32_t pMsgTbl = U32(STAGE_QUEST0 + 0xDCu);
    U32(pMsgTbl + 0x00u) = 0xC9u; U16(pMsgTbl + 0x04u) = 0xFDu; U32(pMsgTbl + 0x08u) = 1u; U32(pMsgTbl + 0xC0u) = 1u;
    uint32_t pFlags = STAGE_SCRATCH + 0x100u;
    attach_quest_bits(STAGE_UDATA0, 0u, pFlags);
    if (k == 2) set_quest_bit(pFlags, 8u, 0u);
    uint32_t pNpc = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xC9u, 207u, 1u, 5002u, 5002u, 343u);
      pNpc = STAGE_UNIT1;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = pNpc;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "a2q0_warriv_cain_k%d", k);
    run_and_emit(0x6FCE4570u, "ACT2Q0_Callback_NpcActivateWarrivAndCainIntro_6FCE4570_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [144] 0x6FCFB4C0 SUNITDMG_OnFreezeStateExpiredCallback_6FCFB4C0_113c (ecx=pUnit, edx=nState, s0=pList, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (k == 0) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 208u, 1u, 5000u, 5000u, 244u);
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (uint32_t)k, 208u, 1u, 5000u, 5000u, 244u);
    }
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 2, 1);
    if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x6B, 1);
    c = make_call(); c.ecx = STAGE_UNIT0; c.edx = 2u; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = 2; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "sunitdmg_freeze_exp_k%d", k);
    run_and_emit(0x6FCFB4C0u, "SUNITDMG_OnFreezeStateExpiredCallback_6FCFB4C0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [145] 0x6FCD1400 MONAI_IsHostileAttackableTargetFilter_6FCD1400_113c (edi=pOrig, esi=pCand, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 209u, 1u, 5000u, 5000u, 245u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 210u, 1u, 5002u, 5002u, 345u);
    if (k == 2) {
      void *pSub = fn_AllocStatList(NULL, 0x40u, 0u, 1, 209);
      fn_SetStatIfValid(pSub, 0xAC, 2, 0);
      fn_SetStatListState(pSub, 0x69);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 1);
    }
    uint32_t pOrig = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pCand = (k == 2) ? STAGE_UNIT1 : STAGE_UNIT0;
    c = make_call(); c.edi = pOrig; c.esi = pCand; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pOrig; ts[1] = pCand; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "monai_hostile_flt_k%d", k);
    run_and_emit(0x6FCD1400u, "MONAI_IsHostileAttackableTargetFilter_6FCD1400_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [146] 0x6FCF4570 ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c (eax=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 211u, 1u, 5000u, 5000u, 246u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k >= 1) {
      uint32_t cid = (k == 2) ? g_item_tsc : g_item_ring;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 212u, 0u, 2u, 0u, 0u, 346u);
      U8(STAGE_UDATA1 + 0x45u)  = 0u;
      U16(STAGE_UDATA1 + 0x3Eu) = 0u;
      fn_PlaceInGridCell(pInv, (void *)(uintptr_t)STAGE_UNIT1, 0, 0, 16, 0, 0);
      if (k == 2) {
        uint32_t pSk = attach_skill(STAGE_UNIT0, 219, 1);
        fn_SetSkillCharges((void *)(uintptr_t)pSk, 2);
      }
    }
    c = make_call(); c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_recount_scroll_k%d", k);
    run_and_emit(0x6FCF4570u, "ITEMS_ResetAndRecountInventoryScrollAndTomeCharges_6FCF4570_113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [147] 0x6FCF8DE0 ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c (eax=pUnit, s0=skId, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 213u, 1u, 5000u, 5000u, 247u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    if (k >= 1) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, 220, 1);
      fn_SetSkillCharges((void *)(uintptr_t)pSk, k == 1 ? 3 : 1);
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = 220u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = 220;
    snprintf(lbl, sizeof(lbl), "items_dec_scroll_chg_k%d", k);
    run_and_emit(0x6FCF8DE0u, "ITEMS_DecrementScrollOrTomeSkillChargeAndResetRightSkill_6FCF8DE0_113c", k, lbl, &c, ts, 2, 0u, k == 0 ? 1 : 0);
  }

  /* [148] 0x6FCEBC70 PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 214u, 1u, 5000u, 5000u, 248u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    attach_skill(STAGE_UNIT0, 0, 1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x3Bu;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? (16u << 16) : (2u << 16);
    U32(STAGE_SCRATCH + 0x05u) = 0xFFFFFFFFu;
    uint32_t nLen = (k == 0) ? 4u : 9u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = nLen;
    snprintf(lbl, sizeof(lbl), "pkt3c_set_hotkey_k%d", k);
    run_and_emit(0x6FCEBC70u, "PACKET_Srv3C_SetSkillHotkey_6FCEBC70_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [149] 0x6FCECCF0 C2S_ValidateNpcMonsterInteract_6FCECCF0_113c (eax=pGame, ecx=guid, edi=ppOut, s0=pPlr, s1=bDist, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 215u, 1u, 5000u, 5000u, 249u);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 148u, 216u, 1u, 5002u, 5002u, 349u);
      U32(STAGE_UDATA1 + 0x30u) = STAGE_SCRATCH + 0x200u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    U32(STAGE_SCRATCH) = 0xDEADu;
    c = make_call(); c.eax = pG; c.ecx = 216u; c.edi = STAGE_SCRATCH;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = pG; ts[1] = 216; ts[2] = STAGE_SCRATCH; ts[3] = STAGE_UNIT0; ts[4] = 1;
    snprintf(lbl, sizeof(lbl), "c2s_val_npc_mon_k%d", k);
    run_and_emit(0x6FCECCF0u, "C2S_ValidateNpcMonsterInteract_6FCECCF0_113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, k == 0 ? 1 : 0);
  }

  /* [150] 0x6FCCCF10 ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c (s0=pUnit, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 217u, 1u, 5000u, 5000u, 250u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 1u, 0u);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 218u, 0u, 2u, 0u, 0u, 350u);
      U8(STAGE_UDATA1 + 0x45u) = 0u;
      fn_PlaceInGridCell(pInv, (void *)(uintptr_t)STAGE_UNIT1, 0, 0, 16, 0, 0);
      if (k == 2) fn_SetOrClearCmdFlags((void *)(uintptr_t)STAGE_UNIT1, 4u, 1);
    }
    c = make_call(); c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = 0;
    snprintf(lbl, sizeof(lbl), "items_send_cmd4_3f_k%d", k);
    run_and_emit(0x6FCCCF10u, "ITEMS_SendInventoryItemCmdFlag4Updates3F_6FCCCF10_113c", k, lbl, &c, ts, 2, 0u, 0);
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

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE,    DATATBLS_SIZE,    MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pVtbl  = VirtualAlloc((void *)HASH_VTABLE_ADDR, 0x1000u,          MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE,       STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE,        HEAP_SIZE,        MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pVtbl != HASH_VTABLE_ADDR ||
      (uintptr_t)pStage != STAGE_BASE   || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-p3] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
    fflush(stderr);
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
    fprintf(stderr, "[k6-p3] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p3] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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

  fn_CreateStatListEx      = (Com_CreateStatListEx_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11166));
  fn_SetUnitStat           = (Com_SetUnitStat_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10887));
  fn_AllocStatList         = (Com_AllocStatList_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11013));
  fn_SetStatIfValid        = (Com_SetStatIfValid_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10188));
  fn_SetStatListState      = (Com_SetStatListState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10785));
  fn_MergeStatLists        = (Com_MergeStatLists_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10807));
  fn_ToggleGfxState        = (Com_ToggleGfxState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10945));
  fn_AllocSkillList        = (Com_AllocSkillList_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10856));
  fn_SetSkillLevel         = (Com_SetSkillLevel_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10302));
  fn_AllocInventory        = (Com_AllocInventory_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10387));
  fn_PlaceItemInBodyLoc    = (Com_PlaceItemInBodyLoc_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11041));
  fn_SetCursorItem         = (Com_SetCursorItem_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10466));
  fn_PathSetTargetUnit     = (Com_PathSetTargetUnit_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10336));
  fn_AutoPlaceInBelt       = (Com_AutoPlaceInBelt_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10729));
  fn_PlaceInGridCell       = (Com_PlaceInGridCell_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11107));
  fn_AppendItemGuidNode    = (Com_AppendItemGuidNode_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10050));
  fn_SetSkillCharges       = (Com_SetSkillCharges_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10252));
  fn_AutoPlaceIntoBeltSlot = (Com_AutoPlaceIntoBeltSlot_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10655));
  fn_SetOrClearCmdFlags    = (Com_SetOrClearCmdFlags_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10695));

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_PlaceItemInBodyLoc || !fn_SetCursorItem ||
      !fn_PathSetTargetUnit || !fn_AutoPlaceInBelt || !fn_PlaceInGridCell || !fn_AppendItemGuidNode ||
      !fn_SetSkillCharges || !fn_AutoPlaceIntoBeltSlot || !fn_SetOrClearCmdFlags) {
    fprintf(stderr, "[k6-p3] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p3] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_group_1();
  emit_group_2();
  emit_group_3();
  emit_group_4();
  emit_group_5();
  emit_group_6();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p3] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
