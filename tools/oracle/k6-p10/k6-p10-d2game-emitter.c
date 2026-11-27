/*
 * K6-P10 D2Game.dll Band C (0x6FCB0000..0x6FCDFFFF) Oracle Vector Emitter
 *
 * Emits net-new disassembly-verified Band C D2Game.dll VAs (>= 3 cases each),
 * excluding the 9 Wave P8 VAs and <= 5B no-ops.
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
    fprintf(stderr, "[k6-p10] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
      fprintf(stderr, "[k6-p10] missing Fog.#%u\n", fogHooks[i].ord);
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
    fprintf(stderr, "[k6-p10] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p10] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_VA(0x99000u) + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p10] short read at page %u\n", i);
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

static void __attribute__((unused)) add_extra_cap(uint32_t canonAddr, uint32_t len) {
  if (len == 0u) return;
  for (uint32_t i = 0u; i < g_extra_cap_count; i++) {
    if (g_extra_caps[i].addr == canonAddr) {
      if (len > g_extra_caps[i].len) g_extra_caps[i].len = len;
      return;
    }
  }
  if (g_extra_cap_count >= MAX_EXTRA_CAPS) {
    fprintf(stderr, "[k6-p10] extra_caps overflow\n");
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
        fprintf(stderr, "[k6-p10] mem json buffer overflow\n");
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
    fprintf(stderr, "[k6-p10] mem json cap overflow\n");
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
  U32(game_global_live(D2GAME_VA(0x111F7Cu))) = 0u;
  U32(game_global_live(D2GAME_VA(0x111F80u))) = 0u;
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
            "[k6-p10] UNEXPECTED FAULT %s case %d (%s) code=0x%08X eip=0x%08X addr=0x%08X\n",
            name, caseIdx, label, g_fault_code, g_fault_eip, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }
  int asserted = (g_thunk_faulted == 2);
  if (asserted != (expectAssert != 0)) {
    fprintf(stderr,
            "[k6-p10] ASSERT MISMATCH %s (0x%08X) case %d (%s): expected=%d got=%d (line=0x%X)\n",
            name, canonVa, caseIdx, label, expectAssert, asserted, g_assert_line);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!asserted) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != c->calleePop) {
      fprintf(stderr,
              "[k6-p10] ESP POP MISMATCH %s (0x%08X) case %d (%s): expected=%u actual=%u\n",
              name, canonVa, caseIdx, label, c->calleePop, actualPop);
      TerminateProcess(GetCurrentProcess(), 32);
    }
  }

  capture_stage_json(g_post_json, sizeof(g_post_json), setupTop);

  size_t hlen = 0;
  for (uint32_t p = HEAP_BASE; p < g_heap_top; p++) {
    uint8_t b = read_canon_byte(p, HEAP_BASE, g_heap_top);
    if (hlen + 3 >= sizeof(g_heap_hex)) {
      fprintf(stderr, "[k6-p10] heapHex overflow\n");
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
  TxtLinkNode *nodes = (TxtLinkNode *)(uintptr_t)ITEMS_TXTLINK_NODES_ADDR;
  ItemsTxtLinker *linker = (ItemsTxtLinker *)(uintptr_t)ITEMS_TXTLINK_HDR_ADDR;

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

static void __attribute__((unused)) stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
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

static uint32_t __attribute__((unused)) stage_room_with_coll(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
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

static void __attribute__((unused)) insert_server_unit(uint32_t pGame, uint32_t pUnit) {
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

static void __attribute__((unused)) link_unit_into_room(uint32_t pRoom, uint32_t pUnit) {
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

static void __attribute__((unused)) stage_player_full(
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

static void __attribute__((unused)) stage_monster_full(
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

static void __attribute__((unused)) stage_item_unit(
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

static void __attribute__((unused)) stage_missile_full(
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

static uint32_t __attribute__((unused)) attach_skill(uint32_t pUnit, int32_t skillId, int32_t lvl) {
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

static void __attribute__((unused)) attach_inv_item_raw(
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

static void __attribute__((unused)) place_body_item(uint32_t pUnit, uint32_t pItem, int32_t bodyLoc) {
  uint32_t pInv = U32(pUnit + 0x60u);
  if (pInv == 0u) {
    pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)pUnit);
    U32(pUnit + 0x60u) = pInv;
  }
  fn_PlaceItemInBodyLoc((void *)(uintptr_t)pInv, (void *)(uintptr_t)pItem, bodyLoc);
}

static uint32_t __attribute__((unused)) stage_timer_queue(void) {
  uint32_t pTimer = (uint32_t)(uintptr_t)bump_alloc(0xA20u);
  uint32_t pChunk = (uint32_t)(uintptr_t)bump_alloc(0x7088u);
  for (uint32_t i = 0u; i < 15u; i++) {
    U32(pChunk + i * 0x30u + 0x1Cu) = pChunk + (i + 1u) * 0x30u;
  }
  U32(pChunk + 0x7080u)   = pChunk;
  U32(pTimer + 0xA1Cu)    = pChunk;
  U32(STAGE_GAME + 0xB8u) = pTimer;
  return pTimer;
}

static uint32_t __attribute__((unused)) stage_extra_client(void) {
  uint32_t pCli = (uint32_t)(uintptr_t)bump_alloc(0x600u);
  uint32_t pN0  = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  uint32_t pN1  = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  U32(pN0 + 0x204u)  = pN1;
  U32(pCli + 0x1C0u) = pN0;
  U32(pCli + 0x1A8u) = STAGE_GAME;
  return pCli;
}

static void __attribute__((unused)) stage_mon_reg(uint32_t levelId) {
  uint32_t pMonReg = (uint32_t)(uintptr_t)bump_alloc(0x2E0u);
  U32(STAGE_GAME + 0xF0u + levelId * 4u) = pMonReg;
  U32(STAGE_GAME + 0x10DCu)               = pMonReg;
}

static uint32_t __attribute__((unused)) stage_quest_node(uint32_t qId, uint32_t pExSize) {
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

static void __attribute__((unused)) stage_party_ctrl(void) {
  uint32_t pList = (uint32_t)(uintptr_t)bump_alloc(64u * 0x44u);
  U32(pList + 0x00u)           = 0xFDu;
  U32(pList + 0x44u)           = 0xC9u;
  U32(STAGE_PARTYCTRL + 0x04u) = pList;
  U32(STAGE_GAME + 0x1D24u)    = STAGE_PARTYCTRL;
}

static void __attribute__((unused)) set_quest_bit(uint32_t pRec, uint32_t qId, uint32_t bit) {
  uint32_t pBuf = pRec ? U32(pRec + 0x00u) : 0u;
  if (pBuf == 0u) return;
  uint32_t idx = (qId << 4) + bit;
  U32(pBuf + (idx >> 5) * 4u) |= (1u << (idx & 31u));
}

static void __attribute__((unused)) stage_prog_charge_state(
    uint32_t pUnit, int32_t stateId, int32_t skillId, int32_t slvl, int32_t chargeStat, int32_t charges) {
  void *pSl = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
  fn_SetStatListState(pSl, stateId);
  fn_SetStatIfValid(pSl, 0x15E, skillId, 0u);
  fn_SetStatIfValid(pSl, 0x15F, slvl, 0u);
  fn_SetStatIfValid(pSl, chargeStat, charges, 0u);
  fn_MergeStatLists((void *)(uintptr_t)pUnit, pSl, 1);
  fn_ToggleGfxState((void *)(uintptr_t)pUnit, stateId, 1);
}



static void emit_group_1(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* 1. 0x6FCBCB00 AI_RogueTownMem113c (ecx=pGame, edx=pUnit, stack=[pAiTickParam], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 250u : 100u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, (k == 0) ? 0u : STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBCB00u, "AI_RogueTownMem113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 2. 0x6FCD06F0 MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c (ecx=pCand, edx=pFilterArgs, stack=[pOut], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t objClass = (k == 1) ? 0x233u : 0x232u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, objClass, 0x301u, 0u, 4815u, 4815u, 0x11223344u);
    uint32_t pArgs = STAGE_SCRATCH + 0x00u;
    uint32_t pCtx  = STAGE_SCRATCH + 0x20u;
    uint32_t pOut  = STAGE_SCRATCH + 0x40u;
    U32(pArgs + 0x00u) = game_global_live(D2GAME_VA(0xA39E0u));
    U32(pArgs + 0x04u) = STAGE_GAME;
    U32(pArgs + 0x08u) = STAGE_UNIT0;
    U32(pArgs + 0x0Cu) = pCtx;
    U32(pCtx  + 0x04u) = 100u;
    U32(pOut) = (k == 0) ? 0x1234u : 0u;
    c = make_call(); c.ecx = STAGE_UNIT1; c.edx = pArgs;
    c.nargs = 1u; c.args[0] = pOut; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)pArgs; ts[2] = (int64_t)pOut;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD06F0u, "MONAI_InvokeUnitFindFilterIfUnmatched_6FCD06F0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 3. 0x6FCC1210 AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c (ecx=pAuraCtx, edx=pTarget) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    if (k >= 1) {
      U16(STAGE_DMG + 0x04u) = 1u;
      if (k == 1) U32(STAGE_DMG + 0x08u) = 20u << 8;
      else        U32(STAGE_DMG + 0x10u) = 15u << 8;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_DMG;
    c = make_call(); c.ecx = STAGE_SCRATCH; c.edx = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_SCRATCH; ts[1] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC1210u, "AURAS_ApplyRadialSkillDamageCallback_6FCC1210_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 4. 0x6FCB8450 STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t st = (k == 2) ? 0x8Cu : 0x8Bu;
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x8B, 1);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x55, 1);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 300 << 8, 0);
    } else if (k == 2) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x8C, 1);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 200 << 8, 0);
    }
    c = make_call(); c.ecx = STAGE_UNIT0; c.edx = st;
    c.nargs = 1u; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)st; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB8450u, "STATES_RemoveMorphStateAndClampVitals_6FCB8450_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }



  /* 6. 0x6FCBCD90 AI_HandleStunDoorOrLeaderFollow113c (eax=pUnit, ecx=pGame, ebx=pAiTickArgs) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t pAiArgs = STAGE_SCRATCH + 0x00u;
    U32(pAiArgs + 0x00u) = U32(STAGE_UDATA0 + 0x2Cu);
    U32(pAiArgs + 0x1Cu) = U32(STAGE_UDATA0 + 0x00u);
    if (k == 0) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x15, 1);
    } else if (k == 2) {
      U32(STAGE_UNIT0 + 0x80u) = STAGE_GAME;
      U32(U32(STAGE_UDATA0 + 0x28u) + 0x2Cu) = 0x101u;
      U32(U32(STAGE_UDATA0 + 0x28u) + 0x30u) = 0u;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.ebx = pAiArgs; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)pAiArgs;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBCD90u, "AI_HandleStunDoorOrLeaderFollow113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }



  /* 8. 0x6FCD2D40 D2GAME_ARENA_SyncClientKillCountsOnJoin113c (eax=pGame, esi=pClient) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, (k == 2) ? 0x109u : 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pArena = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U16(pArena + 0x00u) = (k == 2) ? 12u : 5u;
    U32(STAGE_UDATA0 + 0x34u) = pArena;
    U32(STAGE_CLIENT + 0x04u) = (k == 0) ? 4u : 3u;
    c = make_call(); c.eax = STAGE_GAME; c.esi = STAGE_CLIENT; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD2D40u, "D2GAME_ARENA_SyncClientKillCountsOnJoin113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }



  /* 10. 0x6FCBF9A0 MONSTER_AddSkillToUnit113c (eax=nSkillId, esi=pUnit, stack=[nLevel, bRefresh], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t skId = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 36u : 221u);
    if (k == 2) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      uint32_t pWrap = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      uint32_t pArr  = (uint32_t)(uintptr_t)bump_alloc(0x100u);
      U32(pWrap + 0x00u) = pArr;
      U32(STAGE_UDATA0 + 0x44u) = pWrap;
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    }
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    c = make_call(); c.eax = skId; c.esi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = 3u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = 3; ts[1] = (int64_t)(int32_t)skId; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBF9A0u, "MONSTER_AddSkillToUnit113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 11. 0x6FCBEE50 SKILLS_ResolveSummonMonsterId_6FCBEE50_113c (eax=pOutY, ecx=pOutX, edx=pOutMode, stack=[pUnit, bIsMon, nSkillId, nArg4], ret 10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    uint32_t pMonStats = U32(STAGE_UDATA0 + 0x00u);
    uint32_t pFakeMonStats = STAGE_SCRATCH + 0x40u;
    memcpy((void *)(uintptr_t)pFakeMonStats, (const void *)(uintptr_t)pMonStats, 0x100u);
    U32(pFakeMonStats + 0x3Cu) = (k == 2) ? 5u : 0u;
    U32(STAGE_UDATA0 + 0x28u) = pFakeMonStats;
    uint32_t bIsMon = (k == 0) ? 1u : 0u;
    uint32_t skId   = (k == 0) ? 70u : 0xFFFFFFFFu;
    uint32_t pOutM  = STAGE_SCRATCH + 0x00u;
    uint32_t pOutX  = STAGE_SCRATCH + 0x04u;
    uint32_t pOutY  = STAGE_SCRATCH + 0x08u;
    c = make_call(); c.eax = pOutY; c.ecx = pOutX; c.edx = pOutM;
    c.nargs = 4u; c.args[0] = STAGE_UNIT0; c.args[1] = bIsMon; c.args[2] = skId; c.args[3] = 1u; c.calleePop = 0x10u;
    ts[0] = (int64_t)pOutY; ts[1] = (int64_t)pOutX; ts[2] = (int64_t)pOutM;
    ts[3] = (int64_t)STAGE_UNIT0; ts[4] = (int64_t)bIsMon; ts[5] = (int64_t)(int32_t)skId; ts[6] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBEE50u, "SKILLS_ResolveSummonMonsterId_6FCBEE50_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 12. 0x6FCB54F0 AURA_ApplyRadialDamageCallback_6FCB54F0_113c (ecx=pAuraIterArgs, edx=pDefender) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U16(STAGE_DMG + 0x04u) = 1u;
    if (k == 1) U32(STAGE_DMG + 0x08u) = 18u << 8;
    else if (k == 2) U32(STAGE_DMG + 0x10u) = 24u << 8;
    uint32_t pDmgCtx = STAGE_SCRATCH + 0x40u;
    U32(pDmgCtx + 0x00u) = STAGE_DMG;
    U32(pDmgCtx + 0x04u) = (k == 0) ? 100u : 0u;
    U32(pDmgCtx + 0x08u) = (k == 0) ? 100u : 0u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x0Cu) = pDmgCtx;
    c = make_call(); c.ecx = STAGE_SCRATCH; c.edx = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_SCRATCH; ts[1] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB54F0u, "AURA_ApplyRadialDamageCallback_6FCB54F0_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 13. 0x6FCD2760 D2GAME_PACKET_Send0x65PlayerKillCount113c (eax=pUnit, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, (uint32_t)(0x101u + k), 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pArena = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U16(pArena + 0x00u) = (uint16_t)(k * 7u);
    U32(STAGE_UDATA0 + 0x34u) = pArena;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD2760u, "D2GAME_PACKET_Send0x65PlayerKillCount113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 14. 0x6FCBF7A0 STATES_OnTimedStateRemoved113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    } else {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, (k == 0) ? 0u : 1u, 4810u, 4810u, STAGE_CLIENT);
    }
    uint32_t st = (k == 2) ? 0x20u : 0x1Cu;
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, (int32_t)st, 1);
    if (k == 0) {
      U8(STAGE_UNIT0 + 0xC6u) = 1u;
    }
    c = make_call(); c.ecx = STAGE_UNIT0; c.edx = st;
    c.nargs = 1u; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)st; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBF7A0u, "STATES_OnTimedStateRemoved113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }



  /* 16. 0x6FCB0260 NPCS_QueueOrFreeVendorItem_6FCB0260_113c (eax=pGame, ecx=pNpc, stack=[pItem, dwArg2], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x94u, 0x201u, 1u, 4810u, 4810u);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 0u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pArr = (uint32_t)(uintptr_t)bump_alloc(64u * 0x44u);
    U32(pArr + 0x00u) = (k == 0) ? 0x99u : 0x94u;
    U32(STAGE_NPCCTRL + 0x00u) = 1u;
    U32(STAGE_NPCCTRL + 0x04u) = pArr;
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    uint32_t dwArg2 = (k == 2) ? 0x55u : 0x11u;
    c = make_call(); c.eax = STAGE_GAME; c.ecx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_UNIT1; c.args[1] = dwArg2; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_UNIT1; ts[3] = (int64_t)dwArg2;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB0260u, "NPCS_QueueOrFreeVendorItem_6FCB0260_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 17. 0x6FCC3090 SKILLS_RegisterSummonedMonsterPet_6FCC3090_113c (ebx=pPetUnit, edi=pSummonArg, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pArg = STAGE_SCRATCH + 0x00u;
    U32(pArg + 0x00u) = (k == 0) ? 0x08u : 0x00u;
    U32(pArg + 0x04u) = STAGE_UNIT0;
    U32(pArg + 0x1Cu) = 1u;
    U32(pArg + 0x20u) = (k == 2) ? 3u : 1u;
    c = make_call(); c.ebx = STAGE_UNIT1; c.edi = pArg;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)pArg; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC3090u, "SKILLS_RegisterSummonedMonsterPet_6FCC3090_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 18. 0x6FCBD850 GAME_ClearAllActRoomUpdateLists113c (ebx=pGame) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pArena = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(pArena + 0x08u) = 0x401u;
    U32(STAGE_GAME + 0x1D28u) = pArena;
    if (k == 0) {
      U32(STAGE_ACT0 + 0x00u) = 0u;
    } else {
      U32(STAGE_ACT0 + 0x00u) = 1u;
      U32(STAGE_ROOM0 + 0x10u) = STAGE_ROOMEX0;
      if (k == 2) {
        stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
        U32(STAGE_ROOM0 + 0x1Cu) = STAGE_UNIT1;
      }
    }
    c = make_call(); c.ebx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBD850u, "GAME_ClearAllActRoomUpdateLists113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 19. 0x6FCB35F0 SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c (ecx=pGame, edx=pAttacker, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1) ? 1u : 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t skId = (k == 0) ? 0xFFFFFFFFu : 277u;
    if (k >= 1) {
      attach_skill(STAGE_UNIT0, 277, 3);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = skId; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(int32_t)skId; ts[3] = 3;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB35F0u, "SKILLS_AuraDo_TickBladeShieldRadialDamage_6FCB35F0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 20. 0x6FCDD920 NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c (eax=pNpc, ecx=pPlayer, esi=pItem, stack=[pGame, bKeep], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x94u, 0x201u, 1u, 4812u, 4812u);
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_sword, 0x401u, 0u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    uint32_t pNpcInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_UNIT1 + 0x60u) = pNpcInv;
    if (k >= 1) {
      attach_inv_item_raw(STAGE_UNIT1, STAGE_UNIT2, 0u, 0u, 0u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
    }
    uint32_t pShopArr = (uint32_t)(uintptr_t)bump_alloc(64u * 0x44u);
    uint32_t pShopNode = (uint32_t)(uintptr_t)bump_alloc(0x18u);
    U32(pShopNode + 0x00u) = pNpcInv;
    U32(pShopNode + 0x04u) = 0x101u;
    U32(pShopArr + 0x00u) = 0x94u;
    U32(pShopArr + 0x08u) = pShopNode;
    U32(pShopArr + 0x0Cu) = 1u;
    U32(STAGE_NPCCTRL + 0x00u) = 1u;
    U32(STAGE_NPCCTRL + 0x04u) = pShopArr;
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    uint32_t pItm = (k == 0) ? 0u : STAGE_UNIT2;
    uint32_t bKeep = (k == 2) ? 1u : 0u;
    c = make_call(); c.eax = STAGE_UNIT1; c.ecx = STAGE_UNIT0; c.esi = pItm;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = bKeep; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pItm;
    ts[3] = (int64_t)STAGE_GAME; ts[4] = (int64_t)bKeep;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDD920u, "NPCS_PlaceGambledOrBoughtItemIntoNpcTabOrFree_6FCDD920_113c", k, lbl, &c, ts, 5u, 0x00000000u, 0);
  }

  /* 21. 0x6FCD08F0 UNITS_GetDistanceToCoordinates113c (eax=pUnit, stack=[x2, y2], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 0) {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4820u, STAGE_CLIENT);
    } else if (k == 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4830u, 4800u);
    } else {
      stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 0x401u, 3u, 2u, 0u);
    }
    uint32_t x2 = 4825u + (uint32_t)k * 10u;
    uint32_t y2 = 4815u + (uint32_t)k * 5u;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = x2; c.args[1] = y2; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)x2; ts[2] = (int64_t)y2;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD08F0u, "UNITS_GetDistanceToCoordinates113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 22. 0x6FCB6280 SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    U32(STAGE_PATH0 + 0x10u) = 4812u;
    U32(STAGE_PATH0 + 0x14u) = 4812u;
    uint32_t skId = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 70u : 221u);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = skId; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = (int64_t)(int32_t)skId; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME; ts[3] = 2;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB6280u, "SKILLS_SpawnSkillSummonMonsterAtTarget_6FCB6280_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }



  /* 25. 0x6FCC10B0 SKILLS_RollAvoidAndApplySkillDamage_6FCC10B0_113c (eax=pAttacker, ecx=pGame, esi=pDmg, stack=[pDefender], ret 8? wait: nargs=2 [pGame, pDefender]!) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U16(STAGE_DMG + 0x04u) = 1u;
      U32(STAGE_DMG + 0x08u) = (k == 1) ? (20u << 8) : (40u << 8);
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.esi = STAGE_DMG;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_DMG; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC10B0u, "SKILLS_RollAvoidAndApplySkillDamage_6FCC10B0_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }
}



static void emit_batch_02(void) {
  CallSpec c;
  int64_t ts[8];
  char lbl[32];

  /* 1. 0x6FCC2800 MISSILE_SpawnNova64Directions113c (eax=pOriginUnit, ebx=nVelOverride, stack=[pGame, pOwner, nMissileId, nSkillId, nLevel], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4815u, 4815u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t misId = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 6u : 11u);
    uint32_t vel   = (k == 2) ? 1024u : 0u;
    uint32_t lvl   = (k == 2) ? 3u : 1u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = vel;
    c.nargs = 5u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0;
    c.args[2] = misId; c.args[3] = 48u; c.args[4] = lvl; c.calleePop = 0x14u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)(int32_t)vel;
    ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)STAGE_UNIT0;
    ts[4] = (int64_t)(int32_t)misId; ts[5] = 48; ts[6] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC2800u, "MISSILE_SpawnNova64Directions113c", k, lbl, &c, ts, 7u, 0x00000000u, 0);
  }

  /* 2. 0x6FCC41B0 AI_SetStateDirAndStartWalkMode_6FCC41B0_113c (eax=nAiState, edx=bStepDir, esi=pUnit, stack=[pGame, pTargetOrDest], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, (k == 2) ? 4820u : 4815u, 4814u, STAGE_CLIENT);
    uint32_t pTarget = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t aiState = (k == 2) ? 3u : 2u;
    uint32_t bDir    = (k == 1) ? 1u : 0u;
    c = make_call(); c.eax = aiState; c.edx = bDir; c.esi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = pTarget; c.calleePop = 8u;
    ts[0] = (int64_t)aiState; ts[1] = (int64_t)bDir; ts[2] = (int64_t)STAGE_UNIT0;
    ts[3] = (int64_t)STAGE_GAME; ts[4] = (int64_t)pTarget;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC41B0u, "AI_SetStateDirAndStartWalkMode_6FCC41B0_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 3. 0x6FCC0630 SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c (eax=nObjectId, stack=[pGame, pUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pGrid = stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4815u, 4815u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k <= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    }
    if (k == 0) {
      for (uint32_t dy = 13u; dy <= 17u; dy++) {
        for (uint32_t dx = 13u; dx <= 17u; dx++) {
          U16(pGrid + (dy * 32u + dx) * 2u) = 0xFFFFu;
        }
      }
    }
    uint32_t objId = (k == 1) ? 2u : 11u;
    c = make_call(); c.eax = objId;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)objId; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC0630u, "SKILLS_CanSpawnObjectAtTargetCoords_6FCC0630_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }



  /* 5. 0x6FCBD780 SUNIT_SendRemovePortalsInAdjacentRooms113c (eax=pRoom, ecx=pClient) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k >= 1) {
      uint32_t pNode1 = STAGE_SCRATCH + 0x00u;
      U32(pNode1 + 0x00u) = 2u;
      U32(pNode1 + 0x04u) = 0x301u;
      U32(STAGE_ROOM0 + 0x18u) = pNode1;
      if (k == 2) {
        uint32_t pNode2 = STAGE_SCRATCH + 0x20u;
        U32(pNode2 + 0x00u) = 2u;
        U32(pNode2 + 0x04u) = 0x302u;
        U32(pNode1 + 0x08u) = pNode2;
      }
    }
    c = make_call(); c.eax = STAGE_ROOM0; c.ecx = STAGE_CLIENT; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_ROOM0; ts[1] = (int64_t)STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBD780u, "SUNIT_SendRemovePortalsInAdjacentRooms113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 6. 0x6FCDD9B0 NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c (eax=pPlayer, ecx=pItem, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 10000, 0);
    uint32_t itemId = (k == 2) ? g_item_tknife : g_item_sword;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, itemId, 0x301u, 1u, 2u, 0x10u);
    U32(STAGE_UDATA1 + 0x18u) = (k == 0) ? 0u : 0x10u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
    if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 70, 5, 0);
    } else {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 73, 24, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 72, 5, 0);
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = STAGE_UNIT1;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDD9B0u, "NPCS_RepairAndRechargeUnitItem_6FCDD9B0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 7. 0x6FCDCC60 NPC_DeductPlayerGoldAndStash_6FCDCC60_113c (esi=pUnit, stack=[nCost], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 500, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 15, 1000, 0);
    uint32_t cost = (k == 0) ? 300u : ((k == 1) ? 800u : 5000u);
    c = make_call(); c.esi = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = cost; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)cost;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDCC60u, "NPC_DeductPlayerGoldAndStash_6FCDCC60_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 8. 0x6FCD0A20 AI_CalcApproxUnitDistSubtiles113c (ebx=pUnit1, stack=[pUnit2], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4810u, 4810u);
    uint16_t x2 = (k == 0) ? 4810u : ((k == 1) ? 4813u : 4830u);
    uint16_t y2 = (k == 0) ? 4810u : ((k == 1) ? 4814u : 4825u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, x2, y2, STAGE_CLIENT);
    c = make_call(); c.ebx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD0A20u, "AI_CalcApproxUnitDistSubtiles113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 9. 0x6FCBFC00 SKILLS_ValidateSkillTargetAlignment113c (eax=pUnit, stack=[pGame, nSkillId], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4814u, 4814u);
    U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    U32(STAGE_PATH0 + 0x10u) = 4814u;
    U32(STAGE_PATH0 + 0x14u) = 4814u;
    uint32_t sk = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 36u : 54u);
    if (k == 2) {
      U32(STAGE_PATH0 + 0x58u) = 0u;
    }
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = sk; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)(int32_t)sk;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBFC00u, "SKILLS_ValidateSkillTargetAlignment113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 10. 0x6FCBEA30 STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c (ebx=pUnit, stack=[nStateId, bIncludeTarget], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    static const int32_t grpStates[3] = { 10, 14, 20 };
    for (int j = 0; j < 3; j++) {
      void *pSl = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
      fn_SetStatListState(pSl, grpStates[j]);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSl, 1);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, grpStates[j], 1);
    }
    uint32_t stId = (k == 2) ? 1u : 10u;
    uint32_t bInc = (k == 1) ? 1u : 0u;
    c = make_call(); c.ebx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = stId; c.args[1] = bInc; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)stId; ts[2] = (int64_t)bInc;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBEA30u, "STATES_ClearSameGroupStatesOnUnit_6FCBEA30_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 11. 0x6FCD2C20 D2GAME_ARENA_BroadcastKillCountsToClients113c (stack=[pGame, pClient, bForce], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pArena0 = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(pArena0 + 0x04u) = 3u;
    U32(STAGE_UDATA0 + 0x34u) = pArena0;
    if (k >= 1) {
      uint32_t pCli2 = stage_extra_client();
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x102u, 1u, 4812u, 4812u, pCli2);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      uint32_t pArena1 = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pArena1 + 0x04u) = 7u;
      U32(STAGE_UDATA1 + 0x34u) = pArena1;
      U32(STAGE_CLIENT + 0x4A8u) = pCli2;
    }
    uint32_t bForce = (k == 2) ? 1u : 0u;
    c = make_call();
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_CLIENT; c.args[2] = bForce; c.calleePop = 0xCu;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_CLIENT; ts[2] = (int64_t)bForce;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD2C20u, "D2GAME_ARENA_BroadcastKillCountsToClients113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }



  /* 13. 0x6FCD9560 ACT4Q1_InitNpcDialog_6FCD9560_113c (ecx=pQuestData, edx=pNpcParams) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x196u, 0x201u, 1u, 4812u, 4812u);
    uint32_t pQuest = stage_quest_node(0x16u, 0x100u);
    uint32_t pMsgs = (uint32_t)(uintptr_t)bump_alloc(8u * 0xC4u);
    U32(pMsgs + 3u * 0xC4u + 0x00u) = 0x196u;
    U16(pMsgs + 3u * 0xC4u + 0x04u) = 0x4444u;
    U32(pMsgs + 3u * 0xC4u + 0x08u) = 2u;
    U32(pMsgs + 3u * 0xC4u + 0xC0u) = 1u;
    U32(pQuest + 0xDCu) = pMsgs;
    U32(pQuest + 0xE0u) = 0x19u;
    U8(pQuest + 0x09u)  = 1u;
    U8(pQuest + 0x0Cu)  = (k == 1) ? 2u : 0u;
    uint32_t pRec = U32(STAGE_UDATA0 + 0x10u);
    if (k >= 1) set_quest_bit(pRec, 0x19u, 5u);
    if (k == 2) set_quest_bit(pRec, 0x19u, 1u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x04u) = 0u;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = STAGE_SCRATCH + 0x400u;
    c = make_call(); c.ecx = pQuest; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)pQuest; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD9560u, "ACT4Q1_InitNpcDialog_6FCD9560_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 14. 0x6FCC0000 SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c (esi=pUnit, stack=[pGame, nSkillId, nSkillLevel, nMissileId, nX, nY], ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t misId = (k == 2) ? 11u : 6u;
    uint32_t tx    = (k == 0) ? 4950u : 4815u;
    uint32_t ty    = (k == 0) ? 4950u : ((k == 1) ? 4815u : 4818u);
    c = make_call(); c.esi = STAGE_UNIT0;
    c.nargs = 6u; c.args[0] = STAGE_GAME; c.args[1] = 36u; c.args[2] = 2u;
    c.args[3] = misId; c.args[4] = tx; c.args[5] = ty; c.calleePop = 0x18u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    ts[2] = 36; ts[3] = 2; ts[4] = (int64_t)misId; ts[5] = (int64_t)tx; ts[6] = (int64_t)ty;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC0000u, "SKILLS_CreateProjectileAtTargetWithin100_6FCC0000_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 15. 0x6FCD6790 SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    uint32_t sk = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 97u : 254u);
    if (k >= 1) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, (int32_t)sk, 3);
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    }
    if (k == 2) {
      stage_prog_charge_state(STAGE_UNIT0, 121, 254, 3, 318, 2);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = sk; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(int32_t)sk; ts[3] = 3;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD6790u, "SKILLS_SrvDo_MonsterSmiteAndProgressiveCharge_6FCD6790_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }



  /* 19. 0x6FCDC840 NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c (eax=pPlayer, stack=[pGame, pNpc, pItem, bSkipStockLookup], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x94u, 0x201u, 1u, 4812u, 4812u);
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_sword, 0x301u, 1u, 2u, (k == 1) ? 0x100u : 0x10u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    U32(STAGE_NPCCTRL + 0x08u) = 0x13579BDFu;
    U32(STAGE_NPCCTRL + 0x0Cu) = 0x0000029Au;
    uint32_t pShopArr = (uint32_t)(uintptr_t)bump_alloc(64u * 0x44u);
    U32(pShopArr + 0x00u) = 0x94u;
    if (k == 2) {
      U32(pShopArr + 0x0Cu) = STAGE_UNIT2;
    }
    U32(STAGE_NPCCTRL + 0x04u) = pShopArr;
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    uint32_t bSkip = (k == 0) ? 1u : 0u;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1;
    c.args[2] = STAGE_UNIT2; c.args[3] = bSkip; c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT1;
    ts[3] = (int64_t)STAGE_UNIT2; ts[4] = (int64_t)bSkip;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDC840u, "NPC_IsItemInPlayerNpcStockOrFlagged_6FCDC840_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 20. 0x6FCC57E0 AI_TickTimedSkillCasterOrExpire_6FCC57E0_113c (ecx=pGame, edx=pUnit, stack=[pAiArgs], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4814u, 4814u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    U32(STAGE_UNIT0 + 0x20u) = 1u;
    U32(STAGE_UNIT0 + 0x24u) = 0u;
    uint32_t pAiCmd = STAGE_SCRATCH + 0x100u;
    U32(pAiCmd + 0x14u) = (k == 0) ? 50u : 200u;
    uint32_t pFakeMonStats = STAGE_SCRATCH + 0x200u;
    memcpy((void *)(uintptr_t)pFakeMonStats, (const void *)(uintptr_t)U32(STAGE_UDATA0 + 0x00u), 0x1A8u);
    S16(pFakeMonStats + 0x170u) = 36;
    U8(pFakeMonStats + 0x180u)  = 8u;
    if (k == 2) {
      attach_skill(STAGE_UNIT0, 36, 2);
    }
    U32(STAGE_SCRATCH + 0x00u) = pAiCmd;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x14u) = (k == 2) ? 10u : 30u;
    U32(STAGE_SCRATCH + 0x1Cu) = pFakeMonStats;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC57E0u, "AI_TickTimedSkillCasterOrExpire_6FCC57E0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 21. 0x6FCC1790 SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c (ebx=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    attach_skill(STAGE_UNIT0, 12, 1);
    if (k == 1) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_bow, 0x301u, 1u, 2u, 0x10u);
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 526u, 0x302u, 1u, 2u, 0x10u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 70, 12, 0);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
      place_body_item(STAGE_UNIT0, STAGE_UNIT2, 5);
    } else if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_tknife, 0x301u, 1u, 2u, 0x10u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 70, 8, 0);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
    }
    c = make_call(); c.ebx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC1790u, "SKILLS_ConsumeThrowOrQuiverQuantityForPlayer_6FCC1790_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 22. 0x6FCCF920 MONSTER_ScheduleInitialAiEvent113c (eax=pGame, ebx=pUnit) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    uint32_t monId = (k == 2) ? g_mon_id_1 : g_mon_id_0;
    uint32_t mode  = (k == 0) ? 12u : 1u;
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 250u : 100u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, monId, 0x201u, mode, 4810u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    c = make_call(); c.eax = STAGE_GAME; c.ebx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCF920u, "MONSTER_ScheduleInitialAiEvent113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 23. 0x6FCCD9C0 ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c (ecx=pGame, edx=pPlayerUnit, stack=[pItem, 0, 0, 0, 0], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 530u, 0x301u, 1u, 2u, 0x10u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 1u);
    if (k == 1) {
      U32(STAGE_UDATA0 + 0x4Cu) = 1u;
      U8(STAGE_UNIT0 + 0x6Cu) = 0u;
    } else if (k == 2) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 2u, 0x10Bu, 0x401u, 0u, 4812u, 4812u, 0x123456u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      U32(STAGE_UNIT0 + 0x64u) = 0x401u;
      U32(STAGE_UNIT0 + 0x68u) = 2u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 5u; c.args[0] = STAGE_UNIT1; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_UNIT1;
    ts[3] = 0; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCD9C0u, "ITEMS_UseScrollOrTomeOfIdentify_6FCCD9C0_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 24. 0x6FCCF730 MONSTER_ChooseOutfit113c (eax=pUnit, ecx=pActOutfit) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t monId = (k == 0) ? 0u : ((k == 1) ? 1u : 3u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, monId, 0x201u, 1u, 4810u, 4810u);
    U32(STAGE_UNIT0 + 0x20u) = (uint32_t)(0x13572469u + k * 0x10101u);
    U8(STAGE_SCRATCH + 0x00u) = (uint8_t)k;
    U8(STAGE_SCRATCH + 0x01u) = (uint8_t)(k + 1);
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCF730u, "MONSTER_ChooseOutfit113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 25. 0x6FCBEFE0 SUNITDMG_AddElementalDamageToStruct113c (ecx=pDmg, edx=eElemType, stack=[pAttacker, nDamage256, nLength, pOutResStat, pOutActualElemType], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t elem = (k == 2) ? 3u : 1u;
    uint32_t dmg  = (k == 0) ? 0u : ((k == 1) ? 2560u : 5120u);
    uint32_t len  = (k == 2) ? 75u : 0u;
    uint32_t pRes = STAGE_SCRATCH + 0x00u;
    uint32_t pAct = STAGE_SCRATCH + 0x04u;
    c = make_call(); c.ecx = STAGE_DMG; c.edx = elem;
    c.nargs = 5u; c.args[0] = STAGE_UNIT0; c.args[1] = dmg; c.args[2] = len; c.args[3] = pRes; c.args[4] = pAct; c.calleePop = 0x14u;
    ts[0] = (int64_t)STAGE_DMG; ts[1] = (int64_t)elem; ts[2] = (int64_t)STAGE_UNIT0;
    ts[3] = (int64_t)dmg; ts[4] = (int64_t)len; ts[5] = (int64_t)pRes; ts[6] = (int64_t)pAct;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBEFE0u, "SUNITDMG_AddElementalDamageToStruct113c", k, lbl, &c, ts, 7u, 0x00000000u, 0);
  }

  /* 26. 0x6FCB0F30 STATES_ClearCurseStatesOnUnit113c (stack=[pUnit], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    if (k >= 1) {
      int32_t stId = (k == 1) ? 9 : 153;
      void *pSl = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
      fn_SetStatListState(pSl, stId);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSl, 1);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, stId, 1);
    }
    c = make_call();
    c.nargs = 1u; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB0F30u, "STATES_ClearCurseStatesOnUnit113c", k, lbl, &c, ts, 1u, 0x00000000u, 0);
  }

  /* 27. 0x6FCD4B10 SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4816u, 4815u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    U8(STAGE_UDATA0 + 0x0Fu)  = (k == 2) ? 1u : 0u;
    uint32_t sk  = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 154u : 160u);
    uint32_t lvl = (k == 2) ? 4u : 2u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(int32_t)sk; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD4B10u, "SKILLS_SrvDo121_LaunchMonsterVariantMissile0F_6FCD4B10_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }



  /* 30. 0x6FCBF850 SKILLS_ConsumeSkillManaOrCharge113c (eax=nSkillId, ecx=pUnit, stack=[pGame, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, (k == 0) ? 0 : (100 << 8), 0);
    uint32_t sk  = (k == 2) ? 10u : 6u;
    uint32_t lvl = (k == 2) ? 4u : 1u;
    c = make_call(); c.eax = sk; c.ecx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)sk; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBF850u, "SKILLS_ConsumeSkillManaOrCharge113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 31. 0x6FCBA7C0 AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c (ecx=pAuraCtx, edx=pTargetUnit) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t pSub = STAGE_SCRATCH + 0x100u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = 0u;
    U32(STAGE_SCRATCH + 0x0Cu) = pSub;
    if (k >= 1) {
      U32(STAGE_DMG + 0x04u) = 0x100u;
      if (k == 1) {
        U32(STAGE_DMG + 0x1Cu) = 0x400u;
      } else {
        U32(STAGE_DMG + 0x2Cu) = 0x600u;
        U32(STAGE_DMG + 0x30u) = 50u;
      }
      U32(pSub + 0x4Cu) = STAGE_DMG;
    }
    if (k == 2) {
      U32(pSub + 0x00u) = 1u;
      U32(pSub + 0x04u) = 32u;
      U32(pSub + 0x08u) = 50u;
      U32(pSub + 0x3Cu) = 150u;
      U32(pSub + 0x48u) = 1u;
    }
    c = make_call(); c.ecx = STAGE_SCRATCH; c.edx = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_SCRATCH; ts[1] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBA7C0u, "AURAS_ApplyPulseBuffAndDamageCallback_6FCBA7C0_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }
}



static void emit_batch_03(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* 1. 0x6FCCFAB0 MONSTER_InitPlacedMonsterPathAndMode113c (eax=pUnit, stack=[pGame, x, y], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_mon_reg(2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t tx = (k == 0) ? 4810u : ((k == 1) ? 4815u : 4822u);
    uint32_t ty = (k == 0) ? 4810u : ((k == 1) ? 4818u : 4826u);
    uint32_t u  = STAGE_UNIT0;
    c = make_call(); c.eax = u;
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = tx; c.args[2] = ty; c.calleePop = 0xCu;
    ts[0] = (int64_t)u; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)tx; ts[3] = (int64_t)ty;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCFAB0u, "MONSTER_InitPlacedMonsterPathAndMode113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 2. 0x6FCDD160 NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c (ebx=pGame, edi=pNpcSlot, stack=[nSellerClassId], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_GAME + 0x70u) = 1u;
    U32(STAGE_NPCCTRL + 0x08u) = 0x12345679u;
    U32(STAGE_NPCCTRL + 0x0Cu) = 0x9ABCDEF1u;
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    uint32_t pSlot = STAGE_SCRATCH + 0x00u;
    uint32_t seller = (k == 2) ? 0xC6u : 0x96u;
    uint32_t pRoster = (uint32_t)(uintptr_t)bump_alloc(0x450u);
    U32(pSlot + 0x10u) = pRoster;
    U8(pSlot + 0x21u)  = 1u;
    if (k == 0) {
      U32(pRoster + 0x0Cu) = 1u;
      U32(pRoster + 0x08u) = 0u;
    }
    c = make_call(); c.ebx = STAGE_GAME; c.edi = pSlot;
    c.nargs = 1u; c.args[0] = seller; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)pSlot; ts[2] = (int64_t)seller;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDD160u, "NPC_RefreshHirelingVendorRosterIfExhausted_6FCDD160_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 3. 0x6FCB71F0 PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c (eax=pPetUnit, esi=pTargetRoom, stack=[pGame, nX, nY], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_with_coll(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 3u);
    U32(STAGE_ROOM1 + 0x2Cu) = STAGE_ACT0;
    stage_mon_reg(2u);
    stage_mon_reg(3u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t u   = STAGE_UNIT0;
    uint32_t tx  = (k == 0) ? 4812u : ((k == 1) ? 4815u : 4820u);
    uint32_t ty  = (k == 0) ? 4812u : ((k == 1) ? 4816u : 4822u);
    c = make_call(); c.eax = u; c.esi = STAGE_ROOM1;
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = tx; c.args[2] = ty; c.calleePop = 0xCu;
    ts[0] = (int64_t)u; ts[1] = (int64_t)STAGE_ROOM1; ts[2] = (int64_t)STAGE_GAME;
    ts[3] = (int64_t)tx; ts[4] = (int64_t)ty;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB71F0u, "PETS_WarpPetUnitToRoomAndCoord_6FCB71F0_113c", k, lbl, &c, ts, 5u, 0x00000000u, 0);
  }

  /* 4. 0x6FCDDD80 NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c (eax=pItem, ecx=pGame, stack=[pNpcUnit, pPlayerUnit, nTradeMode], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x94u, 0x201u, 1u, 4812u, 4812u);
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_sword, 0x401u, 0u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    uint32_t pNpcInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_UNIT1 + 0x60u) = pNpcInv;
    if (k >= 1) {
      attach_inv_item_raw(STAGE_UNIT1, STAGE_UNIT2, 0u, 0u, 0u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
    }
    uint32_t pShopArr  = (uint32_t)(uintptr_t)bump_alloc(64u * 0x44u);
    uint32_t pShopNode = (uint32_t)(uintptr_t)bump_alloc(0x18u);
    U32(pShopNode + 0x00u) = pNpcInv;
    U32(pShopNode + 0x04u) = 0x101u;
    U32(pShopArr + 0x00u)  = 0x94u;
    U32(pShopArr + 0x08u)  = pShopNode;
    U32(pShopArr + 0x0Cu)  = (k == 0) ? 0u : 1u;
    uint32_t pPermList     = (uint32_t)(uintptr_t)bump_alloc(8u);
    U32(pPermList + 0x00u) = 0x20647373u; /* 'ssd ' */
    U32(pShopArr + 0x34u)  = pPermList;
    U32(pShopArr + 0x38u)  = 1u;
    U32(STAGE_NPCCTRL + 0x00u) = 1u;
    U32(STAGE_NPCCTRL + 0x04u) = pShopArr;
    U32(STAGE_GAME + 0x1D24u)  = STAGE_NPCCTRL;
    uint32_t tMode = (k == 0) ? 0u : 2u;
    uint32_t plr   = (k == 2) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = STAGE_UNIT2; c.ecx = STAGE_GAME;
    c.nargs = 3u; c.args[0] = STAGE_UNIT1; c.args[1] = plr; c.args[2] = tMode; c.calleePop = 0xCu;
    ts[0] = (int64_t)STAGE_UNIT2; ts[1] = (int64_t)STAGE_GAME;
    ts[2] = (int64_t)STAGE_UNIT1; ts[3] = (int64_t)plr; ts[4] = (int64_t)tMode;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDDD80u, "NPCS_HandleSoldOrGambledItemPlacement_6FCDDD80_113c", k, lbl, &c, ts, 5u, 0x00000000u, 0);
  }

  /* 6. 0x6FCCFCE0 MONSTER_SpawnAndEquipMonEquipRecordItem_6FCCFCE0_113c (edi=pMonsterUnit, eax=pMonEquipRecord, stack=[pGame, nItemLevel, nQuality], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pRec = STAGE_SCRATCH + 0x00u;
    U32(pRec + 0x00u) = (k == 0) ? 0x7A7A7A7Au : 0x20647373u; /* 'zzzz' vs 'ssd ' */
    U8(pRec + 0x04u)  = (k == 2) ? 4u : 0u;
    c = make_call(); c.edi = STAGE_UNIT0; c.eax = pRec;
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = 10u; c.args[2] = (k == 2) ? 4u : 2u; c.calleePop = 0xCu;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)pRec; ts[2] = (int64_t)STAGE_GAME;
    ts[3] = 10; ts[4] = (k == 2) ? 4 : 2;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCFCE0u, "MONSTER_SpawnAndEquipMonEquipRecordItem_6FCCFCE0_113c", k, lbl, &c, ts, 5u, 0x00000000u, 0);
  }

  /* 7. 0x6FCB7340 PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c (eax=pGame, stack=[pPlayerUnit, nX, nY], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_with_coll(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 3u);
    U32(STAGE_ROOM1 + 0x2Cu) = STAGE_ACT0;
    stage_mon_reg(2u);
    stage_mon_reg(3u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4815u, 4815u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM1, g_mon_id_1, 0x201u, 1u, 4850u, 4850u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM1, STAGE_UNIT1);
    if (k >= 1) {
      uint32_t pSlots = STAGE_PETCTRL + 0x10u;
      U32(STAGE_PETCTRL + 0x00u) = pSlots;
      U32(STAGE_UDATA0 + 0x44u)  = STAGE_PETCTRL;
      uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x18u);
      U32(pNode + 0x04u) = 0x201u;
      uint32_t sOff = 4u * 12u;
      U32(pSlots + sOff + 0x00u) = pNode;
      U32(pSlots + sOff + 0x04u) = 1u;
      U32(pSlots + sOff + 0x08u) = 2u;
    }
    uint32_t tx = (k == 2) ? 4820u : 4815u;
    uint32_t ty = (k == 2) ? 4822u : 4815u;
    c = make_call(); c.eax = STAGE_GAME;
    c.nargs = 3u; c.args[0] = STAGE_UNIT0; c.args[1] = tx; c.args[2] = ty; c.calleePop = 0xCu;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)tx; ts[3] = (int64_t)ty;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB7340u, "PETS_WarpOrUnsummonPlayerPets_6FCB7340_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 8. 0x6FCDF810 NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c (eax=pNpc, stack=[pGame, pPlayer, bResetShop, bGamble], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t npcCls = (k == 1) ? 0x96u : 0x9Au;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, 0x201u, 1u, 4812u, 4812u);
    uint32_t pNpcInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_UNIT1 + 0x60u) = pNpcInv;
    uint32_t pShopArr = (uint32_t)(uintptr_t)bump_alloc(64u * 0x44u);
    U32(pShopArr + 0x00u) = npcCls;
    U32(STAGE_NPCCTRL + 0x00u) = 1u;
    U32(STAGE_NPCCTRL + 0x04u) = pShopArr;
    U32(STAGE_GAME + 0x1D24u)  = STAGE_NPCCTRL;
    uint32_t pNpc = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call(); c.eax = pNpc;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = 0u; c.args[3] = 0u; c.calleePop = 0x10u;
    ts[0] = (int64_t)pNpc; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = 0; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDF810u, "NPCS_OpenNpcShopOrGambleSession_6FCDF810_113c", k, lbl, &c, ts, 5u, 0x00000000u, 0);
  }


  /* 12. 0x6FCBEB80 SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c (eax=pUnit) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 0) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    } else {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      uint32_t pSk = attach_skill(STAGE_UNIT0, 0, 1);
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
      if (k == 2) {
        stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_tknife, 0x401u, 1u, 2u, 0u);
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 70, 5, 0);
        place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
      }
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBEB80u, "SKILLS_EnsurePlayerWeaponOrQuiverQuantity_6FCBEB80_113c", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, 0);
  }

  /* 14. 0x6FCD1AB0 MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c (edi=pUnit, stack=[ppTargetUnit, pnOutDist, bAllowForPlayer, nAction], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4815u, 4815u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t ppTgt = STAGE_SCRATCH + 0x00u;
    uint32_t pDist = STAGE_SCRATCH + 0x04u;
    U32(ppTgt) = (k == 1) ? 0u : STAGE_UNIT1;
    U32(pDist) = 999u;
    uint32_t bAllow = (k == 0) ? 0u : 1u;
    c = make_call(); c.edi = STAGE_UNIT0;
    c.nargs = 4u; c.args[0] = ppTgt; c.args[1] = pDist; c.args[2] = bAllow; c.args[3] = 1u; c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)ppTgt; ts[2] = (int64_t)pDist; ts[3] = (int64_t)bAllow; ts[4] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD1AB0u, "MONAI_CheckDirectPathOrFindNearestBlockingObstacle_6FCD1AB0_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 15. 0x6FCB9290 SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    uint32_t pCbt = STAGE_SCRATCH + 0x00u;
    U32(pCbt + 0x00u) = STAGE_GAME;
    U32(pCbt + 0x04u) = 0u;
    U32(pCbt + 0x08u) = 0x101u;
    U32(pCbt + 0x0Cu) = 1u;
    U32(pCbt + 0x10u) = 0x201u;
    U32(pCbt + 0x1Cu) = (k == 2) ? (60u << 8) : (25u << 8);
    U32(STAGE_UNIT0 + 0xACu) = pCbt;
    uint32_t sk  = (k == 0) ? 0xFFFFFFFFu : 106u;
    uint32_t lvl = (k == 2) ? 10u : 4u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(int32_t)sk; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB9290u, "SKILLS_SrvDo_ApplySacrificeSelfDamage_6FCB9290_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 16. 0x6FCC1880 SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c (eax=nTargetX, esi=pUnit, stack=[pGame, nMissileId, nSkillId, nSkillLevel, nOffsetX, nOffsetY, nTargetY, bConsumeAmmo], ret 0x20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (k == 2) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, 6, 3);
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_tknife, 0x401u, 1u, 2u, 0x10u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 70, 8, 0);
      place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
    }
    uint32_t tx  = (k == 0) ? 0u : 4818u;
    uint32_t ty  = (k == 0) ? 0u : ((k == 2) ? 4822u : 4818u);
    uint32_t ox  = (k == 2) ? 2u : 0u;
    uint32_t oy  = (k == 2) ? 1u : 0u;
    uint32_t mis = (k == 2) ? 2u : 1u;
    uint32_t bCo = (k == 2) ? 1u : 0u;
    c = make_call(); c.eax = tx; c.esi = STAGE_UNIT0;
    c.nargs = 8u;
    c.args[0] = STAGE_GAME; c.args[1] = mis; c.args[2] = 6u; c.args[3] = 3u;
    c.args[4] = ox; c.args[5] = oy; c.args[6] = ty; c.args[7] = bCo;
    c.calleePop = 0x20u;
    ts[0] = (int64_t)tx; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    ts[3] = (int64_t)mis; ts[4] = 6; ts[5] = 3; ts[6] = (int64_t)ox; ts[7] = (int64_t)oy;
    ts[8] = (int64_t)ty; ts[9] = (int64_t)bCo;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC1880u, "SKILLS_CreateProjectileAtOffsetWithAmmoCheck_6FCC1880_113c", k, lbl, &c, ts, 10u, 0xFFFFFFFFu, 0);
  }

  /* 17. 0x6FCDD040 NPC_RollStoreItemUpgrade_6FCDD040_113c (eax=nIlvl, ecx=pGame, stack=[nItemId, nNormUpgradeFactor, nUberUpgradeFactor], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_GAME + 0x70u) = 1u;
    U32(STAGE_NPCCTRL + 0x08u) = 0x13579BDFu;
    U32(STAGE_NPCCTRL + 0x0Cu) = 0x2468ACE1u;
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    uint32_t ilvl = (k == 0) ? 10u : ((k == 1) ? 80u : 95u);
    uint32_t nf   = (k == 1) ? 500u : 0u;
    uint32_t uf   = (k == 2) ? 500u : 0u;
    c = make_call(); c.eax = ilvl; c.ecx = STAGE_GAME;
    c.nargs = 3u; c.args[0] = g_item_sword; c.args[1] = nf; c.args[2] = uf; c.calleePop = 0xCu;
    ts[0] = (int64_t)ilvl; ts[1] = (int64_t)STAGE_GAME;
    ts[2] = (int64_t)g_item_sword; ts[3] = (int64_t)nf; ts[4] = (int64_t)uf;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDD040u, "NPC_RollStoreItemUpgrade_6FCDD040_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 18. 0x6FCB7E20 PETS_AssignMercOrPetRecordAndBroadcast_6FCB7E20_113c (eax=pPlayerUnit, stack=[pGame, pPetUnit, nPetType, pPetInfo12Bytes], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      uint32_t pSlots = STAGE_PETCTRL + 0x10u;
      U32(STAGE_PETCTRL + 0x00u) = pSlots;
      U32(STAGE_UDATA0 + 0x44u)  = STAGE_PETCTRL;
      U32(pSlots + 4u * 12u + 0x08u) = 2u;
      U32(pSlots + 7u * 12u + 0x08u) = 1u;
    }
    uint32_t pInfo = STAGE_SCRATCH + 0x00u;
    U32(pInfo + 0x00u) = 0x12345678u;
    U32(pInfo + 0x04u) = 0x0000029Au;
    U32(pInfo + 0x08u) = 0x00000003u;
    uint32_t pType = (k == 2) ? 7u : 4u;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = pType; c.args[3] = pInfo; c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT1;
    ts[3] = (int64_t)pType; ts[4] = (int64_t)pInfo;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB7E20u, "PETS_AssignMercOrPetRecordAndBroadcast_6FCB7E20_113c", k, lbl, &c, ts, 5u, 0x00000000u, 0);
  }

  /* 20. 0x6FCBF600 PETS_RecalcAndClampPlayerPetTypeForSkill_6FCBF600_113c (eax=nSkillId, ecx=pPlayerUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSlots = STAGE_PETCTRL + 0x10u;
    U32(STAGE_PETCTRL + 0x00u) = pSlots;
    U32(STAGE_UDATA0 + 0x44u)  = STAGE_PETCTRL;
    if (k >= 1) {
      attach_skill(STAGE_UNIT0, 70, (k == 2) ? 10 : 1);
    }
    uint32_t sk = (k == 0) ? 36u : 70u;
    c = make_call(); c.eax = sk; c.ecx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)sk; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBF600u, "PETS_RecalcAndClampPlayerPetTypeForSkill_6FCBF600_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 21. 0x6FCC4320 MONAI_InitShadowMasterClassSkills_6FCC4320_113c (ecx=pGame, edx=pSummonUnit, stack=[pAiParam], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 418u, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    attach_skill(STAGE_UNIT0, 279, (k == 2) ? 12 : 4);
    if (k == 2) {
      attach_skill(STAGE_UNIT0, 255, 6);
    }
    uint32_t pAiGen = U32(STAGE_UDATA1 + 0x28u);
    U32(pAiGen + 0x28u) = STAGE_GAME;
    U32(pAiGen + 0x2Cu) = 0x101u;
    U32(pAiGen + 0x30u) = 0u;
    uint32_t pAiCtrl  = U32(STAGE_UDATA1 + 0x2Cu);
    uint32_t pMonStat = U32(STAGE_UDATA1 + 0x00u);
    uint32_t pAiParam = STAGE_SCRATCH + 0x00u;
    U32(pAiParam + 0x00u) = pAiCtrl;
    U32(pAiParam + 0x1Cu) = pMonStat;
    uint32_t sum = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = sum;
    c.nargs = 1u; c.args[0] = pAiParam; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)sum; ts[2] = (int64_t)pAiParam;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC4320u, "MONAI_InitShadowMasterClassSkills_6FCC4320_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 23. 0x6FCB34A0 SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c (ecx=pGame, edx=pAttacker, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t sk  = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 273u : 277u);
    uint32_t lvl = (k == 2) ? 6u : 4u;
    if (k == 2) {
      stage_prog_charge_state(STAGE_UNIT0, 121, 254, 3, 318, 2);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(int32_t)sk; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB34A0u, "SKILLS_SrvDo_ApplyChargeScaledRadialDamage_6FCB34A0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 24. 0x6FCDD490 NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c (eax=pPlayer, ecx=pGame, stack=[pNpcUnit], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x94u, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 1u;
      U32(STAGE_UNIT0 + 0x64u) = 0x201u;
    }
    if (k == 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 40 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 15 << 8, 0);
    } else if (k == 2) {
      stage_prog_charge_state(STAGE_UNIT0, 2, 0, 0, 0, 0);
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME;
    c.nargs = 1u; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDD490u, "NPC_HealPlayerAndPetsOnInteract_6FCDD490_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 25. 0x6FCD1BC0 MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c (eax=pUnit, ecx=pGame, ebx=pbCanMeleeOut, stack=[pnOutDist], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_prog_charge_state(STAGE_UNIT0, 0x69, 0, 0, 0xAC, 2);
    uint16_t px = (k == 2) ? 4810u : 4811u;
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, px, px, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (k >= 1) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      U32(STAGE_UNIT0 + 0x94u) = STAGE_UNIT1;
    }
    uint32_t pCan  = STAGE_SCRATCH + 0x00u;
    uint32_t pDist = STAGE_SCRATCH + 0x04u;
    U32(pCan)  = 99u;
    U32(pDist) = 99u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.ebx = pCan;
    c.nargs = 1u; c.args[0] = pDist; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)pCan; ts[3] = (int64_t)pDist;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD1BC0u, "MONAI_FindTargetOrNearestBlockingObstacle_6FCD1BC0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 26. 0x6FCC28F0 SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c (ecx=pGame, edx=nMissileId, stack=[pUnit, nSkillId, nSkillLevel, nOffsetX, nOffsetY, nTargetX, nTargetY, bConsumeAmmo], ret 0x20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    if (k == 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x13, 150, 0);
    } else {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      if (k == 2) {
        uint32_t pSk = attach_skill(STAGE_UNIT0, 6, 3);
        U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
        stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_tknife, 0x401u, 1u, 2u, 0x10u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 70, 9, 0);
        place_body_item(STAGE_UNIT0, STAGE_UNIT1, 4);
      }
    }
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t mis = (k == 2) ? 2u : 1u;
    uint32_t tx  = (k == 0) ? 0u : 4816u;
    uint32_t ty  = (k == 0) ? 0u : ((k == 2) ? 4820u : 4816u);
    uint32_t bCo = (k == 2) ? 1u : 0u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = mis;
    c.nargs = 8u;
    c.args[0] = STAGE_UNIT0; c.args[1] = 6u; c.args[2] = 3u;
    c.args[3] = 0u; c.args[4] = 0u; c.args[5] = tx; c.args[6] = ty; c.args[7] = bCo;
    c.calleePop = 0x20u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)mis; ts[2] = (int64_t)STAGE_UNIT0;
    ts[3] = 6; ts[4] = 3; ts[5] = 0; ts[6] = 0; ts[7] = (int64_t)tx; ts[8] = (int64_t)ty; ts[9] = (int64_t)bCo;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC28F0u, "SKILLS_CreateDirectionalProjectileWithToHitAndAmmo_6FCC28F0_113c", k, lbl, &c, ts, 10u, 0xFFFFFFFFu, 0);
  }

  /* 27. 0x6FCB8680 AURAS_RedemptionCorpseCallback_6FCB8680_113c (ecx=pAuraCtx, edx=pCorpseUnit) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 40 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 10 << 8, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 12u, 4812u, 4812u);
    uint32_t pSub = STAGE_SCRATCH + 0x40u;
    U32(pSub + 0x00u) = 124u;
    U32(pSub + 0x04u) = (k == 2) ? 20u : 10u;
    U32(pSub + 0x08u) = 0u;
    uint32_t pCtx = STAGE_SCRATCH + 0x00u;
    U32(pCtx + 0x04u) = STAGE_UNIT0;
    U32(pCtx + 0x0Cu) = pSub;
    uint32_t corpse = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call(); c.ecx = pCtx; c.edx = corpse; c.calleePop = 0u;
    ts[0] = (int64_t)pCtx; ts[1] = (int64_t)corpse;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB8680u, "AURAS_RedemptionCorpseCallback_6FCB8680_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 28. 0x6FCBBB10 ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c (ecx=pOverrideInventory, ebx=pGame, stack=[pUnit, pClient], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x10Fu, 0x201u, 1u, 4810u, 4810u);
      stage_player_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 0x101u, 1u, 4812u, 4812u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    } else {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    }
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x401u, 1u, 2u,
                    (k == 1) ? 0x08u : 0x10000u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 4u, 0u);
      uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(8u);
      U32(pNode + 0x00u) = 0x401u;
      U32(pNode + 0x04u) = 0u;
      U32(pInv + 0x2Cu)  = pNode;
      U32(pInv + 0x30u)  = pNode;
    }
    U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
    U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
    U32(STAGE_CLIENT + 0x1A8u)   = STAGE_GAME;
    U32(STAGE_CLIENT + 0x04u)    = 4u;
    U8(STAGE_CLIENT + 0x3D4u)    = 1u;
    c = make_call(); c.ecx = 0u; c.ebx = STAGE_GAME;
    c.nargs = 2u; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_CLIENT; c.calleePop = 8u;
    ts[0] = 0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBBB10u, "ITEMS_BroadcastUnitInventoryCommandFlags_6FCBBB10_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 29. 0x6FCC7F60 MONAI_ImpregnateChaseThink_6FCC7F60_113c (ecx=pGame, edx=pUnit, stack=[pAiParam], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u,
                      (k == 2) ? 4812u : 4830u, (k == 2) ? 4812u : 4830u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    }
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    U32(pAiCtrl + 0x14u) = (k == 2) ? 1u : 0u;
    uint32_t pAiParam = STAGE_SCRATCH + 0x00u;
    U32(pAiParam + 0x00u) = pAiCtrl;
    U32(pAiParam + 0x1Cu) = U32(STAGE_UDATA0 + 0x00u);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pAiParam; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pAiParam;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC7F60u, "MONAI_ImpregnateChaseThink_6FCC7F60_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 30. 0x6FCDD330 NPC_SendHirelingListPacketsToClient_6FCDD330_113c (eax=pNpcUnit, stack=[pGame, pClient], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t npcCls = (k == 0) ? 0x9Au : ((k == 1) ? 0x96u : 0xC6u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_GAME + 0x70u)   = 1u;
    U32(STAGE_NPCCTRL + 0x08u) = 0x12345679u;
    U32(STAGE_NPCCTRL + 0x0Cu) = 0x9ABCDEF1u;
    uint32_t pArr = (uint32_t)(uintptr_t)bump_alloc(64u * 0x44u);
    U32(pArr + 0x00u) = npcCls;
    U32(STAGE_NPCCTRL + 0x00u) = 1u;
    U32(STAGE_NPCCTRL + 0x04u) = pArr;
    U32(STAGE_GAME + 0x1D24u)  = STAGE_NPCCTRL;
    c = make_call(); c.eax = STAGE_UNIT1;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_CLIENT; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDD330u, "NPC_SendHirelingListPacketsToClient_6FCDD330_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 31. 0x6FCDB250 ACT4Q3_OnScrollMessage_6FCDB250_113c (ecx=pQuestData, edx=pQuestArg) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pQ = stage_quest_node(0x1Au, 0u);
    uint32_t pRec = U32(STAGE_UDATA0 + 0x10u);
    set_quest_bit(pRec, 0x1Au, 7u);
    set_quest_bit(pRec, 0x1Au, 6u);
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    if (k == 0) {
      U16(STAGE_QUESTARG + 0x14u) = 0x16Fu;
      U16(STAGE_QUESTARG + 0x18u) = 0x2ACu;
    } else if (k == 1) {
      U16(STAGE_QUESTARG + 0x14u) = 0xF6u;
      U16(STAGE_QUESTARG + 0x18u) = 0x2ADu;
    } else {
      U16(STAGE_QUESTARG + 0x14u) = 0xF6u;
      U16(STAGE_QUESTARG + 0x18u) = 0x4E21u;
    }
    c = make_call(); c.ecx = pQ; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)pQ; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDB250u, "ACT4Q3_OnScrollMessage_6FCDB250_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 32. 0x6FCDCED0 NPC_InitHirelingVendorRoster_6FCDCED0_113c (eax=pNpcSlot, stack=[pGame, nSellerClassId], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_GAME + 0x70u)   = 1u;
    U32(STAGE_NPCCTRL + 0x08u) = 0x12345679u;
    U32(STAGE_NPCCTRL + 0x0Cu) = 0x9ABCDEF1u;
    U32(STAGE_GAME + 0x1D24u)  = STAGE_NPCCTRL;
    uint32_t pSlot = STAGE_SCRATCH + 0x00u;
    if (k == 0) {
      U8(pSlot + 0x21u) = 1u;
    } else if (k == 1) {
      U32(pSlot + 0x10u) = STAGE_SCRATCH + 0x100u;
    }
    uint32_t seller = (k == 2) ? 0x96u : 0xC6u;
    c = make_call(); c.eax = pSlot;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = seller; c.calleePop = 8u;
    ts[0] = (int64_t)pSlot; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)seller;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDCED0u, "NPC_InitHirelingVendorRoster_6FCDCED0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 35. 0x6FCD1660 MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c (ecx=nAlignFlag, edx=pOriginUnit, stack=[pCandidateUnit, pScanCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_prog_charge_state(STAGE_UNIT0, 0x69, 0, 0, 0xAC, 2);
    U32(U32(STAGE_UDATA0 + 0x28u) + 0x2Cu) = 0xFFFFFFFFu;
    uint16_t cx = (k == 2) ? 4811u : 4813u;
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, cx, cx, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pCtx = STAGE_SCRATCH + 0x00u;
    U32(pCtx + 0x04u) = 99u;
    U32(pCtx + 0x08u) = 0u;
    U32(pCtx + 0x0Cu) = 50u;
    U32(pCtx + 0x18u) = 99u;
    uint32_t cand = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = cand; c.args[1] = pCtx; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)cand; ts[3] = (int64_t)pCtx;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD1660u, "MONAI_EvaluateTargetCandidateCallback_6FCD1660_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }
  /* 36. 0x6FCB57F0 SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t sk  = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 102u : 114u);
    uint32_t lvl = (k == 2) ? 6u : 4u;
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      attach_skill(STAGE_UNIT0, sk, lvl);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(int32_t)sk; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB57F0u, "SKILLS_SrvDo_RadialAuraDamage_6FCB57F0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 38. 0x6FCB6FA0 PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c (stack=[pGame, pPlayerUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 0) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    } else {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
      uint32_t pSlots = STAGE_PETCTRL + 0x10u;
      U32(STAGE_PETCTRL + 0x00u) = pSlots;
      U32(STAGE_UDATA0 + 0x44u)  = STAGE_PETCTRL;
      attach_skill(STAGE_UNIT0, (k == 1) ? 221 : 227, (k == 1) ? 5 : 4);
    }
    c = make_call();
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB6FA0u, "PETS_RecalcAndClampAllPlayerPetCountsFromSkills_6FCB6FA0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 39. 0x6FCD8CE0 ACT4Q2_InitHellforgeNpcDialog_6FCD8CE0_113c (ecx=pQuestData, edx=pNpcParams) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 405u, 0x201u, 1u, 4812u, 4812u);
    uint32_t pQ = stage_quest_node(0x19u, 0u);
    uint32_t pNpcTbl = STAGE_SCRATCH + 0x100u;
    U32(pQ + 0xDCu) = pNpcTbl;
    for (uint32_t ch = 0; ch < 4u; ch++) {
      uint32_t ent = pNpcTbl + ch * 0xC4u;
      U32(ent + 0x00u) = 405u;
      U16(ent + 0x04u) = (uint16_t)(0x1100u + ch);
      U32(ent + 0x08u) = 2u;
      U32(ent + 0xC0u) = 1u;
    }
    uint32_t pNpcParams = STAGE_SCRATCH + 0x00u;
    uint32_t pTextHdr   = STAGE_SCRATCH + 0x500u;
    U32(pNpcParams + 0x00u) = STAGE_GAME;
    U32(pNpcParams + 0x08u) = STAGE_UNIT1;
    U32(pNpcParams + 0x0Cu) = STAGE_UNIT0;
    U32(pNpcParams + 0x14u) = pTextHdr;
    uint32_t pRec = U32(STAGE_UDATA0 + 0x10u);
    if (k == 0) {
      set_quest_bit(pRec, 0x19u, 1u);
    } else if (k == 1) {
      U16(pQ + 0x9Cu) = 1u;
      U32(pQ + 0x1Cu) = 0x101u;
    } else {
      U8(pQ + 0x0Cu)  = 1u;
      U8(pQ + 0x09u)  = 1u;
      U8(pQ + 0x0Bu)  = 0u;
      U32(pQ + 0x18u) = STAGE_QUESTEX0;
    }
    c = make_call(); c.ecx = pQ; c.edx = pNpcParams; c.calleePop = 0u;
    ts[0] = (int64_t)pQ; ts[1] = (int64_t)pNpcParams;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD8CE0u, "ACT4Q2_InitHellforgeNpcDialog_6FCD8CE0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 41. 0x6FCB8E90 SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c (ecx=pGame, edx=pAttacker, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4811u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pSk = attach_skill(STAGE_UNIT0, 152, 5);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    uint32_t sk  = (k == 0) ? 0xFFFFFFFFu : ((k == 1) ? 152u : 144u);
    uint32_t lvl = (k == 2) ? 8u : 4u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = sk; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)(int32_t)sk; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB8E90u, "SKILLS_SrvDo_AllocMeleeElemConvertCombat_6FCB8E90_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 45. 0x6FCD9070 ACT4Q3_InitNpcDialog_6FCD9070_113c (ecx=pQuestData, edx=pNpcParams) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    U32(STAGE_GAME + 0x70u) = (k == 2) ? 1u : 0u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t npcCls = (k == 1) ? 0xF6u : 0x16Fu;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, npcCls, 0x201u, 1u, 4812u, 4812u);
    uint32_t pQ = stage_quest_node(0x1Au, 0u);
    U32(pQ + 0x04u) = STAGE_GAME;
    uint32_t pNpcTbl = STAGE_SCRATCH + 0x100u;
    U32(pQ + 0xDCu) = pNpcTbl;
    for (uint32_t ch = 0; ch < 7u; ch++) {
      uint32_t ent = pNpcTbl + ch * 0xC4u;
      U32(ent + 0x00u) = 0x16Fu;
      U16(ent + 0x04u) = (uint16_t)(0x1200u + ch * 2u);
      U32(ent + 0x08u) = 2u;
      U32(ent + 0x0Cu) = 0xF6u;
      U16(ent + 0x10u) = (uint16_t)(0x1201u + ch * 2u);
      U32(ent + 0x14u) = 2u;
      U32(ent + 0xC0u) = 2u;
    }
    uint32_t pNpcParams = STAGE_SCRATCH + 0x00u;
    uint32_t pTextHdr   = STAGE_SCRATCH + 0x800u;
    U32(pNpcParams + 0x00u) = STAGE_GAME;
    U32(pNpcParams + 0x08u) = STAGE_UNIT1;
    U32(pNpcParams + 0x0Cu) = STAGE_UNIT0;
    U32(pNpcParams + 0x14u) = pTextHdr;
    uint32_t pRec = U32(STAGE_UDATA0 + 0x10u);
    if (k <= 1) {
      set_quest_bit(pRec, 0x1Au, 7u);
    } else {
      set_quest_bit(pRec, 0x1Au, 0u);
    }
    c = make_call(); c.ecx = pQ; c.edx = pNpcParams; c.calleePop = 0u;
    ts[0] = (int64_t)pQ; ts[1] = (int64_t)pNpcParams;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD9070u, "ACT4Q3_InitNpcDialog_6FCD9070_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 46. 0x6FCD0E90 MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c (eax=pUnit2, ecx=pUnit1) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pGrid = stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4813u, 4813u, STAGE_CLIENT);
    if (k == 2) {
      for (uint32_t dy = 8u; dy <= 22u; dy++) {
        for (uint32_t dx = 8u; dx <= 22u; dx++) {
          U16(pGrid + (dy * 32u + dx) * 2u) = 0xFFFFu;
        }
      }
    }
    uint32_t u2 = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call(); c.ecx = STAGE_UNIT0; c.eax = u2; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)u2;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD0E90u, "MONAI_CheckLineOfWalkFreeCoordsBetweenUnits_6FCD0E90_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }
}



static void emit_batch_04(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* 1. 0x6FCDAA50 ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c (ecx=pQuestData, edx=pQuestArg) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xF6u, 0x201u, 1u, 4812u, 4812u);
    uint32_t pQ = stage_quest_node(0x13u, 0u);
    U32(pQ + 0x04u) = STAGE_GAME;
    uint32_t pRec = U32(STAGE_UDATA0 + 0x10u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    if (k == 0) {
      U16(STAGE_QUESTARG + 0x14u) = 0x16Fu;
      U16(STAGE_QUESTARG + 0x18u) = 0x2A6u;
    } else if (k == 1) {
      U16(STAGE_QUESTARG + 0x14u) = 0xF6u;
      U16(STAGE_QUESTARG + 0x18u) = 0x2A6u;
    } else {
      set_quest_bit(pRec, 0x13u, 1u);
      U16(STAGE_QUESTARG + 0x14u) = 0xF6u;
      U16(STAGE_QUESTARG + 0x18u) = 0x2A8u;
    }
    c = make_call(); c.ecx = pQ; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)pQ; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDAA50u, "ACT3Q3_OnScrollMessageOrmusGidbinn_6FCDAA50_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 2. 0x6FCB3990 SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c (stack=[pGame, pCaster, nMissileId, pOwner, nCount, nSpread, nSkillId, nSkillLevel], ret 0x20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(0u);
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4818u, 4818u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    }
    uint32_t mis    = (k == 2) ? 2u : 1u;
    uint32_t count  = (k == 2) ? 4u : 1u;
    uint32_t spread = (k == 2) ? 4u : 0u;
    uint32_t lvl    = (k == 2) ? 5u : 3u;
    c = make_call();
    c.nargs = 8u;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = mis; c.args[3] = STAGE_UNIT0;
    c.args[4] = count; c.args[5] = spread; c.args[6] = 6u; c.args[7] = lvl;
    c.calleePop = 0x20u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)mis; ts[3] = (int64_t)STAGE_UNIT0;
    ts[4] = (int64_t)count; ts[5] = (int64_t)spread; ts[6] = 6; ts[7] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB3990u, "SKILLS_SpawnScatteredProjectilesAtTarget_6FCB3990_113c", k, lbl, &c, ts, 8u, 0xFFFFFFFFu, 0);
  }

  /* 3. 0x6FCDD880 NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c (eax=pItem, ebx=pGame, edi=pPlayer, stack=[bKeepItem], ret 4, void!) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x301u, 4u, 2u, 0x10u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    if (k >= 1) {
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 1u);
    }
    uint32_t keep = (k == 1) ? 1u : 0u;
    c = make_call();
    c.eax = STAGE_UNIT1; c.ebx = STAGE_GAME; c.edi = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = keep; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)keep;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDD880u, "NPCS_ReturnSoldOrGambledItemToPlayerInventoryOrFree_6FCDD880_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 4. 0x6FCDF200 NPCTRADE_InteractBuyItem_6FCDF200_113c (eax=pGame, ebx=dwNpcGuid, esi=pPlayer, stack=[dwItemGuid, nBuyMode, wTab, dwCost, bFillStack], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x9Au, 0x201u, 1u, 4814u, 4814u);
    uint32_t npcGuid = 0x201u;
    if (k >= 1) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U8(STAGE_UNIT0 + 0x6Cu) = 1u;
      U32(STAGE_UNIT0 + 0x64u) = 0x201u;
      U32(STAGE_UNIT0 + 0x68u) = 1u;
      if (k == 1) npcGuid = 0x999u;
    }
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0Eu, 5000, 0);
    c = make_call();
    c.eax = STAGE_GAME; c.ebx = npcGuid; c.esi = STAGE_UNIT0;
    c.nargs = 5u; c.args[0] = 0x301u; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 100u; c.args[4] = (uint32_t)(k == 2 ? 1u : 0u);
    c.calleePop = 0x14u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)npcGuid;
    ts[3] = 0x301; ts[4] = 0; ts[5] = 0; ts[6] = 100; ts[7] = (k == 2 ? 1 : 0);
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDF200u, "NPCTRADE_InteractBuyItem_6FCDF200_113c", k, lbl, &c, ts, 8u, 0xFFFFFFFFu, 0);
  }

  /* 5. 0x6FCCD0F0 ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c (ebx=pGame, edi=pOwnerUnit, esi=pItem, stack=[pTargetUnit, nX, nY, nZero], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6u, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7u, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8u, 20 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9u, 100 << 8, 0);
    uint32_t cls = (k == 0) ? 0u : ((k == 1) ? 587u : 516u); /* hax=0, hp1=587, rvl=516 */
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cls, 0x301u, 4u, 2u, 0u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    c = make_call();
    c.edi = STAGE_UNIT0; c.esi = STAGE_UNIT1;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.args[2] = 4810u; c.args[3] = 4810u;
    c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_GAME;
    ts[3] = 0; ts[4] = 4810; ts[5] = 4810;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCD0F0u, "ITEMS_UseSpellIconOrScrollItem_6FCCD0F0_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* 6. 0x6FCDC050 ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c (eax=pCoord, stack=[pQuestArg, nSealBossIdx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_timer_queue();
    U32(STAGE_GAME + 0xC8u) = STAGE_ACT0;
    uint32_t pQ = stage_quest_node(0x17u, 0x50u);
    U32(pQ + 0x04u) = STAGE_GAME;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x188u, 0x401u, 0u, 4810u, 4810u, 0x11223344u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x04u) = STAGE_UNIT0;
    uint32_t pCoord = STAGE_SCRATCH + 0x00u;
    U32(pCoord + 0x00u) = (k == 0) ? 9999u : 4810u;
    U32(pCoord + 0x04u) = (k == 0) ? 9999u : 4810u;
    uint32_t idx = (k == 2) ? 3u : 1u;
    c = make_call();
    c.eax = pCoord; c.nargs = 2u; c.args[0] = STAGE_QUESTARG; c.args[1] = idx; c.calleePop = 8u;
    ts[0] = (int64_t)pCoord; ts[1] = (int64_t)STAGE_QUESTARG; ts[2] = (int64_t)idx;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDC050u, "ACT4Q3_SpawnSealBossMarkerAndActivateSeal_6FCDC050_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 7. 0x6FCBF340 SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c (ecx=dwFlags, edx=nX, stack=[pGame, nY, pOwnerUnit, nSkillId, nSkillLevel, pfnCallback], ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6u, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7u, 200 << 8, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 12u, 4812u, 4812u);
    U32(STAGE_UNIT1 + 0xC4u) = 0x204u;
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t owner = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pfnLive = (k == 0) ? 0u : canon_to_live_addr(D2GAME_VA(0x39930u));
    uint32_t pfnTs   = (k == 0) ? 0u : (0x6FB00000u + 0x159930u);
    uint32_t lvl     = (k == 2) ? 10u : 5u;
    int expAssert    = (k == 0) ? 1 : 0;
    c = make_call(); c.ecx = 0x8002u; c.edx = 4810u;
    c.nargs = 6u; c.args[0] = STAGE_GAME; c.args[1] = 4810u; c.args[2] = owner;
    c.args[3] = 124u; c.args[4] = lvl; c.args[5] = pfnLive; c.calleePop = 0x18u;
    ts[0] = 0x8002; ts[1] = 4810; ts[2] = (int64_t)STAGE_GAME; ts[3] = 4810;
    ts[4] = (int64_t)owner; ts[5] = 124; ts[6] = (int64_t)lvl; ts[7] = (int64_t)pfnTs;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBF340u, "SKILLS_ForEachUnitInCoordsRadius_6FCBF340_113c", k, lbl, &c, ts, 8u, 0x00000000u, expAssert);
  }

  /* 8. 0x6FCB1660 SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c (eax=pSkillsTxt, stack=[pGame, pMonster, nSkillId, nLevel], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6u, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7u, 100 << 8, 0);
    uint32_t sgpt = U32(U32(game_global_live(D2GAME_VA(0xF829Cu))));
    uint32_t sid  = (k == 2) ? 61u : 144u; /* 144=Concentrate, 61=Inferno */
    uint32_t pTxt = U32(sgpt + 0xB98u) + sid * 0x23Cu;
    uint32_t lvl  = (k == 0) ? 1u : ((k == 1) ? 5u : 10u);
    c = make_call(); c.eax = pTxt;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = sid; c.args[3] = lvl; c.calleePop = 0x10u;
    ts[0] = (int64_t)pTxt; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)sid; ts[4] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB1660u, "SKILLS_ApplyMonsterSkillBuffAndUMod_6FCB1660_113c", k, lbl, &c, ts, 5u, 0x00000000u, 0);
  }

  /* 9. 0x6FCD6A60 SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 10u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4816u, 4816u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U16(STAGE_PATH0 + 0x10u) = 4815u;
    U16(STAGE_PATH0 + 0x14u) = 4815u;
    if (k >= 1) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, 230, 5);
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
      U32(pSk + 0x14u) = (k == 1) ? 5u : 100u; /* param1 = endFrame */
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x0Cu, 1);
    }
    if (k == 2) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    }
    int32_t sid = (k == 0) ? -1 : 230;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = 5;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD6A60u, "SKILLS_SrvDoArcticBlastChannelTick_6FCD6A60_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 10. 0x6FCCA4D0 D2Game_6FCCA4D0_113c (ecx=pGame, edx=pUnit, stack=[pAiTickArgs], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    {
      uint32_t pLog = U32(STAGE_ROOMEX0 + 0x64u);
      uint32_t pCoordList = (uint32_t)(uintptr_t)bump_alloc(0x30u);
      U32(pLog + 0x30u) = pCoordList;
    }
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 3u, 4811u, 4811u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4814u, 4814u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    if (k >= 1) {
      U32(pAiGen + 0x28u) = STAGE_GAME;
      U32(pAiGen + 0x2Cu) = 0x101u;
      U32(pAiGen + 0x30u) = 0u;
    }
    uint32_t pFakeMon = STAGE_SCRATCH + 0x100u;
    memcpy((void *)(uintptr_t)pFakeMon, (void *)(uintptr_t)U32(STAGE_UDATA0 + 0x00u), 0x1A8u);
    S16(pFakeMon + 0x56u) = (k == 2) ? 100 : 0; /* flee chance */
    S16(pFakeMon + 0x5Cu) = 0;                   /* skip target chance */
    S16(pFakeMon + 0x62u) = 40;
    S16(pFakeMon + 0x68u) = 40;
    uint32_t pAiParam = STAGE_SCRATCH + 0x00u;
    U32(pAiParam + 0x00u) = U32(STAGE_UDATA0 + 0x2Cu);
    U32(pAiParam + 0x1Cu) = pFakeMon;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pAiParam; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pAiParam;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCA4D0u, "D2Game_6FCCA4D0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 11. 0x6FCB5120 SKILLS_TryConvertMonsterOnHit_6FCB5120_113c (eax=pConvArgs, ecx=pTargetMonster, stack=[pGame, pAttacker], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0Cu, 15, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x0Cu, (k == 2) ? 30 : 5, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6u, 300 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7u, 300 << 8, 0);
    uint32_t pArgs = STAGE_SCRATCH + 0x00u;
    U32(pArgs + 0x00u) = 0u;
    U32(pArgs + 0x04u) = (k == 0) ? (uint32_t)-1 : 100u;
    U32(pArgs + 0x08u) = 100u;
    U32(pArgs + 0x0Cu) = 50u;
    c = make_call(); c.eax = pArgs; c.ecx = STAGE_UNIT1;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = (int64_t)pArgs; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB5120u, "SKILLS_TryConvertMonsterOnHit_6FCB5120_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 12. 0x6FCBEEB0 SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c (esi=pSearchSpec, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6u, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7u, 200 << 8, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 12u, 4812u, 4812u);
    U32(STAGE_UNIT1 + 0xC4u) = 0x204u; /* selectable corpse bit */
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t pSpec = (k == 0) ? 0u : (STAGE_SCRATCH + 0x00u);
    if (pSpec != 0u) {
      U32(pSpec + 0x00u) = 0x8002u;
      U32(pSpec + 0x04u) = STAGE_UNIT0;
      U32(pSpec + 0x08u) = 124u;
      U32(pSpec + 0x0Cu) = 4810u;
      U32(pSpec + 0x10u) = 4810u;
      U32(pSpec + 0x14u) = 10u;
      U32(pSpec + 0x18u) = 5u;
      U32(pSpec + 0x1Cu) = 0u;
      U32(pSpec + 0x20u) = (k == 1) ? 0u : canon_to_live_addr(D2GAME_VA(0x39930u));
    }
    int expAssert = (k < 2) ? 1 : 0;
    c = make_call(); c.esi = pSpec;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)pSpec; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBEEB0u, "SKILLS_ForEachUnitInSearchRadius_6FCBEEB0_113c", k, lbl, &c, ts, 2u, 0x00000000u, expAssert);
  }

  /* 13. 0x6FCB9000 SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c (ecx=pGame, edx=pAttacker, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    {
      uint32_t pLog = U32(STAGE_ROOMEX0 + 0x64u);
      uint32_t pCoordList = (uint32_t)(uintptr_t)bump_alloc(0x30u);
      U32(pLog + 0x30u) = pCoordList;
    }
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4811u, 4811u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0Cu, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0u, 80, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6u, 10000 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7u, 10000 << 8, 0);
    U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    if (k == 2) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 328u, 0x301u, 1u, 2u, 0x10u);
      place_body_item(STAGE_UNIT0, STAGE_UNIT2, 5);
    }
    int32_t sid = (k == 0) ? -1 : 97;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = 5;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB9000u, "SKILLS_SrvDo_SmiteShieldBashAttack_6FCB9000_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 14. 0x6FCB8BA0 SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c (ecx=pGame, edx=pAttacker, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4811u, 4811u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0Cu, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 1u, 100, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x15u, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x16u, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x0Cu, 1, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x1Fu, 0, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6u, 10000 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7u, 10000 << 8, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pSk = attach_skill(STAGE_UNIT0, 269, 5);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    U32(pSk + 0x14u) = 1u;
    if (k == 2) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    }
    int32_t sid = (k == 0) ? -1 : 269;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = 5;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB8BA0u, "SKILLS_SrvDo_ApplyClawsOfThunderOrElementalCombo_6FCB8BA0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 15. 0x6FCC0370 AURA_CheckUnitMatchesFilterFlags113c (eax=dwFilterFlags, ecx=pSourceUnit, edi=pTargetUnit, calleePop=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    uint32_t flags = (k == 2) ? 0x8102u : 0x01u;
    uint32_t targ  = (k == 0) ? 0u : ((k == 1) ? STAGE_UNIT0 : STAGE_UNIT1);
    c = make_call(); c.eax = flags; c.ecx = STAGE_UNIT0; c.edi = targ; c.calleePop = 0u;
    ts[0] = (int64_t)flags; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)targ;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC0370u, "AURA_CheckUnitMatchesFilterFlags113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 16. 0x6FCB4B10 SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4814u, 4814u);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 153, 1);
    }
    int32_t sid = (k == 0) ? -1 : 264;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = 5;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB4B10u, "SKILLS_SrvDo_CloakOfShadows_6FCB4B10_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 17. 0x6FCD17B0 AITARGET_ScanUnitsByModeTable113c (eax=nScanIndex, ecx=pGame, edx=pOriginUnit, stack=[pCtx, pfnOverrideCallback], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4812u, 4812u);
    stage_player_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 0x101u, 1u, 4812u, 4812u, STAGE_CLIENT);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    uint32_t ppCl = STAGE_SCRATCH + 0x80u;
    U32(ppCl) = STAGE_CLIENT;
    U32(STAGE_ROOM0 + 0x48u) = ppCl;
    U32(STAGE_ROOM0 + 0x78u) = 1u;
    uint32_t pCtx = STAGE_SCRATCH + 0x00u;
    uint32_t scanIdx = (k == 0) ? 0u : ((k == 1) ? 12u : 2u);
    uint32_t ovrLive = 0u;
    uint32_t ovrTs   = 0u;
    if (k == 1) {
      U32(pCtx + 0x00u) = g_mon_id_1;
      U32(pCtx + 0x04u) = 20u;
      U32(pCtx + 0x08u) = 0u;
    } else if (k == 2) {
      U32(pCtx + 0x00u) = 0u;
      U32(pCtx + 0x04u) = 0x7FFFFFFFu;
      ovrLive = canon_to_live_addr(D2GAME_VA(0xF1A90u));
      ovrTs   = 0x6FB00000u + 0x211A90u;
    }
    c = make_call(); c.eax = scanIdx; c.ecx = pCtx; c.edx = STAGE_GAME;
    c.nargs = 2u; c.args[0] = STAGE_UNIT0; c.args[1] = ovrLive; c.calleePop = 8u;
    ts[0] = (int64_t)scanIdx; ts[1] = (int64_t)pCtx; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)STAGE_UNIT0; ts[4] = (int64_t)ovrTs;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD17B0u, "AITARGET_ScanUnitsByModeTable113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 18. 0x6FCD11A0 AITARGET_IterateRoomActiveClients113c (stack=[pGame, pOriginUnit, pCtx, pfnCallback], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4812u, 4812u, STAGE_CLIENT);
    if (k >= 1) {
      uint32_t ppCl = STAGE_SCRATCH + 0x40u;
      U32(ppCl) = STAGE_CLIENT;
      U32(STAGE_ROOM0 + 0x48u) = ppCl;
      U32(STAGE_ROOM0 + 0x78u) = 1u;
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
      if (k == 1) {
        U8(STAGE_CLIENT + 0x3D4u) = 0u;
        U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT1;
      } else {
        U8(STAGE_CLIENT + 0x3D4u) = 0u;
        U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT1;
        U32(STAGE_CLIENT + 0x16Cu) = 0u;
        U32(STAGE_CLIENT + 0x170u) = 0x101u;
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      }
    }
    uint32_t pCtx = STAGE_SCRATCH + 0x00u;
    U32(pCtx + 0x00u) = 0u;
    U32(pCtx + 0x04u) = 0x7FFFFFFFu;
    uint32_t orig = STAGE_UNIT0;
    uint32_t cbLive = canon_to_live_addr(D2GAME_VA(0xF1A90u));
    uint32_t cbTs = 0x6FB00000u + 0x211A90u;
    c = make_call();
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = orig; c.args[2] = pCtx; c.args[3] = cbLive; c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)orig; ts[2] = (int64_t)pCtx; ts[3] = (int64_t)cbTs;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD11A0u, "AITARGET_IterateRoomActiveClients113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 19. 0x6FCCD2A0 ITEMMODS_ApplySlowTarget_6FCCD2A0_113c (stack=[pAttacker, pDefender, pArg3, nStatParam, nUnused], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x96u, 80, 0);
    }
    uint32_t att = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.nargs = 5u; c.args[0] = att; c.args[1] = STAGE_UNIT1; c.args[2] = 0u; c.args[3] = (0x96u << 16); c.args[4] = 0u;
    c.calleePop = 0x14u;
    ts[0] = (int64_t)att; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = 0; ts[3] = (int64_t)(0x96u << 16); ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCD2A0u, "ITEMMODS_ApplySlowTarget_6FCCD2A0_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 20. 0x6FCC3220 SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4811u, 4811u);
    if (k == 2) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    }
    int32_t sid = (k == 0) ? -1 : ((k == 1) ? 0 : 254);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = 5;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC3220u, "SKILLS_ApplyMeleeHitAuraStatesAndExecuteEvents_6FCC3220_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 21. 0x6FCCB070 D2Game_6FCCB070_113c (ecx=pGame, edx=pUnit, stack=[pAiTickParam], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    {
      uint32_t pLog = U32(STAGE_ROOMEX0 + 0x64u);
      uint32_t pCoordList = (uint32_t)(uintptr_t)bump_alloc(0x30u);
      U32(pLog + 0x30u) = pCoordList;
    }
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x1AAu, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x101u, 1u, 4812u, 4812u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4813u, 4813u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6u, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7u, 100 << 8, 0);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    if (k >= 1) {
      U32(pAiGen + 0x28u) = STAGE_GAME;
      U32(pAiGen + 0x2Cu) = 0x101u;
      U32(pAiGen + 0x30u) = 0u;
    }
    uint32_t pFakeMon = STAGE_SCRATCH + 0x100u;
    memcpy((void *)(uintptr_t)pFakeMon, (void *)(uintptr_t)U32(STAGE_UDATA0 + 0x00u), 0x1A8u);
    U32(pFakeMon + 0x00u) = 0x000001AAu;
    S16(pFakeMon + 0x5Cu) = 20;
    S16(pFakeMon + 0x62u) = 13;
    S16(pFakeMon + 0x68u) = 100;
    S16(pFakeMon + 0x6Eu) = 50;
    S16(pFakeMon + 0x170u) = -1;
    uint32_t pAiParam = STAGE_SCRATCH + 0x00u;
    U32(pAiParam + 0x00u) = U32(STAGE_UDATA0 + 0x2Cu);
    U32(pAiParam + 0x08u) = (k == 2) ? STAGE_UNIT2 : 0u;
    U32(pAiParam + 0x18u) = (k == 2) ? 1u : 0u;
    U32(pAiParam + 0x1Cu) = pFakeMon;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pAiParam; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pAiParam;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCB070u, "D2Game_6FCCB070_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 22. 0x6FCB9830 SKILLS_SrvDo028_Conversion_6FCB9830_113c (ecx=pGame, edx=pCasterUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    {
      uint32_t pLog = U32(STAGE_ROOMEX0 + 0x64u);
      uint32_t pCoordList = (uint32_t)(uintptr_t)bump_alloc(0x30u);
      U32(pLog + 0x30u) = pCoordList;
    }
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4811u, 4811u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0Cu, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x0Cu, 15, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6u, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7u, 100 << 8, 0);
    if (k == 2) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    }
    int32_t sid = (k == 0) ? -1 : 116;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = 10u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = 10;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB9830u, "SKILLS_SrvDo028_Conversion_6FCB9830_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 23. 0x6FCCE6D0 ITEMS_UsePercentagePotion_6FCCE6D0_113c (ecx=pGame, edx=pUnit, stack=[pItem, x, y, a4, a5], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6u, 20 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7u, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8u, 10 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9u, 80 << 8, 0);
    uint32_t cls = (k == 1) ? 516u : 515u; /* 516=rvl, 515=rvs */
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cls, 0x301u, 4u, 2u, 0u);
    uint32_t itm = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 5u; c.args[0] = itm; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)itm;
    ts[3] = 0; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCE6D0u, "ITEMS_UsePercentagePotion_6FCCE6D0_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 24. 0x6FCCEDC0 ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c (ecx=pGame, edx=pUnit, stack=[pItem, x, y, a4, a5], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 3u, 25, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 1u, 25, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6u, 20 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7u, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8u, 10 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9u, 200 << 8, 0);
    uint32_t cls = (k == 1) ? 587u : 592u; /* 587=hp1, 592=mp1 */
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cls, 0x301u, 4u, 2u, 0u);
    uint32_t itm = (k == 0) ? 0u : STAGE_UNIT1;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 5u; c.args[0] = itm; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)itm;
    ts[3] = 0; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCEDC0u, "ITEMS_UseHealingOrManaPotion_6FCCEDC0_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 25. 0x6FCBB630 ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c (eax=pItem, ecx=pOwnerUnit, stack=[pClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x301u, 1u, 2u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
    U32(STAGE_CLIENT + 0x16Cu) = 0u;
    U32(STAGE_CLIENT + 0x170u) = 0x101u;
    U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
    U8(STAGE_CLIENT + 0x3D4u) = 0u;
    if (k == 1) {
      U32(STAGE_UDATA1 + 0x14u) = 0x10000u;
    } else if (k == 2) {
      U32(STAGE_UDATA1 + 0x18u) = 0x100u;
    }
    uint32_t itm = STAGE_UNIT1;
    c = make_call(); c.eax = itm; c.ecx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = (int64_t)itm; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBB630u, "ITEMS_DispatchCommandFlagPacketsToClient_6FCBB630_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }
}



static void emit_batch_05(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];

  /* 1. 0x6FCDA5E0 ACT4Q1_OnNpcMessage_6FCDA5E0_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x195u, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t pQ = stage_quest_node(0x15u, 0x20u);
    U32(pQ + 0x04u) = STAGE_GAME;
    U32(pQ + 0xE0u) = 0x15u;
    uint32_t pRec = U32(STAGE_UDATA0 + 0x10u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    if (k == 0) {
      U16(STAGE_QUESTARG + 0x14u) = 0x16Fu;
      U16(STAGE_QUESTARG + 0x18u) = 0x2A5u;
    } else if (k == 1) {
      U16(STAGE_QUESTARG + 0x14u) = 0x16Fu;
      U16(STAGE_QUESTARG + 0x18u) = 0x29Eu;
    } else {
      U16(STAGE_QUESTARG + 0x14u) = 0x196u;
      U16(STAGE_QUESTARG + 0x18u) = 0x2A3u;
      (void)pRec;
    }
    c = make_call(); c.ecx = pQ; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = (int64_t)pQ; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDA5E0u, "ACT4Q1_OnNpcMessage_6FCDA5E0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }












  /* 2. 0x6FCC4E40 AI_CastSkill286AtOffsetY13_6FCC4E40_113c (esi=pUnit, edi=pAiArgs, stack=[nParam1], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    uint32_t ux = 4810u + (uint32_t)(k * 3);
    uint32_t uy = 4810u + (uint32_t)(k * 2);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x10u, 0x201u, 1u, ux, uy);
    U32(STAGE_UNIT0 + 0x80u) = STAGE_GAME;
    attach_skill(STAGE_UNIT0, 0x11Eu, 1u);
    uint32_t pAiArgs = STAGE_SCRATCH + 0x00u;
    uint32_t pAiCmd = STAGE_SCRATCH + 0x40u;
    U32(pAiArgs + 0x00u) = pAiCmd;
    U32(pAiCmd + 0x14u) = (uint32_t)k;
    U32(pAiCmd + 0x18u) = 1u;
    uint32_t param1 = (uint32_t)(5 + k * 7);
    c = make_call(); c.esi = STAGE_UNIT0; c.edi = pAiArgs;
    c.nargs = 1u; c.args[0] = param1; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)pAiArgs; ts[2] = (int64_t)param1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC4E40u, "AI_CastSkill286AtOffsetY13_6FCC4E40_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }












  /* 9. 0x6FCC19A0 SKILLS_ExecuteSkillDoFunc113c (eax=pUnit, stack=[pGame, nSkillId, nSkillLevel, bConsumeMana, bCheckItem, bUseAltFunc], ret 0x18, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_UNIT0 + 0x20u) = 0x12345679u + (uint32_t)k;
    U32(STAGE_UNIT0 + 0x24u) = 0x9ABCDEF1u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6u, 5000 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7u, 5000 << 8, 0);
    if (k == 2) U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    int32_t sid = (k == 0) ? -1 : ((k == 1) ? 42 : 0);
    uint32_t pSk = attach_skill(STAGE_UNIT0, (uint32_t)(sid >= 0 ? sid : 0), 3u);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 6u; c.args[0] = STAGE_GAME; c.args[1] = (uint32_t)sid; c.args[2] = 3u;
    c.args[3] = 0u; c.args[4] = 0u; c.args[5] = 0u; c.calleePop = 0x18u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)sid;
    ts[3] = 3; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC19A0u, "SKILLS_ExecuteSkillDoFunc113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }












  /* 10. 0x6FCC9E80 AI_Think_ShadowWarriorAndMaster_6FCC9E80_113c (ecx=pGame, edx=pUnit, stack=[pAiTickArgs], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    U32(U32(STAGE_ROOMEX0 + 0x64u) + 0x30u) = (uint32_t)(uintptr_t)bump_alloc(0x30u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x201u, 1u, 4810u, 4810u);
    uint32_t px = (k == 2) ? 4870u : 4812u;
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, px, 4810u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiArgs = STAGE_SCRATCH + 0x00u;
    uint32_t pAiCtrl = STAGE_SCRATCH + 0x40u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x100u;
    U32(pAiArgs + 0x00u) = pAiCtrl;
    U32(pAiArgs + 0x1Cu) = pMonTxt;
    U16(pMonTxt + 0x32u) = 10u;
    U16(pMonTxt + 0x34u) = 15u;
    if (k == 1) {
      U32(pAiCtrl + 0x1Cu) = 0x101u;
    } else if (k == 2) {
      uint32_t pAiGen = STAGE_SCRATCH + 0x80u;
      U32(STAGE_UDATA0 + 0x28u) = pAiGen;
      U32(pAiGen + 0x28u) = STAGE_GAME;
      U32(pAiGen + 0x2Cu) = 0x101u;
      U32(pAiGen + 0x30u) = 0u;
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pAiArgs; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pAiArgs;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC9E80u, "AI_Think_ShadowWarriorAndMaster_6FCC9E80_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }












  /* 13. 0x6FCBFAE0 SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c (eax=nSkillId, ecx=pUnit, ret 0, bool) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4810u, 4810u, 0u);
    attach_skill(STAGE_UNIT0, 36u, 1u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 5u, (k == 1) ? 0 : 3, 0);
    int32_t sid = (k == 0) ? -1 : 36;
    c = make_call(); c.eax = (uint32_t)sid; c.ecx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)sid;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBFAE0u, "SKILLS_SpendSkillPointsAndIncrementSkill_6FCBFAE0_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }












  /* 15. 0x6FCD4520 SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c (eax=nSkillId, esi=pUnit, stack=[pTarget, pGame, nSkillLevel], ret 0xC, bool) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, 0u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_UNIT0 + 0x20u) = 0x12345679u + (uint32_t)k;
    U32(STAGE_UNIT0 + 0x24u) = 0x9ABCDEF1u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6u, 5000 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7u, 5000 << 8, 0);
    uint32_t pSk = attach_skill(STAGE_UNIT0, 0x61u, 5u);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    int32_t sid = (k == 0) ? -1 : 0x61;
    uint32_t tgt = (k == 1) ? 0u : STAGE_UNIT1;
    uint32_t lvl = 5u;
    c = make_call(); c.eax = (uint32_t)sid; c.esi = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = tgt; c.args[2] = lvl; c.calleePop = 0x0Cu;
    ts[0] = (int64_t)sid; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)tgt; ts[3] = (int64_t)STAGE_GAME; ts[4] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD4520u, "SKILLS_DoSmiteOrTelekinesisCombatHit_6FCD4520_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }












  /* 21. 0x6FCC2C40 SrvDoFunc_001_Attack113c (ecx=pGame, edx=pAttacker, stack=[nSkillId, nSkillLevel], ret 8, bool) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_UNIT0 + 0x20u) = 0x12345679u + (uint32_t)k;
    U32(STAGE_UNIT0 + 0x24u) = 0x9ABCDEF1u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6u, 5000 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7u, 5000 << 8, 0);
    if (k >= 1) U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
    uint32_t lvl = (k == 2) ? 5u : 1u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = 0u; c.args[1] = lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = 0; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC2C40u, "SrvDoFunc_001_Attack113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }












  /* 22. 0x6FCBB3B0 D2GAME_INVENTORY_DestroyUnitInventoryItems113c (eax=pUnit, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    if (k >= 1) {
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0xC8u) = 1u;
    }
    if (k == 2) {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x301u, 4u, 2u, 0x10u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 1u);
      U32(STAGE_UDATA1 + 0x14u) = 0x10u;
      U8(STAGE_UDATA1 + 0x45u) = 4u;
    }
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBB3B0u, "D2GAME_INVENTORY_DestroyUnitInventoryItems113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }












  /* 23. 0x6FCBFD00 SKILLS_ExecuteSkillStart113c (eax=nSkillId, stack=[pGame, pUnit, nSkillLevel, bNoManaCost], ret 0x10, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4810u, 4810u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8u, 200 << 8, 0);
    int32_t sid = (k == 0) ? -1 : ((k == 1) ? 36 : 0);
    uint32_t pSk = attach_skill(STAGE_UNIT0, (uint32_t)(sid >= 0 ? sid : 0), 1u);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    c = make_call(); c.eax = (uint32_t)sid;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = 1u; c.args[3] = 1u; c.calleePop = 0x10u;
    ts[0] = (int64_t)sid; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = 1; ts[4] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBFD00u, "SKILLS_ExecuteSkillStart113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }












  /* 24. 0x6FCBCDE0 AI_TryMonsterTeleportEscape113c (esi=pUnit, stack=[pGame, pAiArgs], ret 8, bool) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    U32(U32(STAGE_ROOMEX0 + 0x64u) + 0x30u) = (uint32_t)(uintptr_t)bump_alloc(0x30u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x201u, 1u, 4810u, 4810u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6u, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7u, 500 << 8, 0);
    U32(STAGE_UNIT0 + 0x20u) = (k == 2) ? 6u : 1u;
    U32(STAGE_UNIT0 + 0x24u) = 0u;
    uint32_t pAiArgs = STAGE_SCRATCH + 0x00u;
    uint32_t pAiCtrl = STAGE_SCRATCH + 0x40u;
    U32(pAiArgs + 0x00u) = pAiCtrl;
    if (k >= 1) U8(pAiCtrl + 0x08u) = 0x20u;
    c = make_call(); c.esi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = pAiArgs; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)pAiArgs;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBCDE0u, "AI_TryMonsterTeleportEscape113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }












  /* 25. 0x6FCC6FC0 AI_ThinkTerrorCurse_6FCC6FC0_113c (ecx=pGame, edx=pUnit, stack=[pAiThinkArg], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4815u, 4815u, 0u);
    uint32_t pAiGen = STAGE_SCRATCH + 0x80u;
    U32(STAGE_UDATA0 + 0x28u) = pAiGen;
    U32(pAiGen + 0x2Cu) = STAGE_SCRATCH + 0xC0u;
    uint32_t pAiArg = STAGE_SCRATCH + 0x00u;
    uint32_t pAiParam = STAGE_SCRATCH + 0x40u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x100u;
    U32(pAiArg + 0x00u) = pAiParam;
    U32(pAiArg + 0x08u) = STAGE_UNIT1;
    U32(pAiArg + 0x14u) = (k == 1) ? 40u : 5u;
    U32(pAiArg + 0x1Cu) = pMonTxt;
    U16(pMonTxt + 0x32u) = 10u;
    U16(pMonTxt + 0x34u) = 15u;
    if (k >= 1) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x38u, 1);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pAiArg; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pAiArg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC6FC0u, "AI_ThinkTerrorCurse_6FCC6FC0_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }
  /* 12. 0x6FCC4A10 AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10 (eax=pUnit, stack=[pGame, pAiArgs, bDecrementCounter], ret 0xC, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x201u, 1u, 4810u, 4810u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4812u, 4812u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiGen = STAGE_SCRATCH + 0x80u;
    U32(STAGE_UDATA0 + 0x28u) = pAiGen;
    U32(pAiGen + 0x28u) = STAGE_GAME;
    U32(pAiGen + 0x2Cu) = 0x101u;
    U32(pAiGen + 0x30u) = 0u;
    uint32_t pAiArgs = STAGE_SCRATCH + 0x00u;
    uint32_t pAiCmd = STAGE_SCRATCH + 0x40u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x100u;
    U32(pAiArgs + 0x00u) = pAiCmd;
    U32(pAiArgs + 0x1Cu) = pMonTxt;
    U16(pMonTxt + 0x170u) = 257u;
    attach_skill(STAGE_UNIT0, 257, 3);
    U32(pAiCmd + 0x18u) = (k == 2) ? 0xFFFFFFFFu : 5u;
    uint32_t dec = (k == 1) ? 1u : 0u;
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = pAiArgs; c.args[2] = dec; c.calleePop = 0x0Cu;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)pAiArgs; ts[3] = (int64_t)dec;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC4A10u, "AI_UpdateSummonOwnerTownAndChargeCounter_6FCC4A10", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 13. 0x6FCC00B0 STATES_CreateOrUpdateAuraStatList (eax=pAuraSetup, ret 0, ptr) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_SCRATCH + 0x100u) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u) = STAGE_SCRATCH + 0x100u;
    U32(STAGE_ROOM0 + 0x24u) = 1u;
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    uint32_t pSetup = STAGE_SCRATCH + 0x00u;
    U32(pSetup + 0x00u) = STAGE_UNIT0;
    U32(pSetup + 0x04u) = STAGE_UNIT0;
    U32(pSetup + 0x08u) = 100u;
    U32(pSetup + 0x0Cu) = 3u;
    U32(pSetup + 0x10u) = (k == 2) ? 25u : 0u;
    U32(pSetup + 0x14u) = 0xFFFFFFFFu;
    U32(pSetup + 0x1Cu) = (k == 0) ? 0xFFFFFFFFu : 2u;
    c = make_call(); c.eax = pSetup; c.calleePop = 0u;
    ts[0] = (int64_t)pSetup;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC00B0u, "STATES_CreateOrUpdateAuraStatList", k, lbl, &c, ts, 1u, 0xFFFFFFFFu, 0);
  }

  /* 14. 0x6FCBA1A0 AURAS_ApplyRadialStatBuffCallback (ecx=pAuraCtx, edx=pTargetUnit, ret 0, bool) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_SCRATCH + 0x100u) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u) = STAGE_SCRATCH + 0x100u;
    U32(STAGE_ROOM0 + 0x24u) = 1u;
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    uint32_t pCtx  = STAGE_SCRATCH + 0x00u;
    uint32_t pDesc = STAGE_SCRATCH + 0x40u;
    U32(pCtx + 0x00u) = STAGE_GAME;
    U32(pCtx + 0x04u) = STAGE_UNIT0;
    U32(pCtx + 0x0Cu) = pDesc;
    U32(pDesc + 0x00u) = (k == 0) ? 0xFFFFFFFFu : 2u;
    U32(pDesc + 0x04u) = 100u;
    U32(pDesc + 0x08u) = 3u;
    U32(pDesc + 0x0Cu) = (k == 2) ? 25u : 0u;
    U32(pDesc + 0x10u) = 1u;
    U32(pDesc + 0x28u) = (k == 2) ? 25u : 10u;
    c = make_call(); c.ecx = pCtx; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = (int64_t)pCtx; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBA1A0u, "AURAS_ApplyRadialStatBuffCallback", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 15. 0x6FCB9620 SKILLS_DoChargeStart_6FCB9620 (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8, bool) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, 0u);
    uint32_t pSk = attach_skill(STAGE_UNIT0, 107, 5);
    if (k == 2) {
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
      U16(STAGE_PATH0 + 0x10u) = 4818u;
      U16(STAGE_PATH0 + 0x14u) = 4812u;
    }
    int32_t sid = (k == 0) ? -1 : 107;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = 5;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB9620u, "SKILLS_DoChargeStart_6FCB9620", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 16. 0x6FCC0C70 AURA_ForEachUnitInRadius (eax=pGame, stack=[pCenterUnit, nX, nY, nRadius, dwFilterFlags, pfnCallback, pCallbackArg, bSkipMonFlag1B], ret 0x20, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_SCRATCH + 0x100u) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u) = STAGE_SCRATCH + 0x100u;
    U32(STAGE_ROOM0 + 0x24u) = 1u;
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, 0u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 4812u, 4812u);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t pDesc = STAGE_SCRATCH + 0x40u;
    U32(pDesc + 0x00u) = 2u;
    U32(pDesc + 0x04u) = 100u;
    U32(pDesc + 0x08u) = 3u;
    U32(pDesc + 0x0Cu) = (k == 2) ? 25u : 0u;
    U32(pDesc + 0x10u) = 1u;
    U32(pDesc + 0x28u) = (k == 2) ? 25u : 10u;
    uint32_t cbCanon = (k == 0) ? 0u : D2GAME_VA(0x9A1A0u);
    uint32_t cbLive  = (k == 0) ? 0u : (cbCanon + (uint32_t)g_game_rebase);
    c = make_call(); c.eax = STAGE_GAME;
    c.nargs = 8u; c.args[0] = STAGE_UNIT0; c.args[1] = 4810u; c.args[2] = 4810u;
    c.args[3] = 20u; c.args[4] = 0x00002003u; c.args[5] = cbLive; c.args[6] = pDesc; c.args[7] = 0u;
    c.calleePop = 0x20u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = 4810; ts[3] = 4810;
    ts[4] = 20; ts[5] = 0x00002003; ts[6] = (int64_t)cbCanon; ts[7] = (int64_t)pDesc; ts[8] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC0C70u, "AURA_ForEachUnitInRadius", k, lbl, &c, ts, 9u, 0x00000000u, 0);
  }

  /* 17. 0x6FCBA400 SKILLS_DoRedemptionAuraPulse_6FCBA400 (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1) ? 1u : 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, 0u);
    int32_t sid = (k == 0) ? -1 : 124;
    int32_t lvl = (k == 2) ? 5 : 3;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = (uint32_t)lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBA400u, "SKILLS_DoRedemptionAuraPulse_6FCBA400", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 18. 0x6FCBA8D0 SrvDoFunc_065_AuraRadialStatBuff (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_SCRATCH + 0x100u) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u) = STAGE_SCRATCH + 0x100u;
    U32(STAGE_ROOM0 + 0x24u) = 1u;
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, 0u);
    int32_t sid = (k == 0) ? -1 : ((k == 1) ? 98 : 113);
    int32_t lvl = (k == 2) ? 5 : 3;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = (uint32_t)lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBA8D0u, "SrvDoFunc_065_AuraRadialStatBuff", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 19. 0x6FCBABC0 SKILLS_SrvDo_PulseUndeadAura_6FCBABC0 (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1) ? 1u : 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, 0u);
    int32_t sid = (k == 0) ? -1 : 114;
    int32_t lvl = (k == 2) ? 5 : 3;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = (uint32_t)lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBABC0u, "SKILLS_SrvDo_PulseUndeadAura_6FCBABC0", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 20. 0x6FCBAF50 SKILLS_SrvDo_PulseElementalAura_6FCBAF50 (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1) ? 1u : 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, 0u);
    int32_t sid = (k == 0) ? -1 : ((k == 1) ? 102 : 119);
    int32_t lvl = (k == 2) ? 5 : 3;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = (uint32_t)lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBAF50u, "SKILLS_SrvDo_PulseElementalAura_6FCBAF50", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 21. 0x6FCB7A20 PETS_InsertPetIntoPlayerPetSlot_6FCB7A20 (ebx=pGame, esi=pPetTypeSlot, stack=[pPlayerUnit, pPetUnit, pPetArg], ret 0xC, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x201u, 1u, 4812u, 4812u);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 0x202u, 1u, 4814u, 4814u);
    uint32_t pSlot = STAGE_SCRATCH + 0x00u;
    uint32_t pHead = STAGE_SCRATCH + 0x20u;
    uint32_t pArg  = STAGE_SCRATCH + 0x40u;
    U32(pArg + 0x00u) = 0x1111u;
    U32(pArg + 0x04u) = 0x2222u;
    U32(pArg + 0x08u) = 0x3333u;
    uint32_t petU = (k == 0) ? 0u : ((k == 1) ? STAGE_UNIT1 : STAGE_UNIT2);
    if (k == 1) {
      U32(pSlot + 0x08u) = 2u;
    } else if (k == 2) {
      U32(pSlot + 0x00u) = pHead;
      U32(pSlot + 0x04u) = 1u;
      U32(pSlot + 0x08u) = 2u;
      U32(pHead + 0x04u) = 0x201u;
    }
    c = make_call(); c.ebx = STAGE_GAME; c.esi = pSlot;
    c.nargs = 3u; c.args[0] = STAGE_UNIT0; c.args[1] = petU; c.args[2] = pArg; c.calleePop = 0x0Cu;
    ts[0] = (int64_t)pSlot; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0;
    ts[3] = (int64_t)petU; ts[4] = (int64_t)pArg;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB7A20u, "PETS_InsertPetIntoPlayerPetSlot_6FCB7A20", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 22. 0x6FCDBC00 ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00 (ebx=pUnit, edi=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_timer_queue();
    stage_mon_reg(108u);
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 200u : 100u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_shrine_id, 0x401u, 0u, 4810u, 4810u, 0x12345679u);
    if (k >= 1) {
      uint32_t pQ = stage_quest_node(0x17u, 0x40u);
      uint32_t pCustom = U32(pQ + 0x18u);
      if (k == 1) {
        U32(pCustom + 0x24u) = 4810u;
        U32(pCustom + 0x28u) = 4810u;
      } else {
        U32(pCustom + 0x2Cu) = 4810u;
        U32(pCustom + 0x30u) = 4810u;
      }
    }
    c = make_call(); c.ebx = STAGE_UNIT0; c.edi = STAGE_GAME; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDBC00u, "ACT4Q3_SpawnChaosSealBossOrRetryEvent7_6FCDBC00", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 23. 0x6FCC1D10 SKILLS_ActivateAuraSkillOnUnit (edi=pUnit, stack=[pGame, nSkillId], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u) = 100u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, 0u);
    int32_t sid = (k == 0) ? 36 : ((k == 1) ? 102 : 98);
    attach_skill(STAGE_UNIT0, sid, 3);
    c = make_call(); c.edi = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = (uint32_t)sid; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)sid;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC1D10u, "SKILLS_ActivateAuraSkillOnUnit", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 24. 0x6FCC24C0 PORTAL_SpawnLinkedPortalPair_6FCC24C0 (eax=pOwner, stack=[pGame, pSourceRoom, nX, nY, nDestLevelId, ppOutSourcePortal, nPortalClassId, bDirectCoords], ret 0x20, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t lvl = (k == 0) ? 1u : 2u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, 0u);
    link_player_client(STAGE_UNIT0, STAGE_CLIENT);
    uint32_t pOutPortal = STAGE_SCRATCH + 0x00u;
    U32(pOutPortal) = (k == 2) ? 0x33333333u : 0x11111111u;
    uint32_t owner  = (k == 2) ? 0u : STAGE_UNIT0;
    uint32_t dest   = (k == 1) ? 40u : 3u;
    uint32_t nx     = (k == 2) ? 99999u : 4810u;
    uint32_t ny     = (k == 2) ? 99999u : 4810u;
    uint32_t portal = 0x3Bu;
    int expAssert   = (k == 1) ? 1 : 0;
    c = make_call(); c.eax = owner;
    c.nargs = 8u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = nx; c.args[3] = ny;
    c.args[4] = dest; c.args[5] = pOutPortal; c.args[6] = portal; c.args[7] = 1u;
    c.calleePop = 0x20u;
    ts[0] = (int64_t)owner; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_ROOM0;
    ts[3] = (int64_t)nx; ts[4] = (int64_t)ny; ts[5] = (int64_t)dest;
    ts[6] = (int64_t)pOutPortal; ts[7] = (int64_t)portal; ts[8] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC24C0u, "PORTAL_SpawnLinkedPortalPair_6FCC24C0", k, lbl, &c, ts, 9u, 0xFFFFFFFFu, expAssert);
  }

  /* 25. 0x6FCD2D90 D2GAME_ARENA_SyncArenaJoinState (eax=pClient, ebx=pGame, edi=0, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x102u, 1u, 4812u, 4812u, 0u);
    U32(STAGE_CLIENT + 0x04u)   = 4u;
    U8(STAGE_CLIENT + 0x3D4u)   = 4u;
    if (k >= 1) {
      uint32_t pArenaCtrl = STAGE_SCRATCH + 0x00u;
      U32(pArenaCtrl + 0x08u)     = 0x400u;
      U32(STAGE_GAME + 0x1D28u)   = pArenaCtrl;
      uint32_t pExtraCli = stage_extra_client();
      U32(pExtraCli + 0x04u)      = 4u;
      U32(pExtraCli + 0x174u)     = STAGE_UNIT1;
      U32(pExtraCli + 0x4A8u)     = STAGE_CLIENT;
      U32(STAGE_GAME + 0x88u)     = pExtraCli;
      uint32_t pArenaUnit = STAGE_SCRATCH + 0x40u;
      U16(pArenaUnit + 0x00u)     = (k == 2) ? 7u : 3u;
      U32(pArenaUnit + 0x04u)     = 1u;
      U32(STAGE_UDATA1 + 0x34u)   = pArenaUnit;
    }
    c = make_call(); c.eax = STAGE_CLIENT; c.ebx = STAGE_GAME; c.edi = 0u; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_CLIENT;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD2D90u, "D2GAME_ARENA_SyncArenaJoinState", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }
}



static void emit_batch_06(void) {
  CallSpec c;
  int64_t ts[16];
  char lbl[64];


  /* 4. 0x6FCB6310 SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310 (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 200u : 100u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, 0u);
    int32_t sid = (k == 0) ? -1 : 257;
    int32_t lvl = (k == 2) ? 5 : 2;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = (uint32_t)lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB6310u, "SKILLS_SrvDo_SummonPetWithAiInit_6FCB6310", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }


  /* 10. 0x6FCB20C0 SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0 (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 4810u, 4810u, 0u);
    int32_t sid = (k == 0) ? -1 : ((k == 1) ? 259 : 280);
    int32_t lvl = (k == 2) ? 5 : 3;
    if (k == 1) {
      attach_skill(STAGE_UNIT0, 259, 3);
      stage_prog_charge_state(STAGE_UNIT0, 125, 259, 3, 321, 2);
    } else if (k == 2) {
      attach_skill(STAGE_UNIT0, 280, 5);
      stage_prog_charge_state(STAGE_UNIT0, 124, 280, 5, 320, 3);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = (uint32_t)lvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)sid; ts[3] = (int64_t)lvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB20C0u, "SKILLS_SrvSt_ApplyChargedMissileSelfAura_6FCB20C0", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 11. 0x6FCB7730 PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730 (ebx=pPlayerUnit, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_UDATA1 + 0x58u) = 2u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) {
      uint32_t pTbl = STAGE_SCRATCH + 0x00u;
      uint32_t pSlots = STAGE_SCRATCH + 0x20u;
      uint32_t pNode = STAGE_SCRATCH + 0x200u;
      U32(STAGE_UDATA0 + 0x44u) = pTbl;
      U32(pTbl + 0x00u) = pSlots;
      U32(pSlots + 7u * 12u + 0x00u) = pNode;
      U32(pSlots + 7u * 12u + 0x04u) = 1u;
      U32(pSlots + 7u * 12u + 0x08u) = 1u;
      U32(pNode + 0x04u) = 0x201u;
      attach_skill(STAGE_UNIT0, 257, 3);
    }
    uint32_t plr = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ebx = plr;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)plr;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB7730u, "PETS_CleanupAllPlayerPetsOnActChangeOrSave_6FCB7730", k, lbl, &c, ts, 2u, 0x00000000u, (k == 0) ? 1 : 0);
  }

  /* 12. 0x6FCBDCD0 D2GAME_SUNIT_SyncUnitStateToClient (eax=pClient, ecx=pGame, edi=pUnit, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    link_player_client(STAGE_UNIT0, STAGE_CLIENT);
    U32(STAGE_CLIENT + 0x16Cu) = 0u;
    U32(STAGE_CLIENT + 0x170u) = 0x101u;
    U32(STAGE_CLIENT + 0x3D4u) = 1u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_UNIT1 + 0xC4u) = (k == 0) ? 0u : ((k == 1) ? 0x80000u : 0x80002u);
    c = make_call(); c.eax = STAGE_CLIENT; c.ecx = STAGE_GAME; c.edi = STAGE_UNIT1; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_CLIENT; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBDCD0u, "D2GAME_SUNIT_SyncUnitStateToClient113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 13. 0x6FCBDE10 D2GAME_SUNIT_SyncRoomUnitsToClient (eax=pRoom, ebx=pClient, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    link_player_client(STAGE_UNIT0, STAGE_CLIENT);
    U32(STAGE_CLIENT + 0x16Cu) = 0u;
    U32(STAGE_CLIENT + 0x170u) = 0x101u;
    U32(STAGE_CLIENT + 0x3D4u) = 1u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_UNIT1 + 0xC4u) = (k == 2) ? 0x80002u : 0x80000u;
    if (k >= 1) {
      U32(STAGE_ROOM0 + 0x1Cu) = STAGE_UNIT1;
    }
    c = make_call(); c.eax = STAGE_ROOM0; c.ebx = STAGE_CLIENT;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_ROOM0; ts[1] = (int64_t)STAGE_CLIENT; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBDE10u, "D2GAME_SUNIT_SyncRoomUnitsToClient113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 14. 0x6FCBDEC0 SUNIT_SyncAdjacentRoomUnitsToClient (eax=pRoom, ecx=pClient, edi=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(STAGE_SCRATCH + 0x100u) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u) = STAGE_SCRATCH + 0x100u;
    U32(STAGE_ROOM0 + 0x24u) = (k == 0) ? 0u : 1u;
    U32(STAGE_GAME + 0xBCu) = STAGE_ACT0;
    U32(STAGE_ACT0 + 0x00u) = 1u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    link_player_client(STAGE_UNIT0, STAGE_CLIENT);
    U32(STAGE_CLIENT + 0x16Cu) = 0u;
    U32(STAGE_CLIENT + 0x170u) = 0x101u;
    U32(STAGE_CLIENT + 0x3D4u) = 1u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_UNIT1 + 0xC4u) = (k == 2) ? 0x80002u : 0x80000u;
    U32(STAGE_ROOM0 + 0x1Cu) = STAGE_UNIT1;
    c = make_call(); c.eax = STAGE_ROOM0; c.ecx = STAGE_CLIENT; c.edi = STAGE_GAME; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_ROOM0; ts[1] = (int64_t)STAGE_CLIENT; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBDEC0u, "SUNIT_SyncAdjacentRoomUnitsToClient113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 15. 0x6FCDF730 NPCS_BeginVendorOrGambleInteract_6FCDF730 (stack=[pGame, pPlayer, pNpc, bGamble], ret 0x10, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x9Au, 0x201u, 1u, 4814u, 4814u);
    uint32_t pNpcRoot  = STAGE_SCRATCH + 0x00u;
    uint32_t pNpcArr   = STAGE_SCRATCH + 0x40u;
    uint32_t pVendNode = STAGE_SCRATCH + 0x0200u;
    U32(STAGE_GAME + 0x1D24u) = pNpcRoot;
    U32(pNpcRoot + 0x04u) = pNpcArr;
    U32(pNpcArr + 0x00u) = 0x9Au;
    U32(pNpcArr + 0x08u) = pVendNode;
    U32(pNpcArr + 0x0Cu) = 1u;
    U8(pNpcArr + 0x20u)  = 1u;
    U8(pNpcArr + 0x21u)  = 0u;
    U8(pNpcArr + 0x23u)  = 1u;
    U32(pVendNode + 0x04u) = 0x101u;
    uint32_t npc = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t bGamble = (k == 1) ? 1u : 0u;
    c = make_call();
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = npc; c.args[3] = bGamble;
    c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)npc; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)bGamble;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDF730u, "NPCS_BeginVendorOrGambleInteract_6FCDF730", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 16. 0x6FCCB580 D2Game_6FCCB580 (ecx=pGame, edx=pUnit, stack=[pAiParam], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x201u, 1u, 4810u, 4810u);
    U32(STAGE_UDATA0 + 0x58u) = 2u;
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4812u, 4812u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiArgs = STAGE_SCRATCH + 0x00u;
    uint32_t pAiCmd  = STAGE_SCRATCH + 0x40u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x100u;
    U32(pAiArgs + 0x00u) = pAiCmd;
    U32(pAiArgs + 0x08u) = (k == 2) ? STAGE_UNIT1 : 0u;
    U32(pAiArgs + 0x14u) = 10u;
    U32(pAiArgs + 0x18u) = 0u;
    U32(pAiArgs + 0x1Cu) = pMonTxt;
    U16(pMonTxt + 0x5Eu) = (k == 2) ? 20u : 5u;
    U16(pMonTxt + 0x60u) = 5u;
    if (k >= 1) {
      attach_skill(STAGE_UNIT0, 271, 3);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pAiArgs; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pAiArgs;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCB580u, "D2Game_6FCCB580", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 17. 0x6FCC2100 SKILLS_AssignHandSkillAndSyncAura (ecx=pUnit, edx=bLeft, stack=[nSkillId, dwOwnerGuid], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    link_player_client(STAGE_UNIT0, STAGE_CLIENT);
    attach_skill(STAGE_UNIT0, 98, 3);
    attach_skill(STAGE_UNIT0, 102, 4);
    uint32_t bLeft = (k == 2) ? 1u : 0u;
    int32_t sid = (k == 0) ? 999 : ((k == 1) ? 98 : 102);
    c = make_call(); c.ecx = STAGE_UNIT0; c.edx = bLeft;
    c.nargs = 2u; c.args[0] = (uint32_t)sid; c.args[1] = 0xFFFFFFFFu; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)bLeft; ts[2] = (int64_t)sid; ts[3] = -1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC2100u, "SKILLS_AssignHandSkillAndSyncAura113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }


  /* 20. 0x6FCC7C20 MONAI_DeathSentryTrapThink_6FCC7C20 (ecx=pGame, edx=pUnit, stack=[pAiParam], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x201u, 1u, 4810u, 4810u);
    U32(STAGE_UDATA0 + 0x58u) = 2u;
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4812u, 4812u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiGen  = STAGE_SCRATCH + 0x80u;
    uint32_t pAiArgs = STAGE_SCRATCH + 0x00u;
    uint32_t pAiCmd  = STAGE_SCRATCH + 0x40u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x100u;
    U32(STAGE_UDATA0 + 0x28u) = pAiGen;
    U32(pAiGen + 0x28u) = STAGE_GAME;
    U32(pAiGen + 0x2Cu) = 0x101u;
    U32(pAiGen + 0x30u) = 0u;
    U32(pAiArgs + 0x00u) = pAiCmd;
    U32(pAiArgs + 0x1Cu) = pMonTxt;
    U16(pMonTxt + 0x170u) = 276u;
    U16(pMonTxt + 0x5Cu) = 276u;
    if (k >= 1) {
      attach_skill(STAGE_UNIT0, 276, 3);
    }
    U32(pAiCmd + 0x18u) = (k == 2) ? 6u : 5u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pAiArgs; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pAiArgs;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC7C20u, "MONAI_DeathSentryTrapThink_6FCC7C20", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 21. 0x6FCC7DC0 MONAI_StationarySentryTrapThink_6FCC7DC0 (ecx=pGame, edx=pUnit, stack=[pAiParam], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x201u, 1u, 4810u, 4810u);
    U32(STAGE_UDATA0 + 0x58u) = 2u;
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4812u, 4812u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiGen  = STAGE_SCRATCH + 0x80u;
    uint32_t pAiArgs = STAGE_SCRATCH + 0x00u;
    uint32_t pAiCmd  = STAGE_SCRATCH + 0x40u;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x100u;
    U32(STAGE_UDATA0 + 0x28u) = pAiGen;
    U32(pAiGen + 0x28u) = STAGE_GAME;
    U32(pAiGen + 0x2Cu) = 0x101u;
    U32(pAiGen + 0x30u) = 0u;
    U32(pAiArgs + 0x00u) = pAiCmd;
    U32(pAiArgs + 0x1Cu) = pMonTxt;
    U16(pMonTxt + 0x170u) = 271u;
    U16(pMonTxt + 0x68u) = 271u;
    U16(pMonTxt + 0x62u) = 5u + (uint16_t)(k * 5);
    attach_skill(STAGE_UNIT0, 271, 3);
    U32(pAiCmd + 0x18u) = 5u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pAiArgs; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pAiArgs;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC7DC0u, "MONAI_StationarySentryTrapThink_6FCC7DC0", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 22. 0x6FCCF450 SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450 (ecx=pGame, edx=pUnit, stack=[pScrollItem, a2, a3, a4, a5], ret 0x14, int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t lvl = (k == 1) ? 1u : 0x88u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, 0u);
    link_player_client(STAGE_UNIT0, STAGE_CLIENT);
    if (k == 2) { U32(STAGE_UNIT0 + 0xC4u) = 0x40u; }
    uint32_t u = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = u;
    c.nargs = 5u; c.args[0] = 0u; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)u; ts[2] = 0; ts[3] = 0; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCF450u, "SKILLS_SrvDo_BookOrScrollOfTownPortal_6FCCF450", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
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

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pVtbl  = VirtualAlloc((void *)HASH_VTABLE_ADDR, HASH_VTABLE_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pVtbl != HASH_VTABLE_ADDR ||
      (uintptr_t)pStage != STAGE_BASE   || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-p10] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
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
    fprintf(stderr, "[k6-p10] LoadLibraryA failed\n");
    return 2;
  }

  g_com_rebase  = (intptr_t)g_hCom  - (intptr_t)D2COM_PREF_BASE;
  g_game_rebase = (intptr_t)g_hGame - (intptr_t)D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p10] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-p10] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p10] failed to open %s\n", outPath);
    return 5;
  }

  emit_group_1();
  emit_batch_02();
  emit_batch_03();
  emit_batch_04();
  emit_batch_05();
  emit_batch_06();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p10] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
