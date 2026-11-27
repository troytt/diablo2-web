/*
 * K6-P13 D2Game.dll Band C (0x6FCB0000..0x6FCDFFFF) Oracle Vector Emitter
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
    fprintf(stderr, "[k6-p13] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
      fprintf(stderr, "[k6-p13] missing Fog.#%u\n", fogHooks[i].ord);
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
    fprintf(stderr, "[k6-p13] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p13] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_VA(0x99000u) + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p13] short read at page %u\n", i);
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
    fprintf(stderr, "[k6-p13] extra_caps overflow\n");
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
        fprintf(stderr, "[k6-p13] mem json buffer overflow\n");
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
    fprintf(stderr, "[k6-p13] mem json cap overflow\n");
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
            "[k6-p13] UNEXPECTED FAULT %s case %d (%s) code=0x%08X eip=0x%08X addr=0x%08X\n",
            name, caseIdx, label, g_fault_code, g_fault_eip, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }
  int asserted = (g_thunk_faulted == 2);
  if (asserted != (expectAssert != 0)) {
    fprintf(stderr,
            "[k6-p13] ASSERT MISMATCH %s (0x%08X) case %d (%s): expected=%d got=%d (line=0x%X)\n",
            name, canonVa, caseIdx, label, expectAssert, asserted, g_assert_line);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!asserted) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != c->calleePop) {
      fprintf(stderr,
              "[k6-p13] ESP POP MISMATCH %s (0x%08X) case %d (%s): expected=%u actual=%u\n",
              name, canonVa, caseIdx, label, c->calleePop, actualPop);
      TerminateProcess(GetCurrentProcess(), 32);
    }
  }

  capture_stage_json(g_post_json, sizeof(g_post_json), setupTop);

  size_t hlen = 0;
  for (uint32_t p = HEAP_BASE; p < g_heap_top; p++) {
    uint8_t b = read_canon_byte(p, HEAP_BASE, g_heap_top);
    if (hlen + 3 >= sizeof(g_heap_hex)) {
      fprintf(stderr, "[k6-p13] heapHex overflow\n");
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
  fflush(g_out_fp);
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
    uint32_t pInteract = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(pUData + 0x28u) = pAiGen;
    U32(pUData + 0x2Cu) = pAiCtrl;
    U32(pUData + 0x30u) = pInteract;
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



static void __attribute__((unused)) stage_mon_reg_ex(uint32_t levelId) {
  uint32_t pReg = (uint32_t)(uintptr_t)bump_alloc(0x2E8u);
  U8(pReg + 0x00u) = 1u;
  U8(pReg + 0x01u) = 5u;
  U32(STAGE_GAME + 0xF0u + levelId * 4u) = pReg;
  if (levelId != 0u && U32(STAGE_GAME + 0xF0u) == 0u) {
    U32(STAGE_GAME + 0xF0u) = pReg;
  }
  U32(STAGE_GAME + 0x10DCu) = pReg;
}

static void __attribute__((unused)) stage_act_slot(
    uint32_t actIdx, uint32_t pAct, uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId, uint32_t pDrlg) {
  uint32_t pEnv = (uint32_t)(uintptr_t)bump_alloc(0x40u);
  U32(pAct + 0x04u) = pEnv;
  U32(pAct + 0x08u) = 0u;
  U32(pAct + 0x10u) = pRoom;
  U32(pAct + 0x48u) = pDrlg;
  U32(pDrlg + 0x47Cu) = pLevel;
  U32(STAGE_GAME + 0xBCu + actIdx * 4u) = pAct;
  U32(pRoom + 0x10u)   = pRoomEx;
  U32(pRoom + 0x2Cu)   = pAct;
  U32(pRoomEx + 0x28u) = 0x03130000u;
  U32(pRoomEx + 0x30u) = pRoom;
  U32(pRoomEx + 0x34u) = 960u;
  U32(pRoomEx + 0x38u) = 960u;
  U32(pRoomEx + 0x3Cu) = 8u;
  U32(pRoomEx + 0x40u) = 8u;
  U32(pRoomEx + 0x58u) = pLevel;
  U32(pLevel + 0x10u)  = pRoomEx;
  U32(pLevel + 0x1Cu)  = 960u;
  U32(pLevel + 0x20u)  = 960u;
  U32(pLevel + 0x24u)  = 8u;
  U32(pLevel + 0x28u)  = 8u;
  U32(pLevel + 0x2Cu)  = 964u;
  U32(pLevel + 0x30u)  = 964u;
  U32(pLevel + 0x34u)  = 0u;
  U32(pLevel + 0x38u)  = 964u;
  U32(pLevel + 0x3Cu)  = 964u;
  U32(pLevel + 0x40u)  = 1u;
  U32(pLevel + 0x1B4u) = pDrlg;
  U32(pLevel + 0x1C4u) = 0x11112222u;
  U32(pLevel + 0x1C8u) = 0x29Au;
  U32(pLevel + 0x1D0u) = levelId;
  U32(pLevel + 0x1D8u) = 2u;
}

static uint32_t __attribute__((unused)) alloc_pet_slots(uint32_t pPlayerUData) {
  uint32_t pSlots = STAGE_PETCTRL + 0x10u;
  U32(STAGE_PETCTRL + 0x00u) = pSlots;
  U32(pPlayerUData + 0x44u)  = STAGE_PETCTRL;
  return pSlots;
}

static uint32_t __attribute__((unused)) add_pet_slot_node(
    uint32_t pSlots, uint32_t petType, uint32_t guid, uint32_t flags, uint32_t nameA, uint32_t nameB, uint32_t maxCnt) {
  uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x18u);
  uint32_t sOff = petType * 12u;
  U32(pNode + 0x00u) = flags;
  U32(pNode + 0x04u) = guid;
  U32(pNode + 0x08u) = nameA;
  U32(pNode + 0x0Cu) = nameB;
  U32(pNode + 0x14u) = U32(pSlots + sOff + 0x00u);
  U32(pSlots + sOff + 0x00u) = pNode;
  U32(pSlots + sOff + 0x04u) = U32(pSlots + sOff + 0x04u) + 1u;
  U32(pSlots + sOff + 0x08u) = maxCnt;
  return pNode;
}

static void emit_batch_02(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[64];

  /* 0x6FCC22E0 PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c (stack=[pGame, pSourcePortal, nDestLevelId, nSourceLevelId], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t srcLvl  = (k == 0) ? 2u : 1u;
    uint32_t destLvl = (k == 1) ? 40u : (k == 2) ? 2u : 1u;
    uint32_t actNo   = (k == 1) ? 1u : 0u;
    uint32_t pAct    = (k == 1) ? STAGE_ACT1 : STAGE_ACT0;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, srcLvl);
    uint32_t g1 = stage_room_with_coll(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, destLvl);
    stage_act_slot(actNo, pAct, STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, destLvl, STAGE_DRLG0);
    stage_timer_queue();
    stage_mon_reg_ex(destLvl);
    U32(STAGE_ROOMEX1 + 0x24u) = 1u;
    U32(STAGE_ROOM1 + 0x34u) = 0u;
    (void)g1;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_portal_id, 0x401u + (uint32_t)k, 2u, 4815u, 4815u, 0x11223344u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    c = make_call();
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = destLvl; c.args[3] = srcLvl;
    c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)destLvl; ts[3] = (int64_t)srcLvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC22E0u, "PORTAL_CreateLinkedDestinationPortal_6FCC22E0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 0x6FCC2DE0 SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c (eax=pUnit, ebx=pGame, stack=[pTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg_ex(2u);
    if (k == 0) {
      stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 0x301u, 0u, 2u, 0u);
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    } else if (k == 1) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4810u, 4810u);
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4812u, 4812u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4818u, 4816u);
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x102u, 1u, 4822u, 4820u, STAGE_CLIENT);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = STAGE_GAME;
    c.nargs = 1u; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC2DE0u, "SKILLS_ResetAttackerCombatAndStartWeaponOrMonsterAttack_6FCC2DE0_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 0x6FCC3610 D2Game_6FCC3610_113c (eax=pSpawnDesc, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg_ex(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pDesc = STAGE_SCRATCH;
    U32(pDesc + 0x04u) = STAGE_UNIT0;
    if (k == 0) {
      U32(pDesc + 0x00u) = 1u;
      U32(pDesc + 0x14u) = 9999u; U32(pDesc + 0x18u) = 9999u;
    } else if (k == 1) {
      U32(pDesc + 0x00u) = 5u;
      U32(pDesc + 0x08u) = g_mon_id_0; U32(pDesc + 0x10u) = 1u;
      U32(pDesc + 0x14u) = 4812u; U32(pDesc + 0x18u) = 4812u;
    } else {
      U32(pDesc + 0x00u) = 0u;
      U16(STAGE_PATH0 + 0x10u) = 4814u; U16(STAGE_PATH0 + 0x12u) = 4814u;
      U32(pDesc + 0x08u) = g_mon_id_1; U32(pDesc + 0x10u) = 1u;
    }
    c = make_call(); c.eax = pDesc;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)pDesc; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC3610u, "D2Game_6FCC3610_113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 0x6FCC7290 MONAI_PutridDefilerThink_6FCC7290_113c (ecx=pGame, edx=pUnit, stack=[pAiParam], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg_ex(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, 4815u, 4815u, STAGE_CLIENT);
    uint32_t pAiP = STAGE_SCRATCH;
    uint32_t pTxt = STAGE_SCRATCH + 0x100u;
    U32(pAiP + 0x08u) = STAGE_UNIT1;
    U32(pAiP + 0x14u) = (k == 0) ? 2u : (k == 1) ? 5u : 20u;
    U32(pAiP + 0x18u) = (k == 0) ? 1u : 0u;
    U32(pAiP + 0x1Cu) = pTxt;
    U16(pTxt + 0x56u) = 10u;
    U8(pTxt + 0x5Cu)  = 8u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = pAiP; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)pAiP;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC7290u, "MONAI_PutridDefilerThink_6FCC7290_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }


  /* 0x6FCCD910 ITEMEVENT_AttackerTakesDamage113c (ecx=pGame, stack=[pUnit, pAttacker, pDmg, dwStatAndLayer, dwArg2], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    uint32_t u0 = (k == 0) ? 0u : STAGE_UNIT0;
    if (k >= 1) {
      U32(STAGE_UNIT1 + 0xC4u) = 4u;
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 40 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 40 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 78, (k == 2) ? 15 : 0, 0);
    }
    c = make_call(); c.ecx = STAGE_GAME;
    c.nargs = 5u; c.args[0] = u0; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_DMG; c.args[3] = (78u << 16); c.args[4] = 0u;
    c.calleePop = 0x14u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)u0; ts[2] = (int64_t)STAGE_UNIT1;
    ts[3] = (int64_t)STAGE_DMG; ts[4] = (int64_t)(78u << 16); ts[5] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCD910u, "ITEMEVENT_AttackerTakesDamage113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* 0x6FCCDCE0 ITEMEVENT_ChanceToCastSkill113c (stack=[pUnit, pTarget, pDmg, dwStatAndLayer, dwArg2], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    uint32_t u0 = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t enc = (38u << 6) | 3u;
    uint32_t dwSL = (198u << 16) | enc;
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 198, 100, (int32_t)enc);
      U16(STAGE_DMG + 0x04u) = (k == 2) ? 5u : 0u;
    }
    c = make_call();
    c.nargs = 5u; c.args[0] = u0; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_DMG; c.args[3] = dwSL; c.args[4] = 0u;
    c.calleePop = 0x14u;
    ts[0] = (int64_t)u0; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_DMG; ts[3] = (int64_t)dwSL; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCDCE0u, "ITEMEVENT_ChanceToCastSkill113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }

  /* 0x6FCCFB90 MONSTER_DestroyMonsterUnit113c (esi=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    if (k == 0) {
      stage_unit_common(STAGE_UNIT0, 0u, STAGE_PATH0, STAGE_ROOM0, 5u, 0u, 0x501u, 0u, 4812u, 4812u, 0x11223344u);
    } else {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
      U32(STAGE_UDATA0 + 0x28u) = 0u;
      U32(STAGE_UDATA0 + 0x2Cu) = (k == 2) ? (uint32_t)(uintptr_t)bump_alloc(0x20u) : 0u;
      if (k == 2) {
        U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      }
    }
    c = make_call(); c.esi = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCCFB90u, "MONSTER_DestroyMonsterUnit113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* 0x6FCD0720 MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c (edi=pUnit, ebx=pfnCallback, stack=[pGame, pContext], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t ppNear = STAGE_SCRATCH + 0x100u;
    U32(ppNear) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u) = ppNear;
    U32(STAGE_ROOM0 + 0x24u) = (k == 0) ? 0u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_prog_charge_state(STAGE_UNIT0, 0x69, 0, 0, 0xAC, 2);
    U32(U32(STAGE_UDATA0 + 0x28u) + 0x2Cu) = 0xFFFFFFFFu;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint16_t cx = (k == 2) ? 4818u : 4812u;
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, cx, cx, STAGE_CLIENT);
    U32(STAGE_UNIT1 + 0xC4u) = 4u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t pScan = STAGE_SCRATCH;
    U32(pScan + 0x04u) = 0x7FFFFFFFu;
    U32(pScan + 0x08u) = 0u;
    U32(pScan + 0x0Cu) = 35u;
    U32(pScan + 0x18u) = 0x7FFFFFFFu;
    uint32_t cbLive = (k == 0) ? 0u : (D2GAME_VA(0xB1660u) + (uint32_t)g_game_rebase);
    c = make_call(); c.edi = STAGE_UNIT0; c.ebx = cbLive;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = pScan; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (k == 0) ? 0 : (int64_t)D2GAME_VA(0xB1660u);
    ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)pScan;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD0720u, "MONAI_ForEachUnitInAdjacentRooms_6FCD0720_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* 0x6FCD0CE0 MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c (edi=pUnit, ebx=pfnCallback, stack=[pGame, pContext], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1) ? 1u : 2u);
    uint32_t ppNear = STAGE_SCRATCH + 0x100u;
    U32(ppNear) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u) = ppNear;
    U32(STAGE_ROOM0 + 0x24u) = 1u;
    U32(STAGE_ROOM0 + 0x28u) = 1u;
    U32(STAGE_ROOM0 + 0x34u) = (k == 1) ? 1u : 0u;
    U32(STAGE_ROOM0 + 0x78u) = 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_prog_charge_state(STAGE_UNIT0, 0x69, 0, 0, 0xAC, 2);
    U32(U32(STAGE_UDATA0 + 0x28u) + 0x2Cu) = 0xFFFFFFFFu;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint16_t cx = (k == 2) ? 4818u : 4812u;
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x101u, 1u, cx, cx, STAGE_CLIENT);
    U32(STAGE_UNIT1 + 0xC4u) = 4u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t pScan = STAGE_SCRATCH;
    U32(pScan + 0x04u) = 0x7FFFFFFFu;
    U32(pScan + 0x08u) = 0u;
    U32(pScan + 0x0Cu) = 35u;
    U32(pScan + 0x18u) = 0x7FFFFFFFu;
    uint32_t cbLive = D2GAME_VA(0xB1660u) + (uint32_t)g_game_rebase;
    c = make_call(); c.edi = STAGE_UNIT0; c.ebx = cbLive;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = pScan; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)D2GAME_VA(0xB1660u);
    ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)pScan;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD0CE0u, "MONAI_ForEachUnitInNonTownAdjacentRoomsWithPlayer_6FCD0CE0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }



  /* 0x6FCD7D30 AIBAAL_TrySpawnBaalClone_6FCD7D30_113c (eax=pUnit, stack=[pGame, pAiControl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_0, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_UNIT0 + 0x20u) = 0x11112222u + (uint32_t)k * 0x22221111u;
    U32(STAGE_UNIT0 + 0x24u) = 0x33334444u;
    if (k == 0) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_0, 0x202u, 1u, 4814u, 4814u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_UNIT0 + 0xC8u) = 0x400u;
      U32(STAGE_UNIT0 + 0x94u) = 1u;
      U32(STAGE_UNIT0 + 0x98u) = 0x202u;
    } else {
      U16(STAGE_PATH0 + 0x02u) = 40000u;
      U16(STAGE_PATH0 + 0x06u) = 40000u;
    }
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCD7D30u, "AIBAAL_TrySpawnBaalClone_6FCD7D30_113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* 0x6FCDA1E0 ACT3Q1_Callback03_LevelChanged113c (ecx=pQuest, edx=pArg, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_quest_node(19u, 0x80u);
    U32(STAGE_QUEST0 + 0xE0u) = 19u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pRec = alloc_quest_record();
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x14u) = (k == 0) ? 1u : 0x67u;
    if (k == 1) {
      U16(STAGE_QUEST0 + 0x9Cu) = 1u;
      U32(STAGE_QUEST0 + 0x1Cu) = 0x101u;
      U8(STAGE_QUEST0 + 0x0Cu)  = 0u;
    } else if (k == 2) {
      U8(STAGE_QUEST0 + 0x0Cu) = 2u;
      set_quest_bit(pRec, 19u, 0u);
    }
    c = make_call(); c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    c.nargs = 0u; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_QUEST0; ts[1] = (int64_t)STAGE_QUESTARG;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDA1E0u, "ACT3Q1_Callback03_LevelChanged113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }



  /* 0x6FCDDB10 NPCS_CainIdentifyAllItems_6FCDDB10_113c (eax=dwNpcGuid, ecx=pPlayer, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pRec = alloc_quest_record();
    U32(STAGE_UDATA0 + 0x10u) = pRec;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0xF4u, 0x201u, 1u, 4812u, 4812u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_UNIT0 + 0x64u) = 0x201u;
      U32(STAGE_UNIT0 + 0x68u) = 1u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    }
    if (k == 2) {
      set_quest_bit(pRec, 4u, 0u);
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_sword, 0x301u, 0u, 4u, 0u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 0u, 0u, 0u);
    }
    uint32_t npcGuid = (k == 0) ? 999u : 0x201u;
    c = make_call(); c.eax = npcGuid; c.ecx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)npcGuid; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDDB10u, "NPCS_CainIdentifyAllItems_6FCDDB10_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* 0x6FCDE2A0 D2Game_6FCDE2A0_113c (eax=pShop, ecx=pPlayer, stack=[pGame, pNpc], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    U8(STAGE_GAME + 0x6Du) = (k == 0) ? 99u : (k == 2) ? 1u : 0u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 2) ? 45 : 15, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 198u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    U32(STAGE_NPCCTRL + 0x04u) = (uint32_t)(uintptr_t)bump_alloc(64u * 0x44u);
    U32(STAGE_NPCCTRL + 0x08u) = 0x12345678u + (uint32_t)k * 0x11111111u;
    uint32_t pArena = STAGE_SCRATCH + 0x200u;
    U32(STAGE_GAME + 0x1D28u) = pArena;
    U8(pArena + 0x08u) = 2u;
    uint32_t pShop = STAGE_SCRATCH;
    c = make_call(); c.eax = pShop; c.ecx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = (int64_t)pShop; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDE2A0u, "D2Game_6FCDE2A0_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 0x6FCDE640 D2Game_6FCDE640_113c (stack=[pGame, pPlayer, pNpc, dwItemGuid, nBuyMode, bFillStack], ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 198u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UDATA0 + 0x10u) = alloc_quest_record();
    U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    U32(STAGE_NPCCTRL + 0x04u) = (uint32_t)(uintptr_t)bump_alloc(64u * 0x44u);
    if (k >= 1) {
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_pot, 0x301u, 0u, 2u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    }
    uint32_t itemGuid = (k == 0) ? 9999u : 0x301u;
    uint32_t buyMode  = (k == 2) ? 2u : 0u;
    c = make_call();
    c.nargs = 6u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1;
    c.args[3] = itemGuid; c.args[4] = buyMode; c.args[5] = 0u; c.calleePop = 0x18u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_UNIT1;
    ts[3] = (int64_t)itemGuid; ts[4] = (int64_t)buyMode; ts[5] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDE640u, "D2Game_6FCDE640_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* 0x6FCDEE30 D2Game_6FCDEE30_113c (eax=pGame, ecx=dwItemCode, stack=[pNpc, pShop, nQuality, nItemLevel, nPlayerLevel], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 198u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    uint32_t code = (k == 0) ? 0x20706163u : (k == 1) ? 0x20317068u : 0x20776F62u;
    uint32_t qual = (k == 1) ? 4u : 2u;
    uint32_t ilvl = (uint32_t)(10 + k * 10);
    c = make_call(); c.eax = STAGE_GAME; c.ecx = code;
    c.nargs = 5u; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_SCRATCH; c.args[2] = qual; c.args[3] = ilvl; c.args[4] = ilvl;
    c.calleePop = 0x14u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)code; ts[2] = (int64_t)STAGE_UNIT0;
    ts[3] = (int64_t)STAGE_SCRATCH; ts[4] = (int64_t)qual; ts[5] = (int64_t)ilvl; ts[6] = (int64_t)ilvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDEE30u, "D2Game_6FCDEE30_113c", k, lbl, &c, ts, 7u, 0xFFFFFFFFu, 0);
  }

  /* 0x6FCDF1C0 NPCTRADE_EnsureVendorInventoryGenerated_6FCDF1C0_113c (eax=pShop, ecx=pPlayer, stack=[pGame, pNpc], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 198u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    U32(STAGE_NPCCTRL + 0x04u) = STAGE_SCRATCH + 0x200u;
    U32(STAGE_NPCCTRL + 0x08u) = 0x12345678u + (uint32_t)k * 0x10101u;
    uint32_t pArena = STAGE_SCRATCH + 0x300u;
    U32(STAGE_GAME + 0x1D28u) = pArena;
    U8(pArena + 0x08u) = 2u;
    uint32_t pShop = STAGE_SCRATCH;
    if (k == 0) {
      uint32_t pNode = STAGE_SCRATCH + 0x100u;
      U32(pNode + 0x04u) = 0x101u;
      U32(pShop + 0x08u) = pNode;
    } else if (k == 2) {
      U8(STAGE_GAME + 0x6Du) = 1u;
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 40, 0);
    }
    c = make_call(); c.eax = pShop; c.ecx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = (int64_t)pShop; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME; ts[3] = (int64_t)STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDF1C0u, "NPCTRADE_EnsureVendorInventoryGenerated_6FCDF1C0_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 0x6FCDF2E0 NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c (stack=[pGame, pPlayer, pNpc, pShop], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 2) ? 30 : 10, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 198u, 0x201u, 1u, 4812u, 4812u);
    U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    uint32_t pTbl = STAGE_NPCCTRL + 0x100u;
    U32(STAGE_NPCCTRL + 0x04u) = pTbl;
    U32(STAGE_NPCCTRL + 0x08u) = 0x12345u;
    U32(pTbl + 0x00u) = 198u;
    U32(pTbl + 0x30u) = 0u;
    U32(pTbl + 0x38u) = 0u;
    uint32_t pShop = STAGE_SCRATCH;
    U32(pShop + 0x08u) = (uint32_t)(k + 1);
    if (k == 2) {
      uint32_t pCodes = STAGE_SCRATCH + 0x400u;
      uint32_t pMinMax = STAGE_SCRATCH + 0x500u;
      U32(pCodes + 0x04u) = 0x20706163u;
      U8(pMinMax + 0u) = 1u;
      U8(pMinMax + 1u) = 2u;
      U32(pShop + 0x0Cu) = pCodes;
      U32(pTbl + 0x2Cu) = pMinMax;
      U32(pTbl + 0x30u) = 1u;
    }
    c = make_call();
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.args[3] = pShop;
    c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_UNIT1; ts[3] = (int64_t)pShop;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDF2E0u, "NPCTRADE_PopulateVendorItemsFromTable_6FCDF2E0_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* 0x6FCDF990 D2Game_6FCDF990_113c (eax=dwNpcGuid, stack=[pGame, pPlayer, dwItemGuid, nSellMode], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 198u, 900u, 1u, 4812u, 4812u);
    stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_pot, 701u, 0u, 2u, 0u);
    if (k == 0) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    } else if (k == 1) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    } else {
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      U32(STAGE_UNIT0 + 0x64u) = 900u;
      U32(STAGE_UNIT0 + 0x68u) = 1u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
    }
    uint32_t itemGuid = (k == 1) ? 9999u : 701u;
    c = make_call(); c.eax = 900u;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = itemGuid; c.args[3] = 0u;
    c.calleePop = 0x10u;
    ts[0] = 900; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)itemGuid; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCDF990u, "D2Game_6FCDF990_113c", k, lbl, &c, ts, 5u, 0xFFFFFFFFu, 0);
  }
}

static void emit_batch_01(void) {
  CallSpec c;
  int64_t ts[12];
  char lbl[64];

  /* #4 0x6FCB2ED0 MONSTER_EquipMonEquipItems113c (eax=nRowFilterLevel, ecx=pUnit, stack=[pGame, pDonorUnit, nItemLevel, bOnInit], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t monId = (k == 0) ? 267u : (k == 1) ? 357u : 417u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, monId, 0x201u, 1u, 4815u, 4815u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    uint32_t donor = 0u;
    if (k == 2) {
      stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 6u, 0x101u, 1u, 4812u, 4812u, STAGE_CLIENT);
      stage_item_unit(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_item_armor, 0x301u, 1u, 2u, 0u);
      place_body_item(STAGE_UNIT1, STAGE_UNIT2, 3);
      donor = STAGE_UNIT1;
    }
    uint32_t iLvl = (k == 2) ? 5u : 10u;
    uint32_t bOnInit = (k == 2) ? 0u : 1u;
    int32_t rowFilter = 0;
    c = make_call(); c.eax = (uint32_t)rowFilter; c.ecx = STAGE_UNIT0;
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = donor; c.args[2] = iLvl; c.args[3] = bOnInit;
    c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)donor;
    ts[3] = (int64_t)iLvl; ts[4] = (int64_t)bOnInit; ts[5] = (int64_t)rowFilter;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB2ED0u, "MONSTER_EquipMonEquipItems113c", k, lbl, &c, ts, 6u, 0x00000000u, 0);
  }

  /* #6 0x6FCB4DC0 SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c (ecx=pGame, edx=pCaster, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 5005u, 5005u, STAGE_CLIENT);
    U16(STAGE_PATH0 + 0x10u) = 5012u;
    U16(STAGE_PATH0 + 0x12u) = 5010u;
    if (k >= 1) attach_skill(STAGE_UNIT0, 256, 4);
    int32_t sk = (k == 0) ? -1 : 256;
    int32_t slvl = (k == 2) ? 6 : 2;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sk; c.args[1] = (uint32_t)slvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = sk; ts[3] = slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB4DC0u, "SKILLS_SrvDo_SpawnChargeScaledScatteredProjectiles_6FCB4DC0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* #7 0x6FCB4E60 SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 5005u, 5005u, STAGE_CLIENT);
    U16(STAGE_PATH0 + 0x10u) = 5010u;
    U16(STAGE_PATH0 + 0x12u) = 5010u;
    int32_t sk = (k == 0) ? -1 : (k == 1) ? 259 : 280;
    if (k == 1) {
      attach_skill(STAGE_UNIT0, 259, 3);
      stage_prog_charge_state(STAGE_UNIT0, 125, 259, 3, 0x15D, 3);
    } else if (k == 2) {
      attach_skill(STAGE_UNIT0, 280, 4);
      stage_prog_charge_state(STAGE_UNIT0, 124, 280, 4, 0x15C, 2);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sk; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = sk; ts[3] = 3;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB4E60u, "SKILLS_SrvDo_SpawnChargedSpiralNova_6FCB4E60_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* #10 0x6FCB6920 D2GAME_SUMMON_BroadcastPlayerPetsToClient113c (eax=pPlayerUnit, stack=[pDestClient], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSlots = alloc_pet_slots(STAGE_UDATA0);
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 1) ? g_mon_id_1 : 271u, 0x201u, 1u, 4812u, 4812u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      add_pet_slot_node(pSlots, (k == 1) ? 4u : 7u, 0x201u, 0u, 0x42u, 1u, 3u);
    }
    c = make_call(); c.eax = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_CLIENT; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_CLIENT; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB6920u, "D2GAME_SUMMON_BroadcastPlayerPetsToClient113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* #11 0x6FCB6AF0 PETS_ForEachPlayerPetUnit_6FCB6AF0_113c (edi=pGame, ebx=pfnCallback, stack=[pPlayer, pArg], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSlots = alloc_pet_slots(STAGE_UDATA0);
    uint32_t pCtx = STAGE_SCRATCH;
    U32(pCtx + 0x00u) = STAGE_UNIT0;
    U32(pCtx + 0x04u) = 0u;
    U32(pCtx + 0x08u) = 0u;
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4811u, 4811u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      add_pet_slot_node(pSlots, 1u, 0x201u, 0u, 0u, 0u, 3u);
    }
    if (k == 2) {
      stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4811u, 4812u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      add_pet_slot_node(pSlots, 4u, 0x202u, 0u, 0u, 0u, 3u);
    }
    uint32_t cbVa = D2GAME_VA(0x15590u) + (uint32_t)g_game_rebase;
    c = make_call(); c.edi = STAGE_GAME; c.ebx = cbVa;
    c.nargs = 2u; c.args[0] = STAGE_UNIT0; c.args[1] = pCtx; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)D2GAME_VA(0x15590u); ts[3] = (int64_t)pCtx;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB6AF0u, "PETS_ForEachPlayerPetUnit_6FCB6AF0_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* #12 0x6FCB6C00 PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c (eax=pPetListWrapper, stack=[pGame, pPlayerUnit, nMaxDistSq], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_mon_reg_ex(1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSlots = alloc_pet_slots(STAGE_UDATA0);
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4830u, 4810u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      add_pet_slot_node(pSlots, 1u, 0x201u, 0u, 0u, 0u, 3u);
    }
    uint32_t slotWrapper = pSlots + 1u * 12u;
    uint32_t maxDistSq = (k == 1) ? 1000u : 100u;
    c = make_call(); c.eax = slotWrapper;
    c.nargs = 3u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = maxDistSq; c.calleePop = 0xCu;
    ts[0] = (int64_t)slotWrapper; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)maxDistSq;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB6C00u, "PETS_UnsummonPetsBeyondDistanceSq_6FCB6C00_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* #13 0x6FCB7420 PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c (eax=pGame, stack=[pPlayer, pPetTypeSlot, bPlayerAlive, bKeepHirelingDeadNode], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_mon_reg_ex(1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSlots = alloc_pet_slots(STAGE_UDATA0);
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      add_pet_slot_node(pSlots, 7u, 0x201u, 0u, 0x33u, 0u, 1u);
    }
    uint32_t slot7 = pSlots + 7u * 12u;
    uint32_t bAlive = (k == 0) ? 0u : 1u;
    uint32_t bKeep = (k == 2) ? 1u : 0u;
    c = make_call(); c.eax = STAGE_GAME;
    c.nargs = 4u; c.args[0] = STAGE_UNIT0; c.args[1] = slot7; c.args[2] = bAlive; c.args[3] = bKeep; c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)slot7;
    ts[3] = (int64_t)bAlive; ts[4] = (int64_t)bKeep;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB7420u, "PETS_CleanupOrMarkDeadPetSlot_6FCB7420_113c", k, lbl, &c, ts, 5u, 0x00000000u, 0);
  }

  /* #14 0x6FCB77E0 PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c (ecx=pGame, edx=dwPetGuid, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_mon_reg_ex(1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    if (k >= 1) {
      if (k == 2) U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    uint32_t guid = (k == 0) ? 0x999u : 0x201u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = guid; c.calleePop = 0u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)guid;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB77E0u, "PETS_KillOrUnsummonPetByGuid_6FCB77E0_113c", k, lbl, &c, ts, 2u, 0x00000000u, 0);
  }

  /* #15 0x6FCB7920 PETS_RemovePetFromSlotByGuid_6FCB7920_113c (eax=pGame, ecx=dwPetGuid, stack=[pPetTypeSlot, bKillMonsterUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_mon_reg_ex(1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSlots = alloc_pet_slots(STAGE_UDATA0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    if (k >= 1) add_pet_slot_node(pSlots, 1u, 0x201u, 0u, 0u, 0u, 2u);
    uint32_t slot1 = pSlots + 1u * 12u;
    uint32_t guid = (k == 0) ? 0x888u : 0x201u;
    uint32_t bKill = (k == 2) ? 1u : 0u;
    c = make_call(); c.eax = STAGE_GAME; c.ecx = guid;
    c.nargs = 2u; c.args[0] = slot1; c.args[1] = bKill; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)guid; ts[2] = (int64_t)slot1; ts[3] = (int64_t)bKill;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB7920u, "PETS_RemovePetFromSlotByGuid_6FCB7920_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* #16 0x6FCB7B50 PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c (ecx=pGame, edx=pPlayer, stack=[dwPetGuid, bKillMonsterUnit], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_mon_reg_ex(1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSlots = alloc_pet_slots(STAGE_UDATA0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    if (k >= 1) add_pet_slot_node(pSlots, 1u, 0x201u, 0u, 0u, 0u, 2u);
    uint32_t guid = (k == 0) ? 0x888u : 0x201u;
    uint32_t bKill = (k == 2) ? 1u : 0u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = guid; c.args[1] = bKill; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)guid; ts[3] = (int64_t)bKill;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB7B50u, "PETS_UnsummonPlayerPetByGuid_6FCB7B50_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* #17 0x6FCB7C20 PETS_UnsummonSameGroupPetTypes_6FCB7C20_113c (eax=pGame, stack=[pPlayerUnit, nPetType], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_mon_reg_ex(1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t pSlots = alloc_pet_slots(STAGE_UDATA0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    add_pet_slot_node(pSlots, 12u, 0x201u, 0u, 0u, 0u, 1u);
    if (k == 2) {
      stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, 4814u, 4812u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
      add_pet_slot_node(pSlots, 15u, 0x202u, 0u, 0u, 0u, 1u);
    }
    uint32_t petType = (k == 0) ? 1u : 11u;
    c = make_call(); c.eax = STAGE_GAME;
    c.nargs = 2u; c.args[0] = STAGE_UNIT0; c.args[1] = petType; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)petType;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB7C20u, "PETS_UnsummonSameGroupPetTypes_6FCB7C20_113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* #22 0x6FCB93A0 SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, (k == 2) ? 4816u : 4813u, 4813u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      U32(STAGE_PATH0 + 0x5Cu) = 1u;
      U32(STAGE_PATH0 + 0x60u) = 0x201u;
    }
    int32_t sk = (k == 0) ? -1 : 121;
    uint32_t slvl = (k == 2) ? 6u : 3u;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sk; c.args[1] = slvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = sk; ts[3] = (int64_t)slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB93A0u, "SKILLS_SrvDo_SpawnChargedMissileAtTargetUnit_6FCB93A0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* #23 0x6FCB94C0 SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c (ecx=pGame, edx=pCaster, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 5005u, 5005u, STAGE_CLIENT);
    U16(STAGE_PATH0 + 0x10u) = 5009u;
    U16(STAGE_PATH0 + 0x12u) = 5009u;
    if (k >= 1) attach_skill(STAGE_UNIT0, 121, (k == 2) ? 6 : 2);
    int32_t sk = (k == 0) ? -1 : 121;
    int32_t slvl = (k == 2) ? 6 : 2;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sk; c.args[1] = (uint32_t)slvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = sk; ts[3] = slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB94C0u, "SKILLS_SrvDo_SpawnLeapOrChargeProjectile_6FCB94C0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* #24 0x6FCB9D20 SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg_ex(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4811u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    int32_t sk = (k == 0) ? -1 : 106;
    int32_t slvl = (k == 2) ? 5 : 1;
    if (k >= 1) {
      uint32_t pSk = attach_skill(STAGE_UNIT0, 106, slvl);
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      U32(STAGE_PATH0 + 0x5Cu) = 1u;
      U32(STAGE_PATH0 + 0x60u) = 0x201u;
      U16(STAGE_PATH0 + 0x10u) = 4811u;
      U16(STAGE_PATH0 + 0x12u) = 4810u;
      if (k == 2) {
        U32(pSk + 0x0Cu) = 1u;
        U32(pSk + 0x18u) = 1u;
        U32(pSk + 0x1Cu) = 0x201u;
      }
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sk; c.args[1] = (uint32_t)slvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = sk; ts[3] = slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB9D20u, "SKILLS_SrvDo_ExecuteMultiStrikeMelee_6FCB9D20_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* #25 0x6FCBC070 PARTY_ForEachPartyMemberInSameLevel113c (eax=pPlayer, ebx=pGame, stack=[pfnCallback, pArg], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, (k == 2) ? 2u : 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM1, 1u, 0x102u, 1u, 4812u, 4812u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      uint32_t pSub = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      uint32_t pM0  = (uint32_t)(uintptr_t)bump_alloc(0x0Cu);
      uint32_t pM1  = (uint32_t)(uintptr_t)bump_alloc(0x0Cu);
      U16(pSub + 0x00u) = 1u;
      U32(pSub + 0x04u) = pM0;
      U32(pM0 + 0x00u)  = 0x101u;
      U32(pM0 + 0x04u)  = pM1;
      U32(pM1 + 0x00u)  = 0x102u;
      U32(STAGE_PARTYCTRL + 0x04u) = pSub;
      U32(STAGE_GAME + 0x1D2Cu)    = STAGE_PARTYCTRL;
      U16(STAGE_UDATA0 + 0x9Au)    = 1u;
      U16(STAGE_UDATA1 + 0x9Au)    = 1u;
    }
    uint32_t pCnt = STAGE_SCRATCH;
    U32(pCnt) = 0u;
    uint32_t cbVa = D2GAME_VA(0x9C000u) + (uint32_t)g_game_rebase;
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = STAGE_GAME;
    c.nargs = 2u; c.args[0] = cbVa; c.args[1] = pCnt; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)D2GAME_VA(0x9C000u); ts[3] = (int64_t)pCnt;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBC070u, "PARTY_ForEachPartyMemberInSameLevel113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* #27 0x6FCBCA60 AI_CheckApproachTauntSound113c (eax=pUnit, edi=pAiArgs, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 4814u, 4810u);
    if (k >= 1) U8(STAGE_UDATA1 + 0x16u) |= 0x08u;
    uint32_t pAiCtrl = U32(STAGE_UDATA1 + 0x2Cu);
    if (k == 2) U8(pAiCtrl + 0x08u) |= 0x10u;
    uint32_t pAiArgs = STAGE_SCRATCH;
    U32(pAiArgs + 0x00u) = pAiCtrl;
    U32(pAiArgs + 0x08u) = STAGE_UNIT0;
    U32(pAiArgs + 0x14u) = 5u;
    c = make_call(); c.eax = STAGE_UNIT1; c.edi = pAiArgs;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)pAiArgs; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBCA60u, "AI_CheckApproachTauntSound113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* #28 0x6FCBCB30 AI_FollowPackLeaderOrAttack113c (eax=pAiTickArgs, ecx=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 5010u, 5010u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x202u, 1u, (k == 2) ? 5045u : 5010u, 5010u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    U32(pAiGen + 0x0Cu) = (k == 0) ? 0xFFFFFFFFu : 0x202u;
    U32(pAiGen + 0x10u) = (k == 0) ? 0u : 1u;
    uint32_t pAiArgs = STAGE_SCRATCH;
    U32(pAiArgs + 0x00u) = pAiGen;
    c = make_call(); c.eax = pAiArgs; c.ecx = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)pAiArgs; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBCB30u, "AI_FollowPackLeaderOrAttack113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* #29 0x6FCBCCF0 AI_TryOpenNearbyClosedDoor113c (eax=pAiTickArgs, ecx=pUnit, edi=pGame, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4810u, 4810u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 13u, 0x301u, (k == 2) ? 0u : 2u, 4811u, 4810u, 0x1234u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    U16(STAGE_PATH0 + 0x54u) = (k >= 1) ? 0x800u : 0u;
    uint32_t pTbls = U32(D2COM_VA(0x99E1Cu) + g_com_rebase);
    uint32_t pMonStats2 = U32(pTbls + 0xA90u) + 1u * 0x134u;
    uint32_t pAiArgs = STAGE_SCRATCH;
    uint32_t pFakeMs2 = STAGE_SCRATCH + 0x40u;
    memcpy((void *)(uintptr_t)pFakeMs2, (const void *)(uintptr_t)pMonStats2, 0x40u);
    U8(pFakeMs2 + 0x0Cu) = (k >= 1) ? 0x08u : 0x00u;
    U32(pAiArgs + 0x1Cu) = pFakeMs2;
    c = make_call(); c.eax = pAiArgs; c.ecx = STAGE_UNIT0; c.edi = STAGE_GAME; c.calleePop = 0u;
    ts[0] = (int64_t)pAiArgs; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBCCF0u, "AI_TryOpenNearbyClosedDoor113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* #30 0x6FCBCFE0 AI_AcquireOrValidateCombatTarget113c (eax=pAiTickArgs, ecx=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 29u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 4820u, 4810u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t ppCli = (uint32_t)(uintptr_t)bump_alloc(8u);
    U32(ppCli) = STAGE_CLIENT;
    U32(STAGE_ROOM0 + 0x48u) = ppCli;
    U32(STAGE_ROOM0 + 0x78u) = 1u;
    uint32_t pAiCtrl = U32(STAGE_UDATA1 + 0x2Cu);
    uint32_t pAiArgs = STAGE_SCRATCH;
    U32(pAiArgs + 0x00u) = pAiCtrl;
    U32(pAiArgs + 0x08u) = (k == 0) ? 0u : STAGE_UNIT0;
    U32(pAiArgs + 0x14u) = (k == 1) ? 5u : 25u;
    if (k == 1) U8(STAGE_UDATA1 + 0x16u) |= 0x08u;
    c = make_call(); c.eax = pAiArgs; c.ecx = STAGE_UNIT1;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)pAiArgs; ts[1] = (int64_t)STAGE_UNIT1; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBCFE0u, "AI_AcquireOrValidateCombatTarget113c", k, lbl, &c, ts, 3u, 0xFFFFFFFFu, 0);
  }

  /* #31 0x6FCBD3B0 AI_RunMonsterAI113c (ecx=pGame, edx=pUnit, stack=[arg14, arg18], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_timer_queue();
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_mon_id_1, 0x201u, 2u, 5005u, 5005u);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    U32(pAiGen + 0x04u) = D2GAME_VA(0x9C990u) + (uint32_t)g_game_rebase;
    if (k == 1) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 21, 1);
    if (k == 2) U32(pAiGen + 0x04u) = D2GAME_VA(0x9CB00u) + (uint32_t)g_game_rebase;
    uint32_t u = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = u;
    c.nargs = 2u; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)u; ts[2] = 0; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBD3B0u, "AI_RunMonsterAI113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }



  /* #34 0x6FCBDC10 ROOM_ActivateRoomForClient113c (eax=pRoom, ebx=pClient, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 2u : 1u);
    stage_timer_queue();
    stage_mon_reg_ex((k == 2) ? 2u : 1u);
    U32(STAGE_ROOM0 + 0x54u) = 0x460u + (uint32_t)k;
    U32(STAGE_ROOM0 + 0x58u) = 0x488u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k == 1) {
      stage_unit_common(STAGE_UNIT1, 0u, STAGE_PATH1, STAGE_ROOM0, 5u, 3u, 0x501u, 0u, 4812u, 4812u, 0x2222u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    } else if (k == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x209u, 1u, 4812u, 4812u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    c = make_call(); c.eax = STAGE_ROOM0; c.ebx = STAGE_CLIENT;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_CLIENT; ts[1] = (int64_t)STAGE_ROOM0; ts[2] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBDC10u, "ROOM_ActivateRoomForClient113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* #35 0x6FCBDF40 ACT_WarpClientPlayerToActTown_6FCBDF40_113c (stack=[pGame, pClient, nTargetLevelId, nPortalType], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room_with_coll(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 40u);
    uint32_t pDrlg1 = (uint32_t)(uintptr_t)bump_alloc(0x500u);
    stage_act_slot(1u, STAGE_ACT1, STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 40u, pDrlg1);
    stage_timer_queue();
    stage_mon_reg_ex(1u);
    uint32_t pArena = STAGE_SCRATCH;
    U32(pArena + 0x08u) = 0x400u;
    U32(STAGE_GAME + 0x1D28u) = pArena;
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    if (k == 2) {
      stage_quest_node(4u, 0x80u);
      U32(STAGE_QUEST0 + 0xE0u) = 4u;
      U8(STAGE_QUESTEX0 + 0x50u) = 1u;
    }
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4823u, 4823u, STAGE_CLIENT);
    for (uint32_t d = 0u; d < 3u; d++) {
      uint32_t pNP = (uint32_t)(uintptr_t)bump_alloc(8u);
      uint32_t pNH = (uint32_t)(uintptr_t)bump_alloc(0x14u);
      uint32_t pNB = (uint32_t)(uintptr_t)bump_alloc(8u);
      U32(pNH + 0x00u) = pNB;
      U32(pNH + 0x04u) = 0x40u;
      U32(pNP + 0x00u) = pNH;
      U32(pNP + 0x04u) = pNH;
      U32(STAGE_UDATA0 + 0x60u + d * 4u) = pNP;
    }
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U32(STAGE_ROOM0 + 0x28u) = 1u;
    U8(STAGE_CLIENT + 0x1ACu) = (k == 0) ? 1u : 0u;
    uint32_t targetLvl = 40u;
    uint32_t pType = (k == 1) ? 0u : 1u;
    c = make_call();
    c.nargs = 4u; c.args[0] = STAGE_GAME; c.args[1] = STAGE_CLIENT; c.args[2] = targetLvl; c.args[3] = pType; c.calleePop = 0x10u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_CLIENT; ts[2] = (int64_t)targetLvl; ts[3] = (int64_t)pType;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBDF40u, "ACT_WarpClientPlayerToActTown_6FCBDF40_113c", k, lbl, &c, ts, 4u, 0x00000000u, (k == 0 ? 1 : 0));
  }

  /* #36 0x6FCBE170 PLAYER_ChangeLevelOrActTransition_6FCBE170_113c (eax=pPlayerUnit, edi=nTargetLevelId, stack=[pGame, bAllowCollisionFallback], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room_with_coll(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 40u);
    uint32_t pDrlg1 = (uint32_t)(uintptr_t)bump_alloc(0x500u);
    stage_act_slot(0u, STAGE_ACT0, STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u, STAGE_DRLG0);
    stage_act_slot(1u, STAGE_ACT1, STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 40u, pDrlg1);
    if (k >= 1) {
      uint32_t lvl2 = (k == 1) ? 2u : 3u;
      uint32_t pR2 = (uint32_t)(uintptr_t)bump_alloc(0x100u);
      uint32_t pRE2 = (uint32_t)(uintptr_t)bump_alloc(0x100u);
      uint32_t pL2 = (uint32_t)(uintptr_t)bump_alloc(0x200u);
      stage_room_with_coll(pR2, pRE2, pL2, lvl2);
      stage_act_slot(0u, STAGE_ACT0, pR2, pRE2, pL2, lvl2, STAGE_DRLG0);
      U32(STAGE_ACT0 + 0x10u) = STAGE_ROOM0;
      U32(pL2 + 0x1ACu) = STAGE_LEVEL0;
      U32(STAGE_DRLG0 + 0x47Cu) = pL2;
    }
    stage_timer_queue();
    stage_mon_reg_ex(1u);
    uint32_t pArena = STAGE_SCRATCH;
    U32(pArena + 0x08u) = 0x400u;
    U32(STAGE_GAME + 0x1D28u) = pArena;
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4823u, 4823u, STAGE_CLIENT);
    for (uint32_t d = 0u; d < 3u; d++) {
      uint32_t pNP = (uint32_t)(uintptr_t)bump_alloc(8u);
      uint32_t pNH = (uint32_t)(uintptr_t)bump_alloc(0x14u);
      uint32_t pNB = (uint32_t)(uintptr_t)bump_alloc(8u);
      U32(pNH + 0x00u) = pNB;
      U32(pNH + 0x04u) = 0x40u;
      U32(pNP + 0x00u) = pNH;
      U32(pNP + 0x04u) = pNH;
      U32(STAGE_UDATA0 + 0x60u + d * 4u) = pNP;
    }
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U32(STAGE_ROOM0 + 0x28u) = 1u;
    U8(STAGE_CLIENT + 0x1ACu) = 0u;
    uint32_t targetLvl = (k == 0) ? 1u : (k == 1) ? 2u : 3u;
    c = make_call(); c.eax = STAGE_UNIT0; c.edi = targetLvl;
    c.nargs = 2u; c.args[0] = STAGE_GAME; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)targetLvl; ts[2] = (int64_t)STAGE_GAME; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBE170u, "PLAYER_ChangeLevelOrActTransition_6FCBE170_113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* #37 0x6FCBE8E0 SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 143, 1);
    int32_t sk = (k == 0) ? -1 : (k == 1) ? 102 : 330;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sk; c.args[1] = 4u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = sk; ts[3] = 4;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBE8E0u, "SKILLS_DispatchStateOnSrvDoFuncForSkill_6FCBE8E0_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
  }

  /* #38 0x6FCBF2B0 D2GAME_MONSTER_ApplyMercStatsOnOwner113c (eax=pMonsterUnit, stack=[pOutStats], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    uint32_t monId = (k == 0) ? 271u : (k == 1) ? 419u : 428u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, monId, 0x201u, 1u, 4812u, 4812u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k == 2) attach_skill(STAGE_UNIT0, 247, 5);
    else if (k == 1) attach_skill(STAGE_UNIT0, 221, 3);
    if (k >= 1) {
      uint32_t pAiGen = U32(STAGE_UDATA1 + 0x28u);
      U32(pAiGen + 0x28u) = STAGE_GAME;
      U32(pAiGen + 0x2Cu) = 0x101u;
      U32(pAiGen + 0x30u) = 0u;
    }
    uint32_t pOutStats = STAGE_SCRATCH;
    c = make_call(); c.eax = STAGE_UNIT1;
    c.nargs = 1u; c.args[0] = pOutStats; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT1; ts[1] = (int64_t)pOutStats; ts[2] = (int64_t)D2GAME_VA(0xF829Cu);
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCBF2B0u, "D2GAME_MONSTER_ApplyMercStatsOnOwner113c", k, lbl, &c, ts, 3u, 0x00000000u, 0);
  }

  /* #40 0x6FCC0AD0 AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c (ecx=pGame, stack=[dwFilterFlags, pUnit, nRadius, pfnCallback, pCallbackArg], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    U16(STAGE_PATH0 + 0x10u) = 4810u;
    U16(STAGE_PATH0 + 0x12u) = 4810u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_mon_id_1, 0x201u, 1u, 4814u, 4810u);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t pStateCtx = STAGE_SCRATCH;
    U32(pStateCtx + 0x00u) = STAGE_GAME;
    U32(pStateCtx + 0x04u) = STAGE_UNIT0;
    U32(pStateCtx + 0x08u) = 0u;
    U32(pStateCtx + 0x10u) = 66u;
    U32(pStateCtx + 0x14u) = 120u;
    U32(pStateCtx + 0x18u) = 1u;
    S32(pStateCtx + 0x1Cu) = -1;
    U32(pStateCtx + 0x4Cu) = 9u;
    uint32_t cbVa = (k == 0) ? 0u : (D2GAME_VA(0x50250u) + (uint32_t)g_game_rebase);
    uint32_t radius = (k == 1) ? 1u : 15u;
    c = make_call(); c.ecx = STAGE_GAME;
    c.nargs = 5u; c.args[0] = 0x20002u; c.args[1] = STAGE_UNIT0; c.args[2] = radius; c.args[3] = cbVa; c.args[4] = pStateCtx;
    c.calleePop = 0x14u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = 0x20002; ts[2] = (int64_t)STAGE_UNIT0; ts[3] = (int64_t)radius;
    ts[4] = (k == 0) ? 0 : (int64_t)D2GAME_VA(0x50250u); ts[5] = (int64_t)pStateCtx;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC0AD0u, "AURA_ForEachUnitInTargetRadius_6FCC0AD0_113c", k, lbl, &c, ts, 6u, 0xFFFFFFFFu, 0);
  }

  /* #41 0x6FCC1E80 SKILLS_Event08_AuraPulseTick113c (ecx=pGame, edx=pUnit, stack=[nAuraSkillId, arg18], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    int32_t skId = 102;
    if (k == 0) {
      skId = -1;
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    } else if (k == 1) {
      skId = 102;
      attach_skill(STAGE_UNIT0, 102, 4);
      stage_prog_charge_state(STAGE_UNIT0, 35, 102, 4, 0, 0);
    } else {
      skId = 114;
      attach_skill(STAGE_UNIT0, 114, 6);
      stage_prog_charge_state(STAGE_UNIT0, 43, 114, 6, 0, 0);
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)skId; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = skId; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC1E80u, "SKILLS_Event08_AuraPulseTick113c", k, lbl, &c, ts, 4u, 0x00000000u, 0);
  }

  /* #39 0x6FCC0830 SKILLS_StartUsedSkill113c (esi=pUnit, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4810u, 4810u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8u, 200 << 8, 0);
    if (k >= 1) {
      int32_t sid = (k == 1) ? 36 : 42;
      uint32_t pSk = attach_skill(STAGE_UNIT0, sid, 2);
      U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
      U16(STAGE_PATH0 + 0x10u) = 4812u;
      U16(STAGE_PATH0 + 0x12u) = 4812u;
    }
    c = make_call(); c.esi = STAGE_UNIT0;
    c.nargs = 1u; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = (int64_t)STAGE_UNIT0; ts[1] = (int64_t)STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCC0830u, "SKILLS_StartUsedSkill113c", k, lbl, &c, ts, 2u, 0xFFFFFFFFu, 0);
  }

  /* 0x6FCB3D60 SKILLS_SpawnNovaRingOfSpiralProjectiles_6FCB3D60_113c (edx=nLowSeed, stack=[pGame, pOwner, nMissileId, nX, nY, nSkillId, nSkillLevel, nStep], ret 0x20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 4812u, 4812u, STAGE_CLIENT);
    uint32_t seedLo = 0x11112222u + (uint32_t)k * 0x10101u;
    uint32_t step = (k == 0) ? 32u : (k == 1) ? 16u : 8u;
    c = make_call(); c.edx = seedLo;
    c.nargs = 8u;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = 46u;
    c.args[3] = 4816u; c.args[4] = 4816u; c.args[5] = 259u; c.args[6] = 2u; c.args[7] = step;
    c.calleePop = 0x20u;
    ts[0] = (int64_t)seedLo; ts[1] = (int64_t)STAGE_GAME; ts[2] = (int64_t)STAGE_UNIT0;
    ts[3] = 46; ts[4] = 4816; ts[5] = 4816; ts[6] = 259; ts[7] = 2; ts[8] = (int64_t)step;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB3D60u, "SKILLS_SpawnNovaRingOfSpiralProjectiles_6FCB3D60_113c", k, lbl, &c, ts, 9u, 0x00000000u, 0);
  }

  /* 0x6FCB5980 SKILLS_SrvDo_Valkyrie_6FCB5980_113c (ecx=pGame, edx=pOwnerUnit, stack=[nSkillId, nSkillLevel], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_timer_queue();
    stage_mon_reg_ex(2u);
    uint32_t cls = (k == 2) ? 6u : 0u;
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x101u, 1u, 4810u, 4810u, STAGE_CLIENT);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = 4812u;
    U16(STAGE_PATH0 + 0x12u) = 4812u;
    int32_t sk = (k == 0) ? -1 : (k == 1) ? 32 : 268;
    int32_t slvl = (k == 2) ? 5 : 2;
    if (k >= 1) attach_skill(STAGE_UNIT0, sk, slvl);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2u; c.args[0] = (uint32_t)sk; c.args[1] = (uint32_t)slvl; c.calleePop = 8u;
    ts[0] = (int64_t)STAGE_GAME; ts[1] = (int64_t)STAGE_UNIT0; ts[2] = sk; ts[3] = slvl;
    snprintf(lbl, sizeof(lbl), "case_%d", k);
    run_and_emit(0x6FCB5980u, "SKILLS_SrvDo_Valkyrie_6FCB5980_113c", k, lbl, &c, ts, 4u, 0xFFFFFFFFu, 0);
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
    fprintf(stderr, "[k6-p13] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
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
    fprintf(stderr, "[k6-p13] LoadLibraryA failed\n");
    return 2;
  }

  g_com_rebase  = (intptr_t)g_hCom  - (intptr_t)D2COM_PREF_BASE;
  g_game_rebase = (intptr_t)g_hGame - (intptr_t)D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p13] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-p13] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p13] failed to open %s\n", outPath);
    return 5;
  }

  emit_batch_01();
  emit_batch_02();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p13] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
