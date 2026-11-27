/*
 * k6-p2-emitter.c — [K6-P2] Real-DLL D2Common 100.00% Closer + D2Game Branch Fixes & Lo-VA Emitter
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables + D2Common .data/.bss from
 * d2game-datatbls-113c.img, hooks external OS/Fog/Storm/D2Net runtime boundaries,
 * and executes 112 target VAs (>= 3 non-degenerate vectors per VA):
 *   - Group 1: ALL 31 remaining scenario-only D2Common.dll VAs (1,479 / 1,479 = 100.00%)
 *   - Group 2: 5 partial-branch D2Game.dll bug-fix VAs (0x6FC6A190, 0x6FCA3550, 0x6FC74810, 0x6FCFDDE0, 0x6FCFED30)
 *   - Group 3: 28 scenario-only D2Game.dll 0x6FC21xxx Lo-VAs
 *   - Group 4: 48 scenario-only D2Game.dll 0x6FC2Bxxx..0x6FC3Fxxx Lo-VAs
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
    fprintf(stderr, "[k6-p2] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
      fprintf(stderr, "[k6-p2] missing Fog.#%u\n", fogHooks[i].ord);
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
    fprintf(stderr, "[k6-p2] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p2] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_PREF_BASE + 0x99000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p2] short read at page %u\n", i);
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
        fprintf(stderr, "[k6-p2] stage json overflow\n");
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
            "[k6-p2] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-p2] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-p2] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-p2] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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

/* ============================================================================
 * GROUP 1: ALL 31 Remaining Scenario-Only D2Common.dll VAs (1,479 / 1,479 = 100.00%)
 * ============================================================================ */

static void emit_group_1_d2common_31(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];
  uint32_t pTables = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
  uint32_t pIscBase = U32(pTables + 0xBCCu);

  /* [C01] 0x6FD51080 UNITS_GetY (ecx=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 0) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5010u, 5025u, 101u);
    } else if (k == 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 2u, 0u, 5030u, 5045u, 102u);
    } else {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, STAGE_ROOM0, 1u, 1u, 3u, 1u, 0u, 0u, 103u);
    }
    c = make_call();
    c.ecx = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "units_get_y_k%d", k);
    run_and_emit(0x6FD51080u, "UNITS_GetY", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [C02] 0x6FD511E0 COMMON_MulDiv (eax=factor, edx=value, ecx=divisor, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    int32_t factor  = (k == 0) ? 0 : (k == 1 ? 150 : (k == 2 ? 0x20000 : -250));
    int32_t value   = (k == 0) ? 999 : (k == 1 ? 400 : (k == 2 ? 0x200000 : 1200));
    int32_t divisor = (k == 0) ? 0 : (k == 1 ? 100 : (k == 2 ? 0x40000 : 80));
    c = make_call();
    c.eax = (uint32_t)factor; c.edx = (uint32_t)value; c.ecx = (uint32_t)divisor;
    ts[0] = factor; ts[1] = value; ts[2] = divisor;
    snprintf(lbl, sizeof(lbl), "common_muldiv_k%d", k);
    run_and_emit(0x6FD511E0u, "COMMON_MulDiv", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [C03] 0x6FD7F370 UNIT_Alloc (s0=pPool, s1=uType, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t uType = (k == 0) ? 0u : (k == 1 ? 1u : 4u);
    c = make_call();
    c.nargs = 2; c.args[0] = 0u; c.args[1] = uType; c.calleePop = 8u;
    ts[0] = 0; ts[1] = (int64_t)uType;
    snprintf(lbl, sizeof(lbl), "unit_alloc_k%d", k);
    run_and_emit(0x6FD7F370u, "UNIT_Alloc", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [C04] 0x6FD83920 UNITS_ChangeAnimMode (s0=pUnit, s1=nMode, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 0) ? 0u : (k == 1 ? 1u : 4u);
    uint32_t mode  = (k == 0) ? 1u : (k == 1 ? 2u : 3u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 10u + (uint32_t)k, 0u, 5000u, 5000u, 201u + (uint32_t)k);
    c = make_call();
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = mode; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = (int64_t)mode;
    snprintf(lbl, sizeof(lbl), "units_change_anim_mode_k%d", k);
    run_and_emit(0x6FD83920u, "UNITS_ChangeAnimMode", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [C05] 0x6FD83C20 STATES_CheckStateMaskOnUnit (eax=pUnit, ecx=pMasks, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 301u);
    uint32_t pMasks = STAGE_SCRATCH;
    U32(pMasks + 0x00u) = (k == 2) ? 0x00000000u : 0x00000002u;
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 1, 1);
    }
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.eax = uArg; c.ecx = pMasks;
    ts[0] = uArg; ts[1] = pMasks;
    snprintf(lbl, sizeof(lbl), "states_check_mask_k%d", k);
    run_and_emit(0x6FD83C20u, "STATES_CheckStateMaskOnUnit", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [C06] 0x6FD83CD0 STATES_CheckState (s0=pUnit, s1=stateId, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 311u);
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 2, 1);
    }
    int32_t st = (k == 0) ? -1 : 2;
    c = make_call();
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = (uint32_t)st; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = st;
    snprintf(lbl, sizeof(lbl), "states_check_state_k%d", k);
    run_and_emit(0x6FD83CD0u, "STATES_CheckState", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [C07] 0x6FD84450 STATES_ClearGfxStateFlag (s0=pUnit, s1=stateId, s2=bSet, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 321u);
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 2, 1);
    }
    int32_t st = (k == 2) ? 35 : 2;
    int32_t bSet = (k == 1) ? 0 : 1;
    c = make_call();
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = (uint32_t)st; c.args[2] = (uint32_t)bSet; c.calleePop = 0xCu;
    ts[0] = STAGE_UNIT0; ts[1] = st; ts[2] = bSet;
    snprintf(lbl, sizeof(lbl), "states_clear_gfx_flag_k%d", k);
    run_and_emit(0x6FD84450u, "STATES_ClearGfxStateFlag", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [C08] 0x6FD88160 STATLIST_FindModStatInsertPos (eax=pModHdr, edi=dwKey, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pModHdr = STAGE_SCRATCH;
    uint32_t pArr    = STAGE_SCRATCH + 0x20u;
    U32(pModHdr + 0x00u) = pArr;
    U16(pModHdr + 0x04u) = 3u;
    U16(pModHdr + 0x06u) = 4u;
    U32(pArr + 0u) = 0x00020000u;
    U32(pArr + 4u) = 0x00070000u;
    U32(pArr + 8u) = 0x000C0000u;
    uint32_t key = (k == 0) ? 0x00010000u : (k == 1 ? 0x00070000u : 0x00200000u);
    c = make_call();
    c.eax = pModHdr; c.edi = key;
    ts[0] = pModHdr; ts[1] = (int64_t)key;
    snprintf(lbl, sizeof(lbl), "statlist_find_mod_pos_k%d", k);
    run_and_emit(0x6FD88160u, "STATLIST_FindModStatInsertPos", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [C09] 0x6FD881A0 STATLIST_RemoveStatSlot (esi=pArrayHdr, edx=pEntry, s0=0, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 331u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 30, 0);
    uint32_t pListEx = U32(STAGE_UNIT0 + 0x5Cu);
    uint32_t pArrHdr = pListEx + 0x24u;
    uint32_t pBase   = U32(pArrHdr);
    uint32_t pEntry  = pBase + (uint32_t)k * 8u;
    c = make_call();
    c.esi = pArrHdr; c.edx = pEntry; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = pArrHdr; ts[1] = pEntry;
    snprintf(lbl, sizeof(lbl), "statlist_remove_slot_k%d", k);
    run_and_emit(0x6FD881A0u, "STATLIST_RemoveStatSlot", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [C10] 0x6FD88270 STATLIST_FindInsertPos (eax=pArrayHdr, edi=dwKey, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 341u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 30, 0);
    uint32_t pArrHdr = U32(STAGE_UNIT0 + 0x5Cu) + 0x24u;
    uint32_t key = (k == 0) ? 0x00000000u : (k == 1 ? 0x00070000u : 0x000C0000u);
    c = make_call();
    c.eax = pArrHdr; c.edi = key;
    ts[0] = pArrHdr; ts[1] = (int64_t)key;
    snprintf(lbl, sizeof(lbl), "statlist_find_ins_pos_k%d", k);
    run_and_emit(0x6FD88270u, "STATLIST_FindInsertPos", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [C11] 0x6FD882B0 STATLIST_FindStatIndex (eax=pArrayHdr, edi=dwKey, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 351u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 30, 0);
    uint32_t pArrHdr = U32(STAGE_UNIT0 + 0x5Cu) + 0x24u;
    uint32_t key = (k == 0) ? 0x00020000u : (k == 1 ? 0x00070000u : 0x00090000u);
    c = make_call();
    c.eax = pArrHdr; c.edi = key;
    ts[0] = pArrHdr; ts[1] = (int64_t)key;
    snprintf(lbl, sizeof(lbl), "statlist_find_idx_k%d", k);
    run_and_emit(0x6FD882B0u, "STATLIST_FindStatIndex", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [C12] 0x6FD88550 STATLIST_RecordModStat (ebx=pListEx, eax=dwKey, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 361u);
    uint32_t pListEx = U32(STAGE_UNIT0 + 0x5Cu);
    if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 15, 0);
    }
    uint32_t key = (k == 1) ? 0x00070000u : 0x00000000u;
    c = make_call();
    c.ebx = pListEx; c.eax = key;
    ts[0] = pListEx; ts[1] = (int64_t)key;
    snprintf(lbl, sizeof(lbl), "statlist_record_mod_k%d", k);
    run_and_emit(0x6FD88550u, "STATLIST_RecordModStat", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [C13] 0x6FD88640 STATLIST_InsertStatSlot (eax=dwKey, esi=pArrayHdr, s0=0, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 371u);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 50, 0);
    }
    uint32_t pArrHdr = U32(STAGE_UNIT0 + 0x5Cu) + 0x24u;
    uint32_t key = (k == 0) ? 0x00020000u : (k == 1 ? 0x00010000u : 0x000C0000u);
    c = make_call();
    c.eax = key; c.esi = pArrHdr; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = pArrHdr; ts[1] = (int64_t)key;
    snprintf(lbl, sizeof(lbl), "statlist_insert_slot_k%d", k);
    run_and_emit(0x6FD88640u, "STATLIST_InsertStatSlot", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [C14] 0x6FD889E0 STATLIST_AddFullStatDelta (ebx=pListEx, s0=dwKey, s1=delta, s2=pIsc, s3=pItem, ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 381u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 20, 0);
    uint32_t pListEx = U32(STAGE_UNIT0 + 0x5Cu);
    int32_t delta = (k == 0) ? 0 : (k == 1 ? 15 : -20);
    uint32_t pIsc0 = pIscBase + 0u * 0x144u;
    c = make_call();
    c.ebx = pListEx;
    c.nargs = 4; c.args[0] = 0u; c.args[1] = (uint32_t)delta; c.args[2] = pIsc0; c.args[3] = 0u; c.calleePop = 0x10u;
    ts[0] = pListEx; ts[1] = 0; ts[2] = delta; ts[3] = pIsc0; ts[4] = 0;
    snprintf(lbl, sizeof(lbl), "statlist_add_full_delta_k%d", k);
    run_and_emit(0x6FD889E0u, "STATLIST_AddFullStatDelta", k, lbl, &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [C15] 0x6FD88A80 STATLIST_GetTotalStatWithMin (ebx=pList, edi=dwKey, s0=pIsc, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 391u);
    if (k == 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 35, 0);
    if (k == 2) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, -5, 0);
    uint32_t pList = U32(STAGE_UNIT0 + 0x5Cu);
    uint32_t pIsc0 = pIscBase + 0u * 0x144u;
    c = make_call();
    c.ebx = pList; c.edi = 0u; c.nargs = 1; c.args[0] = pIsc0; c.calleePop = 4u;
    ts[0] = pList; ts[1] = 0; ts[2] = pIsc0;
    snprintf(lbl, sizeof(lbl), "statlist_total_with_min_k%d", k);
    run_and_emit(0x6FD88A80u, "STATLIST_GetTotalStatWithMin", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [C16] 0x6FD88B00 STATLIST_GetBaseStatWithMin (ebx=pList, edi=dwKey, s0=pIsc, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 401u);
    if (k == 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 42, 0);
    if (k == 2) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, -10, 0);
    uint32_t pList = U32(STAGE_UNIT0 + 0x5Cu);
    uint32_t pIsc2 = pIscBase + 2u * 0x144u;
    c = make_call();
    c.ebx = pList; c.edi = 0x00020000u; c.nargs = 1; c.args[0] = pIsc2; c.calleePop = 4u;
    ts[0] = pList; ts[1] = 0x00020000; ts[2] = pIsc2;
    snprintf(lbl, sizeof(lbl), "statlist_base_with_min_k%d", k);
    run_and_emit(0x6FD88B00u, "STATLIST_GetBaseStatWithMin", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [C17] 0x6FD88C20 STATLIST_GetUnitBaseStat (s0=pUnit, s1=statId, s2=layer, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 411u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 3, 55, 0);
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    int32_t stId  = (k == 2) ? 9 : 3;
    c = make_call();
    c.nargs = 3; c.args[0] = uArg; c.args[1] = (uint32_t)stId; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = uArg; ts[1] = stId; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "statlist_unit_base_stat_k%d", k);
    run_and_emit(0x6FD88C20u, "STATLIST_GetUnitBaseStat", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [C18] 0x6FD88CD0 STATLIST_SumDirectAndSubLists (eax=dwKey, ecx=pList, s0=pIsc, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 421u);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 25, 0);
    }
    if (k == 2) {
      void *pSub = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
      fn_SetStatIfValid(pSub, 0, 15, 0u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 1);
    }
    uint32_t pList = U32(STAGE_UNIT0 + 0x5Cu);
    uint32_t pIsc0 = pIscBase + 0u * 0x144u;
    c = make_call();
    c.eax = 0u; c.ecx = pList; c.nargs = 1; c.args[0] = pIsc0; c.calleePop = 4u;
    ts[0] = pList; ts[1] = 0; ts[2] = pIsc0;
    snprintf(lbl, sizeof(lbl), "statlist_sum_direct_sub_k%d", k);
    run_and_emit(0x6FD88CD0u, "STATLIST_SumDirectAndSubLists", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [C19] 0x6FD891F0 UNIT_GetAlignment (s0=pUnit, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 0) ? 0u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 1u, 1u, 5000u, 5000u, 431u);
    if (k == 2) {
      void *pSub = fn_AllocStatList(NULL, 0u, 0u, 1, 1);
      fn_SetStatListState(pSub, 0xAC); /* alignment 2 */
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 0);
    }
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.nargs = 1; c.args[0] = uArg; c.calleePop = 4u;
    ts[0] = uArg;
    snprintf(lbl, sizeof(lbl), "unit_get_alignment_k%d", k);
    run_and_emit(0x6FD891F0u, "UNIT_GetAlignment", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [C20] 0x6FD89530 EvalStatWithOps (ecx=pList, edx=dwKey, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 441u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, (k == 1) ? 30 : 45, 0);
    uint32_t pList = U32(STAGE_UNIT0 + 0x5Cu);
    uint32_t key = (k == 0) ? 0xFFFF0000u : 0x00000000u;
    c = make_call();
    c.ecx = pList; c.edx = key;
    ts[0] = pList; ts[1] = (int64_t)key;
    snprintf(lbl, sizeof(lbl), "eval_stat_with_ops_k%d", k);
    run_and_emit(0x6FD89530u, "EvalStatWithOps", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [C21] 0x6FD89CE0 STATLIST_RecomputeExStat (ecx=pListEx, edx=dwKey, s0=pIsc, s1=pItem, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 451u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 10 + k * 15, 0);
    uint32_t pListEx = U32(STAGE_UNIT0 + 0x5Cu);
    uint32_t pIsc0 = pIscBase + 0u * 0x144u;
    c = make_call();
    c.ecx = pListEx; c.edx = 0u; c.nargs = 2; c.args[0] = pIsc0; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = pListEx; ts[1] = 0; ts[2] = pIsc0; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "statlist_recompute_ex_k%d", k);
    run_and_emit(0x6FD89CE0u, "STATLIST_RecomputeExStat", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [C22] 0x6FD89F70 STATLIST_PropagateDelta (eax=pStartList, edi=dwKey, s0=delta, s1=pItem, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 461u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 4, 20, 0);
    uint32_t pListEx = U32(STAGE_UNIT0 + 0x5Cu);
    uint32_t key   = (k == 2) ? 0u : (4u << 16);
    int32_t  delta = (k == 0) ? 0 : (k == 1 ? 12 : 15);
    if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 20, 0);
      uint32_t pBaseArr = U32(pListEx + 0x24u);
      S32(pBaseArr + 4u) = 35;
    }
    c = make_call();
    c.eax = pListEx; c.edi = key; c.nargs = 2; c.args[0] = (uint32_t)delta; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = pListEx; ts[1] = (int64_t)key; ts[2] = delta; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "statlist_propagate_delta_k%d", k);
    run_and_emit(0x6FD89F70u, "STATLIST_PropagateDelta", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* [C23] 0x6FD8A280 STATLIST_SetStat (s0=pList, s1=statId, s2=val, s3=layer, ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 471u);
    uint32_t pList = (k == 0) ? 0u : U32(STAGE_UNIT0 + 0x5Cu);
    int32_t val = (k == 1) ? 33 : 0;
    c = make_call();
    c.nargs = 4; c.args[0] = pList; c.args[1] = 2u; c.args[2] = (uint32_t)val; c.args[3] = 0u; c.calleePop = 0x10u;
    ts[0] = pList; ts[1] = 2; ts[2] = val; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "statlist_set_stat_k%d", k);
    run_and_emit(0x6FD8A280u, "STATLIST_SetStat", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [C24] 0x6FD8A3B0 STATLIST_UnlinkSubListInternal (s0=pSubList, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 481u);
    uint32_t pSubAddr = 0u;
    if (k >= 1) {
      void *pSub = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
      fn_SetStatIfValid(pSub, 0, (k == 1) ? 10 : 25, 0u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 1);
      pSubAddr = (uint32_t)(uintptr_t)pSub;
    }
    c = make_call();
    c.nargs = 1; c.args[0] = pSubAddr; c.calleePop = 4u;
    ts[0] = pSubAddr;
    snprintf(lbl, sizeof(lbl), "statlist_unlink_internal_k%d", k);
    run_and_emit(0x6FD8A3B0u, "STATLIST_UnlinkSubListInternal", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [C25] 0x6FD8A5F0 STATLIST_UnlinkSubList (s0=pUnit, s1=pSubList, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 491u);
    uint32_t pSubAddr = 0u;
    if (k >= 1) {
      void *pSub = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
      fn_SetStatIfValid(pSub, 2, (k == 1) ? 12 : 30, 0u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 1);
      pSubAddr = (uint32_t)(uintptr_t)pSub;
    }
    c = make_call();
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = pSubAddr; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = pSubAddr;
    snprintf(lbl, sizeof(lbl), "statlist_unlink_sublist_k%d", k);
    run_and_emit(0x6FD8A5F0u, "STATLIST_UnlinkSubList", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [C26] 0x6FD8AFD0 ROOM_RecordMonsterDeath (s0=pRoom, s1=dwUnitId, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U8(STAGE_ROOM0 + 0x14u) = (uint8_t)k;
    uint32_t rArg = (k == 0) ? 0u : STAGE_ROOM0;
    uint32_t uid  = 0x770u + (uint32_t)k;
    c = make_call();
    c.nargs = 2; c.args[0] = rArg; c.args[1] = uid; c.calleePop = 8u;
    ts[0] = rArg; ts[1] = (int64_t)uid;
    snprintf(lbl, sizeof(lbl), "room_record_mon_death_k%d", k);
    run_and_emit(0x6FD8AFD0u, "ROOM_RecordMonsterDeath", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [C27] 0x6FD8B650 STATLIST_GetUnitAlignment / ROOM_DecrementAlliedCount (s0=pRoom, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(STAGE_ROOM0 + 0x28u) = (k == 1) ? 3u : 0u;
    uint32_t rArg = (k == 0) ? 0u : STAGE_ROOM0;
    c = make_call();
    c.nargs = 1; c.args[0] = rArg; c.calleePop = 4u;
    ts[0] = rArg;
    snprintf(lbl, sizeof(lbl), "room_dec_allied_k%d", k);
    run_and_emit(0x6FD8B650u, "STATLIST_GetUnitAlignment", k, lbl, &c, ts, 1, 0u, (k == 2 ? 1 : 0));
  }

  /* [C28] 0x6FDB63B0 UNITROOM_ClearUpdateQueue (s0=pRoom, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 501u);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 502u);
      U32(STAGE_UNIT0 + 0xC4u) |= 0x2000u;
      U32(STAGE_UNIT1 + 0xC4u) |= 0x2000u;
      U32(STAGE_UNIT0 + 0xE0u)  = STAGE_UNIT1;
      U32(STAGE_ROOM0 + 0x1Cu)  = STAGE_UNIT0;
    }
    uint32_t rArg = (k == 0) ? 0u : STAGE_ROOM0;
    c = make_call();
    c.nargs = 1; c.args[0] = rArg; c.calleePop = 4u;
    ts[0] = rArg;
    snprintf(lbl, sizeof(lbl), "unitroom_clear_queue_k%d", k);
    run_and_emit(0x6FDB63B0u, "UNITROOM_ClearUpdateQueue", k, lbl, &c, ts, 1, 0u, (k == 0 ? 1 : 0));
  }

  /* [C29] 0x6FDB65C0 UNITROOM_RefreshUnit (s0=pUnit, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, (k == 1) ? 0u : STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 511u);
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.nargs = 1; c.args[0] = uArg; c.calleePop = 4u;
    ts[0] = uArg;
    snprintf(lbl, sizeof(lbl), "unitroom_refresh_unit_k%d", k);
    run_and_emit(0x6FDB65C0u, "UNITROOM_RefreshUnit", k, lbl, &c, ts, 1, 0u, (k == 0 ? 1 : 0));
  }

  /* [C30] 0x6FDB6700 UNITROOM_RemoveUnitFromRoom (s0=pUnit, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 521u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
      U32(STAGE_ROOM0 + 0x28u) = 2u;
    } else if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 522u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    }
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.nargs = 1; c.args[0] = uArg; c.calleePop = 4u;
    ts[0] = uArg;
    snprintf(lbl, sizeof(lbl), "unitroom_remove_unit_k%d", k);
    run_and_emit(0x6FDB6700u, "UNITROOM_RemoveUnitFromRoom", k, lbl, &c, ts, 1, 0u, (k == 0 ? 1 : 0));
  }

  /* [C31] 0x6FDB6800 UNITROOM_AddUnitToRoom (s0=pUnit, s1=pRoom, s2=bUnused, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 1) ? 0u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 10u + (uint32_t)k, 1u, 5000u, 5000u, 531u + (uint32_t)k);
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.nargs = 3; c.args[0] = uArg; c.args[1] = STAGE_ROOM0; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = uArg; ts[1] = STAGE_ROOM0; ts[2] = 0;
    snprintf(lbl, sizeof(lbl), "unitroom_add_unit_k%d", k);
    run_and_emit(0x6FDB6800u, "UNITROOM_AddUnitToRoom", k, lbl, &c, ts, 3, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }
}

/* ============================================================================
 * GROUP 2: 5 Partial-Branch D2Game.dll Bug-Fix VAs (4 branch-complete cases each)
 * ============================================================================ */

static void emit_group_2_d2game_fixes(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* [F01] 0x6FC6A190 CLIENTS_AppendSaveDataChunk_6FC6A190_113c
   * (eax=dwClientId, s0=pChunkData, s1=nChunkSize, s2=nTotalSize, s3=dwSaveArg178, ret 0x10) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x1107B8u), 0, 0x400u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C18u)) = 1u;
    add_extra_cap(D2GAME_PREF_BASE + 0x111C18u, 4u);
    add_extra_cap(D2GAME_PREF_BASE + 0x1107B8u, 0x10u);

    uint32_t pPreBuf = STAGE_SCRATCH + 0x100u;
    uint32_t pChunk  = STAGE_SCRATCH + 0x300u;
    for (uint32_t i = 0; i < 0xC0u; i++) {
      U8(pChunk + i) = (uint8_t)(0x21u + i * 3u + (uint32_t)k);
    }

    U32(STAGE_CLIENT + 0x00u)  = 2u;
    U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
    U32(game_global_live(D2GAME_PREF_BASE + 0x1107B8u + 8u)) = STAGE_CLIENT;

    uint32_t curLen  = 0u;
    uint32_t chunkSz = 0x40u;
    uint32_t totalSz = 0xC0u;
    if (k == 0) {
      /* curLen == 0, partial chunk -> Fog.#10045 heap alloc! */
      curLen = 0u; chunkSz = 0x40u; totalSz = 0xC0u;
    } else if (k == 1) {
      /* curLen == 0, single-chunk complete -> heap alloc + header checksum + flag 0x08! */
      curLen = 0u; chunkSz = 0xC0u; totalSz = 0xC0u;
    } else if (k == 2) {
      /* curLen > 0, second chunk completes save */
      curLen = 0x80u; chunkSz = 0x40u; totalSz = 0xC0u;
      U32(STAGE_CLIENT + 0x17Cu) = pPreBuf;
      U32(STAGE_CLIENT + 0x180u) = curLen;
      U32(pPreBuf + 0x00u) = 0x55AA55AAu;
      U32(pPreBuf + 0x04u) = 0x00000060u;
      U32(pPreBuf + 0x7Cu) = 0x12345678u;
    } else {
      /* curLen + chunkSz > totalSz -> Fog.#10024 assert line 0xB1B! */
      curLen = 0xA0u; chunkSz = 0x40u; totalSz = 0xC0u;
      U32(STAGE_CLIENT + 0x17Cu) = pPreBuf;
      U32(STAGE_CLIENT + 0x180u) = curLen;
    }
    c = make_call();
    c.eax = 2u;
    c.nargs = 4;
    c.args[0] = pChunk; c.args[1] = chunkSz; c.args[2] = totalSz; c.args[3] = 0x2200u + (uint32_t)k;
    c.calleePop = 0x10u;
    ts[0] = 2; ts[1] = pChunk; ts[2] = (int64_t)chunkSz; ts[3] = (int64_t)totalSz; ts[4] = 0x2200 + k;
    snprintf(lbl, sizeof(lbl), "append_save_chunk_fix_k%d", k);
    run_and_emit(0x6FC6A190u, "CLIENTS_AppendSaveDataChunk_6FC6A190_113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, (k == 3 ? 1 : 0));
  }

  /* [F02] 0x6FCA3550 AI_Skeleton113c (ecx=pGame, edx=pUnit, s0=pAiArgs, ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 650u, 1u, 5006u, 5006u, 0x51000001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5006u, 0x51000022u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);

    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pMonTxt = STAGE_SCRATCH + 0x200u;
    uint32_t pAiArgs = STAGE_SCRATCH;
    U32(pAiArgs + 0x00u) = pAiCtrl;
    U32(pAiArgs + 0x08u) = STAGE_UNIT1;
    U32(pAiArgs + 0x1Cu) = pMonTxt;

    if (k == 0) {
      /* bInMelee == 1, aip3 == 0, aip4 == 15 -> melee retreat AI_FleeFrom(pUnit, pTarget, 4, 1)! */
      U32(pAiArgs + 0x14u) = 2u;
      U32(pAiArgs + 0x18u) = 1u;
      U16(pMonTxt + 0x62u) = 0u;
      U16(pMonTxt + 0x68u) = 15u;
    } else if (k == 1) {
      /* bInMelee == 1, aip3 == 100 -> melee startMode4()! */
      U32(pAiArgs + 0x14u) = 2u;
      U32(pAiArgs + 0x18u) = 1u;
      U16(pMonTxt + 0x62u) = 100u;
    } else if (k == 2) {
      /* bInMelee == 0, nDist == 2 (<= 3), aip1 == 0, aip4 == 20 -> close-range AI_FleeFrom! */
      U32(pAiArgs + 0x14u) = 2u;
      U32(pAiArgs + 0x18u) = 0u;
      U16(pMonTxt + 0x56u) = 0u;
      U16(pMonTxt + 0x68u) = 20u;
    } else {
      /* bInMelee == 0, nDist == 8, aip1 == 100 -> approach target! */
      U32(pAiArgs + 0x14u) = 8u;
      U32(pAiArgs + 0x18u) = 0u;
      U16(pMonTxt + 0x56u) = 100u;
      U16(pMonTxt + 0x6Eu) = 12u;
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = pAiArgs; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pAiArgs;
    snprintf(lbl, sizeof(lbl), "ai_skeleton_fix_k%d", k);
    run_and_emit(0x6FCA3550u, "AI_Skeleton113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [F03] 0x6FC74810 ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c
   * (eax=pBitstream, ecx=pGame, s0=pOwnerUnit, s1=nSaveVersion, s2=nMaxBufferSize, s3=bIsMercOrDirect, s4=pOutBytesRead, ret 0x14) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5006u, 5006u, 0x61000001u + (uint32_t)k);
    fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);

    uint32_t pStream   = STAGE_SCRATCH;
    uint32_t pOutBytes = STAGE_SCRATCH + 0x300u;
    U32(pOutBytes)     = 0xBBBBBBBBu;
    uint32_t maxBufSz  = 0x80u;
    uint32_t bMerc     = 1u;

    if (k == 0) {
      /* Bad magic -> 0x0E */
      U16(pStream + 0x00u) = 0x1234u;
      maxBufSz = 4u;
    } else if (k == 1) {
      /* Truncated/zeroed JM stream with nItemCount=1 -> returns 0x0E cleanly without OOB! */
      U16(pStream + 0x00u) = 0x4D4Au;
      U16(pStream + 0x02u) = 1u;
      maxBufSz = 8u;
    } else if (k == 2) {
      /* Valid JM stream with 0 items -> returns 0, outBytes = 4 */
      U16(pStream + 0x00u) = 0x4D4Au;
      U16(pStream + 0x02u) = 0u;
      maxBufSz = 16u;
    } else {
      /* Valid JM stream with 1 real serialized item (inventory page 0, mode 0)! */
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 55u, 0u, 2u, 0u, 0u, 0x61000099u);
      U8(STAGE_UDATA1 + 0x45u) = 0u; /* nInvPage = 0 (grid) */
      U16(pStream + 0x00u) = 0x4D4Au;
      U16(pStream + 0x02u) = 1u;
      int32_t nSer = fn_SerializeItemToBuf((void *)(uintptr_t)STAGE_UNIT1, (void *)(uintptr_t)(pStream + 4u), 0x200, 1, 1, 0);
      maxBufSz = 4u + (uint32_t)nSer;
    }
    c = make_call();
    c.eax = pStream; c.ecx = STAGE_GAME;
    c.nargs = 5;
    c.args[0] = STAGE_UNIT0; c.args[1] = 0x60u; c.args[2] = maxBufSz; c.args[3] = bMerc; c.args[4] = pOutBytes;
    c.calleePop = 0x14u;
    ts[0] = pStream; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0;
    ts[3] = 0x60; ts[4] = (int64_t)maxBufSz; ts[5] = (int64_t)bMerc; ts[6] = pOutBytes;
    snprintf(lbl, sizeof(lbl), "deserialize_jm_fix_k%d", k);
    run_and_emit(0x6FC74810u, "ITEMS_DeserializeAndPlaceItemListFromJMStream_6FC74810_113c", k, lbl, &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [F04] 0x6FCFDDE0 SUNITDMG_AllocCombat113c
   * (eax=pAttacker, edi=pDmg, ecx=srcDam, s0=pGame, s1=pDefender, ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5004u, 5004u, 0x71000001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5005u, 5004u, 0x71000022u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 10, 0); /* mindamage */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 20, 0); /* maxdamage */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 48, 8, 0);  /* firemindam */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 49, 12, 0); /* firemaxdam */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 31, 10, 0); /* armorclass */

    uint32_t pAtt = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t srcDam = 0x80u;
    if (k == 1) {
      /* (dwHitFlags & 2) != 0 -> pre-populated physical damage */
      U32(STAGE_DMG + 0x00u) = 2u;
      U32(STAGE_DMG + 0x08u) = 15u << 8;
    } else if (k == 2) {
      /* (dwHitFlags & 2) == 0, srcDam = 128 -> computes physical + elemental via 0x6FCFD450 + 0x6FCFC0B0! */
      U32(STAGE_DMG + 0x00u) = 0x20u;
      srcDam = 128u;
    } else if (k == 3) {
      /* (dwHitFlags & 2) == 0, srcDam = 64 (half weapon damage)! */
      U32(STAGE_DMG + 0x00u) = 0x20u;
      srcDam = 64u;
    }
    c = make_call();
    c.eax = pAtt; c.edi = STAGE_DMG; c.ecx = srcDam;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = pAtt; ts[2] = STAGE_UNIT1; ts[3] = STAGE_DMG; ts[4] = (int64_t)srcDam;
    snprintf(lbl, sizeof(lbl), "sunitdmg_alloc_combat_k%d", k);
    run_and_emit(0x6FCFDDE0u, "SUNITDMG_AllocCombat113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [F05] 0x6FCFED30 SUNITDMG_ExecuteEvents113c
   * (s0=pGame, s1=pAttacker, s2=pDefender, ret 0xC — void in x86, retMask=0) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint16_t defX = (k == 1) ? 5020u : 5005u; /* k=1 is out of melee reach -> D2Common.#11138 gate! */
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5004u, 5004u, 0x72000001u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, defX, 5004u, 0x72000022u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 200 << 8, 0);

    if (k >= 1) {
      uint32_t pCombat = (uint32_t)(uintptr_t)bump_alloc(0x88u);
      U32(pCombat + 0x00u) = STAGE_GAME;
      U32(pCombat + 0x04u) = 1u;   /* dwAttackerType */
      U32(pCombat + 0x08u) = 10u;  /* dwAttackerId */
      U32(pCombat + 0x0Cu) = 0u;   /* dwDefenderType */
      U32(pCombat + 0x10u) = 1u;   /* dwDefenderId */
      /* D2DamageStrc at pCombat + 0x14 */
      U32(pCombat + 0x14u + 0x00u) = (k == 3) ? 0x01u : 0x21u; /* k=3 ranged/non-melee, k=1,2 melee 0x20 + hit 0x01 */
      U16(pCombat + 0x14u + 0x04u) = 0x05u; /* resultFlags: hit */
      U32(pCombat + 0x14u + 0x08u) = 12u << 8;
      U32(pCombat + 0x14u + 0x40u) = 12u << 8; /* dwDmgTotal */
      U32(pCombat + 0x80u) = (k == 1) ? 1u : 0u; /* bCheckMeleeRange = 1 for k=1! */
      U32(STAGE_UNIT0 + 0x78u) = pCombat;
    }
    c = make_call();
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.calleePop = 0xCu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "sunitdmg_exec_events_k%d", k);
    run_and_emit(0x6FCFED30u, "SUNITDMG_ExecuteEvents113c", k, lbl, &c, ts, 3, 0u, 0);
  }
}

/* ============================================================================
 * GROUP 3: 28 Scenario-Only D2Game.dll 0x6FC21xxx Lo-VAs
 * ============================================================================ */

static void emit_group_3_d2game_6fc21xxx(void) {
  X86CallSpec c;
  int64_t ts[12];
  char lbl[64];
  uint32_t pTables  = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
  uint32_t pMonBase = U32(pTables + 0xA78u);
  uint32_t nMonCnt  = U32(pTables + 0xA80u);

  uint32_t monWithProp = 0u;
  uint32_t monWithSeq  = 0u;
  for (uint32_t id = 0; id < nMonCnt; id++) {
    uint32_t pRec = pMonBase + id * 0x1A8u;
    if (!monWithProp && S16(pRec + 0x1Au) >= 0) monWithProp = id;
    if (!monWithSeq  && S16(pRec + 0x2Au) >= 0) monWithSeq  = id;
    if (monWithProp && monWithSeq) break;
  }

  /* [L01] 0x6FC21020 PLAYER_GetQuestRecordForDifficulty_6FC21020_113c (eax=pPlayer, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 601u);
    U32(STAGE_UDATA0 + 0x10u) = STAGE_SCRATCH + 0x10u;
    U32(STAGE_UDATA0 + 0x14u) = STAGE_SCRATCH + 0x20u;
    U32(STAGE_UDATA0 + 0x18u) = STAGE_SCRATCH + 0x30u;
    U8(STAGE_GAME + 0x6Du)    = (uint8_t)k;
    c = make_call();
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "plr_quest_rec_diff_k%d", k);
    run_and_emit(0x6FC21020u, "PLAYER_GetQuestRecordForDifficulty_6FC21020_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [L02] 0x6FC21040 STATLIST_SetUnitStatGoldGuarded_6FC21040_113c (esi=pUnit, ebx=nStatId, edi=nValue, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 602u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 50, 0);
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    int32_t stId  = (k == 1) ? 0 : 14;
    int32_t val   = (k == 1) ? 40 : -10;
    c = make_call();
    c.esi = uArg; c.ebx = (uint32_t)stId; c.edi = (uint32_t)val;
    ts[0] = uArg; ts[1] = stId; ts[2] = val;
    snprintf(lbl, sizeof(lbl), "set_stat_gold_guarded_k%d", k);
    run_and_emit(0x6FC21040u, "STATLIST_SetUnitStatGoldGuarded_6FC21040_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [L03] 0x6FC210D0 DATATBLS_GetItemStatCostRecordFast113c (eax=nStatId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t stId = (k == 0) ? -1 : (k == 1 ? 0 : 7);
    c = make_call(); c.eax = (uint32_t)stId;
    ts[0] = stId;
    snprintf(lbl, sizeof(lbl), "datatbls_isc_fast_k%d", k);
    run_and_emit(0x6FC210D0u, "DATATBLS_GetItemStatCostRecordFast113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L04] 0x6FC21100 UNIT_GetPosX113c (ecx=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 0) stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5012u, 5000u, 604u);
    else if (k == 1) stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 2u, 0u, 5034u, 5000u, 605u);
    else stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, STAGE_ROOM0, 1u, 1u, 3u, 1u, 0u, 0u, 606u);
    c = make_call(); c.ecx = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "unit_get_pos_x_k%d", k);
    run_and_emit(0x6FC21100u, "UNIT_GetPosX113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L05] 0x6FC21130 UNIT_GetPosY113c (ecx=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    if (k == 0) stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5022u, 607u);
    else if (k == 1) stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 2u, 0u, 5000u, 5044u, 608u);
    else stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, STAGE_ROOM0, 1u, 1u, 3u, 1u, 0u, 0u, 609u);
    c = make_call(); c.ecx = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "unit_get_pos_y_k%d", k);
    run_and_emit(0x6FC21130u, "UNIT_GetPosY113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L06] 0x6FC21220 MONSTATS_GetRecordPtr113c (eax=nClassId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t cid = (k == 0) ? -1 : (k == 1 ? 1 : 58);
    c = make_call(); c.eax = (uint32_t)cid;
    ts[0] = cid;
    snprintf(lbl, sizeof(lbl), "monstats_get_rec_k%d", k);
    run_and_emit(0x6FC21220u, "MONSTATS_GetRecordPtr113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L07] 0x6FC21250 MISSILES_GetTxtRecordFast113c (eax=nMissileId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t mid = (k == 0) ? -1 : (k == 1 ? 1 : 36);
    c = make_call(); c.eax = (uint32_t)mid;
    ts[0] = mid;
    snprintf(lbl, sizeof(lbl), "missiles_get_rec_k%d", k);
    run_and_emit(0x6FC21250u, "MISSILES_GetTxtRecordFast113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L08] 0x6FC21280 ROOM_FindRoomContainingSubtile113c (eax=pRoom, ebx=x, edi=y, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 1u);
    U32(STAGE_ROOM1 + 0x4Cu) = 6000u;
    U32(STAGE_ROOM1 + 0x50u) = 6000u;
    uint32_t ppNear = STAGE_SCRATCH;
    U32(ppNear + 0u) = STAGE_ROOM0;
    U32(ppNear + 4u) = STAGE_ROOM1;
    U32(STAGE_ROOM0 + 0x00u) = ppNear;
    U32(STAGE_ROOM0 + 0x24u) = 2u;
    uint32_t rArg = (k == 0) ? 0u : STAGE_ROOM0;
    int32_t sx = (k == 2) ? 6050 : 5000;
    int32_t sy = (k == 2) ? 6050 : 5000;
    c = make_call(); c.eax = rArg; c.ebx = (uint32_t)sx; c.edi = (uint32_t)sy;
    ts[0] = rArg; ts[1] = sx; ts[2] = sy;
    snprintf(lbl, sizeof(lbl), "room_find_subtile_k%d", k);
    run_and_emit(0x6FC21280u, "ROOM_FindRoomContainingSubtile113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [L09] 0x6FC21320 MONSTATS2_GetRecordPtr113c (eax=nClassId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t cid = (k == 0) ? -1 : (k == 1 ? 1 : 4);
    c = make_call(); c.eax = (uint32_t)cid;
    ts[0] = cid;
    snprintf(lbl, sizeof(lbl), "monstats2_get_rec_k%d", k);
    run_and_emit(0x6FC21320u, "MONSTATS2_GetRecordPtr113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L10] 0x6FC21390 MONSTER_SetSpawnRoomCoordNode113c (eax=pUnit, s0=pCoordNode, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 610u);
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t node = STAGE_SCRATCH + (uint32_t)k * 0x20u;
    c = make_call(); c.eax = uArg; c.nargs = 1; c.args[0] = node; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = node;
    snprintf(lbl, sizeof(lbl), "mon_set_coord_node_k%d", k);
    run_and_emit(0x6FC21390u, "MONSTER_SetSpawnRoomCoordNode113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [L11] 0x6FC213B0 MONSTATS2_CheckFlagBit113c (eax=nClassId, edx=nBit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t cid = (k == 0) ? -1 : 1;
    int32_t bit = 0;
    if (k >= 1) {
      int16_t exIdx = S16(pMonBase + 1u * 0x1A8u + 0x18u);
      uint32_t pM2  = U32(pTables + 0xA90u) + (uint32_t)exIdx * 0x134u;
      for (int b = 0; b < 32; b++) {
        uint8_t byteVal = U8(pM2 + 0x04u + (b >> 3));
        int isSet = (byteVal & (1u << (b & 7))) != 0u;
        if ((k == 1 && isSet) || (k == 2 && !isSet)) { bit = b; break; }
      }
    }
    c = make_call(); c.eax = (uint32_t)cid; c.edx = (uint32_t)bit;
    ts[0] = cid; ts[1] = bit;
    snprintf(lbl, sizeof(lbl), "monstats2_flag_bit_k%d", k);
    run_and_emit(0x6FC213B0u, "MONSTATS2_CheckFlagBit113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [L12] 0x6FC21420 SKILLS_GetRecordPtrFast113c (eax=nSkillId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t sid = (k == 0) ? -1 : (k == 1 ? 0 : 36);
    c = make_call(); c.eax = (uint32_t)sid;
    ts[0] = sid;
    snprintf(lbl, sizeof(lbl), "skills_get_rec_fast_k%d", k);
    run_and_emit(0x6FC21420u, "SKILLS_GetRecordPtrFast113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L13] 0x6FC21450 SEED_RollMaskFast113c (esi=pSeed, s0=nPow2, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH + 0u) = 0x11223344u + (uint32_t)k * 0x10203u;
    U32(STAGE_SCRATCH + 4u) = 0x0000029Au;
    int32_t p2 = (k == 0) ? 8 : (k == 1 ? 16 : 64);
    c = make_call(); c.esi = STAGE_SCRATCH; c.nargs = 1; c.args[0] = (uint32_t)p2; c.calleePop = 4u;
    ts[0] = STAGE_SCRATCH; ts[1] = p2;
    snprintf(lbl, sizeof(lbl), "seed_roll_mask_fast_k%d", k);
    run_and_emit(0x6FC21450u, "SEED_RollMaskFast113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [L14] 0x6FC21480 SEED_RollRangeWithMinFast113c (ecx=pSeed, edi=nMin, esi=nRange, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH + 0u) = 0x55667788u + (uint32_t)k * 0x777u;
    U32(STAGE_SCRATCH + 4u) = 0x0000029Au;
    int32_t nMin = 10 + k * 5;
    int32_t nRng = (k == 0) ? 0 : (k == 1 ? 8 : 13);
    c = make_call(); c.ecx = STAGE_SCRATCH; c.edi = (uint32_t)nMin; c.esi = (uint32_t)nRng;
    ts[0] = STAGE_SCRATCH; ts[1] = nMin; ts[2] = nRng;
    snprintf(lbl, sizeof(lbl), "seed_roll_range_min_k%d", k);
    run_and_emit(0x6FC21480u, "SEED_RollRangeWithMinFast113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [L15] 0x6FC214D0 mulDiv113c (eax=factor, edx=value, ecx=divisor, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t f = (k == 0) ? 50 : (k == 1 ? 75 : 0x20000);
    int32_t v = (k == 0) ? 10 : (k == 1 ? 200 : 300);
    int32_t d = (k == 0) ? 0  : (k == 1 ? 100 : 0x40000);
    c = make_call(); c.eax = (uint32_t)f; c.edx = (uint32_t)v; c.ecx = (uint32_t)d;
    ts[0] = f; ts[1] = v; ts[2] = d;
    snprintf(lbl, sizeof(lbl), "d2game_muldiv_k%d", k);
    run_and_emit(0x6FC214D0u, "mulDiv113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [L16] 0x6FC21560 MONSTATS2_CheckModeBit113c (eax=nClassId, edx=nModeBit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t cid = (k == 0) ? -1 : 1;
    int32_t bit = (k == 1) ? 1 : 15;
    c = make_call(); c.eax = (uint32_t)cid; c.edx = (uint32_t)bit;
    ts[0] = cid; ts[1] = bit;
    snprintf(lbl, sizeof(lbl), "monstats2_mode_bit_k%d", k);
    run_and_emit(0x6FC21560u, "MONSTATS2_CheckModeBit113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [L17] 0x6FC215D0 MONSTATS_CheckFlagBit113c (eax=nClassId, edx=nBit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t cid = (k == 0) ? -1 : 1;
    int32_t bit = 0;
    if (k >= 1) {
      uint32_t pM1 = pMonBase + 1u * 0x1A8u;
      for (int b = 0; b < 32; b++) {
        uint8_t byteVal = U8(pM1 + 0x0Cu + (b >> 3));
        int isSet = (byteVal & (1u << (b & 7))) != 0u;
        if ((k == 1 && isSet) || (k == 2 && !isSet)) { bit = b; break; }
      }
    }
    c = make_call(); c.eax = (uint32_t)cid; c.edx = (uint32_t)bit;
    ts[0] = cid; ts[1] = bit;
    snprintf(lbl, sizeof(lbl), "monstats_flag_bit_k%d", k);
    run_and_emit(0x6FC215D0u, "MONSTATS_CheckFlagBit113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [L18] 0x6FC21670 STATLIST_AddUnitStatGoldGuarded_6FC21670_113c (esi=pUnit, ebx=nStatId, s0=nDelta, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 618u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 20, 0);
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    int32_t delta = (k == 1) ? 15 : -50;
    c = make_call(); c.esi = uArg; c.ebx = 0u; c.nargs = 1; c.args[0] = (uint32_t)delta; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = 0; ts[2] = delta;
    snprintf(lbl, sizeof(lbl), "add_stat_gold_guarded_k%d", k);
    run_and_emit(0x6FC21670u, "STATLIST_AddUnitStatGoldGuarded_6FC21670_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [L19] 0x6FC21780 SEED_RollRangeHalfOpen113c (ecx=pSeed, edi=nMin, eax=nMax, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH + 0u) = 0x33445566u + (uint32_t)k * 0x999u;
    U32(STAGE_SCRATCH + 4u) = 0x0000029Au;
    int32_t mn = 5 + k * 2;
    int32_t mx = (k == 0) ? 5 : (k == 1 ? 15 : 23);
    c = make_call(); c.ecx = STAGE_SCRATCH; c.edi = (uint32_t)mn; c.eax = (uint32_t)mx;
    ts[0] = STAGE_SCRATCH; ts[1] = mn; ts[2] = mx;
    snprintf(lbl, sizeof(lbl), "seed_roll_half_open_k%d", k);
    run_and_emit(0x6FC21780u, "SEED_RollRangeHalfOpen113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [L20] 0x6FC21850 MONSTATS_ValidateClassId113c (eax=nClassId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t cid = (k == 0) ? -5 : (k == 1 ? 12 : 9999);
    c = make_call(); c.eax = (uint32_t)cid;
    ts[0] = cid;
    snprintf(lbl, sizeof(lbl), "monstats_validate_id_k%d", k);
    run_and_emit(0x6FC21850u, "MONSTATS_ValidateClassId113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L21] 0x6FC21870 MONSTATS_GetBaseIdFromClassId113c (eax=nClassId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t cid = (k == 0) ? -3 : (k == 1 ? 1 : 58);
    c = make_call(); c.eax = (uint32_t)cid;
    ts[0] = cid;
    snprintf(lbl, sizeof(lbl), "monstats_base_id_k%d", k);
    run_and_emit(0x6FC21870u, "MONSTATS_GetBaseIdFromClassId113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L22] 0x6FC218A0 MONSTER_GetBaseIdFromUnit113c (eax=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 1) ? 0u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 1u, 1u, 5000u, 5000u, 622u);
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = uArg;
    ts[0] = uArg;
    snprintf(lbl, sizeof(lbl), "mon_base_id_unit_k%d", k);
    run_and_emit(0x6FC218A0u, "MONSTER_GetBaseIdFromUnit113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L23] 0x6FC21900 UNIT_CalcSqDistSubtiles113c (eax=pUnitA, ebx=pUnitB, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint16_t bx = (k == 0) ? 5000u : (k == 1 ? 5003u : 5010u);
    uint16_t by = (k == 0) ? 5000u : (k == 1 ? 5004u : 5000u);
    uint32_t bType = (k == 2) ? 2u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 623u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, bType, 1u, 2u, 1u, bx, by, 624u);
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = STAGE_UNIT1;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "unit_calc_sq_dist_k%d", k);
    run_and_emit(0x6FC21900u, "UNIT_CalcSqDistSubtiles113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [L24] 0x6FC219F0 MONPROP_GetRecordPtrFromClassId113c (eax=nClassId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t cid = (k == 0) ? -1 : (k == 1 ? 1 : (int32_t)monWithProp);
    c = make_call(); c.eax = (uint32_t)cid;
    ts[0] = cid;
    snprintf(lbl, sizeof(lbl), "monprop_get_rec_k%d", k);
    run_and_emit(0x6FC219F0u, "MONPROP_GetRecordPtrFromClassId113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L25] 0x6FC21C80 MONSEQ_GetRecordPtrFromClassId113c (eax=nClassId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    int32_t cid = (k == 0) ? -1 : (k == 1 ? 1 : (int32_t)monWithSeq);
    c = make_call(); c.eax = (uint32_t)cid;
    ts[0] = cid;
    snprintf(lbl, sizeof(lbl), "monseq_get_rec_k%d", k);
    run_and_emit(0x6FC21C80u, "MONSEQ_GetRecordPtrFromClassId113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L26] 0x6FC21CD0 BITSTREAM_WriteVarUint113c (esi=pBitStream, edi=dwVal, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pBs  = STAGE_SCRATCH;
    uint32_t pBuf = STAGE_SCRATCH + 0x40u;
    U32(pBs + 0x00u) = pBuf;
    U32(pBs + 0x04u) = 0x100u; /* maxBits */
    U32(pBs + 0x08u) = 0u;
    U32(pBs + 0x0Cu) = 0u;
    U32(pBs + 0x10u) = 0u;
    uint32_t val = (k == 0) ? 0x42u : (k == 1 ? 0x1234u : 0x12345678u);
    c = make_call(); c.esi = pBs; c.edi = val;
    ts[0] = pBs; ts[1] = (int64_t)val;
    snprintf(lbl, sizeof(lbl), "bitstream_write_var_k%d", k);
    run_and_emit(0x6FC21CD0u, "BITSTREAM_WriteVarUint113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [L27] 0x6FC21D90 PLAYER_GetParam158_113c (eax=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 2) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 1u, 1u, 5000u, 5000u, 627u);
    U32(STAGE_UDATA0 + 0x158u) = 0x7788u;
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = uArg;
    ts[0] = uArg;
    snprintf(lbl, sizeof(lbl), "player_get_158_k%d", k);
    run_and_emit(0x6FC21D90u, "PLAYER_GetParam158_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [L28] 0x6FC21DB0 PLAYER_GetParam15C_113c (eax=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 2) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 1u, 1u, 5000u, 5000u, 628u);
    U32(STAGE_UDATA0 + 0x15Cu) = 0x99AAu;
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = uArg;
    ts[0] = uArg;
    snprintf(lbl, sizeof(lbl), "player_get_15c_k%d", k);
    run_and_emit(0x6FC21DB0u, "PLAYER_GetParam15C_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }
}

/* ============================================================================
 * GROUP 4: 48 Scenario-Only D2Game.dll 0x6FC2Bxxx..0x6FC3Fxxx Lo-VAs
 * ============================================================================ */

static void emit_group_4_d2game_lovas(void) {
  X86CallSpec c;
  int64_t ts[12];
  char lbl[64];
  uint32_t pTables   = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
  uint32_t pMonBase  = U32(pTables + 0xA78u);
  uint32_t pSkBase   = U32(pTables + 0xB98u);
  uint32_t nSkCnt    = U32(pTables + 0xBA0u);
  uint32_t pItemsBase = U32(D2COM_PREF_BASE + 0x9FB98u + g_com_rebase);

  uint32_t skWithSrvMissile  = 0u;
  uint32_t skWithSrvMissileA = 0u;
  for (uint32_t sid = 1; sid < nSkCnt; sid++) {
    uint32_t pRec = pSkBase + sid * 0x23Cu;
    if (!skWithSrvMissile  && S16(pRec + 0x48u) > 0) skWithSrvMissile  = sid;
    if (!skWithSrvMissileA && S16(pRec + 0x4Au) > 0) skWithSrvMissileA = sid;
    if (skWithSrvMissile && skWithSrvMissileA) break;
  }

  /* [M01] 0x6FC2B800 OBJRGN_PrependObjectCoordNode_6FC2B800_113c (eax=pGame, ecx=pUnit, s0=dwParam, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pObjCtrl = (uint32_t)(uintptr_t)bump_alloc(0x1120u);
    U32(STAGE_GAME + 0x10F0u) = pObjCtrl;
    uint32_t uType = (k == 2) ? 2u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 1u, 1u, 5000u + (uint16_t)(k * 10), 5005u, 701u);
    uint32_t param = 0x100u + (uint32_t)k;
    c = make_call(); c.eax = STAGE_GAME; c.ecx = STAGE_UNIT0; c.nargs = 1; c.args[0] = param; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int64_t)param;
    snprintf(lbl, sizeof(lbl), "objrgn_prepend_coord_k%d", k);
    run_and_emit(0x6FC2B800u, "OBJRGN_PrependObjectCoordNode_6FC2B800_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [M02] 0x6FC2C400 SKILLS_SrvDo001_JumpOrLeapMissile_6FC2C400_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5004u, 5004u, 702u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 10u, 1u, 5008u, 5006u, 712u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    int32_t sid = (k == 0) ? -1 : (k == 1 ? 0 : (int32_t)skWithSrvMissile);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sid; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sid; ts[3] = 3;
    snprintf(lbl, sizeof(lbl), "srvdo001_jump_missile_k%d", k);
    run_and_emit(0x6FC2C400u, "SKILLS_SrvDo001_JumpOrLeapMissile_6FC2C400_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [M03] 0x6FC2D680 SKILLS_SrvDo006_SpawnChargedSkillMissile_6FC2D680_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5004u, 5004u, 703u + (uint32_t)k);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 10u, 1u, 5009u, 5007u, 713u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    int32_t sid = (k == 0) ? -1 : (k == 1 ? 0 : (int32_t)skWithSrvMissileA);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sid; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sid; ts[3] = 2;
    snprintf(lbl, sizeof(lbl), "srvdo006_charged_missile_k%d", k);
    run_and_emit(0x6FC2D680u, "SKILLS_SrvDo006_SpawnChargedSkillMissile_6FC2D680_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [M04] 0x6FC2E0A0 ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c (edi=pGame, esi=pItem, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t qual = (k == 0) ? 2u : (k == 1 ? 4u : 7u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 50u, 3u, qual, 5000u, 5000u, 704u);
    c = make_call(); c.edi = STAGE_GAME; c.esi = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_calc_expire_k%d", k);
    run_and_emit(0x6FC2E0A0u, "ITEMS_CalcGroundExpireFrame_6FC2E0A0_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [M05] 0x6FC2E1C0 ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c (edi=pInventory, ebx=pTargetItem, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 705u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 51u, 1u, 2u, 0u, 0u, 706u);
    if (k >= 1) {
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 6);
    }
    uint32_t target = (k == 2) ? STAGE_UNIT2 : STAGE_UNIT1;
    uint32_t invAddr = (uint32_t)(uintptr_t)pInv;
    c = make_call(); c.edi = invAddr; c.ebx = target;
    ts[0] = invAddr; ts[1] = target;
    snprintf(lbl, sizeof(lbl), "items_remove_inv_cursor_k%d", k);
    run_and_emit(0x6FC2E1C0u, "ITEMS_RemoveFromInventoryOrCursor_6FC2E1C0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [M06] 0x6FC2E250 ITEMS_TestUniqueSpawnedBit_6FC2E250_113c (eax=pGame, ecx=nUniqueId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_GAME + 0x1B24u) = 0x00000020u; /* bit 5 */
    uint32_t gArg = (k == 0) ? 0u : STAGE_GAME;
    int32_t uid   = (k == 1) ? -1 : 5;
    c = make_call(); c.eax = gArg; c.ecx = (uint32_t)uid;
    ts[0] = gArg; ts[1] = uid;
    snprintf(lbl, sizeof(lbl), "items_test_unique_bit_k%d", k);
    run_and_emit(0x6FC2E250u, "ITEMS_TestUniqueSpawnedBit_6FC2E250_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [M07] 0x6FC2E5D0 ITEMS_GetDropItemLevel_6FC2E5D0_113c (eax=pDropper, s0=bAssertIfNull, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5000u, 5000u, 707u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 18, 0);
    uint32_t uArg = (k == 1) ? STAGE_UNIT0 : 0u;
    uint32_t bAsr = (k == 2) ? 1u : 0u;
    c = make_call(); c.eax = uArg; c.nargs = 1; c.args[0] = bAsr; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = uArg; ts[2] = (int64_t)bAsr;
    snprintf(lbl, sizeof(lbl), "items_drop_ilvl_k%d", k);
    run_and_emit(0x6FC2E5D0u, "ITEMS_GetDropItemLevel_6FC2E5D0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, (k == 2 ? 1 : 0));
  }

  /* [M08] 0x6FC2E660 ITEMS_FindQuestItemByBaseCode_6FC2E660_113c (eax=pUnit, ebx=pGame, s0=dwBaseCode, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 708u);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 52u, 1u, 2u, 0u, 0u, 709u);
      U8(STAGE_UDATA1 + 0x45u) = 0u;
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 6);
    }
    uint32_t code = (k == 2) ? 0x20647373u : 0x206E6972u;
    c = make_call(); c.eax = STAGE_UNIT0; c.ebx = STAGE_GAME; c.nargs = 1; c.args[0] = code; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = (int64_t)code;
    snprintf(lbl, sizeof(lbl), "items_find_quest_code_k%d", k);
    run_and_emit(0x6FC2E660u, "ITEMS_FindQuestItemByBaseCode_6FC2E660_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [M09] 0x6FC2E7E0 ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c (edx=pUnit, s0=pTargetItem, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 710u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 53u, 1u, 2u, 0u, 0u, 711u);
    if (k >= 1) {
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 6);
    }
    uint32_t target = (k == 2) ? STAGE_UNIT2 : STAGE_UNIT1;
    c = make_call(); c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = target; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = target;
    snprintf(lbl, sizeof(lbl), "items_remove_unit_inv_k%d", k);
    run_and_emit(0x6FC2E7E0u, "ITEMS_RemoveUnitInventoryOrCursorItem_6FC2E7E0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [M10] 0x6FC2E800 ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c (eax=pItem, edi=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t qual = (k == 0) ? 2u : 7u;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 54u, 3u, qual, 5000u, 5000u, 714u);
    U32(STAGE_UDATA0 + 0x28u) = 5u; /* dwItemCell */
    if (k == 2) U32(STAGE_GAME + 0x1B24u) = 0x00000020u;
    c = make_call(); c.eax = STAGE_UNIT0; c.edi = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "items_check_unique_spawned_k%d", k);
    run_and_emit(0x6FC2E800u, "ITEMS_CheckUniqueItemAlreadySpawned_6FC2E800_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [M11] 0x6FC2E930 ITEMS_FindFreeGroundDropCoords_6FC2E930_113c (esi=pCenter, s0=pRoom, s1=pOut, s2=nSize, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pCenter = STAGE_SCRATCH;
    uint32_t pOut    = STAGE_SCRATCH + 0x20u;
    U32(pCenter + 0u) = 5000u + (uint32_t)k * 3u;
    U32(pCenter + 4u) = 5000u + (uint32_t)k * 2u;
    uint32_t rArg = (k == 0) ? 0u : STAGE_ROOM0;
    c = make_call(); c.esi = pCenter; c.nargs = 3; c.args[0] = rArg; c.args[1] = pOut; c.args[2] = 1u; c.calleePop = 0xCu;
    ts[0] = rArg; ts[1] = pCenter; ts[2] = pOut; ts[3] = 1;
    snprintf(lbl, sizeof(lbl), "items_find_free_coords_k%d", k);
    run_and_emit(0x6FC2E930u, "ITEMS_FindFreeGroundDropCoords_6FC2E930_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [M12] 0x6FC2E990 ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c (eax=nY, ecx=pItem, ebx=pRoom, s0=pGame, s1=pOwner, s2=nX, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t qual = (k == 2) ? 4u : 2u;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 55u, 0u, qual, 5004u, 5004u, 715u + (uint32_t)k);
    uint32_t rArg = (k == 0) ? 0u : STAGE_ROOM0;
    int32_t nx = 5004 + k * 2;
    int32_t ny = 5005 + k * 2;
    c = make_call();
    c.eax = (uint32_t)ny; c.ecx = STAGE_UNIT0; c.ebx = rArg;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.args[2] = (uint32_t)nx; c.calleePop = 0xCu;
    ts[0] = ny; ts[1] = STAGE_UNIT0; ts[2] = rArg; ts[3] = STAGE_GAME; ts[4] = 0; ts[5] = nx;
    snprintf(lbl, sizeof(lbl), "items_place_ground_k%d", k);
    run_and_emit(0x6FC2E990u, "ITEMS_PlaceItemOnGroundInRoom_6FC2E990_113c", k, lbl, &c, ts, 6, 0u, 0);
  }

  /* [M13] 0x6FC2EA10 ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c (ebx=pItem, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 56u, 3u, 2u, 5000u, 5000u, 718u);
    if (k == 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0xFD, 5, 0);
    if (k == 2) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0xFD, 25, 0);
    c = make_call(); c.ebx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_sched_repl_qty_k%d", k);
    run_and_emit(0x6FC2EA10u, "ITEMS_ScheduleReplenishQuantityEvent_6FC2EA10_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [M14] 0x6FC2EA70 ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c (ebx=pItem, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 57u, 3u, 2u, 5000u, 5000u, 719u);
    if (k == 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0xFC, 5, 0);
    if (k == 2) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0xFC, 25, 0);
    c = make_call(); c.ebx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_sched_repl_dur_k%d", k);
    run_and_emit(0x6FC2EA70u, "ITEMS_ScheduleReplenishDurabilityEvent_6FC2EA70_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [M15] 0x6FC2EAE0 ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c
   * (edi=pGame, esi=pItemHeader, s0=pRoom, s1=pBitstream, s2=nBitstreamSize, s3=bHasVersionCoords, s4=pOutBytesRead, s5=nSaveVersion, ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pHdr     = STAGE_SCRATCH;
    uint32_t pStream  = STAGE_SCRATCH + 0x80u;
    uint32_t pOutRead = STAGE_SCRATCH + 0x280u;
    U32(pOutRead) = 0x77777777u;
    uint32_t gArg = STAGE_GAME;
    uint32_t streamLen = 16u;
    if (k == 0) {
      gArg = 0u;
    } else if (k == 1) {
      U32(pHdr + 0x00u) = 0xFFFFFFFFu;
    } else {
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_ring, 58u, 0u, 2u, 0u, 0u, 720u);
      int32_t nSer = fn_SerializeItemToBuf((void *)(uintptr_t)STAGE_UNIT1, (void *)(uintptr_t)pStream, 0x180, 1, 1, 0);
      fn_DecodeCompactV96((const void *)(uintptr_t)pStream, nSer, 1, (void *)(uintptr_t)pHdr);
      streamLen = (uint32_t)nSer;
    }
    c = make_call();
    c.edi = gArg; c.esi = pHdr;
    c.nargs = 6;
    c.args[0] = STAGE_ROOM0; c.args[1] = pStream; c.args[2] = streamLen;
    c.args[3] = 1u; c.args[4] = pOutRead; c.args[5] = 0x60u;
    c.calleePop = 0x18u;
    ts[0] = gArg; ts[1] = pHdr; ts[2] = STAGE_ROOM0; ts[3] = pStream;
    ts[4] = (int64_t)streamLen; ts[5] = 1; ts[6] = pOutRead; ts[7] = 0x60;
    snprintf(lbl, sizeof(lbl), "items_alloc_load_bs_k%d", k);
    run_and_emit(0x6FC2EAE0u, "ITEMS_AllocAndLoadFromBitstream_6FC2EAE0_113c", k, lbl, &c, ts, 8, 0xFFFFFFFFu, 0);
  }

  /* [M16] 0x6FC2EDC0 ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c (eax=pGame, ebx=pItem, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 59u, 3u, 7u, 5000u, 5000u, 721u);
    U32(STAGE_UDATA0 + 0x28u) = 1u; /* dwItemCell = 1 */
    if (k == 2) U32(STAGE_GAME + 0x1B24u) = 0x00000002u;
    uint32_t iArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.eax = STAGE_GAME; c.ebx = iArg;
    ts[0] = STAGE_GAME; ts[1] = iArg;
    snprintf(lbl, sizeof(lbl), "items_mark_unique_k%d", k);
    run_and_emit(0x6FC2EDC0u, "ITEMS_MarkUniqueItemSpawned_6FC2EDC0_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [M17] 0x6FC2F180 ITEMS_CheckItemTxtSpawnable_6FC2F180_113c (edi=pItemsTxt, eax=nLevelId, ebx=nReqType, s0=pSeed, s1=bSkip, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pRec = pItemsBase + g_item_sword * 0x1A8u;
    U32(STAGE_SCRATCH + 0u) = 0x22334455u;
    U32(STAGE_SCRATCH + 4u) = 0x0000029Au;
    int32_t reqType = (k == 0) ? -1 : 9999;
    uint32_t bSkip  = (k == 2) ? 0u : 1u;
    if (k == 2) reqType = -1;
    c = make_call();
    c.edi = pRec; c.eax = 20u; c.ebx = (uint32_t)reqType;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = bSkip; c.calleePop = 8u;
    ts[0] = pRec; ts[1] = 20; ts[2] = reqType; ts[3] = STAGE_SCRATCH; ts[4] = (int64_t)bSkip;
    snprintf(lbl, sizeof(lbl), "items_check_spawnable_k%d", k);
    run_and_emit(0x6FC2F180u, "ITEMS_CheckItemTxtSpawnable_6FC2F180_113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [M18] 0x6FC2F260 ITEMS_ApplyGoldFindBonus_6FC2F260_113c (edi=pItem, ebx=pKiller, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_gold, 60u, 3u, 2u, 5000u, 5000u, 722u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 100, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5002u, 5002u, 723u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x4F, (k == 1) ? 50 : 120, 0);
    uint32_t iArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.edi = iArg; c.ebx = STAGE_UNIT1;
    ts[0] = iArg; ts[1] = STAGE_UNIT1;
    snprintf(lbl, sizeof(lbl), "items_apply_goldfind_k%d", k);
    run_and_emit(0x6FC2F260u, "ITEMS_ApplyGoldFindBonus_6FC2F260_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [M19] 0x6FC2F2F0 ITEMS_GetUnitAndLeaderMagicFind113c (esi=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 2) ? 2u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 1u, 1u, 5000u, 5000u, 724u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x50, 45, 0);
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call(); c.esi = uArg;
    ts[0] = uArg;
    snprintf(lbl, sizeof(lbl), "items_get_mf_k%d", k);
    run_and_emit(0x6FC2F2F0u, "ITEMS_GetUnitAndLeaderMagicFind113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [M20] 0x6FC2F780 ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c
   * (s0=pGame, s1=pSeed, s2=nLevelId, s3=nReqType, s4=bSkipRarity, s5=bAllowQuest0x28, ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_SCRATCH + 0u) = 0x13572468u + (uint32_t)k * 0x77777u;
    U32(STAGE_SCRATCH + 4u) = 0x0000029Au;
    int32_t lvl = (k == 0) ? 5 : (k == 1 ? 20 : 50);
    uint32_t skipRar = (k == 0) ? 0u : 1u;
    uint32_t allowQ  = (k == 2) ? 1u : 0u;
    c = make_call();
    c.nargs = 6;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_SCRATCH; c.args[2] = (uint32_t)lvl;
    c.args[3] = (uint32_t)(-1); c.args[4] = skipRar; c.args[5] = allowQ;
    c.calleePop = 0x18u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH; ts[2] = lvl; ts[3] = -1; ts[4] = (int64_t)skipRar; ts[5] = (int64_t)allowQ;
    snprintf(lbl, sizeof(lbl), "items_roll_misc_id_k%d", k);
    run_and_emit(0x6FC2F780u, "ITEMS_RollSpawnableWeaponOrMiscId_6FC2F780_113c", k, lbl, &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [M21] 0x6FC30160 ITEMS_InitItemUnit_6FC30160_113c (edi=pGame, esi=pItem, eax=dwUnitId, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (k == 0) ? g_item_sword : (k == 1 ? g_item_ring : g_item_bow);
    U32(STAGE_UNIT0 + 0x00u) = 4u;
    U32(STAGE_UNIT0 + 0x04u) = cid;
    U32(STAGE_UNIT0 + 0x14u) = STAGE_UDATA0;
    U32(STAGE_UNIT0 + 0x80u) = STAGE_GAME;
    U32(STAGE_UNIT0 + 0xC4u) = 0x0000000Cu;
    uint32_t uid = 101u + (uint32_t)k * 100u;
    c = make_call(); c.edi = STAGE_GAME; c.esi = STAGE_UNIT0; c.eax = uid;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int64_t)uid;
    snprintf(lbl, sizeof(lbl), "items_init_unit_k%d", k);
    run_and_emit(0x6FC30160u, "ITEMS_InitItemUnit_6FC30160_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [M22] 0x6FC30550 ITEMS_FinalizeNormalExpansionItem_6FC30550_113c (eax=pItem, edi=pItemDrop, s0=0, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (k == 0) ? g_item_sword : (k == 1 ? g_item_wand : g_item_ring);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 61u + (uint32_t)k, 3u, 2u, 5000u, 5000u, 725u + (uint32_t)k);
    uint32_t pDrop = STAGE_SCRATCH;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = 15u + (uint32_t)k * 5u;
    U32(pDrop + 0x40u) = 2u + (uint32_t)k;
    c = make_call(); c.eax = STAGE_UNIT0; c.edi = pDrop; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pDrop;
    snprintf(lbl, sizeof(lbl), "items_finalize_norm_exp_k%d", k);
    run_and_emit(0x6FC30550u, "ITEMS_FinalizeNormalExpansionItem_6FC30550_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [M23] 0x6FC30700 ITEMS_DestroyItemEventsAndSubInventory_6FC30700_113c (edi=pGame, esi=pItem, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 65u, 3u, 2u, 5000u, 5000u, 730u + (uint32_t)k);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0xFC, (k == 1) ? 10 : 25, 0);
      g_thunk_target = (uint32_t)((0x6FC2EA70u - D2GAME_PREF_BASE) + (uintptr_t)g_hGame);
      g_thunk_in_eax = 0; g_thunk_in_ecx = 0; g_thunk_in_edx = 0;
      g_thunk_in_ebx = STAGE_UNIT0; g_thunk_in_esi = 0; g_thunk_in_edi = 0;
      g_thunk_nargs = 1; g_thunk_args[0] = STAGE_GAME;
      g_thunk_in_call = 1; thunk_invoke(); g_thunk_in_call = 0;
    }
    c = make_call(); c.edi = STAGE_GAME; c.esi = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_destroy_events_k%d", k);
    run_and_emit(0x6FC30700u, "ITEMS_DestroyItemEventsAndSubInventory_6FC30700_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [M24] 0x6FC307B0 ITEMS_DispatchNormalItemModsByFormat_6FC307B0_113c (eax=pItemDrop, esi=pItem, ebx=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (k == 2) ? g_item_wand : g_item_sword;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 66u + (uint32_t)k, 3u, 2u, 5000u, 5000u, 735u + (uint32_t)k);
    U16(STAGE_UDATA0 + 0x30u) = (k == 1) ? 0u : 100u;
    uint32_t pDrop = STAGE_SCRATCH;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = 12u;
    c = make_call(); c.eax = pDrop; c.esi = STAGE_UNIT0; c.ebx = STAGE_GAME;
    ts[0] = pDrop; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "items_dispatch_norm_fmt_k%d", k);
    run_and_emit(0x6FC307B0u, "ITEMS_DispatchNormalItemModsByFormat_6FC307B0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [M25] 0x6FC307E0 ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c (eax=pGame, s0=pSourceItem, s1=bCloneSockets, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (k == 0) ? g_item_ring : (k == 1 ? g_item_sword : g_item_bow);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 70u + (uint32_t)k, 0u, 2u, 0u, 0u, 740u + (uint32_t)k);
    uint32_t bClone = (k == 1) ? 1u : 0u;
    c = make_call(); c.eax = STAGE_GAME; c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = bClone; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int64_t)bClone;
    snprintf(lbl, sizeof(lbl), "items_duplicate_item_k%d", k);
    run_and_emit(0x6FC307E0u, "ITEMS_DuplicateItemWithSocketFillers_6FC307E0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [M26] 0x6FC31880 ITEMS_CreateDroppedItemAtUnit_6FC31880_113c
   * (ebx=pDropper, s0=pGame, s1=nItemId, s2=nQuality, s3=nUniqueSetIdx, s4=dwFlags2, ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5004u, 5004u, 745u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 15, 0);
    int32_t itemId = (k == 0) ? -1 : (k == 1 ? (int32_t)g_item_ring : (int32_t)g_item_sword);
    int32_t qual   = (k == 2) ? 4 : 2;
    c = make_call();
    c.ebx = STAGE_UNIT0;
    c.nargs = 5;
    c.args[0] = STAGE_GAME; c.args[1] = (uint32_t)itemId; c.args[2] = (uint32_t)qual; c.args[3] = 0u; c.args[4] = 0u;
    c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = itemId; ts[3] = qual; ts[4] = 0; ts[5] = 0;
    snprintf(lbl, sizeof(lbl), "items_create_dropped_at_unit_k%d", k);
    run_and_emit(0x6FC31880u, "ITEMS_CreateDroppedItemAtUnit_6FC31880_113c", k, lbl, &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [M27] 0x6FC31980 ITEMS_SpawnItemWithParams_6FC31980_113c
   * (eax=nItemLevel, edx=bFlag8, ecx=bIdentified, s0=pOwner, s1=nClassId, s2=pGame, s3=nMode, s4=nQuality, s5=bSendClient, s6=dwSeed, s7=dwInitSeed, ret 0x20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    int32_t cid  = (k == 0) ? -1 : (k == 1 ? (int32_t)g_item_ring : (int32_t)g_item_sword);
    int32_t qual = (k == 2) ? 4 : 2;
    uint32_t seed = 0x24680001u + (uint32_t)k;
    c = make_call();
    c.eax = 15u; c.edx = (k == 2 ? 1u : 0u); c.ecx = 1u;
    c.nargs = 8;
    c.args[0] = 0u; c.args[1] = (uint32_t)cid; c.args[2] = STAGE_GAME; c.args[3] = 4u;
    c.args[4] = (uint32_t)qual; c.args[5] = 0u; c.args[6] = seed; c.args[7] = seed;
    c.calleePop = 0x20u;
    ts[0] = 15; ts[1] = (k == 2 ? 1 : 0); ts[2] = 1; ts[3] = 0; ts[4] = cid;
    ts[5] = STAGE_GAME; ts[6] = 4; ts[7] = qual; ts[8] = 0; ts[9] = (int64_t)seed; ts[10] = (int64_t)seed;
    snprintf(lbl, sizeof(lbl), "items_spawn_with_params_k%d", k);
    run_and_emit(0x6FC31980u, "ITEMS_SpawnItemWithParams_6FC31980_113c", k, lbl, &c, ts, 11, 0xFFFFFFFFu, 0);
  }

  /* [M28] 0x6FC31CA0 ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c
   * (eax=pCoords, esi=pGame, s0=pRoom, s1=nReqType, s2=bSkipRarity, s3=pOwnerUnit, ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    uint32_t lvlId = (k == 0) ? 1u : (k == 1 ? 2u : 12u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x2468ACE1u + (uint32_t)k * 0x11111u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5004u, 5004u, 750u + (uint32_t)k);
    U32(STAGE_SCRATCH + 0u) = 5004u + (uint32_t)k * 2u;
    U32(STAGE_SCRATCH + 4u) = 5004u;
    uint32_t own = (k == 2) ? STAGE_UNIT0 : 0u;
    uint32_t skipRar = (k == 0) ? 0u : 1u;
    c = make_call();
    c.eax = STAGE_SCRATCH; c.esi = STAGE_GAME;
    c.nargs = 4; c.args[0] = STAGE_ROOM0; c.args[1] = (uint32_t)(-1); c.args[2] = skipRar; c.args[3] = own;
    c.calleePop = 0x10u;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_GAME; ts[2] = STAGE_ROOM0; ts[3] = -1; ts[4] = (int64_t)skipRar; ts[5] = own;
    snprintf(lbl, sizeof(lbl), "items_spawn_random_misc_k%d", k);
    run_and_emit(0x6FC31CA0u, "ITEMS_SpawnRandomMiscItemInRoomAtCoords_6FC31CA0_113c", k, lbl, &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [M29] 0x6FC32D60 ITEMS_DropMonsterTreasure_6FC32D60_113c
   * (edi=pGame, esi=pMonster, s0=pKiller, s1=wTcId, s2=nForcedQual, s3=nDropIlvl, s4=0, s5=ppOutItems, s6=pnItemsDropped, s7=nMaxDrops, ret 0x20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5004u, 5004u, 755u + (uint32_t)k * 17u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5005u, 5004u, 760u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0);
    uint16_t wTc = (k == 0) ? 0u : U16(pMonBase + 1u * 0x1A8u + 0x134u + (uint32_t)(k - 1) * 2u);
    uint32_t pnDropped = STAGE_SCRATCH + 0x40u;
    c = make_call();
    c.edi = STAGE_GAME; c.esi = STAGE_UNIT0;
    c.nargs = 8;
    c.args[0] = STAGE_UNIT1; c.args[1] = wTc; c.args[2] = 0u; c.args[3] = 10u;
    c.args[4] = 0u; c.args[5] = 0u; c.args[6] = pnDropped; c.args[7] = 6u;
    c.calleePop = 0x20u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = wTc;
    ts[4] = 0; ts[5] = 10; ts[6] = 0; ts[7] = 0; ts[8] = pnDropped; ts[9] = 6;
    snprintf(lbl, sizeof(lbl), "items_drop_mon_tc_k%d", k);
    run_and_emit(0x6FC32D60u, "ITEMS_DropMonsterTreasure_6FC32D60_113c", k, lbl, &c, ts, 10, 0xFFFFFFFFu, 0);
  }

  /* [M30] 0x6FC32DF0 ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c (esi=pPlayerUnit, s0=pGame, s1=dwGoldAmount, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5004u, 5004u, 765u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0); /* maxGold = 100000 */
    int32_t curGold = (k == 0) ? 1000 : (k == 1 ? 99000 : 100000);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, curGold, 0);
    uint32_t gold = (k == 0) ? 500u : (k == 1 ? 2500u : 750u);
    c = make_call(); c.esi = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = gold; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = (int64_t)gold;
    snprintf(lbl, sizeof(lbl), "items_add_plr_gold_k%d", k);
    run_and_emit(0x6FC32DF0u, "ITEMS_AddPlayerGoldOrDropOverflow_6FC32DF0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [M31] 0x6FC331E0 ITEMS_HasAffixGroupOnItem113c (edi=pItem, ebx=dwAffixGroup, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 80u, 3u, 4u, 5000u, 5000u, 770u);
    typedef void *(__stdcall *Com_GetMagicAffixRec_t)(int32_t idx);
    Com_GetMagicAffixRec_t fn_GetAffix = (Com_GetMagicAffixRec_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10248));
    uint32_t grp1 = 101u;
    if (fn_GetAffix) {
      void *pAf = fn_GetAffix(1);
      if (pAf) grp1 = U32((uint32_t)(uintptr_t)pAf + 0x5Cu);
    }
    if (k >= 1) U16(STAGE_UDATA0 + 0x38u) = 1u; /* wMagicPrefix[0] = 1 */
    uint32_t targetGrp = (k == 2) ? (grp1 + 999u) : grp1;
    c = make_call(); c.edi = STAGE_UNIT0; c.ebx = targetGrp;
    ts[0] = STAGE_UNIT0; ts[1] = (int64_t)targetGrp;
    snprintf(lbl, sizeof(lbl), "items_has_affix_grp_k%d", k);
    run_and_emit(0x6FC331E0u, "ITEMS_HasAffixGroupOnItem113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [M32] 0x6FC33DE0 ITEMS_RollStaffModsOnItem_6FC33DE0_113c (eax=pItem, s0=pItemDrop, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (k == 0) ? g_item_sword : g_item_wand;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 81u + (uint32_t)k, 3u, 2u, 5000u, 5000u, 775u + (uint32_t)k * 31u);
    U16(STAGE_UDATA0 + 0x30u) = (k == 2) ? 0u : 100u;
    uint32_t pDrop = STAGE_SCRATCH;
    U32(pDrop + 0x0Cu) = 15u;
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = pDrop; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pDrop;
    snprintf(lbl, sizeof(lbl), "items_roll_staffmods_k%d", k);
    run_and_emit(0x6FC33DE0u, "ITEMS_RollStaffModsOnItem_6FC33DE0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [M33] 0x6FC34210 ITEMS_RollRarePrefixId_6FC34210_113c (s0=pItem, s1=bIsPrefix, ret 8; TS: bIsPrefix, pItem; mask=0xFFFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (k == 2) ? g_item_ring : g_item_sword;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 85u + (uint32_t)k, 3u, 6u, 5000u, 5000u, 780u + (uint32_t)k * 19u);
    U32(STAGE_UDATA0 + 0x2Cu) = 35u;
    uint32_t bPfx = (k == 0) ? 0u : 1u;
    c = make_call(); c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = bPfx; c.calleePop = 8u;
    ts[0] = (int64_t)bPfx; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "items_roll_rare_affix_k%d", k);
    run_and_emit(0x6FC34210u, "ITEMS_RollRarePrefixId_6FC34210_113c", k, lbl, &c, ts, 2, 0x0000FFFFu, 0);
  }

  /* [M34] 0x6FC35D10 AI_InitHomeNode10_113c (eax=pUnit, s0=pGame, ret 4, mask=0xFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint16_t mx = (k == 1) ? 5008u : 5004u;
    uint16_t my = (k == 1) ? 5006u : 5004u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 147u, 10u, 1u, mx, my, 785u + (uint32_t)k);
    if (k >= 1) {
      uint32_t pCmd = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(pCmd + 0x00u) = pCmd;
      U32(pCmd + 0x04u) = pCmd;
      U32(pCmd + 0x08u) = 0x0Au;
      U32(pCmd + 0x0Cu) = (k == 2) ? 5004u : 0u;
      U32(pCmd + 0x10u) = (k == 2) ? 5004u : 0u;
      uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
      U32(pAiGen + 0x20u) = pCmd;
    }
    c = make_call(); c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "ai_init_home10_k%d", k);
    run_and_emit(0x6FC35D10u, "AI_InitHomeNode10_113c", k, lbl, &c, ts, 2, 0x000000FFu, 0);
  }

  /* [M35] 0x6FC36410 AI_ThinkTimedExpireOrStall_6FC36410_113c (ecx=pGame, edx=pMonster, s0=pAiArgs, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_game_mon_region(2u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, 1u, 5004u, 5004u, 790u + (uint32_t)k);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    U32(pAiCtrl + 0x14u) = (k == 2) ? 50u : (150u + (uint32_t)k * 20u);
    U32(STAGE_SCRATCH)   = pAiCtrl;
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_timed_expire_k%d", k);
    run_and_emit(0x6FC36410u, "AI_ThinkTimedExpireOrStall_6FC36410_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [M36] 0x6FC36610 AI_CheckReturnHomeToNode10_113c (eax=pUnit, s0=pGame, s1=pAiTickParam, s2=nLeashDist, ret 0xC, mask=0xFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 147u, 10u, 1u, 5004u, 5004u, 795u + (uint32_t)k);
    if (k >= 1) {
      uint32_t pCmd = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(pCmd + 0x00u) = pCmd;
      U32(pCmd + 0x04u) = pCmd;
      U32(pCmd + 0x08u) = 0x0Au;
      U32(pCmd + 0x0Cu) = (k == 1) ? 5005u : 5020u;
      U32(pCmd + 0x10u) = (k == 1) ? 5005u : 5020u;
      uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
      U32(pAiGen + 0x20u) = pCmd;
      U32(pAiGen + 0x24u) = pCmd;
    }
    c = make_call();
    c.eax = STAGE_UNIT0; c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_SCRATCH; c.args[2] = 6u; c.calleePop = 0xCu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = 6;
    snprintf(lbl, sizeof(lbl), "ai_check_return_home_k%d", k);
    run_and_emit(0x6FC36610u, "AI_CheckReturnHomeToNode10_113c", k, lbl, &c, ts, 4, 0x000000FFu, 0);
  }

  /* [M37] 0x6FC36970 AI_MapAiAction1_WalkToWaypoint113c (ecx=pGame, edx=pUnit, s0=pAiTickParam, s1=pEntry, ret 8, mask=0xFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 147u, 10u, 1u, 5004u, 5004u, 800u + (uint32_t)k);
    uint32_t pEntry = STAGE_SCRATCH + 0x40u;
    U32(pEntry + 0x00u) = 1u;
    U32(pEntry + 0x04u) = (k == 1) ? 5004u : 5012u;
    U32(pEntry + 0x08u) = (k == 1) ? 5004u : 5010u;
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = uArg; c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = pEntry; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = uArg; ts[2] = pEntry;
    snprintf(lbl, sizeof(lbl), "ai_map_action1_k%d", k);
    run_and_emit(0x6FC36970u, "AI_MapAiAction1_WalkToWaypoint113c", k, lbl, &c, ts, 3, 0x000000FFu, 0);
  }

  /* [M38] 0x6FC39640 AI_ThinkSpecialGuard_6FC39640_113c (ecx=pGame, edx=pMonster, s0=pAiArgs, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 0) ? 2u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 10u, mode, 5004u, 5004u, 805u + (uint32_t)k);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5005u, 5004u, 809u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 100 << 8, 0);
      uint32_t pPlrNode = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pPlrNode + 0x00u) = STAGE_UNIT1;
      U32(STAGE_GAME + 0x10F8u) = pPlrNode;
    }
    U32(STAGE_SCRATCH) = U32(STAGE_UDATA0 + 0x2Cu);
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_special_guard_k%d", k);
    run_and_emit(0x6FC39640u, "AI_ThinkSpecialGuard_6FC39640_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [M39] 0x6FC39880 AI_ThinkTyraelOrIzualGhost_6FC39880_113c (ecx=pGame, edx=pUnit, s0=pAiArgs, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 147u, 10u, 1u, 5004u, 5004u, 810u + (uint32_t)k);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pInteract = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(STAGE_UDATA0 + 0x30u) = pInteract;
    U32(STAGE_SCRATCH) = pAiCtrl;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5008u, 5004u, 814u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 100 << 8, 0);
      U32(pAiCtrl + 0x18u) = (k == 1) ? 0u : 5u;
    }
    c = make_call(); c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_tyrael_izual_k%d", k);
    run_and_emit(0x6FC39880u, "AI_ThinkTyraelOrIzualGhost_6FC39880_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [M40] 0x6FC39AD0 AI_MapAiAction4_WalkAndMode8_113c (ecx=pGame, edx=pUnit, s0=pAiTickParam, s1=pEntry, ret 8, mask=0xFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 147u, 10u, 1u, 5004u, 5004u, 820u + (uint32_t)k);
    uint32_t pEntry = (k == 1) ? 0u : (STAGE_SCRATCH + 0x40u);
    if (k == 2) {
      U32(pEntry + 0x00u) = 4u;
      U32(pEntry + 0x04u) = 5012u;
      U32(pEntry + 0x08u) = 5010u;
    }
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = uArg; c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = pEntry; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = uArg; ts[2] = pEntry;
    snprintf(lbl, sizeof(lbl), "ai_map_action4_k%d", k);
    run_and_emit(0x6FC39AD0u, "AI_MapAiAction4_WalkAndMode8_113c", k, lbl, &c, ts, 3, 0x000000FFu, 0);
  }

  /* [M41] 0x6FC39BA0 AI_MapAiAction3_WalkToWaypoint113c (ecx=pGame, edx=pUnit, s0=pAiTickParam, s1=pEntry, ret 8, mask=0xFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 147u, 10u, 1u, 5004u, 5004u, 825u + (uint32_t)k);
    uint32_t pEntry = STAGE_SCRATCH + 0x40u;
    U32(pEntry + 0x00u) = 3u;
    U32(pEntry + 0x04u) = (k == 1) ? 5004u : 5014u;
    U32(pEntry + 0x08u) = (k == 1) ? 5004u : 5010u;
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = uArg; c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = pEntry; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = uArg; ts[2] = pEntry;
    snprintf(lbl, sizeof(lbl), "ai_map_action3_k%d", k);
    run_and_emit(0x6FC39BA0u, "AI_MapAiAction3_WalkToWaypoint113c", k, lbl, &c, ts, 3, 0x000000FFu, 0);
  }

  /* [M42] 0x6FC39BB0 AI_MapAiAction2_WalkAndWait20_113c (ecx=pGame, edx=pUnit, s0=pAiTickParam, s1=pEntry, ret 8, mask=0xFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 147u, 10u, 1u, 5004u, 5004u, 830u + (uint32_t)k);
    uint32_t pEntry = (k == 1) ? 0u : (STAGE_SCRATCH + 0x40u);
    if (k == 2) {
      U32(pEntry + 0x00u) = 2u;
      U32(pEntry + 0x04u) = 5012u;
      U32(pEntry + 0x08u) = 5008u;
    }
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = uArg; c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = pEntry; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = uArg; ts[2] = pEntry;
    snprintf(lbl, sizeof(lbl), "ai_map_action2_k%d", k);
    run_and_emit(0x6FC39BB0u, "AI_MapAiAction2_WalkAndWait20_113c", k, lbl, &c, ts, 3, 0x000000FFu, 0);
  }

  /* [M43] 0x6FC3BBC0 AI_FollowDs1NpcPathMem113c (s0=pGame, s1=pUnit, s2=pAiTickParam, ret 0xC, mask=0xFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    /* Choose seedLo = 1u so (stepSeed % 100) < 0x42 */
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 147u, 10u, 1u, 5004u, 5004u, 1u);
    U32(STAGE_UNIT0 + 0x24u) = 1u;
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    U32(STAGE_SCRATCH) = pAiCtrl;
    if (k >= 1) {
      uint32_t pMapAi = STAGE_SCRATCH + 0x40u;
      uint32_t pEntry = STAGE_SCRATCH + 0x60u;
      U32(pMapAi + 0x00u) = 1u;
      U32(pMapAi + 0x04u) = pEntry;
      U32(pEntry + 0x00u) = (k == 1) ? 0u : 1u;
      U32(pEntry + 0x04u) = 5012u;
      U32(pEntry + 0x08u) = 5010u;
      U32(pAiCtrl + 0x38u) = pMapAi;
    }
    c = make_call();
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_SCRATCH; c.calleePop = 0xCu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_follow_ds1_path_k%d", k);
    run_and_emit(0x6FC3BBC0u, "AI_FollowDs1NpcPathMem113c", k, lbl, &c, ts, 3, 0x000000FFu, 0);
  }

  /* [M44] 0x6FC3BC60 AI_SimpleMapAiNpc113c (ecx=pGame, edx=pUnit, s0=pAiTickParam, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 147u, 10u, 1u, 5004u, 5004u, 1u);
    U32(STAGE_UNIT0 + 0x24u) = 1u;
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    U32(STAGE_SCRATCH) = pAiCtrl;
    if (k >= 1) {
      uint32_t pCmd = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(pCmd + 0x00u) = pCmd;
      U32(pCmd + 0x04u) = pCmd;
      U32(pCmd + 0x08u) = 0x0Au;
      U32(pCmd + 0x0Cu) = 5004u;
      U32(pCmd + 0x10u) = 5004u;
      uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
      U32(pAiGen + 0x20u) = pCmd;
      U32(pAiGen + 0x24u) = pCmd;
      if (k == 2) {
        uint32_t pMapAi = STAGE_SCRATCH + 0x40u;
        uint32_t pEntry = STAGE_SCRATCH + 0x60u;
        U32(pMapAi + 0x00u) = 1u;
        U32(pMapAi + 0x04u) = pEntry;
        U32(pEntry + 0x00u) = 1u;
        U32(pEntry + 0x04u) = 5012u;
        U32(pEntry + 0x08u) = 5010u;
        U32(pAiCtrl + 0x38u) = pMapAi;
      }
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    snprintf(lbl, sizeof(lbl), "ai_simple_map_npc_k%d", k);
    run_and_emit(0x6FC3BC60u, "AI_SimpleMapAiNpc113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [M45] 0x6FC3E960 MONREG_FindOrAllocActRoomNode113c (ebx=roomX, s0=pGame, s1=nAct, s2=roomY, s3=bAlloc, ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    if (k == 2) {
      uint32_t pExisting = (uint32_t)(uintptr_t)bump_alloc(0x18u);
      U32(pExisting + 0x00u) = 100u;
      U32(pExisting + 0x04u) = 200u;
      U32(STAGE_GAME + 0xD8u) = pExisting;
    }
    int32_t rx = (k == 2) ? 50 : 100;
    uint32_t bAlloc = (k == 0) ? 0u : 1u;
    c = make_call();
    c.ebx = (uint32_t)rx;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.args[2] = 200u; c.args[3] = bAlloc; c.calleePop = 0x10u;
    ts[0] = STAGE_GAME; ts[1] = 0; ts[2] = rx; ts[3] = 200; ts[4] = (int64_t)bAlloc;
    snprintf(lbl, sizeof(lbl), "monreg_find_alloc_node_k%d", k);
    run_and_emit(0x6FC3E960u, "MONREG_FindOrAllocActRoomNode113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [M46] 0x6FC3EA40 MONREG_UnlinkAndFreeActRoomNode113c
   * (eax=pRoom, ebx=pGame, s0=ppOutUnits, s1=ppOutItems, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t ppUnits = STAGE_SCRATCH + 0x10u;
    uint32_t ppItems = STAGE_SCRATCH + 0x20u;
    U32(ppUnits) = 0xAAAAAAAAu;
    U32(ppItems) = 0xBBBBBBBBu;
    if (k >= 1) {
      uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x18u);
      U32(pNode + 0x00u) = (k == 1) ? 4800u : 9999u;
      U32(pNode + 0x04u) = 4800u;
      U32(pNode + 0x08u) = STAGE_SCRATCH + 0x100u;
      U32(pNode + 0x10u) = STAGE_SCRATCH + 0x200u;
      U32(STAGE_GAME + 0xD8u) = pNode;
    }
    c = make_call();
    c.eax = STAGE_ROOM0; c.ebx = STAGE_GAME; c.nargs = 2; c.args[0] = ppUnits; c.args[1] = ppItems; c.calleePop = 8u;
    ts[0] = STAGE_ROOM0; ts[1] = STAGE_GAME; ts[2] = ppUnits; ts[3] = ppItems;
    snprintf(lbl, sizeof(lbl), "monreg_unlink_free_node_k%d", k);
    run_and_emit(0x6FC3EA40u, "MONREG_UnlinkAndFreeActRoomNode113c", k, lbl, &c, ts, 4, 0u, 0);
  }

  /* [M47] 0x6FC3EB20 AIGENERAL_ExpireMinionListsInAct113c (eax=nAct, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    if (k >= 1) {
      uint32_t pRNode = (uint32_t)(uintptr_t)bump_alloc(0x18u);
      uint32_t pM0    = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      uint32_t pM1    = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pM0 + 0x00u) = pM1;
      U32(pM0 + 0x04u) = 50u; /* expired (< 100) */
      U32(pM1 + 0x00u) = 0u;
      U32(pM1 + 0x04u) = (k == 1) ? 200u : 60u;
      U32(pRNode + 0x08u) = pM0;
      U32(STAGE_GAME + 0xD8u) = pRNode;
    }
    c = make_call(); c.eax = 0u; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = 0;
    snprintf(lbl, sizeof(lbl), "aigeneral_expire_minions_k%d", k);
    run_and_emit(0x6FC3EB20u, "AIGENERAL_ExpireMinionListsInAct113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [M48] 0x6FC3F9F0 ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c
   * (s0=pGame, s1=pRoom, s2=pInactiveItemNode, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pNode = STAGE_SCRATCH;
    if (k == 0) {
      U16(pNode + 0x0Cu) = 8u;
    } else {
      uint32_t cid = (k == 1) ? g_item_ring : g_item_sword;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cid, 90u + (uint32_t)k, 3u, 2u, 5004u, 5004u, 850u + (uint32_t)k);
      int32_t nSer = fn_SerializeItemToBuf((void *)(uintptr_t)STAGE_UNIT1, (void *)(uintptr_t)(pNode + 0x0Eu), 0x180, 1, 1, 0);
      U32(pNode + 0x04u) = (k == 1) ? 0u : 500u;
      U16(pNode + 0x0Cu) = (uint16_t)nSer;
    }
    c = make_call();
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = pNode; c.calleePop = 0xCu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = pNode;
    snprintf(lbl, sizeof(lbl), "items_load_inactive_node_k%d", k);
    run_and_emit(0x6FC3F9F0u, "ITEMS_LoadItemAndSocketsFromBitstream_6FC3F9F0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
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
    fprintf(stderr, "[k6-p2] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
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
    fprintf(stderr, "[k6-p2] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p2] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-p2] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p2] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_group_1_d2common_31();
  emit_group_2_d2game_fixes();
  emit_group_3_d2game_6fc21xxx();
  emit_group_4_d2game_lovas();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p2] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
