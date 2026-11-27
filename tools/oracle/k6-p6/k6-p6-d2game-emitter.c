/*
 * k6-p6-d2game-emitter.c — [K6-P6] Real-DLL D2Game.dll Band A (0x6FC20000..0x6FC6FFFF) Emitter (150 VAs)
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

static void __attribute__((unused)) add_extra_cap(uint32_t canonAddr, uint32_t len) {
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

static uint32_t g_item_sword  = 0;
static uint32_t g_item_bow    = 0;
static uint32_t g_item_ring   = 0;
static uint32_t g_item_armor  = 0;
static uint32_t g_item_gold   = 0;
static uint32_t g_item_wand   = 0;
static uint32_t g_item_gem    = 0;
static uint32_t g_item_malus  = 0;
static uint32_t g_item_scroll = 0;
static uint32_t g_item_jav    = 0;

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
    fprintf(stderr, "[k6-p6] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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
      fprintf(stderr, "[k6-p6] missing Fog.#%u\n", fogHooks[i].ord);
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
    fprintf(stderr, "[k6-p6] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-p6] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_PREF_BASE + 0x99000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-p6] short read at page %u\n", i);
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
        fprintf(stderr, "[k6-p6] stage json overflow\n");
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

static uint32_t stage_timer_queue(void);

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

  /* Reset D2Game combat/AI/quest globals between cases */
  U32(game_global_live(D2GAME_PREF_BASE + 0x111C1Cu)) = 0u;
  U32(game_global_live(D2GAME_PREF_BASE + 0x111C20u)) = 0u;
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
  stage_timer_queue();
}

static uint32_t __attribute__((unused)) stage_timer_queue(void) {
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

static void __attribute__((unused)) stage_room_with_coll(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  stage_room(pRoom, pRoomEx, pLevel, levelId);
  U32(pLevel + 0x10u)      = pRoomEx;
  U32(pLevel + 0x1Cu)      = 998u;
  U32(pLevel + 0x20u)      = 998u;
  U32(pLevel + 0x24u)      = 6u;
  U32(pLevel + 0x28u)      = 6u;
  U32(pLevel + 0x2Cu)      = 900u;
  U32(pLevel + 0x30u)      = 900u;
  U32(pLevel + 0x34u)      = 11u;
  U32(pLevel + 0x1D8u)     = 1u;
  U32(STAGE_DRLG0 + 0x10u) = pRoomEx;
  U32(pRoomEx + 0x28u)    |= 0x01100000u;
  U32(pRoomEx + 0x34u)     = 998u;
  U32(pRoomEx + 0x38u)     = 998u;
  U32(pRoomEx + 0x3Cu)     = 6u;
  U32(pRoomEx + 0x40u)     = 6u;
  uint32_t pLog = (uint32_t)(uintptr_t)bump_alloc(0x40u);
  uint32_t pDefNode = (uint32_t)(uintptr_t)bump_alloc(0x30u);
  U32(pDefNode + 0x10u) = 998u;
  U32(pDefNode + 0x14u) = 998u;
  U32(pDefNode + 0x18u) = 6u;
  U32(pDefNode + 0x1Cu) = 6u;
  U32(pLog + 0x00u) = 1u;
  U32(pLog + 0x30u) = pDefNode;
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

static void __attribute__((unused)) insert_server_unit(uint32_t pGame, uint32_t pUnit) {
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

static void __attribute__((unused)) link_unit_into_room(uint32_t pRoom, uint32_t pUnit) {
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

static void __attribute__((unused)) stage_monster_full(
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

static void __attribute__((unused)) stage_item_unit(
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
            "[k6-p6] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-p6] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-p6] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-p6] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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
    if (!g_item_sword  && code == 0x20647373u) g_item_sword  = id; /* 'ssd ' */
    if (!g_item_bow    && code == 0x20776273u) g_item_bow    = id; /* 'sbw ' */
    if (!g_item_ring   && code == 0x206E6972u) g_item_ring   = id; /* 'rin ' */
    if (!g_item_armor  && code == 0x20697571u) g_item_armor  = id; /* 'qui ' */
    if (!g_item_gold   && code == 0x20646C67u) g_item_gold   = id; /* 'gld ' */
    if (!g_item_wand   && code == 0x20646E77u) g_item_wand   = id; /* 'wnd ' */
    if (!g_item_gem    && code == 0x20766367u) g_item_gem    = id; /* 'gcv ' */
    if (!g_item_malus  && code == 0x206D6468u) g_item_malus  = id; /* 'hdm ' */
    if (!g_item_scroll && code == 0x20736B62u) g_item_scroll = id; /* 'bks ' */
    if (!g_item_jav    && code == 0x2076616Au) g_item_jav    = id; /* 'jav ' */
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
      uint32_t pHold2 = (uint32_t)(uintptr_t)bump_alloc(0x14u);
      uint32_t pBits2 = (uint32_t)(uintptr_t)bump_alloc(8u);
      U32(pHold2 + 0x00u) = pBits2;
      U32(pHold2 + 0x04u) = 0x40u;
      U32(pPair + 0x00u) = pHold;
      U32(pPair + 0x04u) = pHold2;
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

static void __attribute__((unused)) set_quest_bit(uint32_t pRec, uint32_t qId, uint32_t subBit) {
  uint32_t pBuf = U32(pRec);
  uint32_t bitIdx = (qId << 4) + subBit;
  U8(pBuf + (bitIdx >> 3)) = (uint8_t)(U8(pBuf + (bitIdx >> 3)) | (1u << (bitIdx & 7u)));
}

static void __attribute__((unused)) stage_npc_dialog_table(uint32_t pQuest, uint32_t pTbl, uint32_t npcId) {
  U32(pQuest + 0xDCu) = pTbl;
  for (uint32_t s = 0u; s < 5u; s++) {
    uint32_t slot = pTbl + s * 0xC4u;
    U32(slot + 0x00u) = npcId;
    U16(slot + 0x04u) = (uint16_t)(0x0200u + s);
    U32(slot + 0x08u) = 1u + s;
    U32(slot + 0xC0u) = 1u;
  }
}

static void __attribute__((unused)) stage_player_quest_item(
    uint32_t pPlayer, uint32_t pItem, uint32_t pItemData, uint32_t pItemPath, uint32_t itemClassId, uint32_t itemGuid) {
  uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)pPlayer);
  U32(pPlayer + 0x60u) = pInv;
  stage_item_unit(pItem, pItemData, pItemPath, STAGE_ROOM0, itemClassId, itemGuid, 0u, 2u, 0u, 0u, 0u);
  U8(pItemData + 0x45u) = 0u;
  U32(pInv + 0x0Cu) = pItem;
  U32(pInv + 0x10u) = pItem;
  U32(pInv + 0x28u) = 1u;
  U32(pItemData + 0x5Cu) = pInv;
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

/* ------------------------------- Group 1 (38 Band A VAs) */

static void emit_group_1_d2game_p6(void) {
  X86CallSpec s;

  /* 1. 0x6FC5F540 MISSILE_SrvDo01_FastcallThunk113c (ecx=pMissile, edx=pGame) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (c == 0 ? 40u : 12u), 0x101u, 5005u, 5005u);
    U16(STAGE_PATH0 + 0x10u) = 5012u;
    U16(STAGE_PATH0 + 0x12u) = 5008u;
    U16(STAGE_UDATA0 + 0x0Au) = (uint16_t)(c == 1 ? 1u : 4u);
    U32(STAGE_PATH0 + 0x34u) = (c == 2 ? 64u : 0u);
    if (c == 2) {
      U32(STAGE_UNIT0 + 0x10u) = 1u;
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    }
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0 };
    run_and_emit(0x6FC5F540u, "MISSILE_SrvDo01_FastcallThunk113c", c,
        (c == 0 ? "static_rem4" : c == 1 ? "expire_rem1" : "moving_collide"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 2. 0x6FC58E60 MISSILE_ClearStateGfxRemoveProc113c (ecx=pUnit, edx=nState, [esp+4]=_pStatList, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x102u, 1u, 4850u, 4850u, 0x1111u);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 1u, 1);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 2u, 1);
    uint32_t st = (c == 0) ? 1u : (c == 1) ? 2u : 9u;
    s = make_call();
    s.ecx = STAGE_UNIT0;
    s.edx = st;
    s.nargs = 1;
    s.args[0] = 0u;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, (int64_t)st, 0 };
    run_and_emit(0x6FC58E60u, "MISSILE_ClearStateGfxRemoveProc113c", c,
        (c == 0 ? "clear_state1" : c == 1 ? "clear_state2" : "clear_unset9"), &s, tsArgs, 3, 0u, 0);
  }

  /* 3. 0x6FC5BB60 QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c (ecx=pGame, edx=pMissile, [esp+4]=pHitUnit, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 27u, 0x103u, 4850u, 4850u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x104u, 1u, 4852u, 4852u, 0x2222u);
    uint32_t pMis = (c == 1) ? 0u : STAGE_UNIT0;
    uint32_t pHit = (c == 0) ? STAGE_UNIT1 : 0u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = pMis;
    s.nargs = 1;
    s.args[0] = pHit;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, pMis, pHit };
    run_and_emit(0x6FC5BB60u, "QUESTS_Act3KurastTemplesSequenceFilter_6FC5BB60_113c", c,
        (c == 0 ? "nonzero_hitunit" : c == 1 ? "null_missile" : "staged_missile_null_hit"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 4. 0x6FC41880 MONUMOD_DispatchOnKillEvent5_113c (eax=pTarget, edx=pMonster, [esp+4]=pGame, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x10Fu, 0x201u, 1u, 100u, 100u, 0u);
    U8(STAGE_UDATA0 + 0x16u) = (c == 2) ? 0x08u : 0x00u; /* bIsUnique bit 3 */
    U8(STAGE_UDATA0 + 0x1Cu) = 19u;                     /* slot 5 callback (rogue sec dmg) */
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x17u, 5u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x18u, 12u, 0u);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 12u, 0x301u, 100u, 100u);
    U32(STAGE_UNIT1 + 0x94u) = 1u;
    U32(STAGE_UNIT1 + 0x98u) = 0x201u;
    U32(STAGE_UNIT1 + 0xC8u) = 0x400u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x15u, 100u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x16u, 300u, 0u);
    uint32_t pMon = (c == 0) ? 0u : STAGE_UNIT0;
    s = make_call();
    s.eax = STAGE_UNIT1;
    s.edx = pMon;
    s.nargs = 1;
    s.args[0] = STAGE_GAME;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT1, (int64_t)pMon, STAGE_GAME };
    run_and_emit(0x6FC41880u, "MONUMOD_DispatchOnKillEvent5_113c", c,
        (c == 0 ? "null_mon" : c == 1 ? "umod19_norm" : "umod19_unique"), &s, tsArgs, 3, 0u, 0);
  }

  /* 5. 0x6FC469B0 MONSTER_Event7_MonUModEvent2_113c (ecx=pGame, edx=pMonster, [esp+4]=0, [esp+8]=0, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0x1111u);
    U8(STAGE_UDATA0 + 0x1Cu) = (c == 0) ? 0u : 21u; /* slot 2 kill/unsummon */
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (c == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 0u;
    s.args[1] = 0u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 0, 0 };
    run_and_emit(0x6FC469B0u, "MONSTER_Event7_MonUModEvent2_113c", c,
        (c == 0 ? "no_umod" : c == 1 ? "umod21_kill" : "umod21_defer"), &s, tsArgs, 4, 0u, 0);
  }

  /* 6. 0x6FC53260 OBJECTS_SpawnDensityWithSecondaryTorch113c (ecx=pGame, edx=pRoom, args=[nDensity, nObjectId, nProb], ret 12) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pObjCtrl = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    U32(pObjCtrl + 0x00u) = 0x13572469u + (uint32_t)c * 97u;
    U32(pObjCtrl + 0x04u) = 0x29Au;
    U32(STAGE_GAME + 0x10F0u) = pObjCtrl;
    uint32_t dens = (c == 0) ? 0u : (c == 1) ? 3u : 5u;
    uint32_t objId = (c == 2) ? 5u : 2u;
    uint32_t prob = (c == 0) ? 0u : 100u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_ROOM0;
    s.nargs = 3;
    s.args[0] = dens;
    s.args[1] = objId;
    s.args[2] = prob;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_ROOM0, (int64_t)dens, (int64_t)objId, (int64_t)prob };
    run_and_emit(0x6FC53260u, "OBJECTS_SpawnDensityWithSecondaryTorch113c", c,
        (c == 0 ? "zero_density" : c == 1 ? "obj2_dens3" : "obj5_dens5"), &s, tsArgs, 5, 0xFFFFFFFFu, 0);
  }

  /* 7. 0x6FC55910 QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c (eax=pNpcUnit, ecx=pPlayerUnit, args=[pGame], ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x109u, 1u, 4850u, 4850u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (c == 2 ? 154u : 148u), 0x10Au, 1u, 4854u, 4854u, 0x3131u);
    U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    uint32_t qRec = alloc_quest_record();
    U32(STAGE_QUESTCTRL + 0x0Cu) = qRec;
    if (c == 1) set_quest_bit(qRec, 1u, 0u);
    if (c == 2) set_quest_bit(qRec, 2u, 1u);
    uint32_t npc = (c == 0) ? 0u : STAGE_UNIT1;
    uint32_t plr = STAGE_UNIT0;
    s = make_call();
    s.eax = npc;
    s.ecx = plr;
    s.nargs = 1;
    s.args[0] = STAGE_GAME;
    s.calleePop = 4;
    int64_t tsArgs[] = { npc, plr, STAGE_GAME };
    run_and_emit(0x6FC55910u, "QUESTS_TriggerNpcInteractAndSendPacket27_6FC55910_113c", c,
        (c == 0 ? "null_npc" : c == 1 ? "npc_148_plr" : "npc_154_plr"), &s, tsArgs, 3, 0u, 0);
  }

  /* 8. 0x6FC6EB50 SKILLS_InitNecroSkeletonPetComponents_6FC6EB50_113c (eax=pMonster, ecx=pOwnerUnit, args=[nSkillId, nSkillLevel], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x10Bu, 1u, 4850u, 4850u, STAGE_CLIENT);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 69, 5, 0, 0, 0); /* Raise Skeleton / Skeleton Mastery */
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 70, 5, 0, 0, 0);
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 80, 5, 0, 0, 0);
    uint32_t cls = (c == 0) ? 0x16Bu : (c == 1) ? 0x16Cu : 1u;
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cls, 0x10Cu, 1u, 4852u, 4852u, 0x4444u);
    s = make_call();
    s.eax = STAGE_UNIT1;
    s.ecx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (c == 1 ? 80u : 70u);
    s.args[1] = 5u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_UNIT1, STAGE_UNIT0, (c == 1 ? 80 : 70), 5 };
    run_and_emit(0x6FC6EB50u, "SKILLS_InitNecroSkeletonPetComponents_6FC6EB50_113c", c,
        (c == 0 ? "warrior_363" : c == 1 ? "mage_364" : "non_skeleton"), &s, tsArgs, 4, 0u, 0);
  }

  /* 9. 0x6FC4EE60 OBJECT_DestroyObjectUnit113c (eax=pGame, esi=pUnit) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 2u, 0x10Du, 0u, 4850u, 4850u, 0x5555u);
    uint32_t pObjReg = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(STAGE_UNIT0 + 0x7Cu) = pObjReg;
    if (c == 1) {
      uint32_t pEvt = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U8(pEvt + 0x00u) = 1u;
      U32(pEvt + 0x04u) = 120u;
      U32(pEvt + 0x08u) = STAGE_UNIT0;
      U32(STAGE_UNIT0 + 0xD8u) = pEvt;
    } else if (c == 2) {
      uint32_t pExtra = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(pExtra + 0x00u) = 0x1234u;
      U32(STAGE_UNIT0 + 0xA4u) = pExtra;
    }
    s = make_call();
    s.eax = STAGE_GAME;
    s.esi = STAGE_UNIT0;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0 };
    run_and_emit(0x6FC4EE60u, "OBJECT_DestroyObjectUnit113c", c,
        (c == 0 ? "plain_obj" : c == 1 ? "unit_with_evt" : "unit_with_a4"), &s, tsArgs, 2, 0u, 0);
  }

  /* 10. 0x6FC41E80 MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c (ecx=pMonster, args=[_nUModId], ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x10Eu, 1u, 4850u, 4850u, 0x6666u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0Cu, 10, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0Du, 1000, 0u);
    U8(STAGE_UDATA0 + 0x16u) = (uint8_t)(c == 0 ? 0u : c == 1 ? 0x04u : 0x08u);
    s = make_call();
    s.ecx = STAGE_UNIT0;
    s.nargs = 1;
    s.args[0] = (uint32_t)c;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, (int64_t)c, 0 };
    run_and_emit(0x6FC41E80u, "MONUMOD_ApplyBossLevelAndExpBonus_6FC41E80_113c", c,
        (c == 0 ? "normal_mon" : c == 1 ? "champ_flag4" : "boss_flag8"), &s, tsArgs, 3, 0u, 0);
  }

  /* 11. 0x6FC40E00 AIGENERAL_FindAiCommandByType113c (eax=pUnit, esi=nCmdType, args=[bSetCurrent], ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x10Fu, 1u, 4850u, 4850u, 0x7777u);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    uint32_t pCmd1 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    uint32_t pCmd2 = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    U32(pCmd1 + 0x00u) = pCmd2;
    U32(pCmd1 + 0x08u) = 3u;
    U32(pCmd2 + 0x00u) = pCmd1;
    U32(pCmd2 + 0x08u) = 7u;
    U32(pAiGen + 0x20u) = pCmd1;
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.esi = (c == 2 ? 99u : 7u);
    s.nargs = 1;
    s.args[0] = (c == 1 ? 1u : 0u);
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, (c == 2 ? 99 : 7), (c == 1 ? 1 : 0) };
    run_and_emit(0x6FC40E00u, "AIGENERAL_FindAiCommandByType113c", c,
        (c == 0 ? "find_no_set" : c == 1 ? "find_and_set" : "not_found"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 12. 0x6FC56820 QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c (eax=nPlaceId, ecx=nType, esi=pCoord, args=[pGame, pUnit], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_game_mon_region(1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x110u, 1u, 5005u, 5005u, STAGE_CLIENT);
    uint32_t pCoord = STAGE_SCRATCH;
    U32(pCoord + 0x00u) = (c == 2 ? 100u : 5008u);
    U32(pCoord + 0x04u) = (c == 2 ? 100u : 5008u);
    uint32_t placeId = (c == 0 ? 1u : 2u);
    s = make_call();
    s.eax = placeId;
    s.ecx = 1u;
    s.esi = pCoord;
    s.nargs = 2;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_UNIT0;
    s.calleePop = 8;
    int64_t tsArgs[] = { (int64_t)placeId, 1, pCoord, STAGE_GAME, STAGE_UNIT0 };
    run_and_emit(0x6FC56820u, "QUESTS_SpawnPresetMonsterAtCoord_6FC56820_113c", c,
        (c == 0 ? "spawn_id1" : c == 1 ? "spawn_id2" : "out_of_room"), &s, tsArgs, 5, 0xFFFFFFFFu, 0);
  }

  /* 13. 0x6FC5AFF0 MISSILE_ApplyDamageAndArmorShred113c (eax=pDmg, ecx=pGame, ebx=pMissile, esi=pDefender) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 12u, 0x111u, 4850u, 4850u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x112u, 1u, 4852u, 4852u, 0x8888u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x0Eu, 5000, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x0Fu, 5000, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x1Fu, 100, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x78u, (c == 0 ? 0 : c == 1 ? -25 : -200), 0u);
    U32(STAGE_DMG + 0x00u) = 0x20u;
    U32(STAGE_DMG + 0x08u) = (c == 0 ? 0x400u : 0x800u);
    s = make_call();
    s.eax = STAGE_DMG;
    s.ecx = STAGE_GAME;
    s.ebx = STAGE_UNIT0;
    s.esi = STAGE_UNIT1;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_DMG, STAGE_UNIT0, STAGE_UNIT1 };
    run_and_emit(0x6FC5AFF0u, "MISSILE_ApplyDamageAndArmorShred113c", c,
        (c == 0 ? "no_shred" : c == 1 ? "shred_25" : "shred_clamp0"), &s, tsArgs, 4, 0u, 0);
  }

  /* 14. 0x6FC468E0 MONSTER_DispatchMinionComponentCallbacks113c (ecx=pGame, edx=pUnit, [esp+4]=pArg0, [esp+8]=slot, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x10Fu, 0x201u, 1u, 5005u, 5005u, 0x1111u);
    U8(STAGE_UDATA0 + 0x1Cu) = (c == 1) ? 19u : 21u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t pArg0 = 0u;
    uint32_t slot = (c == 0) ? 9u : (c == 1) ? 5u : 2u;
    if (c == 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x17u, 6u, 0u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x18u, 11u, 0u);
      stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 12u, 0x301u, 5005u, 5005u);
      U32(STAGE_UNIT1 + 0x94u) = 1u;
      U32(STAGE_UNIT1 + 0x98u) = 0x201u;
      U32(STAGE_UNIT1 + 0xC8u) = 0x400u;
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x15u, 100u, 0u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x16u, 300u, 0u);
      pArg0 = STAGE_UNIT1;
    }
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = pArg0;
    s.args[1] = slot;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)pArg0, (int64_t)slot };
    run_and_emit(0x6FC468E0u, "MONSTER_DispatchMinionComponentCallbacks113c", c,
        (c == 0 ? "slot9_noop" : c == 1 ? "slot5_rogue_sec_dmg" : "slot2_umod21_kill"), &s, tsArgs, 4, 0u, 0);
  }

  /* 15. 0x6FC42B60 MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c (ecx=nUModId, edx=pUnit, args=[_arg0, bBoss], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x113u, 1u, 4850u, 4850u, 0x1111u + (uint32_t)c * 999u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0Cu, 10, 0u);
    uint32_t bBoss = (c == 0) ? 0u : 1u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 0u;
    s.args[1] = bBoss;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 0, (int64_t)bBoss };
    run_and_emit(0x6FC42B60u, "MONUMOD_ApplyRandomElementalHitBonus_6FC42B60_113c", c,
        (c == 0 ? "non_boss" : c == 1 ? "boss_seed1" : "boss_seed2"), &s, tsArgs, 4, 0u, 0);
  }

  /* 16. 0x6FC64390 SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c (ecx=pGame, edx=pUnit, args=[nSkillId, nSkillLevel], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x114u, 1u, 5005u, 5005u, STAGE_CLIENT);
    U16(STAGE_PATH0 + 0x10u) = 5010u;
    U16(STAGE_PATH0 + 0x12u) = 5010u;
    int32_t sk = (c == 0) ? -1 : (c == 1) ? 256 : 67;
    if (c >= 1) {
      uint32_t pSkList = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
      U32(STAGE_UNIT0 + 0xA8u) = pSkList;
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, sk, 3, 0, 0, 0);
      U32(pSkList + 0x0Cu) = U32(pSkList + 0x04u);
    }
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 3u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 3 };
    run_and_emit(0x6FC64390u, "SKILLS_SrvDo047_SpawnSkillMissileAtTargetPos_6FC64390_113c", c,
        (c == 0 ? "bad_skill" : c == 1 ? "shockfield_256" : "teeth_67"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 17. 0x6FC4CB80 DRLG_PopulateSingleRoom_6FC4CB80_113c (eax=pRoom, edi=pGame) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    uint32_t lvl = (c == 1) ? 2u : (c == 2) ? 3u : 1u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_game_mon_region(lvl);
    uint32_t pObjCtrl = (uint32_t)(uintptr_t)bump_alloc(0x300u);
    uint32_t pObjLvl  = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    U32(pObjCtrl + 0x00u) = 0x24681357u;
    U32(pObjCtrl + 0x04u) = 0x29Au;
    U32(pObjCtrl + 0x48u + lvl * 4u) = pObjLvl;
    U32(pObjLvl + 0x08u) = 0x7FFFFFFFu;
    U32(STAGE_GAME + 0x10F0u) = pObjCtrl;
    if (c == 0) {
      U32(STAGE_ROOM0 + 0x78u) = 1u; /* room flags already populated */
    }
    s = make_call();
    s.eax = STAGE_ROOM0;
    s.edi = STAGE_GAME;
    int64_t tsArgs[] = { STAGE_ROOM0, STAGE_GAME };
    run_and_emit(0x6FC4CB80u, "DRLG_PopulateSingleRoom_6FC4CB80_113c", c,
        (c == 0 ? "flagged_room" : c == 1 ? "level2_pop" : "level3_pop"), &s, tsArgs, 2, 0u, 0);
  }

  /* 18. 0x6FC588C0 PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c (esi=pPlayer, ebx=pGame, args=[pItem], ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x115u, 1u, 4850u, 4850u, STAGE_CLIENT);
    stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, g_item_sword, 0x116u, 0u, 2u, 0u, 0u, 0u);
    if (c == 1) {
      U32(STAGE_UNIT0 + 0xC4u) |= 0x2000u; /* interacting/trading flag */
    } else if (c == 2) {
      U32(STAGE_UDATA0 + 0x9Cu) = 0u; /* null client */
    }
    s = make_call();
    s.esi = STAGE_UNIT0;
    s.ebx = STAGE_GAME;
    s.nargs = 1;
    s.args[0] = STAGE_UNIT1;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_GAME, STAGE_UNIT1 };
    run_and_emit(0x6FC588C0u, "PLAYER_CanManipulateItemDuringInteractOrTrade_6FC588C0_113c", c,
        (c == 0 ? "normal_allow" : c == 1 ? "busy_flag" : "null_client"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 19. 0x6FC43670 MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c (ecx=pGame, edx=pMissile, args=[nUMod, bUnique], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x10Fu, 0x201u, 1u, 100u, 100u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x17u, (c == 0 ? 5u : 0u), 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x18u, (c == 0 ? 8u : 1u), 0u);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 12u, 0x301u, 100u, 100u);
    U32(STAGE_UNIT1 + 0x94u) = 1u;
    U32(STAGE_UNIT1 + 0x98u) = 0x201u;
    U32(STAGE_UNIT1 + 0xC8u) = (c == 1) ? 0u : 0x400u;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x15u, 100u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x16u, 300u, 0u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 2;
    s.args[0] = (uint32_t)(c + 1);
    s.args[1] = (uint32_t)(c == 0);
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (int64_t)(c + 1), (int64_t)(c == 0) };
    run_and_emit(0x6FC43670u, "MONUMOD_AddRogueOwnerSecondaryDamageToMissile_6FC43670_113c", c,
        (c == 0 ? "add_sec_dmg" : c == 1 ? "flag_off" : "clamp_min_zero"), &s, tsArgs, 4, 0u, 0);
  }

  /* 20. 0x6FC66CD0 REGPOP_CanPopulateRoom113c (ebx=pGame, edi=pRoom) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (c == 0 ? 1u : c == 1 ? 2u : 40u));
    stage_game_mon_region(2u);
    stage_game_mon_region(40u);
    if (c == 1) {
      U32(STAGE_ROOMEX0 + 0x24u) = 1u; /* flags */
    }
    s = make_call();
    s.ebx = STAGE_GAME;
    s.edi = STAGE_ROOM0;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_ROOM0 };
    run_and_emit(0x6FC66CD0u, "REGPOP_CanPopulateRoom113c", c,
        (c == 0 ? "town_act1" : c == 1 ? "level2_blood_moor" : "act2_town40"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 21. 0x6FC6F450 SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c (esi=pUnit, ebx=pGame) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cls = (c == 2) ? 1u : 3u; /* 3 = Paladin, 1 = Sorceress */
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 0x117u, 1u, 4850u, 4850u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x06u, 8000, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x07u, (c == 1 ? 16000 : 8000), 0u);
    s = make_call();
    s.esi = STAGE_UNIT0;
    s.ebx = STAGE_GAME;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_GAME };
    run_and_emit(0x6FC6F450u, "SKILLS_ApplyPaladinEighthMaxLifeCost_6FC6F450_113c", c,
        (c == 0 ? "pal_8k_max8k" : c == 1 ? "pal_8k_max16k" : "sorc_noop"), &s, tsArgs, 2, 0u, 0);
  }

  /* 22. 0x6FC6C220 SKILLS_AuraCallback_ApplyAuraStatListFromCtx_6FC6C220_113c (ecx=pAuraCtx, edx=pTargetUnit) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x118u, 1u, 4850u, 4850u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x119u, 1u, 4852u, 4852u, 0x9999u);
    uint32_t pCtx = STAGE_SCRATCH;
    uint32_t pSub = STAGE_SCRATCH + 0x40u;
    U32(pCtx + 0x04u) = STAGE_UNIT0; /* pCaster */
    U32(pCtx + 0x0Cu) = pSub;
    U32(pSub + 0x00u) = 98u; /* Might */
    U32(pSub + 0x04u) = 5u;
    U32(pSub + 0x08u) = 17u;
    U32(pSub + 0x0Cu) = (c == 0 ? 1u : c == 1 ? 2u : 101u); /* stateId at +0x0C -> +0x1C */
    U32(pSub + 0x10u) = 250u;
    U32(pSub + 0x14u) = 0x15u + (uint32_t)c * 5u;
    s = make_call();
    s.ecx = pCtx;
    s.edx = STAGE_UNIT1;
    int64_t tsArgs[] = { pCtx, STAGE_UNIT1 };
    run_and_emit(0x6FC6C220u, "SKILLS_AuraCallback_ApplyAuraStatListFromCtx_6FC6C220_113c", c,
        (c == 0 ? "state1" : c == 1 ? "state2" : "state101"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 23. 0x6FC44BF0 MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c (eax=pMonster, ecx=pGame, args=[bUModId], ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x11Au, 1u, 4850u, 4850u, 0xAAAAu);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0Cu, 12, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x0Du, 500, 0u);
    uint32_t umod = (c == 0) ? 5u : (c == 1) ? 7u : 9u;
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.ecx = STAGE_GAME;
    s.nargs = 1;
    s.args[0] = umod;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_GAME, (int64_t)umod };
    run_and_emit(0x6FC44BF0u, "MONUMOD_PromoteToBossWithSingleUMod_6FC44BF0_113c", c,
        (c == 0 ? "umod_5" : c == 1 ? "umod_7" : "umod_9"), &s, tsArgs, 3, 0u, 0);
  }

  /* 24. 0x6FC67880 MONSTER_SpawnChampionPackMembers_6FC67880_113c (esi=pLeader, ebx=nClassId, edi=pGame, args=[pCoordNode], ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x11Bu, 1u, 5005u, 5005u, 0xBBBBu + (uint32_t)c * 17u);
    if (c >= 1) {
      U8(STAGE_UDATA0 + 0x16u) = 0x04u; /* champion flag */
    }
    uint32_t pNode = STAGE_SCRATCH;
    U32(pNode + 0x10u) = 999u;
    U32(pNode + 0x14u) = 999u;
    U32(pNode + 0x18u) = 4u;
    U32(pNode + 0x1Cu) = 4u;
    s = make_call();
    s.esi = STAGE_UNIT0;
    s.ebx = (c == 2 ? 2u : 1u);
    s.edi = STAGE_GAME;
    s.nargs = 1;
    s.args[0] = pNode;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, (c == 2 ? 2 : 1), STAGE_GAME, pNode };
    run_and_emit(0x6FC67880u, "MONSTER_SpawnChampionPackMembers_6FC67880_113c", c,
        (c == 0 ? "non_champ" : c == 1 ? "champ_mon1" : "champ_mon2"), &s, tsArgs, 4, 0u, 0);
  }

  /* 25. 0x6FC64550 SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c (ecx=pGame, edx=pUnit, args=[nSkillId, nSkillLevel], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x11Cu, 1u, 5005u, 5005u, STAGE_CLIENT);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x08u, (c == 1 ? 100 : 10000), 0u);
    int32_t sk = (c == 0) ? -1 : 36;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC64550u, "SKILLS_SrvSt25_InfernoCheckManaAndStart_6FC64550_113c", c,
        (c == 0 ? "bad_skill" : c == 1 ? "low_mana" : "ok_mana"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 26. 0x6FC63450 SKILLS_SrvDo029_Teleport_6FC63450_113c (ecx=pGame, edx=pUnit, args=[nSkillId, nSkillLevel], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (c == 2 ? 1u : 2u));
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x11Du, 1u, 5002u, 5002u, STAGE_CLIENT);
    U16(STAGE_PATH0 + 0x10u) = (c == 1 ? 5012u : 5008u);
    U16(STAGE_PATH0 + 0x12u) = (c == 1 ? 5014u : 5009u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 54u;
    s.args[1] = 1u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 54, 1 };
    run_and_emit(0x6FC63450u, "SKILLS_SrvDo029_Teleport_6FC63450_113c", c,
        (c == 0 ? "wilderness_pos1" : c == 1 ? "wilderness_pos2" : "town_pos"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 27. 0x6FC49720 SKILLS_SrvDo045_NovaAndTimedAura_6FC49720_113c (ecx=pGame, edx=pUnit, args=[nSkillId, nSkillLevel], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x11Eu, 1u, 5005u, 5005u, STAGE_CLIENT);
    int32_t sk = (c == 0) ? -1 : (c == 1) ? 48 : 44;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 3u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 3 };
    run_and_emit(0x6FC49720u, "SKILLS_SrvDo045_NovaAndTimedAura_6FC49720_113c", c,
        (c == 0 ? "bad_skill" : c == 1 ? "nova_48" : "frostnova_44"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 28. 0x6FC4CF30 GAME_DeactivateUnusedRoomsTick113c (args=[pGame], ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    if (c >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      U32(STAGE_ROOMEX0 + 0x00u) = (c == 2 ? 0x14u : 0x02u); /* idle counter field or similar */
      if (c == 2) {
        stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x11Fu, 1u, 4850u, 4850u, 0xCCCCu);
        link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
        insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      }
    }
    s = make_call();
    s.nargs = 1;
    s.args[0] = STAGE_GAME;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME };
    run_and_emit(0x6FC4CF30u, "GAME_DeactivateUnusedRoomsTick113c", c,
        (c == 0 ? "no_acts" : c == 1 ? "active_room_empty" : "room_with_unit"), &s, tsArgs, 1, 0u, 0);
  }

  /* 29. 0x6FC56140 QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c (esi=pMonsterUnit, args=[pGame], ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    uint32_t lvl = (c == 0) ? 1u : 76u; /* 76 = Spider Forest (Act 3) */
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (c == 1 ? 0x197u : 1u), 0x120u, 1u, 4850u, 4850u, 0xDDDDu);
    U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u) = 0x12u; /* Golden Bird */
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x09u)  = (uint8_t)(c >= 1 ? 1u : 0u);
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0x01u) = 1u;
    U8(STAGE_QUESTEX0 + 0x0Cu) = 1u;
    s = make_call();
    s.esi = STAGE_UNIT0;
    s.nargs = 1;
    s.args[0] = STAGE_GAME;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_GAME };
    run_and_emit(0x6FC56140u, "QUESTS_OnBossMonsterSpawnedCheckAct3GoldenBird_6FC56140_113c", c,
        (c == 0 ? "act1_skip" : c == 1 ? "act3_mephisto_skip" : "act3_active"), &s, tsArgs, 2, 0u, 0);
  }

  /* 30. 0x6FC55B60 QUESTS_SendNpcIntroPacket91_6FC55B60_113c (eax=pPlayerUnit, ebx=nAct, args=[pGame], ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x121u, 1u, 4850u, 4850u, STAGE_CLIENT);
    uint32_t pPair0 = U32(STAGE_UDATA0 + 0x60u);
    uint32_t pBits2 = U32(U32(pPair0 + 0x04u));
    U32(pBits2 + 0x00u) = 0xFFFFFFFFu;
    U32(pBits2 + 0x04u) = 0xFFFFFFFFu;
    uint32_t act = (c == 0) ? 0u : (c == 1) ? 1u : 3u;
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.ebx = act;
    s.nargs = 1;
    s.args[0] = STAGE_GAME;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, (int64_t)act, STAGE_GAME };
    run_and_emit(0x6FC55B60u, "QUESTS_SendNpcIntroPacket91_6FC55B60_113c", c,
        (c == 0 ? "act0" : c == 1 ? "act1" : "act3_skip"), &s, tsArgs, 3, 0u, 0);
  }

  /* 31. 0x6FC5AB30 MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c (ecx=pGame, edx=pMissile, args=[pHitUnit], ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x122u, 1u, 5005u, 5005u, STAGE_CLIENT);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (c == 0 ? 12u : 38u), 0x123u, 5008u, 5008u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x122u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t hit = (c == 2) ? STAGE_UNIT0 : 0u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = hit;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, hit };
    run_and_emit(0x6FC5AB30u, "MISSILE_SrvHit_SpawnSubMissileAndCopyTargetX_6FC5AB30_113c", c,
        (c == 0 ? "no_submissile" : c == 1 ? "spawn_sub38" : "nonzero_hitunit"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 32. 0x6FC43BF0 MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c (ecx=pGame, edx=pMonster, args=[_pAttacker, _dwArg], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_game_mon_region(1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x124u, 0u, 4850u, 4850u, 0x1234u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x125u, 1u, 4854u, 4854u, 0x5678u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (c >= 1) {
      uint32_t pAi0 = U32(STAGE_UDATA0 + 0x28u);
      U32(pAi0 + 0x28u) = STAGE_GAME;
      U32(pAi0 + 0x2Cu) = (c == 1 ? 0x124u : 0x125u);
      U32(pAi0 + 0x30u) = 1u;
      uint32_t pAi1 = U32(STAGE_UDATA1 + 0x28u);
      U32(pAi1 + 0x28u) = STAGE_GAME;
      U32(pAi1 + 0x2Cu) = 0x125u;
      U32(pAi1 + 0x30u) = 1u;
    }
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = (c == 0 ? 0u : STAGE_UNIT0);
    s.nargs = 2;
    s.args[0] = 0u;
    s.args[1] = 0u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, (c == 0 ? 0 : STAGE_UNIT0), 0, 0 };
    run_and_emit(0x6FC43BF0u, "MONUMOD_PropagatePackDeathToBoss_6FC43BF0_113c", c,
        (c == 0 ? "null_monster" : c == 1 ? "self_boss" : "separate_boss"), &s, tsArgs, 4, 0u, 0);
  }

  /* 33. 0x6FC65600 SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c (ecx=pGame, edx=pUnit, args=[nSkillId, nSkillLevel], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x126u, 1u, 5005u, 5005u, STAGE_CLIENT);
    U16(STAGE_PATH0 + 0x10u) = 5012u;
    U16(STAGE_PATH0 + 0x12u) = 5012u;
    int32_t sk = (c == 0) ? -1 : (c == 1) ? 12 : 67;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 3u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 3 };
    run_and_emit(0x6FC65600u, "SKILLS_SrvDo035_MultipleShotSpreadMissiles_6FC65600_113c", c,
        (c == 0 ? "bad_skill" : c == 1 ? "multishot_12" : "teeth_67"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 34. 0x6FC63720 SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c (ecx=pGame, edx=pUnit, args=[nSkillId, nSkillLevel], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x127u, 1u, 5005u, 5005u, STAGE_CLIENT);
    U16(STAGE_PATH0 + 0x10u) = 5010u;
    U16(STAGE_PATH0 + 0x12u) = 5010u;
    int32_t sk = (c == 0) ? -1 : (c == 1) ? 256 : 36;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 3u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 3 };
    run_and_emit(0x6FC63720u, "SKILLS_SrvDo043_SpawnSrvMissileWithRange_6FC63720_113c", c,
        (c == 0 ? "bad_skill" : c == 1 ? "shockfield_256" : "firebolt_36"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 35. 0x6FC622B0 STATES_OnBuffStateRemovedRefreshAnim_6FC622B0_113c (ecx=pUnit, edx=nState, args=[0], ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x128u, 1u, 4850u, 4850u, 0xEEEEu);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 1u, 1);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 2u, 1);
    uint32_t st = (c == 0) ? 1u : (c == 1) ? 2u : 9u;
    s = make_call();
    s.ecx = STAGE_UNIT0;
    s.edx = st;
    s.nargs = 1;
    s.args[0] = 0u;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, (int64_t)st, 0 };
    run_and_emit(0x6FC622B0u, "STATES_OnBuffStateRemovedRefreshAnim_6FC622B0_113c", c,
        (c == 0 ? "remove_state1" : c == 1 ? "remove_state2" : "remove_unset9"), &s, tsArgs, 3, 0u, 0);
  }

  /* 36. 0x6FC59CE0 MISSILES_ConvertPhysToElemDamageByCalc_6FC59CE0_113c (ecx=pGame, edx=pMissile, args=[0, pDamage], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (c == 0 ? 12u : c == 1 ? 27u : 40u), 0x129u, 4850u, 4850u);
    U32(STAGE_DMG + 0x08u) = 0x1000u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = (c == 2 ? 0u : STAGE_UNIT0);
    s.nargs = 2;
    s.args[0] = 0u;
    s.args[1] = STAGE_DMG;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, (c == 2 ? 0 : STAGE_UNIT0), 0, STAGE_DMG };
    run_and_emit(0x6FC59CE0u, "MISSILES_ConvertPhysToElemDamageByCalc_6FC59CE0_113c", c,
        (c == 0 ? "firearrow_12" : c == 1 ? "magicarrow_27" : "null_missile"), &s, tsArgs, 4, 0u, 0);
  }

  /* 37. 0x6FC63AA0 SKILLS_SrvDo_NovaRing113c (ecx=pGame, edx=pUnit, args=[nSkillId, nLevel], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x12Au, 1u, 5005u, 5005u, STAGE_CLIENT);
    int32_t sk = (c == 0) ? -1 : (c == 1) ? 44 : 48;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 2u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 2 };
    run_and_emit(0x6FC63AA0u, "SKILLS_SrvDo_NovaRing113c", c,
        (c == 0 ? "bad_skill" : c == 1 ? "frost_nova_44" : "nova_48"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 38. 0x6FC565E0 D2Game_6FC565E0_113c (eax=pItem, ecx=pPlayer, args=[pGame, pInventory], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x12Bu, 1u, 4850u, 4850u, STAGE_CLIENT);
    stage_player_quest_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, (c == 2 ? g_item_malus : g_item_scroll), 0x12Cu);
    uint32_t pInv = U32(STAGE_UNIT0 + 0x60u);
    if (c == 1) {
      U32(STAGE_UNIT1 + 0x10u) = 4u; /* cursor */
      U32(pInv + 0x20u) = STAGE_UNIT1;
    } else if (c == 2) {
      U32(STAGE_UNIT1 + 0x10u) = 2u; /* belt/no-op mode */
    }
    s = make_call();
    s.eax = STAGE_UNIT1;
    s.ecx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = STAGE_GAME;
    s.args[1] = pInv;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_UNIT1, STAGE_UNIT0, STAGE_GAME, pInv };
    run_and_emit(0x6FC565E0u, "D2Game_6FC565E0_113c", c,
        (c == 0 ? "grid_mode0" : c == 1 ? "cursor_mode4" : "equipped_mode1"), &s, tsArgs, 4, 0u, 0);
  }
}

/* ------------------------------- Group 2 Helpers & Group 2a (19 Band A VAs) */

static uint32_t stage_obj_ctrl(void) {
  uint32_t pCtrl = (uint32_t)(uintptr_t)bump_alloc(0x80u);
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
  U32(STAGE_GAME + 0x10F0u) = pCtrl;
  return pCtrl;
}

static void emit_group_2a_d2game_p6(void) {
  X86CallSpec s;

  /* 39. 0x6FC4ED70 OBJECTS_PickShrineIdFromControlGroup113c (al=nGroupIdx, [esp+4]=pGame, [esp+8]=nLevelId, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    uint32_t pCtrl = stage_obj_ctrl();
    U32(pCtrl + 0x00u) = 0x13579BDFu + (uint32_t)c * 0x01010101u;
    uint32_t grp = (uint32_t)(1 + c);
    uint32_t lvl = (uint32_t)(2 + c * 20);
    s = make_call();
    s.eax = grp;
    s.nargs = 2;
    s.args[0] = STAGE_GAME;
    s.args[1] = lvl;
    s.calleePop = 8;
    int64_t tsArgs[] = { (int64_t)grp, STAGE_GAME, (int64_t)lvl };
    run_and_emit(0x6FC4ED70u, "OBJECTS_PickShrineIdFromControlGroup113c", c,
        (c == 0 ? "grp1_lvl2" : c == 1 ? "grp2_lvl22" : "grp3_lvl42"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 40. 0x6FC6E2A0 SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c (eax=pOwner, ecx=nOverrideLevel, [esp+4..C], ret C) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x10Fu, 0x201u, 1u, 4852u, 4852u, 0x5678u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10 + c * 5, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 10, 0);
    uint32_t ov = (c == 0) ? 0u : (uint32_t)(5 + c * 3);
    int32_t bon = (c == 2) ? 100 : (c * 25);
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.ecx = ov;
    s.nargs = 3;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_UNIT1;
    s.args[2] = (uint32_t)bon;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_UNIT0, (int64_t)ov, STAGE_GAME, STAGE_UNIT1, (int64_t)bon };
    run_and_emit(0x6FC6E2A0u, "SKILLS_ApplySummonLevelAcAndToHit_6FC6E2A0_113c", c,
        (c == 0 ? "owner_lvl_bon0" : c == 1 ? "ov8_bon25" : "ov11_bon100"), &s, tsArgs, 5, 0xFFFFFFFFu, 0);
  }

  /* 41. 0x6FC630D0 SrvDoFunc_020_StaticField113c (ecx=pGame, edx=pUnit, [esp+4]=nSkillId, [esp+8]=nSkillLevel, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5007u, 5005u, 0x5678u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 1000 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 1000 << 8, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    int32_t sk = (c == 2) ? -1 : 42;
    int32_t sl = (c == 0) ? 1 : 8;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = (uint32_t)sl;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, (int64_t)sl };
    run_and_emit(0x6FC630D0u, "SrvDoFunc_020_StaticField113c", c,
        (c == 0 ? "static_lvl1" : c == 1 ? "static_lvl8" : "invalid_skill"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 42. 0x6FC5F220 MISSILES_SrvDmg36_SpawnSubMissilesAndCollideRet3_6FC5F220_113c (ecx=pGame, edx=pMissile, [esp+4]=pTarget, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t mid = (c == 0) ? 388u : (c == 1) ? 85u : 0xFFFFFFFFu;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5007u, 5007u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = (c == 0) ? 256u : 56u;
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5008u, 5008u, 0x2222u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = (c == 2) ? 0u : STAGE_UNIT2;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (c == 2) ? 0 : STAGE_UNIT2 };
    run_and_emit(0x6FC5F220u, "MISSILES_SrvDmg36_SpawnSubMissilesAndCollideRet3_6FC5F220_113c", c,
        (c == 0 ? "shockfield_388" : c == 1 ? "immo_85" : "invalid_mid"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 43. 0x6FC47E30 SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c (ecx=pGame, edx=pUnit, [esp+4]=nSkillId, [esp+8]=nSkillLevel, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 12, 4, 0, 0, 0);
    U32(pSk + 0x08u) = U32(pSk + 0x04u);
    U32(pSk + 0x10u) = U32(pSk + 0x04u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = 5010u;
    U16(STAGE_PATH0 + 0x12u) = 5008u;
    if (c < 2) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0,
          (c == 0 ? g_item_jav : g_item_sword), 0x201u, 0u, 1u, 0u, 0u, 0u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 70, 20, 0);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4);
    }
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 12u;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 12, 4 };
    run_and_emit(0x6FC47E30u, "SKILLS_SrvDo024_SpawnWeaponMissileWithToHitAndBonusDmg_6FC47E30_113c", c,
        (c == 0 ? "jav_missile" : c == 1 ? "sword_no_missile" : "unarmed"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 44. 0x6FC45E60 MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c (ecx=pGame, edx=pUnit, [esp+4]=0, [esp+8]=0, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cid = (c == 0) ? 0x9Cu : (c == 1) ? 0xF2u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 0x101u, 0u, 5005u, 5005u, 0x1234u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 0u;
    s.args[1] = 0u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 0, 0 };
    run_and_emit(0x6FC45E60u, "MONSTER_OnDeathBossSpecialEffect_6FC45E60_113c", c,
        (c == 0 ? "andariel_9c" : c == 1 ? "diablo_f2" : "normal_mon1"), &s, tsArgs, 4, 0u, 0);
  }

  /* 45. 0x6FC639A0 SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c (esi=pUnit, [esp+4]=pGame, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (c == 2 ? 1u : 2u));
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (c == 0 || c == 2) U32(STAGE_PATH0 + 0x34u) |= 0x08u;
    stage_prog_charge_state(STAGE_UNIT0, 0x0D, 46, 5, 0x15F, 5);
    s = make_call();
    s.esi = STAGE_UNIT0;
    s.nargs = 1;
    s.args[0] = STAGE_GAME;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_GAME };
    run_and_emit(0x6FC639A0u, "SKILLS_SpawnBlazeTrailMissileOnStep_6FC639A0_113c", c,
        (c == 0 ? "blaze_step" : c == 1 ? "no_step_flag" : "in_town"), &s, tsArgs, 2, 0u, 0);
  }

  /* 46. 0x6FC6C2A0 SKILLS_SrvDo_ApplyRadiusAuraStatList_6FC6C2A0_113c (ecx=pGame, edx=pUnit, [esp+4]=sk, [esp+8]=sl, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5006u, 5006u, 0x2222u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    int32_t sk = (c == 0) ? 66 : (c == 1) ? 98 : -1;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC6C2A0u, "SKILLS_SrvDo_ApplyRadiusAuraStatList_6FC6C2A0_113c", c,
        (c == 0 ? "amp_dmg_66" : c == 1 ? "might_98" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 47. 0x6FC648E0 SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c (eax=pTxt, [esp+4]=pUnit, [esp+8]=pStatList, [esp+C]=sk, [esp+10]=sl, ret 10) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0);
    void *pSl = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
    int32_t sk = (c == 0) ? 52 : (c == 1) ? 98 : 108;
    s = make_call();
    s.eax = 0u;
    s.nargs = 4;
    s.args[0] = STAGE_UNIT0;
    s.args[1] = (uint32_t)(uintptr_t)pSl;
    s.args[2] = (uint32_t)sk;
    s.args[3] = (uint32_t)(3 + c * 4);
    s.calleePop = 16;
    int64_t tsArgs[] = { 0, STAGE_UNIT0, (int64_t)(uint32_t)(uintptr_t)pSl, (int64_t)sk, (int64_t)(3 + c * 4) };
    run_and_emit(0x6FC648E0u, "SKILLS_ApplySkillAuraStatCalcs_6FC648E0_113c", c,
        (c == 0 ? "enchant_52" : c == 1 ? "might_98" : "aim_108"), &s, tsArgs, 5, 0u, 0);
  }

  /* 48. 0x6FC66B20 REGPOP_IsNearTownExitOrWaypoint113c (ecx=pRoom, eax=y, [esp+4]=pGame, [esp+8]=x, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    uint32_t pLvl = (uint32_t)(uintptr_t)bump_alloc(0x280u);
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, pLvl, 2u);
    U32(pLvl + 0x1E0u + 0x00u) = 5004u;
    U32(pLvl + 0x1E0u + 0x24u) = 5004u;
    U32(pLvl + 0x1E0u + 0x48u) = 1u;
    uint32_t px = (c == 0) ? 5006u : (c == 1) ? 5150u : 5004u;
    uint32_t py = (c == 0) ? 5006u : (c == 1) ? 5150u : 5004u;
    s = make_call();
    s.ecx = (c == 2) ? 0u : STAGE_ROOM0;
    s.eax = py;
    s.nargs = 2;
    s.args[0] = STAGE_GAME;
    s.args[1] = px;
    s.calleePop = 8;
    int64_t tsArgs[] = { (c == 2) ? 0 : STAGE_ROOM0, (int64_t)py, STAGE_GAME, (int64_t)px };
    run_and_emit(0x6FC66B20u, "REGPOP_IsNearTownExitOrWaypoint113c", c,
        (c == 0 ? "near_border" : c == 1 ? "far_from_border" : "null_room"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 49. 0x6FC43AE0 MONUMOD_RollRandomChampionMod_6FC43AE0_113c (eax=pGame, [esp+4]=pUnit, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0x1111u + (uint32_t)c);
    U8(STAGE_GAME + 0x6Du) = (uint8_t)((c == 2) ? 2u : (uint32_t)c);
    U32(STAGE_GAME + 0xD0u) = 0x11111111u + (uint32_t)c * 0x2345u;
    s = make_call();
    s.eax = STAGE_GAME;
    s.nargs = 1;
    s.args[0] = STAGE_UNIT0;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0 };
    run_and_emit(0x6FC43AE0u, "MONUMOD_RollRandomChampionMod_6FC43AE0_113c", c,
        (c == 0 ? "diff0_norm" : c == 1 ? "diff1_nm" : "diff2_hell"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 50. 0x6FC67950 ROOM_TickSeedAndAmbientSpawn113c (esi=pRoom, [esp+4]=pGame, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (c == 0) {
      U32(STAGE_ROOM0 + 0x6Cu) = 0x11111111u;
      U32(STAGE_ROOM0 + 0x70u) = 0x22222222u;
    } else if (c == 1) {
      U32(STAGE_ROOM0 + 0x6Cu) = 0xABCDEF01u;
      U32(STAGE_ROOM0 + 0x70u) = 0x12345678u;
    } else {
      U32(STAGE_ROOM0 + 0x6Cu) = 0u;
      U32(STAGE_ROOM0 + 0x70u) = 0x8000u;
      U32(STAGE_ROOM0 + 0x78u) = 1u; /* numClients != 0 skips ambient spawn */
    }
    s = make_call();
    s.esi = STAGE_ROOM0;
    s.nargs = 1;
    s.args[0] = STAGE_GAME;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_ROOM0, STAGE_GAME };
    run_and_emit(0x6FC67950u, "ROOM_TickSeedAndAmbientSpawn113c", c,
        (c == 0 ? "seed_step_a" : c == 1 ? "seed_step_b" : "lo_zero_clients_present"), &s, tsArgs, 2, 0u, 0);
  }

  /* 51. 0x6FC647D0 SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c (eax=pTxt, [esp+4]=pUnit, [esp+8]=pStatList, [esp+C]=sk, [esp+10]=sl, ret 10) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0);
    void *pSl = fn_AllocStatList(NULL, 0x40u, 0u, 0, 1);
    int32_t sk = (c == 0) ? 108 : (c == 1) ? 141 : 100;
    s = make_call();
    s.eax = 0u;
    s.nargs = 4;
    s.args[0] = STAGE_UNIT0;
    s.args[1] = (uint32_t)(uintptr_t)pSl;
    s.args[2] = (uint32_t)sk;
    s.args[3] = (uint32_t)(4 + c * 3);
    s.calleePop = 16;
    int64_t tsArgs[] = { 0, STAGE_UNIT0, (int64_t)(uint32_t)(uintptr_t)pSl, (int64_t)sk, (int64_t)(4 + c * 3) };
    run_and_emit(0x6FC647D0u, "SKILLS_ApplySkillPassiveStatCalcs_6FC647D0_113c", c,
        (c == 0 ? "aim_108" : c == 1 ? "stamina_141" : "resfire_100"), &s, tsArgs, 5, 0u, 0);
  }

  /* 52. 0x6FC654E0 SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c (eax=bDir, ecx=sl, edx=pUnit, [esp+4]=pGame, [esp+8]=nCnt, [esp+C]=nMis, [esp+10]=nSk, ret 10) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = 5012u;
    U16(STAGE_PATH0 + 0x12u) = 5008u;
    uint32_t bDir = (c == 0) ? 1u : 0u;
    uint32_t cnt  = (uint32_t)(1 + c * 2);
    s = make_call();
    s.eax = bDir;
    s.ecx = 4u;
    s.edx = STAGE_UNIT0;
    s.nargs = 4;
    s.args[0] = STAGE_GAME;
    s.args[1] = cnt;
    s.args[2] = 40u;
    s.args[3] = 38u;
    s.calleePop = 16;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 38, 4, 40, (int64_t)cnt, (int64_t)bDir };
    run_and_emit(0x6FC654E0u, "SKILLS_SpawnSpreadProjectilesAtTargetOrPath_6FC654E0_113c", c,
        (c == 0 ? "cnt1_direct" : c == 1 ? "cnt3_spread" : "cnt5_spread"), &s, tsArgs, 7, 0xFFFFFFFFu, 0);
  }

  /* 53. 0x6FC6EA30 SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c (eax=pPlayer, ecx=nHealAmount, esi=pGame, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x122u, 0x201u, 1u, 4852u, 4852u, 0x2222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 1000 << 8, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (c < 2) {
      uint32_t pHolder  = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      uint32_t pBuckets = (uint32_t)(uintptr_t)bump_alloc(0x40u);
      uint32_t pNode    = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(pNode + 0x00u) = 0u;
      U32(pNode + 0x04u) = 0x201u;
      U32(pBuckets + 0x24u) = pNode;
      U32(pHolder) = pBuckets;
      U32(STAGE_UDATA0 + 0x44u) = pHolder;
    }
    int32_t heal = (c == 0) ? 0 : 500;
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.ecx = (uint32_t)heal;
    s.esi = STAGE_GAME;
    int64_t tsArgs[] = { STAGE_UNIT0, (int64_t)heal, STAGE_GAME };
    run_and_emit(0x6FC6EA30u, "SKILLS_HealBloodGolemFromPlayerHeal_6FC6EA30_113c", c,
        (c == 0 ? "heal0_full" : c == 1 ? "heal500_partial" : "no_pet"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 54. 0x6FC52BC0 OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c (ecx=pGame, edx=pRoom, [esp+4]=nDen, [esp+8]=nObj, [esp+C]=nProb, ret C) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_obj_ctrl();
    if (c == 2) U32(STAGE_ROOM0 + 0x6Cu) = 0x11111113u;
    uint32_t den   = (c == 0) ? 128u : 64u;
    uint32_t objId = (c == 1) ? 2u : 1u;
    uint32_t prob  = (c == 2) ? 0u : 100u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_ROOM0;
    s.nargs = 3;
    s.args[0] = den;
    s.args[1] = objId;
    s.args[2] = prob;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_ROOM0, (int64_t)den, (int64_t)objId, (int64_t)prob };
    run_and_emit(0x6FC52BC0u, "OBJECTS_SpawnSingleDensityObjectInRoom_6FC52BC0_113c", c,
        (c == 0 ? "den128_obj1_p100" : c == 1 ? "den64_obj2_p100" : "den64_obj1_p0"), &s, tsArgs, 5, 0xFFFFFFFFu, 0);
  }

  /* 55. 0x6FC43100 MONUMOD_CheckModEligibility_6FC43100_113c ([esp+4]=pMon, [esp+8]=pRec, [esp+C]=bExp, ret C) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (c == 1 ? 0x9Cu : 1u), 0x101u, 1u, 4850u, 4850u, 0x1111u);
    uint32_t pTables = U32(D2COM_PREF_BASE + 0x99E1Cu + g_com_rebase);
    uint32_t pMonUMod = U32(pTables + 0xC50u);
    uint32_t modId = (uint32_t)(5 + c * 2);
    uint32_t pRec = pMonUMod + modId * 0x20u;
    uint32_t bExp = (c == 2) ? 0u : 1u;
    s = make_call();
    s.nargs = 3;
    s.args[0] = STAGE_UNIT0;
    s.args[1] = pRec;
    s.args[2] = bExp;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_UNIT0, (int64_t)pRec, (int64_t)bExp };
    run_and_emit(0x6FC43100u, "MONUMOD_CheckModEligibility_6FC43100_113c", c,
        (c == 0 ? "mod5_norm" : c == 1 ? "mod7_boss" : "mod9_classic"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 56. 0x6FC43440 MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c (ecx=pGame, edx=pUnit, [esp+4]=0, [esp+8]=0, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, (c == 1 ? 0u : 1u), 5005u, 5005u, 0x1111u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (c == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 0u;
    s.args[1] = 0u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 0, 0 };
    run_and_emit(0x6FC43440u, "MONUMOD_Event07_KillOrUnsummonUnit_6FC43440_113c", c,
        (c == 0 ? "kill_mode1" : c == 1 ? "already_dead" : "uninterruptable_defer"), &s, tsArgs, 4, 0u, 0);
  }

  /* 57. 0x6FC412F0 AIGENERAL_BroadcastCmdToMinions113c (eax=pUnit, [esp+4]=pGame, [esp+8]=pCmdNode, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0x1111u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 4852u, 4852u, 0x2222u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAi0 = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    uint32_t pAi1 = (uint32_t)(uintptr_t)bump_alloc(0x40u);
    uint32_t pMin = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(pMin + 0x00u) = 0x201u;
    U32(pMin + 0x04u) = 0u;
    U32(pAi0 + 0x28u) = STAGE_GAME;
    U32(pAi0 + 0x2Cu) = 0x101u;
    U32(pAi0 + 0x30u) = 1u;
    U32(pAi0 + 0x34u) = (c == 2) ? 0u : pMin;
    U32(pAi1 + 0x28u) = STAGE_GAME;
    U32(pAi1 + 0x2Cu) = 0x101u;
    U32(pAi1 + 0x30u) = 1u;
    U32(STAGE_UDATA0 + 0x0Cu) = pAi0;
    U32(STAGE_UDATA1 + 0x0Cu) = pAi1;
    U32(STAGE_SCRATCH + 0x08u) = (uint32_t)(1 + c);
    U32(STAGE_SCRATCH + 0x0Cu) = 10u + (uint32_t)c;
    U32(STAGE_SCRATCH + 0x10u) = 20u;
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_SCRATCH;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_GAME, STAGE_SCRATCH };
    run_and_emit(0x6FC412F0u, "AIGENERAL_BroadcastCmdToMinions113c", c,
        (c == 0 ? "cmd1_minion" : c == 1 ? "cmd2_minion" : "no_minions"), &s, tsArgs, 3, 0u, 0);
  }
}

static void emit_group_2b_d2game_p6(void) {
  X86CallSpec s;

  /* 58. 0x6FC62D90 SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c (ecx=pGame, edx=pUnit, [esp+4]=sk, [esp+8]=sl, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = (uint16_t)((c == 1) ? 5200u : 5007u);
    U16(STAGE_PATH0 + 0x12u) = (uint16_t)((c == 1) ? 5200u : 5007u);
    int32_t sk = (c == 2) ? -1 : 51;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC62D90u, "SKILLS_SrvDo_SpawnProjectileAtTargetIfCanSpawnObj_6FC62D90_113c", c,
        (c == 0 ? "fw51_near" : c == 1 ? "fw51_too_far" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 59. 0x6FC5EAE0 MISSILES_SrvHit_TauntMonsterIfLevelCheck_6FC5EAE0_113c (ecx=pGame, edx=pMis, [esp+4]=pHit, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 30, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 27u, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = (c == 2) ? 0xFFFFu : 137u;
    U16(STAGE_UDATA1 + 0x0Cu) = 5u;
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5007u, 5007u, 0x2222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 12, (c == 1) ? 90 : 5, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = (c == 2) ? 0u : STAGE_UNIT2;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (c == 2) ? 0 : STAGE_UNIT2 };
    run_and_emit(0x6FC5EAE0u, "MISSILES_SrvHit_TauntMonsterIfLevelCheck_6FC5EAE0_113c", c,
        (c == 0 ? "taunt_hit" : c == 1 ? "lvl_too_high" : "bad_skill"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 60. 0x6FC61850 MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c (ecx=pGame, edx=pMis, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 0) ? 471u : (c == 1) ? 38u : 0xFFFFFFFFu;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U32(STAGE_PATH1 + 0x34u) |= 0x08u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1 };
    run_and_emit(0x6FC61850u, "MISSILE_SrvDo_TrailVerifiedOwnerSubMissile_6FC61850_113c", c,
        (c == 0 ? "vines_471" : c == 1 ? "poisonjav_38" : "invalid_mid"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 61. 0x6FC5C850 MISSILES_SrvDmg12B_Nova64RingOnExpire_6FC5C850_113c (ecx=pGame, edx=pMis, [esp+4]=pTarget, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 2) ? 0xFFFFFFFFu : 260u;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x10u) = (uint16_t)((c == 0) ? 0u : 12u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = 0u;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, 0 };
    run_and_emit(0x6FC5C850u, "MISSILES_SrvDmg12B_Nova64RingOnExpire_6FC5C850_113c", c,
        (c == 0 ? "orb260_expire" : c == 1 ? "orb260_alive" : "invalid_mid"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 62. 0x6FC61710 MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c (ecx=pGame, edx=pMis, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5009u, 5007u, 0x2222u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
    uint32_t mid = (c == 2) ? 0xFFFFFFFFu : 12u;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U16(STAGE_PATH1 + 0x10u) = 5012u;
    U16(STAGE_PATH1 + 0x12u) = 5008u;
    if (c == 0) {
      U32(STAGE_UNIT1 + 0x94u) = 0u;
      U32(STAGE_UNIT1 + 0x98u) = 0x101u;
      U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    }
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1 };
    run_and_emit(0x6FC61710u, "MISSILE_SrvDo_GuidedHostileRetarget_6FC61710_113c", c,
        (c == 0 ? "guided_owner" : c == 1 ? "no_owner_flag" : "invalid_mid"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 63. 0x6FC56470 D2Game_6FC56470_113c (eax=nIlvl, ecx=code, edx=pUnit, [esp+4]=pGame, [esp+8]=nQual, [esp+C]=bDrop, ret C) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 25, 0);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    uint32_t code = (c == 0) ? 0x206E6972u : (c == 1) ? 0x20647373u : 0u;
    uint32_t ilvl = (c == 0) ? 20u : 0u;
    uint32_t qual = (c == 0) ? 2u : 4u;
    s = make_call();
    s.eax = ilvl;
    s.ecx = code;
    s.edx = STAGE_UNIT0;
    s.nargs = 3;
    s.args[0] = STAGE_GAME;
    s.args[1] = qual;
    s.args[2] = 1u;
    s.calleePop = 12;
    int64_t tsArgs[] = { (int64_t)ilvl, (int64_t)code, STAGE_UNIT0, STAGE_GAME, (int64_t)qual, 1 };
    run_and_emit(0x6FC56470u, "D2Game_6FC56470_113c", c,
        (c == 0 ? "drop_ring_ilvl20" : c == 1 ? "drop_ssd_magic" : "bad_code"), &s, tsArgs, 6, 0xFFFFFFFFu, 0);
  }

  /* 64. 0x6FC5D1E0 MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c (eax=nInt, ebx=pMis, [esp+4..10], ret 10) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 471u, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Eu) = 20u;
    U16(STAGE_UDATA1 + 0x10u) = 10u;
    uint32_t iv = (c == 0) ? 5u : (c == 1) ? 3u : 2u;
    uint32_t sub = (c == 2) ? 0xFFFFFFFFu : 261u;
    s = make_call();
    s.eax = iv;
    s.ebx = STAGE_UNIT1;
    s.nargs = 4;
    s.args[0] = STAGE_GAME;
    s.args[1] = 4u;
    s.args[2] = sub;
    s.args[3] = 5u;
    s.calleePop = 16;
    int64_t tsArgs[] = { (int64_t)iv, STAGE_UNIT1, STAGE_GAME, 4, (int64_t)(int32_t)sub, 5 };
    run_and_emit(0x6FC5D1E0u, "MISSILES_SpawnRandomWalkableSubMissileOnInterval_6FC5D1E0_113c", c,
        (c == 0 ? "iv5_spawn" : c == 1 ? "iv3_skip" : "bad_sub"), &s, tsArgs, 6, 0xFFFFFFFFu, 0);
  }

  /* 65. 0x6FC4EF90 OBJECTS_InitShrineType113c (ecx=pObjInit, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_obj_ctrl();
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 2u, 0x101u, 0u, 4850u, 4850u, 0x1234u + (uint32_t)c);
    uint32_t pInit = STAGE_SCRATCH;
    uint32_t pTxt  = STAGE_SCRATCH + 0x100u;
    U32(pTxt + 0x178u) = (uint32_t)c;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x04u) = STAGE_UNIT0;
    U32(pInit + 0x08u) = STAGE_ROOM0;
    U32(pInit + 0x0Cu) = STAGE_ROOM0 + 0x6Cu;
    U32(pInit + 0x10u) = pTxt;
    s = make_call();
    s.ecx = pInit;
    int64_t tsArgs[] = { pInit };
    run_and_emit(0x6FC4EF90u, "OBJECTS_InitShrineType113c", c,
        (c == 0 ? "parm0_0" : c == 1 ? "parm0_1" : "parm0_2"), &s, tsArgs, 1, 0u, 0);
  }

  /* 66. 0x6FC63B60 SKILLS_SrvDo031_ChargedBoltProjectiles_6FC63B60_113c (ecx=pGame, edx=pUnit, [esp+4]=sk, [esp+8]=sl, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = 5012u;
    U16(STAGE_PATH0 + 0x12u) = 5008u;
    int32_t sk = (c == 2) ? -1 : 38;
    int32_t sl = (c == 0) ? 1 : 6;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = (uint32_t)sl;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, (int64_t)sl };
    run_and_emit(0x6FC63B60u, "SKILLS_SrvDo031_ChargedBoltProjectiles_6FC63B60_113c", c,
        (c == 0 ? "cbolt_lvl1" : c == 1 ? "cbolt_lvl6" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }
}

static void emit_group_2c_d2game_p6(void) {
  X86CallSpec s;

  /* 67. 0x6FC5F9F0 MISSILES_SrvDo13_SpawnOppositeSubMissilesAlongStep_6FC5F9F0_113c (ecx=pGame, edx=pMis, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 0) ? 471u : (c == 1) ? 38u : 0xFFFFFFFFu;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U32(STAGE_PATH1 + 0x34u) |= 0x08u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1 };
    run_and_emit(0x6FC5F9F0u, "MISSILES_SrvDo13_SpawnOppositeSubMissilesAlongStep_6FC5F9F0_113c", c,
        (c == 0 ? "vines_471" : c == 1 ? "pjav_38" : "invalid_mid"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 68. 0x6FC613D0 MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c (ecx=pGame, edx=pMis, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 260u, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = (uint16_t)((c == 2) ? 0xFFFFu : 12u);
    U16(STAGE_UDATA1 + 0x0Eu) = 20u;
    U16(STAGE_UDATA1 + 0x10u) = (uint16_t)((c == 0) ? 10u : 19u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1 };
    run_and_emit(0x6FC613D0u, "MISSILE_SrvDo_LinearWithSkillCalcSubMissileMask05_6FC613D0_113c", c,
        (c == 0 ? "orb260_rem10" : c == 1 ? "orb260_rem19" : "invalid_skill"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 69. 0x6FC53B70 QUESTS_StepQuestTimers113c ([esp+4]=pGame, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    if (c == 0) {
      U32(STAGE_GAME + 0x10F4u) = 0u;
    } else {
      U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x14u) = (c == 1) ? 5u : 0xFFFFFFFEu;
      U32(STAGE_QUESTCTRL + 0x10u) = STAGE_SCRATCH;
      U32(STAGE_SCRATCH + 0x08u) = (c == 1) ? 100u : 0u;
    }
    s = make_call();
    s.nargs = 1;
    s.args[0] = STAGE_GAME;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME };
    run_and_emit(0x6FC53B70u, "QUESTS_StepQuestTimers113c", c,
        (c == 0 ? "null_ctrl" : c == 1 ? "tick_no_fire" : "wrap_ffffffff"), &s, tsArgs, 1, 0u, 0);
  }

  /* 70. 0x6FC572C0 PLAYER_GetEquippedWeapon113c ([esp+4]=pUnit, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0);
    if (c > 0) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      stage_item_unit(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0,
          (c == 1 ? g_item_sword : g_item_bow), 0x201u, 0u, 1u, 0u, 0u, 0u);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, (c == 1 ? 4 : 5));
    }
    s = make_call();
    s.nargs = 1;
    s.args[0] = STAGE_UNIT0;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0 };
    run_and_emit(0x6FC572C0u, "PLAYER_GetEquippedWeapon113c", c,
        (c == 0 ? "unarmed" : c == 1 ? "rhand_sword" : "lhand_bow"), &s, tsArgs, 1, 0xFFFFFFFFu, 0);
  }

  /* 71. 0x6FC643F0 SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c (eax=pUnit, ebx=pGame, [esp+4..C], ret C) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 46, 5, 0, 0, 0);
    U32(pSk + 0x08u) = U32(pSk + 0x04u);
    U32(pSk + 0x10u) = U32(pSk + 0x04u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = 5008u;
    U16(STAGE_PATH0 + 0x12u) = 5008u;
    if (c == 1) {
      void *pSl = fn_AllocStatList(NULL, 2u, 120u, 0, 0x101);
      fn_SetStatListState(pSl, 0x0C);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSl, 1);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x0C, 1);
    }
    int32_t sk = (c == 2) ? -1 : 46;
    uint32_t sl = (uint32_t)(1 + c * 4);
    uint32_t mid = 40u;
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.ebx = STAGE_GAME;
    s.nargs = 3;
    s.args[0] = (uint32_t)sk;
    s.args[1] = sl;
    s.args[2] = mid;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_GAME, (int64_t)sk, (int64_t)sl, (int64_t)mid };
    run_and_emit(0x6FC643F0u, "SKILLS_StartOrUpdateDelayedChannelSkillState_6FC643F0_113c", c,
        (c == 0 ? "blaze_lvl1" : c == 1 ? "blaze_lvl5" : "invalid_sk"), &s, tsArgs, 5, 0xFFFFFFFFu, 0);
  }

  /* 72. 0x6FC5ABD0 MISSILES_SrvDmg09_ApplySkillAuraState_6FC5ABD0_113c (ecx=pGame, edx=pMis, [esp+4]=pTarget, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 477u, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = (c == 0) ? 66u : (c == 1) ? 98u : 0xFFFFu;
    U16(STAGE_UDATA1 + 0x0Cu) = 4u;
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5007u, 5007u, 0x2222u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = (c == 2) ? 0u : STAGE_UNIT2;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (c == 2) ? 0 : STAGE_UNIT2 };
    run_and_emit(0x6FC5ABD0u, "MISSILES_SrvDmg09_ApplySkillAuraState_6FC5ABD0_113c", c,
        (c == 0 ? "amp66_hit" : c == 1 ? "might98_hit" : "bad_sk"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 73. 0x6FC61980 MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c (ecx=pGame, edx=pMis, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mid = (c == 0) ? 40u : (c == 1) ? 260u : 12u;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x44u) = (uint32_t)((c == 0 ? 4 : c == 1 ? 10 : 0) << 8);
    if (c == 2) U16(STAGE_UDATA1 + 0x10u) = 1u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1 };
    run_and_emit(0x6FC61980u, "MISSILE_SrvDo_CollisionPatternAndAnimFrame_6FC61980_113c", c,
        (c == 0 ? "mid40_f4" : c == 1 ? "mid260_f10" : "mid12_rem1"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 74. 0x6FC5CEC0 MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c (eax=pMis, [esp+4..10], ret 10) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 260u, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    uint32_t sub = (c == 0) ? 261u : (c == 1) ? 40u : 0xFFFFFFFFu;
    s = make_call();
    s.eax = STAGE_UNIT1;
    s.nargs = 4;
    s.args[0] = STAGE_GAME;
    s.args[1] = sub;
    s.args[2] = 0u;
    s.args[3] = (uint32_t)(c == 1 ? 2 : 0);
    s.calleePop = 16;
    int64_t tsArgs[] = { STAGE_UNIT1, STAGE_GAME, (int64_t)(int32_t)sub, 0, (int64_t)(c == 1 ? 2 : 0) };
    run_and_emit(0x6FC5CEC0u, "MISSILES_SpawnRing18SubMissiles_6FC5CEC0_113c", c,
        (c == 0 ? "ring261_step0" : c == 1 ? "ring40_step2" : "invalid_sub"), &s, tsArgs, 5, 0u, 0);
  }

  /* 75. 0x6FC60CA0 MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c (ecx=pGame, edx=pMis, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 2) ? 0xFFFFFFFFu : 260u;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Eu) = 20u;
    U16(STAGE_UDATA1 + 0x10u) = (uint16_t)((c == 0) ? 16u : 12u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1 };
    run_and_emit(0x6FC60CA0u, "MISSILE_SrvDo_RadialRingSubMissile_6FC60CA0_113c", c,
        (c == 0 ? "orb260_rem16" : c == 1 ? "orb260_rem12" : "invalid_mid"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 76. 0x6FC66210 SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c (ecx=pGame, edx=pUnit, [esp+4]=sk, [esp+8]=sl, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0);
    int32_t sk = (c == 0) ? 267 : (c == 1) ? 278 : -1;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 5u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 5 };
    run_and_emit(0x6FC66210u, "SKILLS_SrvDo_ToggleOrApplyTimedSkillState_6FC66210_113c", c,
        (c == 0 ? "fade_267" : c == 1 ? "venom_278" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Group 3a (12 Band A VAs: #77..#88) */

static void emit_group_3a_d2game_p6(void) {
  X86CallSpec s;

  /* 77. 0x6FC533D0 OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c (ecx=pObjInit, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    uint32_t lvl = (c == 0) ? 2u : (c == 1) ? 17u : 75u;
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 59u, 0x101u, (c == 0 ? 0u : 1u), 5005u, 5005u, 0x1111u);
    uint32_t pInit = STAGE_SCRATCH;
    uint32_t pTxt  = STAGE_SCRATCH + 0x100u;
    U32(pTxt + 0xDCu)  = 256u;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x04u) = STAGE_UNIT0;
    U32(pInit + 0x08u) = STAGE_ROOM0;
    U32(pInit + 0x0Cu) = STAGE_ROOM0 + 0x6Cu;
    U32(pInit + 0x10u) = pTxt;
    U32(pInit + 0x14u) = 5005u;
    U32(pInit + 0x18u) = 5005u;
    s = make_call();
    s.ecx = pInit;
    int64_t tsArgs[] = { pInit };
    run_and_emit(0x6FC533D0u, "OBJECTS_InitFn05_InitPortalDestLevel_6FC533D0_113c", c,
        (c == 0 ? "lvl2_mode0" : c == 1 ? "lvl17_mode1" : "lvl75_mode1"), &s, tsArgs, 1, 0u, 0);
  }

  /* 78. 0x6FC45CC0 MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c (ecx=pGame, edx=pMon, [esp+4]=0, [esp+8]=0, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0x1111u + (uint32_t)c);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10 + c * 15, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 0u;
    s.args[1] = 0u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0 };
    run_and_emit(0x6FC45CC0u, "MONUMOD_SpawnLightningEnchantedBolts_6FC45CC0_113c", c,
        (c == 0 ? "le_lvl10" : c == 1 ? "le_lvl25" : "le_lvl40"), &s, tsArgs, 2, 0u, 0);
  }

  /* 79. 0x6FC60280 MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c (ecx=pGame, edx=pMis, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 2) ? 0xFFFFFFFFu : 230u;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Eu) = 20u;
    U16(STAGE_UDATA1 + 0x10u) = (uint16_t)((c == 0) ? 10u : 2u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1 };
    run_and_emit(0x6FC60280u, "MISSILE_SrvDo_PeriodicRadialDamageAndStep_6FC60280_113c", c,
        (c == 0 ? "immo230_rem10" : c == 1 ? "immo230_rem2" : "invalid_mid"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 80. 0x6FC47820 SKILLS_ExecuteRadiusMeleeHitAndClearStun_6FC47820_113c (eax=pUnit, [esp+4]=pGame, [esp+8]=sk, [esp+C]=sl, ret C) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 14, 4, 0, 0, 0);
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 126, 4, 0, 0, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5006u, 5006u, 0x2222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 500 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 500 << 8, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    int32_t sk = (c == 0) ? 14 : (c == 1) ? 126 : -1;
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.nargs = 3;
    s.args[0] = STAGE_GAME;
    s.args[1] = (uint32_t)sk;
    s.args[2] = 4u;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_GAME, (int64_t)sk, 4 };
    run_and_emit(0x6FC47820u, "SKILLS_ExecuteRadiusMeleeHitAndClearStun_6FC47820_113c", c,
        (c == 0 ? "pstrike_14" : c == 1 ? "bash_126" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 81. 0x6FC62360 SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c (ecx=pGame, edx=pUnit, [esp+4]=sk, [esp+8]=sl, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u,
        (uint16_t)(c == 0 ? 4852u : 4980u), (uint16_t)(c == 0 ? 4852u : 4980u), 0x2222u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (c < 2) fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 43u;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 43, 4 };
    run_and_emit(0x6FC62360u, "SKILLS_SrvSt_ValidateTargetInCalc1Range_6FC62360_113c", c,
        (c == 0 ? "tk_near_hit" : c == 1 ? "tk_far_miss" : "no_target"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 82. 0x6FC4EEA0 OBJECTS_CanPopulateRoom113c (ebx=pRoom, [esp+4]=pGame, [esp+8]=pLevelsTxt, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    uint32_t lvl = (c == 0) ? 1u : (c == 1) ? 2u : 3u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    uint32_t pCtrl = stage_obj_ctrl();
    uint32_t pInfo = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    U32(pCtrl + 0x48u + lvl * 4u) = pInfo;
    U32(pInfo + 0x04u) = (c == 2) ? 5u : 0u;
    U32(pInfo + 0x08u) = 10u;
    s = make_call();
    s.ebx = STAGE_ROOM0;
    s.nargs = 2;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_SCRATCH + 0x400u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_ROOM0, STAGE_GAME, STAGE_SCRATCH + 0x400u };
    run_and_emit(0x6FC4EEA0u, "OBJECTS_CanPopulateRoom113c", c,
        (c == 0 ? "town_skip" : c == 1 ? "lvl2_allow_cnt1" : "lvl3_allow_cnt6"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 83. 0x6FC6D270 SKILLS_SrvDo058_SpawnWeaponClassProjectileWithDmgPct_6FC6D270_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = 5009u;
    U16(STAGE_PATH0 + 0x12u) = 5007u;
    int32_t sk = (c == 0) ? 51 : (c == 1) ? 12 : -1;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC6D270u, "SKILLS_SrvDo058_SpawnWeaponClassProjectileWithDmgPct_6FC6D270_113c", c,
        (c == 0 ? "sk51_proj" : c == 1 ? "sk12_proj" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 84. 0x6FC4EAD0 OBJECTS_CheckLevelObjectHook113c (ecx=pLevelObjInfo, [esp+4]=pGame, [esp+8]=pRoom, [esp+C]=bDensityFlags, ret 12) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pCtrl = stage_obj_ctrl();
    U32(STAGE_SCRATCH + 0x08u) = (c == 0) ? 5u : 20u;
    U32(STAGE_SCRATCH + 0x0Cu) = 1u;
    U32(pCtrl + 0x00u) = 0u;
    U32(pCtrl + 0x04u) = (c == 1) ? 99u : 2u;
    s = make_call();
    s.ecx = STAGE_SCRATCH;
    s.nargs = 3;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_ROOM0;
    s.args[2] = 0x03u;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_SCRATCH, STAGE_GAME, STAGE_ROOM0, 0x03 };
    run_and_emit(0x6FC4EAD0u, "OBJECTS_CheckLevelObjectHook113c", c,
        (c == 0 ? "rooms_under_min" : c == 1 ? "roll_miss" : "hook1_always_true"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 85. 0x6FC5DEF0 MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c (ecx=pGame, edx=pMis, [esp+4]=pHit, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 0) ? 41u : (c == 1) ? 260u : 0xFFFFFFFFu;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5007u, 5007u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = 12u;
    U16(STAGE_UDATA1 + 0x0Cu) = 4u;
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5008u, 5008u, 0x2222u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = (c == 2) ? 0u : STAGE_UNIT2;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (c == 2) ? 0 : STAGE_UNIT2 };
    run_and_emit(0x6FC5DEF0u, "MISSILE_SrvHit_RadialDamageAndLinearParam34Ring18_6FC5DEF0_113c", c,
        (c == 0 ? "explarrow_41" : c == 1 ? "orb_260" : "invalid_mid"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 86. 0x6FC62570 SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0);
    int32_t sk = (c == 0) ? 52 : (c == 1) ? 40 : -1;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 5u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 5 };
    run_and_emit(0x6FC62570u, "SKILLS_SrvDo_ApplyAlliedTargetAuraStats_6FC62570_113c", c,
        (c == 0 ? "enchant_52" : c == 1 ? "frozenarmor_40" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 87. 0x6FC62730 SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0);
    int32_t sk = (c == 0) ? 40 : (c == 1) ? 117 : -1;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 5u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 5 };
    run_and_emit(0x6FC62730u, "SKILLS_SrvDo_ApplySelfAuraAndItemEvents_6FC62730_113c", c,
        (c == 0 ? "frozenarmor_40" : c == 1 ? "holyshield_117" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 88. 0x6FC54130 QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c ([esp+4..18]=pRoom,pIoCoord,rad,mask,ppOutRoom,maxRing, ret 18) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pColl = U32(STAGE_ROOM0 + 0x20u);
    uint32_t pMap  = U32(pColl + 0x20u);
    if (c == 1) {
      U16(pMap + ((5005u - 4992u) * 32u + (5005u - 4992u)) * 2u) = 0xFFFFu;
    } else if (c == 2) {
      memset((void *)(uintptr_t)pMap, 0xFF, 32u * 32u * 2u);
    }
    U32(STAGE_SCRATCH + 0x00u) = 5005u;
    U32(STAGE_SCRATCH + 0x04u) = 5005u;
    U32(STAGE_SCRATCH + 0x10u) = 0u;
    s = make_call();
    s.nargs = 6;
    s.args[0] = STAGE_ROOM0;
    s.args[1] = STAGE_SCRATCH;
    s.args[2] = 1u;
    s.args[3] = 5u;
    s.args[4] = STAGE_SCRATCH + 0x10u;
    s.args[5] = 4u;
    s.calleePop = 24;
    int64_t tsArgs[] = { STAGE_ROOM0, STAGE_SCRATCH, 1, 5, STAGE_SCRATCH + 0x10u, 4 };
    run_and_emit(0x6FC54130u, "QUESTS_FindFreeSubtileInRoomRings_6FC54130_113c", c,
        (c == 0 ? "free_center" : c == 1 ? "center_blocked_ring1" : "all_blocked"), &s, tsArgs, 6, 0u, 0);
  }
}

/* ------------------------------- Group 3b (12 Band A VAs: #89..#100) */

static void emit_group_3b_d2game_p6(void) {
  X86CallSpec s;

  /* 89. 0x6FC5D020 MISSILES_SrvHit_ChainBounceProjectile_6FC5D020_113c (ecx=pGame, edx=pMis, [esp+4]=pHit, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t mid = (c == 2) ? 0xFFFFFFFFu : 93u;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = 53u;
    U16(STAGE_UDATA1 + 0x0Cu) = (uint16_t)(1 + c * 6);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5008u, 5008u, 0x2222u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = (c == 2) ? 0u : STAGE_UNIT2;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (c == 2) ? 0 : STAGE_UNIT2 };
    run_and_emit(0x6FC5D020u, "MISSILES_SrvHit_ChainBounceProjectile_6FC5D020_113c", c,
        (c == 0 ? "cl93_lvl1" : c == 1 ? "cl93_lvl7" : "invalid_mid"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 90. 0x6FC5E8A0 MISSILES_SrvDmg29_ApplySkillStateAndAuraStatsCalc1_6FC5E8A0_113c (ecx=pGame, edx=pMis, [esp+4]=pTarget, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 260u, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = (uint16_t)((c == 0) ? 52u : (c == 1) ? 66u : 0xFFFFu);
    U16(STAGE_UDATA1 + 0x0Cu) = 4u;
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5007u, 5007u, 0x2222u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = (c == 2) ? 0u : STAGE_UNIT2;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (c == 2) ? 0 : STAGE_UNIT2 };
    run_and_emit(0x6FC5E8A0u, "MISSILES_SrvDmg29_ApplySkillStateAndAuraStatsCalc1_6FC5E8A0_113c", c,
        (c == 0 ? "sk52_hit" : c == 1 ? "sk66_hit" : "invalid_sk"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 91. 0x6FC637D0 SKILLS_SrvDo_FireWallPerpendicularControllers_6FC637D0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = 5009u;
    U16(STAGE_PATH0 + 0x12u) = 5007u;
    int32_t sk = (c == 0) ? 51 : (c == 1) ? 170 : -1;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC637D0u, "SKILLS_SrvDo_FireWallPerpendicularControllers_6FC637D0_113c", c,
        (c == 0 ? "fw_51" : c == 1 ? "vampfw_170" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 92. 0x6FC5B5F0 MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c (ecx=pGame, edx=pMis, [esp+4]=pHit, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 0) ? 41u : (c == 1) ? 96u : 0xFFFFFFFFu;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = 56u;
    U16(STAGE_UDATA1 + 0x0Cu) = 3u;
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5007u, 5007u, 0x2222u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = (c == 2) ? 0u : STAGE_UNIT2;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (c == 2) ? 0 : STAGE_UNIT2 };
    run_and_emit(0x6FC5B5F0u, "MISSILE_SrvHit_RadialStatsDamageByAuraRange_6FC5B5F0_113c", c,
        (c == 0 ? "mid41_hit" : c == 1 ? "mid96_hit" : "invalid_mid"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 93. 0x6FC5B990 MISSILE_SrvHit_RadialETypeDamageByCalc1_6FC5B990_113c (ecx=pGame, edx=pMis, [esp+4]=pHit, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 0) ? 41u : (c == 1) ? 96u : 0xFFFFFFFFu;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = 56u;
    U16(STAGE_UDATA1 + 0x0Cu) = 3u;
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5007u, 5007u, 0x2222u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = (c == 2) ? 0u : STAGE_UNIT2;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (c == 2) ? 0 : STAGE_UNIT2 };
    run_and_emit(0x6FC5B990u, "MISSILE_SrvHit_RadialETypeDamageByCalc1_6FC5B990_113c", c,
        (c == 0 ? "mid41_hit" : c == 1 ? "mid96_hit" : "invalid_mid"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 94. 0x6FC641C0 SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c (eax=pUnit, [esp+4..10], ret 10) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 51, 4, 0, 0, 0);
    U32(pSk + 0x08u) = U32(pSk + 0x04u);
    U32(pSk + 0x10u) = U32(pSk + 0x04u);
    if (c == 0) {
      U32(U32(pSk + 0x04u) + 0x18u) = 1u;
      U32(U32(pSk + 0x04u) + 0x1Cu) = 1u;
    }
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = 5008u;
    U16(STAGE_PATH0 + 0x12u) = 5008u;
    int32_t sk  = (c == 2) ? -1 : 51;
    uint32_t mid = (c == 1) ? 62u : 40u;
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.nargs = 4;
    s.args[0] = STAGE_GAME;
    s.args[1] = (uint32_t)sk;
    s.args[2] = 4u;
    s.args[3] = mid;
    s.calleePop = 16;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_GAME, (int64_t)sk, 4, (int64_t)mid };
    run_and_emit(0x6FC641C0u, "SKILLS_SpawnChannelingProjectileAndAdvanceTick_6FC641C0_113c", c,
        (c == 0 ? "sk51_m40" : c == 1 ? "sk51_m62" : "invalid_sk"), &s, tsArgs, 5, 0xFFFFFFFFu, 0);
  }

  /* 95. 0x6FC628F0 SKILLS_SrvDo067_ApplyBuffStateAndItemEvents_6FC628F0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0);
    int32_t sk = (c == 0) ? 52 : (c == 1) ? 40 : -1;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC628F0u, "SKILLS_SrvDo067_ApplyBuffStateAndItemEvents_6FC628F0_113c", c,
        (c == 0 ? "enchant_52" : c == 1 ? "frozen_40" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 96. 0x6FC68950 MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c (eax=pPlayerUnit, ecx=pGame, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, STAGE_CLIENT);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0x10Fu, 0x201u, 1u, 4852u, 4852u, 0x2222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 10 + c * 12, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 13, 1000, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (c < 2) {
      uint32_t pHolder  = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      uint32_t pBuckets = (uint32_t)(uintptr_t)bump_alloc(0x80u);
      uint32_t pNode    = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(pNode + 0x00u) = 0u;
      U32(pNode + 0x04u) = 0x201u;
      U32(pBuckets + 0x54u) = pNode;
      U32(pHolder) = pBuckets;
      U32(STAGE_UDATA0 + 0x44u) = pHolder;
    }
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.ecx = STAGE_GAME;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_GAME };
    run_and_emit(0x6FC68950u, "MONSTER_SendMercStatPackets9EForPlayer_6FC68950_113c", c,
        (c == 0 ? "merc_lvl10" : c == 1 ? "merc_lvl22" : "no_merc"), &s, tsArgs, 2, 0u, 0);
  }

  /* 97. 0x6FC6B1D0 CLIENTS_SetPlayerCurrentRoom113c (esi=pClient, [esp+4]=pNewRoom, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, STAGE_CLIENT);
    uint32_t newRoom = (c == 0) ? STAGE_ROOM1 : (c == 1) ? STAGE_ROOM0 : 0u;
    s = make_call();
    s.esi = STAGE_CLIENT;
    s.nargs = 1;
    s.args[0] = newRoom;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_CLIENT, newRoom };
    run_and_emit(0x6FC6B1D0u, "CLIENTS_SetPlayerCurrentRoom113c", c,
        (c == 0 ? "move_to_room1" : c == 1 ? "same_room0" : "null_newroom"), &s, tsArgs, 2, 0u, 0);
  }

  /* 98. 0x6FC5FB40 MISSILES_SrvDo15_FollowOwnerAndSpawnRandomSubMissile_6FC5FB40_113c (ecx=pGame, edx=pMis, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 2) ? 0xFFFFFFFFu : 260u;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Eu) = 20u;
    U16(STAGE_UDATA1 + 0x10u) = (uint16_t)((c == 0) ? 16u : 10u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1 };
    run_and_emit(0x6FC5FB40u, "MISSILES_SrvDo15_FollowOwnerAndSpawnRandomSubMissile_6FC5FB40_113c", c,
        (c == 0 ? "orb260_rem16" : c == 1 ? "orb260_rem10" : "invalid_mid"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 99. 0x6FC6D8C0 SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 6u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = 5008u;
    U16(STAGE_PATH0 + 0x12u) = 5008u;
    int32_t sk = (c == 0) ? 268 : (c == 1) ? 279 : -1;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC6D8C0u, "SKILLS_SrvDo_SummonShadowWarriorOrMaster_6FC6D8C0_113c", c,
        (c == 0 ? "swarrior_268" : c == 1 ? "smaster_279" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 100. 0x6FC42DA0 MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c (ecx=pMon, edx=nUModId, [esp+4]=bBoss, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0x1111u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0);
    uint32_t umod = (c == 0) ? 37u : (c == 1) ? 40u : 1u;
    uint32_t boss = (c == 0) ? 1u : 0u;
    s = make_call();
    s.ecx = STAGE_UNIT0;
    s.edx = umod;
    s.nargs = 1;
    s.args[0] = boss;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, (int64_t)umod, (int64_t)boss };
    run_and_emit(0x6FC42DA0u, "MONUMOD_ApplyFanaticOrPossessedStats_6FC42DA0_113c", c,
        (c == 0 ? "umod37_boss" : c == 1 ? "umod40" : "umod1_noop"), &s, tsArgs, 3, 0u, 0);
  }
}

/* ------------------------------- Group 3c (13 Band A VAs: #101..#113) */

static void emit_group_3c_d2game_p6(void) {
  X86CallSpec s;

  /* 101. 0x6FC65CE0 SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 4850u, 4850u, 0);
    int32_t sk = (c == 0) ? 223 : (c == 1) ? 228 : -1;
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, (sk < 0 ? 223 : sk), 4, 0, 0, 0);
    U32(pSk + 0x08u) = U32(pSk + 0x04u);
    U32(pSk + 0x10u) = U32(pSk + 0x04u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC65CE0u, "SKILLS_SrvDo_DruidShapeShift_6FC65CE0_113c", c,
        (c == 0 ? "wolf_223" : c == 1 ? "bear_228" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 102. 0x6FC59FD0 MISSILES_SrvDmg15_HolyBoltHealOrUndeadFilter_6FC59FD0_113c (ecx=pGame, edx=pMis, [esp+4]=pTarget, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 2) ? 0xFFFFFFFFu : 55u;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = 101u;
    U16(STAGE_UDATA1 + 0x0Cu) = 5u;
    uint32_t tgt = STAGE_UNIT2;
    if (c == 0) {
      stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5007u, 5007u, 0x2222u);
    } else if (c == 1) {
      stage_player_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5007u, 5007u, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 6, 50 << 8, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 7, 200 << 8, 0);
    } else {
      tgt = 0u;
    }
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = tgt;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, tgt };
    run_and_emit(0x6FC59FD0u, "MISSILES_SrvDmg15_HolyBoltHealOrUndeadFilter_6FC59FD0_113c", c,
        (c == 0 ? "mon_target" : c == 1 ? "ally_heal" : "invalid_mid"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 103. 0x6FC5B3E0 MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c (ecx=pGame, edx=pMis, [esp+4]=pHit, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 0) ? 41u : (c == 1) ? 96u : 0xFFFFFFFFu;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = 56u;
    U16(STAGE_UDATA1 + 0x0Cu) = 3u;
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5007u, 5007u, 0x2222u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = (c == 2) ? 0u : STAGE_UNIT2;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (c == 2) ? 0 : STAGE_UNIT2 };
    run_and_emit(0x6FC5B3E0u, "MISSILE_SrvHit_RadialETypeDamageWithDuration_6FC5B3E0_113c", c,
        (c == 0 ? "mid41_hit" : c == 1 ? "mid96_hit" : "invalid_mid"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 104. 0x6FC66000 SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 5005u, 5005u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5006u, 5006u, 0x2222u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    int32_t sk = (c == 0) ? 232 : (c == 1) ? 233 : -1;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 232, 4, 0, 0, 0);
    U32(pSk + 0x08u) = U32(pSk + 0x04u);
    U32(pSk + 0x10u) = U32(pSk + 0x04u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC66000u, "SKILLS_SrvDo_DruidChargeUpHit_6FC66000_113c", c,
        (c == 0 ? "feral_232" : c == 1 ? "maul_233" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 105. 0x6FC466B0 MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 0u, 5005u, 5005u, 0x1111u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 5 + c * 15, 0);
    U16(STAGE_PATH0 + 0x10u) = 5008u;
    U16(STAGE_PATH0 + 0x12u) = 5008u;
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 0, 1, 0, 0, 0);
    U32(pSk + 0x08u) = U32(pSk + 0x04u);
    U32(pSk + 0x10u) = U32(pSk + 0x04u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 0u;
    s.args[1] = 0u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 0, 0 };
    run_and_emit(0x6FC466B0u, "MONSTER_OnDeathCorpseExplosionScaledByMonLvl_6FC466B0_113c", c,
        (c == 0 ? "mlvl5" : c == 1 ? "mlvl20" : "mlvl35"), &s, tsArgs, 4, 0u, 0);
  }

  /* 106. 0x6FC5F320 MISSILE_SrvDo01_LinearProjectile113c (ebx=pMissile, [esp+4]=pGame, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 41u, 0x201u, 5006u, 5006u);
    U16(STAGE_UDATA1 + 0x10u) = (uint16_t)((c == 0) ? 10u : (c == 1) ? 1u : 5u);
    U32(STAGE_PATH1 + 0x34u) |= (c == 2) ? 0x40u : 0u;
    s = make_call();
    s.ebx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = STAGE_GAME;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT1, STAGE_GAME };
    run_and_emit(0x6FC5F320u, "MISSILE_SrvDo01_LinearProjectile113c", c,
        (c == 0 ? "alive_rem10" : c == 1 ? "expire_rem1" : "collide_flag"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 107. 0x6FC5DB30 MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c (ecx=pGame, edx=pMis, [esp+4]=pTarget, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t mid = (c == 0) ? 41u : (c == 1) ? 260u : 0xFFFFFFFFu;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5006u, 5006u);
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U16(STAGE_UDATA1 + 0x0Au) = 56u;
    U16(STAGE_UDATA1 + 0x0Cu) = 3u;
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5007u, 5007u, 0x2222u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = (c == 2) ? 0u : STAGE_UNIT2;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (c == 2) ? 0 : STAGE_UNIT2 };
    run_and_emit(0x6FC5DB30u, "MISSILE_SrvDmg_ApplyTargetDmgAndAuraSubMissiles_6FC5DB30_113c", c,
        (c == 0 ? "mid41_hit" : c == 1 ? "mid260_hit" : "invalid_mid"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 108. 0x6FC489A0 SKILLS_SrvDo021_MeleeHitWithTimedAuraState_6FC489A0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5006u, 5006u, 0x2222u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    int32_t sk = (c == 0) ? 43 : (c == 1) ? 144 : -1;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC489A0u, "SKILLS_SrvDo021_MeleeHitWithTimedAuraState_6FC489A0_113c", c,
        (c == 0 ? "tk_43" : c == 1 ? "conc_144" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 109. 0x6FC410D0 AIGENERAL_ReassignPackOnBossDeath113c (eax=pBossAiGen, ecx=pOldBossUnit, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0x1111u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5006u, 5006u, 0x2222u);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x202u, 1u, 5007u, 5007u, 0x3333u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    uint32_t pAi0 = U32(STAGE_UDATA0 + 0x28u);
    uint32_t pAi1 = U32(STAGE_UDATA1 + 0x28u);
    uint32_t pAi2 = U32(STAGE_UDATA2 + 0x28u);
    U32(pAi0 + 0x28u) = STAGE_GAME;
    U32(pAi0 + 0x2Cu) = 0x101u;
    U32(pAi0 + 0x30u) = 1u;
    U32(pAi1 + 0x28u) = STAGE_GAME;
    U32(pAi1 + 0x2Cu) = 0x101u;
    U32(pAi1 + 0x30u) = 1u;
    U32(pAi2 + 0x28u) = STAGE_GAME;
    U32(pAi2 + 0x2Cu) = 0x101u;
    U32(pAi2 + 0x30u) = 1u;
    if (c >= 1) {
      uint32_t n0 = (uint32_t)(uintptr_t)bump_alloc(8u);
      U32(n0 + 0x00u) = 0x201u;
      if (c == 2) {
        uint32_t n1 = (uint32_t)(uintptr_t)bump_alloc(8u);
        U32(n1 + 0x00u) = 0x202u;
        U32(n1 + 0x04u) = 0u;
        U32(n0 + 0x04u) = n1;
      } else {
        U32(n0 + 0x04u) = 0u;
      }
      U32(pAi0 + 0x34u) = n0;
    }
    s = make_call();
    s.eax = pAi0;
    s.ecx = STAGE_UNIT0;
    s.calleePop = 0;
    int64_t tsArgs[] = { pAi0, STAGE_UNIT0 };
    run_and_emit(0x6FC410D0u, "AIGENERAL_ReassignPackOnBossDeath113c", c,
        (c == 0 ? "empty_minions" : c == 1 ? "one_minion" : "two_minions"), &s, tsArgs, 2, 0x00000000u, 0);
  }

  /* 110. 0x6FC47F30 SKILLS_SrvSt03_WhirlwindStart_6FC47F30_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 151, 5, 0, 0, 0);
    U32(pSk + 0x08u) = U32(pSk + 0x04u);
    U32(pSk + 0x10u) = U32(pSk + 0x04u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    U16(STAGE_PATH0 + 0x10u) = (uint16_t)(c == 0 ? 5009u : 5012u);
    U16(STAGE_PATH0 + 0x12u) = (uint16_t)(c == 0 ? 5007u : 5005u);
    int32_t sk = (c == 2) ? -1 : 151;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 5u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 5 };
    run_and_emit(0x6FC47F30u, "SKILLS_SrvSt03_WhirlwindStart_6FC47F30_113c", c,
        (c == 0 ? "ww_near" : c == 1 ? "ww_far" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 111. 0x6FC473C0 SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 5005u, 5005u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5006u, 5006u, 0x2222u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    int32_t sk = (c == 0) ? 232 : (c == 1) ? 233 : -1;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC473C0u, "SKILLS_SrvDo017_FeralRageOrMaulHit_6FC473C0_113c", c,
        (c == 0 ? "feral_232" : c == 1 ? "maul_233" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 112. 0x6FC493B0 SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 107, 4, 0, 0, 0);
    uint32_t pSkill = U32(pSk + 0x04u);
    U32(pSkill + 0x0Cu) = (c == 2) ? 0x200u : 0u;
    int32_t sk = (c == 0) ? 1 : 107;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC493B0u, "SKILLS_SrvDo030_BarbarianChargeUpdateAndStrike_6FC493B0_113c", c,
        (c == 0 ? "absent_sk1" : c == 1 ? "set_param0c_1000" : "flag200_radius_hit"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 113. 0x6FC494A0 SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    if (c == 2) {
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0x1111u);
    } else {
      stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 0x101u, 1u, 5005u, 5005u, 0);
    }
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 132, 4, 0, 0, 0);
    uint32_t pSkill = U32(pSk + 0x04u);
    U32(pSkill + 0x0Cu) = 0x0014u;
    int32_t sk = (c == 0) ? -1 : 132;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC494A0u, "SKILLS_SrvDo031_LeapLandingAndKnockback_6FC494A0_113c", c,
        (c == 0 ? "invalid_sk" : c == 1 ? "player_clear_param0c" : "monster_keep_param0c"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Group 4a (12 Band A VAs: #114..#125) */

static void emit_group_4a_d2game_p6(void) {
  X86CallSpec s;

  /* 114. 0x6FC44CD0 MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c (ecx=pMonsterUnit, [esp+4]=pArg, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t classId = (c == 2) ? 0x2C0u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, classId, 0x101u, 1u, 4850u, 4850u, 0x1111u + (uint32_t)c * 97u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (c == 0) ? 1 : (c == 1) ? 45 : 80, 0);
    U16(STAGE_UDATA0 + 0x14u) = (uint16_t)(0x1506u + (uint32_t)c * 7u);
    s = make_call();
    s.ecx = STAGE_UNIT0;
    s.nargs = 1;
    s.args[0] = STAGE_SCRATCH;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_SCRATCH };
    run_and_emit(0x6FC44CD0u, "MONSTER_AssignAuraEnchantedSkill_6FC44CD0_113c", c,
        (c == 0 ? "lvl1_mon" : c == 1 ? "lvl45_mon" : "special_2c0"), &s, tsArgs, 2, 0x00000000u, 0);
  }

  /* 115. 0x6FC5A280 MISSILES_PopulateDamageByEType_6FC5A280_113c (edi=pMissile, esi=pDamage, [esp+4]=pTargetUnit, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t mid = (c == 0) ? 41u : (c == 1) ? 96u : 12u;
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, mid, 0x101u, 4850u, 4850u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 4852u, 4852u, 0x2222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 50, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 90, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 48, 120, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 49, 200, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 54, 80, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 55, 160, 0);
    s = make_call();
    s.edi = STAGE_UNIT0;
    s.esi = STAGE_DMG;
    s.nargs = 1;
    s.args[0] = (c == 2) ? STAGE_UNIT1 : 0u;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_DMG, (c == 2) ? (int64_t)STAGE_UNIT1 : 0 };
    run_and_emit(0x6FC5A280u, "MISSILES_PopulateDamageByEType_6FC5A280_113c", c,
        (c == 0 ? "fire_41" : c == 1 ? "cold_96" : "phys_12_vs_undead"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 116. 0x6FC65AF0 SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 5005u, 5005u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5007u, 5007u, 0x2222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 400 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 400 << 8, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    int32_t sk = (c == 1) ? 249 : 250;
    if (c == 0) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 144, 1); /* STATE_HURRICANE */
    if (c == 1) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 145, 1); /* STATE_ARMAGEDDON */
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 5u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 5 };
    run_and_emit(0x6FC65AF0u, "SKILLS_EventFunc05_MoltenBoulderOrPerFrameAura_6FC65AF0_113c", c,
        (c == 0 ? "hurricane_250" : c == 1 ? "armageddon_249" : "no_state_cancel"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 117. 0x6FC47B90 SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 5005u, 5005u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5006u, 5006u, 0x2222u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (c != 0) fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_UNIT0 + 0x38u) = (c == 1) ? 0x200u : 0x100u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 232u;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 232, 4 };
    run_and_emit(0x6FC47B90u, "SKILLS_SrvDo019_FuryMultiTargetHit_6FC47B90_113c", c,
        (c == 0 ? "no_target" : c == 1 ? "even_frame_hit" : "odd_frame_empty_ring"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 118. 0x6FC60EB0 MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c (ecx=pGame, edx=pMissile, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 5005u, 5005u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5008u, 5008u, 0x2222u);
    stage_missile_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 12u, 0x301u, 5006u, 5006u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U32(STAGE_UNIT2 + 0xC8u) |= 0x400u;
    U32(STAGE_UNIT2 + 0x94u) = 0u;
    U32(STAGE_UNIT2 + 0x98u) = 0x101u;
    U16(STAGE_UDATA2 + 0x04u) = 221u; /* Raven */
    U16(STAGE_UDATA2 + 0x06u) = 3u;
    U16(STAGE_UDATA2 + 0x0Au) = 4u;
    U32(STAGE_PATH2 + 0x34u) = (c == 0) ? 0u : 0x08u;
    U32(STAGE_PATH2 + 0x3Cu) = (c == 2) ? 0x201u : 0u; /* MISSILE_SetTargetX */
    U32(STAGE_PATH2 + 0x40u) = (c == 0) ? 0u : 2u;      /* MISSILE_SetTargetY */
    uint32_t pMis = STAGE_UNIT2;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = pMis;
    int64_t tsArgs[] = { STAGE_GAME, pMis };
    run_and_emit(0x6FC60EB0u, "MISSILE_SrvDo_MonsterCarrierSubSpawn_6FC60EB0_113c", c,
        (c == 0 ? "zero_targetY" : c == 1 ? "no_carrier_move" : "carrier_spawn_raven"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 119. 0x6FC48740 SKILLS_UpdateLeapMovementStep_6FC48740_113c (eax=pUnit, [esp+4]=pGame, [esp+8]=pSkill, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 132, 4, 0, 0, 0);
    U32(pSk + 0x08u) = U32(pSk + 0x04u);
    uint32_t pSkill = U32(pSk + 0x04u);
    U32(pSkill + 0x18u) = (c == 0) ? 5008u : (c == 1) ? 5012u : 5005u;
    U32(pSkill + 0x1Cu) = (c == 0) ? 5008u : (c == 1) ? 5010u : 5005u;
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = STAGE_GAME;
    s.args[1] = pSkill;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_UNIT0, STAGE_GAME, pSkill };
    run_and_emit(0x6FC48740u, "SKILLS_UpdateLeapMovementStep_6FC48740_113c", c,
        (c == 0 ? "leap_5008" : c == 1 ? "leap_5012" : "leap_in_place"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 120. 0x6FC631C0 SKILLS_SrvDo_Telekinesis_6FC631C0_113c (ecx=pGame, edx=pPlayerUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5008u, 5008u, 0x2222u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 400 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 400 << 8, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    if (c == 0) {
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    } else if (c == 1) {
      U16(STAGE_PATH0 + 0x10u) = 5010u;
      U16(STAGE_PATH0 + 0x12u) = 5008u;
    }
    int32_t sk = (c == 2) ? -1 : 43;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC631C0u, "SKILLS_SrvDo_Telekinesis_6FC631C0_113c", c,
        (c == 0 ? "tk_hit_mon" : c == 1 ? "tk_no_tgt" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 121. 0x6FC60BD0 MISSILE_SrvDo_SpiralPath_6FC60BD0_113c (ecx=pGame, edx=pMissile, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_missile_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 158u, 0x101u, 5005u, 5005u);
    U16(STAGE_UDATA0 + 0x0Au) = 10u; /* Elapsed=0 < Param1 */
    U32(STAGE_PATH0 + 0x3Cu) = (c == 1) ? 8u : (uint32_t)(-4); /* MISSILE_SetTargetX */
    U32(STAGE_PATH0 + 0x40u) = (c == 1) ? 4u : 10u;           /* MISSILE_SetTargetY */
    uint32_t pMis = (c == 0) ? 0u : STAGE_UNIT0;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = pMis;
    int64_t tsArgs[] = { STAGE_GAME, pMis };
    run_and_emit(0x6FC60BD0u, "MISSILE_SrvDo_SpiralPath_6FC60BD0_113c", c,
        (c == 0 ? "null_missile" : c == 1 ? "spiral_8_4" : "spiral_neg4_10"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 122. 0x6FC68B60 MONSTER_MarkSpawnNodeProcessedAndTrigger_6FC68B60_113c (eax=ppListHead, ecx=dwUnitGuid, args=[pGame, pUnit], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0x1111u);
    uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(pNode + 0x00u) = (c == 1) ? 0x202u : 0x101u;
    U32(pNode + 0x04u) = (c == 2) ? 1u : 0u;
    U32(pNode + 0x08u) = 0u;
    U32(STAGE_SCRATCH) = pNode;
    s = make_call();
    s.eax = STAGE_SCRATCH;
    s.ecx = 0x101u;
    s.nargs = 2;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_UNIT0;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_SCRATCH, 0x101, STAGE_GAME, STAGE_UNIT0 };
    run_and_emit(0x6FC68B60u, "MONSTER_MarkSpawnNodeProcessedAndTrigger_6FC68B60_113c", c,
        (c == 0 ? "mark_processed" : c == 1 ? "guid_miss" : "already_processed"), &s, tsArgs, 4, 0x00000000u, 0);
  }

  /* 123. 0x6FC5E0B0 MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c (ecx=pGame, edx=pMissile, [esp+4]=pHitUnit, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t mid = (c == 0) ? 260u : (c == 1) ? 41u : 9999u;
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, mid, 0x201u, 5008u, 5008u);
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U16(STAGE_UDATA1 + 0x04u) = (uint16_t)((c == 0) ? 64u : 56u);
    U16(STAGE_UDATA1 + 0x06u) = 3u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = 0u;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, 0 };
    run_and_emit(0x6FC5E0B0u, "MISSILE_SrvHit_CircularSubMissilesAndRadialETypeBlast_6FC5E0B0_113c", c,
        (c == 0 ? "frozenorb_260" : c == 1 ? "explarrow_41" : "invalid_mid"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 124. 0x6FC2CB30 SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    U8(STAGE_GAME + 0x6Du) = (uint8_t)c;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (c == 0 ? 1u : 3u), 0x101u, 1u, 5005u, 5005u, 0x1111u + (uint32_t)c * 55u);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 1u;
    s.args[1] = 2u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 1, 2 };
    run_and_emit(0x6FC2CB30u, "SKILLS_SrvDo132_MonsterSplitSpawn_6FC2CB30_113c", c,
        (c == 0 ? "diff0_mon1" : c == 1 ? "diff1_mon3" : "diff2_mon1"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 125. 0x6FC41BE0 MONUMOD_ApplyResistanceBonus_6FC41BE0_113c (ecx=pMonster, edx=nUModId, [esp+4]=bBoss, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0x1111u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x1F, 50, 0);
    uint32_t umod = (c == 0) ? 0x1Cu : (c == 1) ? 0x12u : 0x09u;
    s = make_call();
    s.ecx = STAGE_UNIT0;
    s.edx = umod;
    s.nargs = 1;
    s.args[0] = 1u;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, (int64_t)umod, 1 };
    run_and_emit(0x6FC41BE0u, "MONUMOD_ApplyResistanceBonus_6FC41BE0_113c", c,
        (c == 0 ? "umod_stoneskin" : c == 1 ? "umod_cold" : "umod_fire"), &s, tsArgs, 3, 0x00000000u, 0);
  }
}

/* ------------------------------- Group 4b (12 Band A VAs: #126..#137) */

static void emit_group_4b_d2game_p6(void) {
  X86CallSpec s;

  /* 126. 0x6FC6D420 SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    U16(STAGE_PATH0 + 0x10u) = 5012u;
    U16(STAGE_PATH0 + 0x12u) = 5008u;
    int32_t sk = (c == 0) ? 51 : (c == 1) ? 170 : -1;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC6D420u, "SKILLS_SrvDo024_SpawnWallOfProjectiles_6FC6D420_113c", c,
        (c == 0 ? "firewall_51" : c == 1 ? "vampwall_170" : "invalid_sk"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 127. 0x6FC457D0 MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U8(STAGE_GAME + 0x6Du) = (uint8_t)c;
    uint32_t cid = (c == 1) ? 0x1ECu : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 0x101u, 1u, 5005u, 5005u, 0x1111u + (uint32_t)c * 41u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x201u, 1u, 5006u, 5006u, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (c == 0) ? 10 : (c == 1) ? 35 : 65, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = 0u;
    s.args[1] = 0u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, 0, 0 };
    run_and_emit(0x6FC457D0u, "MONSTER_OnDeathSuicideMinionExplosion_6FC457D0_113c", c,
        (c == 0 ? "diff0_lvl10" : c == 1 ? "diff1_suicide492" : "diff2_lvl65"), &s, tsArgs, 4, 0x00000000u, 0);
  }

  /* 128. 0x6FC56C50 QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c (eax=pObject, ecx=pGame, ret 0) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (c == 0) ? 0x4Cu : 1u);
    uint32_t objId = (c == 0) ? 0x83u : (c == 1) ? 0x83u : 999u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, objId, 0x101u, 1u, 4850u, 4850u, 0x1111u);
    stage_game_mon_region((c == 0) ? 0x4Cu : 1u);
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.ecx = STAGE_GAME;
    s.calleePop = 0;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0 };
    run_and_emit(0x6FC56C50u, "QUESTS_ObjectEvent07_DispatchByClassId_6FC56C50_113c", c,
        (c == 0 ? "obj83_lvl76" : c == 1 ? "obj83_lvl1_mode2" : "noop_obj999"), &s, tsArgs, 2, 0x00000000u, 0);
  }

  /* 129. 0x6FC5D450 MISSILES_SpawnCircularAreaSubMissiles_6FC5D450_113c (stdcall [pGame, pMissile, nRadius, nSubMissile, nRangeOverride], ret 20) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    stage_missile_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 96u, 0x201u, 5008u, 5008u);
    U32(STAGE_UNIT1 + 0xC8u) |= 0x400u;
    U32(STAGE_UNIT1 + 0x94u) = 0u;
    U32(STAGE_UNIT1 + 0x98u) = 0x101u;
    U16(STAGE_UDATA1 + 0x04u) = 56u;
    U16(STAGE_UDATA1 + 0x06u) = 3u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t rad = (c == 0) ? 2u : (c == 1) ? 4u : 0u;
    uint32_t sub = (c == 0) ? 96u : (c == 1) ? 41u : 9999u;
    s = make_call();
    s.nargs = 5;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_UNIT1;
    s.args[2] = rad;
    s.args[3] = sub;
    s.args[4] = (c == 1) ? 10u : 0u;
    s.calleePop = 20;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT1, (int64_t)rad, (int64_t)sub, (c == 1) ? 10 : 0 };
    run_and_emit(0x6FC5D450u, "MISSILES_SpawnCircularAreaSubMissiles_6FC5D450_113c", c,
        (c == 0 ? "rad2_sub96" : c == 1 ? "rad4_sub41_rng10" : "rad0_invalid"), &s, tsArgs, 5, 0x00000000u, 0);
  }

  /* 130. 0x6FC49240 SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c (ebx=pTargetUnit, args=[pGame, pCasterUnit, nSkillId, nSkillLevel], ret 16) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x101u, 1u, 4850u, 4850u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 4852u, 4852u, 0x2222u);
    int32_t sk = (c == 0) ? 52 : (c == 1) ? 66 : -1;
    uint32_t tgt = (c == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    s = make_call();
    s.ebx = tgt;
    s.nargs = 4;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_UNIT0;
    s.args[2] = (uint32_t)sk;
    s.args[3] = 5u;
    s.calleePop = 16;
    int64_t tsArgs[] = { tgt, STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 5 };
    run_and_emit(0x6FC49240u, "SKILLS_ApplyTimedSkillAuraToTarget_6FC49240_113c", c,
        (c == 0 ? "enchant_52" : c == 1 ? "amp_66" : "invalid_sk"), &s, tsArgs, 5, 0xFFFFFFFFu, 0);
  }

  /* 131. 0x6FC46BB0 SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c (eax=nSkillId, args=[pUnit, nSkillLevel, pInOutX, pInOutY], ret 16) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t pX = STAGE_SCRATCH;
    uint32_t pY = STAGE_SCRATCH + 4u;
    U32(pX) = (c == 0) ? 5008u : (c == 1) ? 5014u : 0u;
    U32(pY) = (c == 0) ? 5008u : (c == 1) ? 5012u : 0u;
    int32_t sk = (c == 2) ? -1 : 54; /* Teleport */
    s = make_call();
    s.eax = (uint32_t)sk;
    s.nargs = 4;
    s.args[0] = STAGE_UNIT0;
    s.args[1] = 4u;
    s.args[2] = pX;
    s.args[3] = pY;
    s.calleePop = 16;
    int64_t tsArgs[] = { STAGE_UNIT0, (int64_t)sk, 4, pX, pY };
    run_and_emit(0x6FC46BB0u, "SKILLS_ClampTargetAndFindFreeLosPos_6FC46BB0_113c", c,
        (c == 0 ? "tp_5008" : c == 1 ? "tp_5014" : "invalid_sk"), &s, tsArgs, 5, 0xFFFFFFFFu, 0);
  }

  /* 132. 0x6FC41840 MONUMOD_ApplyToMinionCallback113c (ecx=pMinion, edx=nUModId, [esp+4]=bBoss, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 4850u, 4850u, 0x1111u + (uint32_t)c * 77u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x1F, 40, 0);
    uint32_t umod = (c == 0) ? 1u : (c == 1) ? 28u : 22u;
    uint32_t boss = (c == 2) ? 0u : 1u;
    s = make_call();
    s.ecx = STAGE_UNIT0;
    s.edx = umod;
    s.nargs = 1;
    s.args[0] = boss;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, (int64_t)umod, (int64_t)boss };
    run_and_emit(0x6FC41840u, "MONUMOD_ApplyToMinionCallback113c", c,
        (c == 0 ? "umod1_seed" : c == 1 ? "umod28_stoneskin" : "umod22_noop"), &s, tsArgs, 3, 0x00000000u, 0);
  }

  /* 133. 0x6FC67CF0 ROOM_SpawnMonsterPreset113c (eax=nClassId, ecx=pRoom, args=[pGame, x, y, nMode], ret 16) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    int32_t cid = (c == 0) ? 1 : (c == 1) ? 3 : -1;
    s = make_call();
    s.eax = (uint32_t)cid;
    s.ecx = STAGE_ROOM0;
    s.nargs = 4;
    s.args[0] = STAGE_GAME;
    s.args[1] = 5005u + (uint32_t)c * 2u;
    s.args[2] = 5005u + (uint32_t)c * 2u;
    s.args[3] = 1u;
    s.calleePop = 16;
    int64_t tsArgs[] = { STAGE_ROOM0, (int64_t)cid, STAGE_GAME, 5005 + c * 2, 5005 + c * 2, 1 };
    run_and_emit(0x6FC67CF0u, "ROOM_SpawnMonsterPreset113c", c,
        (c == 0 ? "spawn_cid1" : c == 1 ? "spawn_cid3" : "invalid_cid"), &s, tsArgs, 6, 0xFFFFFFFFu, 0);
  }

  /* 134. 0x6FC48600 SKILLS_SrvSt06_ChargeStart_6FC48600_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 107, 4, 0, 0, 0);
    U16(STAGE_PATH0 + 0x10u) = 5009u;
    U16(STAGE_PATH0 + 0x12u) = 5009u;
    if (c == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5012u, 5012u, 0x2222u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    }
    int32_t sk = (c == 0) ? 1 : 107;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 4u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 4 };
    run_and_emit(0x6FC48600u, "SKILLS_SrvSt06_ChargeStart_6FC48600_113c", c,
        (c == 0 ? "absent_sk1" : c == 1 ? "charge_coords" : "charge_target_unit"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 135. 0x6FC2F370 ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c (stdcall [pGame, pItem, pItemDrop], ret 12) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (c == 0) ? g_item_ring : (c == 1) ? g_item_sword : g_item_ring;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 0x101u, 3u, 7u, 4850u, 4850u, 0x1111u + (uint32_t)c * 29u);
    uint32_t pDrop = STAGE_SCRATCH;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = 50u;
    U32(pDrop + 0x14u) = cid;
    U32(pDrop + 0x2Cu) = (c == 2) ? 0u : 1u;
    U32(pDrop + 0x40u) = (c == 0) ? 10u : (c == 1) ? 0u : 0u; /* forced unique id */
    s = make_call();
    s.nargs = 3;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_UNIT0;
    s.args[2] = pDrop;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, pDrop };
    run_and_emit(0x6FC2F370u, "ITEMS_SelectAndApplyUniqueItemMods_6FC2F370_113c", c,
        (c == 0 ? "forced_uniq_10" : c == 1 ? "forced_uniq_0" : "random_uniq_ring"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 136. 0x6FC6C4F0 SKILLS_SrvSt30_MultiHitMeleeStart_6FC6C4F0_113c (ecx=pGame, edx=pUnit, [esp+4..8], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 106, 5, 0, 0, 0);
    uint32_t pSkill = U32(pSk + 0x04u);
    U32(pSk + 0x10u) = pSkill;
    U32(pSkill + 0x18u) = 0x99u;
    if (c == 2) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5006u, 5006u, 0x2222u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    }
    int32_t sk = (c == 0) ? -1 : 106;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = (uint32_t)sk;
    s.args[1] = 5u;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)sk, 5 };
    run_and_emit(0x6FC6C4F0u, "SKILLS_SrvSt30_MultiHitMeleeStart_6FC6C4F0_113c", c,
        (c == 0 ? "invalid_sk" : c == 1 ? "zeal_no_target" : "zeal_hit_target"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 137. 0x6FC30A20 ITEMS_GenerateMagicOrRareAffixes_6FC30A20_113c (stdcall [pGame, ppItemOrItem, pItemDrop], ret 12) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t q = (c == 0) ? 4u : (c == 1) ? 6u : 2u;
    uint32_t cid = (c == 1) ? g_item_ring : g_item_sword;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 0x101u, 3u, q, 4850u, 4850u, 0x1111u + (uint32_t)c * 77u);
    U32(STAGE_SCRATCH) = STAGE_UNIT0;
    uint32_t pDrop = STAGE_SCRATCH + 0x20u;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = 30u;
    U32(pDrop + 0x14u) = cid;
    U16(pDrop + 0x2Au) = 100u;
    U32(pDrop + 0x30u) = q;
    s = make_call();
    s.nargs = 3;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_SCRATCH;
    s.args[2] = pDrop;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_SCRATCH, pDrop };
    run_and_emit(0x6FC30A20u, "ITEMS_GenerateMagicOrRareAffixes_6FC30A20_113c", c,
        (c == 0 ? "magic_sword" : c == 1 ? "rare_ring" : "normal_sword"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Group 4c (13 Band A VAs: #138..#150) */

static void emit_group_4c_d2game_p6(void) {
  X86CallSpec s;

  /* 138. 0x6FC51000 OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c (ecx=pGame, edx=pRoom, args=[nDensity, nThemeObjId, wChancePct], ret 12) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pObjCtrl = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    U32(pObjCtrl + 0x00u) = 0x13572469u + (uint32_t)c * 97u;
    U32(pObjCtrl + 0x04u) = 0x29Au;
    U32(STAGE_GAME + 0x10F0u) = pObjCtrl;
    uint32_t dens = (c == 0) ? 4u : (c == 1) ? 3u : 5u;
    uint32_t theme = (c == 0) ? 3u : (c == 1) ? 1u : 4u;
    uint32_t chance = 100u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_ROOM0;
    s.nargs = 3;
    s.args[0] = dens;
    s.args[1] = theme;
    s.args[2] = chance;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_ROOM0, (int64_t)dens, (int64_t)theme, (int64_t)chance, 0 };
    run_and_emit(0x6FC51000u, "OBJECTS_FindFreeDropCoordsAndSpawnItem_6FC51000_113c", c,
        (c == 0 ? "theme3_d4" : c == 1 ? "theme1_d3" : "theme4_d5"), &s, tsArgs, 6, 0xFFFFFFFFu, 0);
  }

  /* 139. 0x6FC6E390 SKILLS_SetNecroSkeletonComponents113c (eax=nTier, ecx=pMonster, edi=pOwnerUnit, [esp+4]=bHasShield, [esp+8]=bIsMage, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x16Bu, 0x101u, 1u, 5005u, 5005u, 0x1111u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x201u, 1u, 5005u, 5005u, 0);
    U32(STAGE_UNIT1 + 0x20u) = 0x12345679u;
    U32(STAGE_UNIT1 + 0x24u) = 0x0000029Au;
    uint32_t tier = (c == 0) ? 0u : (c == 1) ? 5u : 12u;
    uint32_t bShield = (c == 0) ? 0u : 1u;
    uint32_t bMage   = (c == 2) ? 1u : 0u;
    s = make_call();
    s.eax = tier;
    s.ecx = STAGE_UNIT0;
    s.edi = STAGE_UNIT1;
    s.nargs = 2;
    s.args[0] = bShield;
    s.args[1] = bMage;
    s.calleePop = 8;
    int64_t tsArgs[] = { (int64_t)tier, STAGE_UNIT0, STAGE_UNIT1, (int64_t)bShield, (int64_t)bMage };
    run_and_emit(0x6FC6E390u, "SKILLS_SetNecroSkeletonComponents113c", c,
        (c == 0 ? "skel_tier0" : c == 1 ? "skel_tier5_shield" : "mage_tier12_clamp10"), &s, tsArgs, 5, 0u, 0);
  }

  /* 140. 0x6FC31A70 ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c (ebx=pGame, args=[pUnit, nQuality, pInOutIlvl, pOutItemDrop, nReqType, bSkipRarity], ret 24) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0x1111u + (uint32_t)c * 97u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20 + c * 15, 0);
    uint32_t pIlvl = STAGE_SCRATCH;
    uint32_t pOutDrop = STAGE_SCRATCH + 0x20u;
    U32(pIlvl) = 10u;
    uint32_t q = (c == 0) ? 2u : (c == 1) ? 4u : 6u;
    s = make_call();
    s.ebx = STAGE_GAME;
    s.nargs = 6;
    s.args[0] = STAGE_UNIT0;
    s.args[1] = q;
    s.args[2] = pIlvl;
    s.args[3] = pOutDrop;
    s.args[4] = 0x1Du; /* weap / sword itemType */
    s.args[5] = 1u;
    s.calleePop = 24;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)q, pIlvl, pOutDrop, 0x1D, 1 };
    run_and_emit(0x6FC31A70u, "ITEMS_RollAndDropItemByTypeAtUnit_6FC31A70_113c", c,
        (c == 0 ? "drop_norm" : c == 1 ? "drop_magic" : "drop_rare"), &s, tsArgs, 7, 0xFFFFFFFFu, 0);
  }

  /* 141. 0x6FC32B90 ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c (stdcall [pGame, pUnit, dwGoldAmount], ret 12) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0x1111u);
    uint32_t goldAmt = (c == 0) ? 250u : (c == 1) ? 5000u : 0u;
    s = make_call();
    s.nargs = 3;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_UNIT0;
    s.args[2] = goldAmt;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)goldAmt };
    run_and_emit(0x6FC32B90u, "ITEMS_SpawnGoldPilesAtUnit_6FC32B90_113c", c,
        (c == 0 ? "gold_250" : c == 1 ? "gold_5000" : "gold_0"), &s, tsArgs, 3, 0x00000000u, 0);
  }

  /* 142. 0x6FC33E60 ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c (edi=pItem, [esp+4]=pItemDrop, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (c == 0) ? g_item_sword : (c == 1) ? g_item_armor : g_item_bow;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 0x101u, 3u, 1u, 4850u, 4850u, 0x1111u + (uint32_t)c * 73u);
    uint32_t pDrop = STAGE_SCRATCH;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x14u) = cid;
    s = make_call();
    s.edi = STAGE_UNIT0;
    s.nargs = 1;
    s.args[0] = pDrop;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, pDrop };
    run_and_emit(0x6FC33E60u, "ITEMS_ApplyLowQualityAndSpawnMods_6FC33E60_113c", c,
        (c == 0 ? "lowq_sword" : c == 1 ? "lowq_armor" : "lowq_bow"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 143. 0x6FC35240 ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c (esi=pItem, [esp+4]=pItemDrop, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (c == 0) ? g_item_sword : (c == 1) ? g_item_ring : g_item_armor;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 0x101u, 3u, 6u, 4850u, 4850u, 0x1111u + (uint32_t)c * 61u);
    U32(STAGE_UDATA0 + 0x2Cu) = 35u;
    uint32_t pDrop = STAGE_SCRATCH;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = 35u;
    U32(pDrop + 0x14u) = cid;
    s = make_call();
    s.esi = STAGE_UNIT0;
    s.nargs = 1;
    s.args[0] = pDrop;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_UNIT0, pDrop };
    run_and_emit(0x6FC35240u, "ITEMS_RollAndApplyRareItemAffixes_6FC35240_113c", c,
        (c == 0 ? "rare_sword" : c == 1 ? "rare_ring" : "rare_armor"), &s, tsArgs, 2, 0xFFFFFFFFu, 0);
  }

  /* 144. 0x6FC31070 ITEMS_InitCreatedItemStats_6FC31070_113c (ebx=ppItemOrItem, args=[pGame, pItemDrop, bGen], ret 12) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cid = (c == 0) ? g_item_gold : (c == 1) ? g_item_sword : g_item_armor;
    uint32_t q = (c == 0) ? 2u : (c == 1) ? 4u : 3u;
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 0x101u, 3u, q, 4850u, 4850u, 0x1111u + (uint32_t)c * 43u);
    U32(STAGE_SCRATCH) = STAGE_UNIT0;
    uint32_t pDrop = STAGE_SCRATCH + 0x20u;
    U32(pDrop + 0x08u) = STAGE_GAME;
    U32(pDrop + 0x0Cu) = 25u;
    U32(pDrop + 0x14u) = cid;
    U16(pDrop + 0x2Au) = 100u;
    U32(pDrop + 0x30u) = q;
    U32(pDrop + 0x38u) = 500u;
    s = make_call();
    s.ebx = STAGE_SCRATCH;
    s.nargs = 3;
    s.args[0] = STAGE_GAME;
    s.args[1] = pDrop;
    s.args[2] = 1u;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_SCRATCH, pDrop, 1 };
    run_and_emit(0x6FC31070u, "ITEMS_InitCreatedItemStats_6FC31070_113c", c,
        (c == 0 ? "init_gold" : c == 1 ? "init_magic_sword" : "init_sup_armor"), &s, tsArgs, 4, 0xFFFFFFFFu, 0);
  }

  /* 145. 0x6FC344D0 ITEMS_RollMagicAffixId_6FC344D0_113c (stdcall [pItem, bAllowMagicOnly, bForceRoll, bApplyProps, bIsPrefix, nForcedIndex, dwRequiredGroup], ret 28) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_item_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, g_item_sword, 0x101u, 3u, 4u, 4850u, 4850u, 0x1111u + (uint32_t)c * 59u);
    U32(STAGE_UDATA0 + 0x2Cu) = 25u + (uint32_t)c * 20u;
    s = make_call();
    s.nargs = 7;
    s.args[0] = STAGE_UNIT0;
    s.args[1] = 1u;
    s.args[2] = 1u;
    s.args[3] = 0u;
    s.args[4] = (c == 0) ? 1u : 0u;
    s.args[5] = 0u;
    s.args[6] = 0u;
    s.calleePop = 28;
    int64_t tsArgs[] = { STAGE_UNIT0, 1, 1, 0, (c == 0) ? 1 : 0, 0, 0 };
    run_and_emit(0x6FC344D0u, "ITEMS_RollMagicAffixId_6FC344D0_113c", c,
        (c == 0 ? "prefix_ilvl25" : c == 1 ? "suffix_ilvl45" : "suffix_ilvl65"), &s, tsArgs, 7, 0x0000FFFFu, 0);
  }

  /* 146. 0x6FC36A30 AI_TickNodes4_5_7_113c (eax=pUnit, [esp+4]=pGame, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x101u, 1u, 5005u, 5005u, 0x1111u);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    if (c < 2) {
      uint32_t pCmd = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U32(pCmd + 0x00u) = pCmd;
      U32(pCmd + 0x04u) = pCmd;
      U32(pCmd + 0x08u) = (c == 0) ? 5u : 7u;
      U32(pCmd + 0x0Cu) = (c == 0) ? 2u : 99u;
      U32(pCmd + 0x10u) = 0u;
      U32(pCmd + 0x14u) = (c == 0) ? 1u : 0u;
      U32(pCmd + 0x18u) = 5u;
      U32(pAiGen + 0x20u) = pCmd;
      U32(pAiGen + 0x24u) = pCmd;
    }
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.nargs = 1;
    s.args[0] = STAGE_GAME;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0 };
    run_and_emit(0x6FC36A30u, "AI_TickNodes4_5_7_113c", c,
        (c == 0 ? "node5_stall" : c == 1 ? "node7_invalid_mode" : "no_nodes"), &s, tsArgs, 2, 0x000000FFu, 0);
  }

  /* 147. 0x6FC39C20 AI_WarrivGreetMem113c (eax=pUnit, [esp+4..8]=[pGame, pAiTickParam], ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x9Bu, 0x101u, 1u, 5005u, 5005u, 0x1111u);
    stage_player_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0x201u, 1u, 5006u, 5006u, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t pAiGen = U32(STAGE_UDATA0 + 0x28u);
    uint32_t pInt = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(STAGE_UDATA0 + 0x30u) = pInt;
    U32(pAiGen + 0x14u) = (c == 1) ? 5u : 0u;
    U32(STAGE_SCRATCH) = pAiGen;
    if (c == 2) U32(STAGE_UNIT1 + 0x00u) = 1u; /* non-player -> no sound greet */
    s = make_call();
    s.eax = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = STAGE_GAME;
    s.args[1] = STAGE_SCRATCH;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, STAGE_SCRATCH };
    run_and_emit(0x6FC39C20u, "AI_WarrivGreetMem113c", c,
        (c == 0 ? "greet_cd0" : c == 1 ? "greet_timer5" : "no_player"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 148. 0x6FC472C0 SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c (edi=pUnit, [esp+4]=pGame, [esp+8]=pSkill, ret 8) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 5u, 0x101u, 1u, 5005u, 5005u, 0);
    uint32_t pSk = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0xA8u) = pSk;
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 14, 4, 0, 0, 0);
    uint32_t pSkill = (c == 0) ? 0u : U32(pSk + 0x04u);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5006u, 5006u, 0x2222u);
    stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 0x301u, 1u, 5006u, 5006u, 0x3333u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    if (c == 1) fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
    if (c == 2 && pSkill != 0u) {
      U32(pSkill + 0x20u) = 1u;
      U32(pSkill + 0x24u) = 0x301u;
    }
    s = make_call();
    s.edi = STAGE_UNIT0;
    s.nargs = 2;
    s.args[0] = STAGE_GAME;
    s.args[1] = pSkill;
    s.calleePop = 8;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_UNIT0, (int64_t)pSkill };
    run_and_emit(0x6FC472C0u, "SKILLS_FindNextMeleeTargetInRadius_6FC472C0_113c", c,
        (c == 0 ? "null_skill" : c == 1 ? "path_target_unit1" : "saved_guid_unit2"), &s, tsArgs, 3, 0xFFFFFFFFu, 0);
  }

  /* 149. 0x6FC3E3D0 D2Game_6FC3E3D0_113c (eax=pAiTickArgs, edi=pUnit, [esp+4]=pGame, ret 4) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_player_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0x101u, 1u, 5005u, 5005u, 0);
    stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x201u, 1u, 5008u, 5008u, 0x2222u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    uint32_t pAiGen = U32(STAGE_UDATA1 + 0x28u);
    uint32_t pAiCtrl = U32(STAGE_UDATA1 + 0x2Cu);
    U32(pAiGen + 0x28u) = STAGE_GAME;
    U32(pAiGen + 0x2Cu) = (c == 0) ? 0x101u : 0x999u;
    U32(pAiGen + 0x30u) = 0u;
    U32(pAiCtrl + 0x1Cu) = (c == 1) ? 0x101u : 0u;
    U32(STAGE_SCRATCH + 0x00u) = pAiCtrl;
    U32(STAGE_SCRATCH + 0x1Cu) = U32(STAGE_UDATA1 + 0x00u);
    s = make_call();
    s.eax = STAGE_SCRATCH;
    s.edi = STAGE_UNIT1;
    s.nargs = 1;
    s.args[0] = STAGE_GAME;
    s.calleePop = 4;
    int64_t tsArgs[] = { STAGE_SCRATCH, STAGE_UNIT1, STAGE_GAME };
    run_and_emit(0x6FC3E3D0u, "D2Game_6FC3E3D0_113c", c,
        (c == 0 ? "owner_live" : c == 1 ? "saved_plr_guid" : "stall_10"), &s, tsArgs, 3, 0x00000000u, 0);
  }

  /* 150. 0x6FC52A10 OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c (ecx=pGame, edx=pRoom, args=[nGroupProbByte, nObjectId, wDensity], ret 12) */
  for (int c = 0; c < 3; c++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pObjCtrl = (uint32_t)(uintptr_t)bump_alloc(0x200u);
    uint32_t pActCtrl = (uint32_t)(uintptr_t)bump_alloc(0x80u);
    U32(pObjCtrl + 0x00u) = 0x13572469u + (uint32_t)c * 97u;
    U32(pObjCtrl + 0x04u) = 0x29Au;
    U32(pObjCtrl + 2u * 4u + 0x48u) = pActCtrl;
    U32(pActCtrl + 0x08u) = 32u;
    U32(pActCtrl + 0x18u) = (c == 2) ? 4u : 0u; /* max 4 wells */
    U32(STAGE_GAME + 0x10F0u) = pObjCtrl;
    uint32_t objId = (c == 0) ? 7u : 10u;
    uint32_t dens = (c == 0) ? 100u : (c == 1) ? 50u : 100u;
    s = make_call();
    s.ecx = STAGE_GAME;
    s.edx = STAGE_ROOM0;
    s.nargs = 3;
    s.args[0] = 0x40u;
    s.args[1] = objId;
    s.args[2] = dens;
    s.calleePop = 12;
    int64_t tsArgs[] = { STAGE_GAME, STAGE_ROOM0, 0x40, (int64_t)objId, (int64_t)dens };
    run_and_emit(0x6FC52A10u, "OBJECTS_SpawnWellFromGroupEntry_6FC52A10_113c", c,
        (c == 0 ? "well_obj7_d100" : c == 1 ? "well_obj10_d50" : "well_capped_4"), &s, tsArgs, 5, 0xFFFFFFFFu, 0);
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
    fprintf(stderr, "[k6-p6] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
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
    fprintf(stderr, "[k6-p6] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-p6] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-p6] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-p6] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_group_1_d2game_p6();
  emit_group_2a_d2game_p6();
  emit_group_2b_d2game_p6();
  emit_group_2c_d2game_p6();
  emit_group_3a_d2game_p6();
  emit_group_3b_d2game_p6();
  emit_group_3c_d2game_p6();
  emit_group_4a_d2game_p6();
  emit_group_4b_d2game_p6();
  emit_group_4c_d2game_p6();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-p6] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
