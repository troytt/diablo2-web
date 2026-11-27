/*
 * k6-fix4-d2game-emitter.c — [K6] Fix 4 Real-DLL Differential Emitter (100.00% Grand Slam Closer)
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables + D2Common .data/.bss from
 * d2game-datatbls-113c.img, hooks external OS/Fog/Storm/D2Net runtime boundaries,
 * and executes ALL 34 remaining un-hit D2Game.dll VAs (>= 3 non-degenerate
 * vectors per VA).
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

static uint32_t g_item_sword = 0;
static uint32_t g_item_bow   = 0;
static uint32_t g_item_ring  = 0;
static uint32_t g_item_armor = 0;

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
      "leal -0x380(%esp), %edi\n\t"
      "xorl %eax, %eax\n\t"
      "movl $0xE0, %ecx\n\t"
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
    fprintf(stderr, "[k6-fix4] allocator overflow (setup=%d size=%u)\n", g_in_setup_phase, sz);
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

static void __stdcall stub_InitializeCriticalSection(void *pCs) {
  (void)pCs;
}
static void __stdcall stub_EnterCriticalSection(void *pCs) {
  (void)pCs;
}
static void __stdcall stub_LeaveCriticalSection(void *pCs) {
  (void)pCs;
}
static void __stdcall stub_Sleep(DWORD ms) {
  (void)ms;
}
static DWORD __stdcall stub_GetTickCount(void) {
  return g_fake_tick_count;
}
static void __stdcall stub_GetSystemTimeAsFileTime(FILETIME *lpOut) {
  if (lpOut) {
    /* 116444736000000000ULL = 1970-01-01T00:00:00Z -> CRT time(0) == 0 */
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

/* Storm TSHashTable<D2GameStrc> deterministic vtable callbacks (installed at HASH_VTABLE_ADDR) */
typedef struct {
  int32_t  linkOffset;
  uint32_t prev;
  uint32_t next;
} TSExplicitList;

static void __stdcall game_hash_dtor_stub(void *arg) { (void)arg; }

static void *__fastcall game_hash_alloc_node(
    void *self, void *unusedEdx, TSExplicitList *pBucket, uint32_t extraBytes, uint32_t flags) {
  (void)self; (void)unusedEdx; (void)flags;
  uint32_t totalSize = 0x1DF4u + extraBytes;
  uint8_t *node = (uint8_t *)bump_alloc(totalSize);
  uintptr_t headAddr = (uintptr_t)&pBucket->prev;
  uint32_t prevPtr = pBucket->prev;
  uint32_t *prevNextField = (prevPtr == (uint32_t)headAddr)
                                ? &pBucket->next
                                : (uint32_t *)(uintptr_t)(prevPtr + (uint32_t)pBucket->linkOffset + 4u);
  *(uint32_t *)(node + 0x04) = prevPtr;
  *(uint32_t *)(node + 0x08) = *prevNextField;
  *prevNextField = (uint32_t)(uintptr_t)node;
  pBucket->prev = (uint32_t)(uintptr_t)node;
  return node;
}

static void __fastcall game_hash_scalar_dtor(void *self, void *unusedEdx, uint32_t flags) {
  (void)self; (void)unusedEdx; (void)flags;
}
static void __fastcall game_hash_unlink_all(void *self, void *unusedEdx) {
  (void)self; (void)unusedEdx;
}

static void init_explicit_list_at(uint32_t addr, int32_t linkOffset) {
  uint32_t headAddr = addr + 4u;
  S32(addr + 0u) = linkOffset;
  U32(addr + 4u) = headAddr;
  U32(addr + 8u) = ~headAddr;
}

static uint32_t stage_game_hash_table(uint32_t hashMask, uint32_t nextHashKey) {
  uint32_t nBuckets = hashMask + 1u;
  uint32_t pTbl     = (uint32_t)(uintptr_t)bump_alloc(0x68u);
  uint32_t pBuckets = (uint32_t)(uintptr_t)bump_alloc(nBuckets * 12u);
  U32(pTbl + 0x00u) = HASH_VTABLE_ADDR;
  init_explicit_list_at(pTbl + 0x04u, 0x0C);
  U32(pTbl + 0x10u) = 0u;
  U32(pTbl + 0x14u) = nBuckets;
  U32(pTbl + 0x18u) = nBuckets;
  U32(pTbl + 0x1Cu) = pBuckets;
  U32(pTbl + 0x20u) = 4u;
  U32(pTbl + 0x24u) = hashMask;
  for (uint32_t i = 0; i < nBuckets; i++) {
    init_explicit_list_at(pBuckets + i * 12u, 0x04);
  }
  init_explicit_list_at(pTbl + 0x28u, 0x04);
  U32(pTbl + 0x34u) = 0x10u;
  init_explicit_list_at(pTbl + 0x38u, 0x10);
  U32(pTbl + 0x48u) = nextHashKey;
  U32(pTbl + 0x4Cu) = 0u;
  return pTbl;
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
      fprintf(stderr, "[k6-fix4] missing Fog.#%u\n", fogHooks[i].ord);
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
    fprintf(stderr, "[k6-fix4] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-fix4] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(D2COM_PREF_BASE + 0x99000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-fix4] short read at page %u\n", i);
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
        fprintf(stderr, "[k6-fix4] stage json overflow\n");
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
    uint32_t liveAddr = g_extra_caps[i].canonAddr + (uint32_t)g_game_rebase;
    format_mem_runs_range(out, cap, &len, liveAddr, liveAddr + g_extra_caps[i].len, &first, (uint32_t)g_game_rebase);
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

static uint32_t stage_game_mon_region(uint32_t levelId) {
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
  U32(pAct + 0x08u)         = 1u;
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
    uint32_t pAiCtrl = (uint32_t)(uintptr_t)bump_alloc(0x24u);
    U32(pUData + 0x28u) = pAiGen;
    U32(pUData + 0x2Cu) = pAiCtrl;
  }
}

static void stage_player_quest_flags(uint32_t pPlayerData, uint32_t *outFlagBuf) {
  uint32_t pQRec = (uint32_t)(uintptr_t)bump_alloc(0x10u);
  uint32_t pBuf  = (uint32_t)(uintptr_t)bump_alloc(0x60u);
  U32(pQRec + 0x00u) = pBuf;
  U32(pQRec + 0x04u) = 0x60u;
  U32(pPlayerData + 0x10u) = pQRec;
  U32(pPlayerData + 0x14u) = pQRec;
  U32(pPlayerData + 0x18u) = pQRec;
  if (outFlagBuf) *outFlagBuf = pBuf;
}

static void set_quest_flag_bit(uint32_t pBuf, uint32_t questId, uint32_t bit) {
  uint32_t byteOff = questId * 2u + (bit >> 3);
  U8(pBuf + byteOff) |= (uint8_t)(1u << (bit & 7u));
}

static void link_player_client(uint32_t pUnit, uint32_t pUData, uint32_t pCli, uint32_t guid) {
  U32(pUData + 0x9Cu) = pCli;
  U32(pCli + 0x00u)   = guid;
  U32(pCli + 0x04u)   = 4u;
  U32(pCli + 0x16Cu)  = 0u;
  U32(pCli + 0x170u)  = guid;
  U32(pCli + 0x174u)  = pUnit;
  U32(pCli + 0x1A8u)  = STAGE_GAME;
  U32(pCli + 0x3D4u)  = 1u;
  if (U32(STAGE_GAME + 0x88u) == 0u) {
    U32(STAGE_GAME + 0x88u) = pCli;
  }
}

static void stage_client_pkt_pool(uint32_t pCli) {
  uint32_t n0 = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  uint32_t n1 = (uint32_t)(uintptr_t)bump_alloc(0x210u);
  U32(n0 + 0x204u) = n1;
  U32(pCli + 0x1C0u) = n0;
  U32(pCli + 0x1A8u) = STAGE_GAME;
}

static void stage_saveable_player(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pCli,
    uint32_t charClass, uint32_t guid, const char *charName, const char *acctName, uint32_t seedLo) {
  stage_unit_common(pUnit, pUData, pPath, STAGE_ROOM0, 0u, charClass, guid, 1u, 5000u, 5000u, seedLo);
  strncpy((char *)(uintptr_t)pUData, charName, 15);
  link_player_client(pUnit, pUData, pCli, guid);
  U8(pCli + 0x08u) = (uint8_t)charClass;
  strncpy((char *)(uintptr_t)(pCli + 0x0Du), charName, 15);
  strncpy((char *)(uintptr_t)(pCli + 0x1Du), acctName, 15);

  uint32_t qBuf = 0u;
  stage_player_quest_flags(pUData, &qBuf);
  set_quest_flag_bit(qBuf, 1u, 0u);

  for (uint32_t d = 0; d < 3u; d++) {
    uint32_t wp = (uint32_t)(uintptr_t)bump_alloc(0x20u);
    U16(wp + 0x00u) = 0x0102u;
    U32(wp + 0x02u) = 0x00000001u | (d << 4);
    U32(pUData + 0x1Cu + d * 4u) = wp;

    uint32_t pIntro = (uint32_t)(uintptr_t)bump_alloc(0x08u);
    uint32_t pQHold = (uint32_t)(uintptr_t)bump_alloc(0x08u);
    uint32_t pQBuf  = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    uint32_t pNHold = (uint32_t)(uintptr_t)bump_alloc(0x08u);
    uint32_t pNBuf  = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(pIntro + 0x00u) = pQHold; U32(pQHold) = pQBuf;
    U32(pIntro + 0x04u) = pNHold; U32(pNHold) = pNBuf;
    U32(pUData + 0x60u + d * 4u) = pIntro;
  }

  void *pSkList = fn_AllocSkillList(NULL);
  uint32_t skListAddr = (uint32_t)(uintptr_t)pSkList;
  U32(pUnit + 0xA8u) = skListAddr;
  fn_SetSkillLevel((void *)(uintptr_t)pUnit, 0, 1, 0, 0, 0); /* Attack */
  if (charClass == 1u) {
    fn_SetSkillLevel((void *)(uintptr_t)pUnit, 36, 3, 0, 0, 0);
  }
  uint32_t pFirstSk = U32(skListAddr + 0x04u);
  U32(skListAddr + 0x08u) = pFirstSk; /* pLeftSkill */
  U32(skListAddr + 0x0Cu) = pFirstSk; /* pRightSkill */
  fn_AllocInventory(NULL, (void *)(uintptr_t)pUnit);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 12, 10, 0); /* level */
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 0, 25, 0);  /* str */
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 6, 100 << 8, 0); /* hp */
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 7, 100 << 8, 0); /* maxhp */
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
  uint32_t stkLo = (g_thunk_saved_esp > 0x4000u) ? (g_thunk_saved_esp - 0x4000u) : 0u;
  uint32_t stkHi = g_thunk_saved_esp + 0x1000u;
  for (uint32_t a = startAddr; a + 4u <= endAddr; a += 4u) {
    uint32_t v = U32(a);
    if (delta != 0u && v >= lo && v < hi) {
      U32(a) = v - delta;
    } else if (stkLo != 0u && v >= stkLo && v < stkHi) {
      U32(a) = 0x7E000000u;
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

  g_thunk_target = (uint32_t)((canonVa - D2GAME_PREF_BASE) + (uintptr_t)g_hGame);
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
            "[k6-fix4] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-fix4] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-fix4] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-fix4] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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
    if (!g_item_sword && code == 0x20647373u) g_item_sword = id;
    if (!g_item_bow   && code == 0x20776273u) g_item_bow   = id;
    if (!g_item_ring  && code == 0x206E6972u) g_item_ring  = id;
    if (!g_item_armor && code == 0x20697571u) g_item_armor = id;
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
 * GROUP 1: 7 VAs — MONSTER_StartMode / timer-wheel & counters
 * ============================================================================ */

static void emit_group_1_monster_modes(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* [G1-01] 0x6FC96A50 MONSTER_StartMode8CastA_6FC96A50_113c (ecx=pGame, edx=pMonster, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 37u;
    uint32_t mon = STAGE_UNIT0;
    if (k == 0) {
      mon = 0u;
    } else {
      uint32_t cid = (k == 1) ? 58u : (k == 2 ? 58u : 1u); /* 58=FallenShaman (has S1), 1=Fallen */
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 10u, 1u, 5000u, 5000u, 1101u + (uint32_t)k);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5004u, 5004u, 1111u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      if (k >= 2) {
        fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      }
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = mon; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = mon;
    snprintf(lbl, sizeof(lbl), "mon_mode8_castA_k%d", k);
    run_and_emit(0x6FC96A50u, "MONSTER_StartMode8CastA_6FC96A50_113c", k, lbl, &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [G1-02] 0x6FC96B20 MONSTER_StartMode8CastB_6FC96B20_113c (ecx=pGame, edx=pMonster, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_GAME + 0xA8u) = 120u + (uint32_t)k * 41u;
    uint32_t mon = STAGE_UNIT0;
    if (k == 0) {
      mon = 0u;
    } else {
      uint32_t cid = (k == 1) ? 58u : (k == 2 ? 58u : 1u);
      stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 11u, 1u, 5000u, 5000u, 1201u + (uint32_t)k);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5005u, 5003u, 1211u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      if (k >= 2) {
        fn_PathSetTargetUnit((void *)(uintptr_t)STAGE_PATH0, (void *)(uintptr_t)STAGE_UNIT1);
      }
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = mon; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = mon;
    snprintf(lbl, sizeof(lbl), "mon_mode8_castB_k%d", k);
    run_and_emit(0x6FC96B20u, "MONSTER_StartMode8CastB_6FC96B20_113c", k, lbl, &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [G1-03] 0x6FC9C060 AI_TentacleSkillCastA_6FC9C060_113c (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 80u);
    stage_game_mon_region(80u);
    U32(STAGE_GAME + 0xA8u) = 150u + (uint32_t)k * 20u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 267u, 20u, 1u, 5000u, 5000u, 1301u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5003u, 5003u, 1311u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiParam = STAGE_SCRATCH;
    U32(pAiParam + 0x00u) = U32(STAGE_UDATA0 + 0x2Cu);
    U32(pAiParam + 0x08u) = (k == 0) ? 0u : STAGE_UNIT1;
    U32(pAiParam + 0x14u) = (k == 1) ? 2u : 12u;
    U32(pAiParam + 0x1Cu) = U32(STAGE_UDATA0 + 0x00u);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pAiParam; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pAiParam;
    snprintf(lbl, sizeof(lbl), "tentacle_castA_k%d", k);
    run_and_emit(0x6FC9C060u, "AI_TentacleSkillCastA_6FC9C060_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [G1-04] 0x6FC9C1D0 AI_TentacleSkillCastB_6FC9C1D0_113c (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 80u);
    stage_game_mon_region(80u);
    U32(STAGE_GAME + 0xA8u) = 160u + (uint32_t)k * 20u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 267u, 21u, 1u, 5000u, 5000u, 1401u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5003u, 5003u, 1411u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAiParam = STAGE_SCRATCH;
    U32(pAiParam + 0x00u) = U32(STAGE_UDATA0 + 0x2Cu);
    U32(pAiParam + 0x08u) = (k == 0) ? 0u : STAGE_UNIT1;
    U32(pAiParam + 0x14u) = (k == 1) ? 2u : 12u;
    U32(pAiParam + 0x1Cu) = U32(STAGE_UDATA0 + 0x00u);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pAiParam; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pAiParam;
    snprintf(lbl, sizeof(lbl), "tentacle_castB_k%d", k);
    run_and_emit(0x6FC9C1D0u, "AI_TentacleSkillCastB_6FC9C1D0_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [G1-05] 0x6FC9D550 AI_SubmergedOrStuckTransition_6FC9D550_113c (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 80u);
    U32(STAGE_GAME + 0xA8u) = 170u + (uint32_t)k * 25u;
    uint32_t mode = (k == 1) ? 1u : 0x0Bu;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 267u, 22u, mode, 5000u, 5000u, 1501u + (uint32_t)k);
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    U32(pAiCtrl + 0x00u) = (k == 1) ? 2u : 0u;
    uint32_t pAiParam = STAGE_SCRATCH;
    U32(pAiParam + 0x00u) = pAiCtrl;
    U32(pAiParam + 0x1Cu) = U32(STAGE_UDATA0 + 0x00u);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pAiParam; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pAiParam;
    snprintf(lbl, sizeof(lbl), "submerged_trans_k%d", k);
    run_and_emit(0x6FC9D550u, "AI_SubmergedOrStuckTransition_6FC9D550_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [G1-06] 0x6FCBCC00 AI_ThinkSpecialAiState3_6FCBCC00_113c (ecx=pGame, edx=pUnit, s0=pAiThinkArg, ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_GAME + 0xA8u) = 200u + (uint32_t)k * 15u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 25u, 1u, 5000u, 5000u, 1601u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5012u, 5012u, 1611u);
    if (k == 0) U32(STAGE_UDATA0 + 0x54u) = 3u;
    uint32_t pAiCtrl = U32(STAGE_UDATA0 + 0x2Cu);
    uint32_t pAiArg  = STAGE_SCRATCH;
    U32(pAiArg + 0x00u) = pAiCtrl;
    U32(pAiArg + 0x08u) = STAGE_UNIT1;
    U32(pAiArg + 0x14u) = (k == 1) ? 2u : (k == 2 ? 15u : 6u);
    U32(pAiArg + 0x1Cu) = U32(STAGE_UDATA0 + 0x00u);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pAiArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pAiArg;
    snprintf(lbl, sizeof(lbl), "special_ai_state3_k%d", k);
    run_and_emit(0x6FCBCC00u, "AI_ThinkSpecialAiState3_6FCBCC00_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [G1-07] 0x6FC35BB0 AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c (esi=pMonster, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    U32(STAGE_GAME + 0xA8u) = 210u + (uint32_t)k * 20u;
    uint32_t cid = (k == 2) ? 5u : 1u;
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 30u, 1u, 5000u, 5000u, 1701u + (uint32_t)k);
    uint32_t pMonInteract = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(STAGE_UDATA0 + 0x30u) = pMonInteract;
    if (k == 0) {
      uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pNode + 0x00u) = STAGE_UNIT1; /* player interacting -> returns 0 */
      U32(pMonInteract + 0x00u) = pNode;
    }
    c = make_call();
    c.esi = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "despawn_no_interact_k%d", k);
    run_and_emit(0x6FC35BB0u, "AI_DespawnIfNoPlayerInteracting_6FC35BB0_113c", k, lbl, &c, ts, 2, 0xFFFFFFFFu, 0);
  }
}

/* ============================================================================
 * GROUP 2: 6 VAs — MONSTER_InitMonsterUnit +20B allocation fix
 * ============================================================================ */

static void emit_group_2_object_monster_spawn(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* [G2-01] 0x6FC89970 OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c (ecx=pGame, edx=pObject, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 40u, 0u, 5004u, 5004u, 2101u + (uint32_t)k);
    /* bTrapType at pObjectData + 0x04: 0=none, 1=firebolt/trap, 4=poison/monster, 7=skeleton */
    U8(STAGE_UDATA0 + 0x04u) = (k == 0) ? 0u : (k == 1 ? 1u : (k == 2 ? 6u : 7u));
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "obj_trap_dispatch_k%d", k);
    run_and_emit(0x6FC89970u, "OBJ_DispatchObjectTrapOrMonsterSpawn_6FC89970_113c", k, lbl, &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [G2-02] 0x6FC8B7A0 OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c (esi=pObject, s0=pGame, s1=nMonsterId, ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 41u, 0u, 5004u, 5004u, 2201u + (uint32_t)k);
    int32_t monId = (k == 0) ? -1 : (k == 1 ? 1 : (k == 2 ? 369 : 329));
    c = make_call();
    c.esi = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = (uint32_t)monId; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = monId;
    snprintf(lbl, sizeof(lbl), "obj_spawn_single_mon_k%d", k);
    run_and_emit(0x6FC8B7A0u, "OBJ_SpawnSingleMonsterFromObject_6FC8B7A0_113c", k, lbl, &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [G2-03] 0x6FC8B860 OBJ_SpawnMonster369FromObject_6FC8B860_113c (ecx=pGame, edx=pObject, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 42u + (uint32_t)k, 0u,
                      (uint16_t)(5002u + (uint32_t)k * 2u), (uint16_t)(5002u + (uint32_t)k * 2u), 2301u + (uint32_t)k * 17u);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "obj_spawn_mon369_k%d", k);
    run_and_emit(0x6FC8B860u, "OBJ_SpawnMonster369FromObject_6FC8B860_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [G2-04] 0x6FC8B870 OBJ_SpawnMonster329FromObject_6FC8B870_113c (ecx=pGame, edx=pObject, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 45u + (uint32_t)k, 0u,
                      (uint16_t)(5002u + (uint32_t)k * 2u), (uint16_t)(5004u + (uint32_t)k * 2u), 2401u + (uint32_t)k * 17u);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "obj_spawn_mon329_k%d", k);
    run_and_emit(0x6FC8B870u, "OBJ_SpawnMonster329FromObject_6FC8B870_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [G2-05] 0x6FC8B880 OBJ_SpawnMonster326FromObject_6FC8B880_113c (ecx=pGame, edx=pObject, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 48u + (uint32_t)k, 0u,
                      (uint16_t)(5003u + (uint32_t)k * 2u), (uint16_t)(5003u + (uint32_t)k * 2u), 2501u + (uint32_t)k * 17u);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "obj_spawn_mon326_k%d", k);
    run_and_emit(0x6FC8B880u, "OBJ_SpawnMonster326FromObject_6FC8B880_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [G2-06] 0x6FC8B890 OBJ_SpawnMonster330FromObject_6FC8B890_113c (ecx=pGame, edx=pObject, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_game_mon_region(2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 51u + (uint32_t)k, 0u,
                      (uint16_t)(5004u + (uint32_t)k * 2u), (uint16_t)(5002u + (uint32_t)k * 2u), 2601u + (uint32_t)k * 17u);
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "obj_spawn_mon330_k%d", k);
    run_and_emit(0x6FC8B890u, "OBJ_SpawnMonster330FromObject_6FC8B890_113c", k, lbl, &c, ts, 2, 0u, 0);
  }
}

/* ============================================================================
 * GROUP 3: 4 VAs — Moving missile pPath+0x38 parity
 * ============================================================================ */

static void emit_group_3_missile_shrines(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* [G3-01] 0x6FC5CB00 MISSILES_SpawnRadial8SubMissiles_6FC5CB00_113c
   * (eax=pOriginUnit, edx=nMissileId, s0=pGame, s1=pOwnerUnit, s2=nSkillId, s3=nLevel, s4=nStep, ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5004u, 5004u, 3101u + (uint32_t)k);
    int32_t mId  = (k == 0) ? -1 : (k == 1 ? 0x30 : 0x3E);
    int32_t skId = (k == 1) ? 36 : 48;
    int32_t lvl  = (k == 1) ? 5 : 8;
    int32_t step = (k == 2) ? 2 : 1;
    c = make_call();
    c.eax = STAGE_UNIT0; c.edx = (uint32_t)mId;
    c.nargs = 5;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0;
    c.args[2] = (uint32_t)skId; c.args[3] = (uint32_t)lvl; c.args[4] = (uint32_t)step;
    c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = mId; ts[2] = STAGE_GAME; ts[3] = STAGE_UNIT0;
    ts[4] = skId; ts[5] = lvl; ts[6] = step;
    snprintf(lbl, sizeof(lbl), "radial8_submissiles_k%d", k);
    run_and_emit(0x6FC5CB00u, "MISSILES_SpawnRadial8SubMissiles_6FC5CB00_113c", k, lbl, &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [G3-02] 0x6FC8C200 OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c (ecx=pOperateArgs, edx=pShrineTxt, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 2u, 60u, 0u, 5004u, 5004u, 3201u + (uint32_t)k * 31u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5006u, 5006u, 3211u);
    uint32_t pArgs   = STAGE_SCRATCH + 0x00u;
    uint32_t pShrine = STAGE_SCRATCH + 0x40u;
    U32(pArgs + 0x00u) = STAGE_GAME;
    U32(pArgs + 0x04u) = STAGE_UNIT0;
    U32(pArgs + 0x08u) = STAGE_UNIT1;
    U32(pShrine + 0x04u) = (uint32_t)(k + 1); /* arg0 */
    U32(pShrine + 0x08u) = (uint32_t)(k + 2); /* arg1 */
    c = make_call();
    c.ecx = pArgs; c.edx = pShrine; c.calleePop = 0u;
    ts[0] = pArgs; ts[1] = pShrine;
    snprintf(lbl, sizeof(lbl), "shrine_poison_k%d", k);
    run_and_emit(0x6FC8C200u, "OBJ_ShrineEffectPoisonPotionsAndClouds_6FC8C200_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [G3-03] 0x6FC8C580 OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c (ecx=pOperateArgs, edx=pShrineTxt, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 2u, 61u, 0u, 5004u, 5004u, 3301u + (uint32_t)k * 31u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5006u, 5006u, 3311u);
    uint32_t pArgs   = STAGE_SCRATCH + 0x00u;
    uint32_t pShrine = STAGE_SCRATCH + 0x40u;
    U32(pArgs + 0x00u) = STAGE_GAME;
    U32(pArgs + 0x04u) = STAGE_UNIT0;
    U32(pArgs + 0x08u) = STAGE_UNIT1;
    U32(pShrine + 0x04u) = (uint32_t)(k + 1);
    U32(pShrine + 0x08u) = (uint32_t)(k + 2);
    c = make_call();
    c.ecx = pArgs; c.edx = pShrine; c.calleePop = 0u;
    ts[0] = pArgs; ts[1] = pShrine;
    snprintf(lbl, sizeof(lbl), "shrine_exploding_k%d", k);
    run_and_emit(0x6FC8C580u, "OBJ_ShrineEffectExplodingPotionsAndMissiles_6FC8C580_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [G3-04] 0x6FC8C900 OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c (ecx=pOperateArgs, edx=pShrineTxt, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 2u, 62u, 0u, 5004u, 5004u, 3401u + (uint32_t)k * 31u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5006u, 5006u, 3411u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, (100 + k * 50) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 200 << 8, 0);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    uint32_t pArgs   = STAGE_SCRATCH + 0x00u;
    uint32_t pShrine = STAGE_SCRATCH + 0x40u;
    U32(pArgs + 0x00u) = STAGE_GAME;
    U32(pArgs + 0x04u) = STAGE_UNIT0;
    U32(pArgs + 0x08u) = STAGE_UNIT1;
    U32(pShrine + 0x04u) = 5u;
    U32(pShrine + 0x08u) = 10u;
    c = make_call();
    c.ecx = pArgs; c.edx = pShrine; c.calleePop = 0u;
    ts[0] = pArgs; ts[1] = pShrine;
    snprintf(lbl, sizeof(lbl), "shrine_firenova_k%d", k);
    run_and_emit(0x6FC8C900u, "OBJ_ShrineEffectFireNovaAndHpDamage_6FC8C900_113c", k, lbl, &c, ts, 2, 0u, 0);
  }
}

/* ============================================================================
 * GROUP 4: 2 VAs — Mode 0x0C dead flags & pAnimData
 * ============================================================================ */

static void emit_group_4_dead_mode12(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* [G4-01] 0x6FC7DD00 ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c (esi=pMonster, s0=pQuest, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 114u);
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    uint32_t cid = (k == 2) ? 1u : 527u; /* 527 = Frozen Anya */
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 70u, 1u, 5004u, 5004u, 4101u + (uint32_t)k);
    uint32_t pMonInteract = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(STAGE_UDATA0 + 0x30u) = pMonInteract;
    if (k == 0) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5006u, 5006u, 4111u);
      link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT, 1u);
      stage_client_pkt_pool(STAGE_CLIENT);
      uint32_t pNode = (uint32_t)(uintptr_t)bump_alloc(0x10u);
      U32(pNode + 0x00u) = STAGE_UNIT1;
      U32(pMonInteract + 0x00u) = pNode;
    }
    c = make_call();
    c.esi = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_QUEST0;
    snprintf(lbl, sizeof(lbl), "thaw_frozen_anya_k%d", k);
    run_and_emit(0x6FC7DD00u, "ACT5Q3_ThawFrozenAnyaMonster_6FC7DD00_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [G4-02] 0x6FC959F0 MONMODE_StepPathOrFinishToDeadMode12_6FC959F0_113c (ecx=pGame, edx=pUnit, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cid  = (k == 2) ? 5u : 1u;
    uint32_t mode = (k == 0) ? 1u : (k == 1 ? 11u : 0u);
    stage_monster_full(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cid, 71u, mode, 5004u, 5004u, 4201u + (uint32_t)k);
    if (k == 0) {
      /* Give path a target point so PATH_StepPath returns nonzero (stepped) */
      U32(STAGE_PATH0 + 0x10u) = 5006u;
      U32(STAGE_PATH0 + 0x14u) = 5006u;
      U32(STAGE_PATH0 + 0x24u) = 1u;
      U16(STAGE_PATH0 + 0x80u) = 5006u;
      U16(STAGE_PATH0 + 0x82u) = 5006u;
    }
    c = make_call();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    snprintf(lbl, sizeof(lbl), "monmode_step_or_dead12_k%d", k);
    run_and_emit(0x6FC959F0u, "MONMODE_StepPathOrFinishToDeadMode12_6FC959F0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }
}

/* ============================================================================
 * GROUP 5: 7 Standalone Surgical Fixes
 * ============================================================================ */

static void emit_group_5_standalone(void) {
  X86CallSpec c;
  int64_t ts[8];
  char lbl[64];

  /* [G5-01] 0x6FC32AF0 ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c (edi=pPlayerUnit, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t plr = STAGE_UNIT0;
    if (k == 0) {
      plr = 0u;
    } else {
      uint32_t cls = (k == 1) ? 0u : 3u;
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, cls, 80u, 1u, 5004u, 5004u, 5101u + (uint32_t)k);
      strncpy((char *)(uintptr_t)STAGE_UDATA0, (k == 1) ? "HeroAlpha" : "HeroBeta", 15);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 1) ? 15 : 85, 0);
    }
    c = make_call();
    c.edi = plr;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = plr; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "spawn_player_ear_k%d", k);
    run_and_emit(0x6FC32AF0u, "ITEMS_SpawnAndDropPlayerEar_6FC32AF0_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [G5-02] 0x6FCAE420 EVENT_AllocChunk113c (eax=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_GAME + 0x1Cu) = (uint32_t)(0x11110000u + (uint32_t)k * 0x1111u);
    c = make_call();
    c.eax = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "event_alloc_chunk_k%d", k);
    run_and_emit(0x6FCAE420u, "EVENT_AllocChunk113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [G5-03] 0x6FC548A0 QUESTS_AllocAndInitGameQuests_6FC548A0_113c (s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(STAGE_GAME + 0xD0u) = 0x11111111u * (uint32_t)(k + 1);
    U32(STAGE_GAME + 0xD4u) = 0x0000029Au;
    U8(STAGE_GAME + 0x6Du)  = (uint8_t)k;
    U32(STAGE_GAME + 0x70u) = (k == 2) ? 0u : 1u;
    c = make_call();
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "quests_alloc_init_k%d", k);
    run_and_emit(0x6FC548A0u, "QUESTS_AllocAndInitGameQuests_6FC548A0_113c", k, lbl, &c, ts, 1, 0u, 0);
  }

  /* [G5-04] 0x6FC7FD00 ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c (ecx=pQuestArg, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x84u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5004u, 5004u, 5401u + (uint32_t)k);
    uint32_t qBuf = 0u;
    stage_player_quest_flags(STAGE_UDATA0, &qBuf);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT, 10u);
    stage_client_pkt_pool(STAGE_CLIENT);
    U8(STAGE_GAME + 0x6Au) = 0u; /* realm type so SaveAndDrainSPClients returns immediately */
    /* Stage quest 0x24 in pGame->pQuestControl */
    U32(STAGE_GAME + 0x10F4u)  = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)  = 0x24u;
    U32(STAGE_QUEST0 + 0x04u)  = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xE0u)  = 0x28u;
    U32(STAGE_QUESTEX0 + 0x9Cu) = (k == 0) ? 0u : 2u;
    if (k == 2) {
      set_quest_flag_bit(qBuf, 0x28u, 0x0Du);
      U8(STAGE_UNIT0 + 0x6Cu) = 0u;
      for (uint32_t d = 0; d < 3u; d++) {
        uint32_t pIntro = (uint32_t)(uintptr_t)bump_alloc(0x08u);
        uint32_t pQHold = (uint32_t)(uintptr_t)bump_alloc(0x08u);
        uint32_t pQBuf  = (uint32_t)(uintptr_t)bump_alloc(0x10u);
        uint32_t pNHold = (uint32_t)(uintptr_t)bump_alloc(0x08u);
        uint32_t pNBuf  = (uint32_t)(uintptr_t)bump_alloc(0x10u);
        U32(pIntro + 0x00u) = pQHold; U32(pQHold) = pQBuf;
        U32(pIntro + 0x04u) = pNHold; U32(pNHold) = pNBuf;
        U32(STAGE_UDATA0 + 0x60u + d * 4u) = pIntro;
      }
      U32(STAGE_DRLG0 + 0x00u) = STAGE_LEVEL1;
      stage_room_with_coll(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 0x6Du);
      U32(STAGE_ACT0 + 0x10u) = STAGE_ROOM1;
      uint32_t pArena = (uint32_t)(uintptr_t)bump_alloc(0x20u);
      U8(pArena + 0x08u) = 2u;
      U32(STAGE_GAME + 0x1D28u) = pArena;
    }
    uint32_t pQuestArg = STAGE_SCRATCH;
    U32(pQuestArg + 0x00u) = STAGE_GAME;
    U32(pQuestArg + 0x08u) = STAGE_UNIT0;
    c = make_call();
    c.ecx = pQuestArg; c.calleePop = 0u;
    ts[0] = pQuestArg;
    snprintf(lbl, sizeof(lbl), "tyrael_portal_endgame_k%d", k);
    run_and_emit(0x6FC7FD00u, "ACT5Q6_OnTyraelPortalEnteredTriggerEndgame_6FC7FD00_113c", k, lbl, &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [G5-05] 0x6FC8DBF0 OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c (eax=pOperateArgs, ret) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    if (k != 1) {
      stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    }
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 1) ? 0u : STAGE_ROOM0, 2u, 5u, 85u,
                      (k == 0) ? 1u : 0u, 5004u, 5004u, 5501u + (uint32_t)k * 23u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, (k == 1) ? 0u : STAGE_ROOM0, 0u, 0u, 1u, 1u, 5006u, 5006u, 5511u);
    uint32_t pArgs = STAGE_SCRATCH;
    U32(pArgs + 0x00u) = STAGE_GAME;
    U32(pArgs + 0x04u) = STAGE_UNIT0;
    U32(pArgs + 0x08u) = STAGE_UNIT1;
    U32(pArgs + 0x10u) = 2u; /* object classId */
    c = make_call();
    c.eax = pArgs; c.calleePop = 0u;
    ts[0] = pArgs;
    snprintf(lbl, sizeof(lbl), "operate_stash_gold_pots_k%d", k);
    run_and_emit(0x6FC8DBF0u, "OBJ_OperateStashWithGoldAndPotions_6FC8DBF0_113c", k, lbl, &c, ts, 1, 0u, (k == 1 ? 1 : 0));
  }

  /* [G5-06] 0x6FC4D140 CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c (eax=pClient, s0=pGame, ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    uint32_t cli = (k == 0) ? 0u : STAGE_CLIENT;
    if (k >= 1) {
      uint32_t pSave = (uint32_t)(uintptr_t)bump_alloc(0x140u);
      for (uint32_t i = 0; i < 0x140u; i++) U8(pSave + i) = (uint8_t)((i * 7u + 3u) & 0xFFu);
      U8(STAGE_CLIENT + 0x3D4u)  = 0x10u;
      U32(STAGE_CLIENT + 0x17Cu) = pSave;
      U32(STAGE_CLIENT + 0x180u) = (k == 3) ? 300u : 12u;
      U32(STAGE_CLIENT + 0x184u) = (k == 1) ? 3u : 0u;
      U32(STAGE_CLIENT + 0x188u) = 0u;
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
    }
    c = make_call();
    c.eax = cli;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = cli; ts[1] = STAGE_GAME;
    snprintf(lbl, sizeof(lbl), "send_save_chunk_b3_k%d", k);
    run_and_emit(0x6FC4D140u, "CLIENTS_SendNextSaveChunkPacketB3_6FC4D140_113c", k, lbl, &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [G5-07] 0x6FCBE570 SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c
   * (ebx=nY, s0=pGame, s1=pUnit, s2=dwSize, s3=nX, ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room_with_coll(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5004u, 5004u, 5701u);
    link_unit_into_room(STAGE_ROOM0, STAGE_UNIT0);
    if (k >= 1) {
      stage_monster_full(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 20u, 1u, 5006u, 5005u, 5702u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT1);
    }
    if (k == 2) {
      stage_monster_full(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 5u, 21u, 1u, 5008u, 5006u, 5703u);
      link_unit_into_room(STAGE_ROOM0, STAGE_UNIT2);
    }
    uint32_t sz = (k == 2) ? 10u : 5u;
    c = make_call();
    c.ebx = 5004u;
    c.nargs = 4;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = sz; c.args[3] = 5004u;
    c.calleePop = 0x10u;
    ts[0] = 5004; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = (int64_t)sz; ts[4] = 5004;
    snprintf(lbl, sizeof(lbl), "alloc_find_units_radius_k%d", k);
    run_and_emit(0x6FCBE570u, "SKILLS_AllocAndFindUnitsInRadius_6FCBE570_113c", k, lbl, &c, ts, 5, 0xFFFFFFFFu, 0);
  }
}

/* ============================================================================
 * GROUP 6: 8 VAs — Storm / Game Create / Client Disconnect / Save Pipeline
 * ============================================================================ */

static void emit_group_6_storm_game_client_save(void) {
  X86CallSpec c;
  int64_t ts[12];
  char lbl[64];

  /* [G6-01] 0x6FC22090 STORM_TSHashTableInsertOrCreateNode_6FC22090_113c
   * (edi=pHashTable, s0=dwKey, s1=nExtraBytes, s2=dwFlags, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pTbl = stage_game_hash_table(7u, 0x10u);
    if (k == 2) {
      /* Pre-insert an existing node with key 0x11 into bucket 1 */
      uint32_t pExisting = (uint32_t)(uintptr_t)bump_alloc(0x1DF4u);
      uint32_t pBucket   = U32(pTbl + 0x1Cu) + 1u * 12u;
      uint32_t headAddr  = pBucket + 4u;
      U32(pExisting + 0x00u) = 0x11u;
      U32(pExisting + 0x04u) = headAddr;
      U32(pExisting + 0x08u) = ~headAddr;
      U32(pBucket + 4u)      = pExisting;
      U32(pBucket + 8u)      = pExisting;
    }
    uint32_t key   = (k == 1) ? 0x22u : 0x11u;
    uint32_t extra = (k == 1) ? 0x10u : 0u;
    c = make_call();
    c.edi = pTbl;
    c.nargs = 3; c.args[0] = key; c.args[1] = extra; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = pTbl; ts[1] = (int64_t)key; ts[2] = (int64_t)extra; ts[3] = 0;
    snprintf(lbl, sizeof(lbl), "storm_hash_insert_k%d", k);
    run_and_emit(0x6FC22090u, "STORM_TSHashTableInsertOrCreateNode_6FC22090_113c", k, lbl, &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [G6-02] 0x6FC4C2D0 GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0_113c
   * (eax=dwArenaFlags, s0..s10 = 11 args, ret 0x2C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    /* Clear global game slots, client hash tables, hash table ptr, worker list, callback table, init ver */
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x110C04u), 0, 0x1008u);
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x110398u), 0, 0x10u);
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x1103B8u), 0, 0x800u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x10E350u)) = 1u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x10E354u)) = 0x13579BDFu + (uint32_t)k * 0x11111u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C18u)) = 1u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C24u)) = 0u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C3Cu)) = 0u;
    U8(game_global_live(D2GAME_PREF_BASE + 0x111C30u))  = 1u;
    if (k >= 1) {
      uint32_t pTbl = stage_game_hash_table(7u, (uint32_t)(k * 5));
      U32(game_global_live(D2GAME_PREF_BASE + 0x111C24u)) = pTbl;
    }
    add_extra_cap(D2GAME_PREF_BASE + 0x10E350u, 0x08u);
    add_extra_cap(D2GAME_PREF_BASE + 0x110C04u, 0x20u);
    add_extra_cap(D2GAME_PREF_BASE + 0x110398u, 0x10u);
    add_extra_cap(D2GAME_PREF_BASE + 0x1103B8u, 0x800u);
    add_extra_cap(D2GAME_PREF_BASE + 0x111C18u, 0x30u);
    strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x00u), (k == 2) ? "TcpGame2" : "SpGame1");
    strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x40u), (k == 2) ? "HeroTwo" : "HeroOne");
    uint32_t arenaFlags = (k == 2) ? 0x300000u : 0x100000u;
    uint32_t bGameType  = (k == 2) ? 2u : 1u;
    uint32_t bClass     = (k == 2) ? 3u : 1u;
    uint32_t nDiff      = (k == 2) ? 1u : 0u;
    c = make_call();
    c.eax = arenaFlags;
    c.nargs = 11;
    c.args[0]  = 1u;                    /* dwClientId */
    c.args[1]  = STAGE_SCRATCH + 0x00u; /* szGameName */
    c.args[2]  = bGameType;             /* bGameType */
    c.args[3]  = bClass;                /* bCharClass */
    c.args[4]  = STAGE_SCRATCH + 0x40u; /* szCharName */
    c.args[5]  = 0u;                    /* arg5 */
    c.args[6]  = 0u;                    /* bTemplate */
    c.args[7]  = nDiff;                 /* nDifficulty */
    c.args[8]  = 0u;                    /* bLocaleId */
    c.args[9]  = 0u;
    c.args[10] = 0u;
    c.calleePop = 0x2Cu;
    ts[0] = (int64_t)arenaFlags;
    for (int i = 0; i < 11; i++) ts[i + 1] = (int64_t)c.args[i];
    snprintf(lbl, sizeof(lbl), "create_sp_tcp_game_k%d", k);
    run_and_emit(0x6FC4C2D0u, "GAME_CreateSinglePlayerOrTcpIpGame_6FC4C2D0_113c", k, lbl, &c, ts, 12, 0u, 0);
  }

  /* [G6-03] 0x6FC4C570 GAME_CreateMultiClientGame_6FC4C570_113c (s0..s7 = 8 args, ret 0x20) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x110C04u), 0, 0x1008u);
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x110398u), 0, 0x10u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x10E350u)) = 1u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x10E354u)) = 0x2468ACE1u + (uint32_t)k * 0x11111u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C24u)) = 0u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C3Cu)) = 0u;
    if (k >= 1) {
      uint32_t pTbl = stage_game_hash_table(7u, (uint32_t)(k * 3));
      U32(game_global_live(D2GAME_PREF_BASE + 0x111C24u)) = pTbl;
    }
    add_extra_cap(D2GAME_PREF_BASE + 0x10E350u, 0x08u);
    add_extra_cap(D2GAME_PREF_BASE + 0x110C04u, 0x20u);
    add_extra_cap(D2GAME_PREF_BASE + 0x110398u, 0x10u);
    add_extra_cap(D2GAME_PREF_BASE + 0x111C24u, 0x20u);
    strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x00u), (k == 2) ? "RealmHell" : "RealmNorm");
    strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x20u), "secret");
    strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x40u), "desc");
    uint32_t arenaFlags = (k == 2) ? 0x302000u : 0x100000u;
    uint32_t pOutSlot   = STAGE_SCRATCH + 0x80u;
    c = make_call();
    c.nargs = 8;
    c.args[0] = STAGE_SCRATCH + 0x00u; /* szGameName */
    c.args[1] = STAGE_SCRATCH + 0x20u; /* szGamePass */
    c.args[2] = STAGE_SCRATCH + 0x40u; /* szGameDesc */
    c.args[3] = arenaFlags;            /* dwArenaFlags */
    c.args[4] = 0u;                    /* bTemplate */
    c.args[5] = (uint32_t)k;           /* bUnk6C */
    c.args[6] = 1u;                    /* bUnk6E */
    c.args[7] = pOutSlot;              /* pwOutGameSlot */
    c.calleePop = 0x20u;
    for (int i = 0; i < 8; i++) ts[i] = (int64_t)c.args[i];
    snprintf(lbl, sizeof(lbl), "create_multi_game_k%d", k);
    run_and_emit(0x6FC4C570u, "GAME_CreateMultiClientGame_6FC4C570_113c", k, lbl, &c, ts, 8, 0xFFFFFFFFu, 0);
  }

  /* [G6-04] 0x6FC4D090 CLIENT_NotifyAndDisconnectClient_6FC4D090_113c (esi=pClient, s0=pGame, s1=bReasonByte, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t cli = (k == 0) ? 0u : STAGE_CLIENT;
    if (k >= 1) {
      U32(STAGE_CLIENT + 0x00u)  = 11u;
      U32(STAGE_CLIENT + 0x04u)  = 4u;
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
      strncpy((char *)(uintptr_t)(STAGE_CLIENT + 0x0Du), "HeroOne", 15);
      strncpy((char *)(uintptr_t)(STAGE_CLIENT + 0x1Du), "AcctOne", 15);
      U32(STAGE_GAME + 0x88u) = STAGE_CLIENT;
      U32(STAGE_GAME + 0x1DC8u + (11u & 0x7Fu) * 4u) = 0u; /* client hash slot if any */
      if (k == 2) {
        U32(STAGE_CLIENT + 0x4A8u)  = STAGE_CLIENT1;
        U32(STAGE_CLIENT1 + 0x00u)  = 22u;
        U32(STAGE_CLIENT1 + 0x04u)  = 4u;
        U32(STAGE_CLIENT1 + 0x1A8u) = STAGE_GAME;
        stage_client_pkt_pool(STAGE_CLIENT1);
      }
    }
    uint32_t reason = (k == 2) ? 0u : 3u;
    c = make_call();
    c.esi = cli;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = reason; c.calleePop = 8u;
    ts[0] = cli; ts[1] = STAGE_GAME; ts[2] = (int64_t)reason;
    snprintf(lbl, sizeof(lbl), "notify_disconnect_client_k%d", k);
    run_and_emit(0x6FC4D090u, "CLIENT_NotifyAndDisconnectClient_6FC4D090_113c", k, lbl, &c, ts, 3, 0u, 0);
  }

  /* [G6-05] 0x6FC4DC70 CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c (s0=dwClientId, s1=bBroadcast, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C24u)) = 0u;
    if (k >= 1) {
      uint32_t pTbl = stage_game_hash_table(7u, 1u);
      /* Link STAGE_GAME directly into bucket (1 & 7) = 1 with key 1 */
      uint32_t pBucket  = U32(pTbl + 0x1Cu) + 1u * 12u;
      uint32_t headAddr = pBucket + 4u;
      U32(STAGE_GAME + 0x00u) = 1u;
      U32(STAGE_GAME + 0x04u) = headAddr;
      U32(STAGE_GAME + 0x08u) = ~headAddr;
      U32(pBucket + 4u)       = STAGE_GAME;
      U32(pBucket + 8u)       = STAGE_GAME;
      U32(STAGE_GAME + 0x18u) = STAGE_CS_GAME;
      U8(STAGE_GAME + 0x6Au)  = 0u;
      U32(game_global_live(D2GAME_PREF_BASE + 0x111C24u)) = pTbl;
      g_d2net_client_key = 1u;

      U32(STAGE_CLIENT + 0x00u)  = 11u;
      U32(STAGE_CLIENT + 0x04u)  = 4u;
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
      U32(STAGE_CLIENT + 0x3D4u) = (k == 2) ? 0x20u : 0x00u;
      strncpy((char *)(uintptr_t)(STAGE_CLIENT + 0x0Du), "HeroOne", 15);
      strncpy((char *)(uintptr_t)(STAGE_CLIENT + 0x1Du), "AcctOne", 15);
      U32(STAGE_GAME + 0x88u) = STAGE_CLIENT;
      if (k == 2) {
        U32(STAGE_CLIENT + 0x4A8u)  = STAGE_CLIENT1;
        U32(STAGE_CLIENT1 + 0x00u)  = 22u;
        U32(STAGE_CLIENT1 + 0x04u)  = 4u;
        U32(STAGE_CLIENT1 + 0x1A8u) = STAGE_GAME;
        stage_client_pkt_pool(STAGE_CLIENT1);
      }
    }
    add_extra_cap(D2GAME_PREF_BASE + 0x111C24u, 0x08u);
    uint32_t cid = (k == 0) ? 999u : 11u;
    uint32_t bcast = (k == 2) ? 1u : 0u;
    c = make_call();
    c.nargs = 2; c.args[0] = cid; c.args[1] = bcast; c.calleePop = 8u;
    ts[0] = (int64_t)cid; ts[1] = (int64_t)bcast;
    snprintf(lbl, sizeof(lbl), "disconnect_save_by_id_k%d", k);
    run_and_emit(0x6FC4DC70u, "CLIENTS_DisconnectAndSaveClientById_6FC4DC70_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [G6-06] 0x6FC4E160 CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c (esi=pGame, s0=pDefaultClient, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    uint32_t pTbl = stage_game_hash_table(7u, 1u);
    uint32_t pBucket  = U32(pTbl + 0x1Cu) + 1u * 12u;
    uint32_t headAddr = pBucket + 4u;
    U32(STAGE_GAME + 0x00u) = 1u;
    U32(STAGE_GAME + 0x04u) = headAddr;
    U32(STAGE_GAME + 0x08u) = ~headAddr;
    U32(pBucket + 4u)       = STAGE_GAME;
    U32(pBucket + 8u)       = STAGE_GAME;
    U32(STAGE_GAME + 0x18u) = STAGE_CS_GAME;
    U8(STAGE_GAME + 0x6Au)  = 0u;
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C24u)) = pTbl;
    g_d2net_client_key = 1u;
    add_extra_cap(D2GAME_PREF_BASE + 0x111C24u, 0x08u);

    U32(STAGE_CLIENT + 0x00u)  = 11u;
    U32(STAGE_CLIENT + 0x04u)  = 4u;
    U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
    U32(STAGE_CLIENT + 0x3D4u) = (k == 0) ? 0x20u : 0x00u;
    U32(STAGE_GAME + 0x88u)    = STAGE_CLIENT;
    uint32_t pDef = (k == 1) ? STAGE_CLIENT : 0u;
    c = make_call();
    c.esi = STAGE_GAME;
    c.nargs = 1; c.args[0] = pDef; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pDef;
    snprintf(lbl, sizeof(lbl), "disconnect_flag20_fallback_k%d", k);
    run_and_emit(0x6FC4E160u, "CLIENTS_DisconnectFlag20OrFallbackClient_6FC4E160_113c", k, lbl, &c, ts, 2, 0u, 0);
  }

  /* [G6-07] 0x6FC73E50 PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c
   * (ecx=pClient, s0=pGame, s1=pPlayerUnit, s2=bUnkFlag, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    memset((void *)(uintptr_t)game_global_live(D2GAME_PREF_BASE + 0x1103B8u), 0, 0x800u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C18u)) = 1u;
    add_extra_cap(D2GAME_PREF_BASE + 0x111C18u, 0x04u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cli = (k == 0) ? 0u : STAGE_CLIENT;
    if (k >= 1) {
      uint32_t cid = 10u + (uint32_t)k;
      stage_saveable_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_CLIENT,
                            (k == 1) ? 1u : 3u, cid,
                            (k == 1) ? "SorcOne" : "PalaTwo", "AcctSave", 6701u + (uint32_t)k);
      U32(game_global_live(D2GAME_PREF_BASE + 0x1107B8u + (cid & 0xFFu) * 4u)) = STAGE_CLIENT;
      add_extra_cap(D2GAME_PREF_BASE + 0x1107B8u, 0x80u);
    }
    c = make_call();
    c.ecx = cli;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = (k == 2 ? 1u : 0u);
    c.calleePop = 0xCu;
    ts[0] = cli; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = (k == 2 ? 1 : 0);
    snprintf(lbl, sizeof(lbl), "serialize_append_save_k%d", k);
    run_and_emit(0x6FC73E50u, "PLAYERSAVE_SerializeAndAppendClientSaveData_6FC73E50_113c", k, lbl, &c, ts, 4, 0u, (k == 0 ? 1 : 0));
  }

  /* [G6-08] 0x6FC74000 PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c
   * (ecx=bUnkFlag, edx=pPlayerUnit, s0=pGame, s1=szAcct, s2=szChar, s3=dwToken, s4=bSaveMerc, s5=dwTs, ret 0x18) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(game_global_live(D2GAME_PREF_BASE + 0x10D8BCu)) = (k == 0) ? 0u : 1u; /* gbSaveEnabled */
    U32(game_global_live(D2GAME_PREF_BASE + 0x111C3Cu)) = 0u; /* gpServerCallbackTable */
    U32(game_global_live(D2GAME_PREF_BASE + 0x111F84u)) = 0u; /* gdwUnchangedSaves */
    add_extra_cap(D2GAME_PREF_BASE + 0x10D8BCu, 0x04u);
    add_extra_cap(D2GAME_PREF_BASE + 0x111F84u, 0x04u);
    stage_saveable_player(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_CLIENT,
                          (k == 2) ? 3u : 1u, 10u + (uint32_t)k,
                          (k == 2) ? "RealmPala" : "RealmSorc", "RealmAcct", 6801u + (uint32_t)k);
    strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x00u), "RealmAcct");
    strcpy((char *)(uintptr_t)(STAGE_SCRATCH + 0x20u), (k == 2) ? "RealmPala" : "RealmSorc");
    uint32_t tsVal = 0x12340000u + (uint32_t)k;
    c = make_call();
    c.ecx = 0u; c.edx = STAGE_UNIT0;
    c.nargs = 6;
    c.args[0] = STAGE_GAME;
    c.args[1] = STAGE_SCRATCH + 0x00u;
    c.args[2] = STAGE_SCRATCH + 0x20u;
    c.args[3] = 0x5555u + (uint32_t)k;
    c.args[4] = 0u;
    c.args[5] = tsVal;
    c.calleePop = 0x18u;
    ts[0] = 0; ts[1] = STAGE_UNIT0;
    for (int i = 0; i < 6; i++) ts[i + 2] = (int64_t)c.args[i];
    snprintf(lbl, sizeof(lbl), "write_commit_realm_save_k%d", k);
    run_and_emit(0x6FC74000u, "PLAYERSAVE_WriteAndCommitRealmCharSave_6FC74000_113c", k, lbl, &c, ts, 8, 0xFFFFFFFFu, 0);
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
    fprintf(stderr, "[k6-fix4] VirtualAlloc failed (%p %p %p %p)\n", pTbls, pVtbl, pStage, pHeap);
    fflush(stderr);
    return 1;
  }

  U32(HASH_VTABLE_ADDR + 0x00u) = (uint32_t)(uintptr_t)game_hash_dtor_stub;
  U32(HASH_VTABLE_ADDR + 0x04u) = (uint32_t)(uintptr_t)game_hash_alloc_node;
  U32(HASH_VTABLE_ADDR + 0x08u) = (uint32_t)(uintptr_t)game_hash_scalar_dtor;
  U32(HASH_VTABLE_ADDR + 0x0Cu) = (uint32_t)(uintptr_t)game_hash_unlink_all;

  g_hStorm       = LoadLibraryA("Storm.dll");
  g_hFog         = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCmp   = LoadLibraryA("D2CMP.dll");
  g_hCom         = LoadLibraryA("D2Common.dll");
  g_hNet         = LoadLibraryA("D2Net.dll");
  g_hGame        = LoadLibraryA("D2Game.dll");
  if (!g_hStorm || !g_hFog || !hLang || !hCmp || !g_hCom || !g_hNet || !g_hGame) {
    fprintf(stderr, "[k6-fix4] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-fix4] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_PlaceItemInBodyLoc || !fn_PathSetTargetUnit) {
    fprintf(stderr, "[k6-fix4] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-fix4] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_group_1_monster_modes();
  emit_group_2_object_monster_spawn();
  emit_group_3_missile_shrines();
  emit_group_4_dead_mode12();
  emit_group_5_standalone();
  emit_group_6_storm_game_client_save();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-fix4] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
