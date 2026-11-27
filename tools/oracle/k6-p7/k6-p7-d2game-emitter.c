/*
 * K6-P7 D2Game.dll Band D (0x6FCE0000..0x6FD142D0) Oracle Vector Emitter
 *
 * Emits 150 net-new disassembly-verified Band D D2Game.dll VAs (>= 3 cases each,
 * >= 450 deterministic vectors total) excluding 0x6FCEF0A0 & 0x6FD130C0 and no-ops.
 * Compiled across -O2, -O2 -fno-omit-frame-pointer, -O1 (-m32 -Wall -Wextra -Werror)
 * with register-only / naked asm, running headless under Wine against real v1.13c DLLs.
 *
 * NOTE for tools/oracle/k6/audit-dll-coverage.py:
 *   ONLY target VAs passed to run_and_emit(...) may be written as 0x6F[CD]xxxxx literals
 *   outside comments; all other D2Common / D2Game addresses use D2COM_PREF_BASE / D2GAME_PREF_BASE.
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

#define DATATBLS_BASE    0x20000000u
#define DATATBLS_SIZE    0x00800000u
#define HASH_VTABLE_ADDR 0x28000000u

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
#define STAGE_UNIT0      (STAGE_BASE + 0x3000u) /* 0x0200: primary D2UnitStrc */
#define STAGE_UDATA0     (STAGE_BASE + 0x3200u) /* 0x0200: primary unit data */
#define STAGE_UNIT1      (STAGE_BASE + 0x3400u) /* 0x0200: secondary D2UnitStrc */
#define STAGE_UDATA1     (STAGE_BASE + 0x3600u) /* 0x0200: secondary unit data */
#define STAGE_UNIT2      (STAGE_BASE + 0x3800u) /* 0x0200: tertiary D2UnitStrc */
#define STAGE_UDATA2     (STAGE_BASE + 0x3A00u) /* 0x0200: tertiary unit data */
#define STAGE_PATH0      (STAGE_BASE + 0x4000u) /* 0x0300: path for UNIT0 */
#define STAGE_PATH1      (STAGE_BASE + 0x4300u) /* 0x0300: path for UNIT1 */
#define STAGE_PATH2      (STAGE_BASE + 0x4600u) /* 0x0300: path for UNIT2 */
#define STAGE_SKILL0     (STAGE_BASE + 0x4900u) /* 0x0200: skill #0 */
#define STAGE_SKILL1     (STAGE_BASE + 0x4B00u) /* 0x0200: skill #1 */
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
#define STAGE_QUESTARG   (STAGE_BASE + 0x6600u) /* 0x0100: D2QuestArgStrc */
#define STAGE_QBITS0     (STAGE_BASE + 0x6700u) /* 0x0100: quest bit record + buffer */
#define STAGE_PETCTRL    (STAGE_BASE + 0x6800u) /* 0x0200: pPlayerPets */
#define STAGE_PARTYCTRL  (STAGE_BASE + 0x6A00u) /* 0x0200: pPartyControl */
#define STAGE_NPCCTRL    (STAGE_BASE + 0x6C00u) /* 0x1200: pNpcControl */
#define STAGE_SCRATCH    (STAGE_BASE + 0x8000u) /* 0x1000: out-params / packets / ctx */

#define HEAP_BASE        0x40000000u
#define HEAP_SIZE        0x00400000u

#define MAX_STACK        16
#define MAX_EXTRA_CAPS   32

#define U32(a) (*(volatile uint32_t *)(uintptr_t)(a))
#define U16(a) (*(volatile uint16_t *)(uintptr_t)(a))
#define U8(a)  (*(volatile uint8_t *)(uintptr_t)(a))
#define S32(a) (*(volatile int32_t *)(uintptr_t)(a))
#define S16(a) (*(volatile int16_t *)(uintptr_t)(a))

static HMODULE   g_hGame       = NULL;
static HMODULE   g_hCom        = NULL;
static HMODULE   g_hFog        = NULL;
static HMODULE   g_hNet        = NULL;
static HMODULE   g_hStorm      = NULL;
static intptr_t  g_game_rebase = 0;
static intptr_t  g_com_rebase  = 0;

static FILE     *g_out_fp           = NULL;
static uint32_t  g_setup_top        = STAGE_SETUP_BASE;
static uint32_t  g_heap_top         = HEAP_BASE;
static int       g_in_setup_phase   = 1;
static uint32_t  g_fake_tick_count  = 100000u;
static uint32_t  g_fake_qpc_lo      = 1234567u;
static uint32_t  g_fake_qpc_hi      = 0u;
static int       g_d2net_send_ok    = 1;
static uint32_t  g_d2net_client_key = 0x11223344u;

/* Discovered valid table IDs from sgptDataTables */
static uint32_t g_mon_id_0        = 0u;
static uint32_t g_mon_id_1        = 1u;
static uint32_t g_item_sword      = 0u;
static uint32_t g_item_shield     = 0u;
static uint32_t g_item_armor      = 0u;
static uint32_t g_item_bow        = 0u;
static uint32_t g_item_ring       = 0u;
static uint32_t g_item_pot        = 0u;
static uint32_t g_item_scroll     = 0u;
static uint32_t g_item_tome       = 0u;
static uint32_t g_item_gem        = 0u;
static uint32_t g_item_key        = 0u;
static uint32_t g_item_gold       = 0u;
static uint32_t g_item_box        = 0u;
static uint32_t g_item_tknife     = 0u;
static uint32_t g_item_claw       = 0u;
static uint32_t g_obj_shrine_id   = 2u;
static uint32_t g_obj_portal_id   = 59u;

typedef struct {
  uint32_t dwCode;
  int32_t  nRow;
} TxtLinkNode;

typedef struct {
  int32_t      nRecords;
  uint32_t     dwPad;
  TxtLinkNode *pNodes;
} ItemsTxtLinker;

static TxtLinkNode    g_items_txtlink_nodes[1024];
static ItemsTxtLinker g_items_txtlink;

/* D2Common exports used ONLY in test case staging */
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
typedef int32_t(__stdcall *Com_GetItemType_t)(void *pItem);
typedef int32_t(__stdcall *Com_AutoPlaceInBelt_t)(void *pInv, void *pItem);
typedef int32_t(__stdcall *Com_PlaceInGridCell_t)(void *pInv, void *pItem, int32_t x, int32_t y, int32_t invRecId, int32_t u6, int32_t page);

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
static Com_GetItemType_t        fn_GetItemType        = NULL;
static Com_AutoPlaceInBelt_t    fn_AutoPlaceInBelt    = NULL;
static Com_PlaceInGridCell_t    fn_PlaceInGridCell    = NULL;

/* ------------------------------- Generic Register+Stack Thunk & VEH */

uint32_t g_thunk_target     = 0;
uint32_t g_thunk_nargs      = 0;
uint32_t g_thunk_args[MAX_STACK];
uint32_t g_thunk_in_eax     = 0;
uint32_t g_thunk_in_ecx     = 0;
uint32_t g_thunk_in_edx     = 0;
uint32_t g_thunk_in_ebx     = 0;
uint32_t g_thunk_in_esi     = 0;
uint32_t g_thunk_in_edi     = 0;

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
    fprintf(stderr, "[k6-p7] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
      fprintf(stderr, "[k6-p7] missing Fog.#%u\n", fogHooks[i].ord);
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
    fprintf(stderr, "[k6-p7] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p7] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_VA(0x99000u) + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p7] short read at page %u\n", i);
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

/* ------------------------------- Staged Arena Memory Serializer */

typedef struct {
  uint32_t addr;
  uint32_t len;
} ExtraCap;

static ExtraCap g_extra_caps[MAX_EXTRA_CAPS];
static uint32_t g_extra_cap_count = 0;

static void add_extra_cap(uint32_t canonAddr, uint32_t len) {
  if (len == 0u) return;
  for (uint32_t i = 0u; i < g_extra_cap_count; i++) {
    if (g_extra_caps[i].addr == canonAddr) {
      if (len > g_extra_caps[i].len) g_extra_caps[i].len = len;
      return;
    }
  }
  if (g_extra_cap_count >= MAX_EXTRA_CAPS) {
    fprintf(stderr, "[k6-p7] extra_caps overflow\n");
    TerminateProcess(GetCurrentProcess(), 22);
  }
  g_extra_caps[g_extra_cap_count].addr = canonAddr;
  g_extra_caps[g_extra_cap_count].len  = len;
  g_extra_cap_count++;
}

static uint32_t canon_to_live_addr(uint32_t canonAddr) {
  if (g_game_rebase != 0 &&
      canonAddr >= D2GAME_PREF_BASE &&
      canonAddr < D2GAME_PREF_BASE + 0x130000u) {
    return canonAddr + (uint32_t)g_game_rebase;
  }
  return canonAddr;
}

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
        fprintf(stderr, "[k6-p7] mem json buffer overflow\n");
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
static char g_post_json[524288];
static char g_heap_hex[1048576];

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
    uint32_t canon = g_extra_caps[i].addr;
    uint32_t live  = canon_to_live_addr(canon);
    uint32_t delta = live - canon;
    format_mem_runs_range(out, cap, &len, live, live + g_extra_caps[i].len, &first, delta);
  }
  if (len + 2 >= cap) {
    fprintf(stderr, "[k6-p7] mem json cap overflow\n");
    TerminateProcess(GetCurrentProcess(), 25);
  }
  out[len++] = ']';
  out[len]   = '\0';
}

/* ------------------------------- Reset & Runner */

typedef struct {
  uint32_t eax, ecx, edx, ebx, esi, edi;
  uint32_t nargs;
  uint32_t args[MAX_STACK];
  uint32_t calleePop;
} CallSpec;

static CallSpec make_call(void) {
  CallSpec c;
  memset(&c, 0, sizeof(c));
  return c;
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
  g_d2net_send_ok   = 1;
  g_d2net_client_key = 0x11223344u;

  U32(STAGE_GAME + 0x18u)    = STAGE_CS_GAME;
  U8(STAGE_GAME + 0x6Du)     = 0u;
  U32(STAGE_GAME + 0x70u)    = 1u;
  U32(STAGE_GAME + 0xA8u)    = 100u;
  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
  U32(STAGE_CLIENT + 0x1A8u)   = STAGE_GAME;

  /* Zero mutable D2Game .data globals touched across functions */
  U32(game_global_live(D2GAME_VA(0x111C1Cu))) = 0u;
  U32(game_global_live(D2GAME_VA(0x111C20u))) = 0u;
  U32(game_global_live(D2GAME_VA(0x111F90u))) = 0u;
  U32(game_global_live(D2GAME_VA(0x111F98u))) = 0u;
  U32(game_global_live(D2GAME_VA(0x111C50u))) = 0u;
  U32(game_global_live(D2GAME_VA(0x1101E0u))) = 0u;
  U32(game_global_live(D2GAME_VA(0x1101E4u))) = 0u;
  U32(game_global_live(D2GAME_VA(0x111F74u))) = 0u;
  U32(game_global_live(D2GAME_VA(0x111F78u))) = 0u;
}

static void run_and_emit(
    uint32_t canonVa, const char *name, int caseIdx, const char *label,
    const CallSpec *c, const int64_t *tsArgs, uint32_t nTsArgs,
    uint32_t retMask, int expectAssert) {
  static const char hexChars[] = "0123456789abcdef";
  uint32_t setupTop = (g_setup_top + 15u) & ~15u;
  capture_stage_json(g_pre_json, sizeof(g_pre_json), setupTop);

  g_thunk_target  = canonVa + (uint32_t)g_game_rebase;
  g_thunk_nargs   = c->nargs;
  for (uint32_t i = 0; i < c->nargs && i < MAX_STACK; i++) {
    g_thunk_args[i] = c->args[i];
  }
  g_thunk_in_eax  = c->eax;
  g_thunk_in_ecx  = c->ecx;
  g_thunk_in_edx  = c->edx;
  g_thunk_in_ebx  = c->ebx;
  g_thunk_in_esi  = c->esi;
  g_thunk_in_edi  = c->edi;
  g_thunk_out_eax = 0u;
  g_thunk_faulted = 0;
  g_fault_code    = 0u;
  g_fault_eip     = 0u;
  g_fault_addr    = 0u;
  g_assert_line   = 0u;
  g_assert_a2     = 0u;

  g_in_setup_phase = 0;
  g_thunk_in_call  = 1;
  thunk_invoke();
  g_thunk_in_call  = 0;
  g_in_setup_phase = 1;

  if (g_thunk_faulted == 1) {
    fprintf(stderr,
            "[k6-p7] UNEXPECTED FAULT %s case %d (%s) code=0x%08X eip=0x%08X addr=0x%08X\n",
            name, caseIdx, label, g_fault_code, g_fault_eip, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }
  int asserted = (g_thunk_faulted == 2);
  if (asserted != (expectAssert != 0)) {
    fprintf(stderr,
            "[k6-p7] ASSERT MISMATCH %s (0x%08X) case %d (%s): expected=%d got=%d (line=0x%X)\n",
            name, canonVa, caseIdx, label, expectAssert, asserted, g_assert_line);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!asserted) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != c->calleePop) {
      fprintf(stderr,
              "[k6-p7] ESP POP MISMATCH %s (0x%08X) case %d (%s): expected=%u actual=%u\n",
              name, canonVa, caseIdx, label, c->calleePop, actualPop);
      TerminateProcess(GetCurrentProcess(), 32);
    }
  }

  capture_stage_json(g_post_json, sizeof(g_post_json), setupTop);

  size_t hlen = 0;
  for (uint32_t p = HEAP_BASE; p < g_heap_top; p++) {
    uint8_t b = read_canon_byte(p, HEAP_BASE, g_heap_top);
    if (hlen + 3 >= sizeof(g_heap_hex)) {
      fprintf(stderr, "[k6-p7] heapHex overflow\n");
      TerminateProcess(GetCurrentProcess(), 26);
    }
    g_heap_hex[hlen++] = hexChars[(b >> 4) & 0xFu];
    g_heap_hex[hlen++] = hexChars[b & 0xFu];
  }
  g_heap_hex[hlen] = '\0';

  uint32_t retVal = asserted ? 0u : (g_thunk_out_eax & retMask);

  fprintf(g_out_fp, "{\"va\":\"0x%08X\",\"name\":\"%s\",\"caseIdx\":%d,\"label\":\"%s\",\"tsArgs\":[",
          canonVa, name, caseIdx, label);
  for (uint32_t i = 0; i < nTsArgs; i++) {
    fprintf(g_out_fp, "%s%lld", (i ? "," : ""), (long long)tsArgs[i]);
  }
  fprintf(g_out_fp, "],\"extraCaps\":[");
  for (uint32_t i = 0; i < g_extra_cap_count; i++) {
    fprintf(g_out_fp, "%s{\"addr\":\"0x%08X\",\"len\":%u}",
            (i ? "," : ""), g_extra_caps[i].addr, g_extra_caps[i].len);
  }
  fprintf(g_out_fp,
          "],\"retMask\":\"0x%08X\",\"asserted\":%s,\"assertLine\":%u,\"ret\":\"0x%08X\","
          "\"setupTop\":\"0x%08X\",\"preMem\":%s,\"postMem\":%s,\"heapTop\":\"0x%08X\",\"heapHex\":\"%s\"}\n",
          retMask, asserted ? "true" : "false", g_assert_line, retVal,
          setupTop, g_pre_json, g_post_json, g_heap_top, g_heap_hex);
  g_total_emitted++;
}

/* ------------------------------- Startup Discovery & Staged Builders */

static void discover_table_ids(void) {
  reset_case();
  uint32_t nItems   = U32(D2COM_VA(0x9FB94u) + g_com_rebase);
  uint32_t pItems   = U32(D2COM_VA(0x9FB98u) + g_com_rebase);
  uint32_t nObjects = U32(D2COM_VA(0xA0B98u) + g_com_rebase);
  uint32_t pObjects = U32(D2COM_VA(0xA0B94u) + g_com_rebase);
  int32_t  nLink    = 0;

  for (uint32_t id = 0; id < nItems; id++) {
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    if (!g_item_sword  && code == 0x20647373u) g_item_sword  = id; /* 'ssd ' */
    if (!g_item_shield && code == 0x206C6D73u) g_item_shield = id; /* 'sml ' */
    if (!g_item_bow    && code == 0x20776273u) g_item_bow    = id; /* 'sbw ' */
    if (!g_item_ring   && code == 0x206E6972u) g_item_ring   = id; /* 'rin ' */
    if (!g_item_armor  && code == 0x20697571u) g_item_armor  = id; /* 'qui ' */
    if (!g_item_pot    && code == 0x20317068u) g_item_pot    = id; /* 'hp1 ' */
    if (!g_item_scroll && code == 0x20637374u) g_item_scroll = id; /* 'tsc ' */
    if (!g_item_tome   && code == 0x206B6274u) g_item_tome   = id; /* 'tbk ' */
    if (!g_item_key    && code == 0x2079656Bu) g_item_key    = id; /* 'key ' */
    if (!g_item_gem    && code == 0x20766367u) g_item_gem    = id; /* 'gcv ' */
    if (!g_item_gold   && code == 0x20646C67u) g_item_gold   = id; /* 'gld ' */
    if (!g_item_box    && code == 0x20786F62u) g_item_box    = id; /* 'box ' */
    if (!g_item_tknife && code == 0x20666B74u) g_item_tknife = id; /* 'tkf ' */
    if (!g_item_claw   && code == 0x2072746Bu) g_item_claw   = id; /* 'ktr ' */
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
  U32(D2COM_VA(0x9FF6Cu) + g_com_rebase) = (uint32_t)(uintptr_t)&g_items_txtlink;

  if (nObjects > 59u && pObjects != 0u) {
    g_obj_shrine_id = 2u;
    g_obj_portal_id = 59u;
  }
  g_mon_id_0 = 0u;
  g_mon_id_1 = 1u;
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
  U32(pAct + 0x08u)         = 1u;
  U32(pAct + 0x10u)         = pRoom;
  U32(pAct + 0x48u)         = STAGE_DRLG0;
  U32(STAGE_DRLG0 + 0x47Cu) = pLevel;
  if (U32(STAGE_GAME + 0xBCu) == 0u) {
    U32(STAGE_GAME + 0xBCu) = pAct;
  }
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

static void link_player_client(uint32_t pPlayer, uint32_t pClient) {
  U32(pClient + 0x174u) = pPlayer;
  U32(pClient + 0x1A8u) = STAGE_GAME;
  U32(pClient + 0x04u)  = 4u;
  if (U32(STAGE_GAME + 0x88u) == 0u) {
    U32(STAGE_GAME + 0x88u) = pClient;
  }
  uint32_t pUData = U32(pPlayer + 0x14u);
  if (pUData != 0u) {
    U32(pUData + 0x9Cu) = pClient;
  }
  if (U32(pPlayer + 0x0Cu) != 0u) {
    U32(pClient + 0x170u) = U32(pPlayer + 0x0Cu);
    U32(pClient + 0x16Cu) = U32(pPlayer + 0x00u);
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
      U32(pUData + 0x1Cu + d * 4u) = pPair;
    }
    U32(pUData + 0x9Cu) = pClient;
  }
  if (pClient != 0u) {
    link_player_client(pUnit, pClient);
  }
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 12, 10, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 6, 200 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 7, 200 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 8, 100 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 9, 100 << 8, 0);
}

static void stage_monster_full(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint32_t mode,
    uint16_t x, uint16_t y) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 1u, classId, guid, mode, x, y, 0x24681357u);
  if (pUData != 0u) {
    uint32_t pMonStats = U32(D2COM_VA(0xA0950u) + g_com_rebase);
    if (pMonStats != 0u) {
      U32(pUData + 0x00u) = pMonStats + classId * 0x1A8u;
    }
    uint32_t pAiGen  = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    uint32_t pAiCtrl = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    U32(pUData + 0x28u) = pAiGen;
    U32(pUData + 0x2Cu) = pAiCtrl;
  }
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 12, 10, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 6, 100 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 7, 100 << 8, 0);
}

static void stage_item_unit(
    uint32_t pItem, uint32_t pIData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint32_t mode, uint32_t qual, uint32_t flags) {
  stage_unit_common(pItem, pIData, pPath, pRoom, 4u, classId, guid, mode, 5000u, 5000u, 0x99887766u);
  if (pIData != 0u) {
    U32(pIData + 0x00u) = qual;
    U32(pIData + 0x0Cu) = 0x12345678u;
    U32(pIData + 0x14u) = flags;
    U32(pIData + 0x2Cu) = 10u;
    U16(pIData + 0x30u) = 101u;
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

static void attach_inv_item_raw(
    uint32_t pUnit, uint32_t pItem, uint8_t invPage, uint8_t bodyLoc, uint8_t nodePosOther) {
  uint32_t pInv = U32(pUnit + 0x60u);
  if (pInv == 0u) {
    pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)pUnit);
    U32(pUnit + 0x60u) = pInv;
  }
  uint32_t pItemData = U32(pItem + 0x14u);
  uint32_t oldFirst  = U32(pInv + 0x0Cu);
  U8(pItemData + 0x45u)  = invPage;
  U8(pItemData + 0x44u)  = bodyLoc;
  U32(pItemData + 0x5Cu) = pInv;
  U32(pItemData + 0x60u) = 0u;
  U32(pItemData + 0x64u) = oldFirst;
  U8(pItemData + 0x69u)  = nodePosOther;
  if (oldFirst != 0u) {
    U32(U32(oldFirst + 0x14u) + 0x60u) = pItem;
  } else {
    U32(pInv + 0x10u) = pItem;
  }
  U32(pInv + 0x0Cu) = pItem;
  U32(pInv + 0x28u) = U32(pInv + 0x28u) + 1u;
}

static void place_body_item(uint32_t pUnit, uint32_t pItem, int32_t bodyLoc) {
  uint32_t pInv = U32(pUnit + 0x60u);
  if (pInv == 0u) {
    pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)pUnit);
    U32(pUnit + 0x60u) = pInv;
  }
  fn_PlaceItemInBodyLoc((void *)(uintptr_t)pInv, (void *)(uintptr_t)pItem, bodyLoc);
}

static uint32_t stage_timer_queue(void) {
  uint32_t pTimer = (uint32_t)(uintptr_t)bump_alloc(0xA20u);
  uint32_t pChunk = (uint32_t)(uintptr_t)bump_alloc(0x7088u);
  for (uint32_t i = 0u; i < 7u; i++) {
    U32(pChunk + i * 0x30u + 0x1Cu) = pChunk + (i + 1u) * 0x30u;
  }
  U32(pChunk + 0x7080u)   = pChunk;
  U32(pTimer + 0xA1Cu)    = pChunk;
  U32(STAGE_GAME + 0xB8u) = pTimer;
  return pTimer;
}

static uint32_t stage_extra_client(void) {
  uint32_t pCli = (uint32_t)(uintptr_t)bump_alloc(0x600u);
  uint32_t pN0  = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  uint32_t pN1  = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  U32(pN0 + 0x204u)  = pN1;
  U32(pCli + 0x1C0u) = pN0;
  U32(pCli + 0x1A8u) = STAGE_GAME;
  return pCli;
}

static void stage_mon_reg(uint32_t levelId) {
  uint32_t pMonReg = (uint32_t)(uintptr_t)bump_alloc(0x2E0u);
  U32(STAGE_GAME + 0xF0u + levelId * 4u) = pMonReg;
  U32(STAGE_GAME + 0x10DCu)               = pMonReg;
}

static uint32_t stage_quest_node(uint32_t qId, uint32_t pExSize) {
  uint32_t pEx = pExSize ? (uint32_t)(uintptr_t)bump_alloc(pExSize) : STAGE_QUESTEX0;
  U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
  U32(STAGE_QUESTCTRL + 0x08u) = 1u;
  U32(STAGE_QUESTCTRL + 0x0Cu) = alloc_quest_record();
  U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
  U32(STAGE_QUEST0 + 0x00u)    = qId;
  U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
  U32(STAGE_QUEST0 + 0x18u)    = pEx;
  return STAGE_QUEST0;
}

static void stage_party_ctrl(void) {
  uint32_t pList = (uint32_t)(uintptr_t)bump_alloc(64u * 0x44u);
  U32(pList + 0x00u)           = 0xFDu;
  U32(pList + 0x44u)           = 0xC9u;
  U32(STAGE_PARTYCTRL + 0x04u) = pList;
  U32(STAGE_GAME + 0x1D24u)    = STAGE_PARTYCTRL;
}

static void set_quest_bit(uint32_t pRec, uint32_t qId, uint32_t bit) {
  uint32_t pBuf = pRec ? U32(pRec + 0x00u) : 0u;
  if (pBuf == 0u) return;
  uint32_t idx = (qId << 4) + bit;
  U32(pBuf + (idx >> 5) * 4u) |= (1u << (idx & 31u));
}

/* ------------------------------- Group 1 (VAs 1..25) */

static void emit_group_1(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* 1. 0x6FCEB570 D2GAME_PLRMODES_SendClientWhisperAdapter113c (ecx=pClient, edx=pTargetClient) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t pTgt = stage_extra_client();
    U32(pTgt + 0x00u) = (k == 2) ? 1u : 0u;
    snprintf((char *)(uintptr_t)(pTgt + 0x08u), 16, "%s", (k == 2) ? "HeroTwo" : "HeroOne");
    snprintf((char *)(uintptr_t)(pTgt + 0x18u), 16, "%s", (k == 2) ? "HelloB"  : "HelloA");
    c = make_call(); c.ecx = pCli; c.edx = pTgt; c.calleePop = 0u;
    ts[0] = (int64_t)pCli; ts[1] = (int64_t)pTgt;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEB570u, "D2GAME_PLRMODES_SendClientWhisperAdapter113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 2. 0x6FCEE120 C2S_RunToTargetAndSetQueuedSkill113c (eax=pGame, ecx=pPlayer, ebx=effType, esi=effId, stack=[nSkillId], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0xFA3FCu), 20u * 8u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4820u, 4820u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t effType = 1u;
    uint32_t effId   = (k == 0) ? 0x9999u : 0x202u;
    uint32_t skId    = (k == 2) ? 36u : 0u;
    c = make_call(); c.eax = STAGE_GAME; c.ecx = STAGE_UNIT0;
    c.ebx = effType; c.esi = effId; c.nargs = 1u; c.args[0] = skId; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = 0;
    ts[3] = (int64_t)effType; ts[4] = (int64_t)effId; ts[5] = (int64_t)skId;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEE120u, "C2S_RunToTargetAndSetQueuedSkill113c", k, lbl, &c, ts, 6u, 0x00000000u, 0);
  }

  /* 3. 0x6FCFFA60 SUNITDMG_GetPlayerClientClassId113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pUnit = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x301u, 1u, 4810u, 4810u);
    } else if (k == 2) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      U32(STAGE_GAME + 0x1D2Cu) = STAGE_PARTYCTRL;
      uint32_t pSub = STAGE_PARTYCTRL + 0x20u;
      uint32_t pMem = STAGE_PARTYCTRL + 0x40u;
      U32(STAGE_PARTYCTRL + 0x04u) = pSub;
      U16(pSub + 0x00u) = 9u;
      U32(pSub + 0x04u) = pMem;
      U32(pMem + 0x00u) = 0x101u;
    }
    c = make_call(); c.eax = pUnit; c.calleePop = 0u;
    ts[0] = (int64_t)pUnit;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFFA60u, "SUNITDMG_GetPlayerClientClassId113c", k, lbl, &c, ts, 1u, 0x0000FFFFu, 0);
  }

  /* 4. 0x6FCE00C0 NPCS_HandleNpcMenuRequest_6FCE00C0_113c (ecx=pPlayer, stack=[pGame, nMenuOption, dwNpcGuid, dwItemGuid], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x94u, 0x201u, 1u, 4812u, 4812u);
    uint32_t pInteract = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    U32(pInteract + 0x04u) = 1u;
    U32(STAGE_UDATA1 + 0x30u) = pInteract;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t npcGuid = (k == 0) ? 0x9999u : 0x201u;
    uint32_t menuOpt = (k == 1) ? 2u : 5u;
    if (k == 2) {
      stage_quest_node(0x29u, 0x20u);
      U8(STAGE_UDATA1 + 0x04u) = 0xFFu;
      U32(STAGE_UNIT1 + 0x04u) = 0x9Au;
    }
    c = make_call(); c.ecx = STAGE_UNIT0;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = menuOpt; c.args[2] = npcGuid; c.args[3] = 0u; c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)menuOpt;
    ts[3] = (int64_t)npcGuid; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE00C0u, "NPCS_HandleNpcMenuRequest_6FCE00C0_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 5. 0x6FD13000 AI_ApproachTargetPathType13_6FD13000_113c (edx=pUnit, ecx=pTarget, stack=[pGame, dwFlags], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4820u, 4820u, STAGE_CLIENT);
    uint32_t pTgt = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t flg  = (k == 2) ? 1u : 0u;
    c = make_call(); c.edx = STAGE_UNIT0; c.ecx = pTgt;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = flg; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)pTgt; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)flg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD13000u, "AI_ApproachTargetPathType13_6FD13000_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 6. 0x6FD000C0 SUNIT_InitExtraItemSeed113c (eax=pGameSeed, edi=pItem) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 0x401u, 3u, 2u, 0u);
    U32(STAGE_SCRATCH + 0x00u) = 0x11223344u + (uint32_t)k * 0x1020304u;
    U32(STAGE_SCRATCH + 0x04u) = 0x0000029Au + (uint32_t)k;
    c = make_call(); c.eax = STAGE_SCRATCH; c.edi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_SCRATCH; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD000C0u, "SUNIT_InitExtraItemSeed113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 7. 0x6FCEE040 C2S_Packet03_RunToLocation113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    U8(STAGE_SCRATCH + 0u) = 0x03u;
    U16(STAGE_SCRATCH + 1u) = (uint16_t)(4814u + k * 4);
    U16(STAGE_SCRATCH + 3u) = (uint16_t)(4814u + k * 4);
    uint32_t len = (k == 0) ? 3u : 5u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEE040u, "C2S_Packet03_RunToLocation113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 8. 0x6FCEE0D0 C2S_Packet01_WalkToLocation113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    U8(STAGE_SCRATCH + 0u) = 0x01u;
    U16(STAGE_SCRATCH + 1u) = (uint16_t)(4812u + k * 5);
    U16(STAGE_SCRATCH + 3u) = (int16_t)(4812u + k * 5);
    uint32_t len = (k == 0) ? 2u : 5u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEE0D0u, "C2S_Packet01_WalkToLocation113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 9. 0x6FCFAA90 SUNITDMG_FindCombatDamageData113c (esi=pAttacker, edx=pDefender) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4815u, 4815u);
    uint32_t pAtt = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 2) {
      uint32_t pC0 = (uint32_t)(uintptr_t)bump_alloc(0x88u);
      uint32_t pC1 = (uint32_t)(uintptr_t)bump_alloc(0x88u);
      U32(pC0 + 0x04u) = 0u; U32(pC0 + 0x08u) = 0x101u;
      U32(pC0 + 0x0Cu) = 1u; U32(pC0 + 0x10u) = 0x999u; /* mismatch */
      U32(pC0 + 0x84u) = pC1;
      U32(pC1 + 0x04u) = 0u; U32(pC1 + 0x08u) = 0x101u;
      U32(pC1 + 0x0Cu) = 1u; U32(pC1 + 0x10u) = 0x202u; /* match */
      U32(STAGE_UNIT0 + 0xACu) = pC0;
    }
    c = make_call(); c.esi = pAtt; c.edx = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = (int64_t)pAtt; ts[1] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFAA90u, "SUNITDMG_FindCombatDamageData113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 10. 0x6FCFAA40 SUNITDMG_ApplyLevelDiffExpRatio_6FCFAA40_113c (edx=baseExp, eax=clvl, ecx=mlvl) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0xFA01Cu), 11u * 4u);
    add_extra_cap(D2GAME_VA(0xFA048u), 11u * 4u);
    static const uint32_t kBase[4] = { 1000u, 1000u, 1000u, 2000u };
    static const uint32_t kClvl[4] = { 10u, 10u, 30u, 12u };
    static const uint32_t kMlvl[4] = { 10u, 18u, 45u, 2u };
    c = make_call(); c.edx = kBase[k]; c.eax = kClvl[k]; c.ecx = kMlvl[k]; c.calleePop = 0u;
    ts[0] = (int64_t)kBase[k]; ts[1] = (int64_t)kClvl[k]; ts[2] = (int64_t)kMlvl[k];
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFAA40u, "SUNITDMG_ApplyLevelDiffExpRatio_6FCFAA40_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 11. 0x6FCE1510 D2Game_6FCE1510_113c (stack=[pGame, pPlayer, pNpc, wHireId], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_party_ctrl();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0E, 100u + (uint32_t)k * 250u, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0C, (k == 2) ? 5u : 20u, 0);
    uint32_t npcCid = (k == 1) ? 0x203u : 0x96u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCid, 0x201u, 1u, 4812u, 4812u);
    uint32_t pNpc = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call();
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = pNpc; c.args[3] = 1u; c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)pNpc; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE1510u, "D2Game_6FCE1510_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 12. 0x6FCEBDB0 D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c (eax=pClient, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    if (k == 1) {
      memset((void *)(uintptr_t)(STAGE_CLIENT + 0x08u), 'A', 16u);
    } else {
      snprintf((char *)(uintptr_t)(STAGE_CLIENT + 0x08u), 16, "%s", (k == 2) ? "Beta" : "Alpha");
    }
    uint32_t pCli2 = stage_extra_client();
    U32(pCli2 + 0x04u) = (k == 2) ? 1u : 4u;
    U32(STAGE_CLIENT + 0x4A8u) = pCli2;
    c = make_call(); c.eax = STAGE_CLIENT; c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_CLIENT; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEBDB0u, "D2GAME_PLRMODES_BroadcastPlayerJoinNotification113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 13. 0x6FCE1890 NPCTRADE_InteractRepairItem_6FCE1890_113c (eax=pGame, esi=pPlayer, ebx=dwNpcGuid, stack=[dwItemGuidOrAll], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_party_ctrl();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0E, 100u + (uint32_t)k * 123u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x203u, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t npcGuid = (k == 1) ? 0x9999u : 0x201u;
    if (k == 3) {
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x64u) = 0x201u;
      U32(STAGE_UNIT0 + 0x68u) = 1u;
    }
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    c = make_call(); c.eax = pG; c.esi = STAGE_UNIT0; c.ebx = npcGuid;
    c.nargs = 1u; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = (int64_t)pG; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)npcGuid; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE1890u, "NPCTRADE_InteractRepairItem_6FCE1890_113c", k, lbl, &c, ts, 4u, 0x00000000u, (k == 0));
  }

  /* 14. 0x6FCE6B30 ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c (ecx=pQuest, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x111C20u), 4u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xB1u, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x0Bu, 0x20u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x0Bu;
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 1) {
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      U8(STAGE_QUEST0 + 0x0Bu) = 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    } else if (k == 2) {
      set_quest_bit(pFlags, 0x0Bu, 1u);
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = 0xB1u;
    U16(STAGE_QUESTARG + 0x18u) = (k == 0) ? 0x100u : ((k == 1) ? 0x15Cu : 0x16Au);
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE6B30u, "ACT2Q3_Callback01_NpcDeactivate_6FCE6B30_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 15. 0x6FCEB8F0 D2GAME_PLRMODES_DispatchModeSyncToClient113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x102CE0u), 22u * 12u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    static const uint32_t kModes[3] = { 1u, 5u, 21u };
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, kModes[k], 4810u, 4810u, STAGE_CLIENT);
    c = make_call(); c.ebx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_CLIENT; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEB8F0u, "D2GAME_PLRMODES_DispatchModeSyncToClient113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }
}

static void emit_group_1_part2(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* 16. 0x6FCE6E90 ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c (ecx=pQuest, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x111C20u), 4u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xB0u, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x09u, 0x20u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x09u;
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 2) {
      set_quest_bit(pFlags, 0x09u, 1u);
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_QUESTARG + 0x14u) = (k == 0) ? 0xB1u : 0xB0u;
    U16(STAGE_QUESTARG + 0x18u) = (k == 1) ? 0x130u : 0x14Eu;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE6E90u, "ACT2Q1_Callback01_NpcDeactivate_6FCE6E90_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 17. 0x6FCE8050 ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c (ecx=pQuest, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x111C20u), 4u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xFBu, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x0Eu, 0x40u);
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 1) set_quest_bit(pFlags, 0x0Eu, 3u);
    else if (k == 2) set_quest_bit(pFlags, 0x0Eu, 4u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_QUESTARG + 0x14u) = (k == 0) ? 0xFBu : ((k == 1) ? 0xC9u : 0xD2u);
    U16(STAGE_QUESTARG + 0x18u) = (k == 0) ? 0x1BCu : ((k == 1) ? 0x1BAu : 0x1C2u);
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE8050u, "ACT2Q6_OnNpcSpeechComplete_6FCE8050_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 18. 0x6FCE8CD0 A5Q3_SpawnRedPortalObject13E_6FCE8CD0_113c (eax=pUnit, stack=[pQuestArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    U32(STAGE_GAME + 0xD0u) = 0x13572469u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_quest_node(0x27u, 0x50u);
    if (k == 0) {
      U8(STAGE_QUESTEX0 + 0x0Eu) = 1u;
    } else if (k == 1) {
      U8(STAGE_QUESTEX0 + 0x11u) = 1u;
    }
    U32(STAGE_QUESTARG + 0x04u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x18u) = STAGE_QUESTEX0;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_QUESTARG; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE8CD0u, "A5Q3_SpawnRedPortalObject13E_6FCE8CD0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 19. 0x6FCEE9D0 C2S_Packet06_LeftSkillOnUnit113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    if (k == 2) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, 0, 1);
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x08u) = pSk;
    }
    U8(STAGE_SCRATCH + 0u) = 0x06u;
    U32(STAGE_SCRATCH + 1u) = 1u;
    U32(STAGE_SCRATCH + 5u) = 0x202u;
    uint32_t len = (k == 0) ? 4u : 9u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEE9D0u, "C2S_Packet06_LeftSkillOnUnit113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 20. 0x6FCEC550 C2S_Dispatch113c (ebx=pPacket, esi=pPlayer, stack=[pGame, nLen], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    U8(STAGE_SCRATCH + 0u) = (k == 0) ? 0x2Bu : ((k == 1) ? 0x41u : ((k == 2) ? 0x67u : 0x13u));
    if (k == 3) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1);
    c = make_call(); c.ebx = STAGE_SCRATCH; c.esi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEC550u, "C2S_Dispatch113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 21. 0x6FCEC2F0 D2GAME_PLRMODES_SendStatToClientOrParty113c (ecx=pSrc, edx=nStatId, stack=[pDestPlr, nStatVal], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4815u, 4815u);
    uint32_t pSrc = (k == 0) ? STAGE_UNIT0 : (k == 1 ? STAGE_UNIT1 : 0u);
    uint32_t val  = 0x1234u + (uint32_t)k * 0x111u;
    c = make_call(); c.ecx = pSrc; c.edx = 6u + (uint32_t)k;
    c.nargs = 2u; c.args[0] = val; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)pSrc; ts[1] = (int64_t)(6u + (uint32_t)k); ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)val;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEC2F0u, "D2GAME_PLRMODES_SendStatToClientOrParty113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 22. 0x6FCF2C70 ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c (eax=pUnit, esi=pItem, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 0u, 2u, 0u);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) {
      fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    }
    uint32_t pIt = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call(); c.eax = STAGE_UNIT0; c.esi = pIt;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)pIt; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF2C70u, "ITEMS_DestroyCursorItemAndNotify_6FCF2C70_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 23. 0x6FCEF380 C2S_Packet_DropCursorItem_6FCEF380_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 4u, 2u, 0u);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0u) = 0x17u;
    U32(STAGE_SCRATCH + 1u) = (k == 1) ? 0x999u : 0x401u;
    uint32_t len = (k == 0) ? 3u : 5u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEF380u, "C2S_Packet_DropCursorItem_6FCEF380_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 24. 0x6FCF1ED0 D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c (esi=pUnit, edi=pSnapshot) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    attach_skill(STAGE_UNIT0, 0, 1);
    attach_skill(STAGE_UNIT0, 36, 3);
    attach_skill(STAGE_UNIT0, 38, 3);
    if (k == 1) {
      U32(STAGE_SCRATCH + 0x10u) = 36u;
      U32(STAGE_SCRATCH + 0x18u) = 0xFFFFFFFFu;
    } else if (k == 2) {
      U32(STAGE_SCRATCH + 0x0Cu) = 38u;
      U32(STAGE_SCRATCH + 0x14u) = 0xFFFFFFFFu;
    }
    c = make_call(); c.esi = STAGE_UNIT0; c.edi = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF1ED0u, "D2GAME_ITEMS_RestoreUnitSkillsFromSnapshot113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 25. 0x6FCF2CF0 ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c (eax=pGame, esi=pItem, stack=[pUnit], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x401u, 2u, 2u, 0u);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    int expAssert = (k == 0);
    if (k >= 1) {
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0xFFu, 0u, 2u);
      U32(STAGE_PATH1 + 0x0Cu) = (k == 2) ? 3u : 0u;
    }
    c = make_call(); c.eax = STAGE_GAME; c.esi = STAGE_UNIT1;
    c.nargs = 1u; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF2CF0u, "ITEMS_RemoveBeltItemAndFreeUnit_6FCF2CF0_113c", k, lbl, &c, ts, 3u, 0x00000000u, expAssert);
  }
}

static void emit_group_2(void);
static void emit_group_3(void);
static void emit_group_4(void);
static void emit_group_5(void);
static void emit_group_6(void);

int main(int argc, char **argv) {
  if (argc < 3) {
    fprintf(stderr, "Usage: %s <datatbls.img> <out.ndjson>\n", argv[0]);
    return 1;
  }
  const char *imgPath = argv[1];
  const char *outPath = argv[2];

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pVtbl  = VirtualAlloc((void *)HASH_VTABLE_ADDR, 0x1000u, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pVtbl != HASH_VTABLE_ADDR ||
      (uintptr_t)pStage != STAGE_BASE   || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-p7] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
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
    fprintf(stderr, "[k6-p7] LoadLibraryA failed\n");
    return 2;
  }

  g_com_rebase  = (intptr_t)g_hCom  - (intptr_t)D2COM_PREF_BASE;
  g_game_rebase = (intptr_t)g_hGame - (intptr_t)D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p7] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
  fn_SetCursorItem      = (Com_SetCursorItem_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10466));
  fn_PlaceItemInBodyLoc = (Com_PlaceItemInBodyLoc_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11041));
  fn_CheckItemTypeId    = (Com_CheckItemTypeId_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10744));
  fn_GetItemType        = (Com_GetItemType_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11088));
  fn_AutoPlaceInBelt    = (Com_AutoPlaceInBelt_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10729));
  fn_PlaceInGridCell    = (Com_PlaceInGridCell_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11107));

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_SetCursorItem || !fn_PlaceItemInBodyLoc ||
      !fn_CheckItemTypeId || !fn_GetItemType || !fn_AutoPlaceInBelt || !fn_PlaceInGridCell) {
    fprintf(stderr, "[k6-p7] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p7] failed to open %s\n", outPath);
    return 5;
  }

  emit_group_1();
  emit_group_1_part2();
  emit_group_2();
  emit_group_3();
  emit_group_4();
  emit_group_5();
  emit_group_6();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p7] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}


/* ------------------------------- Group 2 (VAs 26..50) */

static void emit_group_2(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* 26. 0x6FD12380 AI_CastSkillWithMode113c (al=nMode, ecx=pUnit, ebx=pGame, stack=[nSkillId, pTarget, x, y], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4815u, 4815u);
    attach_skill(STAGE_UNIT0, 68, 2);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t mode  = (k == 0) ? 0x10u : ((k == 1) ? 4u : 5u);
    uint32_t skId  = (k == 2) ? 68u : 0xFFFFFFFFu;
    uint32_t pTarg = (k == 1) ? STAGE_UNIT1 : 0u;
    c = make_call(); c.eax = mode; c.ecx = STAGE_UNIT0; c.ebx = STAGE_GAME;
    c.nargs = 4u; c.args[0] = skId; c.args[1] = pTarg; c.args[2] = 4815u; c.args[3] = 4815u; c.calleePop = 0x10u;
    ts[0] = (int64_t)mode; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    ts[3] = (int64_t)(int32_t)skId; ts[4] = (int64_t)pTarg; ts[5] = 4815; ts[6] = 4815;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD12380u, "AI_CastSkillWithMode113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 27. 0x6FD01570 SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c (stack=[pGame, pPortalUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4815u, 4815u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_portal_id, 0x301u, 0u, 4810u, 4810u, 0x12345u);
    U8(STAGE_UDATA0 + 0x04u)  = 1u;
    U32(STAGE_UDATA0 + 0x18u) = 4810u;
    U32(STAGE_UDATA0 + 0x1Cu) = 4810u;
    U32(STAGE_UNIT0 + 0x94u)  = 1u;
    U32(STAGE_UNIT0 + 0x98u)  = (k == 1) ? 0x202u : 0x999u;
    uint32_t pPortal = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = pPortal; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)pPortal;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD01570u, "SUNIT_EnsurePortalDestRoomPopulatedAndGetOwner_6FD01570_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, (k == 0));
  }

  /* 28. 0x6FD10130 D2GAME_PARTY_Send0x8BPartyRelationStatus113c (eax=pUnitA, edi=pDestUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pCli2 = stage_extra_client();
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x102u, 1u, 4815u, 4815u, pCli2);
    if (k == 2) {
      U32(STAGE_SCRATCH + 0x00u) = 0x102u;
      U8(STAGE_SCRATCH + 0x0Cu)  = 3u;
      U32(STAGE_SCRATCH + 0x10u) = 0u;
      U32(STAGE_UDATA0 + 0x38u)  = STAGE_SCRATCH;
    }
    uint32_t pUnitA = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c = make_call(); c.eax = pUnitA; c.edi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)pUnitA; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD10130u, "D2GAME_PARTY_Send0x8BPartyRelationStatus113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 29. 0x6FD13360 MONSTER_SendPacket0x0C_LifeSync113c (eax=pMonster, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4815u, 4815u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, (k == 0 ? 100 : 40) << 8, 0);
    U8(STAGE_UNIT1 + 0xB0u) = (k == 2) ? 5u : 2u;
    U8(STAGE_UDATA1 + 0x17u) = (k == 2) ? 1u : 0u;
    c = make_call(); c.eax = STAGE_UNIT1; c.nargs = 1u; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD13360u, "MONSTER_SendPacket0x0C_LifeSync113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 30. 0x6FCFA540 SUNITDMG_GetWeaponBlockChance_6FCFA540_113c (eax=pDefender, ret 0) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    if (k == 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x15C, 25, 0);
    } else if (k >= 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_claw, 0x401u, 1u, 2u, 0u);
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_claw, 0x402u, 1u, 2u, 0u);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
      place_body_item(STAGE_UNIT0, STAGE_UNIT2, 5);
      uint32_t itype = (uint32_t)fn_GetItemType((void *)(uintptr_t)STAGE_UNIT1);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x15C, 42, (k == 2) ? (int32_t)itype : 999);
    }
    uint32_t pDef = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = pDef; c.calleePop = 0u;
    ts[0] = (int64_t)pDef;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFA540u, "SUNITDMG_GetWeaponBlockChance_6FCFA540_113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, 0);
  }

  /* 31. 0x6FCFB5E0 SUNITDMG_ResolveAttackerPlayer113c (ebx=pUnit, stack=[pGame, pSrcUnit], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4814u, 4814u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) {
      uint32_t pAiGen = U32(STAGE_UDATA1 + 0x28u);
      U32(pAiGen + 0x28u) = STAGE_GAME;
      U32(pAiGen + 0x2Cu) = 0x101u;
      U32(pAiGen + 0x30u) = 0u;
    }
    uint32_t pUnit = (k == 0) ? 0u : ((k == 1) ? STAGE_UNIT0 : STAGE_UNIT1);
    c = make_call(); c.ebx = pUnit;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)pUnit;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFB5E0u, "SUNITDMG_ResolveAttackerPlayer113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 32. 0x6FCFFF10 SUNIT_InitUnitAnimData113c (esi=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    if (k == 1) {
      U32(STAGE_UNIT0 + 0x2Cu) = 0u;
    } else if (k == 2) {
      U32(STAGE_UNIT0 + 0x10u) = 4u;
    }
    c = make_call(); c.esi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFFF10u, "SUNIT_InitUnitAnimData113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 33. 0x6FD007A0 SUNIT_ValidatePathTargetUnit113c (eax=pUnit, ecx=pGame, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x401u, (k == 2) ? 2u : 3u, 2u, 0u);
    if (k >= 1) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      U32(STAGE_PATH0 + 0x5Cu) = 4u;
      U32(STAGE_PATH0 + 0x60u) = (k == 1) ? 0x999u : 0x401u;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD007A0u, "SUNIT_ValidatePathTargetUnit113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 34. 0x6FCF29F0 ITEMS_ClearInventoryCmdFlag4AndSync3F113c (stack=[pUnit], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 0u, 2u, 0u);
    if (k >= 1) {
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
      U32(STAGE_UDATA1 + 0x18u) = (k >= 2) ? 4u : 0u;
      if (k == 3) {
        U32(STAGE_UNIT0 + 0x00u) = 1u; /* monster skips 0x3F packet */
      }
    }
    uint32_t pUnit = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.nargs = 1u; c.args[0] = pUnit; c.calleePop = 4u;
    ts[0] = (int64_t)pUnit;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF29F0u, "ITEMS_ClearInventoryCmdFlag4AndSync3F113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 35. 0x6FCEF270 C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c (ecx=pGame, edx=pPlayer, stack=[pPkt, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pPkt = STAGE_SCRATCH;
    uint32_t nLen = (k == 0) ? 5u : 9u;
    U8(pPkt + 0u) = 0x1Du;
    U32(pPkt + 1u) = 0x301u;
    U32(pPkt + 5u) = 0x302u;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x301u, 4u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0xFFu, 0u, 4u);
      fn_SetCursorItem((void *)(uintptr_t)U32(STAGE_UNIT0 + 0x60u), (void *)(uintptr_t)STAGE_UNIT1);
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_box, 0x302u, 0u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 0u, 0u, 4u);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = pPkt; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pPkt; ts[3] = (int64_t)nLen;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEF270u, "C2S_Packet_PlaceCursorItemIntoContainer_6FCEF270_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 36. 0x6FCEF570 C2S_Packet32_NpcBuyItem_6FCEF570_113c (ecx=pGame, edx=pPlayer, stack=[pPkt, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pPkt = STAGE_SCRATCH;
    uint32_t nLen = (k == 0) ? 5u : 0x11u;
    U8(pPkt + 0u)  = 0x32u;
    U32(pPkt + 1u) = 0x201u;
    U32(pPkt + 5u) = 0x301u;
    U16(pPkt + 9u) = 0u;
    U32(pPkt + 13u) = 100u;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x301u, 0u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = pPkt; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pPkt; ts[3] = (int64_t)nLen;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEF570u, "C2S_Packet32_NpcBuyItem_6FCEF570_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 37. 0x6FCEE520 C2S_Packet0C_RightSkillOnLocation113c (ecx=pGame, edx=pPlayer, stack=[pPacket, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    if (k == 1) {
      U32(STAGE_UNIT0 + 0x14u) = 0u;
    } else if (k == 2) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
      uint32_t pSk = attach_skill(STAGE_UNIT0, 0, 1);
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x0Cu) = pSk;
    }
    U8(STAGE_SCRATCH + 0u) = 0x0Cu;
    U16(STAGE_SCRATCH + 1u) = 4814u;
    U16(STAGE_SCRATCH + 3u) = 4814u;
    uint32_t len = (k == 0) ? 4u : 5u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEE520u, "C2S_Packet0C_RightSkillOnLocation113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 38. 0x6FCFE5A0 SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c (edi=pAttacker, eax=pDefender, stack=[pGame, nToHitBonus, nWeaponRangePenalty], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 3u, 4811u, 4811u, STAGE_CLIENT);
    void *pAlign = fn_AllocStatList(NULL, 0u, 0u, 0, 0);
    fn_SetStatListState(pAlign, 0x69);
    fn_SetStatIfValid(pAlign, 0xAC, 2, 0);
    fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT1, pAlign, 1);
    if (k == 2) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT1, 0x36, 1);
    }
    uint32_t pAtt = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.edi = pAtt; c.eax = STAGE_UNIT1;
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = (int64_t)pAtt; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_GAME; ts[3] = 0; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFE5A0u, "SUNITDMG_RollMeleeToHitAndBlock_6FCFE5A0_113c", k, lbl, &c, ts, 5u, 0x0000FFFFu, 0);
  }

  /* 39. 0x6FCF1010 C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c (ecx=pGame, edx=pPlayer, stack=[pPkt, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pPkt = STAGE_SCRATCH;
    uint32_t nLen = (k == 0) ? 5u : 0x11u;
    U8(pPkt + 0u)   = 0x1Fu;
    U32(pPkt + 1u)  = 0x301u;
    U32(pPkt + 5u)  = 0x302u;
    U32(pPkt + 9u)  = 0u;
    U32(pPkt + 13u) = 0u;
    if (k >= 1) {
      uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = pInv;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x301u, 4u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0xFFu, 0u, 4u);
      fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    }
    if (k == 2) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_ring, 0x302u, 0u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 2u, 0u, 4u);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = pPkt; c.args[1] = nLen; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pPkt; ts[3] = (int64_t)nLen;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF1010u, "C2S_Packet1F_SwapCursorWithContainerItem_6FCF1010_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 40. 0x6FCEBBB0 SUNITDMG_ApplyArmorDurabilityAndGetHit113c (eax=pDefender, stack=[pClientOnly], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pDef = STAGE_UNIT0;
    if (k == 0) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
      U8(STAGE_UNIT0 + 0xB0u) = 2u;
    } else if (k == 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4814u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 50 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
      U8(STAGE_UNIT0 + 0xB0u) = 5u;
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x501u, 1u, 4820u, 4822u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 25 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
      U8(STAGE_UNIT0 + 0xB0u) = 9u;
    }
    c = make_call(); c.eax = pDef;
    c.nargs = 1u; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = 0; ts[1] = 0; ts[2] = (int64_t)pDef; ts[3] = 0; ts[4] = (int64_t)STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEBBB0u, "SUNITDMG_ApplyArmorDurabilityAndGetHit113c", k, lbl, &c, ts, 5u, 0x00000000u, 0);
  }

  /* 41. 0x6FCEEE60 C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 4u, 2u, 0u);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0u)  = 0x1Au;
    U32(STAGE_SCRATCH + 1u) = 0x401u;
    U8(STAGE_SCRATCH + 5u)  = (k == 1) ? 0u : 4u;
    uint32_t len = (k == 0) ? 5u : 9u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEEE60u, "C2S_Packet1A_EquipCursorItemToBodyLoc_6FCEEE60_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 42. 0x6FCE7C20 ACT2Q2_SpawnJerhynOnObjInit_6FCE7C20_113c (esi=pQuest, edi=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_timer_queue();
    stage_mon_reg(40u);
    stage_party_ctrl();
    stage_quest_node(0x0Du, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 2u : 1u;
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u)    = STAGE_QBITS0 + 0x20u;
    U32(STAGE_QBITS0 + 0x04u)    = 0x200u;
    U32(STAGE_QUESTARG + 0x08u)  = STAGE_ROOM0;
    U32(STAGE_QUESTARG + 0x14u)  = (k == 2) ? 4818u : 4815u;
    U32(STAGE_QUESTARG + 0x18u)  = (k == 2) ? 4819u : 4815u;
    c = make_call(); c.esi = STAGE_QUEST0; c.edi = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE7C20u, "ACT2Q2_SpawnJerhynOnObjInit_6FCE7C20_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 43. 0x6FD0A930 ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c (eax=pCenterUnit, ebx=pGame) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, (k == 0) ? 4815u : 4820u, 4815u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, (k == 1) ? 4822u : 4860u, 4815u);
      U32(STAGE_UNIT1 + 0xC4u) = 0x0Cu;
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0A930u, "ACT3Q5_CorruptMonstersAndFireCompellingOrbProjectile_6FD0A930_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 44. 0x6FCF7300 D2Game_6FCF7300_113c (eax=pUnit, stack=[pGame, dwCursorGuid, dwTargetGuid, nX, nY, pOutFailed], ret 18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x111F74u), 8u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    U32(STAGE_GAME + 0x70u) = 1u;
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x301u, 4u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0xFFu, 0u, 4u);
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    uint32_t tgtGuid = (k == 1) ? 0x999u : 0x302u;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_ring, 0x302u, 0u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 2u, 0u, 4u);
    }
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t pOut = STAGE_SCRATCH;
    U32(pOut) = 0xDEADBEEFu;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 6u; c.args[0] = pG; c.args[1] = 0x301u; c.args[2] = tgtGuid;
    c.args[3] = 0u; c.args[4] = 0u; c.args[5] = pOut; c.calleePop = 0x18u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)pG; ts[2] = 0x301;
    ts[3] = (int64_t)tgtGuid; ts[4] = 0; ts[5] = 0; ts[6] = (int64_t)pOut; ts[7] = (int64_t)pOut;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF7300u, "D2Game_6FCF7300_113c", k, lbl, &c, ts, 8u, 0xFFFFFFFFu, (k == 0));
  }

  /* 45. 0x6FCEB1F0 C2S_ResolveDualWieldThrowSkill113c (ebx=pPlayer, stack=[pSkill], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSk0  = attach_skill(STAGE_UNIT0, 0, 1);
    uint32_t pSk36 = attach_skill(STAGE_UNIT0, 36, 1);
    attach_skill(STAGE_UNIT0, 5, 1);
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_tknife, 0x401u, 1u, 2u, 0u);
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_tknife, 0x402u, 1u, 2u, 0u);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
      place_body_item(STAGE_UNIT0, STAGE_UNIT2, 5);
    }
    uint32_t pSk = (k == 0) ? pSk36 : pSk0;
    c = make_call(); c.ebx = STAGE_UNIT0; c.nargs = 1u; c.args[0] = pSk; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)pSk;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEB1F0u, "C2S_ResolveDualWieldThrowSkill113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 46. 0x6FCF7E30 ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c (eax=pBeltItem, stack=[pGame, pOwnerUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k >= 1) {
      uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = pInv;
      if (k == 2) {
        for (uint32_t p = 0u; p < 5u; p++) {
          uint32_t pPot  = (uint32_t)(uintptr_t)bump_alloc(0x200u);
          uint32_t pData = (uint32_t)(uintptr_t)bump_alloc(0x200u);
          uint32_t pPath = (uint32_t)(uintptr_t)bump_alloc(0x100u);
          stage_item_unit(pPot, pData, pPath, STAGE_ROOM0, g_item_pot, 0x301u + p, 2u, 2u, 0u);
          insert_server_unit(STAGE_GAME, pPot);
          fn_AutoPlaceInBelt((void *)(uintptr_t)pInv, (void *)(uintptr_t)pPot);
        }
      }
    }
    c = make_call(); c.eax = 0u;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = 0; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF7E30u, "ITEMS_RemoveExcessBeltItemsOnUnequip_6FCF7E30_113c", k, lbl, &c, ts, 3u, 0x00000000u, (k == 0));
  }

  /* 47. 0x6FCF1370 C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 0u, 2u, 0u);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    if (k == 1) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_pot, 0x402u, 4u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT2);
    }
    U8(STAGE_SCRATCH + 0u)  = 0x19u;
    U32(STAGE_SCRATCH + 1u) = 0x401u;
    uint32_t len = (k == 0) ? 3u : 5u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF1370u, "C2S_Packet19_PickupBufferOrStorageItemToCursor_6FCF1370_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 48. 0x6FCE5A60 ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c (ecx=pQuest, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_quest_node(0x0Eu, 0u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0) ? 0xFBu : 0xC9u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    if (k == 0) U8(STAGE_QUESTEX0 + 0x09u) = 1u;
    else if (k == 1) U8(STAGE_QUESTEX0 + 0x08u) = 1u;
    else U8(STAGE_QUESTEX0 + 0x0Au) = 1u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE5A60u, "ACT2Q6_OnTyraelOrJerhynTalkCallback_6FCE5A60_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 49. 0x6FCF8310 ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c (eax=dwItemGuid, stack=[pGame, pPlayer], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    if (k >= 1) {
      uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = pInv;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x301u, 4u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0xFFu, 0u, 4u);
      fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    }
    uint32_t pg = (k == 0) ? 0u : STAGE_GAME;
    uint32_t guid = (k == 1) ? 0x999u : 0x301u;
    c = make_call(); c.eax = guid;
    c.nargs = 2u; c.args[0] = pg; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)guid; ts[1] = (int64_t)pg; ts[2] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF8310u, "ITEMS_DuplicateAndDropCursorItem_6FCF8310_113c", k, lbl, &c, ts, 3u, 0x00000000u, (k == 0));
  }

  /* 50. 0x6FCED530 PACKET_DeliverOverheadOrPartyChat_6FCED530_113c (ecx=pClient, edx=pChatDesc, ret 0) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pMsg = STAGE_SCRATCH + 0x40u;
    U8(pMsg + 0x00u) = 0x26u;
    U8(pMsg + 0x01u) = 0x01u;
    snprintf((char *)(uintptr_t)(pMsg + 0x0Au), 16, "Hero");
    snprintf((char *)(uintptr_t)(pMsg + 0x1Au), 32, "hello_%d", k);
    U32(STAGE_SCRATCH + 0x00u) = pMsg;
    if (k == 2) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x102u, 1u, 4812u, 4812u, stage_extra_client());
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_SCRATCH + 0x08u) = 0x102u;
    } else {
      U32(STAGE_SCRATCH + 0x08u) = (k == 1) ? 0xFFFFFFFFu : 0x101u;
    }
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call(); c.ecx = pCli; c.edx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = (int64_t)pCli; ts[1] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCED530u, "PACKET_DeliverOverheadOrPartyChat_6FCED530_113c", k, lbl, &c, ts, 2u, 0x00000000u, (k == 0));
  }
}



/* ------------------------------- Group 3 (VAs 51..75) */

static void emit_group_3(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* 51. 0x6FCECFE0 C2S_ValidateTargetUnitDistance113c (eax=dwUnitType, ecx=pGame, edx=dwUnitId, stack=[pPlayer, nMaxDelta], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint16_t mx = (k == 2) ? 4880u : 4812u;
    uint16_t my = (k == 2) ? 4880u : 4812u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, mx, my);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t targId = (k == 0) ? 0x999u : 0x201u;
    uint32_t maxD   = (k == 1) ? 10u : 5u;
    c = make_call(); c.eax = 1u; c.ecx = STAGE_GAME; c.edx = targId;
    c.nargs = 2u; c.args[0] = STAGE_UNIT0; c.args[1] = maxD; c.calleePop = 8u;
    ts[0] = 1; ts[1] = (int64_t)targId; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)STAGE_UNIT0; ts[4] = (int64_t)maxD;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCECFE0u, "C2S_ValidateTargetUnitDistance113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 52. 0x6FD134C0 NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c (esi=pMonster, stack=[pClient, pTargetUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    uint32_t ppClis = (uint32_t)(uintptr_t)bump_alloc(8u);
    U32(ppClis) = STAGE_CLIENT;
    U32(STAGE_ROOM0 + 0x48u) = ppClis;
    U32(STAGE_ROOM0 + 0x78u) = 1u;
    if (k >= 1) {
      uint32_t pSk = attach_skill(STAGE_UNIT1, 36, 3);
      uint32_t pList = U32(STAGE_UNIT1 + 0xA8u);
      U32(pList + 0x10u) = pSk;
    }
    uint32_t pTarg = (k == 1) ? STAGE_UNIT0 : 0u;
    c = make_call(); c.esi = STAGE_UNIT1;
    c.nargs = 2u; c.args[0] = STAGE_CLIENT; c.args[1] = pTarg; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_CLIENT; ts[2] = (int64_t)pTarg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD134C0u, "NET_SendMonsterSkillCastPacket4COr4D_6FD134C0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 53. 0x6FCEA5F0 MONREG_GetOrCreateActOutfit113c (stack=[ppMonRegTable, pRoom, pUnit], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_mon_reg(1u);
    uint32_t pMonReg = U32(STAGE_GAME + 0xF0u + 1u * 4u);
    uint32_t cls = (k == 0) ? 195u : ((k == 1) ? 0u : 20u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x201u, 1u, 4810u, 4810u);
    if (k == 1) {
      U8(pMonReg + 0x12u)  = 1u;
      U16(pMonReg + 0x14u) = 0u;
    }
    c = make_call();
    c.nargs = 3u; c.args[0] = STAGE_GAME + 0xF0u; c.args[1] = STAGE_ROOM0; c.args[2] = STAGE_UNIT0; c.calleePop = 12u;
    ts[0] = (int64_t)(STAGE_GAME + 0xF0u); ts[1] = (int64_t)STAGE_ROOM0; ts[2] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEA5F0u, "MONREG_GetOrCreateActOutfit113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 54. 0x6FD05270 ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x100520u), 16u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xFDu, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x11u, 0u);
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(6u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 6u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = 0xFDu;
      U16(tbl + 0x04u) = (uint16_t)(0x250u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 0) {
      set_quest_bit(pFlags, 0x11u, 0u);
    } else if (k == 1) {
      set_quest_bit(pFlags, 0x11u, 0u);
      set_quest_bit(pFlags, 0x11u, 0x0Du);
      U32(STAGE_QUEST0 + 0x1Cu) = 0x101u;
      U16(STAGE_QUEST0 + 0x9Cu) = 1u;
    } else {
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    }
    uint32_t pTextHdr = STAGE_SCRATCH + 0x80u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = pTextHdr;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD05270u, "ACT3Q4_AddLamEsensTomeNpcDialogNodes_6FD05270_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 55. 0x6FCFEBA0 SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c (eax=pAttacker, ebx=pDefender, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x10E628u), 80u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    uint32_t pAtt = 0u, pDef = 0u;
    if (k == 1) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x301u, 1u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 72, 30, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 73, 30, 0);
      pAtt = STAGE_UNIT0;
    } else if (k == 2) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_armor, 0x301u, 1u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 3);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 72, 30, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 73, 30, 0);
      pDef = STAGE_UNIT0;
    }
    c = make_call(); c.eax = pAtt; c.ebx = pDef;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)pAtt; ts[2] = (int64_t)pDef; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFEBA0u, "SUNITDMG_ApplyWeaponAndArmorDurabilityLoss113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 56. 0x6FD13D20 MONSTER_CheckSpawnTileFree113c (eax=pRoom, edx=nClassId, ecx=y, stack=[x, bSkipSpecial298], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pGrid = stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t clsId = (k == 0) ? 1u : 0xCEu;
    if (k == 2) {
      U16(pGrid + (13u * 32u + 10u) * 2u) = 0x0C01u;
    }
    c = make_call(); c.eax = STAGE_ROOM0; c.edx = clsId; c.ecx = 4810u;
    c.nargs = 2u; c.args[0] = 4810u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_ROOM0; ts[1] = (int64_t)clsId; ts[2] = 4810; ts[3] = 4810; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD13D20u, "MONSTER_CheckSpawnTileFree113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 57. 0x6FCE4320 ACT2Q1_Callback_NpcActivateDialog_6FCE4320_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x10396Cu), 36u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xB0u, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x09u, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 9u;
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(8u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 8u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = 0xB0u;
      U16(tbl + 0x04u) = (uint16_t)(0x260u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 0) {
      set_quest_bit(pFlags, 9u, 1u);
    } else if (k == 1) {
      U32(STAGE_QUEST0 + 0x1Cu) = 0x101u;
      U16(STAGE_QUEST0 + 0x9Cu) = 1u;
    } else {
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = 2u;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE4320u, "ACT2Q1_Callback_NpcActivateDialog_6FCE4320_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 58. 0x6FCF2D90 ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c (eax=pUnit, esi=pItem, stack=[pGame, bSendRemovePacket], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x401u, 2u, 2u, 0u);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t snd = (k == 2) ? 1u : 0u;
    c = make_call(); c.eax = STAGE_UNIT0; c.esi = STAGE_UNIT1;
    c.nargs = 2u; c.args[0] = pG; c.args[1] = snd; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)pG; ts[3] = (int64_t)snd;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF2D90u, "ITEMS_RemoveGridItemAndFreeUnit_6FCF2D90_113c", k, lbl, &c, ts, 4u, 0x00000000u, (k == 0));
  }

  /* 59. 0x6FCE3080 ACT2Q5_Callback00_NpcActivate_6FCE3080_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x105308u), 16u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xB0u, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x0Du, 0u);
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(6u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 6u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = 0xB0u;
      U16(tbl + 0x04u) = (uint16_t)(0x270u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 0) {
      set_quest_bit(pFlags, 0x0Du, 1u);
    } else if (k == 1) {
      U32(STAGE_QUEST0 + 0x1Cu) = 0x101u;
      U16(STAGE_QUEST0 + 0x9Cu) = 1u;
    } else {
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE3080u, "ACT2Q5_Callback00_NpcActivate_6FCE3080_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 60. 0x6FCE37F0 ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x104690u), 16u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xB0u, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x0Bu, 0u);
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(6u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 6u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = 0xB0u;
      U16(tbl + 0x04u) = (uint16_t)(0x280u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 0) {
      set_quest_bit(pFlags, 0x0Bu, 1u);
    } else if (k == 1) {
      U32(STAGE_QUEST0 + 0x1Cu) = 0x101u;
      U16(STAGE_QUEST0 + 0x9Cu) = 1u;
    } else {
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE37F0u, "ACT2Q3_Callback00_NpcActivate_6FCE37F0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 61. 0x6FCF4960 ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c (eax=bSkipReq, ecx=pItem, edx=pUnit, stack=[0], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSk = attach_skill(STAGE_UNIT0, 0, 1);
    uint32_t pSkList = U32(STAGE_UNIT0 + 0xA8u);
    U32(pSkList + 0x08u) = pSk;
    U32(pSkList + 0x0Cu) = pSk;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    uint32_t itmId = (k == 0) ? g_item_pot : ((k == 1) ? g_item_sword : g_item_armor);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, itmId, 0x401u, 0u, 2u, 0u);
    U32(STAGE_UDATA1 + 0x18u) = 0x10u;
    c = make_call(); c.eax = 1u; c.ecx = STAGE_UNIT1; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = 1; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF4960u, "ITEMS_AutoEquipItemToBodyLoc_6FCF4960_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 62. 0x6FCF46B0 ITEMS_DeactivateEquippedItemStats113c (esi=pUnit, edi=pItem, stack=[pGame, bForceBroken, bClamp], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 1u, 2u, 0u);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0, 5, 0);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, (void *)(uintptr_t)U32(STAGE_UNIT1 + 0x5Cu), 1);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t clamp = (k == 2) ? 1u : 0u;
    c = make_call(); c.esi = pU; c.edi = STAGE_UNIT1;
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = 1u; c.args[2] = clamp; c.calleePop = 12u;
    ts[0] = (int64_t)pU; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_GAME; ts[3] = 1; ts[4] = (int64_t)clamp;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF46B0u, "ITEMS_DeactivateEquippedItemStats113c", k, lbl, &c, ts, 5u, 0x00000000u, 0);
  }

  /* 63. 0x6FCE1C20 ACT2Q6_ActiveFilter_6FCE1C20_113c (ecx=pQuestData, edx=nNpcId, stack=[pPlayer, pQuestFlags, pNpc], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_quest_node(0x0Eu, 0x20u);
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    uint32_t npcId = (k == 0) ? 0xC9u : ((k == 1) ? 0xD2u : 0xFBu);
    if (k == 0) {
      U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    } else if (k == 1) {
      set_quest_bit(pFlags, 0x0Eu, 4u);
    } else {
      U8(STAGE_QUEST0 + 0x09u)   = 1u;
      U8(STAGE_QUESTEX0 + 0x01u) = 1u;
      U8(STAGE_QUESTEX0 + 0x0Fu) = 1u;
    }
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npcId;
    c.nargs = 3u; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)npcId; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE1C20u, "ACT2Q6_ActiveFilter_6FCE1C20_113c", k, lbl, &c, ts, 5u, 0x000000FFu, 0);
  }

  /* 64. 0x6FD03970 ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x102270u), 24u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xFFu, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x15u, 0x20u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x15u;
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(8u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 8u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = 0xFFu;
      U16(tbl + 0x04u) = (uint16_t)(0x290u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 0) {
      set_quest_bit(pFlags, 0x15u, 4u);
    } else if (k == 1) {
      set_quest_bit(pFlags, 0x15u, 0u);
      U32(STAGE_QUEST0 + 0x1Cu) = 0x101u;
      U16(STAGE_QUEST0 + 0x9Cu) = 1u;
    } else {
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = 2u;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD03970u, "ACT3Q5_AddTravincalNpcDialogNodes_6FD03970_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 65. 0x6FD0AD10 PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c (eax=nPoints, esi=pPlayerUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2) ? 4u : 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 4, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 3, 15, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 80 << 8, 0);
    uint32_t pts = (k == 0) ? 0u : ((k == 1) ? 1u : 5u);
    c = make_call(); c.eax = pts; c.esi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)pts; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0AD10u, "PLAYERSTATS_AllocateVitalityPoints_6FD0AD10_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 66. 0x6FD06BD0 ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t npcCls = (k == 1) ? 0xF5u : 0xFEu;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x14u, 0u);
    if (k == 0) U8(STAGE_QUESTEX0 + 0x08u) = 1u;
    else if (k == 1) U8(STAGE_QUESTEX0 + 0x09u) = 1u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD06BD0u, "ACT3Q1_OnNpcActivatedSendGoldenBirdAlert_6FD06BD0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 67. 0x6FD03CE0 ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c (ecx=pQuestData, edx=pPlayer, stack=[pGFlags, pQFlags, pOut], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_quest_node(0x14u, 0u);
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k >= 1) {
      set_quest_bit(pFlags, 0x0Fu, 0u);
    }
    if (k == 1) {
      set_quest_bit(pFlags, 0x14u, 1u);
    } else if (k == 2) {
      set_quest_bit(pFlags, 0x14u, 0u);
      set_quest_bit(pFlags, 0x14u, 0x0Du);
    }
    U32(STAGE_SCRATCH + 0u) = 0u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = STAGE_SCRATCH + 0x40u; c.args[1] = pFlags; c.args[2] = STAGE_SCRATCH; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_UNIT0;
    ts[2] = (int64_t)(STAGE_SCRATCH + 0x40u); ts[3] = (int64_t)pFlags; ts[4] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD03CE0u, "ACT3Q1_GoldenBirdStatusFilter_6FD03CE0_113c", k, lbl, &c, ts, 5u, 0x000000FFu, 0);
  }

  /* 68. 0x6FCFFC10 D2GAME_SUNIT_IterateAllLivingPlayers113c (edi=pGame, ebx=pfnCallback, stack=[pContext], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cb = D2GAME_VA(0xC4BD0u) + (uint32_t)g_game_rebase;
    if (k == 0) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 7, 1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    } else if (k >= 1) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    if (k == 2) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x102u, 1u, 4812u, 4812u, stage_extra_client());
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    c = make_call(); c.edi = STAGE_GAME; c.ebx = cb;
    c.nargs = 1u; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)cb; ts[2] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFFC10u, "D2GAME_SUNIT_IterateAllLivingPlayers113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 69. 0x6FD129B0 AI_WalkWanderAroundSelf_6FD129B0_113c (al=nRange, stack=[pGame, pUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4815u, 4815u);
    uint32_t rng = (k == 0) ? 2u : ((k == 1) ? 5u : 8u);
    c = make_call(); c.eax = rng;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)rng; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD129B0u, "AI_WalkWanderAroundSelf_6FD129B0_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 70. 0x6FCF28D0 ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c (eax=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    uint32_t pList = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pList;
    if (k >= 1) {
      uint32_t gpotId = g_item_bow;
      uint32_t nItems = U32(D2COM_VA(0x9FB94u) + g_com_rebase);
      uint32_t pItems = U32(D2COM_VA(0x9FB98u) + g_com_rebase);
      for (uint32_t ii = 0; ii < nItems; ii++) {
        if (U32(pItems + ii * 0x1A8u + 0x80u) == 0x20737067u) { gpotId = ii; break; } /* 'gps ' */
      }
      uint32_t pSkDef = attach_skill(STAGE_UNIT0, 0, 1);
      attach_skill(STAGE_UNIT0, 2, 1);
      uint32_t pSkArr = attach_skill(STAGE_UNIT0, 7, 1);
      U32(pList + 0x08u) = pSkDef;
      U32(pList + 0x0Cu) = pSkArr;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 1) ? gpotId : g_item_sword, 0x401u, 1u, 2u, 0u);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
      U8(STAGE_UDATA1 + 0x44u) = 4u;
      U32(pInv + 0x1Cu) = 0x401u;
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = pU; c.calleePop = 0u;
    ts[0] = (int64_t)pU;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF28D0u, "ITEMS_ValidateAndFallbackPlayerHandSkills_6FCF28D0_113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 71. 0x6FD04F60 ACT3Q3_KhalimsWillActiveFilter_6FD04F60_113c (ecx=pQuestData, edx=nNpcClassId, stack=[pPlayer, pQFlags, pNpc], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_quest_node(0x12u, 0u);
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    uint32_t npc = (k == 0) ? 0xFEu : 0xF5u;
    if (k == 1) {
      U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    } else if (k == 2) {
      set_quest_bit(pFlags, 0x12u, 2u);
    }
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = npc;
    c.nargs = 3u; c.args[0] = STAGE_UNIT0; c.args[1] = pFlags; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)npc; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)pFlags; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD04F60u, "ACT3Q3_KhalimsWillActiveFilter_6FD04F60_113c", k, lbl, &c, ts, 5u, 0x000000FFu, 0);
  }

  /* 72. 0x6FCE5310 ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t npcCls = (k == 0) ? 0xB0u : 0xF4u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x0Au, 0x20u);
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(8u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 8u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = 0xF4u;
      U16(tbl + 0x04u) = (uint16_t)(0x2A0u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 1) {
      set_quest_bit(pFlags, 0x0Au, 1u);
    } else if (k == 2) {
      U32(STAGE_QUEST0 + 0x1Cu) = 0x101u;
      U16(STAGE_QUEST0 + 0x9Cu) = 1u;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE5310u, "ACT2Q2_Callback00_NpcActivateCainHoradricDialog_6FCE5310_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 73. 0x6FD10480 D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c (ecx=pGame, edx=pUnitNew, stack=[pUnitExisting], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_party_ctrl();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pExCli = stage_extra_client();
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x102u, 1u, 4812u, 4812u, pExCli);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pOther = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    if (k == 2) {
      U16(STAGE_UDATA0 + 0x56u) = 1u;
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pOther; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pOther;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD10480u, "D2GAME_PARTY_SyncAllPlayerRelationsOnJoin113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 74. 0x6FCFA350 ITEMS_ProcessReplenishStatTick_6FCFA350_113c (eax=nRepStat, ecx=nCurStat, stack=[pGame, pItem, nMax], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 2u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    U32(STAGE_UDATA1 + 0x0Cu) = (k == 2) ? 0x101u : 0xFFFFFFFFu;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 252, (k == 0) ? 0 : 5, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 72, 10, 0);
    c = make_call(); c.eax = 252u; c.ecx = 72u;
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = 20u; c.calleePop = 12u;
    ts[0] = 252; ts[1] = 72; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)STAGE_UNIT1; ts[4] = 20;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFA350u, "ITEMS_ProcessReplenishStatTick_6FCFA350_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 75. 0x6FCED190 D2GAME_PLRMODES_Send0x0DPlayerStop113c (edx=pUnit, stack=[pClient, nModeIndex], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x102CE0u), 22u * 12u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pExCli = stage_extra_client();
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x102u, 1u, 4820u, 4822u, pExCli);
    uint32_t pU = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    uint32_t mIdx = (k == 1) ? 1u : 5u;
    c = make_call(); c.edx = pU;
    c.nargs = 2u; c.args[0] = STAGE_CLIENT; c.args[1] = mIdx; c.calleePop = 8u;
    ts[0] = (int64_t)pU; ts[1] = (int64_t)STAGE_CLIENT; ts[2] = (int64_t)mIdx;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCED190u, "D2GAME_PLRMODES_Send0x0DPlayerStop113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }
}



/* ------------------------------- Group 4 (VAs 76..100) */

static void emit_group_4(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* 76. 0x6FCF2380 ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c (eax=pGame, ecx=pOwnerUnit, stack=[pItem], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 2u, 2u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 204, (10 << 8) + 3, (36 << 6) + 2);
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t pOwn = (k == 2) ? STAGE_UNIT0 : 0u;
    c = make_call(); c.eax = pG; c.ecx = pOwn;
    c.nargs = 1u; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = (int64_t)pG; ts[1] = (int64_t)pOwn; ts[2] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF2380u, "ITEMS_RechargeAllChargedSkillStatsOnItem_6FCF2380_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 77. 0x6FCFFCC0 SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c (edi=pGame, ebx=pfnPred, eax=dwUnitType, stack=[pArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cb = D2GAME_VA(0xC4BD0u) + (uint32_t)g_game_rebase;
    if (k == 2) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t uType = (k == 1) ? 9u : 0u;
    c = make_call(); c.edi = pG; c.ebx = cb; c.eax = uType;
    c.nargs = 1u; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = (int64_t)pG; ts[1] = (int64_t)cb; ts[2] = (int64_t)uType; ts[3] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFFCC0u, "SUNIT_FindFirstLivingPlayerOrMonsterMatching_6FCFFCC0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, (k == 0));
  }

  /* 78. 0x6FD033A0 ACT3Q7_AddMephistoNpcDialogNodes_6FD033A0_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x1028B0u), 24u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xFFu, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x16u, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x16u;
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(8u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 8u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = 0xFFu;
      U16(tbl + 0x04u) = (uint16_t)(0x2B0u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 0) {
      set_quest_bit(pFlags, 0x16u, 0x0Bu);
    } else if (k == 1) {
      set_quest_bit(pFlags, 0x16u, 0u);
      U32(STAGE_QUEST0 + 0x1Cu) = 0x101u;
      U16(STAGE_QUEST0 + 0x9Cu) = 1u;
    } else {
      U8(STAGE_QUEST0 + 0x0Cu) = 2u;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD033A0u, "ACT3Q7_AddMephistoNpcDialogNodes_6FD033A0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 79. 0x6FD12870 AI_WalkWanderAroundUnitOrSelf_6FD12870_113c (ecx=pOrigin, al=nRange, stack=[pGame, pUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4815u, 4815u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4816u, 4816u, STAGE_CLIENT);
    uint32_t pOrig = STAGE_UNIT1;
    uint32_t rng = (k == 0) ? 1u : ((k == 1) ? 3u : 6u);
    if (k == 0) U32(STAGE_UNIT0 + 0x10u) = 0u;
    c = make_call(); c.ecx = pOrig; c.eax = rng;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)pOrig; ts[1] = (int64_t)rng; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD12870u, "AI_WalkWanderAroundUnitOrSelf_6FD12870_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 80. 0x6FCE9B70 ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c (eax=pPresetArgs, stack=[pQuestData], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_timer_queue();
    stage_mon_reg(40u);
    stage_party_ctrl();
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_shrine_id, 0x301u, 0u, 4815u, 4815u, 0x1111u);
    stage_quest_node(0x0Eu, 0x40u);
    U32(STAGE_QUESTCTRL + 0x08u) = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u)    = STAGE_QBITS0 + 0x20u;
    U32(STAGE_QBITS0 + 0x04u)    = 0x200u;
    U32(STAGE_SCRATCH + 0x00u)   = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u)   = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u)   = STAGE_ROOM0;
    U32(STAGE_SCRATCH + 0x14u)   = 4815u;
    U32(STAGE_SCRATCH + 0x18u)   = 4815u;
    if (k == 1) {
      uint32_t bit = (0x0Eu << 4) + 0x0Du;
      U32(STAGE_QBITS0 + 0x20u + (bit >> 5) * 4u) = 1u << (bit & 31u);
    }
    c = make_call(); c.eax = STAGE_SCRATCH;
    c.nargs = 1u; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_SCRATCH; ts[1] = (int64_t)STAGE_QUEST0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE9B70u, "ACT2Q0_PresetSpawnJerhynAndRelocate_6FCE9B70_113c", k, lbl, &c, ts, 2u, 0x00000000u, (k == 0));
  }

  /* 81. 0x6FCE4030 ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c (edi=pQuestData, esi=pPlayer, stack=[pOutStatus], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_quest_node(0x0Au, 0x20u);
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k >= 1) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_box, 0x401u, 0u, 2u, 0u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    if (k == 2) {
      set_quest_bit(pFlags, 0x0Au, 0x0Du);
    }
    U32(STAGE_SCRATCH + 0u) = 0u;
    c = make_call(); c.edi = STAGE_QUEST0; c.esi = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE4030u, "ACT2Q2_ResolveHoradricStaffSubStatus_6FCE4030_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 82. 0x6FCEF0E0 D2Game_6FCEF0E0_113c (ecx=pGame, edx=pPlayer, stack=[pPacket, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_skill(STAGE_UNIT0, 36, 1);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x401u, 4u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x18u;
    U32(STAGE_SCRATCH + 0x01u) = 0x401u;
    U32(STAGE_SCRATCH + 0x05u) = 1u;
    U32(STAGE_SCRATCH + 0x09u) = 1u;
    U32(STAGE_SCRATCH + 0x0Du) = 0u;
    uint32_t len = (k == 0) ? 5u : 0x11u;
    uint32_t pG  = (k == 1) ? 0u : STAGE_GAME;
    c = make_call(); c.ecx = pG; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)pG; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEF0E0u, "D2Game_6FCEF0E0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, (k == 1));
  }

  /* 83. 0x6FD0E260 MONSTER_InitSpecialClassEvents113c (eax=pSpawnArgs, edi=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t clsId = (k == 0) ? 1u : ((k == 1) ? 0x5Bu : 0x60u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, clsId, 0x201u, 1u, 4810u, 4810u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x0Cu) = clsId;
    c = make_call(); c.eax = STAGE_SCRATCH; c.edi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = 0; ts[3] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0E260u, "MONSTER_InitSpecialClassEvents113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 84. 0x6FCE4900 ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t npcCls = (k == 0) ? 0xB0u : 0x179u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x1Eu, 0x20u);
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u)    = STAGE_QBITS0 + 0x20u;
    U32(STAGE_QBITS0 + 0x04u)    = 0x200u;
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(8u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 8u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = 0x179u;
      U16(tbl + 0x04u) = (uint16_t)(0x2C0u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 1) set_quest_bit(pFlags, 0x1Eu, 0u);
    else if (k == 2) set_quest_bit(pFlags, 0x0Eu, 0u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE4900u, "ACT2Q7_Callback_NpcActivateGuardDialog_6FCE4900_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 85. 0x6FD0AB60 ACT3Q6_FireHellgateOpenerProjectile_6FD0AB60_113c (ebx=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x182u, 0x301u, 0u, (k == 1) ? 4815u : 4820u, 4812u, 0x5555u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    c = make_call(); c.ebx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0AB60u, "ACT3Q6_FireHellgateOpenerProjectile_6FD0AB60_113c", k, lbl, &c, ts, 2u, 0x00000000u, (k == 0));
  }

  /* 86. 0x6FCFFDC0 SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c (edi=pPortalA, esi=pPortalB, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_portal_id, 0x301u, 0u, 4810u, 4810u, 111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM1, 2u, g_obj_portal_id, 0x302u, 0u, 4920u, 4930u, 222u);
    uint32_t pA = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pB = (k == 1) ? 0u : STAGE_UNIT1;
    c = make_call(); c.edi = pA; c.esi = pB; c.calleePop = 0u;
    ts[0] = (int64_t)pA; ts[1] = (int64_t)pB;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFFDC0u, "SUNIT_LinkPortalPairCoordsAndLevels_6FCFFDC0_113c", k, lbl, &c, ts, 2u, 0x00000000u, (k < 2));
  }

  /* 87. 0x6FCF4D30 ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c (eax=pUnit, stack=[pGame, dwGuid, pOutReject], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x401u, 2u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) {
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0xFFu, 0u, 2u);
    }
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    U32(STAGE_SCRATCH + 0u) = 0u;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = pG; c.args[1] = 0x401u; c.args[2] = STAGE_SCRATCH; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)pG; ts[2] = 0x401; ts[3] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF4D30u, "ITEMS_RemoveBeltItemToCursor_6FCF4D30_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, (k == 0));
  }

  /* 88. 0x6FD07080 ACT3Q7_Callback00_NpcActivate_6FD07080_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x111C20u), 4u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xFFu, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x16u, 0x20u);
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u)    = STAGE_QBITS0 + 0x20u;
    U32(STAGE_QBITS0 + 0x04u)    = 0x200u;
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    U16(STAGE_QUESTARG + 0x14u) = (k == 0) ? 0xFFu : 0x01u;
    U16(STAGE_QUESTARG + 0x18u) = (k == 0) ? 0x274u : 0x292u;
    if (k == 1) {
      set_quest_bit(pFlags, 0x16u, 0x0Bu);
    } else if (k == 2) {
      set_quest_bit(pFlags, 0x16u, 0u);
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD07080u, "ACT3Q7_Callback00_NpcActivate_6FD07080_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 89. 0x6FD00860 SUNIT_DeactivateUnitStatesAndEvents113c (eax=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    if (k == 0) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      uint32_t pArena = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pArena + 0x04u)       = 1u;
      U32(STAGE_UDATA0 + 0x34u) = pArena;
    } else if (k == 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    } else {
      stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 0x401u, 0u, 2u, 0u);
    }
    U32(STAGE_UNIT0 + 0xC4u) |= 0x800u;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD00860u, "SUNIT_DeactivateUnitStatesAndEvents113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 90. 0x6FCE67C0 ACT2Q5_OnScrollMessage_6FCE67C0_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x111C20u), 4u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_quest_node(0x0Du, 0x20u);
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u)    = STAGE_QBITS0 + 0x20u;
    U32(STAGE_QBITS0 + 0x04u)    = 0x200u;
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    U16(STAGE_QUESTARG + 0x18u) = (k == 0) ? 0x100u : 0x1A3u;
    if (k >= 1) set_quest_bit(pFlags, 0x0Du, 1u);
    if (k == 2) set_quest_bit(pFlags, 0x0Du, 0x0Du);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE67C0u, "ACT2Q5_OnScrollMessage_6FCE67C0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 91. 0x6FCF4E80 ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c (eax=dwGuid, edx=pGame, ecx=pUnit, stack=[slot, auto, pReject], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_skill(STAGE_UNIT0, 36, 1);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x401u, 4u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t guid = (k == 1) ? 0x999u : 0x401u;
    U32(STAGE_SCRATCH + 0u) = 0u;
    c = make_call(); c.eax = guid; c.edx = pG; c.ecx = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = 0u; c.args[1] = (k == 2) ? 1u : 0u; c.args[2] = STAGE_SCRATCH; c.calleePop = 12u;
    ts[0] = (int64_t)guid; ts[1] = (int64_t)pG; ts[2] = (int64_t)STAGE_UNIT0;
    ts[3] = 0; ts[4] = (k == 2) ? 1 : 0; ts[5] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF4E80u, "ITEMS_PlaceCursorItemIntoBelt_6FCF4E80_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, (k == 0));
  }

  /* 92. 0x6FCF0790 C2S_Packet5F_UpdatePlayerPos113c (ecx=pGame, edx=pPlayer, stack=[pPacket, nPacketLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t len = (k == 0) ? 4u : 5u;
    uint16_t wx  = (k == 2) ? 4818u : 4812u;
    uint16_t wy  = 4810u;
    U8(STAGE_SCRATCH + 0u) = 0x5Fu;
    U16(STAGE_SCRATCH + 1u) = wx;
    U16(STAGE_SCRATCH + 3u) = wy;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF0790u, "C2S_Packet5F_UpdatePlayerPos113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 93. 0x6FD02310 SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c (ebx=pUnit, stack=[pGame, nStartFrame], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t pAnim = (uint32_t)(uintptr_t)bump_alloc(0x120u);
    U8(pAnim + 0x10u + 2u) = 1u;
    U8(pAnim + 0x10u + 5u) = 2u;
    U32(STAGE_UNIT0 + 0x50u) = pAnim;
    U32(STAGE_UNIT0 + 0x48u) = 10u << 8;
    U16(STAGE_UNIT0 + 0x4Cu) = (k == 0) ? 0u : (1u << 8);
    uint32_t startF = (k == 2) ? 4u : 0u;
    c = make_call(); c.ebx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = startF; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)startF;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD02310u, "SUNIT_ScheduleAnimEventsFromStartFrame_6FD02310_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 94. 0x6FCF0BC0 PACKETS_SrvMercItemAction_6FCF0BC0_113c (ecx=pGame, edx=pPlayer, stack=[pPacket, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 271u, 0x201u, 1u, 4812u, 4812u);
    uint32_t pMercInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_UNIT1 + 0x60u) = pMercInv;
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pBuckets = (uint32_t)(uintptr_t)bump_alloc(64u * 12u);
    uint32_t pPetNode = (uint32_t)(uintptr_t)bump_alloc(0x24u);
    U32(pPetNode + 0x04u) = 0x201u;
    U32(pPetNode + 0x10u) = 1u;
    U32(pBuckets + 0x54u) = pPetNode;
    U32(STAGE_PETCTRL + 0x00u) = pBuckets;
    U32(STAGE_UDATA0 + 0x44u)  = STAGE_PETCTRL;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_sword, 0x401u, 1u, 2u, 0u);
      place_body_item(STAGE_UNIT1, STAGE_UNIT2, 4);
    }
    U8(STAGE_SCRATCH + 0u)  = 0x61u;
    U16(STAGE_SCRATCH + 1u) = (k == 2) ? 4u : 0u;
    uint32_t len = (k == 0) ? 5u : 3u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF0BC0u, "PACKETS_SrvMercItemAction_6FCF0BC0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 95. 0x6FCF7CC0 D2Game_6FCF7CC0_113c (eax=dwCubeGuid, ecx=pPlayer, stack=[pGame, dwCursorGuid, pOutFailed], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_box, 0x401u, 0u, 2u, 0u);
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_gem, 0x402u, 4u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT2);
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t cubeGuid = (k == 1) ? 0x999u : 0x401u;
    U32(STAGE_SCRATCH + 0u) = 0u;
    c = make_call(); c.eax = cubeGuid; c.ecx = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = pG; c.args[1] = 0x402u; c.args[2] = STAGE_SCRATCH; c.calleePop = 12u;
    ts[0] = (int64_t)cubeGuid; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pG;
    ts[3] = 0x402; ts[4] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF7CC0u, "D2Game_6FCF7CC0_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, (k == 0));
  }

  /* 96. 0x6FD135C0 D2GAME_MONSTER_SendMonsterMovementSync113c (eax=pUnit, stack=[nFlag, pClient], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0xFA718u), 16u * 24u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint16_t mx = (uint16_t)(4810u + (uint32_t)k * 5u);
    uint16_t my = (uint16_t)(4812u + (uint32_t)k * 4u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u + (uint32_t)k, 1u, mx, my);
    if (k >= 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x148, k * 5, 0);
    c = make_call(); c.eax = STAGE_UNIT1;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_CLIENT; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD135C0u, "D2GAME_MONSTER_SendMonsterMovementSync113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 97. 0x6FD02480 SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c (esi=pUnit, stack=[pGame, nRewindFrames], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t pAnim = (uint32_t)(uintptr_t)bump_alloc(0x120u);
    U8(pAnim + 0x10u + 3u) = 1u;
    U32(STAGE_UNIT0 + 0x50u) = pAnim;
    U32(STAGE_UNIT0 + 0x44u) = 95u << 8;
    U32(STAGE_UNIT0 + 0x48u) = 10u << 8;
    U16(STAGE_UNIT0 + 0x4Cu) = 1u << 8;
    uint32_t rew = (k == 0) ? 0u : ((k == 1) ? 2u : 4u);
    c = make_call(); c.esi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = rew; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)rew;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD02480u, "SUNIT_RewindAndRescheduleAnimEvents_6FD02480_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 98. 0x6FD02600 SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c (esi=pUnit, stack=[pGame, nSlowPct], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t pAnim = (uint32_t)(uintptr_t)bump_alloc(0x120u);
    U8(pAnim + 0x10u + 3u) = 1u;
    U32(STAGE_UNIT0 + 0x50u) = pAnim;
    U32(STAGE_UNIT0 + 0x44u) = 94u << 8;
    U32(STAGE_UNIT0 + 0x48u) = 12u << 8;
    U16(STAGE_UNIT0 + 0x4Cu) = 1u << 8;
    uint32_t slow = (k == 0) ? 0u : ((k == 1) ? 25u : 60u);
    c = make_call(); c.esi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = slow; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)slow;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD02600u, "SUNIT_ScaleElapsedAndRescheduleAnimEvents_6FD02600_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 99. 0x6FCE4EA0 ACT2Q4_Callback_NpcActivateDialog_6FCE4EA0_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x104FD8u), 48u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t npcCls = (k == 0) ? 0x14Bu : 0xB0u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x0Cu, 0x20u);
    U32(STAGE_QUESTCTRL + 0x18u) = 0x12345679u;
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(12u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 12u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = (k == 0) ? 0x14Bu : 0xB0u;
      U16(tbl + 0x04u) = (uint16_t)(0x2D0u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 0) {
      U8(STAGE_QUESTEX0 + 0x0Eu) = 1u;
    } else if (k == 1) {
      set_quest_bit(pFlags, 0x0Cu, 1u);
    } else {
      U8(STAGE_QUEST0 + 0x0Cu) = 2u;
      U8(STAGE_QUEST0 + 0x09u) = 1u;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE4EA0u, "ACT2Q4_Callback_NpcActivateDialog_6FCE4EA0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 100. 0x6FCF47C0 ITEMS_ActivateEquippedItemStats113c (esi=pUnit, edi=pItem, stack=[bActivateBroken], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 1u, 2u, 0u);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0, 5, 0);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t bBrk = (k == 2) ? 1u : 0u;
    c = make_call(); c.esi = pU; c.edi = STAGE_UNIT1;
    c.nargs = 1u; c.args[0] = bBrk; c.calleePop = 4u;
    ts[0] = (int64_t)pU; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)bBrk;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF47C0u, "ITEMS_ActivateEquippedItemStats113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }
}



/* ------------------------------- Group 5 (VAs 101..125) */

static void emit_group_5(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* 101. 0x6FCF14B0 C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c (ecx=pGame, edx=pPlayer, stack=[pPacket, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, (k == 2) ? 0x11u : 1u, 4810u, 4810u, STAGE_CLIENT);
    if (k == 2) U8(STAGE_CLIENT + 0x0Au) = 0x04u;
    U8(STAGE_SCRATCH + 0u) = 0x41u;
    uint32_t len = (k == 0) ? 2u : 1u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF14B0u, "C2S_HandlePacket41_ResurrectPlayer_6FCF14B0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 102. 0x6FCECB50 C2S_ValidateWaypointInteraction_6FCECB50_113c (eax=dwObjGuid, stack=[pGame, pPlayer, wDestLevelId], ret C) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, g_obj_shrine_id, 0x301u, 0u, 4812u, 4812u, 111u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t guid = (k == 1) ? 0x999u : 0x301u;
    uint32_t dest = (k == 3) ? 1u : 0u;
    c = make_call(); c.eax = guid;
    c.nargs = 3u; c.args[0] = pG; c.args[1] = STAGE_UNIT0; c.args[2] = dest; c.calleePop = 12u;
    ts[0] = (int64_t)guid; ts[1] = (int64_t)pG; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)dest;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCECB50u, "C2S_ValidateWaypointInteraction_6FCECB50_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, (k == 0));
  }

  /* 103. 0x6FD0BE70 PLAYERSAVE_WriteStatsSection_6FD0BE70_113c (stack=[pPlayer, ppCurPos, pEndPos], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 25, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 3, 20, 0);
    uint32_t ppCur = STAGE_SCRATCH + 0x00u;
    uint32_t buf   = STAGE_SCRATCH + 0x40u;
    uint32_t pEnd  = (k == 0) ? (buf + 1u) : ((k == 1) ? (buf + 10u) : (buf + 0x400u));
    U32(ppCur) = buf;
    c = make_call();
    c.nargs = 3u; c.args[0] = STAGE_UNIT0; c.args[1] = ppCur; c.args[2] = pEnd; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)ppCur; ts[2] = (int64_t)pEnd;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0BE70u, "PLAYERSAVE_WriteStatsSection_6FD0BE70_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 104. 0x6FD02240 MONSTER_RefreshAiEvent113c (ecx=pUnit, edx=bSet, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    if (k == 0) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 0u, 4812u, 4812u);
      if (k == 1) {
        fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x5C, 1);
        uint32_t pEv = (uint32_t)(uintptr_t)bump_alloc(0x30u);
        U8(pEv + 0x00u) = 2u;
        U32(STAGE_UNIT0 + 0xDCu) = pEv;
      } else {
        U32(STAGE_UNIT0 + 0x80u) = 0u;
        fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1);
      }
    }
    uint32_t bSet = (k == 0) ? 1u : 0u;
    c = make_call(); c.ecx = STAGE_UNIT0; c.edx = bSet; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)bSet;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD02240u, "MONSTER_RefreshAiEvent113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 105. 0x6FCE8FD0 ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c (esi=pIoCoord, stack=[pQuestData, pRoom], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_timer_queue();
    stage_mon_reg(40u);
    stage_party_ctrl();
    stage_quest_node(0x0Eu, 0x50u);
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u)    = STAGE_QBITS0 + 0x20u;
    U32(STAGE_QBITS0 + 0x04u)    = 0x200u;
    U32(STAGE_SCRATCH + 0x00u)   = 4810u;
    U32(STAGE_SCRATCH + 0x04u)   = 4810u;
    if (k == 0) {
      U8(STAGE_QUESTEX0 + 0x0Du) = 1u;
    } else if (k == 1) {
      U8(STAGE_QUESTEX0 + 0x0Cu) = 1u;
      U32(STAGE_QUESTEX0 + 0x3Cu) = 0x201u;
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xC9u, 0x201u, 1u, 4812u, 4812u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    c = make_call(); c.esi = STAGE_SCRATCH;
    c.nargs = 2u; c.args[0] = STAGE_QUEST0; c.args[1] = STAGE_ROOM0; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_SCRATCH; ts[1] = (int64_t)STAGE_QUEST0; ts[2] = (int64_t)STAGE_ROOM0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE8FD0u, "ACT2Q0_RelocateJerhynBetweenPalaceAndHarem_6FCE8FD0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 106. 0x6FD089A0 ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c (ecx=pQuest, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x111C20u), 4u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_quest_node(0x15u, 0u);
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u)    = STAGE_QBITS0 + 0x20u;
    U32(STAGE_QBITS0 + 0x04u)    = 0x200u;
    if (k == 2) set_quest_bit(STAGE_QBITS0, 0x11u, 0x0Du);
    U32(STAGE_QUESTARG + 0x00u)  = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu)  = STAGE_UNIT0;
    U16(STAGE_QUESTARG + 0x14u)  = 0xFFu;
    U16(STAGE_QUESTARG + 0x18u)  = (k == 0) ? 0x240u : 0x252u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD089A0u, "ACT3Q5_OnNpcSpeechComplete_6FD089A0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 107. 0x6FD0B090 PLAYER_LevelUp_6FD0B090_113c (esi=pPlayer, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x111C3Cu), 4u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_party_ctrl();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    attach_skill(STAGE_UNIT0, 36, 1);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 1, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 13, (k == 0) ? 0 : ((k == 1) ? 5000 : 20000), 0);
    if (k == 2) insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    c = make_call(); c.esi = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0B090u, "PLAYER_LevelUp_6FD0B090_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 108. 0x6FCEE150 SPLAYER_BroadcastUnitMovementToClient113c (ecx=pGame, edx=pUnit, stack=[pClient, nModeIdx], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x102CE0u), 22u * 12u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pExCli = stage_extra_client();
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x102u, 1u, 4814u, 4816u, pExCli);
    uint32_t ppClis = (uint32_t)(uintptr_t)bump_alloc(8u);
    U32(ppClis) = STAGE_CLIENT;
    U32(STAGE_ROOM0 + 0x48u) = ppClis;
    U32(STAGE_ROOM0 + 0x78u) = 1u;
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t pU   = (k == 1) ? STAGE_UNIT0 : STAGE_UNIT1;
    uint32_t idx  = (k == 3) ? 2u : 1u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = pU;
    c.nargs = 2u; c.args[0] = pCli; c.args[1] = idx; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)pU; ts[2] = (int64_t)pCli; ts[3] = (int64_t)idx;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEE150u, "SPLAYER_BroadcastUnitMovementToClient113c", k, lbl, &c, ts, 4u, 0x00000000u, (k == 0));
  }

  /* 109. 0x6FCEC370 PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c (eax=pVictim, ecx=pKiller, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    uint32_t pVic = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pKil = (k == 1) ? 0u : STAGE_UNIT1;
    c = make_call(); c.eax = pVic; c.ecx = pKil;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)pVic; ts[1] = (int64_t)pKil; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEC370u, "PLRMODES_BroadcastSlainPlayerPacket5A_6FCEC370_113c", k, lbl, &c, ts, 3u, 0x00000000u, (k == 0));
  }

  /* 110. 0x6FD04AB0 ACT3Q3_KhalimsWillStatusFilter_6FD04AB0_113c (ecx=pQuestData, edx=pPlayer, stack=[pGFlags, pQFlags, pOut], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_quest_node(0x12u, 0u);
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k >= 1) set_quest_bit(pFlags, 0x0Fu, 0u);
    if (k == 1) set_quest_bit(pFlags, 0x12u, 2u);
    else if (k == 2) { U8(STAGE_QUEST0 + 0x09u) = 1u; U8(STAGE_QUEST0 + 0x0Cu) = 3u; }
    U32(STAGE_SCRATCH + 0u) = (k == 0) ? 0x55u : ((k == 2) ? 0x44u : 0u);
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = STAGE_SCRATCH + 0x40u; c.args[1] = pFlags; c.args[2] = STAGE_SCRATCH; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_UNIT0;
    ts[2] = (int64_t)(STAGE_SCRATCH + 0x40u); ts[3] = (int64_t)pFlags; ts[4] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD04AB0u, "ACT3Q3_KhalimsWillStatusFilter_6FD04AB0_113c", k, lbl, &c, ts, 5u, 0x000000FFu, 0);
  }

  /* 111. 0x6FCF05B0 ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c (eax=pCursorItem, ecx=pMerc, stack=[pGame, pPlayer], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pPlrInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pPlrInv;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 271u, 0x201u, 1u, 4812u, 4812u);
    uint32_t pMercInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_UNIT1 + 0x60u) = pMercInv;
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_pot, 0x401u, 4u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    fn_SetCursorItem((void *)(uintptr_t)pPlrInv, (void *)(uintptr_t)STAGE_UNIT2);
    if (k == 0) U32(STAGE_GAME + 0x70u) = 0u;
    else if (k == 2) U32(STAGE_UDATA2 + 0x14u) = 0x10u;
    c = make_call(); c.eax = STAGE_UNIT2; c.ecx = STAGE_UNIT1;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT2; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF05B0u, "ITEMS_UseOrEquipCursorItemOnMerc_6FCF05B0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 112. 0x6FCF0950 C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c (ecx=pGame, edx=pPlayer, stack=[pPkt, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x401u, 0u, 2u, 0u);
    U8(STAGE_UDATA1 + 0x45u) = 0u;
    fn_PlaceInGridCell((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1, 0, 0, 16, 0, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 1) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_gem, 0x402u, 4u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT2);
    }
    U8(STAGE_SCRATCH + 0u) = 0x63u;
    U32(STAGE_SCRATCH + 1u) = 0x401u;
    uint32_t pktLen = (k == 0) ? 3u : 5u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = pktLen; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)pktLen;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF0950u, "C2S_Packet63_ShiftMoveInventoryItemToBelt_6FCF0950_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 113. 0x6FD03E30 ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t npcCls = (k == 0) ? 0xFEu : 0xF5u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x14u, 0x20u);
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(12u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 12u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = npcCls;
      U16(tbl + 0x04u) = (uint16_t)(0x2E0u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 0) set_quest_bit(pFlags, 0x14u, 0u);
    else if (k == 1) set_quest_bit(pFlags, 0x14u, 1u);
    else { U8(STAGE_QUEST0 + 0x09u) = 1u; U8(STAGE_QUEST0 + 0x0Bu) = 2u; }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD03E30u, "ACT3Q1_AddGoldenBirdNpcDialogNodes_6FD03E30_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 114. 0x6FD12D80 AI_FleeFrom113c (eax=pFrom, stack=[pGame, pMonster, distSteps, bRun], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    attach_skill(STAGE_UNIT0, 0, 1);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4814u, 4814u, STAGE_CLIENT);
    uint32_t pFrom = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t dist  = (k == 2) ? 10u : 3u;
    uint32_t bRun  = (k == 2) ? 1u : 0u;
    c = make_call(); c.eax = pFrom;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = dist; c.args[3] = bRun;
    c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pFrom;
    ts[3] = (int64_t)dist; ts[4] = (int64_t)bRun;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD12D80u, "AI_FleeFrom113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 115. 0x6FD0C260 PLAYERSAVE_WriteCorpseSection_6FD0C260_113c (stack=[pGame, pPlayer, ppIoBuf, pBufEnd, 0, 0], ret 18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    if (k >= 1) {
      uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = pInv;
    }
    uint32_t pBufStart = STAGE_SCRATCH + 0x100u;
    uint32_t pBufEnd   = (k == 1) ? (pBufStart + 2u) : (pBufStart + 0x80u);
    U32(STAGE_SCRATCH + 0u) = pBufStart;
    c = make_call();
    c.nargs = 6u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0;
    c.args[2] = STAGE_SCRATCH; c.args[3] = pBufEnd; c.args[4] = 0u; c.args[5] = 0u;
    c.calleePop = 24u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)pBufEnd; ts[4] = 0; ts[5] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0C260u, "PLAYERSAVE_WriteCorpseSection_6FD0C260_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* 116. 0x6FCF60D0 ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c (eax=dwGuid, ecx=pUnit, stack=[pGame, bodyLoc, bSec, pOut], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_skill(STAGE_UNIT0, 36, 1);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    uint32_t itmId = (k == 1) ? g_item_ring : g_item_sword;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, itmId, 0x401u, 4u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    uint32_t guid = (k == 0) ? 0x9999u : 0x401u;
    uint32_t loc  = (k == 1) ? 1u : 4u;
    U32(STAGE_SCRATCH) = 0u;
    c = make_call(); c.eax = guid; c.ecx = STAGE_UNIT0;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = loc; c.args[2] = 0u; c.args[3] = STAGE_SCRATCH;
    c.calleePop = 16u;
    ts[0] = (int64_t)guid; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    ts[3] = (int64_t)loc; ts[4] = 0; ts[5] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF60D0u, "ITEMS_EquipCursorItemToBodyLoc_6FCF60D0_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* 117. 0x6FD042F0 ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x101550u), 16u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t npcCls = (k == 1) ? 0xFCu : 0xFFu;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x13u, 0x20u);
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(8u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 8u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = npcCls;
      U16(tbl + 0x04u) = (uint16_t)(0x2F0u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 0) {
      set_quest_bit(pFlags, 0x13u, 0u);
      U16(STAGE_QUEST0 + 0x9Cu) = 1u;
      U32(STAGE_QUEST0 + 0x1Cu) = 0x101u;
    } else if (k == 1) {
      set_quest_bit(pFlags, 0x13u, 6u);
    } else {
      U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD042F0u, "ACT3Q2_AddGidbinnNpcDialogNodes_6FD042F0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 118. 0x6FCF76A0 ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c (ecx=szFile, edx=nLine, stack=[pGame, pOwner, dwGuid, x, y, bAuto, bUpd, nInvPageOrPtr], ret 20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_gem, 0x401u, 4u, 2u, 0u);
    U8(STAGE_UDATA1 + 0x45u) = 0u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    uint32_t szFile = STAGE_SCRATCH + 0x200u;
    U8(szFile + 0u) = 'o'; U8(szFile + 1u) = 'r'; U8(szFile + 2u) = 'a'; U8(szFile + 3u) = '\0';
    uint32_t pG    = (k == 0) ? 0u : STAGE_GAME;
    uint32_t bAuto = (k == 2) ? 1u : 0u;
    uint32_t bUpd  = (k == 1) ? 1u : 0u;
    c = make_call(); c.ecx = szFile; c.edx = 100u;
    c.nargs = 8u;
    c.args[0] = pG; c.args[1] = STAGE_UNIT0; c.args[2] = 0x401u;
    c.args[3] = 0u; c.args[4] = 0u; c.args[5] = bAuto; c.args[6] = bUpd; c.args[7] = 0u;
    c.calleePop = 32u;
    ts[0] = (int64_t)szFile; ts[1] = 100; ts[2] = (int64_t)pG; ts[3] = (int64_t)STAGE_UNIT0;
    ts[4] = 0x401; ts[5] = 0; ts[6] = 0; ts[7] = (int64_t)bAuto; ts[8] = (int64_t)bUpd; ts[9] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF76A0u, "ITEMS_PlaceItemInUnitInventoryGrid_6FCF76A0_113c", k, lbl, &c, ts, 10u, 0xFFFFFFFFu, 0);
  }

  /* 119. 0x6FD08FE0 ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c (ecx=pQuest, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xF5u, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x11u, 0x20u);
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = alloc_quest_record();
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_QUESTARG + 0x14u) = (k == 0) ? 1u : 0xFEu;
    U16(STAGE_QUESTARG + 0x18u) = (k == 1) ? 0x225u : 0x234u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD08FE0u, "ACT3Q4_OnNpcSpeechComplete_6FD08FE0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 120. 0x6FCF34B0 ITEMS_InsertScrollIntoTome_6FCF34B0_113c (eax=dwScrollGuid, stack=[pGame, pUnit, dwTomeGuid, pOutReject], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_scroll, 0x401u, 4u, 2u, 0u);
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_tome, 0x402u, 0u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 0u, 0u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x46, (k == 1) ? 20 : 3, 0);
    uint32_t sGuid = (k == 0) ? 0x9999u : 0x401u;
    U32(STAGE_SCRATCH) = 0u;
    c = make_call(); c.eax = sGuid;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0;
    c.args[2] = 0x402u; c.args[3] = STAGE_SCRATCH; c.calleePop = 16u;
    ts[0] = (int64_t)sGuid; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0;
    ts[3] = 0x402; ts[4] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF34B0u, "ITEMS_InsertScrollIntoTome_6FCF34B0_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 121. 0x6FCF5A00 ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c (eax=pUnit, stack=[pGame, dwCursorGuid, dwBeltGuid, pOutReject], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_skill(STAGE_UNIT0, 36, 1);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x401u, 4u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    uint32_t bMode = (k == 1) ? 0u : 2u;
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_pot, 0x402u, bMode, 2u, 0u);
    if (bMode == 2u) {
      fn_AutoPlaceInBelt((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT2);
    }
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    uint32_t cGuid = (k == 0) ? 0x9999u : 0x401u;
    U32(STAGE_SCRATCH) = 0u;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = cGuid;
    c.args[2] = 0x402u; c.args[3] = STAGE_SCRATCH; c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)cGuid;
    ts[3] = 0x402; ts[4] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF5A00u, "ITEMS_SwapCursorItemWithBeltItem_6FCF5A00_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 122. 0x6FCF8970 ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c (ecx=pGame, edx=pOwner, stack=[bodyLoc, bToCursor, pOut], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_skill(STAGE_UNIT0, 36, 1);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    if (k >= 1) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_armor, 0x401u, 1u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 3);
      U8(STAGE_UDATA1 + 0x44u) = 3u;
    }
    if (k == 1) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_gem, 0x402u, 4u, 2u, 0u);
      fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT2);
    }
    U32(STAGE_SCRATCH) = 0u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = 3u; c.args[1] = 0u; c.args[2] = STAGE_SCRATCH; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    ts[2] = 3; ts[3] = 0; ts[4] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF8970u, "ITEMS_UnequipItemFromBodyLocToCursor_6FCF8970_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 123. 0x6FCF2610 ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c (eax=pItem, stack=[pUnit, pOutLoc, bSkipReqs], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    uint32_t itmId = (k == 0) ? g_item_gem : ((k == 1) ? g_item_armor : g_item_ring);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, itmId, 0x401u, 4u, 2u, 0u);
    U32(STAGE_UDATA1 + 0x18u) = 0x10u;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_ring, 0x402u, 1u, 2u, 0u);
      U32(STAGE_UDATA2 + 0x18u) = 0x10u;
      place_body_item(STAGE_UNIT0, STAGE_UNIT2, 6);
    }
    uint32_t bSkip = (k == 1) ? 1u : 0u;
    U32(STAGE_SCRATCH) = 0u;
    c = make_call(); c.eax = STAGE_UNIT1;
    c.nargs = 3u; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_SCRATCH; c.args[2] = bSkip; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_UNIT0;
    ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)bSkip;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF2610u, "ITEMS_FindFreeAutoEquipBodyLoc_6FCF2610_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 124. 0x6FD122C0 AI_Stall113c (eax=pGame, esi=pMonster, stack=[nDelayFrames], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    uint32_t mode = (k == 2) ? 2u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, mode, 4810u, 4810u);
    U32(STAGE_GAME + 0xA8u) = 10u;
    uint32_t delay = (k == 0) ? 0u : ((k == 1) ? 25u : 10u);
    c = make_call(); c.eax = STAGE_GAME; c.esi = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = delay; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)delay;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD122C0u, "AI_Stall113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 125. 0x6FCE3BD0 ACT2Q2_StatusFilter_6FCE3BD0_113c (ecx=pQuestData, edx=pPlayer, stack=[pGFlags, pQFlags, pOut], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_quest_node(0x0Au, 0x30u);
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k >= 1) {
      set_quest_bit(pFlags, 7u, 0u);
      set_quest_bit(pFlags, 0x0Au, 0u);
    }
    if (k == 1) set_quest_bit(pFlags, 0x0Au, 0x0Au);
    else if (k == 2) {
      set_quest_bit(pFlags, 0x0Eu, 0u);
      set_quest_bit(pFlags, 0x0Au, 0x0Du);
    }
    U32(STAGE_SCRATCH) = 0u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = STAGE_SCRATCH + 0x40u; c.args[1] = pFlags; c.args[2] = STAGE_SCRATCH;
    c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_UNIT0;
    ts[2] = (int64_t)(STAGE_SCRATCH + 0x40u); ts[3] = (int64_t)pFlags; ts[4] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE3BD0u, "ACT2Q2_StatusFilter_6FCE3BD0_113c", k, lbl, &c, ts, 5u, 0x000000FFu, 0);
  }
}

/* ------------------------------- Group 6 (VAs 126..150) */

static void emit_group_6(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* 126. 0x6FD12540 AI_ApproachTarget113c (ecx=pGame, edx=pMonster, stack=[pTarget, nMode, targetX, targetY, stepNum, flags], ret 18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    uint32_t mode = (k == 2) ? 12u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, mode, 4810u, 4810u);
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x3Cu, 1);
      uint32_t pCtrl = U32(STAGE_UDATA0 + 0x2Cu);
      U32(pCtrl + 0x18u) = 7u;
      U32(pCtrl + 0x1Cu) = 99u;
      U8(pCtrl + 0x20u)  = 5u;
    } else if (k == 2) {
      uint32_t pEv = (uint32_t)(uintptr_t)bump_alloc(0x30u);
      U8(pEv + 0x00u) = 2u;
      U32(STAGE_UNIT0 + 0xDCu) = pEv;
    }
    uint32_t callMode = (k == 1) ? 15u : 2u;
    uint32_t flags    = (k == 2) ? 5u : 0u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 6u; c.args[0] = 0u; c.args[1] = callMode; c.args[2] = 4814u;
    c.args[3] = 4814u; c.args[4] = 1u; c.args[5] = flags; c.calleePop = 0x18u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = 0;
    ts[3] = (int64_t)callMode; ts[4] = 4814; ts[5] = 4814; ts[6] = 1; ts[7] = (int64_t)flags;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD12540u, "AI_ApproachTarget113c", k, lbl, &c, ts, 8u, 0xFFFFFFFFu, 0);
  }

  /* 127. 0x6FD0E480 MONSTER_SpawnPartyMinions113c (eax=pSpawnArgs, stack=[pLeader], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0xFC298u), 144u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t monCls = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 0x105u : 0x106u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0) ? 1u : monCls, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_PATH1 + 0x1Cu) = 0u;
    U32(STAGE_UNIT1 + 0x20u) = 0x12345u + (uint32_t)k * 0x1111u;
    U32(STAGE_UNIT1 + 0x24u) = 0x6789u;
    uint32_t pAiGen = STAGE_SCRATCH + 0x100u;
    U32(STAGE_UDATA1 + 0x28u) = pAiGen;
    uint32_t pSpawnArgs = STAGE_SCRATCH + 0x00u;
    U32(pSpawnArgs + 0x00u) = STAGE_GAME;
    U32(pSpawnArgs + 0x0Cu) = monCls;
    U16(pSpawnArgs + 0x24u) = (k == 2) ? 4u : 0u;
    c = make_call(); c.eax = pSpawnArgs; c.nargs = 1u; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = (int64_t)pSpawnArgs; ts[1] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0E480u, "MONSTER_SpawnPartyMinions113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 128. 0x6FD0C7F0 PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c (ecx=pPlayerUnit, edx=pGame, stack=[pOutBuf, pOutSize, nMaxBufSize, arg4, arg5], ret 14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSk128 = attach_skill(STAGE_UNIT0, 36, 1);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x08u) = pSk128;
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x0Cu) = pSk128;
    snprintf((char *)(uintptr_t)(STAGE_CLIENT + 0x0Du), 16, "%s", "Hero");
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 1, 0);
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pOutBuf  = STAGE_SCRATCH + 0x100u;
    uint32_t pOutSize = STAGE_SCRATCH + 0x00u;
    U32(pOutSize) = 0xDEADBEEFu;
    uint32_t nMax = (k == 2) ? 0x160u : 0x10u;
    c = make_call(); c.ecx = pPlr; c.edx = STAGE_GAME;
    c.nargs = 5u; c.args[0] = pOutBuf; c.args[1] = pOutSize; c.args[2] = nMax; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 20u;
    ts[0] = (int64_t)pPlr; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)pOutBuf;
    ts[3] = (int64_t)pOutSize; ts[4] = (int64_t)nMax; ts[5] = 0; ts[6] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0C7F0u, "PLAYERSAVE_WriteSaveFileBuffer_6FD0C7F0_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 129. 0x6FCF62E0 ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c (eax=pOverrideInv, ecx=pUnit, stack=[pGame, dwItemGuid, pOutError, bSetCursorAndFlags, bSetCmdFlag20, bAllowWhenCursorFull], ret 18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    attach_skill(STAGE_UNIT0, 36, 1);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x401u, 0u, 0u, 0u);
    U32(STAGE_UDATA1 + 0x18u) |= 0x00000010u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t guid = (k == 1) ? 0x999u : 0x401u;
    uint32_t pOutErr = STAGE_SCRATCH + 0x00u;
    c = make_call(); c.eax = 0u; c.ecx = STAGE_UNIT0;
    c.nargs = 6u; c.args[0] = pG; c.args[1] = guid; c.args[2] = pOutErr;
    c.args[3] = 1u; c.args[4] = 0u; c.args[5] = 0u; c.calleePop = 24u;
    ts[0] = 0; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pG; ts[3] = (int64_t)guid;
    ts[4] = (int64_t)pOutErr; ts[5] = 1; ts[6] = 0; ts[7] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF62E0u, "ITEMS_RemoveStoredItemToCursor_6FCF62E0_113c", k, lbl, &c, ts, 8u, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }

  /* 130. 0x6FCE2B00 ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x105938u), 32u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t npcCls = (k == 0) ? 0xFBu : ((k == 1) ? 0xB0u : 0xB3u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x0Eu, 0x30u);
    U32(STAGE_QUEST0 + 0xE0u) = 9u;
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(9u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 9u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = npcCls;
      U16(tbl + 0x04u) = (uint16_t)(0x260u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    uint32_t pFlags = U32(STAGE_UDATA0 + 0x10u);
    if (k == 0) {
      U32(STAGE_QUESTEX0 + 0x18u) = 2u;
    } else if (k == 1) {
      set_quest_bit(pFlags, 0x0Eu, 0x0Du);
    } else {
      set_quest_bit(pFlags, 0x0Eu, 3u);
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE2B00u, "ACT2Q6_Callback00_NpcActivate_6FCE2B00_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 131. 0x6FCF4A70 ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c (eax=dwFillerGuid, stack=[pGame, pUnit, dwTargetGuid, pOutReject, bSync, bClear, bReqStored, bRech], ret 20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_gem, 0x401u, 4u, 0u, 0u);
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_sword, 0x402u, 0u, 0u, 0u);
    U32(STAGE_UDATA1 + 0x18u) |= 0x00000010u;
    U32(STAGE_UDATA2 + 0x18u) |= 0x00000810u;
    U32(STAGE_UNIT0 + 0xC4u) |= 0x00004000u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 0u, 0u, 0u);
    uint32_t filGuid = (k == 1) ? 0x999u : 0x401u;
    uint32_t pG      = (k == 0) ? 0u : STAGE_GAME;
    uint32_t pOutRej = STAGE_SCRATCH + 0x00u;
    c = make_call(); c.eax = filGuid;
    c.nargs = 8u; c.args[0] = pG; c.args[1] = STAGE_UNIT0; c.args[2] = 0x402u;
    c.args[3] = pOutRej; c.args[4] = 0u; c.args[5] = 0u; c.args[6] = 1u; c.args[7] = 0u; c.calleePop = 32u;
    ts[0] = (int64_t)filGuid; ts[1] = (int64_t)pG; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = 0x402;
    ts[4] = (int64_t)pOutRej; ts[5] = 0; ts[6] = 0; ts[7] = 1; ts[8] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF4A70u, "ITEMS_InsertFillerIntoSocketedItem_6FCF4A70_113c", k, lbl, &c, ts, 9u, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }

  /* 132. 0x6FD04C90 ACT3Q3_AddKhalimsWillCainDialogNodes_6FD04C90_113c (ecx=pQuestData, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t npcCls = (k == 0) ? 0xFEu : 0xF5u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x12u, 0x20u);
    U32(STAGE_QUEST0 + 0xE0u) = 9u;
    uint32_t pMsgTbls = (uint32_t)(uintptr_t)bump_alloc(9u * 0xC4u);
    U32(STAGE_QUEST0 + 0xDCu) = pMsgTbls;
    for (uint32_t t = 0u; t < 9u; t++) {
      uint32_t tbl = pMsgTbls + t * 0xC4u;
      U32(tbl + 0x00u) = 0xF5u;
      U16(tbl + 0x04u) = (uint16_t)(0x260u + t);
      U32(tbl + 0x08u) = 1u;
      U32(tbl + 0xC0u) = 1u;
    }
    if (k == 1) {
      U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    } else if (k == 2) {
      set_quest_bit(U32(STAGE_UDATA0 + 0x10u), 0x12u, 2u);
      uint32_t qf1Id = 0u;
      uint32_t nItems = U32(D2COM_VA(0x9FB94u) + g_com_rebase);
      uint32_t pItems = U32(D2COM_VA(0x9FB98u) + g_com_rebase);
      for (uint32_t id = 0; id < nItems; id++) {
        if (U32(pItems + id * 0x1A8u + 0x80u) == 0x20316671u) { qf1Id = id; break; }
      }
      uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = pInv;
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, qf1Id, 0x402u, 0u, 0u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 0u, 0u, 0u);
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x80u;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD04C90u, "ACT3Q3_AddKhalimsWillCainDialogNodes_6FD04C90_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 133. 0x6FCF2F00 ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c (edi=pPlayer, stack=[pGame, pCandidateItem], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x102CC0u), 32u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    if (k >= 1) {
      uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = pInv;
    }
    uint32_t candCls = (k == 2) ? g_item_box : g_item_sword;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, candCls, 0x401u, 3u, 0u, 0u);
    uint32_t pCand = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call(); c.edi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = pCand; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)pCand;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF2F00u, "ITEMS_CanPlayerPickupUniqueOrQuestItem_6FCF2F00_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 134. 0x6FD09600 ACT3Q2_OnNpcSpeechComplete_6FD09600_113c (ecx=pQuest, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_quest_node(0x13u, 0x30u);
    if (k == 0) set_quest_bit(U32(STAGE_UDATA0 + 0x10u), 0x13u, 0u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_QUESTARG + 0x14u) = (k == 1) ? 0xFDu : 0xFFu;
    U16(STAGE_QUESTARG + 0x18u) = (k == 1) ? 0x23Bu : 0x24Bu;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD09600u, "ACT3Q2_OnNpcSpeechComplete_6FD09600_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 135. 0x6FCF9470 D2GAME_ITEMSTAT_OnStatChangedCallback113c (ecx=pGame, edx=pUnit, stack=[pItemUnit, dwStatAndLayer, nOldValue, nNewValue], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t statId = (k == 0) ? 7u : ((k == 1) ? 9u : 11u);
    uint32_t curId  = statId - 1u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, (int32_t)curId, 0x800, 0);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 4u; c.args[0] = 0u; c.args[1] = (statId << 16); c.args[2] = 0x1000u; c.args[3] = 0x2000u; c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = 0;
    ts[3] = (int64_t)(statId << 16); ts[4] = 0x1000; ts[5] = 0x2000;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF9470u, "D2GAME_ITEMSTAT_OnStatChangedCallback113c", k, lbl, &c, ts, 6u, 0x00000000u, 0);
  }

  /* 136. 0x6FD0E7B0 MONSTER_PostSpawnQuestAndSpecialInit113c (eax=pSpawnArgs, ecx=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    uint32_t monCls = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 0x154u : 0xFAu);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 1u : monCls, 0x201u, 1u, 4810u, 4810u);
    if (k == 2) stage_quest_node(0x0Cu, 0x20u);
    uint32_t pSpawnArgs = STAGE_SCRATCH;
    U32(pSpawnArgs + 0x00u) = STAGE_GAME;
    U32(pSpawnArgs + 0x0Cu) = monCls;
    c = make_call(); c.eax = pSpawnArgs; c.ecx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)pSpawnArgs; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0E7B0u, "MONSTER_PostSpawnQuestAndSpecialInit113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 137. 0x6FCFF1A0 MONREG_GenerateOutfitVariants113c (stack=[pSeed, pOutfitEntry, nMaxVariants], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pSeed   = STAGE_SCRATCH + 0x00u;
    uint32_t pOutfit = STAGE_SCRATCH + 0x20u;
    U32(pSeed + 0x00u) = 0x12345u + (uint32_t)k * 777u;
    U32(pSeed + 0x04u) = 0x6789u;
    U16(pOutfit + 0x00u) = (k == 2) ? 2u : (uint16_t)g_mon_id_1;
    uint32_t maxVar = (k == 0) ? 0u : (uint32_t)k;
    c = make_call();
    c.nargs = 3u; c.args[0] = pSeed; c.args[1] = pOutfit; c.args[2] = maxVar; c.calleePop = 12u;
    ts[0] = (int64_t)pSeed; ts[1] = (int64_t)pOutfit; ts[2] = (int64_t)maxVar;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFF1A0u, "MONREG_GenerateOutfitVariants113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 138. 0x6FD01610 SUNIT_UpdateUnitPositionAndRoom113c (eax=pTargetRoomArg, ebx=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    U32(STAGE_UDATA0 + 0x50u) = 0x11223344u;
    if (k >= 1) U32(STAGE_PATH0 + 0x34u) = 2u;
    if (k == 2) {
      uint32_t cliArr = (uint32_t)(uintptr_t)bump_alloc(4u);
      U32(cliArr) = STAGE_CLIENT;
      U32(STAGE_CLIENT + 0x3D4u) = 1u;
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
      U32(STAGE_ROOM1 + 0x48u)   = cliArr;
      U32(STAGE_ROOM1 + 0x78u)   = 1u;
    }
    uint32_t pTgtRoom = STAGE_ROOM1;
    c = make_call(); c.eax = pTgtRoom; c.ebx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)pTgtRoom; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD01610u, "SUNIT_UpdateUnitPositionAndRoom113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 139. 0x6FCF6E30 ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c (eax=dwItemGuid, stack=[pGame, pPlayer, pOutErrorCode], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    attach_skill(STAGE_UNIT0, 36, 1);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x401u, 3u, 4811u, 4811u);
    U32(STAGE_UDATA1 + 0x18u) |= 0x00000010u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t guid = (k == 1) ? 0x999u : 0x401u;
    uint32_t pG   = (k == 0) ? 0u : STAGE_GAME;
    uint32_t pErr = STAGE_SCRATCH + 0x00u;
    c = make_call(); c.eax = guid;
    c.nargs = 3u; c.args[0] = pG; c.args[1] = STAGE_UNIT0; c.args[2] = pErr; c.calleePop = 12u;
    ts[0] = (int64_t)guid; ts[1] = (int64_t)pG; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)pErr;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF6E30u, "ITEMS_PickupGroundItemToInventoryOrEquip_6FCF6E30_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }

  /* 140. 0x6FD08B60 ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c (ecx=pQuest, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xF5u, 0x201u, 1u, 4812u, 4812u);
    stage_quest_node(0x14u, 0x30u);
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = alloc_quest_record();
    if (k == 0) set_quest_bit(U32(STAGE_UDATA0 + 0x10u), 0x14u, 0u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_QUESTARG + 0x14u) = 0xF5u;
    U16(STAGE_QUESTARG + 0x18u) = (k == 2) ? 0x213u : 0x20Fu;
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD08B60u, "ACT3Q1_OnNpcSpeechComplete_6FD08B60_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 141. 0x6FD0C470 PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c (eax=pPlayerUnit, stack=[pGame, ppIoBuf, pBufEnd], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSk141 = attach_skill(STAGE_UNIT0, 36, 1);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x08u) = pSk141;
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x0Cu) = pSk141;
    snprintf((char *)(uintptr_t)(STAGE_CLIENT + 0x0Du), 16, "%s", "Hero");
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 1, 0);
    uint32_t ppBuf  = STAGE_SCRATCH + 0x00u;
    uint32_t pOut   = STAGE_SCRATCH + 0x40u;
    uint32_t pEnd   = pOut + ((k == 2) ? 0x200u : 0x10u);
    U32(ppBuf) = pOut;
    uint32_t pPlr   = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = pPlr;
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = ppBuf; c.args[2] = pEnd; c.calleePop = 12u;
    ts[0] = (int64_t)pPlr; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)ppBuf; ts[3] = (int64_t)pEnd;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0C470u, "PLAYERSAVE_WriteSaveHeader335_6FD0C470_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 142. 0x6FD13A40 D2GAME_MONSTER_SyncMonsterUnitToClient113c (stack=[pGame, pUnit, pClient, bPreSynced], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    if (k >= 1) U32(STAGE_UNIT1 + 0xC4u) |= 0x00080000u;
    if (k == 2) U8(STAGE_UNIT1 + 0xCAu) |= 0x01u;
    c = make_call();
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_CLIENT; c.args[3] = 1u; c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_CLIENT; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD13A40u, "D2GAME_MONSTER_SyncMonsterUnitToClient113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 143. 0x6FCEDBB0 PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c (ecx=pGame, edx=pPlayer, stack=[pPacket, nPacketLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x1101E0u), 8u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    snprintf((char *)(uintptr_t)(STAGE_CLIENT + 0x0Du), 16, "%s", "Hero");
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0);
    uint8_t *pkt = (uint8_t *)(uintptr_t)STAGE_SCRATCH;
    pkt[0] = 0x15u; pkt[1] = 0x00u; pkt[2] = (k == 2) ? 0x02u : 0x00u;
    pkt[3] = 'H'; pkt[4] = 'i'; pkt[5] = 0u;
    uint32_t pktLen = 6u;
    if (k == 1) {
      pkt[6] = 0u;
      pktLen = 7u;
    } else if (k == 2) {
      pkt[6] = 'B'; pkt[7] = 'o'; pkt[8] = 'b'; pkt[9] = 0u;
      pktLen = 10u;
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_SCRATCH; c.args[1] = pktLen; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)pktLen;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEDBB0u, "PACKET_ProcessChatOrWhisperMessage_6FCEDBB0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 144. 0x6FCF9FB0 ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c (eax=dwScrollGuid, edx=pUnit, ecx=dwTargetGuid, stack=[pGame, pOutError], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_scroll, 0x401u, 0u, 0u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    if (k == 2) U32(STAGE_UNIT0 + 0xC4u) |= 0x00004000u;
    uint32_t scrGuid = (k == 1) ? 0x999u : 0x401u;
    uint32_t tgtGuid = (k == 2) ? 0u : 0x402u;
    uint32_t pG      = (k == 0) ? 0u : STAGE_GAME;
    uint32_t pErr    = STAGE_SCRATCH + 0x00u;
    c = make_call(); c.eax = scrGuid; c.edx = STAGE_UNIT0; c.ecx = tgtGuid;
    c.nargs = 2u; c.args[0] = pG; c.args[1] = pErr; c.calleePop = 8u;
    ts[0] = (int64_t)scrGuid; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)tgtGuid; ts[3] = (int64_t)pG; ts[4] = (int64_t)pErr;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF9FB0u, "ITEMS_UseScrollOrTomeOnTargetItem_6FCF9FB0_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }

  /* 145. 0x6FCE85A0 ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c (ecx=pQuest, edx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_quest_node(0x0Cu, 0x30u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUEST0 + 0x0Bu) = 1u;
    U8(STAGE_QUESTEX0 + 0x16u) = 1u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U16(STAGE_QUESTARG + 0x14u) = (k == 2) ? 0xB0u : 0x14Bu;
    U16(STAGE_QUESTARG + 0x18u) = (k == 0) ? 0xBAu : ((k == 1) ? 0xBCu : 0x18Cu);
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCE85A0u, "ACT2Q4_Callback01_NpcDeactivate_6FCE85A0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 146. 0x6FCF9BF0 ITEMS_UseInventoryItem_6FCF9BF0_113c (eax=dwItemGuid, edx=pGame, ecx=pUnit, stack=[nX, nY, pOutError], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_tome, 0x401u, 0u, 0u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    uint32_t guid = (k == 1) ? 0x999u : 0x401u;
    uint32_t pG   = (k == 0) ? 0u : STAGE_GAME;
    uint32_t pErr = STAGE_SCRATCH + 0x00u;
    c = make_call(); c.eax = guid; c.edx = pG; c.ecx = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = 0u; c.args[1] = 0u; c.args[2] = pErr; c.calleePop = 12u;
    ts[0] = (int64_t)guid; ts[1] = (int64_t)pG; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = 0; ts[4] = 0; ts[5] = (int64_t)pErr;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF9BF0u, "ITEMS_UseInventoryItem_6FCF9BF0_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }

  /* 147. 0x6FCF51A0 D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c (stack=[pGame, pUnit, bSendPacket], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_skill(STAGE_UNIT0, 36, 1);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 0x401u, 1u, 0u, 0u);
      U32(STAGE_UDATA1 + 0x18u) |= 0x00000100u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 6);
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t bSend = (k == 2) ? 1u : 0u;
    c = make_call();
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = pU; c.args[2] = bSend; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)pU; ts[2] = (int64_t)bSend;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF51A0u, "D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 148. 0x6FCF01D0 C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0_113c (eax=nTargetUnitType, ecx=pGame, edx=bAltFlag, stack=[pPlayerUnit, dwTargetGuid], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0xFA3FCu), 20u * 8u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4815u, 4815u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t tgtType = (k == 0) ? 9u : ((k == 1) ? 0u : 1u);
    uint32_t tgtGuid = (k == 2) ? 0x201u : 0x999u;
    c = make_call(); c.eax = tgtType; c.ecx = STAGE_GAME; c.edx = 0u;
    c.nargs = 2u; c.args[0] = STAGE_UNIT0; c.args[1] = tgtGuid; c.calleePop = 8u;
    ts[0] = (int64_t)tgtType; ts[1] = (int64_t)STAGE_GAME; ts[2] = 0;
    ts[3] = (int64_t)STAGE_UNIT0; ts[4] = (int64_t)tgtGuid;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF01D0u, "C2S_ExecuteEntityInteractionOrRunToTarget_6FCF01D0_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 149. 0x6FCF78C0 D2Game_6FCF78C0_113c (stack=[pGame, pPlayer, pCubeItem], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 2) ? g_item_box : g_item_sword, 0x401u, 0u, 0u, 0u);
    if (k == 2) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_pot, 0x402u, 0u, 0u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 3u, 0u, 1u);
    }
    uint32_t pCube = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call();
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = pCube; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pCube;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF78C0u, "D2Game_6FCF78C0_113c", k, lbl, &c, ts, 3u, 0x00000000u, (k == 0) ? 1 : 0);
  }

  /* 150. 0x6FCF8EA0 ITEMS_SwitchWeaponSlots_6FCF8EA0_113c (eax=pUnit, stack=[pGame, pOutError], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSk150 = attach_skill(STAGE_UNIT0, 36, 1);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x08u) = pSk150;
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x0Cu) = pSk150;
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 1u, 0u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
    }
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t pErr = STAGE_SCRATCH + 0x00u;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = pG; c.args[1] = pErr; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)pG; ts[2] = (int64_t)pErr;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF8EA0u, "ITEMS_SwitchWeaponSlots_6FCF8EA0_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }
}
