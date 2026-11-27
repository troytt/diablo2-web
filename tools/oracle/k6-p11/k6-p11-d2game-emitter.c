/*
 * K6-P11 D2Game.dll Band A+D (0x6FC20000..0x6FC6FFFF, 0x6FCE0000..0x6FD142D0) Closer Emitter
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

static __attribute__((unused)) void record_alloc(uint32_t ptr, uint32_t size) {
  if (g_alloc_count < 2048u) {
    g_allocs[g_alloc_count].ptr  = ptr;
    g_allocs[g_alloc_count].size = size;
    g_alloc_count++;
  }
}

static __attribute__((unused)) uint32_t lookup_alloc_size(uint32_t ptr) {
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
    fprintf(stderr, "[k6-p11] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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

static __attribute__((unused)) void hook_module_iat_ptr(HMODULE m, void *origFn, void *hookFn) {
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

static __attribute__((unused)) void install_hooks(void) {
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
      fprintf(stderr, "[k6-p11] missing Fog.#%u\n", fogHooks[i].ord);
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

static __attribute__((unused)) void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-p11] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p11] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_VA(0x99000u) + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p11] short read at page %u\n", i);
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

static __attribute__((unused)) void add_extra_cap(uint32_t canonAddr, uint32_t len) {
  if (len == 0u) return;
  for (uint32_t i = 0u; i < g_extra_cap_count; i++) {
    if (g_extra_caps[i].addr == canonAddr) {
      if (len > g_extra_caps[i].len) g_extra_caps[i].len = len;
      return;
    }
  }
  if (g_extra_cap_count >= MAX_EXTRA_CAPS) {
    fprintf(stderr, "[k6-p11] extra_caps overflow\n");
    TerminateProcess(GetCurrentProcess(), 22);
  }
  g_extra_caps[g_extra_cap_count].addr = canonAddr;
  g_extra_caps[g_extra_cap_count].len  = len;
  g_extra_cap_count++;
}

static __attribute__((unused)) uint32_t canon_to_live_addr(uint32_t canonAddr) {
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

static __attribute__((unused)) void format_mem_runs_range(
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
        fprintf(stderr, "[k6-p11] mem json buffer overflow\n");
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

static __attribute__((unused)) void capture_stage_json(char *out, size_t cap, uint32_t setupTop) {
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
    fprintf(stderr, "[k6-p11] mem json cap overflow\n");
    TerminateProcess(GetCurrentProcess(), 25);
  }
  out[len++] = ']';
  out[len]   = '\0';
}


static __attribute__((unused)) void canonicalize_d2game_ptrs_range(uint32_t startAddr, uint32_t endAddr) {
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

static __attribute__((unused)) uint32_t game_global_live(uint32_t canonVa) {
  return (uint32_t)(canonVa + g_game_rebase);
}

static __attribute__((unused)) void reset_case(void) {
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
  U16(STAGE_GAME + 0x78u)    = 100u;
  U32(STAGE_GAME + 0xA8u)    = 100u;
  U32(STAGE_GAME + 0xD0u)    = 0x13579BDFu;
  U32(STAGE_GAME + 0xD4u)    = 0x0000029Au;
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

static __attribute__((unused)) void run_and_emit(
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
  g_heap_top = HEAP_BASE;
  g_thunk_in_call  = 1;
  thunk_invoke();
  g_thunk_in_call  = 0;
  g_in_setup_phase = 1;

  if (g_thunk_faulted == 1) {
    fprintf(stderr,
            "[k6-p11] UNEXPECTED FAULT %s case %d (%s) code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            name, caseIdx, label, g_fault_code, g_fault_eip,
            (unsigned long)((g_fault_eip >= (uintptr_t)g_hGame && g_fault_eip < (uintptr_t)g_hGame + 0x130000u) ? (g_fault_eip - g_game_rebase) : 0u),
            g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }
  int asserted = (g_thunk_faulted == 2);
  if (asserted != (expectAssert != 0)) {
    fprintf(stderr,
            "[k6-p11] ASSERT MISMATCH %s (0x%08X) case %d (%s): expected=%d got=%d (line=0x%X)\n",
            name, canonVa, caseIdx, label, expectAssert, asserted, g_assert_line);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!asserted) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != c->calleePop) {
      fprintf(stderr,
              "[k6-p11] ESP POP MISMATCH %s (0x%08X) case %d (%s): expected=%u actual=%u\n",
              name, canonVa, caseIdx, label, c->calleePop, actualPop);
      TerminateProcess(GetCurrentProcess(), 32);
    }
  }

  canonicalize_d2game_ptrs_range(STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE);
  canonicalize_d2game_ptrs_range(STAGE_CS_GAME, STAGE_CS_GAME + 0x1000u);
  if (setupTop > STAGE_SETUP_BASE) {
    canonicalize_d2game_ptrs_range(STAGE_SETUP_BASE, setupTop);
  }
  if (g_heap_top > HEAP_BASE) {
    canonicalize_d2game_ptrs_range(HEAP_BASE, g_heap_top);
  }
  for (uint32_t i = 0u; i < g_extra_cap_count; i++) {
    uint32_t canon = g_extra_caps[i].addr;
    if (canon >= D2GAME_PREF_BASE && canon < D2GAME_PREF_BASE + 0x130000u) continue;
    uint32_t live = canon_to_live_addr(canon);
    canonicalize_d2game_ptrs_range(live, live + g_extra_caps[i].len);
  }
  capture_stage_json(g_post_json, sizeof(g_post_json), setupTop);

  size_t hlen = 0;
  for (uint32_t p = HEAP_BASE; p < g_heap_top; p++) {
    uint8_t b = read_canon_byte(p, HEAP_BASE, g_heap_top);
    if (hlen + 3 >= sizeof(g_heap_hex)) {
      fprintf(stderr, "[k6-p11] heapHex overflow\n");
      TerminateProcess(GetCurrentProcess(), 26);
    }
    g_heap_hex[hlen++] = hexChars[(b >> 4) & 0xFu];
    g_heap_hex[hlen++] = hexChars[b & 0xFu];
  }
  g_heap_hex[hlen] = '\0';

  uint32_t retVal = asserted ? 0u : (g_thunk_out_eax & retMask);
  if (!asserted && g_game_rebase != 0 && retMask == 0xFFFFFFFFu) {
    uint32_t lo = (uint32_t)(uintptr_t)g_hGame;
    if (retVal >= lo && retVal < lo + 0x130000u) {
      retVal -= (uint32_t)g_game_rebase;
    }
  }

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

static __attribute__((unused)) void discover_table_ids(void) {
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

static __attribute__((unused)) uint32_t alloc_quest_record(void) {
  uint32_t pRec = (uint32_t)(uintptr_t)bump_alloc(0x14u);
  uint32_t pBuf = (uint32_t)(uintptr_t)bump_alloc(0x60u);
  U32(pRec + 0x00u) = pBuf;
  U32(pRec + 0x04u) = 0x300u;
  return pRec;
}

static __attribute__((unused)) void stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
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

static __attribute__((unused)) uint32_t stage_room_with_coll(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  stage_room(pRoom, pRoomEx, pLevel, levelId);
  uint32_t pLog = (uint32_t)(uintptr_t)bump_alloc(0x40u);
  uint32_t pCoordList = (uint32_t)(uintptr_t)bump_alloc(0x30u);
  U32(pLog + 0x00u)    = 1u;
  U32(pLog + 0x30u)    = pCoordList;
  (void)levelId;
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

static __attribute__((unused)) void stage_dynamic_path(uint32_t pUnit, uint32_t pPath, uint32_t pRoom, uint16_t x, uint16_t y) {
  U32(pUnit + 0x2Cu) = pPath;
  U16(pPath + 0x00u) = 0x8000u;
  U16(pPath + 0x02u) = x;
  U16(pPath + 0x04u) = 0x8000u;
  U16(pPath + 0x06u) = y;
  U32(pPath + 0x1Cu) = pRoom;
  U32(pPath + 0x30u) = pUnit;
  U32(pPath + 0x7Cu) = 0x1800u;
}

static __attribute__((unused)) void stage_static_path(uint32_t pUnit, uint32_t pPath, uint32_t pRoom, int32_t x, int32_t y) {
  U32(pUnit + 0x2Cu) = pPath;
  U32(pPath + 0x00u) = pRoom;
  S32(pPath + 0x04u) = x;
  S32(pPath + 0x08u) = y;
  S32(pPath + 0x0Cu) = x;
  S32(pPath + 0x10u) = y;
}

static __attribute__((unused)) void insert_server_unit(uint32_t pGame, uint32_t pUnit) {
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

static __attribute__((unused)) void link_unit_into_room(uint32_t pRoom, uint32_t pUnit) {
  U32(pUnit + 0xE8u) = U32(pRoom + 0x74u);
  U32(pRoom + 0x74u) = pUnit;
}

static __attribute__((unused)) void link_player_client(uint32_t pPlayer, uint32_t pClient) {
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

static __attribute__((unused)) void stage_unit_common(
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
    U32(pUnit + 0x7Cu) = (uint32_t)(uintptr_t)bump_alloc(4u);
  }
  fn_CreateStatListEx((void *)(uintptr_t)pUnit, 0u, NULL, (void *)(uintptr_t)STAGE_GAME);
}

static __attribute__((unused)) void stage_player_full(
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

static __attribute__((unused)) void stage_monster_full(
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
    U32(pUData + 0x30u) = (uint32_t)(uintptr_t)bump_alloc(4u);
  }
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 12, 10, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 6, 100 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 7, 100 << 8, 0);
}

static __attribute__((unused)) void stage_item_unit(
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

static __attribute__((unused)) uint32_t attach_skill(uint32_t pUnit, int32_t skillId, int32_t lvl) {
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

static __attribute__((unused)) void attach_inv_item_raw(
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

static __attribute__((unused)) void place_body_item(uint32_t pUnit, uint32_t pItem, int32_t bodyLoc) {
  uint32_t pInv = U32(pUnit + 0x60u);
  if (pInv == 0u) {
    pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)pUnit);
    U32(pUnit + 0x60u) = pInv;
  }
  fn_PlaceItemInBodyLoc((void *)(uintptr_t)pInv, (void *)(uintptr_t)pItem, bodyLoc);
}

static __attribute__((unused)) uint32_t stage_timer_queue(void) {
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

static __attribute__((unused)) uint32_t stage_extra_client(void) {
  uint32_t pCli = (uint32_t)(uintptr_t)bump_alloc(0x600u);
  uint32_t pN0  = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  uint32_t pN1  = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  U32(pN0 + 0x204u)  = pN1;
  U32(pCli + 0x1C0u) = pN0;
  U32(pCli + 0x1A8u) = STAGE_GAME;
  return pCli;
}

static __attribute__((unused)) void stage_mon_reg(uint32_t levelId) {
  uint32_t pMonReg = (uint32_t)(uintptr_t)bump_alloc(0x2E0u);
  U32(STAGE_GAME + 0xF0u + levelId * 4u) = pMonReg;
  U32(STAGE_GAME + 0x10DCu)               = pMonReg;
}

static __attribute__((unused)) uint32_t stage_quest_node(uint32_t qId, uint32_t pExSize) {
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

static __attribute__((unused)) void stage_party_ctrl(void) {
  uint32_t pList = (uint32_t)(uintptr_t)bump_alloc(64u * 0x44u);
  U32(pList + 0x00u)           = 0xFDu;
  U32(pList + 0x44u)           = 0xC9u;
  U32(STAGE_PARTYCTRL + 0x04u) = pList;
  U32(STAGE_GAME + 0x1D24u)    = STAGE_PARTYCTRL;
}

static __attribute__((unused)) void set_quest_bit(uint32_t pRec, uint32_t qId, uint32_t bit) {
  uint32_t pBuf = pRec ? U32(pRec + 0x00u) : 0u;
  if (pBuf == 0u) return;
  uint32_t idx = (qId << 4) + bit;
  U32(pBuf + (idx >> 5) * 4u) |= (1u << (idx & 31u));
}

/* ------------------------------- Group 1 (VAs 1..25) */



static __attribute__((unused)) void stage_missile_full(
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

static __attribute__((unused)) void stage_npc_dialog_table(uint32_t pQuest, uint32_t pTbl, uint32_t npcId) {
  U32(pQuest + 0xDCu) = pTbl;
  for (uint32_t s = 0u; s < 5u; s++) {
    uint32_t slot = pTbl + s * 0xC4u;
    U32(slot + 0x00u) = npcId;
    U16(slot + 0x04u) = (uint16_t)(0x0200u + s);
    U32(slot + 0x08u) = 1u + s;
    U32(slot + 0xC0u) = 1u;
  }
}


static __attribute__((unused)) uint32_t g_vip_item_id = 0xFFFFFFFFu;
static __attribute__((unused)) uint32_t g_shrine_obj_id = 2u;

static __attribute__((unused)) void init_p11_batch2_ids(void) {
  if (g_vip_item_id != 0xFFFFFFFFu) return;
  uint32_t nItems = U32(D2COM_VA(0x9FB94u) + g_com_rebase);
  uint32_t pItems = U32(D2COM_VA(0x9FB98u) + g_com_rebase);
  for (uint32_t i = 0u; i < nItems; i++) {
    if (U32(pItems + i * 0x1A8u + 0x80u) == 0x20706976u) { /* 'vip ' */
      g_vip_item_id = i;
      return;
    }
  }
  g_vip_item_id = g_item_box;
}

static __attribute__((unused)) uint32_t stage_obj_ctrl_full(uint32_t levelId0, uint32_t levelId1) {
  uint32_t pCtrl = (uint32_t)(uintptr_t)bump_alloc(0x300u);
  U32(pCtrl + 0x00u) = 0x13579BDFu;
  U32(pCtrl + 0x04u) = 0x0000029Au;
  for (uint32_t g = 1u; g <= 4u; g++) {
    uint32_t arr = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    U32(arr + 0x00u) = 1u;
    U32(arr + 0x04u) = 2u;
    U32(arr + 0x08u) = 3u;
    U32(arr + 0x0Cu) = 6u;
    U32(pCtrl + 0x08u + g * 4u) = 4u;
    U32(pCtrl + 0x28u + g * 4u) = arr;
  }
  uint32_t lvls[2] = { levelId0, levelId1 };
  for (int i = 0; i < 2; i++) {
    if (lvls[i] != 0u && lvls[i] < 140u) {
      uint32_t pInfo = (uint32_t)(uintptr_t)bump_alloc(0x100u);
      U8(pInfo + 0x00u)  = 0u;
      U32(pInfo + 0x04u) = 0u;
      U32(pInfo + 0x08u) = 16u;
      U32(pCtrl + 0x48u + lvls[i] * 4u) = pInfo;
    }
  }
  U32(STAGE_GAME + 0x10F0u) = pCtrl;
  return pCtrl;
}

static __attribute__((unused)) uint32_t __stdcall p11_obj_pos_accept_cb(
    uint32_t pGame, uint32_t pCtx, uint32_t x, uint32_t y) {
  (void)pGame; (void)pCtx; (void)x; (void)y;
  return 1u;
}

static __attribute__((unused)) void stage_client_pkt_pool(void) {
  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
  U32(STAGE_CLIENT + 0x3D4u)   = 1u;
}


static __attribute__((unused)) uint32_t find_skill_by_srvdo(uint16_t targetDoFunc) {
  uint32_t pDataTables = U32(U32(game_global_live(D2GAME_VA(0xF829Cu))));
  if (pDataTables == 0u) return 0xFFFFFFFFu;
  uint32_t pSkillsTxt = U32(pDataTables + 0xB98u);
  uint32_t nSkills    = U32(pDataTables + 0xBA0u);
  for (uint32_t id = 1u; id < nSkills; id++) {
    if (U16(pSkillsTxt + id * 0x23Cu + 0x2Eu) == targetDoFunc) {
      return id;
    }
  }
  return 0xFFFFFFFFu;
}

static void emit_batch_1(void);
static void emit_batch_2a(void);
static void emit_batch_2b(void);
static void emit_batch_3a(void);
static void emit_batch_3b(void);
static void emit_batch_4a(void);
static void emit_batch_4b(void);
static void emit_batch_5a(void);
static void emit_batch_6a(void);
static void emit_batch_6b(void);
static void emit_batch_hints(void);
static void emit_batch_hints2(void);
static void emit_batch_7a(void);
static void emit_batch_7b(void);

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
    fprintf(stderr, "[k6-p11] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
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
    fprintf(stderr, "[k6-p11] LoadLibraryA failed\n");
    return 2;
  }

  g_com_rebase  = (intptr_t)g_hCom  - (intptr_t)D2COM_PREF_BASE;
  g_game_rebase = (intptr_t)g_hGame - (intptr_t)D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p11] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-p11] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p11] failed to open %s\n", outPath);
    return 5;
  }

  emit_batch_1();
  emit_batch_2a();
  emit_batch_2b();
  emit_batch_3a();
  emit_batch_3b();
  emit_batch_4a();
  emit_batch_4b();
  emit_batch_5a();
  emit_batch_6a();
  emit_batch_6b();
  emit_batch_hints();
  emit_batch_hints2();
  emit_batch_7a();
  emit_batch_7b();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p11] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}


static void emit_batch_1(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[32];

  /* 1. 0x6FC2FB70 ITEMS_ExpireGroundItemsInAct_6FC2FB70_113c (ecx=pGame, eax=nAct, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    if (k > 0) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 0x401u, 0u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
      U32(STAGE_UDATA0 + 0x24u) = (k == 1) ? 250u : 50u;
    }
    c = make_call(); c.ecx = STAGE_GAME; c.eax = 0u; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC2FB70u, "ITEMS_ExpireGroundItemsInAct_6FC2FB70_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 2. 0x6FC2FC40 ITEMS_RollItemQuality_6FC2FC40_113c (eax=nItemId, ecx=nItemLevel, [pGame, pDropper, pKiller, pTcFactors], ret 10) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4812u, 4812u, STAGE_CLIENT);
    U32(STAGE_UNIT0 + 0x20u) = 0x11111111u + (uint32_t)k * 0x13572461u;
    U32(STAGE_UNIT0 + 0x24u) = 0x0000029Au;
    uint32_t pTc = STAGE_SCRATCH;
    U16(pTc + 0x00u) = (k == 2) ? 1024u : 0u;
    U16(pTc + 0x02u) = (k == 2) ? 1024u : 0u;
    U16(pTc + 0x04u) = (k == 2) ? 1024u : 0u;
    U16(pTc + 0x06u) = (k == 2) ? 1024u : 0u;
    uint32_t itemId = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? g_item_pot : g_item_sword);
    uint32_t ilvl = (k == 3) ? 85u : 40u;
    c = make_call(); c.eax = itemId; c.ecx = ilvl;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.args[3] = pTc;
    c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_UNIT1;
    ts[3] = (int64_t)(int32_t)itemId; ts[4] = (int64_t)ilvl; ts[5] = (int64_t)pTc; ts[6] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC2FC40u, "ITEMS_RollItemQuality_6FC2FC40_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 3. 0x6FC32EE0 ITEMS_ApplyItemDurabilityLoss_6FC32EE0_113c (esi=pItem, edi=pOwner, stack=[pGame], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t itemCls = (k == 0) ? g_item_ring : g_item_armor;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, itemCls, 0x401u, 1u, 2u, 0u);
    place_body_item(STAGE_UNIT0, STAGE_UNIT1, 3);
    if (k > 0) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x49, 20, 0); /* maxdurability = 20 */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x48, 20, 0); /* durability = 20 */
    }
    U32(STAGE_GAME + 0xD0u) = 0x13579BDFu + (uint32_t)k * 0x01010103u;
    U32(STAGE_UNIT0 + 0x20u) = 0x22222223u + (uint32_t)k * 0x02020205u;
    c = make_call(); c.esi = STAGE_UNIT1; c.edi = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC32EE0u, "ITEMS_ApplyItemDurabilityLoss_6FC32EE0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 4. 0x6FC33320 ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c (ebx=pItem, stack=[nItemLevel, nBaseSkillId, nBonus], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_claw, 0x401u, 0u, 3u, 0u);
    U32(STAGE_UNIT0 + 0x20u) = 0x12345679u + (uint32_t)k * 0x11111111u;
    uint32_t ilvl = (k == 0) ? 1u : ((k == 1) ? 20u : 40u);
    uint32_t bonus = (k == 0) ? 0u : 100u;
    c = make_call(); c.ebx = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = ilvl; c.args[1] = 251u; c.args[2] = bonus; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)ilvl; ts[2] = 251; ts[3] = (int64_t)bonus;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC33320u, "ITEMS_AddClassSpecificAutoModSkills_6FC33320_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 5. 0x6FC38480 AI_ThinkSandMaggot_6FC38480_113c (ecx=pGame, edx=pUnit, stack=[pAiThinkArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 286u, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4812u, 4812u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t pMonStats = U32(D2COM_VA(0xA0950u) + g_com_rebase);
    uint32_t pRec = pMonStats + 286u * 0x1A8u;
    uint32_t pArg = STAGE_SCRATCH;
    U32(pArg + 0x08u) = (k == 0) ? 0u : STAGE_UNIT1;
    U32(pArg + 0x18u) = (k == 1) ? 1u : 0u;
    U32(pArg + 0x1Cu) = pRec;
    U32(STAGE_UNIT0 + 0x20u) = 0x12345679u + (uint32_t)k * 0x1010101u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pArg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC38480u, "AI_ThinkSandMaggot_6FC38480_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 6. 0x6FC3BDF0 AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c (eax=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 0x6Du : 1u);
    stage_timer_queue();
    uint32_t cls = (k == 2) ? 0x20Fu : 0x92u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x201u, 1u, 4810u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    uint32_t pHead = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    uint32_t pCmd  = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    U32(pHead + 0x00u) = pCmd;
    U32(pHead + 0x04u) = pCmd;
    U32(pCmd + 0x00u) = pHead;
    U32(pCmd + 0x04u) = pHead;
    U32(pCmd + 0x08u) = 3u;
    U32(pCmd + 0x0Cu) = (k == 0) ? 4815u : 0u;
    U32(pCmd + 0x10u) = (k == 0) ? 4815u : 0u;
    U32(pAiGen + 0x20u) = pHead;
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC3BDF0u, "AI_HandleSpecialQuestNpcCmd3_6FC3BDF0_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 7. 0x6FC3BF60 AI_Think_CainAndAnyaPrisonPortal_6FC3BF60_113c (ecx=pGame, edx=pUnit, stack=[pAiTickArgs], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 0x6Du : 1u);
    stage_timer_queue();
    uint32_t cls = (k == 2) ? 0x20Fu : 0x92u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x201u, 1u, 4810u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    uint32_t pHead = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    uint32_t pCmd  = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    U32(pHead + 0x00u) = pCmd;
    U32(pHead + 0x04u) = pCmd;
    U32(pCmd + 0x00u) = pHead;
    U32(pCmd + 0x04u) = pHead;
    U32(pCmd + 0x08u) = 3u;
    U32(pCmd + 0x0Cu) = (k == 0) ? 4815u : 0u;
    U32(pCmd + 0x10u) = (k == 0) ? 4815u : 0u;
    U32(pAiGen + 0x20u) = pHead;
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pInteractSlot = (uint32_t)(uintptr_t)bump_alloc(8u);
    U32(STAGE_UDATA0 + 0x30u) = pInteractSlot;
    if (k == 1) {
      uint32_t pInode = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pInode + 0x00u) = 0u; /* inactive node followed by NULL */
      U32(pInteractSlot) = pInode;
    }
    uint32_t pArg = STAGE_SCRATCH;
    U32(pArg + 0x00u) = pAiCtrl;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pArg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC3BF60u, "AI_Think_CainAndAnyaPrisonPortal_6FC3BF60_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 9. 0x6FC3C8A0 AI_ExecuteHirelingCombatStep_6FC3C8A0_113c (eax=pUnit, stack=[pGame, nClassId, pPlayer, pTarget, pSeed, pAiParam, pMonStatsTxt], wait ret 18 = 6 args!) */
  /* Let's check arg order in 6FC3C8A0 real DLL: eax=pMerc, [esp+4]=pGame, [esp+8]=nClassId, [esp+C]=pOwner, [esp+10]=pTarget, [esp+14]=pSeed, [esp+18]=pArg */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x152u, 0x201u, 1u, 4811u, 4811u);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4820u, 4820u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    uint32_t pAiCtrl = U32(STAGE_UDATA1 + 0x2Cu);
    uint32_t pMonStats = U32(D2COM_VA(0xA0950u) + g_com_rebase);
    uint32_t pMonTxt = pMonStats + 0x152u * 0x1A8u;
    uint32_t pMonStats2 = STAGE_SCRATCH + 0x80u;
    U8(pMonStats2 + 0x0Eu) = 8u;
    uint32_t pArg = STAGE_SCRATCH;
    U32(pArg + 0x00u) = pAiCtrl;
    U32(pArg + 0x1Cu) = pMonTxt;
    U32(pArg + 0x20u) = pMonStats2;
    uint32_t pSeed = STAGE_SCRATCH + 0x40u;
    U32(pSeed + 0x00u) = 0x13572469u + (uint32_t)k;
    U32(pSeed + 0x04u) = 0x0000029Au;
    if (k == 1 || k == 2) {
      uint32_t pSlotArr = (uint32_t)(uintptr_t)bump_alloc(0x180u);
      uint32_t pPetTab = (uint32_t)(uintptr_t)bump_alloc(8u);
      uint32_t pPetNode = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(pPetNode + 0x04u) = 0x201u;
      U32(pPetNode + 0x08u) = 1u;
      U32(pSlotArr + 0x0Cu) = pPetNode;
      U32(pSlotArr + 0x10u) = 1u;
      U32(pPetTab + 0x00u) = pSlotArr;
      U32(STAGE_UDATA0 + 0x44u) = pPetTab;
      if (k == 2) {
        U32(pSeed + 0x00u) = 0x00000063u;
        U32(pSeed + 0x04u) = 0x00000000u;
      }
    }
    c = make_call(); c.eax = STAGE_UNIT1;
    c.nargs = 6u; c.args[0] = STAGE_GAME; c.args[1] = 0x152u; c.args[2] = STAGE_UNIT0;
    c.args[3] = STAGE_UNIT2; c.args[4] = pSeed; c.args[5] = pArg; c.calleePop = 24u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_GAME; ts[2] = 0x152;
    ts[3] = (int64_t)STAGE_UNIT0; ts[4] = (int64_t)STAGE_UNIT2; ts[5] = (int64_t)pSeed; ts[6] = (int64_t)pArg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC3C8A0u, "AI_ExecuteHirelingCombatStep_6FC3C8A0_113c", k, lbl, &c, ts, 7u, 0x00000000u, 0);
  }

  /* 10. 0x6FC3CAE0 AI_PetMoveActionDispatch_6FC3CAE0_113c (eax=pPetUnit, stack=[pGame, pOwnerUnit, nActionCase, nFlag, nDistOrDelay, nDirOrParam], ret 18) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, (k == 3) ? 4825u : 4820u, 4820u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4821u, 4820u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
      uint32_t pSlotArr = (uint32_t)(uintptr_t)bump_alloc(0x180u);
      uint32_t pPetTab = (uint32_t)(uintptr_t)bump_alloc(8u);
      uint32_t pN1 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      uint32_t pN2 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(pN1 + 0x04u) = 0x201u; U32(pN1 + 0x14u) = pN2;
      U32(pN2 + 0x04u) = 0x202u;
      U32(pSlotArr + 0x0Cu) = pN1; U32(pSlotArr + 0x10u) = 2u;
      U32(pPetTab + 0x00u) = pSlotArr;
      U32(STAGE_UDATA0 + 0x44u) = pPetTab;
    }
    uint32_t actCase = (k == 0) ? 9u : ((k == 3) ? 3u : 4u);
    c = make_call(); c.eax = STAGE_UNIT1;
    c.nargs = 6u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = actCase;
    c.args[3] = 0u; c.args[4] = 8u; c.args[5] = 4u; c.calleePop = 24u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0;
    ts[3] = (int64_t)actCase; ts[4] = 0; ts[5] = 8; ts[6] = 4;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC3CAE0u, "AI_PetMoveActionDispatch_6FC3CAE0_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 12. 0x6FC3DB40 AI_TownNpcMem113c (ecx=pGame, edx=pUnit, stack=[pAiTickParam], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x94u, 0x201u, 1u, 4810u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pInteractSlot = (uint32_t)(uintptr_t)bump_alloc(8u);
    U32(STAGE_UDATA0 + 0x30u) = pInteractSlot;
    if (k == 1) {
      uint32_t pInode = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pInode + 0x00u) = 0u; /* inactive node followed by NULL */
      U32(pInteractSlot) = pInode;
    }
    uint32_t pArg = STAGE_SCRATCH;
    U32(pArg + 0x00u) = pAiCtrl;
    if (k > 0) {
      /* Already initialized home cmd 10 so init returns 0, then stall or other action */
      uint32_t pHead = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      uint32_t pCmd  = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(pHead + 0x00u) = pCmd;
      U32(pHead + 0x04u) = pCmd;
      U32(pCmd + 0x00u) = pHead;
      U32(pCmd + 0x04u) = pHead;
      U32(pCmd + 0x08u) = 0x0Au;
      U32(pCmd + 0x0Cu) = 4810u;
      U32(pCmd + 0x10u) = 4810u;
      U32(pAiGen + 0x20u) = pHead;
    }
    if (k == 2) {
      U32(STAGE_UNIT0 + 0xC4u) |= 0x40u;
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pArg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC3DB40u, "AI_TownNpcMem113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 14. 0x6FC3E140 AI_FollowOwnerOrTeleportIfFar_6FC3E140_113c (esi=pOwnerUnit, stack=[pGame, pPetUnit, bCanTp, bForceNoRepo, bSkipCase2, nMaxDist], ret 18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint16_t px = (k == 0) ? 4811u : ((k == 1) ? 4895u : 4820u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, px, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t bTp = (k == 1) ? 1u : 0u;
    uint32_t bSkip2 = (k == 2) ? 1u : 0u;
    c = make_call(); c.esi = STAGE_UNIT0;
    c.nargs = 6u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = bTp;
    c.args[3] = 0u; c.args[4] = bSkip2; c.args[5] = 4u; c.calleePop = 24u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT1;
    ts[3] = (int64_t)bTp; ts[4] = 0; ts[5] = (int64_t)bSkip2; ts[6] = 4;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC3E140u, "AI_FollowOwnerOrTeleportIfFar_6FC3E140_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 15. 0x6FC3E900 ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c (ecx=pGame, edx=pUnit, stack=[pDropContext], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k >= 1) {
      uint32_t pEv = (uint32_t)(uintptr_t)bump_alloc(0x2Cu);
      U8(pEv + 0x00u) = 2u;
      U32(pEv + 0x04u) = 150u;
      U32(pEv + 0x08u) = STAGE_UNIT0;
      U32(STAGE_UNIT0 + 0xDCu) = pEv;
      if (k == 2) {
        stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4815u, 4815u, STAGE_CLIENT);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
        uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
        U32(pAiGen + 0x28u) = STAGE_GAME;
        U32(pAiGen + 0x2Cu) = 0x101u;
        U32(pAiGen + 0x30u) = 0u;
      }
    }
    uint32_t pRec = STAGE_SCRATCH + 0x40u;
    U32(pRec + 0x14u) = 1u;
    uint32_t pCtx = STAGE_SCRATCH;
    U32(pCtx + 0x00u) = pRec;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pCtx; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pCtx;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC3E900u, "ITEMS_EvaluateMonsterDropTableEntry_6FC3E900_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 16. 0x6FC3F2D0 MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c (edi=pMonster, stack=[pGame, pPresetUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cls = (k == 0) ? 0x138u : ((k == 1) ? 0x10Bu : g_mon_id_1);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x201u, 1u, 4810u, 4810u);
    uint32_t pPreset = STAGE_SCRATCH;
    U32(pPreset + 0x4Cu) = (k == 0) ? 7u : ((k == 1) ? 4820u : 0u);
    U32(pPreset + 0x50u) = (k == 1) ? 4825u : 0u;
    c = make_call(); c.edi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = pPreset; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)pPreset;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC3F2D0u, "MONSTER_ApplyPresetAiCommands_6FC3F2D0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 17. 0x6FC3F600 MONSTER_SaveInactiveMonsterNode113c (eax=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, (k == 2) ? 12u : 1u, 4810u, 4810u);
    U32(STAGE_UNIT0 + 0xD0u) = (k == 2) ? 0x0Bu : 8u;
    if (k > 0) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    }
    uint32_t pU = STAGE_UNIT0;
    if (k == 0) {
      /* unit has no room -> GetRoom == 0 -> returns 0 */
      U32(STAGE_UNIT1 + 0x00u) = 1u;
      pU = STAGE_UNIT1;
    }
    c = make_call(); c.eax = pU; c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)pU;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC3F600u, "MONSTER_SaveInactiveMonsterNode113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }


  /* 20. 0x6FC400E0 ROOM_RefreshUnitsAndLoadSaved113c (stack=[pGame, pRoom], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_mon_reg(1u);
    if (k > 0) {
      uint32_t pRmNode = (uint32_t)(uintptr_t)bump_alloc(0x28u);
      U32(pRmNode + 0x00u) = 4800u;
      U32(pRmNode + 0x04u) = 4800u;
      U32(STAGE_GAME + 0xD8u) = pRmNode;
      if (k == 2) {
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_shrine_id, 0x301u, 0u, 4812u, 4812u, 0x11223345u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT0);
        uint32_t pSavedU = (uint32_t)(uintptr_t)bump_alloc(0x34u);
        U32(pSavedU + 0x00u) = 4816u;
        U32(pSavedU + 0x04u) = 4816u;
        U32(pSavedU + 0x08u) = 2u;
        U32(pSavedU + 0x0Cu) = g_obj_shrine_id;
        U32(pSavedU + 0x1Cu) = 0x100u;
        U32(pSavedU + 0x20u) = 0x301u;
        U32(pRmNode + 0x04u) = pSavedU;
      }
    }
    c = make_call(); c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_ROOM0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC400E0u, "ROOM_RefreshUnitsAndLoadSaved113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 21. 0x6FC404E0 UNIT_SaveInactiveUnitNode113c (eax=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_mon_reg(1u);
    if (k == 0) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 0x11u, 4810u, 4810u, STAGE_CLIENT);
    } else if (k == 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_shrine_id, 0x301u, 0u, 4812u, 4812u, 0x11223345u);
    } else {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 1u, 0x501u, 0u, 4814u, 4814u, 0x11223345u);
    }
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC404E0u, "UNIT_SaveInactiveUnitNode113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 22. 0x6FC40760 ROOM_DeactivateMonsterInRoom113c (eax=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 2u : 1u);
    stage_mon_reg((k == 2) ? 2u : 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, (k == 0) ? 12u : 1u, 4810u, 4810u);
    U32(STAGE_UNIT0 + 0xD0u) = 8u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC40760u, "ROOM_DeactivateMonsterInRoom113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 23. 0x6FC409B0 ROOM_DeactivateAnyUnitInRoom113c (esi=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    if (k == 0) {
      /* unitType = 1 dispatches to 0x6FC40760 */
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
      U32(STAGE_UNIT0 + 0xD0u) = 8u;
    } else if (k == 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 1u, 0x501u, 0u, 4814u, 4814u, 0x11223345u);
    } else {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_shrine_id, 0x301u, 0u, 4812u, 4812u, 0x11223345u);
    }
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    c = make_call(); c.esi = STAGE_UNIT0; c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC409B0u, "ROOM_DeactivateAnyUnitInRoom113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 25. 0x6FC41490 AIGENERAL_ForEachPackMember_6FC41490_113c (eax=pMonster, ebx=pfnCallback, stack=[pArg1, pArg2], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    U32(pAiGen + 0x28u) = STAGE_GAME;
    U32(pAiGen + 0x2Cu) = 0x201u;
    U32(pAiGen + 0x30u) = 1u;
    if (k > 0) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 0u, 4812u, 4812u); /* dead mode 0 -> AI_CheckAnyMinionDead sets *pArg1=1 */
      if (k == 1) U32(STAGE_UNIT1 + 0x10u) = 1u; /* alive */
      else U32(STAGE_UNIT1 + 0x10u) = 12u; /* dead mode 12 */
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(8u);
      U32(pNode + 0x00u) = 0x202u;
      U32(pAiGen + 0x34u) = pNode;
    }
    uint32_t cbCanon = D2GAME_VA(0x15570u);
    uint32_t cbLive  = cbCanon + (uint32_t)g_game_rebase;
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pOut = STAGE_SCRATCH;
    c = make_call(); c.eax = pM; c.ebx = cbLive;
    c.nargs = 2u; c.args[0] = pOut; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = (int64_t)pM; ts[1] = (int64_t)cbCanon; ts[2] = (int64_t)pOut; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC41490u, "AIGENERAL_ForEachPackMember_6FC41490_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 26. 0x6FC417D0 AIGENERAL_GetOrAllocAiCommandByType113c (eax=nCmdType, edi=pUnit, ebx=bSetCurrent, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    U32(pAiGen + 0x28u) = STAGE_GAME;
    if (k == 0) {
      uint32_t pCmd = (uint32_t)(uintptr_t)bump_alloc(0x1Cu);
      U32(pCmd + 0x00u) = pCmd;
      U32(pCmd + 0x04u) = pCmd;
      U32(pCmd + 0x08u) = 4u;
      U32(pAiGen + 0x20u) = pCmd;
      U32(pAiGen + 0x24u) = pCmd;
    }
    uint32_t cmd = (k == 2) ? 7u : 4u;
    uint32_t bSet = (k == 2) ? 1u : 0u;
    c = make_call(); c.eax = cmd; c.edi = STAGE_UNIT0; c.ebx = bSet;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)cmd; ts[3] = (int64_t)bSet;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC417D0u, "AIGENERAL_GetOrAllocAiCommandByType113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 27. 0x6FC432B0 MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c (ebx=nUModId, esi=pGame, stack=[pMonster, bBoss], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t umod = (k == 0) ? 3u : ((k == 1) ? 1u : 10u);
    uint32_t bBoss = (k == 1) ? 1u : 0u;
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ebx = umod; c.esi = STAGE_GAME;
    c.nargs = 2u; c.args[0] = pM; c.args[1] = bBoss; c.calleePop = 8u;
    ts[0] = (int64_t)pM; ts[1] = (int64_t)umod; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)bBoss;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC432B0u, "MONUMOD_AssignSpecificUModAndInit_6FC432B0_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

}



static void emit_batch_2a(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[32];
  init_p11_batch2_ids();

  /* 33. 0x6FC49000 SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      stage_timer_queue();
    }
    uint32_t skillId = (k == 0) ? 0xFFFFFFFFu : 66u; /* Amplify Damage */
    uint32_t slvl = 3u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = skillId; c.args[1] = slvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    ts[2] = (int64_t)(int32_t)skillId; ts[3] = (int64_t)slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC49000u, "SKILLS_SrvDo029_ApplySingleTargetMonsterCurse_6FC49000_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }


  /* 35. 0x6FC4CA20 GAME_StepActEnvironmentCycles113c (stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_client_pkt_pool();
    uint32_t pEnv = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    U32(pEnv + 0x08u) = (k == 0) ? 0u : 10u;
    U32(pEnv + 0x28u) = (k == 0) ? 0u : 1u;
    U32(pEnv + 0x34u) = 0u;
    U32(STAGE_ACT0 + 0x04u) = pEnv; /* pAct->pEnv */
    if (k > 0) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      U32(STAGE_UNIT0 + 0xA8u) = STAGE_SKILL0;
      U32(STAGE_CLIENT + 0x04u) = (k == 1) ? 4u : 5u;
      U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
      U8(STAGE_CLIENT + 0x1ACu)  = 0u;
      U32(STAGE_GAME + 0x88u)    = STAGE_CLIENT;
    }
    c = make_call(); c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC4CA20u, "GAME_StepActEnvironmentCycles113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 36. 0x6FC4CBE0 GAME_UpdateActRooms113c (eax=pGame, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_obj_ctrl_full(1u, 2u);
    U32(STAGE_ACT0 + 0x54u) = (k > 0) ? 1u : 0u;
    if (k == 1) {
      U32(STAGE_ROOM0 + 0x34u) = 1u; /* already populated -> refreshRoomUnits + SetRoomFlag2 */
    } else if (k == 2) {
      U32(STAGE_ROOM0 + 0x34u) = 0u; /* unpopulated -> preset/refresh/objects/monreg */
      U32(STAGE_ROOM0 + 0x78u) = 1u; /* nNumClients=1 skips ambient */
    }
    c = make_call(); c.eax = STAGE_GAME; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC4CBE0u, "GAME_UpdateActRooms113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 38. 0x6FC4D9B0 GAME_StepClientJoinStatesAndTimeouts113c (stack=[pGame], ret 4, void in DLL!) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(D2GAME_VA(0x10E34Cu) + (uint32_t)g_game_rebase) = 0u; /* disable GetTickCount path in 0x6FC4D670 */
    uint32_t pArena = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    U32(pArena + 0x08u) = 4u;
    U32(STAGE_GAME + 0x1D28u) = pArena;
    U32(STAGE_GAME + 0xA8u) = 101u; /* non-8192 frame */
    if (k > 0) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      stage_client_pkt_pool();
      U32(STAGE_UNIT0 + 0xA8u) = STAGE_SKILL0;
      U32(STAGE_CLIENT + 0x04u) = (k == 1) ? 5u : 4u;
      U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
      U32(STAGE_CLIENT + 0x1B4u) = STAGE_ROOM0;
      U32(STAGE_GAME + 0x88u) = STAGE_CLIENT;
      if (k == 1) {
        U32(STAGE_ROOMEX0 + 0x2Cu) = 1u;
        U32(STAGE_ROOM0 + 0x34u) = 1u;
      }
    }
    c = make_call(); c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC4D9B0u, "GAME_StepClientJoinStatesAndTimeouts113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 41. 0x6FC4E830 OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c (esi=nObjectId, stack=[pGame, pRoom, x, y, nInitMode], ret 14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_obj_ctrl_full(1u, 2u);
    uint32_t objId = (k == 0) ? 0x23Du : ((k == 1) ? 0x245u : 0x247u); /* <=0x23d -> 0; 0x245 -> 0x6FC522B0 torch; >=0x247 -> 0 */
    c = make_call(); c.esi = objId;
    c.nargs = 5u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = 4812u; c.args[3] = 4812u; c.args[4] = 0u;
    c.calleePop = 20u;
    ts[0] = (int64_t)objId; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_ROOM0;
    ts[3] = 4812; ts[4] = 4812; ts[5] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC4E830u, "OBJECTS_DispatchPresetObjectSpawner_6FC4E830_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* 42. 0x6FC4F0D0 OBJECTS_PopulateRoom113c (stack=[pGame, pRoom], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 1u : ((k == 1) ? 2u : 3u));
    stage_obj_ctrl_full(2u, 3u);
    if (k == 2) {
      U32(STAGE_ROOM0 + 0x6Cu) = 0x55555551u;
    }
    c = make_call(); c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_ROOM0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC4F0D0u, "OBJECTS_PopulateRoom113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 43. 0x6FC4F300 OBJECTS_InitObjectUnit113c (esi=pUnit, ebx=pGame, stack=[nUnitId, pRoom, x, y], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_obj_ctrl_full(2u, 0u);
    uint32_t objCls = (k == 0) ? 1u : ((k == 1) ? 2u : 59u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, objCls, 0x301u + (uint32_t)k, (uint32_t)k, 4810u, 4810u, 0x11111111u);
    c = make_call(); c.esi = STAGE_UNIT0; c.ebx = STAGE_GAME;
    c.nargs = 4u; c.args[0] = 0x301u + (uint32_t)k; c.args[1] = STAGE_ROOM0; c.args[2] = 4812u + (uint32_t)k; c.args[3] = 4815u;
    c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)(0x301 + k);
    ts[3] = (int64_t)STAGE_ROOM0; ts[4] = (int64_t)(4812 + k); ts[5] = 4815;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC4F300u, "OBJECTS_InitObjectUnit113c", k, lbl, &c, ts, 6u, 0x00000000u, 0);
  }

  /* 44. 0x6FC4F690 OBJECTS_PopulateEvilUrnMonstersInRoom_6FC4F690_113c (ecx=pPopCtx, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* Expand room to 40x40 so (subW*subH >> 7)*0x1E >> 8 == 1 > 0 and fill 40x40 collision with COLLIDE_WALL=1 */
    uint32_t pGrid = (uint32_t)(uintptr_t)bump_alloc(40u * 40u * 2u);
    for (uint32_t i = 0u; i < 40u * 40u; i++) U16(pGrid + i * 2u) = 0x0001u;
    uint32_t pColl = U32(STAGE_ROOM0 + 0x20u);
    U32(pColl + 0x08u) = 40u; U32(pColl + 0x0Cu) = 40u;
    U32(pColl + 0x20u) = pGrid; U32(pColl + 0x24u) = pGrid + 40u * 40u * 2u;
    U32(STAGE_ROOM0 + 0x54u) = 40u; U32(STAGE_ROOM0 + 0x58u) = 40u;
    stage_obj_ctrl_full(2u, 0u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 466u, 0x301u, (k == 0) ? 2u : 0u, 4810u, 4810u, 0x11111111u);
    uint32_t pPopCtx = STAGE_SCRATCH;
    uint32_t pClsSeed = STAGE_SCRATCH + 0x40u;
    U32(pClsSeed + 0x00u) = 0x22222222u; U32(pClsSeed + 0x04u) = 0x29Au;
    U32(pPopCtx + 0x00u) = STAGE_GAME;
    U32(pPopCtx + 0x04u) = STAGE_UNIT0;
    U32(pPopCtx + 0x08u) = STAGE_ROOM0;
    U32(pPopCtx + 0x0Cu) = pClsSeed;
    U32(pPopCtx + 0x14u) = 4810u;
    U32(pPopCtx + 0x18u) = 4810u;
    if (k == 2) U32(U32(STAGE_GAME + 0x10F0u) + 0x00u) = 0x77777777u;
    c = make_call(); c.ecx = pPopCtx; c.calleePop = 0u;
    ts[0] = (int64_t)pPopCtx;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC4F690u, "OBJECTS_PopulateEvilUrnMonstersInRoom_6FC4F690_113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 45. 0x6FC517F0 OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c (stack=[pGame, nObjectId, nSizeX, nSizeY, pRoom, nWallSide, pCallbackCtx, pfnCallback], ret 20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pGrid = stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (k > 0) {
      /* Block collision so spot probes fail and step pRoom->tSeed differently by wallSide */
      for (uint32_t i = 0u; i < 32u * 32u; i++) U16(pGrid + i * 2u) = 0x0001u;
    }
    uint32_t szX = (k == 0) ? 40u : 2u; /* k=0 too large -> early ret 0 */
    uint32_t wallSide = (k == 1) ? 1u : 2u;
    uint32_t pfn = (uint32_t)(uintptr_t)&p11_obj_pos_accept_cb;
    c = make_call(); c.nargs = 8u;
    c.args[0] = STAGE_GAME; c.args[1] = 2u; c.args[2] = szX; c.args[3] = 2u;
    c.args[4] = STAGE_ROOM0; c.args[5] = wallSide; c.args[6] = 0u; c.args[7] = pfn;
    c.calleePop = 32u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = 2; ts[2] = (int64_t)szX; ts[3] = 2;
    ts[4] = (int64_t)STAGE_ROOM0; ts[5] = (int64_t)wallSide; ts[6] = 0; ts[7] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC517F0u, "OBJECTS_SpawnWallAlignedObjectWithCallback_6FC517F0_113c", k, lbl, &c, ts, 8u, 0xFFFFFFFFu, 0);
  }
}



static void emit_batch_2b(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[32];

  /* 46. 0x6FC51B40 OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c (stack=[pGame, nObjectId, nSizeX, nSizeY, pRoom, pCallbackCtx, pfnCallback], ret 1C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pGrid = stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (k > 0) {
      for (uint32_t i = 0u; i < 32u * 32u; i++) U16(pGrid + i * 2u) = 0x0001u;
    }
    if (k == 2) U32(STAGE_ROOM0 + 0x6Cu) = 0x55555553u;
    uint32_t szX = (k == 0) ? 40u : 2u;
    uint32_t pfn = (uint32_t)(uintptr_t)&p11_obj_pos_accept_cb;
    c = make_call(); c.nargs = 7u;
    c.args[0] = STAGE_GAME; c.args[1] = 2u; c.args[2] = szX; c.args[3] = 2u;
    c.args[4] = STAGE_ROOM0; c.args[5] = 0u; c.args[6] = pfn;
    c.calleePop = 28u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = 2; ts[2] = (int64_t)szX; ts[3] = 2;
    ts[4] = (int64_t)STAGE_ROOM0; ts[5] = 0; ts[6] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC51B40u, "OBJECTS_SpawnRandomObjectWithCallback_6FC51B40_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 47. 0x6FC51E20 OBJECTS_SpawnRandomObjectInRoom113c (stack=[pGame, nObjectId, nSizeX, nSizeY, pRoom], ret 14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_obj_ctrl_full(2u, 0u);
    if (k == 0) {
      U32(STAGE_ROOM0 + 0x54u) = 1u; /* subW < 2 -> ret 0 */
    } else if (k == 2) {
      U32(U32(STAGE_GAME + 0x10F0u) + 0x00u) = 0x76543211u;
    }
    uint32_t objId = (k == 2) ? 1u : 2u;
    c = make_call(); c.nargs = 5u;
    c.args[0] = STAGE_GAME; c.args[1] = objId; c.args[2] = 2u; c.args[3] = 2u; c.args[4] = STAGE_ROOM0;
    c.calleePop = 20u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)objId; ts[2] = 2; ts[3] = 2; ts[4] = (int64_t)STAGE_ROOM0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC51E20u, "OBJECTS_SpawnRandomObjectInRoom113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 48. 0x6FC52110 OBJECTS_SpawnPresetFalseTombSymbol_6FC52110_113c (ecx=pGame, edx=pRoom, stack=[_nPresetObjId, x, y, _nInitMode], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x42u + (uint32_t)k);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_ROOM0;
    c.nargs = 4u; c.args[0] = 0x246u; c.args[1] = 4812u + (uint32_t)k; c.args[2] = 4814u + (uint32_t)k; c.args[3] = 0u;
    c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_ROOM0; ts[2] = 0x246;
    ts[3] = (int64_t)(4812 + k); ts[4] = (int64_t)(4814 + k); ts[5] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC52110u, "OBJECTS_SpawnPresetFalseTombSymbol_6FC52110_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* 49. 0x6FC527D0 OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c (ecx=pGame, edx=pRoom, stack=[nDen_ignored, nObjId, wDensity], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_obj_ctrl_full(2u, 0u);
    if (k == 2) U32(STAGE_ROOM0 + 0x6Cu) = 0x33333331u;
    uint32_t wDen = (k == 0) ? 0u : 100u; /* k=0 roll%100 > 0 -> 0; k=1,2 roll<=100 -> spawn */
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_ROOM0;
    c.nargs = 3u; c.args[0] = 0u; c.args[1] = 2u; c.args[2] = wDen;
    c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_ROOM0; ts[2] = 2; ts[3] = 0; ts[4] = (int64_t)wDen;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC527D0u, "OBJECTS_SpawnShrineFromGroupEntry_6FC527D0_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 50. 0x6FC52CE0 OBJECTS_SpawnDensityObjectsInRoom113c (ecx=pGame, edx=pRoom, stack=[nDensity, nObjectId, nProb], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_obj_ctrl_full(2u, 0u);
    uint32_t den = (k == 0) ? 0u : 64u;
    uint32_t prob = (k == 1) ? 0u : 100u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_ROOM0;
    c.nargs = 3u; c.args[0] = den; c.args[1] = 2u; c.args[2] = prob; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_ROOM0;
    ts[2] = (int64_t)den; ts[3] = 2; ts[4] = (int64_t)prob;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC52CE0u, "OBJECTS_SpawnDensityObjectsInRoom113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 52. 0x6FC53C70 QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c (edi=pQuestArg, bl=bForceInactive, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t qRec = alloc_quest_record();
    U32(STAGE_UDATA0 + 0x10u) = qRec;
    set_quest_bit(qRec, 0x0Au, 4u);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_vip_item_id, 0x401u, 0u, 2u, 0u);
    uint32_t pQ = stage_quest_node(0x0Au, 0x40u);
    U8(pQ + 0x0Au) = (k == 1) ? 0u : 1u; /* inactive vs active */
    U32(pQ + 0xA0u + 4u * 4u) = (D2GAME_VA(0xC3E10u) + (uint32_t)g_game_rebase); /* ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags */
    uint32_t pChain = (uint32_t)(uintptr_t)bump_alloc(8u);
    U32(pChain + 0x00u) = pQ;
    U32(pChain + 0x04u) = 0u;
    U32(STAGE_UNIT1 + 0x74u) = pChain;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x04u) = 4u;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    uint32_t force = (k == 2) ? 1u : 0u;
    c = make_call(); c.edi = STAGE_QUESTARG; c.ebx = force; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUESTARG; ts[1] = (int64_t)force;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC53C70u, "QUESTS_DispatchUnitChainCallbacks_6FC53C70_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 53. 0x6FC53CE0 QUESTS_TriggerCallback113c (edi=pArg, stack=[bCheckActive, bFilterAct], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u); /* Act 1 -> act=1 */
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u + (uint32_t)k, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pQ = stage_quest_node(0x0Au, 0x40u);
    U8(pQ + 0x08u) = 1u; /* Act 1 */
    U8(pQ + 0x0Au) = (k == 0) ? 0u : 1u;
    U32(pQ + 0x1Cu) = 0x101u + (uint32_t)k;
    U16(pQ + 0x9Cu) = 1u;
    U32(pQ + 0xA0u + 3u * 4u) = (D2GAME_VA(0xC3EC0u) + (uint32_t)g_game_rebase); /* ACT2Q2_Callback03_LevelChanged */
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x04u) = 3u;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = 0x28u;
    uint32_t bCheck = (k == 2) ? 1u : 0u;
    uint32_t bFilter = (k == 2) ? 1u : 0u;
    c = make_call(); c.edi = STAGE_QUESTARG; c.nargs = 2u; c.args[0] = bCheck; c.args[1] = bFilter; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_QUESTARG; ts[1] = (int64_t)bCheck; ts[2] = (int64_t)bFilter;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC53CE0u, "QUESTS_TriggerCallback113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 55. 0x6FC54510 QUESTS_TriggerItemPickedUp_6FC54510_113c (ecx=pGame, eax=pItem, edx=pPlayer, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_vip_item_id, 0x401u, 0u, 2u, 0u);
    uint32_t pQ = stage_quest_node(0x0Au, 0x40u);
    U8(pQ + 0x08u) = (k == 2) ? 1u : 0u; /* Act 1 vs Act 0 */
    U8(pQ + 0x0Au) = (k == 0) ? 0u : 1u;
    U8(pQ + 0x14u) = 0x77u;
    U32(pQ + 0xA0u + 5u * 4u) = (D2GAME_VA(0xC5F30u) + (uint32_t)g_game_rebase); /* ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest */
    uint32_t pChain = (uint32_t)(uintptr_t)bump_alloc(8u);
    U32(pChain + 0x00u) = pQ; U32(pChain + 0x04u) = 0u;
    U32(STAGE_UNIT1 + 0x74u) = pChain;
    uint32_t qRec = alloc_quest_record();
    U32(STAGE_UDATA0 + 0x10u) = qRec;
    c = make_call(); c.ecx = STAGE_GAME; c.eax = STAGE_UNIT1; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC54510u, "QUESTS_TriggerItemPickedUp_6FC54510_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 56. 0x6FC545A0 QUESTS_TriggerItemDropped_6FC545A0_113c (ecx=pGame, eax=pItem, edx=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_vip_item_id, 0x401u, 0u, 2u, 0u);
    uint32_t qRec = alloc_quest_record();
    U32(STAGE_UDATA0 + 0x10u) = qRec;
    set_quest_bit(qRec, 0x0Au, 4u);
    uint32_t pQ = stage_quest_node(0x0Au, 0x40u);
    U8(pQ + 0x0Au) = (k == 0) ? 0u : 1u;
    U32(pQ + 0xA0u + 4u * 4u) = (k == 1) ? (D2GAME_VA(0xC3E10u) + (uint32_t)g_game_rebase) : (D2GAME_VA(0xC2450u) + (uint32_t)g_game_rebase); /* clear flags vs noop */
    uint32_t pChain = (uint32_t)(uintptr_t)bump_alloc(8u);
    U32(pChain + 0x00u) = pQ; U32(pChain + 0x04u) = 0u;
    U32(STAGE_UNIT1 + 0x74u) = pChain;
    c = make_call(); c.ecx = STAGE_GAME; c.eax = STAGE_UNIT1; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC545A0u, "QUESTS_TriggerItemDropped_6FC545A0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 57. 0x6FC54660 QUESTS_TriggerCallback00_6FC54660_113c (eax=pClient, stack=[pUnit, pTarget, dwExtra], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u + (uint32_t)k, 1u, 4810u, 4810u, STAGE_CLIENT);
    U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
    uint32_t pQ = stage_quest_node(0x0Au, 0x40u);
    U8(pQ + 0x08u) = (k == 0) ? 0u : 1u; /* act mismatch on k=0 */
    U8(pQ + 0x0Au) = 1u;
    U32(pQ + 0x1Cu) = 0x101u + (uint32_t)k;
    U16(pQ + 0x9Cu) = 1u;
    U32(pQ + 0xA0u) = (D2GAME_VA(0xC3EC0u) + (uint32_t)g_game_rebase); /* ACT2Q2_Callback03_LevelChanged */
    uint32_t extra = (k == 1) ? 0u : 0x28u;
    c = make_call(); c.eax = STAGE_CLIENT;
    c.nargs = 3u; c.args[0] = STAGE_UNIT0; c.args[1] = 0u; c.args[2] = extra; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_CLIENT; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = 0; ts[3] = (int64_t)extra;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC54660u, "QUESTS_TriggerCallback00_6FC54660_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 58. 0x6FC54860 QUESTS_NotifyLevelChange113c (eax=pGame, ecx=nFromLevel, edx=nToLevel, stack=[pUnit], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u + (uint32_t)k, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pQ = stage_quest_node(0x0Au, 0x40u);
    U8(pQ + 0x08u) = 1u;
    U8(pQ + 0x0Au) = 1u;
    U32(pQ + 0x1Cu) = 0x101u + (uint32_t)k;
    U16(pQ + 0x9Cu) = 1u;
    U32(pQ + 0xA0u + 3u * 4u) = (D2GAME_VA(0xC3EC0u) + (uint32_t)g_game_rebase);
    uint32_t fromLvl = (k == 0) ? 0x29u : 0x28u;
    uint32_t toLvl   = (k == 2) ? 0x33u : 0x29u;
    c = make_call(); c.eax = STAGE_GAME; c.ecx = fromLvl; c.edx = toLvl;
    c.nargs = 1u; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)fromLvl; ts[3] = (int64_t)toLvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC54860u, "QUESTS_NotifyLevelChange113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 59. 0x6FC54EA0 QUESTS_CheckNpcQuestInteractAlert113c (edi=pPlayer, stack=[pGame, pNpc], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    U8(STAGE_CLIENT + 0x1ACu) = 0u; /* Act 0 */
    uint32_t qRec = alloc_quest_record();
    U32(STAGE_UDATA0 + 0x10u) = qRec;
    if (k == 2) set_quest_bit(qRec, 0u, 0u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x9Bu, 0x201u, 1u, 4812u, 4812u); /* Warriv (town NPC, bit 9) */
    uint32_t pQ = stage_quest_node(0u, 0x40u);
    U8(pQ + 0x08u) = (k == 0) ? 1u : 0u; /* Act mismatch on k=0 */
    U32(pQ + 0xECu) = (D2GAME_VA(0x607D0u) + (uint32_t)g_game_rebase); /* ACT1Q0_CheckWarrivIntroNpcAlert */
    c = make_call(); c.edi = STAGE_UNIT0; c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC54EA0u, "QUESTS_CheckNpcQuestInteractAlert113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 60. 0x6FC554F0 QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c (al=nQuestId, ecx=pPlayerUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t qRec = alloc_quest_record();
    U32(STAGE_UDATA0 + 0x10u) = qRec;
    if (k == 2) set_quest_bit(qRec, 1u, 0x0Du);
    uint32_t pQ = stage_quest_node(1u, 0x100u);
    U8(pQ + 0x08u) = (k == 0) ? 1u : 0u; /* Act mismatch on k=0 */
    U8(pQ + 0x14u) = (uint8_t)(k + 1);
    U32(pQ + 0xE0u) = 1u; /* nSeqId = 1 -> reads pQuestEx+0x88 */
    U16(STAGE_QUESTEX0 + 0x88u) = 0x1234u + (uint16_t)k;
    c = make_call(); c.eax = 1u; c.ecx = STAGE_UNIT0; c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = 1; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC554F0u, "QUESTS_SendPlayerQuestAlert5D_6FC554F0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }
}



static void emit_batch_3a(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[32];
  init_p11_batch2_ids();

  /* 61. 0x6FC55640 QUESTS_SendQuestLogPackets50And52_6FC55640_113c (stack=[pGame, pPlayerUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_client_pkt_pool();
    uint32_t qRec = alloc_quest_record();
    U32(STAGE_UDATA0 + 0x10u) = qRec;
    if (k == 0) {
      U32(STAGE_GAME + 0x10F4u) = 0u; /* early return after 0x28 */
    } else {
      uint32_t pQ = stage_quest_node(1u, 0x100u);
      U8(pQ + 0x0Bu) = 1u; /* bActiveForStatusPacket52 */
      U32(pQ + 0xE0u) = 1u; /* nSeqId = 1 -> packet52[2] */
      U32(pQ + 0xE8u) = 0u;
      U16(STAGE_QUESTEX0 + 0x88u) = 0x0015u + (uint16_t)k;
      if (k == 2) {
        set_quest_bit(qRec, 0x0Cu, 0u);
        set_quest_bit(qRec, 1u, 0x0Du);
      }
    }
    c = make_call(); c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC55640u, "QUESTS_SendQuestLogPackets50And52_6FC55640_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 62. 0x6FC55C90 QUESTS_TriggerCallback0B_6FC55C90_113c (eax=pGame, ecx=dwTargetGuid, edx=pPlayerUnit, stack=[wMessageId], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u); /* level 1 -> Act 0 */
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pQ = stage_quest_node(0x0Bu, 0x100u);
    U8(pQ + 0x08u) = 0u; /* Act 0 */
    U8(pQ + 0x0Au) = 1u; /* bActive */
    U16(pQ + 0x9Cu) = (k == 2) ? 2u : 1u;
    U32(pQ + 0x1Cu) = 0x101u;
    U32(pQ + 0x20u) = 0x202u;
    U32(pQ + 0x04u) = STAGE_GAME;
    /* callback 0x0B slot is pQuest + 0xA0 + 0x0B*4 = 0xCC */
    U32(pQ + 0xCCu) = D2GAME_VA(0xC3EC0u) + (uint32_t)g_game_rebase; /* ACT2Q2_Callback03_LevelChanged113c removes player GUID when dwClassId==0x28 */
    uint32_t tgtGuid = 0xFFFFFFFFu;
    if (k > 0) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x28u, 0x205u, 1u, 4812u, 4812u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      tgtGuid = 0x205u;
    }
    c = make_call(); c.eax = STAGE_GAME; c.ecx = tgtGuid; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = (uint32_t)(0x10u + k); c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)(int32_t)tgtGuid; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)(0x10 + k);
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC55C90u, "QUESTS_TriggerCallback0B_6FC55C90_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 63. 0x6FC55E50 OBJECTS_InitPresetQuestObject113c (eax=pGame, ecx=pUnit, edx=pSaveChain, ret 0) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x6Du);
    uint32_t qId = (k == 3) ? 0x1Fu : 0x21u;
    stage_quest_node(qId, 0x120u);
    uint32_t pSave = STAGE_SCRATCH;
    uint32_t pSaveData = STAGE_SCRATCH + 0x40u;
    U32(pSave + 0x00u) = 2u; /* nCount */
    U32(pSave + 0x04u) = pSaveData;
    for (uint32_t i = 0u; i < 6u; i++) U32(pSaveData + i * 4u) = 0x11110000u + i + (uint32_t)k;
    uint32_t cid = (k == 0) ? 0x001u : (k == 1) ? 0x1CBu : (k == 2) ? 0x1CDu : 0x21Fu;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, cid, 0x301u, 0u, 4810u, 4810u, 0u);
    c = make_call(); c.eax = STAGE_GAME; c.ecx = STAGE_UNIT1; c.edx = pSave;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)pSave;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC55E50u, "OBJECTS_InitPresetQuestObject113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* [64] 0x6FC561E0 skipped: ts_parity_bug (MONSTER_Create113c pMonReg+0x10/+0x14 + stack write mismatch) */

  /* 65. 0x6FC565B0 QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c (ecx=pQuestArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_timer_queue();
    stage_mon_reg(40u);
    stage_party_ctrl();
    uint32_t pQ = stage_quest_node((k == 0) ? 0x0Cu : 0x0Bu, 0u);
    uint32_t pQ2 = (uint32_t)(uintptr_t)bump_alloc(0x100u);
    U32(pQ2 + 0x00u) = 0x0Du;
    U32(pQ2 + 0x04u) = STAGE_GAME;
    U8(pQ2 + 0x09u)  = 1u;
    U8(pQ2 + 0x0Cu)  = 1u;
    U32(pQ + 0xF4u)  = pQ2;
    U8(pQ + 0x09u) = 1u;
    U8(pQ + 0x0Cu) = (k == 1) ? 2u : 1u;
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x20u;
    U32(STAGE_QBITS0 + 0x04u) = 0x200u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x04u) = 0u;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_ROOM0;
    U32(STAGE_QUESTARG + 0x14u) = (k == 2) ? 4818u : 4815u;
    U32(STAGE_QUESTARG + 0x18u) = (k == 2) ? 4819u : 4815u;
    c = make_call(); c.ecx = STAGE_QUESTARG;
    ts[0] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC565B0u, "QUESTS_TriggerAct2Q0SpawnJerhyn_6FC565B0_113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 66. 0x6FC566C0 ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c (eax=pGame, esi=pPlayerUnit, stack=[nTargetLevelId, dwUnused], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x65u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_client_pkt_pool();
    for (uint32_t d = 0u; d < 3u; d++) {
      uint32_t pair = (uint32_t)(uintptr_t)bump_alloc(8u);
      for (uint32_t side = 0u; side < 2u; side++) {
        uint32_t h = (uint32_t)(uintptr_t)bump_alloc(0x14u);
        uint32_t b = (uint32_t)(uintptr_t)bump_alloc(0x40u);
        U32(h + 0x00u) = b; U32(h + 0x04u) = 0x40u;
        U32(pair + side * 4u) = h;
      }
      U32(STAGE_UDATA0 + 0x60u + d * 4u) = pair;
    }
    stage_quest_node(0x16u, 0x100u);
    uint32_t qRec = alloc_quest_record();
    U32(STAGE_UDATA0 + 0x10u) = qRec;
    uint32_t lvlId = (k == 0) ? 0x65u : 0x66u;
    if (k == 2) set_quest_bit(qRec, 0x12u, 0u);
    c = make_call(); c.eax = STAGE_GAME; c.esi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = lvlId; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)lvlId; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC566C0u, "ACT3Q7_OnMephistoPortalWarpToAct4_6FC566C0_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 67. 0x6FC56890 QUESTS_OnBossActChangeOrBossKill_6FC56890_113c (eax=pMonster, ecx=pPlayer, stack=[pGame], ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_client_pkt_pool();
    for (uint32_t d = 0u; d < 3u; d++) {
      uint32_t pair = (uint32_t)(uintptr_t)bump_alloc(8u);
      for (uint32_t side = 0u; side < 2u; side++) {
        uint32_t h = (uint32_t)(uintptr_t)bump_alloc(0x14u);
        uint32_t b = (uint32_t)(uintptr_t)bump_alloc(0x40u);
        U32(h + 0x00u) = b; U32(h + 0x04u) = 0x40u;
        U32(pair + side * 4u) = h;
      }
      U32(STAGE_UDATA0 + 0x60u + d * 4u) = pair;
    }
    uint32_t qRec = alloc_quest_record();
    U32(STAGE_UDATA0 + 0x10u) = qRec;
    uint32_t pQ4 = stage_quest_node(4u, 0x100u);
    U32(pQ4 + 0xE0u) = 4u;
    U8(STAGE_QUESTEX0 + 0x50u) = 1u;
    U32(STAGE_GAME + 0x70u) = 1u; /* expansion flag for Baal 0x16F */
    uint32_t cid = (k == 0) ? 1u : (k == 1) ? 0x9Bu : (k == 2) ? 0xD2u : 0x16Fu;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 0x201u, 1u, 4812u, 4812u);
    c = make_call(); c.eax = STAGE_UNIT1; c.ecx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC56890u, "QUESTS_OnBossActChangeOrBossKill_6FC56890_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 68. 0x6FC56C20 QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c (ecx=pArgs, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x28u);
    stage_timer_queue();
    uint32_t pQ = stage_quest_node((k == 0) ? 0x0Du : 0x0Bu, 0x100u);
    U8(pQ + 0x09u) = (k == 2) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x04u) = (k == 2) ? 1u : 0u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x10u) = STAGE_ROOM0;
    c = make_call(); c.ecx = STAGE_QUESTARG;
    ts[0] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC56C20u, "QUESTS_Act2TaintedSunTriggerAltarDarkness_6FC56C20_113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 69. 0x6FC57030 SUNIT_DispatchItemEventCallbacks113c (ebx=pUnit, stack=[pGame, nEventType, pTarget, pArg], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    uint32_t pDmg = STAGE_DMG;
    if (k > 0) {
      uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x28u);
      U8(pNode + 0x00u) = (k == 1) ? 9u : 2u; /* nNodeEvent */
      U8(pNode + 0x02u) = 0x02u; /* expire/unlink bit */
      U32(pNode + 0x04u) = (k == 2) ? 1u : 0u;
      U32(pNode + 0x0Cu) = 50u; /* dwArg1 = slow pct */
      U32(pNode + 0x10u) = 0u;  /* dwArg2 */
      /* 0x6FC6EF70 = D2GAME_VA(0x4EF70u) SKILLS_ApplySlowTargetOnHit */
      U32(pNode + 0x14u) = D2GAME_VA(0x4EF70u) + (uint32_t)g_game_rebase;
      U32(STAGE_UNIT0 + 0x90u) = pNode;
    }
    uint32_t unitPtr = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ebx = unitPtr;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = 2u; c.args[2] = STAGE_UNIT1; c.args[3] = pDmg; c.calleePop = 16u;
    ts[0] = (int64_t)unitPtr; ts[1] = (int64_t)STAGE_GAME; ts[2] = 2; ts[3] = (int64_t)STAGE_UNIT1; ts[4] = (int64_t)pDmg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57030u, "SUNIT_DispatchItemEventCallbacks113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* [70] 0x6FC57540 skipped: ts_parity_bug (calls UNITS_SyncDualWieldWeaponStatLists113c, omits 0x6fc2a952 guard, wrong pActiveWeapon==0 branch) */

  /* 71. 0x6FC57C90 PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c (edi=pClient, stack=[pUnit], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_client_pkt_pool();
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    if (k > 0) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 1u, 4u, 0u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 4u, (k == 1) ? 3u : 1u);
    }
    c = make_call(); c.edi = STAGE_CLIENT; c.nargs = 1u; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_CLIENT; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57C90u, "PLAYER_SendInventoryItemsSyncPackets_6FC57C90_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 72. 0x6FC57E20 PLAYER_InitPlacedModesAndEvents_6FC57E20_113c (esi=pGame, edi=pPlayer, stack=[x, y], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 50u;
    if (k > 0) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 1u, 0u, 0u);
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      /* Set cursor item so mode callback path vs cursor-skip path both test cleanly */
      U32((uint32_t)(uintptr_t)pInv + 0x14u) = STAGE_UNIT1;
    }
    if (k == 2) {
      /* Without cursor item on k=2? Let's test k=0 (no pInv), k=1 (has cursor item), k=2 (no cursor item) */
      U32(U32(STAGE_UNIT0 + 0x60u) + 0x14u) = 0u;
    }
    c = make_call(); c.esi = STAGE_GAME; c.edi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = 4812u + (uint32_t)k; c.args[1] = 4814u + (uint32_t)k; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(4812 + k); ts[3] = (int64_t)(4814 + k);
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57E20u, "PLAYER_InitPlacedModesAndEvents_6FC57E20_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 73. 0x6FC57F80 PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c (eax=pGame, ecx=dwPlayerUnitId, stack=[pPlayerUnit, nGoldToDrop], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4815u, 4815u, STAGE_CLIENT);
    if (k > 0) insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 500, 0);
    uint32_t dropAmt = (k == 2) ? 200u : 0u;
    c = make_call(); c.eax = STAGE_GAME; c.ecx = 0x101u;
    c.nargs = 2u; c.args[0] = STAGE_UNIT0; c.args[1] = dropAmt; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = 0x101; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)dropAmt;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC57F80u, "PLRTRADE_DropPlayerInventoryGold_6FC57F80_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 74. 0x6FC58180 PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c (esi=pVictimUnit, stack=[pGame, pAttackerUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4815u, 4815u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0); /* clvl=10 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 1000, 0); /* inv gold */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 15, 2000, 0); /* stash gold */
    U8(STAGE_GAME + 0x6Au) = (k == 0) ? 3u : 0u; /* gameType 3 = singleplayer clamp */
    uint32_t att = 0u;
    if (k == 2) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x102u, 1u, 4818u, 4818u, 0u);
      att = STAGE_UNIT1; /* PvP kill */
    }
    c = make_call(); c.esi = STAGE_UNIT0; c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = att; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)att;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC58180u, "PLAYER_ApplyDeathGoldPenaltyAndDrop_6FC58180_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 75. 0x6FC58620 PLAYER_InitPlayerUnitSubsystems_6FC58620_113c (eax=pGame, esi=pPlayerUnit, stack=[dwUnitId], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_UNIT0 + 0x00u) = 0u;
    U32(STAGE_UNIT0 + 0x04u) = (uint32_t)k; /* classId: Ama, Sor, Nec */
    U32(STAGE_UNIT0 + 0x1Cu) = STAGE_ACT0;
    c = make_call(); c.eax = STAGE_GAME; c.esi = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = 0x500u + (uint32_t)k; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(0x500 + k);
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC58620u, "PLAYER_InitPlayerUnitSubsystems_6FC58620_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }
}



static void emit_batch_3b(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[32];

  /* 76. 0x6FC586F0 PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c (eax=pPlayer, ebx=pGame, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    if (k > 0) {
      /* Create TP object (class 0x3B) in object hash table pGame+0x1520 */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, (k == 1) ? 0x01u : 0x3Bu, 0x301u, 0u, 4815u, 4815u, 0u);
      U8(STAGE_UDATA1 + 0x04u) = 1u;
      U32(STAGE_UDATA1 + 0x18u) = 4815u;
      U32(STAGE_UDATA1 + 0x1Cu) = 4815u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      U32(STAGE_UDATA0 + 0x48u) = 0x301u;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = STAGE_GAME;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC586F0u, "PLAYER_DestroyPlayerTownPortalPair_6FC586F0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 77. 0x6FC5A4E0 MISSILE_BuildDamageStrcFromStats113c (ebx=pMissile, stack=[pDefender, pDamageOut], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x301u, 4810u, 4810u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    if (k == 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 10, 0); /* minphys */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 30, 0); /* maxphys */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 48, 5, 0);  /* firemin */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 49, 15, 0); /* firemax */
    } else if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 100, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 200, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 141, 1, 0); /* deadly strike */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 103, 1, 0); /* crushing blow */
    }
    uint32_t defPtr = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call(); c.ebx = STAGE_UNIT0; c.nargs = 2u; c.args[0] = defPtr; c.args[1] = STAGE_DMG; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)defPtr; ts[2] = (int64_t)STAGE_DMG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC5A4E0u, "MISSILE_BuildDamageStrcFromStats113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 78. 0x6FC5AE10 MISSILE_ApplyDamageStrcToTarget113c (edi=pDamage, stack=[pGame, pMissile, pDefender], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x301u, 4811u, 4811u);
    U32(STAGE_UNIT1 + 0x94u) = 0u; U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    if (k > 0) U32(STAGE_UNIT1 + 0xC8u) = (1u << 10); /* has owner bit */
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 7, 100 << 8, 0);
    U32(STAGE_DMG + 0x08u) = 15u << 8;
    U32(STAGE_DMG + 0x10u) = (k == 2) ? (20u << 8) : 0u;
    c = make_call(); c.edi = STAGE_DMG; c.nargs = 3u;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_UNIT2; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_DMG; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT1; ts[3] = (int64_t)STAGE_UNIT2;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC5AE10u, "MISSILE_ApplyDamageStrcToTarget113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 79. 0x6FC5E3F0 MISSILE_DispatchFrameTick113c (stack=[pGame, pMissile], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u); /* level 2=wilderness */
    /* Missile id 1 has SrvDoFunc #1 */
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0xFFFFFFu : 1u, 0x301u, 4810u, 4810u);
    U32(STAGE_PATH0 + 0x7Cu) = 0u; /* zero velocity so SrvDo01 advances remaining frames cleanly */
    U16(STAGE_UDATA0 + 0x10u) = (k == 1) ? 20u : 5u; /* nRemainingFrames at +0x10 */
    c = make_call(); c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC5E3F0u, "MISSILE_DispatchFrameTick113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 80. 0x6FC5EDE0 MISSILE_ProcessTargetCollisionHit113c (edi=pMissile, stack=[pGame, pTarget, bForceDestroy], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x301u, 4812u, 4812u);
    U32(STAGE_UNIT1 + 0x94u) = 0u; U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) = (1u << 10);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 7, 100 << 8, 0);
    uint32_t tgt = (k == 0) ? STAGE_UNIT0 : (k == 1) ? 0u : STAGE_UNIT2;
    uint32_t forceD = (k == 1) ? 1u : 0u;
    c = make_call(); c.edi = STAGE_UNIT1; c.nargs = 3u;
    c.args[0] = STAGE_GAME; c.args[1] = tgt; c.args[2] = forceD; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)tgt; ts[3] = (int64_t)forceD;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC5EDE0u, "MISSILE_ProcessTargetCollisionHit113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 81. 0x6FC5F7D0 MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c (ecx=pGame, edx=pMissile, stack=[nChargeArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x301u, 4812u, 4812u);
    U32(STAGE_UNIT1 + 0x94u) = 0u; U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    if (k > 0) U32(STAGE_UNIT1 + 0xC8u) = (1u << 10);
    U32(STAGE_GAME + 0xA8u) = 100u;
    uint32_t pTbl = U32(U32(D2GAME_VA(0xF829Cu) + g_game_rebase));
    uint32_t nSk = U32(pTbl + 0xBA0u);
    uint32_t pSkBase = U32(pTbl + 0xB98u);
    uint32_t foundSk = 52u;
    for (uint32_t s = 1u; s < nSk; s++) {
      uint32_t rec = pSkBase + s * 0x23Cu;
      if ((int32_t)U32(rec + 0x214u) >= 20) {
        foundSk = s; break;
      }
    }
    U16(STAGE_UDATA1 + 0x0Au) = (uint16_t)foundSk; /* nSkill at +0x0A */
    U16(STAGE_UDATA1 + 0x0Cu) = 5u; /* nLevel at +0x0C */
    U32(STAGE_UDATA1 + 0x28u) = (k == 2) ? 120u : 112u; /* nTargetX at +0x28 -> duration 20 vs 12 */
    stage_timer_queue();
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT1; c.nargs = 1u; c.args[0] = (k == 2) ? 2u : 1u; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)((k == 2) ? 2 : 1);
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC5F7D0u, "MISSILE_SrvDo_TriggerChargedAuraInDurationWindow_6FC5F7D0_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* [82] 0x6FC62EC0 skipped: ts_parity_bug (local applyPostDamageHitReaction skips 0x6FC971D0 & UNITROOM_RefreshUnit113c) */

  /* 83. 0x6FC63FA0 SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_timer_queue();
    uint32_t pTbl = U32(U32(D2GAME_VA(0xF829Cu) + g_game_rebase));
    uint32_t nSk = U32(pTbl + 0xBA0u);
    int32_t nMis = (int32_t)U32(pTbl + 0xB6Cu);
    int32_t nSt = (int32_t)U32(pTbl + 0xC4u);
    uint32_t pSkBase = U32(pTbl + 0xB98u);
    uint32_t skId = 0xFFFFu;
    if (k > 0) {
      for (uint32_t s = 1u; s < nSk; s++) {
        uint32_t rec = pSkBase + s * 0x23Cu;
        int16_t wm = S16(rec + 0x48u);
        int16_t ws = S16(rec + 0x80u);
        if (wm >= 0 && wm < nMis && ws >= 0 && ws < nSt) { skId = s; break; }
      }
      uint32_t pSk = attach_skill(STAGE_UNIT0, (int32_t)skId, 5);
      if (k == 2 && pSk != 0u) {
        U32(pSk + 0x08u) = 0u; /* Param04 */
        U32(pSk + 0x0Cu) = (k == 2) ? 1u : 0u; /* Param08 */
      }
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u; c.args[0] = skId; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)skId; ts[3] = 5;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC63FA0u, "SKILLS_SrvDo046_EnchantOrRevivePetWithAuraState_6FC63FA0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 84. 0x6FC65EE0 SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c (stack=[pGame, pCaster, pUnit, nDuration, nSkillId, nChargeLevel], ret 18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 200u;
    uint32_t pTbl = U32(U32(D2GAME_VA(0xF829Cu) + g_game_rebase));
    uint32_t nSk = U32(pTbl + 0xBA0u);
    uint32_t pSkBase = U32(pTbl + 0xB98u);
    uint32_t foundSk = 52u;
    for (uint32_t s = 1u; s < nSk; s++) {
      int16_t st2 = S16(pSkBase + s * 0x23Cu + 0x82u);
      if (st2 >= 0) { foundSk = s; break; }
    }
    uint32_t useSk = (k == 0) ? 0xFFFFu : foundSk;
    c = make_call(); c.nargs = 6u;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT0;
    c.args[3] = 50u + (uint32_t)k * 25u; c.args[4] = useSk; c.args[5] = (uint32_t)(k + 1); c.calleePop = 24u;
    /* TS params: (m, pGame, pUnit, nDuration, nSkillId, nSkillLevel, nChargeLevel, pCaster) */
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(50 + k * 25);
    ts[3] = (int64_t)useSk; ts[4] = 1; ts[5] = (int64_t)(k + 1); ts[6] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC65EE0u, "SKILLS_ApplySecondaryAuraStateStats_6FC65EE0_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* [85] 0x6FC66F70 skipped: ts_parity_bug (MONSTER_Create113c pMonReg+0x10/+0x14 mismatch) */

  /* 86. 0x6FC67450 REGPOP_FindPackSpawnCoords113c (stack=[pGame, pRoom, pCoordNode, nClassId, pOutX, pOutY, bCheckSafeZone], ret 1C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pGrid = stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_timer_queue();
    U32(STAGE_LEVEL0 + 0x10u) = STAGE_ROOMEX0;
    U32(STAGE_LEVEL0 + 0x1Cu) = 960u; U32(STAGE_LEVEL0 + 0x20u) = 960u;
    U32(STAGE_LEVEL0 + 0x24u) = 6u; U32(STAGE_LEVEL0 + 0x28u) = 6u;
    U32(STAGE_LEVEL0 + 0x1D8u) = 1u;
    U32(STAGE_DRLG0 + 0x10u) = STAGE_ROOMEX0;
    U32(STAGE_ROOMEX0 + 0x28u) |= 0x03100000u;
    U32(STAGE_ROOMEX0 + 0x34u) = 960u; U32(STAGE_ROOMEX0 + 0x38u) = 960u;
    U32(STAGE_ROOMEX0 + 0x3Cu) = 6u; U32(STAGE_ROOMEX0 + 0x40u) = 6u;
    U32(STAGE_ROOM0 + 0x6Cu) = 0x11223345u + (uint32_t)k * 0x100u;
    if (k == 0) {
      for (uint32_t i = 0u; i < 32u * 32u; i++) U16(pGrid + i * 2u) = 0xFFFFu; /* blocked -> fails all 20 */
    }
    uint32_t pOutX = STAGE_SCRATCH;
    uint32_t pOutY = STAGE_SCRATCH + 4u;
    c = make_call(); c.nargs = 7u;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = 0u; c.args[3] = g_mon_id_0;
    c.args[4] = pOutX; c.args[5] = pOutY; c.args[6] = (k == 1) ? 0u : 1u; c.calleePop = 28u;
    /* Note TS arg order was swapped (pRoom, pGame, pCoordNode, nClassId, pOutX, pOutY, bCheckSafeZone) */
    ts[0] = (int64_t)STAGE_ROOM0; ts[1] = (int64_t)STAGE_GAME; ts[2] = 0; ts[3] = (int64_t)g_mon_id_0;
    ts[4] = (int64_t)pOutX; ts[5] = (int64_t)pOutY; ts[6] = (k == 1) ? 0 : 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC67450u, "REGPOP_FindPackSpawnCoords113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 87. 0x6FC67700 REGPOP_SpawnMonsterPack113c (eax=pRoom, ebx=nClassId, stack=[pGame, pCoordNode, nMinCount, nMaxCount], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_timer_queue();
    U32(STAGE_LEVEL0 + 0x10u) = STAGE_ROOMEX0;
    U32(STAGE_LEVEL0 + 0x1Cu) = 960u; U32(STAGE_LEVEL0 + 0x20u) = 960u;
    U32(STAGE_LEVEL0 + 0x24u) = 6u; U32(STAGE_LEVEL0 + 0x28u) = 6u;
    U32(STAGE_LEVEL0 + 0x1D8u) = 1u;
    U32(STAGE_DRLG0 + 0x10u) = STAGE_ROOMEX0;
    U32(STAGE_ROOMEX0 + 0x28u) |= 0x03100000u;
    U32(STAGE_ROOMEX0 + 0x34u) = 960u; U32(STAGE_ROOMEX0 + 0x38u) = 960u;
    U32(STAGE_ROOMEX0 + 0x3Cu) = 6u; U32(STAGE_ROOMEX0 + 0x40u) = 6u;
    uint32_t mn = (k == 0) ? 0u : 1u;
    uint32_t mx = (k == 2) ? 2u : 1u;
    c = make_call(); c.eax = STAGE_ROOM0; c.ebx = g_mon_id_0; c.nargs = 4u;
    c.args[0] = STAGE_GAME; c.args[1] = 0u; c.args[2] = mn; c.args[3] = mx; c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_ROOM0; ts[1] = (int64_t)g_mon_id_0; ts[2] = (int64_t)STAGE_GAME; ts[3] = 0; ts[4] = (int64_t)mn; ts[5] = (int64_t)mx;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC67700u, "REGPOP_SpawnMonsterPack113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* [88] 0x6FC679B0 skipped: ts_parity_bug (wraps 0x6FC44950 / MONSTER_Create113c pMonReg+0x10/+0x14 mismatch) */

  /* 89. 0x6FC67A20 REGPOP_PopulateRoomMonsters113c (stack=[pGame, pRoom], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    U32(STAGE_LEVEL0 + 0x10u) = STAGE_ROOMEX0;
    U32(STAGE_LEVEL0 + 0x1Cu) = 960u; U32(STAGE_LEVEL0 + 0x20u) = 960u;
    U32(STAGE_LEVEL0 + 0x24u) = 6u; U32(STAGE_LEVEL0 + 0x28u) = 6u;
    U32(STAGE_LEVEL0 + 0x1D8u) = 1u;
    U32(STAGE_DRLG0 + 0x10u) = STAGE_ROOMEX0;
    U32(STAGE_ROOMEX0 + 0x28u) |= 0x03100000u;
    U32(STAGE_ROOMEX0 + 0x34u) = 960u; U32(STAGE_ROOMEX0 + 0x38u) = 960u;
    U32(STAGE_ROOMEX0 + 0x3Cu) = 6u; U32(STAGE_ROOMEX0 + 0x40u) = 6u;
    if (k > 0) {
      stage_mon_reg(2u);
      uint32_t pMonReg = U32(STAGE_GAME + 0xF0u + 2u * 4u);
      U32(pMonReg + 0x0Cu) = 5u; /* nRooms > 0 so REGPOP_CanPopulateRoom advances */
      U32(pMonReg + 0x2B8u) = (k == 1) ? 0u : 15000u; /* k=1 skips loop; k=2 clamps dwMonDen to 10000 */
    }
    uint32_t cNode = STAGE_SCRATCH;
    U32(cNode + 0x10u) = 960u; U32(cNode + 0x14u) = 960u;
    U32(cNode + 0x18u) = 963u; U32(cNode + 0x1Cu) = 963u;
    U32(cNode + 0x28u) = 0u; /* loop terminates safely without spawning */
    U32(STAGE_ROOM0 + 0x30u) = cNode;
    c = make_call(); c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_ROOM0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC67A20u, "REGPOP_PopulateRoomMonsters113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }
}



static void emit_batch_4a(void) {
  CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* 91. 0x6FC685C0 NPCS_ClosePlayerTradeAndFreeGamble_6FC685C0 (eax=pGame, esi=pPlayer, stack=[pNpcUnit, pNpcRecord], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    U8(STAGE_UNIT0 + 0x6Cu) = 1u;
    U32(STAGE_UNIT0 + 0x68u) = 1u;
    U32(STAGE_UNIT0 + 0x64u) = 0x201u;
    uint32_t pRec = STAGE_SCRATCH;
    if (k > 0) {
      uint32_t node1 = STAGE_SCRATCH + 0x20u;
      uint32_t node2 = STAGE_SCRATCH + 0x40u;
      U32(node1 + 0x00u) = STAGE_UNIT0;
      U32(node1 + 0x04u) = (k == 2) ? 1u : 0u;
      U32(node1 + 0x08u) = (k == 2) ? node2 : 0u;
      U32(node2 + 0x00u) = 0u;
      U32(pRec) = node1;
    } else {
      U32(pRec) = 0u;
    }
    c = make_call(); c.eax = STAGE_GAME; c.esi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_UNIT1; c.args[1] = pRec; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_UNIT1; ts[3] = (int64_t)pRec;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC685C0u, "NPCS_ClosePlayerTradeAndFreeGamble_6FC685C0_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 92. 0x6FC687A0 NPC_StartPlayerNpcInteraction_6FC687A0 (eax=pUnit, stack=[pGame, pInteractUnit, ppListHead, bFlag], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_client_pkt_pool();
    uint32_t pHead = STAGE_SCRATCH;
    uint32_t pInteract = 0u;
    if (k > 0) {
      /* k=1: non-vendor monster returns 1; k=2: vendor Akara (0x94) already in interaction list or fresh vendor */
      uint32_t cid = (k == 1) ? g_mon_id_0 : 0x94u;
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 0x201u, 1u, 4812u, 4812u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      pInteract = STAGE_UNIT1;
      if (k == 2) {
        U32(STAGE_SCRATCH + 0x20u) = STAGE_UNIT0;
        U32(pHead) = STAGE_SCRATCH + 0x20u;
      }
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 4u;
    c.args[0] = STAGE_GAME; c.args[1] = pInteract; c.args[2] = pHead; c.args[3] = 0u; c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)pInteract; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)pHead; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC687A0u, "NPC_StartPlayerNpcInteraction_6FC687A0_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 93. 0x6FC68FC0 HIRELING_AssignMercenaryToPlayer_6FC68FC0 (stack=[pGame, pPlayer, pMerc, wFlag, pMercSaveData, bSkipSub], ret 18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pPlrPets = (uint32_t)(uintptr_t)bump_alloc(8u);
    uint32_t pPetSlots = (uint32_t)(uintptr_t)bump_alloc(20u * 12u);
    U32(pPetSlots + 7u * 12u + 0x08u) = 1u; /* nMax = 1 for petType 7 (hireling) */
    U32(pPlrPets) = pPetSlots;
    U32(STAGE_UDATA0 + 0x44u) = pPlrPets;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x10Fu, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_client_pkt_pool();
    U32(STAGE_GAME + 0x70u) = 1u; /* expansion */
    uint32_t pSave = (k == 0) ? 0u : STAGE_SCRATCH;
    if (pSave != 0u) {
      U16(pSave + 0x00u) = (k == 2) ? 1u : 0u; /* wNameIdx */
      U32(pSave + 0x04u) = 0x13572469u + (uint32_t)k; /* dwSeed */
    }
    uint32_t wFlag = 0u;
    uint32_t bSkip = (k == 2) ? 0u : 1u;
    c = make_call(); c.nargs = 6u;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1;
    c.args[3] = wFlag; c.args[4] = pSave; c.args[5] = bSkip; c.calleePop = 24u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_UNIT1;
    ts[3] = (int64_t)wFlag; ts[4] = (int64_t)pSave; ts[5] = (int64_t)bSkip;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC68FC0u, "HIRELING_AssignMercenaryToPlayer_6FC68FC0_113c", k, lbl, &c, ts, 6u, 0x00000000u, 0);
  }

  /* 94. 0x6FC6B400 CLIENTS_UpdatePlayerRoom (eax=pClient, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4815u, 4815u, STAGE_CLIENT);
    stage_client_pkt_pool();
    if (k == 2) {
      attach_skill(STAGE_UNIT0, 36, 1);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0xC8u) |= (1u << 21); /* bit 21 -> D2GAME_ITEMS_UpdateAllInventoryAndEquipmentStats */
    }
    U32(STAGE_CLIENT + 0x1B0u) = 5u;
    U32(STAGE_CLIENT + 0x1B4u) = STAGE_ROOM0;
    uint32_t cli = (k == 0) ? 0u : STAGE_CLIENT;
    c = make_call(); c.eax = cli; c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)cli; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6B400u, "CLIENTS_UpdatePlayerRoom113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 96. 0x6FC6C870 SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870 (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t sk = (k == 0) ? 0xFFFFFFFFu : 26u; /* Strafe */
    uint32_t pSk = attach_skill(STAGE_UNIT0, 26, 5);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_tknife, 0x401u, 1u, 4u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x46, 20, 0);
    place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4814u, 4814u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u; c.args[0] = sk; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(int32_t)sk; ts[3] = 5;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6C870u, "SKILLS_SrvSt_PrepareMultiTargetRangedVolley_6FC6C870_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 97. 0x6FC6DAC0 SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0 (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 500 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 500 << 8, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t sk = (k == 0) ? 0xFFFFFFFFu : 106u; /* Zeal */
    uint32_t pSk = attach_skill(STAGE_UNIT0, 106, 5);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    U32(pSk + 0x18u) = (uint32_t)(k + 1); /* Param1 remCount */
    U32(pSk + 0x1Cu) = 1u; /* Param2 type=MONSTER */
    U32(pSk + 0x20u) = (k == 2) ? 0x201u : 0x999u; /* Param3 id */
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u; c.args[0] = sk; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(int32_t)sk; ts[3] = 5;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6DAC0u, "SKILLS_SrvDo062_StrikeTrackedPetTargetAndAdvanceChain_6FC6DAC0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 98. 0x6FC6DCD0 SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0 (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4815u, 4815u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t sk = (k == 0) ? 0xFFFFFFFFu : 26u; /* Strafe */
    uint32_t pSk = attach_skill(STAGE_UNIT0, 26, 5);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    U32(pSk + 0x18u) = (k == 2) ? 2u : 0u; /* Param1 remCount */
    U32(pSk + 0x1Cu) = 1u; /* type MONSTER */
    U32(pSk + 0x20u) = 0x201u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u; c.args[0] = sk; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(int32_t)sk; ts[3] = 5;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6DCD0u, "SKILLS_SrvDo063_RangedMultiShotAtTrackedPetTargets_6FC6DCD0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }
}



static void emit_batch_4b(void) {
  CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* 107. 0x6FCEDA20 C2S_Packet3B_SpendSkillPoint_6FCEDA20 (ecx=pGame, edx=pPlayer, stack=[pPacket, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4810u, 4810u, 0u); /* Sorceress, pClient=0 avoids 0x6FCAD5F0 uninit pkt byte 11 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 30, 0); /* clvl=30 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 5, (k == 1) ? 0 : 3, 0); /* skillpts=0 vs 3 */
    attach_skill(STAGE_UNIT0, 36, 1); /* Fire Bolt lvl 1 */
    U8(STAGE_SCRATCH + 0u) = 0x3Bu;
    U16(STAGE_SCRATCH + 1u) = 36u;
    uint32_t plen = (k == 0) ? 2u : 3u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u;
    c.args[0] = STAGE_SCRATCH; c.args[1] = plen; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH; ts[3] = (int64_t)plen;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEDA20u, "C2S_Packet3B_SpendSkillPoint_6FCEDA20_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 108. 0x6FCEDF30 C2S_ExecuteSkillOnLocation (eax=pSkill, ecx=pPlayer, stack=[pGame, nX, nY], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, (k == 0) ? 0u : 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSk = attach_skill(STAGE_UNIT0, 36, 3); /* Fire Bolt */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 50 << 8, 0);
    uint32_t nx = (k == 2) ? 4820u : 4815u;
    uint32_t ny = (k == 2) ? 4822u : 4815u;
    c = make_call(); c.eax = pSk; c.ecx = STAGE_UNIT0; c.nargs = 3u;
    c.args[0] = STAGE_GAME; c.args[1] = nx; c.args[2] = ny; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pSk; ts[3] = (int64_t)nx; ts[4] = (int64_t)ny;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEDF30u, "C2S_ExecuteSkillOnLocation113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 109. 0x6FCEE620 C2S_ExecuteSkillOnUnit (eax=pSkill, ecx=pPlayer, stack=[pGame, dwType, dwId, bAllowMove], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_sword, 0x401u, 1u, 0u, 0u);
    place_body_item(STAGE_UNIT0, STAGE_UNIT2, 4);
    uint16_t mx = (k == 2) ? 4840u : 4830u;
    uint16_t my = (k == 2) ? 4842u : 4830u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, mx, my);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pSk = attach_skill(STAGE_UNIT0, 96, 1); /* Sacrifice (rangeType==1) */
    uint32_t dwId = (k == 0) ? 0x999u : 0x201u;
    uint32_t bMove = 1u;
    c = make_call(); c.eax = pSk; c.ecx = STAGE_UNIT0; c.nargs = 4u;
    c.args[0] = STAGE_GAME; c.args[1] = 1u; c.args[2] = dwId; c.args[3] = bMove; c.calleePop = 16u;
    /* ts: [pGame, pPlayer, pSkill, bAllowMove, dwType, dwId] */
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pSk;
    ts[3] = (int64_t)bMove; ts[4] = 1; ts[5] = (int64_t)dwId;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEE620u, "C2S_ExecuteSkillOnUnit113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* 114. 0x6FCF8440 ITEMS_SplitOrTransmuteStackedItem_6FCF8440 (eax=pItem, stack=[pGame, pPlayer], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_client_pkt_pool();
    uint32_t nItems = U32(D2COM_VA(0x9FB94u) + g_com_rebase);
    uint32_t pItems = U32(D2COM_VA(0x9FB98u) + g_com_rebase);
    uint32_t tmogCid = g_item_tknife;
    for (uint32_t id = 0u; id < nItems; id++) {
      if (U8(pItems + id * 0x1A8u + 0x139u) != 0u) { tmogCid = id; break; }
    }
    uint32_t cid = (k == 0) ? g_item_sword : tmogCid;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 0x401u, (k == 1) ? 1u : 0u, 0u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    fn_PlaceInGridCell((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1, 0, 0, 1, 0, 0);
    c = make_call(); c.eax = STAGE_UNIT1; c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF8440u, "ITEMS_SplitOrTransmuteStackedItem_6FCF8440_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 117. 0x6FCFA6D0 SUNITDMG_RemoveCombatNode (edi=pAttacker, stack=[pGame, pDefender], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, (k == 2) ? 0x202u : 0x201u, 1u, 4812u, 4812u);
    if (k > 0) {
      uint32_t pCbt1 = STAGE_SCRATCH;
      uint32_t pCbt2 = STAGE_SCRATCH + 0x90u;
      U32(pCbt1 + 0x04u) = 0u;
      U32(pCbt1 + 0x08u) = 0x101u;
      U32(pCbt1 + 0x0Cu) = 1u;
      U32(pCbt1 + 0x10u) = 0x201u;
      U32(pCbt1 + 0x84u) = pCbt2;
      U32(pCbt2 + 0x04u) = 0u;
      U32(pCbt2 + 0x08u) = 0x101u;
      U32(pCbt2 + 0x0Cu) = 1u;
      U32(pCbt2 + 0x10u) = 0x202u;
      U32(pCbt2 + 0x84u) = 0u;
      U32(STAGE_UNIT0 + 0xACu) = pCbt1;
    }
    c = make_call(); c.edi = STAGE_UNIT0; c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFA6D0u, "SUNITDMG_RemoveCombatNode113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }
}



static void emit_batch_5a(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[64];

  /* 126. 0x6FCFAD00 SUNITDMG_ApplyElementalAbsorb (eax=dmg, ecx=pCombat, ebx=pSlot, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pCombat = STAGE_SCRATCH;
    uint32_t pSlot   = STAGE_SCRATCH + 0x40u;
    uint32_t pDmg    = STAGE_SCRATCH + 0x80u;
    U32(pCombat + 0x0Cu) = STAGE_UNIT0;
    U32(pCombat + 0x18u) = pDmg;
    U32(pDmg + 0x48u) = 0u;
    uint32_t dmg = (k == 2) ? 100u : 1000u;
    uint32_t pctStat = 142u;
    uint32_t flatStat = 143u;
    if (k == 0) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 142, 20, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 143, 0, 0);
    } else if (k == 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 142, 60, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 143, 1, 0);
    } else {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 142, 0, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 143, 2, 0);
    }
    U32(pSlot + 0x10u) = pctStat;
    U32(pSlot + 0x14u) = flatStat;
    c = make_call(); c.eax = dmg; c.ecx = pCombat; c.ebx = pSlot;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)dmg; ts[2] = (int64_t)pctStat;
    ts[3] = (int64_t)flatStat; ts[4] = (int64_t)pDmg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFAD00u, "SUNITDMG_ApplyElementalAbsorb113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 128. 0x6FCFB030 SUNITDMG_RollDodgeAvoidEvadeBlock (eax=pDefender, edi=pGame, stack=[bIsMissile], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t mode = (k == 2) ? 3u : 1u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, mode, 4810u, 4810u, STAGE_CLIENT);
    if (k == 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 338, 100, 0);
    if (k == 2) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 340, 100, 0);
    c = make_call(); c.eax = STAGE_UNIT0; c.edi = STAGE_GAME; c.nargs = 1u; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFB030u, "SUNITDMG_RollDodgeAvoidEvadeBlock113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, 0);
  }

  /* 130. 0x6FCFB3C0 SUNITDMG_GetEffectiveResistance (ebx=pResDesc, edi=pCombat, ret 0) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U8(STAGE_GAME + 0x6Du) = (k == 1) ? 1u : 0u;
    U32(STAGE_GAME + 0x70u) = 1u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x102u, 1u, 4812u, 4812u, 0u);
    uint32_t pDesc   = STAGE_SCRATCH;
    uint32_t pCombat = STAGE_SCRATCH + 0x40u;
    uint32_t pDiff   = STAGE_SCRATCH + 0x80u;
    int32_t  diffPen = (k == 1) ? -40 : 0;
    U32(pDiff + 0x00u) = (uint32_t)diffPen;
    uint32_t resStat    = (k == 2) ? 36u : 39u;
    uint32_t maxStat    = (k == 2) ? 0xFFFFFFFFu : 40u;
    uint32_t pierceStat = (k == 2) ? 0xFFFFFFFFu : 333u;
    uint32_t pAttacker  = (k == 2) ? 0u : STAGE_UNIT1;
    if (k == 0) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 39, 60, 0);
    } else if (k == 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 39, 50, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 333, 25, 0);
    } else if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 36, 70, 0);
    } else {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 39, 95, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 40, 10, 0);
    }
    U32(pDesc + 0x04u)   = resStat;
    U32(pDesc + 0x08u)   = maxStat;
    U32(pDesc + 0x0Cu)   = pierceStat;
    U32(pCombat + 0x00u) = STAGE_GAME;
    U32(pCombat + 0x04u) = pDiff;
    U32(pCombat + 0x08u) = pAttacker;
    U32(pCombat + 0x0Cu) = STAGE_UNIT0;
    U32(pCombat + 0x14u) = 0u;
    c = make_call(); c.ebx = pDesc; c.edi = pCombat;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)resStat; ts[2] = (int64_t)pAttacker;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFB3C0u, "SUNITDMG_GetEffectiveResistance113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 133. 0x6FCFB790 SUNITDMG_RollPassiveWeaponBlockOrShieldBlock (esi=pDefender, eax=bSkipAvoid, ecx=pGame, stack=[pGame, bIsMissile], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t mode = (k == 2) ? 3u : 1u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, mode, 4810u, 4810u, STAGE_CLIENT);
    if (k > 0) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_shield, 0x401u, 0u, 0u, 0u);
      place_body_item(STAGE_UNIT0, STAGE_UNIT2, 5);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 20, 75, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 200, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 1, 0);
    } else {
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    }
    c = make_call(); c.esi = STAGE_UNIT0; c.eax = 1u; c.ecx = STAGE_GAME;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFB790u, "SUNITDMG_RollPassiveWeaponBlockOrShieldBlock113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 149. 0x6FCFDCB0 HIRELING_GrantSharedExpAndCheckLevelUp (eax=nExpGain, stack=[pGame, pPlayer, pPetUnit, nCurrentLevel], ret 16) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x10Fu, 0x201u, 1u, 4812u, 4812u);
    stage_client_pkt_pool();
    U32(STAGE_GAME + 0x70u) = 1u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 13, 500, 0);
    uint32_t pPlrPets  = (uint32_t)(uintptr_t)bump_alloc(8u);
    uint32_t pPetSlots = (uint32_t)(uintptr_t)bump_alloc(20u * 12u);
    uint32_t pNode     = STAGE_SCRATCH;
    U32(pNode + 0x04u) = 0x201u;
    U32(pNode + 0x10u) = 1u;
    U32(pPetSlots + 7u * 12u + 0x00u) = pNode;
    U32(pPetSlots + 7u * 12u + 0x08u) = 1u;
    U32(pPlrPets) = pPetSlots;
    U32(STAGE_UDATA0 + 0x44u) = pPlrPets;
    uint32_t expGain = (k == 0) ? 0u : ((k == 1) ? 100u : 200u);
    c = make_call(); c.eax = expGain; c.nargs = 4u;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.args[3] = 2u; c.calleePop = 16u;
    ts[0] = (int64_t)expGain; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0;
    ts[3] = (int64_t)STAGE_UNIT1; ts[4] = 2;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFDCB0u, "HIRELING_GrantSharedExpAndCheckLevelUp_6FCFDCB0_113c", k, lbl, &c, ts, 5u, 0x00000000u, 0);
  }
}



static void emit_batch_6a(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[64];

  /* 154. 0x6FD00110 SUNIT_InitUnitSeed (edi=pUnit, esi=pGameSeed, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSeed = STAGE_SCRATCH;
    U32(pSeed + 0x00u) = 0x13579BDFu + (uint32_t)k * 0x11111111u;
    U32(pSeed + 0x04u) = 0x0000029Au + (uint32_t)k;
    c = make_call(); c.edi = STAGE_UNIT0; c.esi = pSeed;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)pSeed;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD00110u, "SUNIT_InitUnitSeed113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 155, 156, 161, 170 moved to skipped_b6.json (ts_parity_bug) */

  /* 157. 0x6FD012D0 SUNIT_CreatePresetUnit (eax=nClassId, edx=nUnitType, ecx=nMode, stack=[pGame, pRoom, x, y], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    stage_obj_ctrl_full(2u, 0u);
    uint32_t uType = (k == 2) ? 5u : 2u;
    uint32_t cid   = (k == 0) ? 0x23Du : ((k == 1) ? 2u : 1u);
    uint32_t x     = 4810u;
    uint32_t y     = 4812u;
    uint32_t mode  = 0u;
    c = make_call(); c.eax = cid; c.edx = uType; c.ecx = mode;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = x; c.args[3] = y; c.calleePop = 16u;
    ts[0] = (int64_t)mode; ts[1] = (int64_t)cid; ts[2] = (int64_t)uType;
    ts[3] = (int64_t)STAGE_GAME; ts[4] = (int64_t)STAGE_ROOM0; ts[5] = (int64_t)x; ts[6] = (int64_t)y;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD012D0u, "SUNIT_CreatePresetUnit113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 158. 0x6FD013B0 ROOM_SpawnPresetUnit (edi=pRoom, esi=pPreset, ebx=pGame, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    stage_obj_ctrl_full(2u, 0u);
    uint32_t pPreset = STAGE_SCRATCH;
    U32(pPreset + 0x00u) = 0u;
    U32(pPreset + 0x04u) = (k == 0) ? 0x23Du : ((k == 1) ? 2u : 1u);
    U32(pPreset + 0x08u) = 10u;
    U32(pPreset + 0x0Cu) = 0u;
    U32(pPreset + 0x10u) = 0u;
    U32(pPreset + 0x14u) = (k == 2) ? 5u : 2u;
    U32(pPreset + 0x18u) = 12u;
    c = make_call(); c.edi = STAGE_ROOM0; c.esi = pPreset; c.ebx = STAGE_GAME;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_ROOM0; ts[2] = (int64_t)pPreset;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD013B0u, "ROOM_SpawnPresetUnit113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 159. 0x6FD01430 ROOM_SpawnPresetUnits (eax=pRoom, ecx=pGame, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t lvl = (k == 2) ? 0x88u : 2u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_timer_queue();
    stage_mon_reg(lvl);
    stage_obj_ctrl_full(2u, 0u);
    uint32_t p1 = STAGE_SCRATCH;
    U32(p1 + 0x00u) = 0u;
    U32(p1 + 0x04u) = (k == 2) ? 0x10Cu : 2u;
    U32(p1 + 0x08u) = 10u;
    U32(p1 + 0x14u) = 2u;
    U32(p1 + 0x18u) = 12u;
    if (k == 2) {
      uint32_t p2 = STAGE_SCRATCH + 0x40u;
      U32(p1 + 0x0Cu) = p2;
      U32(p2 + 0x04u) = 1u;
      U32(p2 + 0x08u) = 14u;
      U32(p2 + 0x14u) = 5u;
      U32(p2 + 0x18u) = 14u;
    }
    U32(STAGE_ROOMEX0 + 0x5Cu) = p1;
    uint32_t pg = (k == 0) ? 0u : STAGE_GAME;
    c = make_call(); c.eax = STAGE_ROOM0; c.ecx = pg;
    ts[0] = (int64_t)pg; ts[1] = (int64_t)STAGE_ROOM0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD01430u, "ROOM_SpawnPresetUnits113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 167. 0x6FD086A0 ACT3Q2_InitGidbinnBossDefaultPreset (ecx=pObjInitStrc, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 78u);
    stage_timer_queue();
    stage_mon_reg(78u);
    stage_party_ctrl();
    if (k > 0) {
      stage_quest_node(0x0Eu, 0x20u);
      U32(STAGE_QUESTCTRL + 0x08u) = 1u;
      U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
      U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x20u;
      U32(STAGE_QBITS0 + 0x04u) = 0x200u;
      if (k == 1) set_quest_bit(STAGE_QBITS0, 0x10u, 0x0Du);
    }
    uint32_t pInit = STAGE_SCRATCH;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x08u) = STAGE_ROOM0;
    U32(pInit + 0x14u) = 4810u;
    U32(pInit + 0x18u) = 4812u;
    c = make_call(); c.ecx = pInit;
    ts[0] = (int64_t)pInit;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD086A0u, "ACT3Q2_InitGidbinnBossDefaultPreset_6FD086A0_113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 169. 0x6FCFEA00 SUNITDMG_TriggerPostCombatEvents (stack=[pGame, pAttacker, pDefender], ret 0xc) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4810u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 1u + (uint32_t)k * 5u, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 13, 0, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 85, (k == 2) ? 50 : 0, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 3u + (uint32_t)k * 4u, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 13, (k == 0) ? 100 : (200u + (uint32_t)k * 150u), 0);
    U16(STAGE_CLIENT + 0x00Au) = 0xFFFFu; /* solo partyId slot check if needed */
    c = make_call();
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)c.args[1]; ts[2] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFEA00u, "SUNITDMG_TriggerPostCombatEvents_6FCFEA00_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

}



static void emit_batch_6b(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[64];

  /* 168, 171..174 moved to skipped_b6.json (ts_parity_bug via MONSTER_Create113c) */

  /* 175. 0x6FD114F0 SKILLS_CastTriggeredSkillCore (eax=pTargetUnit, ecx=pCasterUnit, stack=[pGame..bConsumeMana], ret 28) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t skId = (k == 0) ? 0u : ((k == 1) ? 42u : 104u);
    uint32_t pOutType = STAGE_SCRATCH;
    uint32_t pOutId   = STAGE_SCRATCH + 0x04u;
    uint32_t pOutX    = STAGE_SCRATCH + 0x08u;
    uint32_t pOutY    = STAGE_SCRATCH + 0x0Cu;
    U32(pOutType) = 6u; U32(pOutId) = 0xFFFFFFFFu;
    c = make_call(); c.eax = STAGE_UNIT1; c.ecx = STAGE_UNIT0; c.nargs = 10u;
    c.args[0] = STAGE_GAME; c.args[1] = skId; c.args[2] = 1u; c.args[3] = 4812u; c.args[4] = 4812u;
    c.args[5] = pOutType; c.args[6] = pOutId; c.args[7] = pOutX; c.args[8] = pOutY; c.args[9] = 0u;
    c.calleePop = 40u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    ts[3] = (int64_t)(int32_t)skId; ts[4] = 1; ts[5] = 4812; ts[6] = 4812;
    ts[7] = (int64_t)pOutType; ts[8] = (int64_t)pOutId; ts[9] = (int64_t)pOutX; ts[10] = (int64_t)pOutY; ts[11] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD114F0u, "SKILLS_CastTriggeredSkillCore113c", k, lbl, &c, ts, 12u, 0xFFFFFFFFu, 0);
  }

  /* 176. 0x6FD117E0 SKILLS_TriggerSkillOnTarget (eax=pTargetUnit, ecx=pCasterUnit, stack=[nSkillId, nSkillLevel, bConsumeMana], ret C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pTgt = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t skId = (k == 2) ? 104u : 42u;
    c = make_call(); c.eax = pTgt; c.ecx = STAGE_UNIT0; c.nargs = 3u;
    c.args[0] = skId; c.args[1] = 1u; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = (int64_t)pTgt; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)skId; ts[3] = 1; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD117E0u, "SKILLS_TriggerSkillOnTarget113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 177. 0x6FD12220 AI_StartAttackMode (eax=nMode, edi=pUnit, stack=[pGame, pTarget], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4812u, 4812u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t mode = (k == 0) ? 4u : ((k == 1) ? 5u : 8u);
    uint32_t tgt  = (k == 2) ? 0u : STAGE_UNIT1;
    c = make_call(); c.eax = mode; c.edi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = tgt; c.calleePop = 8u;
    ts[0] = (int64_t)mode; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)tgt;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD12220u, "AI_StartAttackMode113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 178. 0x6FD00C80 SUNIT_DeactivateAndRemoveUnit (eax=pUnit, edi=pGame, stack=[bKeepInRoom], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t bKeep = (k == 2) ? 1u : 0u;
    uint32_t pU = STAGE_UNIT0;
    if (k == 0) {
      stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x401u, 3u, 4810u, 4810u);
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    }
    insert_server_unit(STAGE_GAME, pU);
    link_unit_into_room(STAGE_ROOM0, pU);
    c = make_call(); c.eax = pU; c.edi = STAGE_GAME;
    c.nargs = 1u; c.args[0] = bKeep; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)pU; ts[2] = (int64_t)bKeep;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD00C80u, "SUNIT_DeactivateAndRemoveUnit113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 179. 0x6FD0EF10 MONSTER_Create (ecx=pSpawnArgs, ret 0, probe mode wFlags=1) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x12345678u + (uint32_t)k * 0x1111u;
    U32(STAGE_ROOM0 + 0x70u) = 0x0000029Au;
    uint32_t pArgs = STAGE_SCRATCH;
    U32(pArgs + 0x00u) = STAGE_GAME;
    U32(pArgs + 0x04u) = STAGE_ROOM0;
    U32(pArgs + 0x08u) = 0u;
    U32(pArgs + 0x0Cu) = (k == 0) ? 0xFFFFFFFFu : g_mon_id_1;
    U32(pArgs + 0x10u) = 1u;
    U32(pArgs + 0x14u) = 0u;
    U32(pArgs + 0x18u) = 4810u + (uint32_t)k;
    U32(pArgs + 0x1Cu) = 4810u + (uint32_t)k;
    U32(pArgs + 0x20u) = (k == 2) ? 4u : 2u;
    U16(pArgs + 0x24u) = 1u; /* probe-only */
    c = make_call(); c.ecx = pArgs;
    ts[0] = (int64_t)pArgs;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0EF10u, "MONSTER_Create113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, 0);
  }

  /* 180. 0x6FD0DDB0 MONSTER_SpawnPartyMinionInRing (eax=nClassId, edx=pLeader, ecx=nMode, stack=[pGame, nMaxRadius, wFlags], ret 0xc) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x23456789u + (uint32_t)k * 0x2222u;
    U32(STAGE_ROOM0 + 0x70u) = 0x0000029Au;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t cls = (k == 0) ? 0xFFFFFFFFu : g_mon_id_1;
    uint32_t rad = (k == 2) ? 4u : 2u;
    c = make_call(); c.eax = cls; c.edx = STAGE_UNIT0; c.ecx = 1u;
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = rad; c.args[2] = 1u; c.calleePop = 12u;
    ts[0] = (int64_t)(int32_t)cls; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = 1;
    ts[3] = (int64_t)STAGE_GAME; ts[4] = (int64_t)rad; ts[5] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0DDB0u, "MONSTER_SpawnPartyMinionInRing113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* 181. 0x6FD0F450 MONSTER_SpawnAtCoords_6FD0F450 (eax=dwArg14, ecx=nClassId, edx=nMode, stack=[pGame, pRoom, x, y, nMaxRadius, wFlags], ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x3456789Au + (uint32_t)k * 0x3333u;
    U32(STAGE_ROOM0 + 0x70u) = 0x0000029Au;
    uint32_t cls = (k == 0) ? 0xFFFFFFFFu : g_mon_id_1;
    uint32_t rad = (k == 2) ? 4u : 2u;
    c = make_call(); c.eax = 0u; c.ecx = cls; c.edx = 1u;
    c.nargs = 6u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = 4810u + (uint32_t)k;
    c.args[3] = 4810u + (uint32_t)k; c.args[4] = rad; c.args[5] = 1u; c.calleePop = 24u;
    ts[0] = 0; ts[1] = (int64_t)(int32_t)cls; ts[2] = 1;
    ts[3] = (int64_t)STAGE_GAME; ts[4] = (int64_t)STAGE_ROOM0;
    ts[5] = (int64_t)c.args[2]; ts[6] = (int64_t)c.args[3]; ts[7] = (int64_t)rad; ts[8] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0F450u, "MONSTER_SpawnAtCoords_6FD0F450_113c", k, lbl, &c, ts, 9u, 0xFFFFFFFFu, 0);
  }

  /* 182. 0x6FD0F510 MONSTER_SpawnPackLeader (eax=nClassId, edx=pRoom, ecx=nMode, stack=[pGame, pCoordNode, x, y, nMaxRadius, wFlags], ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x456789ABu + (uint32_t)k * 0x4444u;
    U32(STAGE_ROOM0 + 0x70u) = 0x0000029Au;
    uint32_t cls = (k == 0) ? 0xFFFFFFFFu : g_mon_id_1;
    uint32_t rad = (k == 2) ? 4u : 2u;
    c = make_call(); c.eax = cls; c.edx = STAGE_ROOM0; c.ecx = 1u;
    c.nargs = 6u; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.args[2] = 4810u + (uint32_t)k;
    c.args[3] = 4810u + (uint32_t)k; c.args[4] = rad; c.args[5] = 1u; c.calleePop = 24u;
    ts[0] = (int64_t)(int32_t)cls; ts[1] = (int64_t)STAGE_ROOM0; ts[2] = 1;
    ts[3] = (int64_t)STAGE_GAME; ts[4] = 0; ts[5] = (int64_t)c.args[2];
    ts[6] = (int64_t)c.args[3]; ts[7] = (int64_t)rad; ts[8] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0F510u, "MONSTER_SpawnPackLeader113c", k, lbl, &c, ts, 9u, 0xFFFFFFFFu, 0);
  }

  /* 183. 0x6FD0F570 MONSTER_SpawnPackMember (eax=nClassId, edx=pLeader, ecx=nMode, stack=[pGame, pCoordNode, nMaxRadius, wFlags], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x56789ABCu + (uint32_t)k * 0x5555u;
    U32(STAGE_ROOM0 + 0x70u) = 0x0000029Au;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t cls = (k == 0) ? 0xFFFFFFFFu : g_mon_id_1;
    uint32_t rad = (k == 2) ? 4u : 2u;
    c = make_call(); c.eax = cls; c.edx = STAGE_UNIT0; c.ecx = 1u;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.args[2] = rad; c.args[3] = 1u; c.calleePop = 16u;
    ts[0] = (int64_t)(int32_t)cls; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = 1;
    ts[3] = (int64_t)STAGE_GAME; ts[4] = 0; ts[5] = (int64_t)rad; ts[6] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0F570u, "MONSTER_SpawnPackMember113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 184. 0x6FD0F650 MONSTER_SpawnAtCoords (ecx=nClassId, edx=nMode, stack=[pGame, pRoom, x, y, nMaxRadius, wFlags], ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x6789ABCDu + (uint32_t)k * 0x6666u;
    U32(STAGE_ROOM0 + 0x70u) = 0x0000029Au;
    uint32_t cls = (k == 0) ? 0xFFFFFFFFu : g_mon_id_1;
    uint32_t rad = (k == 2) ? 4u : 2u;
    c = make_call(); c.ecx = cls; c.edx = 1u;
    c.nargs = 6u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = 4810u + (uint32_t)k;
    c.args[3] = 4810u + (uint32_t)k; c.args[4] = rad; c.args[5] = 1u; c.calleePop = 24u;
    ts[0] = (int64_t)(int32_t)cls; ts[1] = 1;
    ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)STAGE_ROOM0; ts[4] = (int64_t)c.args[2];
    ts[5] = (int64_t)c.args[3]; ts[6] = (int64_t)rad; ts[7] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0F650u, "MONSTER_SpawnAtCoords113c", k, lbl, &c, ts, 8u, 0xFFFFFFFFu, 0);
  }

  /* 185. 0x6FD00F40 SUNIT_PlaceServerUnitInRoom (eax=y, ecx=pRoom, edx=pUnit, stack=[x, pGame, bNoActivate], ret 0xc) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t itemMode = (uint32_t)k; /* 0, 1, 2 (not 3 so no alloc) */
    uint32_t bNoAct = (k == 1) ? 1u : 0u;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, g_item_sword, 0x410u + (uint32_t)k, itemMode, 2u, 0u);
    uint32_t y = 4812u + (uint32_t)k;
    c = make_call(); c.eax = STAGE_ROOM0; c.ecx = y; c.edx = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = 4810u + (uint32_t)k; c.args[1] = STAGE_GAME; c.args[2] = bNoAct; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_ROOM0; ts[1] = (int64_t)y; ts[2] = (int64_t)STAGE_UNIT0;
    ts[3] = (int64_t)c.args[0]; ts[4] = (int64_t)STAGE_GAME; ts[5] = (int64_t)bNoAct;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD00F40u, "SUNIT_PlaceServerUnitInRoom113c", k, lbl, &c, ts, 6u, 0x00000000u, 0);
  }
}



static void emit_batch_hints(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* H1. 0x6FC3B950 AI_ThinkAct2SewerTownNpc (ecx=pGame, edx=pUnit, stack=[pAiThinkArg], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    uint32_t pHead  = (uint32_t)(uintptr_t)bump_alloc(16u);
    uint32_t pCmd10 = (uint32_t)(uintptr_t)bump_alloc(0x28u);
    U32(pHead + 0x00u) = pCmd10;
    U32(pCmd10 + 0x00u) = pHead;
    U32(pCmd10 + 0x08u) = 0x0Au;
    U32(pCmd10 + 0x0Cu) = (k == 0) ? 4810u : ((k == 1) ? 4820u : 4830u);
    U32(pCmd10 + 0x10u) = 4810u;
    U32(pCmd10 + 0x18u) = 50u;
    U32(pAiGen + 0x20u) = pHead;
    if (k == 0) {
      U32(STAGE_GAME + 0xA8u) = 60u; /* curFrame - lastMove < 0xc8 -> stall */
    } else if (k == 1) {
      U32(STAGE_GAME + 0xA8u) = 400u; /* >= 0xc8, dist > 1 -> approach */
    } else {
      U32(STAGE_GAME + 0xA8u) = 400u;
      uint32_t pQ = stage_quest_node(0x09u, 0x40u);
      U8(pQ + 0x09u) = 1u;
      U8(pQ + 0x0Cu) = 5u;
    }
    uint32_t pArg = STAGE_SCRATCH;
    U32(pArg + 0x00u) = U32(STAGE_UDATA0 + 0x2Cu);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pArg; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pArg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC3B950u, "AI_ThinkAct2SewerTownNpc_6FC3B950_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* H2. 0x6FC3E640 D2Game_6FC3E640 (eax=pUnit, stack=[pGame, pAiTickArgs], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t pTick = STAGE_SCRATCH;
    uint32_t pAiParam = STAGE_SCRATCH + 0x40u;
    U32(pTick + 0x00u) = pAiParam;
    U32(pTick + 0x1Cu) = U32(STAGE_UDATA0 + 0x00u);
    if (k >= 1) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4890u, 4810u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      if (k == 1) {
        uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
        U32(pAiGen + 0x28u) = STAGE_GAME;
        U32(pAiGen + 0x2Cu) = 0x101u;
        U32(pAiGen + 0x30u) = 0u;
      } else {
        U32(pAiParam + 0x1Cu) = 0x101u;
      }
    }
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = pTick; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)pTick; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC3E640u, "D2Game_6FC3E640_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* H3. 0x6FC566A0 QUESTS_FindAndDeletePlayerQuestItemByCode (eax=dwItemCode, esi=pPlayerUnit, ecx=pGame, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_scroll, 0x401u, (k == 1) ? 4u : 0u, 2u, 0u);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, (k == 1) ? 4u : 0u);
    uint32_t pInv = U32(STAGE_UNIT0 + 0x60u);
    if (pInv != 0u) {
      add_extra_cap(pInv, 0x40u);
      if (k == 1) {
        U32(pInv + 0x20u) = STAGE_UNIT1;
      }
    }
    uint32_t code = (k == 0) ? 0x20786F62u : 0x20637374u; /* 'box ' vs 'tsc ' */
    c = make_call(); c.eax = code; c.esi = STAGE_UNIT0; c.ecx = STAGE_GAME;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)code;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC566A0u, "QUESTS_FindAndDeletePlayerQuestItemByCode_6FC566A0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }
}



static void emit_batch_hints2(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* H9. 0x6FD11B10 AI_IdleWander (al=range, stack=[pGame, pUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4815u, 4815u);
    U32(STAGE_UNIT0 + 0x20u) = 0x24681357u + (uint32_t)k * 0x11111u;
    uint32_t range = 3u + (uint32_t)k * 3u;
    c = make_call(); c.eax = range;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)range;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD11B10u, "AI_IdleWander113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* H10. 0x6FD11D90 AI_StepRelativeToTargetUnit (eax=nMaxStep, ecx=pTargetUnit, stack=[pGame, pUnit, nMode, nIdealDist], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4815u, 4815u);
    uint16_t tx = (k == 0) ? 4817u : ((k == 1) ? 4830u : 4820u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, tx, 4815u, STAGE_CLIENT);
    uint32_t maxStep = 4u + (uint32_t)k;
    uint32_t idealDist = 5u;
    c = make_call(); c.eax = maxStep; c.ecx = STAGE_UNIT1;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = 2u; c.args[3] = idealDist; c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_UNIT1;
    ts[3] = (int64_t)maxStep; ts[4] = 2; ts[5] = (int64_t)idealDist;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD11D90u, "AI_StepRelativeToTargetUnit113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }
}



static void emit_batch_7a(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[32];

  /* 1. 0x6FD01D90 SUNIT_AllocUnitData113c (ecx=nUnitType, edx=nClassId, stack=[x,y,pGame,pRoom,wFlags,nMode,dwData], ret 1C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_obj_ctrl_full(2u, 0u);
    uint32_t uType = (k == 1) ? 5u : 2u;
    uint32_t cid   = (k == 0) ? 2u : ((k == 1) ? 1u : 3u);
    uint32_t x     = 4810u + (uint32_t)k * 4u;
    uint32_t y     = 4812u + (uint32_t)k * 4u;
    c = make_call(); c.ecx = uType; c.edx = cid; c.nargs = 7u;
    c.args[0] = x; c.args[1] = y; c.args[2] = STAGE_GAME; c.args[3] = STAGE_ROOM0;
    c.args[4] = 1u; c.args[5] = 0u; c.args[6] = 0u;
    c.calleePop = 28u;
    ts[0] = (int64_t)uType; ts[1] = (int64_t)cid; ts[2] = (int64_t)x; ts[3] = (int64_t)y;
    ts[4] = (int64_t)STAGE_GAME; ts[5] = (int64_t)STAGE_ROOM0; ts[6] = 1; ts[7] = 0; ts[8] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD01D90u, "SUNIT_AllocUnitData113c", k, lbl, &c, ts, 9u, 0xFFFFFFFFu, 0);
  }

  /* 2. 0x6FCFE0C0 SUNITDMG_ApplyDamage113c (eax=pAttacker, stack=[pGame,pDefender,bApplyResists,pDmg], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 100 << 8, 0);
    uint32_t dmgVal = ((uint32_t)(10 + k * 15)) << 8;
    U32(STAGE_DMG + 0x04u) = 0x01u;
    U32(STAGE_DMG + 0x08u) = dmgVal;
    U32(STAGE_DMG + 0x4Cu) = dmgVal;
    uint32_t bApplyRes = (k == 2) ? 0u : 1u;
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 4u;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = bApplyRes; c.args[3] = STAGE_DMG;
    c.calleePop = 16u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_UNIT1;
    ts[3] = (int64_t)STAGE_DMG; ts[4] = (int64_t)bApplyRes;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCFE0C0u, "SUNITDMG_ApplyDamage113c", k, lbl, &c, ts, 5u, 0u, 0);
  }

  /* 3. 0x6FD0E6F0 SKILLS_EquipSummonedPetItems_6FD0E6F0_113c (eax=pMonsterUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0xFC2F8u), 0x60u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pMon = 0u;
    if (k > 0) {
      uint32_t cid = (k == 2) ? 540u : g_mon_id_1;
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 0x201u, 1u, 4810u, 4810u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 30, 0);
      pMon = STAGE_UNIT0;
    }
    c = make_call(); c.eax = pMon; c.nargs = 0u; c.calleePop = 0u;
    ts[0] = (int64_t)pMon;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD0E6F0u, "SKILLS_EquipSummonedPetItems_6FD0E6F0_113c", k, lbl, &c, ts, 1u, 0u, (k == 0) ? 1 : 0);
  }

  /* 4. 0x6FCF8BA0 ITEMS_UseBeltItem_6FCF8BA0_113c (eax=pOutRejectReason, ecx=dwItemGuid, stack=[pGame,pUnit,nX,nY,bShiftToMerc], ret 14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pG = (k == 0) ? 0u : STAGE_GAME;
    uint32_t pU = (k == 1) ? 0u : STAGE_UNIT0;
    uint32_t pOut = STAGE_SCRATCH;
    U32(pOut) = 0xFFFFFFFFu;
    if (k == 2) {
      U32(STAGE_UNIT0 + 0xC8u) = 0x04u;
    }
    c = make_call(); c.eax = pOut; c.ecx = 0x9999u; c.nargs = 5u;
    c.args[0] = pG; c.args[1] = pU; c.args[2] = 4810u; c.args[3] = 4810u; c.args[4] = 0u;
    c.calleePop = 20u;
    ts[0] = (int64_t)pOut; ts[1] = 0x9999; ts[2] = (int64_t)pG; ts[3] = (int64_t)pU;
    ts[4] = 4810; ts[5] = 4810; ts[6] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCF8BA0u, "ITEMS_UseBeltItem_6FCF8BA0_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, (k < 2) ? 1 : 0);
  }

  /* 5. 0x6FC52DF0 OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c (ecx=pGame, edx=pRoom, stack=[nObjectId, wDensity, unused], ret 0C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    add_extra_cap(D2GAME_VA(0x10E608u), 0x40u);
    add_extra_cap(D2GAME_VA(0x10E230u), 0x100u);
    uint32_t pGrid = stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_obj_ctrl_full(2u, 0u);
    if (k > 0) {
      for (uint32_t i = 0u; i < 32u * 32u; i++) U16(pGrid + i * 2u) = 0u;
    } else {
      for (uint32_t i = 0u; i < 32u * 32u; i++) U16(pGrid + i * 2u) = 0x0001u;
    }
    uint32_t pCtrl = U32(STAGE_GAME + 0x10F0u);
    U32(pCtrl + 0x00u) = 0x13579BDFu + (uint32_t)k * 0x11111u;
    uint32_t wDens = (k == 0) ? 0u : 100u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_ROOM0; c.nargs = 3u;
    c.args[0] = 0u; c.args[1] = g_obj_shrine_id; c.args[2] = wDens;
    c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_ROOM0; ts[2] = (int64_t)g_obj_shrine_id; ts[3] = (int64_t)wDens;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC52DF0u, "OBJECTS_SpawnChestClusterInRoom_6FC52DF0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 6. 0x6FC43650 MONUMOD_SpectralHitMissileDamage_6FC43650_113c (eax=pGame, ecx=pAttacker, edx=pTarget, stack=[pUnused, pDamage], ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x301u, 4812u, 4812u);
    U32(STAGE_UNIT1 + 0x80u) = STAGE_GAME;
    if (k == 1) {
      U32(STAGE_UNIT1 + 0x00u) = 1u; /* non-missile -> skip */
    }
    /* lo=0x10000 -> lo*0x6ac690c5 = 0x90c50000; hi=4 -> %5 == 0 (Fire), hi=5 -> %5 == 1 (Ltng) */
    U32(STAGE_UNIT1 + 0x20u) = 0x00010000u;
    U32(STAGE_UNIT1 + 0x24u) = (k == 3) ? 5u : 4u;
    uint32_t pDmg = (k == 0) ? 0u : STAGE_DMG;
    if (pDmg != 0u) {
      U32(pDmg + 0x04u) = 1u;
      U32(pDmg + 0x08u) = 200u;
    }
    c = make_call(); c.eax = STAGE_GAME; c.ecx = STAGE_UNIT0; c.edx = STAGE_UNIT1; c.nargs = 2u;
    c.args[0] = 0u; c.args[1] = pDmg; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)pDmg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC43650u, "MONUMOD_SpectralHitMissileDamage_6FC43650_113c", k, lbl, &c, ts, 4u, 0u, 0);
  }

  /* 7. 0x6FC31490 D2GAME_CreateItemEx_6FC31490_113c (stack=[pGame, pItemDrop, bForceSeed], ret 0C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pDrop = STAGE_SCRATCH;
    uint32_t itemId = (k == 1) ? g_item_sword : ((k == 2) ? g_item_shield : g_item_claw);
    U32(pDrop + 0x04u) = STAGE_ROOM0 + 0x6Cu;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = 10u;
    U32(pDrop + 0x14u) = itemId;
    U32(pDrop + 0x18u) = 0u; /* IMODE_STORED */
    U32(pDrop + 0x1Cu) = 4810u;
    U32(pDrop + 0x20u) = 4810u;
    U32(pDrop + 0x24u) = STAGE_ROOM0;
    U16(pDrop + 0x28u) = 1u;
    U16(pDrop + 0x2Au) = 100u;
    U32(pDrop + 0x30u) = 2u; /* ITEMQUAL_NORMAL */
    if (k == 0) {
      U32(STAGE_GAME + 0x70u) = 0u; /* Classic + expansion claw -> 0 */
    }
    c = make_call(); c.nargs = 3u;
    c.args[0] = STAGE_GAME; c.args[1] = pDrop; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)pDrop; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC31490u, "D2GAME_CreateItemEx_6FC31490_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }
}



static void emit_batch_7b(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[32];

  uint32_t skWolf   = find_skill_by_srvdo(119u);
  uint32_t skSpirit = find_skill_by_srvdo(115u);
  uint32_t skVine   = find_skill_by_srvdo(114u);
  uint32_t skDecoy  = find_skill_by_srvdo(16u);

  /* 11. 0x6FC66560 SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    uint32_t pGrid = stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    if (k == 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    } else {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      U32(STAGE_PATH0 + 0x10u) = 4814u;
      U32(STAGE_PATH0 + 0x14u) = 4814u;
      U32(STAGE_PATH0 + 0x58u) = 0u;
    }
    if (k == 3) {
      for (uint32_t i = 0u; i < 32u * 32u; i++) U16(pGrid + i * 2u) = 0xFFFFu;
    }
    int32_t sid = (k == 0) ? -1 : ((k == 1) ? 0 : (int32_t)skWolf);
    int32_t slvl = (k == 2) ? 2 : 1;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u;
    c.args[0] = (uint32_t)sid; c.args[1] = (uint32_t)slvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = (int64_t)slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC66560u, "SKILLS_SrvDo_SummonPetAtTarget_6FC66560_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 12. 0x6FC66720 SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    uint32_t pGrid = stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    if (k == 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    } else {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    }
    if (k == 3) {
      for (uint32_t i = 0u; i < 32u * 32u; i++) U16(pGrid + i * 2u) = 0xFFFFu;
    }
    int32_t sid = (k == 0) ? -1 : ((k == 1) ? 0 : (int32_t)skSpirit);
    int32_t slvl = 1;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u;
    c.args[0] = (uint32_t)sid; c.args[1] = (uint32_t)slvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = (int64_t)slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC66720u, "SKILLS_SrvDo_SummonDruidSpirit_6FC66720_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 13. 0x6FC668A0 SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    uint32_t pGrid = stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    if (k == 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    } else {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    }
    if (k == 3) {
      for (uint32_t i = 0u; i < 32u * 32u; i++) U16(pGrid + i * 2u) = 0xFFFFu;
    }
    int32_t sid = (k == 0) ? -1 : ((k == 1) ? 0 : (int32_t)skVine);
    int32_t slvl = 1;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u;
    c.args[0] = (uint32_t)sid; c.args[1] = (uint32_t)slvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = (int64_t)slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC668A0u, "SKILLS_SrvDo_SummonVineOrCreeper_6FC668A0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 14. 0x6FC6D710 SKILLS_SrvDo_SummonDecoy_6FC6D710_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    uint32_t pGrid = stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    if (k == 3) {
      for (uint32_t i = 0u; i < 32u * 32u; i++) U16(pGrid + i * 2u) = 0xFFFFu;
    }
    int32_t sid = (k == 0) ? -1 : ((k == 1) ? 9999 : (int32_t)skDecoy);
    int32_t slvl = 1;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u;
    c.args[0] = (uint32_t)sid; c.args[1] = (uint32_t)slvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = (int64_t)slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FC6D710u, "SKILLS_SrvDo_SummonDecoy_6FC6D710_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 15. 0x6FD13150 AI_FindTargetOrUnstickOverlap_6FD13150_113c (eax=pOutMelee, ecx=pOutDist, edx=pAiCtrl, stack=[pGame, pUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    U16(pAiCtrl + 0x08u) = 0x08u;
    if (k == 0) {
      U32(STAGE_PATH0 + 0x1Cu) = 0u; /* unitRoom0 == 0 */
    } else if (k == 1) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4811u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      U32(STAGE_UDATA0 + 0x34u) = 0x101u;
      U32(STAGE_UDATA0 + 0x38u) = 1u;
    } else {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4820u, 4820u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      U32(STAGE_UDATA0 + 0x34u) = 0x101u;
      U32(STAGE_UDATA0 + 0x38u) = 1u;
    }
    uint32_t pOutMelee = STAGE_SCRATCH + 0x00u;
    uint32_t pOutDist  = STAGE_SCRATCH + 0x04u;
    U32(pOutMelee) = 0x77u; U32(pOutDist) = 0x77u;
    c = make_call(); c.eax = pOutMelee; c.ecx = pOutDist; c.edx = pAiCtrl;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)pOutMelee; ts[1] = (int64_t)pOutDist; ts[2] = (int64_t)pAiCtrl;
    ts[3] = (int64_t)STAGE_GAME; ts[4] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FD13150u, "AI_FindTargetOrUnstickOverlap_6FD13150_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 16. 0x6FCEF5B0 C2S_Packet26_UseBeltItem_6FCEF5B0_113c (ecx=pGame, edx=pPlayer, stack=[pPacket, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pkt = STAGE_SCRATCH;
    U8(pkt + 0x00u) = 0x26u;
    U32(pkt + 0x01u) = 0x9999u;
    U32(pkt + 0x05u) = 0u;
    uint32_t len = (k == 0) ? 5u : 0x0Du;
    if (k == 1) {
      U32(STAGE_UNIT0 + 0xC8u) = 0x04u;
    } else if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x9999u, 2u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 2u);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u;
    c.args[0] = pkt; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pkt; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEF5B0u, "C2S_Packet26_UseBeltItem_6FCEF5B0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 17. 0x6FCEF730 C2S_Packet20_UseInventoryItem_6FCEF730_113c (ecx=pGame, edx=pPlayer, stack=[pPacket, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pkt = STAGE_SCRATCH;
    U8(pkt + 0x00u) = 0x20u;
    U32(pkt + 0x01u) = 0x9999u;
    U32(pkt + 0x05u) = (k == 2) ? 5000u : 4810u;
    U32(pkt + 0x09u) = (k == 2) ? 5000u : 4810u;
    uint32_t len = (k == 0) ? 5u : 0x0Du;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_pot, 0x9999u, 0u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u;
    c.args[0] = pkt; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pkt; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEF730u, "C2S_Packet20_UseInventoryItem_6FCEF730_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 18. 0x6FCEE870 C2S_Packet0D_RightSkillOnUnit113c (ecx=pGame, edx=pPlayer, stack=[pPacket, nLen], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    uint32_t pkt = STAGE_SCRATCH;
    U8(pkt + 0x00u) = 0x0Du;
    U32(pkt + 0x01u) = 1u;
    U32(pkt + 0x05u) = (k == 1) ? 0x9999u : 0x201u;
    uint32_t len = (k == 0) ? 5u : 9u;
    if (k == 1) {
      U32(STAGE_UNIT0 + 0xC8u) = 0x04u;
    } else if (k == 2) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      attach_skill(STAGE_UNIT0, 36, 1);
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x08u) = 0u; /* right skill = NULL -> returns 3 cleanly */
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2u;
    c.args[0] = pkt; c.args[1] = len; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pkt; ts[3] = (int64_t)len;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCEE870u, "C2S_Packet0D_RightSkillOnUnit113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }
}

