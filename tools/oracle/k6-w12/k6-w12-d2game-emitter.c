/*
 * k6-w12-d2game-emitter.c — Milestone #37 [K6] Wave 12 Real-DLL Hi-VA Part 4 Differential Emitter
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables (0x20000000..0x206F7FFF + D2Common .data/.bss)
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert) and Fog.#10042..#10047
 * (deterministic bump allocator with per-allocation size tracking for Fog.#10047),
 * and executes previously un-hit D2Game.dll functions strictly inside
 * 0x6FCC0000..0x6FD142D0 across >= 3 non-degenerate cases each.
 *
 * Inline-assembly rule: Register constraints ONLY (zero "m", "g", or "o").
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

#define STAGE_BASE        0x30000000u
#define STAGE_FIXED_SIZE  0x0000C000u
#define STAGE_SETUP_BASE  0x30020000u
#define STAGE_TOTAL_SIZE  0x00040000u

#define HEAP_BASE         0x40000000u
#define HEAP_SIZE         0x00200000u

/* Fixed staged object addresses inside 0x30000000..0x3000BFFF */
#define STAGE_GAME        (STAGE_BASE + 0x0000u) /* 0x2000: D2GameStrc */
#define STAGE_CLIENT0     (STAGE_BASE + 0x2000u) /* 0x0600: D2ClientStrc #0 */
#define STAGE_CLIENT1     (STAGE_BASE + 0x2600u) /* 0x0600: D2ClientStrc #1 */
#define STAGE_PKTNODE0    (STAGE_BASE + 0x2C00u) /* 0x0210: client0 pkt #0 */
#define STAGE_PKTNODE1    (STAGE_BASE + 0x2E10u) /* 0x0210: client0 pkt #1 */
#define STAGE_UNIT0       (STAGE_BASE + 0x3200u) /* 0x0200: primary D2UnitStrc */
#define STAGE_UDATA0      (STAGE_BASE + 0x3400u) /* 0x0200: primary unit data */
#define STAGE_UNIT1       (STAGE_BASE + 0x3600u) /* 0x0200: secondary D2UnitStrc */
#define STAGE_UDATA1      (STAGE_BASE + 0x3800u) /* 0x0200: secondary unit data */
#define STAGE_UNIT2       (STAGE_BASE + 0x3A00u) /* 0x0200: tertiary D2UnitStrc */
#define STAGE_UDATA2      (STAGE_BASE + 0x3C00u) /* 0x0200: tertiary unit data */
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
#define STAGE_QUESTARG    (STAGE_BASE + 0x6600u) /* 0x0100: D2QuestArgStrc */
#define STAGE_QBITS0      (STAGE_BASE + 0x6700u) /* 0x0100: quest bit record + buffer #0 */
#define STAGE_QBITS1      (STAGE_BASE + 0x6800u) /* 0x0100: quest bit record + buffer #1 */
#define STAGE_PARTYCTRL   (STAGE_BASE + 0x6900u) /* 0x0200: pPartyControl + nodes */
#define STAGE_ARENA       (STAGE_BASE + 0x6B00u) /* 0x0100: D2ArenaStrc */
#define STAGE_NPCCTRL     (STAGE_BASE + 0x6C00u) /* 0x1200: pNpcControl + 64*0x44 array */
#define STAGE_PKTNODE2    (STAGE_BASE + 0x8000u) /* 0x0210: client0 pkt #2 */
#define STAGE_PKTNODE3    (STAGE_BASE + 0x8210u) /* 0x0210: client0 pkt #3 */
#define STAGE_PKTNODE4    (STAGE_BASE + 0x8420u) /* 0x0210: client1 pkt #0 */
#define STAGE_PKTNODE5    (STAGE_BASE + 0x8630u) /* 0x0210: client1 pkt #1 */
#define STAGE_PKTNODE6    (STAGE_BASE + 0x8840u) /* 0x0210: client1 pkt #2 */
#define STAGE_PKTNODE7    (STAGE_BASE + 0x8A50u) /* 0x0210: client1 pkt #3 */
#define STAGE_MONREG0     (STAGE_BASE + 0x9000u) /* 0x0300: D2MonsterRegionStrc #0 */
#define STAGE_MONREG1     (STAGE_BASE + 0x9300u) /* 0x0300: D2MonsterRegionStrc #1 */
#define STAGE_AIGEN0      (STAGE_BASE + 0x9600u) /* 0x0100: D2AiGeneralStrc #0 */
#define STAGE_AIGEN1      (STAGE_BASE + 0x9700u) /* 0x0100: D2AiGeneralStrc #1 */
#define STAGE_AIPARAM0    (STAGE_BASE + 0x9800u) /* 0x0100: D2AiParamStrc #0 */
#define STAGE_SCRATCH     (STAGE_BASE + 0xA000u) /* 0x2000: out-params / packets / ctx / aux */

#define U32(addr) (*(volatile uint32_t *)((uintptr_t)(addr)))
#define U16(addr) (*(volatile uint16_t *)((uintptr_t)(addr)))
#define U8(addr)  (*(volatile uint8_t  *)((uintptr_t)(addr)))
#define S32(addr) (*(volatile int32_t  *)((uintptr_t)(addr)))
#define S16(addr) (*(volatile int16_t  *)((uintptr_t)(addr)))

#define MAX_STACK 12

static HMODULE g_hFog  = NULL;
static HMODULE g_hCom  = NULL;
static HMODULE g_hGame = NULL;
static uintptr_t g_com_rebase  = 0;
static uintptr_t g_game_rebase = 0;

/* Allocator cursor: points into STAGE_SETUP_BASE during setup, HEAP_BASE during call */
static int g_in_setup_phase = 1;
static uint32_t g_setup_top = STAGE_SETUP_BASE;
static uint32_t g_heap_top  = HEAP_BASE;

/* D2Common helper function pointers for deterministic pre-state construction */
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
typedef int32_t(__stdcall *Com_UnitsIsDoor_t)(void *pUnit);
typedef int32_t(__stdcall *Com_IsTwoHand_t)(void *pItem);
typedef int32_t(__stdcall *Com_IsAutoStack_t)(void *pItem);

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
static Com_UnitsIsDoor_t        fn_UnitsIsDoor        = NULL;
static Com_IsTwoHand_t          fn_IsTwoHand          = NULL;
static Com_IsAutoStack_t        fn_IsAutoStack        = NULL;

/* Discovered real v1.13c item/monster/unique IDs */
static uint32_t g_item_ring   = 0;
static uint32_t g_item_charm  = 0;
static uint32_t g_item_hp4    = 0;
static uint32_t g_item_sword  = 0;
static uint32_t g_item_bow    = 0;
static uint32_t g_item_aqv    = 0;
static uint32_t g_item_shld   = 0;
static uint32_t g_item_jav    = 0;
static uint32_t g_item_autost = 0;
static uint32_t g_item_gld    = 0;
static uint32_t g_item_hst    = 0;
static uint32_t g_item_msf    = 0;
static uint32_t g_item_vip    = 0;
static uint32_t g_item_box    = 0;
static uint32_t g_item_tr1    = 0;
static uint32_t g_item_hfh    = 0;
static uint32_t g_item_mss    = 0;
static uint32_t g_item_j34    = 0;
static uint32_t g_item_g34    = 0;
static uint32_t g_item_g33    = 0;
static uint32_t g_item_qey    = 0;
static uint32_t g_item_qbr    = 0;
static uint32_t g_item_qhr    = 0;
static uint32_t g_item_qf1    = 0;
static uint32_t g_item_qf2    = 0;
static uint32_t g_item_bbb    = 0;
static uint32_t g_mon_boss    = 0;

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

uint32_t g_thunk_out_eax = 0;
uint32_t g_thunk_saved_esp = 0;
uint32_t g_thunk_saved_ebp = 0;
uint32_t g_thunk_esp_before = 0;
uint32_t g_thunk_esp_after  = 0;

volatile LONG g_thunk_in_call = 0;
volatile LONG g_thunk_faulted = 0; /* 0 = ok, 1 = hw exception, 2 = Fog.#10024 assert */
uint32_t g_fault_code = 0;
uint32_t g_fault_eip  = 0;
uint32_t g_fault_addr = 0;
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
      /* Scrub 0x800 bytes below ESP for -O2 == -fno-omit-frame-pointer == -O1 parity */
      "leal -0x800(%esp), %edi\n\t"
      "xorl %eax, %eax\n\t"
      "movl $0x200, %ecx\n\t"
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
      "movl %esp, _g_thunk_esp_after\n\t"
      "movl %eax, _g_thunk_out_eax\n\t"
      ".globl _thunk_resume\n"
      "_thunk_resume:\n\t"
      "movl _g_thunk_saved_ebp, %ebp\n\t"
      "movl _g_thunk_saved_esp, %esp\n\t"
      "popl %edi\n\t"
      "popl %esi\n\t"
      "popl %ebx\n\t"
      "popl %ebp\n\t"
      "ret\n\t");
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

static LONG CALLBACK k6_veh(EXCEPTION_POINTERS *ep) {
  DWORD code = ep->ExceptionRecord->ExceptionCode;
  if (!g_thunk_in_call) {
    if (code == EXCEPTION_ACCESS_VIOLATION ||
        code == EXCEPTION_INT_DIVIDE_BY_ZERO ||
        code == EXCEPTION_INT_OVERFLOW ||
        code == EXCEPTION_ILLEGAL_INSTRUCTION) {
      uintptr_t eip = (uintptr_t)ep->ExceptionRecord->ExceptionAddress;
      uintptr_t gameOff = (g_hGame && eip >= (uintptr_t)g_hGame && eip < (uintptr_t)g_hGame + 0x130000u)
                              ? (eip - g_game_rebase) : 0u;
      uintptr_t comOff  = (g_hCom && eip >= (uintptr_t)g_hCom && eip < (uintptr_t)g_hCom + 0xA5000u)
                              ? (eip - g_com_rebase) : 0u;
      uint32_t avAddr = (ep->ExceptionRecord->NumberParameters >= 2)
                            ? (uint32_t)ep->ExceptionRecord->ExceptionInformation[1] : 0u;
      fprintf(stderr,
              "[k6-w12] SETUP/INIT FAULT after %u emitted: code=0x%08lX eip=%p (game=0x%08lX com=0x%08lX) addr=0x%08X\n",
              g_total_emitted, (unsigned long)code, (void *)eip,
              (unsigned long)gameOff, (unsigned long)comOff, avAddr);
      fflush(stderr);
      TerminateProcess(GetCurrentProcess(), 99);
    }
    return EXCEPTION_CONTINUE_SEARCH;
  }
  if (code == EXCEPTION_ACCESS_VIOLATION ||
      code == EXCEPTION_INT_DIVIDE_BY_ZERO ||
      code == EXCEPTION_INT_OVERFLOW ||
      code == EXCEPTION_ILLEGAL_INSTRUCTION) {
    g_thunk_in_call = 0;
    g_thunk_faulted = 1;
    g_fault_code = (uint32_t)code;
    g_fault_eip  = (uint32_t)(uintptr_t)ep->ExceptionRecord->ExceptionAddress;
    g_fault_addr = (ep->ExceptionRecord->NumberParameters >= 2)
                       ? (uint32_t)ep->ExceptionRecord->ExceptionInformation[1]
                       : 0u;
    ep->ContextRecord->Eip = (DWORD)(uintptr_t)thunk_resume;
    ep->ContextRecord->Esp = g_thunk_saved_esp;
    ep->ContextRecord->Ebp = g_thunk_saved_ebp;
    return EXCEPTION_CONTINUE_EXECUTION;
  }
  return EXCEPTION_CONTINUE_SEARCH;
}

/* ------------------------------- Deterministic Bump Allocator (w/ size tracking) */

#define MAX_TRACKED_ALLOCS 1024
static uint32_t g_alloc_ptr[MAX_TRACKED_ALLOCS];
static uint32_t g_alloc_size[MAX_TRACKED_ALLOCS];
static uint32_t g_alloc_count = 0;

static void record_alloc_size(uint32_t ptr, uint32_t sz) {
  if (g_alloc_count < MAX_TRACKED_ALLOCS) {
    g_alloc_ptr[g_alloc_count] = ptr;
    g_alloc_size[g_alloc_count] = sz;
    g_alloc_count++;
  }
}

static uint32_t lookup_alloc_size(uint32_t ptr, uint32_t fallback) {
  for (uint32_t i = g_alloc_count; i > 0; i--) {
    if (g_alloc_ptr[i - 1u] == ptr) return g_alloc_size[i - 1u];
  }
  return fallback;
}

static void *bump_alloc(uint32_t dwSize) {
  if (g_in_setup_phase) {
    uint32_t p = (g_setup_top + 3u) & ~3u;
    if (p + dwSize > STAGE_BASE + STAGE_TOTAL_SIZE) {
      fprintf(stderr, "[k6-w12] setup bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 21);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_setup_top = p + dwSize;
    record_alloc_size(p, dwSize);
    return (void *)(uintptr_t)p;
  } else {
    uint32_t p = (g_heap_top + 3u) & ~3u;
    if (p + dwSize > HEAP_BASE + HEAP_SIZE) {
      fprintf(stderr, "[k6-w12] heap bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 22);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_heap_top = p + dwSize;
    record_alloc_size(p, dwSize);
    return (void *)(uintptr_t)p;
  }
}

static void *__fastcall stub_fog_10042(uint32_t dwSize, const char *szFile, int nLine, int nZero) {
  (void)szFile; (void)nLine; (void)nZero;
  return bump_alloc(dwSize);
}

static int __fastcall stub_fog_10043(void *pMem, const char *szFile, int nLine, int nZero) {
  (void)pMem; (void)szFile; (void)nLine; (void)nZero;
  return 1;
}

static void *__fastcall stub_fog_10045(void *pPool, uint32_t dwSize, const char *szFile, int nLine, int nZero) {
  (void)pPool; (void)szFile; (void)nLine; (void)nZero;
  return bump_alloc(dwSize);
}

static int __fastcall stub_fog_10046(void *pPool, void *pMem, const char *szFile, int nLine, int nZero) {
  (void)pPool; (void)pMem; (void)szFile; (void)nLine; (void)nZero;
  return 1;
}

static void *__fastcall stub_fog_10047(void *pPool, void *pMem, uint32_t dwSize, const char *szFile, int nLine, int nZero) {
  (void)pPool; (void)szFile; (void)nLine; (void)nZero;
  if (dwSize == 0) return NULL;
  void *np = bump_alloc(dwSize);
  if (pMem) {
    uint32_t oldSz = lookup_alloc_size((uint32_t)(uintptr_t)pMem, dwSize);
    uint32_t copySz = oldSz < dwSize ? oldSz : dwSize;
    memcpy(np, pMem, copySz);
  }
  return np;
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

static DWORD __stdcall stub_GetTickCount(void) {
  return 0u;
}

static void install_fog_hooks(void) {
  struct { uint32_t ord; void *fn; } hooks[] = {
    { 10024u, (void *)(uintptr_t)stub_fog_10024 },
    { 10042u, (void *)(uintptr_t)stub_fog_10042 },
    { 10043u, (void *)(uintptr_t)stub_fog_10043 },
    { 10045u, (void *)(uintptr_t)stub_fog_10045 },
    { 10046u, (void *)(uintptr_t)stub_fog_10046 },
    { 10047u, (void *)(uintptr_t)stub_fog_10047 },
  };
  for (size_t i = 0; i < sizeof(hooks) / sizeof(hooks[0]); i++) {
    void *orig = (void *)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(hooks[i].ord));
    if (!orig) {
      fprintf(stderr, "[k6-w12] missing Fog.#%u\n", hooks[i].ord);
      TerminateProcess(GetCurrentProcess(), 23);
    }
    hook_module_iat_ptr(g_hCom, orig, hooks[i].fn);
    hook_module_iat_ptr(g_hGame, orig, hooks[i].fn);
  }
  HMODULE hK32 = GetModuleHandleA("kernel32.dll");
  if (hK32) {
    void *origTick = (void *)(uintptr_t)GetProcAddress(hK32, "GetTickCount");
    if (origTick) {
      hook_module_iat_ptr(g_hCom, origTick, (void *)(uintptr_t)stub_GetTickCount);
      hook_module_iat_ptr(g_hGame, origTick, (void *)(uintptr_t)stub_GetTickCount);
    }
  }
}

/* ------------------------------- PAGEIMG Loader */

static void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-w12] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-w12] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(0x6FDE9000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-w12] short read at page %u\n", i);
      TerminateProcess(GetCurrentProcess(), 12);
    }
    uint32_t va = *(const uint32_t *)pageBuf;
    const uint8_t *data = pageBuf + 4;
    if (va >= DATATBLS_BASE && va + 4096u <= DATATBLS_BASE + DATATBLS_SIZE) {
      memcpy((void *)(uintptr_t)va, data, 4096u);
    } else if (va >= 0x6FDE9000u && va <= 0x6FDF2000u) {
      memcpy((void *)(uintptr_t)(va + g_com_rebase), data, 4096u);
    }
  }
  fclose(fp);
}

/* ------------------------------- Pre/Post Snapshot & NDJSON Emission */

static char g_pre_json[196608];

static void format_mem_runs_range(char *out, size_t cap, size_t *pLen, uint32_t startAddr, uint32_t endAddr, int *pFirst) {
  static const char hexChars[] = "0123456789abcdef";
  uint32_t a = startAddr;
  while (a < endAddr) {
    uint32_t chunkEnd = (a + 16u <= endAddr) ? (a + 16u) : endAddr;
    int nz = 0;
    for (uint32_t k = a; k < chunkEnd; k++) {
      if (U8(k) != 0u) { nz = 1; break; }
    }
    if (!nz) {
      a = chunkEnd;
      continue;
    }
    uint32_t runStart = a;
    uint32_t runEnd = chunkEnd;
    while (runEnd < endAddr && (runEnd - runStart) < 512u) {
      uint32_t nextEnd = (runEnd + 16u <= endAddr) ? (runEnd + 16u) : endAddr;
      int nextNz = 0;
      for (uint32_t k = runEnd; k < nextEnd; k++) {
        if (U8(k) != 0u) { nextNz = 1; break; }
      }
      if (!nextNz) break;
      runEnd = nextEnd;
    }
    uint32_t len = runEnd - runStart;
    if (*pLen + 48u + len * 2u >= cap) {
      fprintf(stderr, "[k6-w12] JSON buffer overflow\n");
      TerminateProcess(GetCurrentProcess(), 25);
    }
    *pLen += (size_t)snprintf(out + *pLen, cap - *pLen,
                              "%s{\"addr\":\"0x%08X\",\"hex\":\"",
                              (*pFirst ? "" : ","), runStart);
    *pFirst = 0;
    for (uint32_t k = runStart; k < runEnd; k++) {
      uint8_t b = U8(k);
      out[(*pLen)++] = hexChars[(b >> 4) & 0xFu];
      out[(*pLen)++] = hexChars[b & 0xFu];
    }
    out[(*pLen)++] = '"';
    out[(*pLen)++] = '}';
    out[*pLen] = '\0';
    a = runEnd;
  }
}

static void capture_stage_json(char *out, size_t cap, uint32_t setupTop) {
  size_t len = 0;
  int first = 1;
  out[len++] = '[';
  out[len] = '\0';
  format_mem_runs_range(out, cap, &len, STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE, &first);
  if (setupTop > STAGE_SETUP_BASE) {
    format_mem_runs_range(out, cap, &len, STAGE_SETUP_BASE, setupTop, &first);
  }
  out[len++] = ']';
  out[len] = '\0';
}

/* ------------------------------- Staged World Builders */

static void reset_case(void) {
  memset((void *)(uintptr_t)STAGE_BASE, 0, STAGE_FIXED_SIZE);
  g_in_setup_phase = 1;
  g_setup_top = STAGE_SETUP_BASE;
  g_heap_top = HEAP_BASE;
  g_alloc_count = 0;

  U8(STAGE_GAME + 0x6Du)  = 0u;
  U32(STAGE_GAME + 0x70u) = 1u;
  U32(STAGE_GAME + 0xA8u) = 100u;

  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_PKTNODE1 + 0x204u) = STAGE_PKTNODE2;
  U32(STAGE_PKTNODE2 + 0x204u) = STAGE_PKTNODE3;
  U32(STAGE_CLIENT0 + 0x1C0u)  = STAGE_PKTNODE0;

  U32(STAGE_PKTNODE4 + 0x204u) = STAGE_PKTNODE5;
  U32(STAGE_PKTNODE5 + 0x204u) = STAGE_PKTNODE6;
  U32(STAGE_PKTNODE6 + 0x204u) = STAGE_PKTNODE7;
  U32(STAGE_CLIENT1 + 0x1C0u)  = STAGE_PKTNODE4;
}

static void stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  U32(pAct + 0x08u)     = 1u;
  U32(pAct + 0x10u)     = pRoom;
  U32(pAct + 0x48u)     = STAGE_DRLG0;
  U32(STAGE_DRLG0 + 0x47Cu) = pLevel;
  if (U32(STAGE_GAME + 0xBCu) == 0u) {
    U32(STAGE_GAME + 0xBCu) = pAct;
  }
  U32(pRoom + 0x10u)    = pRoomEx;
  U32(pRoom + 0x2Cu)    = pAct;
  U32(pRoom + 0x4Cu)    = 4800u;
  U32(pRoom + 0x50u)    = 4800u;
  U32(pRoom + 0x54u)    = 1000u;
  U32(pRoom + 0x58u)    = 1000u;
  U32(pRoomEx + 0x30u)  = pRoom;
  U32(pRoomEx + 0x58u)  = pLevel;
  U32(pLevel + 0x1B4u)  = STAGE_DRLG0;
  U32(pLevel + 0x1D0u)  = levelId;
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
  uintptr_t fn = (D2GAME_PREF_BASE + 0x000E0310u) + g_game_rebase;
  __asm__ volatile(
      "call *%%ecx\n\t"
      : "+d"(pGame), "+S"(pUnit), "+c"(fn)
      :
      : "eax", "memory", "cc");
}

static void stage_unit_common(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t uType, uint32_t classId, uint32_t guid, uint32_t mode,
    uint16_t x, uint16_t y, uint32_t seedLo) {
  U32(pUnit + 0x00u) = uType;
  U32(pUnit + 0x04u) = classId;
  U32(pUnit + 0x0Cu) = guid;
  U32(pUnit + 0x10u) = mode;
  U32(pUnit + 0x14u) = pUData;
  U8(pUnit + 0x18u)  = 0u;
  U32(pUnit + 0x1Cu) = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
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
    uint32_t pObjectsBase = U32(0x6FDF0B94u + g_com_rebase);
    uint32_t nObjectsCnt  = U32(0x6FDF0B98u + g_com_rebase);
    if (classId < nObjectsCnt) {
      U32(pUData + 0x00u) = pObjectsBase + classId * 0x1C0u;
    }
  }
  fn_CreateStatListEx((void *)(uintptr_t)pUnit, 0u, NULL, (void *)(uintptr_t)STAGE_GAME);
}

static void link_player_client(uint32_t pPlayer, uint32_t pUData, uint32_t pClient, uint32_t clientId, uint32_t nextClient) {
  U32(pUData + 0x9Cu)  = pClient;
  U32(pClient + 0x00u) = clientId;
  U32(pClient + 0x04u) = 4u;
  U32(pClient + 0x16Cu) = U32(pPlayer + 0x00u);
  U32(pClient + 0x170u) = U32(pPlayer + 0x0Cu);
  U32(pClient + 0x174u) = pPlayer;
  U32(pClient + 0x1A8u) = STAGE_GAME;
  U32(pClient + 0x1ACu) = STAGE_GAME;
  U32(pClient + 0x4A8u) = nextClient;
}

static void stage_quest_node(uint32_t pQuest, uint32_t qId, uint32_t pQuestEx, uint32_t pPrev) {
  U32(pQuest + 0x00u) = qId;
  U32(pQuest + 0x04u) = STAGE_GAME;
  U32(pQuest + 0x18u) = pQuestEx;
  U32(pQuest + 0xF4u) = pPrev;
  U32(STAGE_QUESTCTRL + 0x00u) = pQuest;
  U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
}

static void stage_qbits(uint32_t pQBits, uint32_t pUData, uint32_t diff) {
  U32(pQBits + 0x00u) = pQBits + 0x20u;
  U32(pQBits + 0x04u) = 96u;
  if (pUData) U32(pUData + 0x10u + diff * 4u) = pQBits;
}

static void attach_cursor_item(uint32_t pPlayer, uint32_t itemClassId, uint32_t itemGuid) {
  void *pInv = (void *)(uintptr_t)U32(pPlayer + 0x60u);
  if (!pInv) {
    pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)pPlayer);
    U32(pPlayer + 0x60u) = (uint32_t)(uintptr_t)pInv;
  }
  stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, itemClassId, itemGuid, 4u, 0u, 0u, 777u);
  fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT2);
}

static uint32_t stage_inv_item(uint32_t pPlayer, uint32_t pItem, uint32_t pItemData, uint32_t pItemPath, uint32_t itemClassId, uint32_t itemGuid, uint8_t invPage) {
  uint32_t pInv = U32(pPlayer + 0x60u);
  if (pInv == 0u) {
    pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)pPlayer);
    U32(pPlayer + 0x60u) = pInv;
  }
  stage_unit_common(pItem, pItemData, pItemPath, STAGE_ROOM0, 4u, itemClassId, itemGuid, 0u, 0u, 0u, 778u);
  U8(pItemData + 0x45u) = invPage;
  uint32_t pExtra = (uint32_t)(uintptr_t)bump_alloc(0x20u);
  U32(pExtra + 0x00u) = pInv;
  U32(pItemData + 0x5Cu) = pExtra;
  uint32_t prev = U32(pInv + 0x0Cu);
  U32(pExtra + 0x08u) = prev;
  U32(pInv + 0x0Cu) = pItem;
  if (U32(pInv + 0x10u) == 0u) U32(pInv + 0x10u) = pItem;
  return pInv;
}

static void stage_timer_queue(uint32_t pGame) {
  uint32_t pTimer = (uint32_t)(uintptr_t)bump_alloc(0xA20u);
  uint32_t pChunk = (uint32_t)(uintptr_t)bump_alloc(0x7088u);
  for (uint32_t i = 0; i < 24u; i++) {
    uint32_t node = pChunk + i * 0x30u;
    U32(node + 0x1Cu) = (i + 1u < 24u) ? (pChunk + (i + 1u) * 0x30u) : 0u;
  }
  U32(pChunk + 0x7080u) = pChunk;
  U32(pChunk + 0x7084u) = 0u;
  U32(pTimer + 0x0A1Cu) = pChunk;
  U32(pGame + 0x00B8u)  = pTimer;
}

static void link_room_units(uint32_t pRoom, uint32_t u0, uint32_t u1) {
  uint32_t ppNear = (uint32_t)(uintptr_t)bump_alloc(0x10u);
  U32(ppNear) = pRoom;
  U32(pRoom + 0x00u) = ppNear;
  U32(pRoom + 0x24u) = 1u;
  U32(pRoom + 0x74u) = u0;
  if (u0) U32(u0 + 0xE8u) = u1;
  if (u1) U32(u1 + 0xE8u) = 0u;
}

static void stage_room_collision(uint32_t pRoom, uint32_t x0, uint32_t y0, uint32_t w, uint32_t h) {
  uint32_t pColl = (uint32_t)(uintptr_t)bump_alloc(0x28u);
  uint32_t pMap  = (uint32_t)(uintptr_t)bump_alloc(w * h * 2u);
  U32(pColl + 0x00u) = x0;
  U32(pColl + 0x04u) = y0;
  U32(pColl + 0x08u) = w;
  U32(pColl + 0x0Cu) = h;
  U32(pColl + 0x10u) = x0 / 5u;
  U32(pColl + 0x14u) = y0 / 5u;
  U32(pColl + 0x18u) = w / 5u;
  U32(pColl + 0x1Cu) = h / 5u;
  U32(pColl + 0x20u) = pMap;
  U32(pRoom + 0x20u) = pColl;
  U32(pRoom + 0x4Cu) = x0;
  U32(pRoom + 0x50u) = y0;
  U32(pRoom + 0x54u) = w;
  U32(pRoom + 0x58u) = h;
}

static void stage_pet_link(uint32_t pPlayerUData, uint32_t petType, uint32_t petGuid, uint32_t seed, uint16_t nameId, uint16_t hireId) {
  uint32_t pPetTbl = (uint32_t)(uintptr_t)bump_alloc(0x10u);
  uint32_t pArr    = (uint32_t)(uintptr_t)bump_alloc(0x100u);
  uint32_t pNode   = (uint32_t)(uintptr_t)bump_alloc(0x20u);
  U32(pPlayerUData + 0x44u) = pPetTbl;
  U32(pPetTbl + 0x00u) = pArr;
  U32(pArr + petType * 12u) = pNode;
  U32(pNode + 0x00u) = 0u;
  U32(pNode + 0x04u) = petGuid;
  U32(pNode + 0x08u) = seed;
  U16(pNode + 0x0Cu) = nameId;
  U16(pNode + 0x10u) = hireId;
  U32(pNode + 0x14u) = 0u;
}

static uint32_t stage_used_skill(
    uint32_t pUnit, uint32_t skillId, uint32_t level,
    uint32_t flags0C, uint32_t p1, uint32_t p2, uint32_t p3, uint32_t p4) {
  uint32_t pInfo  = (uint32_t)(uintptr_t)bump_alloc(0x20u);
  uint32_t pSkill = (uint32_t)(uintptr_t)bump_alloc(0x40u);
  uint32_t pDT    = U32(0x6FDE9E1Cu + g_com_rebase);
  uint32_t pSTxt  = U32(pDT + 0xB98u) + skillId * 0x23Cu;
  U32(pSkill + 0x00u) = pSTxt;
  U32(pSkill + 0x0Cu) = flags0C;
  U32(pSkill + 0x18u) = p1;
  U32(pSkill + 0x1Cu) = p2;
  U32(pSkill + 0x20u) = p3;
  U32(pSkill + 0x24u) = p4;
  U32(pSkill + 0x28u) = level;
  U32(pInfo + 0x00u)  = pSkill;
  U32(pInfo + 0x10u)  = pSkill;
  U32(pUnit + 0xA8u)  = pInfo;
  return pSkill;
}

static void stage_path_target(uint32_t pPath, uint32_t pTarget) {
  U32(pPath + 0x58u) = pTarget;
  U32(pPath + 0x5Cu) = U32(pTarget + 0x00u);
  U32(pPath + 0x60u) = U32(pTarget + 0x0Cu);
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
  if (g_game_rebase == 0) return;
  uint32_t lo = (uint32_t)(uintptr_t)g_hGame;
  uint32_t hi = lo + 0x130000u;
  uint32_t delta = (uint32_t)g_game_rebase;
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
  static char postJson[196608];
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
            "[k6-w12] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-w12] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-w12] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-w12] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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

/* ------------------------------- Startup Discovery of Canonical Table IDs */

static void discover_table_ids(void) {
  reset_case();
  uint32_t nItems = U32(0x6FDEFB94u + g_com_rebase);
  uint32_t pItems = U32(0x6FDEFB98u + g_com_rebase);

  U32(STAGE_UNIT2 + 0x00u) = 4u;
  U32(STAGE_UNIT2 + 0x14u) = STAGE_UDATA2;
  for (uint32_t id = 0; id < nItems; id++) {
    U32(STAGE_UNIT2 + 0x04u) = id;
    uint32_t code = U32(pItems + id * 0x1A8u + 0x80u);
    if (!g_item_hp4 && code == 0x20347068u) g_item_hp4 = id;
    if (!g_item_gld && code == 0x20646C67u) g_item_gld = id;
    if (!g_item_jav && code == 0x2076616Au) g_item_jav = id;
    if (!g_item_hst && code == 0x20747368u) g_item_hst = id;
    if (!g_item_msf && code == 0x2066736Du) g_item_msf = id;
    if (!g_item_vip && code == 0x20706976u) g_item_vip = id;
    if (!g_item_box && code == 0x20786F62u) g_item_box = id;
    if (!g_item_tr1 && code == 0x20317274u) g_item_tr1 = id;
    if (!g_item_hfh && code == 0x20686668u) g_item_hfh = id;
    if (!g_item_mss && code == 0x2073736Du) g_item_mss = id;
    if (!g_item_j34 && code == 0x2034336Au) g_item_j34 = id;
    if (!g_item_g34 && code == 0x20343367u) g_item_g34 = id;
    if (!g_item_g33 && code == 0x20333367u) g_item_g33 = id;
    if (!g_item_qey && code == 0x20796571u) g_item_qey = id;
    if (!g_item_qbr && code == 0x20726271u) g_item_qbr = id;
    if (!g_item_qhr && code == 0x20726871u) g_item_qhr = id;
    if (!g_item_qf1 && code == 0x20316671u) g_item_qf1 = id;
    if (!g_item_qf2 && code == 0x20326671u) g_item_qf2 = id;
    if (!g_item_bbb && code == 0x20626262u) g_item_bbb = id;
    if (!g_item_ring && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x0A)) g_item_ring = id;
    if (!g_item_charm && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x52)) g_item_charm = id;
    if (!g_item_sword && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x1E)) g_item_sword = id;
    if (!g_item_bow && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x1B)) g_item_bow = id;
    if (!g_item_aqv && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x05)) g_item_aqv = id;
    if (!g_item_shld && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x02)) g_item_shld = id;
    if (!g_item_autost && fn_IsTwoHand((void *)(uintptr_t)STAGE_UNIT2) && fn_IsAutoStack((void *)(uintptr_t)STAGE_UNIT2)) {
      g_item_autost = id;
    }
  }

  uint32_t pSgpt = U32(0x6FDE9E1Cu + g_com_rebase);
  uint32_t pMonStats = U32(pSgpt + 0x0A78u);
  uint32_t nMonStats = U32(pSgpt + 0x0A80u);
  for (uint32_t id = 0; id < nMonStats; id++) {
    uint8_t f0c = U8(pMonStats + id * 0x1A8u + 0x0Cu);
    if (!g_mon_boss && (f0c & 0x40u) != 0u) g_mon_boss = id;
  }
}

/* Helper to emit 3 non-degenerate cases for Quest Init functions (ecx=pQuest, ret 0, void) */
static void emit_quest_init_3(uint32_t va, const char *name) {
  X86CallSpec c;
  int64_t ts[2];
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pQ = (k == 2) ? (STAGE_SCRATCH + 0x100u) : STAGE_QUEST0;
    U32(pQ + 0x04u) = STAGE_GAME;
    if (k == 1) {
      for (uint32_t i = 0; i < 15u; i++) U32(pQ + 0xA0u + i * 4u) = 0x11111111u;
      U8(pQ + 0x0Bu) = 7u;
      U8(pQ + 0x0Cu) = 9u;
      U32(pQ + 0xE8u) = 0x22222222u;
    }
    c.ecx = pQ; c.calleePop = 0u;
    ts[0] = pQ;
    run_and_emit(va, name, k,
                 k == 0 ? "clean_init" : k == 1 ? "dirty_slots_cleared" : "alt_quest_addr",
                 &c, ts, 1, 0u, 0);
  }
}

/* =========================================================================
 * BATCH 1 (55 VAs): Non-Quest (20) + Quests Part 1 (35)
 * ========================================================================= */
static void emit_batch1_vas(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [1] 0x6FCCA710 D2Game_6FCCA710_113c (eax=pUnit, s0=pGame, s1=pAiTickArgs, ret 8, void; TS: pUnit, pGame, 0, pAiTickArgs) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 250u : 100u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 101u);
    uint32_t pAiCtrl = STAGE_SCRATCH;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x100u;
    uint32_t pTick   = STAGE_SCRATCH + 0x400u;
    U32(pTick + 0x00u) = pAiCtrl;
    U32(pTick + 0x1Cu) = pMonTxt;
    S16(pMonTxt + 0x172u) = -1;
    uint32_t g = STAGE_GAME;
    if (k == 1) {
      U32(pAiCtrl + 0x1Cu) = 99u;
      g = 0u;
    } else if (k == 2) {
      U32(pAiCtrl + 0x1Cu) = 99u; /* not in game hash -> falls through to stall 10 at frame 250 */
    }
    c.eax = STAGE_UNIT0; c.nargs = 2; c.args[0] = g; c.args[1] = pTick; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = g; ts[2] = 0; ts[3] = pTick;
    run_and_emit(0x6FCCA710u, "D2Game_6FCCA710_113c", k,
                 k == 0 ? "no_owner_no_corpse_stall10" : k == 1 ? "null_game_assert2d3" : "missing_corpse_stall10_f250",
                 &c, ts, 4, 0u, (k == 1) ? 1 : 0);
  }

  /* [2] 0x6FCCAC30 D2Game_6FCCAC30_113c (eax=pAiTickArgs, ecx=pUnit, s0=pGame, ret 4, void; TS: pAiTickArgs, pUnit, pGame) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 320u : 100u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 21u, 1u, 5000u, 5000u, 102u);
    uint32_t pAiCtrl = STAGE_SCRATCH;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x100u;
    uint32_t pTick   = STAGE_SCRATCH + 0x400u;
    U32(pTick + 0x00u) = pAiCtrl;
    U32(pTick + 0x1Cu) = pMonTxt;
    S16(pMonTxt + 0x170u) = -1;
    uint32_t g = STAGE_GAME;
    if (k == 1) {
      U32(pAiCtrl + 0x1Cu) = 88u;
      g = 0u;
    } else if (k == 2) {
      U32(pAiCtrl + 0x1Cu) = 88u;
    }
    c.eax = pTick; c.ecx = STAGE_UNIT0; c.nargs = 1; c.args[0] = g; c.calleePop = 4u;
    ts[0] = pTick; ts[1] = STAGE_UNIT0; ts[2] = g;
    run_and_emit(0x6FCCAC30u, "D2Game_6FCCAC30_113c", k,
                 k == 0 ? "no_owner_stall10" : k == 1 ? "null_game_assert2d3" : "missing_saved_stall10_f320",
                 &c, ts, 3, 0u, (k == 1) ? 1 : 0);
  }

  /* [3] 0x6FCCC410 D2Game_6FCCC410_113c (ecx=pGame, edx=pUnit, s0=pAiTickParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 200u : 100u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 0u : 1u, 1u, 23u, 1u, 5000u, 5000u, 105u);
    uint32_t pAiCtrl = STAGE_SCRATCH;
    uint32_t pMonTxt = STAGE_SCRATCH + 0x100u;
    uint32_t pTick   = STAGE_SCRATCH + 0x400u;
    U32(pTick + 0x00u) = pAiCtrl;
    U32(pTick + 0x1Cu) = pMonTxt;
    if (k == 1) {
      /* Link a Type-2 event on STAGE_UNIT0 + 0xDC so clearAurasType2 unlinks/frees it */
      uint32_t pEv = STAGE_SCRATCH + 0x600u;
      U8(pEv + 0x00u)  = 2u;
      U32(pEv + 0x08u) = STAGE_UNIT0;
      U32(STAGE_UNIT0 + 0xDCu) = pEv;
    } else if (k == 2) {
      U32(STAGE_UDATA0 + 0x28u) = STAGE_AIGEN0;
      U32(STAGE_AIGEN0 + 0x28u) = STAGE_GAME;
      U32(STAGE_AIGEN0 + 0x2Cu) = 999u; /* missing owner -> stalls 0x64 at frame 200 */
      U32(STAGE_AIGEN0 + 0x30u) = 0u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = pTick; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pTick;
    run_and_emit(0x6FCCC410u, "D2Game_6FCCC410_113c", k,
                 k == 0 ? "non_monster_stall100" : k == 1 ? "clear_type2_event_no_aigen_stall100" : "missing_owner_stall100_f200",
                 &c, ts, 3, 0u, 0);
  }

  /* [5] 0x6FCCD410 SUNITDMG_ProcHitOpenWounds_6FCCD410_113c (ecx=pGame, edx=nEventId, s0=pAtk, s1=pDef, s2=0, s3=statLayer, s4=0, ret 20, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 107u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5001u, 5001u, 108u);
    if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 135, 1, 0); /* 1% chance -> seed 107 misses, mutates seed */
    }
    uint32_t atk = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t statLayer = (135u << 16);
    c.ecx = STAGE_GAME; c.edx = 1u;
    c.nargs = 5; c.args[0] = atk; c.args[1] = STAGE_UNIT1; c.args[2] = 0u; c.args[3] = statLayer; c.args[4] = 0u;
    c.calleePop = 20u;
    ts[0] = STAGE_GAME; ts[1] = 1; ts[2] = atk; ts[3] = STAGE_UNIT1; ts[4] = 0; ts[5] = statLayer; ts[6] = 0;
    run_and_emit(0x6FCCD410u, "SUNITDMG_ProcHitOpenWounds_6FCCD410_113c", k,
                 k == 0 ? "null_attacker_ret0" : k == 1 ? "zero_chance_ret0" : "roll_miss_seed_stepped",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [6] 0x6FCCE200 ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c (ecx=pGame, s0=pCorpse, s1=0, s2=0, s3=nMonClassId, s4=ownerGuid, ret 20, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 109u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5001u, 5001u, 110u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t g = (k == 1) ? 0u : STAGE_GAME;
    uint32_t corpse = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = g; c.nargs = 5;
    c.args[0] = corpse; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 1u; c.args[4] = 10u;
    c.calleePop = 20u;
    ts[0] = g; ts[1] = corpse; ts[2] = 0; ts[3] = 0; ts[4] = 1; ts[5] = 10;
    run_and_emit(0x6FCCE200u, "ITEMEVENT_ReanimateCorpseAsReturned_6FCCE200_113c", k,
                 k == 0 ? "null_corpse_ret0" : k == 1 ? "null_game_assert2d3" : "alive_mon_not_corpse_ret0",
                 &c, ts, 6, 0xFFFFFFFFu, (k == 1) ? 1 : 0);
  }

  /* [7] 0x6FCE0B90 NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c (eax=pMerc, s0=pGame, s1=pPlayer, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 271u, 30u, 1u, 5002u, 5002u, 112u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 500 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0, 0);
    U32(STAGE_UNIT1 + 0xC8u) = 0x40000u;
    if (k == 1) {
      stage_pet_link(STAGE_UDATA0, 7u, 99u, 123u, 1u, 1u);
    }
    uint32_t merc = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t g    = (k == 1) ? 0u : STAGE_GAME;
    c.eax = merc; c.nargs = 2; c.args[0] = g; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = merc; ts[1] = g; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCE0B90u, "NPCS_ResurrectOrReplacePlayerMerc_6FCE0B90_113c", k,
                 k == 0 ? "null_merc_noop" : k == 1 ? "old_merc_null_game_assert2d3" : "resurrect_merc_full_hp",
                 &c, ts, 3, 0u, (k == 1) ? 1 : 0);
  }

  /* [8] 0x6FCE0DB0 NPCTRADE_InteractResurrectMerc_6FCE0DB0_113c (eax=dwNpcGuid, ecx=pGame, s0=pPlayer, ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 113u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, (k == 1) ? 1234 : (k == 2) ? 5678 : 9999, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x96u, 55u, 1u, 5002u, 5002u, 114u);
    if (k >= 2) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U8(STAGE_UNIT0 + 0x6Cu)  = (k == 3) ? 1u : 0u;
      U32(STAGE_UNIT0 + 0x68u) = 1u;
      U32(STAGE_UNIT0 + 0x64u) = 55u;
    }
    uint32_t g = (k == 0) ? 0u : STAGE_GAME;
    c.eax = 55u; c.ecx = g; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = 55; ts[1] = g; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCE0DB0u, "NPCTRADE_InteractResurrectMerc_6FCE0DB0_113c", k,
                 k == 0 ? "null_game_assert2d3" : k == 1 ? "npc_missing_pkt2a_1234" : k == 2 ? "not_interacting_pkt2a_5678" : "kashya_no_merc_pkt2a_9999",
                 &c, ts, 3, 0u, (k == 0) ? 1 : 0);
  }

  /* [9] 0x6FCEAB30 MONREG_InitAllActMonsterRegions_6FCEAB30_113c (edx=lowSeed, s0=pool, s1=ppReg, s2=pSeed, s3=diff, s4=bExp, ret 20, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pSeed = STAGE_SCRATCH;
    uint32_t ppTbl = STAGE_SCRATCH + 0x40u;
    uint32_t diff  = (uint32_t)k;
    uint32_t bExp  = (k == 0) ? 0u : 1u;
    uint32_t seed  = (k == 0) ? 0x12345678u : (k == 1) ? 0x9ABCDEF1u : 0x55AA33CCu;
    c.edx = seed; c.nargs = 5;
    c.args[0] = 0u; c.args[1] = ppTbl; c.args[2] = pSeed; c.args[3] = diff; c.args[4] = bExp;
    c.calleePop = 20u;
    ts[0] = seed; ts[1] = 0; ts[2] = ppTbl; ts[3] = pSeed; ts[4] = diff; ts[5] = bExp;
    run_and_emit(0x6FCEAB30u, "MONREG_InitAllActMonsterRegions_6FCEAB30_113c", k,
                 k == 0 ? "norm_classic_all_136" : k == 1 ? "nm_exp_all_136" : "hell_exp_all_136",
                 &c, ts, 6, 0u, 0);
  }

  /* [10] 0x6FCEACC0 MONREG_InitGameMonsterRegionsFromGameSeed_6FCEACC0_113c (esi=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_GAME + 0xD0u) = (k == 0) ? 0x11223344u : (k == 1) ? 0x55551111u : 0x778899AAu;
    U32(STAGE_GAME + 0xD4u) = 0x29Au;
    U8(STAGE_GAME + 0x6Du)  = (uint8_t)k;
    U32(STAGE_GAME + 0x70u) = (k == 0) ? 0u : 1u;
    c.esi = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FCEACC0u, "MONREG_InitGameMonsterRegionsFromGameSeed_6FCEACC0_113c", k,
                 k == 0 ? "norm_classic_game_seed" : k == 1 ? "nm_exp_game_seed" : "hell_exp_game_seed",
                 &c, ts, 1, 0u, 0);
  }

  /* [11] 0x6FCEF810 D2Game_6FCEF810_113c (s0=pGame, s1=pPlayer, s2=nDestLevel, s3=dwObjectId, ret 16, void; TS: pPlayer, pGame, nDestLevel, dwObjectId) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 1u : 2u);
    if (k == 2) {
      stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 20u, 20u);
      uint32_t pColl = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pMap  = U32(pColl + 0x20u);
      for (uint32_t i = 0; i < 400u; i++) U16(pMap + i * 2u) = 0xFFFFu; /* fully blocked */
    }
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 1) ? 0u : STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 115u);
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = 2u; c.args[3] = 0u;
    c.calleePop = 16u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = 2; ts[3] = 0;
    run_and_emit(0x6FCEF810u, "D2Game_6FCEF810_113c", k,
                 k == 0 ? "in_town_play_sound18" : k == 1 ? "null_room_asserte42" : "blocked_room_noop",
                 &c, ts, 4, 0u, (k == 1) ? 1 : 0);
  }

  /* [12] 0x6FCF3CB0 ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c (s0=pGame, s1=pUnit, s2=pItem, ret 12, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 116u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    uint32_t cls = (k == 1) ? g_item_ring : g_item_jav;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, cls, 70u, 3u, 5000u, 5000u, 117u);
    if (k >= 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x46, 3, 0);
    if (k == 2) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_jav, 71u, 0u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x46, 2, 0);
      U32(STAGE_UDATA2 + 0x00u) = 2u; /* normal quality */
      U32(STAGE_UDATA1 + 0x00u) = 2u;
    }
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1;
    c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    run_and_emit(0x6FCF3CB0u, "ITEMS_AutoStackGroundItemIntoBeltOrInventory_6FCF3CB0_113c", k,
                 k == 0 ? "zero_qty_ret0" : k == 1 ? "non_autostack_ret0" : "no_belt_match_ret0",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [13] 0x6FCF57F0 ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c (eax=pUnit, s0=pGame, s1=dwItemGuid, s2=nBodyLoc, ret 12, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 118u);
    stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_ring, 72u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    uint32_t u = (k == 1) ? 0u : STAGE_UNIT0;
    uint32_t g = (k == 0) ? 0u : STAGE_GAME;
    uint32_t guid = (k == 2) ? 999u : 72u;
    c.eax = u; c.nargs = 3; c.args[0] = g; c.args[1] = guid; c.args[2] = 6u; c.calleePop = 12u;
    ts[0] = u; ts[1] = g; ts[2] = guid; ts[3] = 6;
    run_and_emit(0x6FCF57F0u, "ITEMS_EquipStoredItemToBodyLoc_6FCF57F0_113c", k,
                 k == 0 ? "null_game_assert14f7" : k == 1 ? "null_unit_assert14f8" : k == 2 ? "missing_item_ret0" : "equip_ring_loc6_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, (k <= 1) ? 1 : 0);
  }

  /* [14] 0x6FCF5C30 ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c (eax=dwGuid, s0=pGame, s1=pUnit, s2=bodyLoc, s3=pOutErr, ret 16, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 119u);
    attach_cursor_item(STAGE_UNIT0, g_item_ring, 73u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    U32(STAGE_SCRATCH) = 0x55u;
    uint32_t g = (k == 0) ? 0u : STAGE_GAME;
    uint32_t u = (k == 1) ? 0u : STAGE_UNIT0;
    uint32_t guid = (k == 2) ? 999u : 73u;
    c.eax = guid; c.nargs = 4; c.args[0] = g; c.args[1] = u; c.args[2] = 4u; c.args[3] = STAGE_SCRATCH; c.calleePop = 16u;
    ts[0] = guid; ts[1] = g; ts[2] = u; ts[3] = 4; ts[4] = STAGE_SCRATCH;
    run_and_emit(0x6FCF5C30u, "ITEMS_SwapDualWieldOrTwoHandBodyLocWithCursor_6FCF5C30_113c", k,
                 k == 0 ? "null_game_assertd39" : k == 1 ? "null_unit_assertd3a" : k == 2 ? "missing_item_ret0" : "ring_bad_loc4_ret0",
                 &c, ts, 5, 0xFFFFFFFFu, (k <= 1) ? 1 : 0);
  }

  /* [15] 0x6FCF6760 ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c (eax=pCorpse, s0=pGame, s1=pPlayer, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 120u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 11u, 17u, 5000u, 5000u, 121u);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_ring, 74u, 1u, 0u, 0u, 122u);
      U8(STAGE_UDATA2 + 0x44u) = 6u;
      U8(STAGE_UDATA2 + 0x45u) = 0xFFu;
      fn_PlaceItemInBodyLoc((void *)(uintptr_t)U32(STAGE_UNIT1 + 0x60u), (void *)(uintptr_t)STAGE_UNIT2, 6);
    }
    uint32_t corpse = (k == 0) ? 0u : STAGE_UNIT1;
    c.eax = corpse; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = corpse; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCF6760u, "ITEMS_TransferCorpseItemsToPlayer_6FCF6760_113c", k,
                 k == 0 ? "null_corpse_ret0" : k == 1 ? "empty_corpse_ret1" : "transfer_ring_loc6_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [16] 0x6FCF8020 D2Game_6FCF8020_113c (eax=dwGuid, ecx=pPlayer, s0=pGame, s1=bodyLoc, s2=bForce, s3=pOutFailed, ret 16, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 123u);
    attach_cursor_item(STAGE_UNIT0, g_item_sword, 75u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    uint32_t g = (k == 0) ? 0u : STAGE_GAME;
    uint32_t u = (k == 1) ? 0u : STAGE_UNIT0;
    uint32_t guid = (k == 2) ? 999u : 75u;
    uint32_t loc = (k == 3) ? 6u : 4u;
    c.eax = guid; c.ecx = u; c.nargs = 4; c.args[0] = g; c.args[1] = loc; c.args[2] = 0u; c.args[3] = STAGE_SCRATCH; c.calleePop = 16u;
    ts[0] = guid; ts[1] = u; ts[2] = g; ts[3] = loc; ts[4] = 0; ts[5] = STAGE_SCRATCH;
    run_and_emit(0x6FCF8020u, "D2Game_6FCF8020_113c", k,
                 k == 0 ? "null_game_assertb7c" : k == 1 ? "null_player_assertb7d" : k == 2 ? "missing_item_fail1" : "non_hand_loc6_fail1",
                 &c, ts, 6, 0xFFFFFFFFu, (k <= 1) ? 1 : 0);
  }

  /* [17] 0x6FCF8600 D2Game_6FCF8600_113c (eax=dwGuid, ecx=pPlayer, s0=pGame, s1=bodyLoc, s2=bForce, s3=pOutFailed, ret 16, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 124u);
    U32(STAGE_SCRATCH) = 0x77u;
    uint32_t g = (k == 0) ? 0u : STAGE_GAME;
    uint32_t u = (k == 1) ? 0u : STAGE_UNIT0;
    uint32_t loc = (k == 2) ? 0x0Bu : 6u;
    c.eax = 999u; c.ecx = u; c.nargs = 4; c.args[0] = g; c.args[1] = loc; c.args[2] = 0u; c.args[3] = STAGE_SCRATCH; c.calleePop = 16u;
    ts[0] = 999; ts[1] = u; ts[2] = g; ts[3] = loc; ts[4] = 0; ts[5] = STAGE_SCRATCH;
    run_and_emit(0x6FCF8600u, "D2Game_6FCF8600_113c", k,
                 k == 0 ? "null_game_assertca8" : k == 1 ? "null_player_assertca9" : k == 2 ? "loc_oob_untouched" : "missing_item_clears_out",
                 &c, ts, 6, 0xFFFFFFFFu, (k <= 1) ? 1 : 0);
  }

  /* [17] 0x6FCFE8F0 skipped: SUNITDMG_AddPlayerExperienceAndCheckLevelUp113c omits STAT_LASTEXP (0x1D) */

  /* [18] 0x6FD10090 PLAYERLIST_SetHostileDelayTick_6FD10090_113c (eax=pTargetUnit, edi=pOwnerUnit, s0=dwHostileTick, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 128u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 11u, 1u, 5002u, 5002u, 129u);
    uint32_t pNode = STAGE_SCRATCH;
    U32(pNode + 0x00u) = 11u;
    U32(pNode + 0x08u) = 0x1111u;
    U32(STAGE_UDATA0 + 0x38u) = pNode;
    U32(STAGE_UDATA0 + 0x160u) = 0x9999u;
    uint32_t tgt = (k == 0) ? STAGE_UNIT0 : (k == 1) ? STAGE_UNIT1 : 0u;
    uint32_t tick = (k == 1) ? 0xEA60u : 0x5555u;
    c.eax = tgt; c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = tick; c.calleePop = 4u;
    ts[0] = tgt; ts[1] = STAGE_UNIT0; ts[2] = tick;
    run_and_emit(0x6FD10090u, "PLAYERLIST_SetHostileDelayTick_6FD10090_113c", k,
                 k == 0 ? "self_only_clears_tick" : k == 1 ? "match_guid11_sets_ea60" : "null_tgt_unmatched",
                 &c, ts, 3, 0u, 0);
  }

  /* [21..26] 6 clean Quest Table Init Functions (ecx=pQuest, ret 0, void) */
  emit_quest_init_3(0x6FCE4880u, "ACT2Q8_InitQuestData_6FCE4880_113c");
  emit_quest_init_3(0x6FCE5790u, "ACT2Q7_InitQuestData_6FCE5790_113c");
  emit_quest_init_3(0x6FCE9F60u, "ACT2Q6_InitQuestTableRecord_6FCE9F60_113c");
  emit_quest_init_3(0x6FD09200u, "ACT3Q5_InitQuestTableRecord_6FD09200_113c");
  emit_quest_init_3(0x6FD093C0u, "ACT3Q4_InitQuestTableRecord_6FD093C0_113c");
  emit_quest_init_3(0x6FD09DC0u, "ACT3Q2_InitQuestTableRecord_6FD09DC0_113c");

  /* [27] 0x6FCDA810 ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c (ecx=pQuestData, edx=pNpcParams, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 107u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 409u, (k == 1) ? 25u : 20u, 12u, 5000u, 5000u, 132u);
    stage_quest_node(STAGE_QUEST0, 0x18u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k == 2) ? 1u : 0u;
    U32(STAGE_QUESTARG + 0x00u) = (k == 2) ? 0u : STAGE_GAME; /* k=2: sets pUnit+0xB8='hfh ', asserts 2503 on pGame==0 */
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCDA810u, "ACT4Q2_DropHellforgeHammerAtUnit_6FCDA810_113c", k,
                 k == 0 ? "inactive_noop_g20" : k == 1 ? "inactive_noop_g25" : "active_sets_hfh_null_game_assert2503",
                 &c, ts, 2, 0u, (k == 2) ? 1 : 0);
  }

  /* [28] 0x6FD098E0 ACT3Q5_InitStairsObject_6FD098E0_113c (ecx=pObjInitStrc, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 83u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 40u, 0u, 5000u, 5000u, 133u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
      U32(STAGE_QUESTEX0 + 0x10u) = (k == 2) ? 2u : 1u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FD098E0u, "ACT3Q5_InitStairsObject_6FD098E0_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "mode1_schedules_ev7" : "mode2_no_ev7",
                 &c, ts, 1, 0u, 0);
  }

  /* [29] 0x6FCE2850 ACT2Q5_InitArcanePortalObject_6FCE2850_113c (ecx=pOpData, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 74u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 41u, 0u, 5000u, 5000u, 134u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      if (k == 2) U8(STAGE_QUESTEX0 + 0x0Bu) = 1u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCE2850u, "ACT2Q5_InitArcanePortalObject_6FCE2850_113c", k,
                 k == 0 ? "no_quest_mode2" : k == 1 ? "active_unopened_mode0" : "opened_flag_mode2",
                 &c, ts, 1, 0u, 0);
  }

  /* [30] 0x6FD05F60 ACT3Q2_ActivateGidbinnAltarObject_6FD05F60_113c (ebx=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 78u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 42u, 0u, 5000u, 5000u, 135u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x06u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x28u) = 42u;
    }
    if (k == 2) insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    c.ebx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FD05F60u, "ACT3Q2_ActivateGidbinnAltarObject_6FD05F60_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "altar_missing_clears_flag" : "altar_found_mode1_ev1",
                 &c, ts, 1, 0u, 0);
  }

  /* [31] 0x6FCE5D10 ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c (eax=pQuestState, s0=pQuest, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 74u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 43u, 0u, 5000u, 5000u, 136u);
    stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
    if (k == 1) {
      U8(STAGE_QUESTEX0 + 0x11u) = 1u;
      U32(STAGE_QUEST0 + 0x04u)  = 0u; /* null pGame -> assert 0x2d3 */
    } else if (k == 2) {
      U16(STAGE_QUESTEX0 + 0x40u) = 1u; /* non-zero -> skips +0x46 */
      U8(STAGE_QUESTEX0 + 0x11u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x38u) = 43u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.eax = STAGE_QUESTEX0; c.nargs = 1; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = STAGE_QUESTEX0; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FCE5D10u, "ACT2Q4_OpenArcanePortalAndSyncQuest_6FCE5D10_113c", k,
                 k == 0 ? "wPrev0_no_portal_flag" : k == 1 ? "portal_flag_null_game_assert2d3" : "portal_found_mode2",
                 &c, ts, 2, 0u, (k == 1) ? 1 : 0);
  }

  /* [32] 0x6FD05A60 ACT3Q7_ActivateMephistoBridgeAndPortal_6FD05A60_113c (edi=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 102u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 44u, 0u, 5000u, 5000u, 137u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 10u, 45u, 0u, 5002u, 5002u, 138u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
    }
    if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x01u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x04u) = 44u;
      U8(STAGE_QUESTEX0 + 0x02u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x08u) = 45u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    c.edi = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FD05A60u, "ACT3Q7_ActivateMephistoBridgeAndPortal_6FD05A60_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "flags0_sets_modes2" : "bridge_mode1_portal_mode2",
                 &c, ts, 1, 0u, 0);
  }

  /* [33] 0x6FCE7FB0 ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c (eax=pGame, ebx=pOutCoord, s0=ppOutRoom, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x3Cu) = (k == 2) ? 1u : 0u;
    }
    c.eax = STAGE_GAME; c.ebx = STAGE_SCRATCH; c.nargs = 1; c.args[0] = STAGE_SCRATCH + 0x10u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH; ts[2] = STAGE_SCRATCH + 0x10u;
    run_and_emit(0x6FCE7FB0u, "ACT2Q6_FindLutGholeinReturnPortalCoords_6FCE7FB0_113c", k,
                 k == 0 ? "no_quest_ret0" : k == 1 ? "flag3c_0_ret0" : "null_act1_assert556",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 2) ? 1 : 0);
  }

  /* [34] 0x6FD084A0 ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c (ecx=pObjInitStrc, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 83u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 46u, 0u, 5000u, 5000u, 139u);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x0Cu) = (k >= 1) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x28u) = 1u; /* skip MONSTER_Create for k=0,1; k=2 triggers failed spawn in empty room */
    if (k == 2) U8(STAGE_QUESTEX0 + 0x28u) = 0u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    U32(STAGE_SCRATCH + 0x14u) = 5000u;
    U32(STAGE_SCRATCH + 0x18u) = 5000u;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FD084A0u, "ACT3Q3_InitCompellingOrbPreset_6FD084A0_113c", k,
                 k == 0 ? "flag0c_0_spawned1_noop" : k == 1 ? "flag0c_1_mode2" : "flag0c_1_try_spawn",
                 &c, ts, 1, 0u, 0);
  }

  /* [35] 0x6FD03290 ACT3Q7_InitMephistoPortalObject_6FD03290_113c (ecx=pObjInit, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 0x68u : 0x66u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 47u, 0u, 5000u, 5000u, 140u);
    if (k == 2) {
      stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
      U32(STAGE_QUESTEX0 + 0x0Cu) = 1u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FD03290u, "ACT3Q7_InitMephistoPortalObject_6FD03290_113c", k,
                 k == 0 ? "level68_mode2" : k == 1 ? "no_quest_noop" : "quest14_sets_guid_mode1",
                 &c, ts, 1, 0u, 0);
  }

  /* [36] 0x6FCD9E80 ACT4Q2_InitHellforgeObject_6FCD9E80_113c (ecx=pObjInit, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 107u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 48u, 0u, 5000u, 5000u, 141u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x18u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      U8(STAGE_QUEST0 + 0x0Bu) = (k == 1) ? 2u : 0u;
      U16(STAGE_QUESTEX0 + 0x00u) = (k == 1) ? 1u : 2u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCD9E80u, "ACT4Q2_InitHellforgeObject_6FCD9E80_113c", k,
                 k == 0 ? "no_quest_mode3" : k == 1 ? "bQ2_sets_mode1" : "bQ0_promotes_bQ2_mode2",
                 &c, ts, 1, 0u, 0);
  }

  /* [37] 0x6FCE71A0 ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c (eax=pQuest, s0=pOpStrc, ret 4, void/u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 61u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 49u, 0u, 5000u, 5000u, 142u);
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 0u : 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 2) ? 2u : 0u;
    U8(STAGE_QUEST0 + 0x0Bu) = (k == 2) ? 0u : 1u;
    U32(STAGE_QUESTEX0 + 0x08u) = (k == 2) ? 2u : 1u;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.eax = STAGE_QUEST0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FCE71A0u, "ACT2Q3_OnTaintedSunAltarInit_6FCE71A0_113c", k,
                 k == 0 ? "inactive_records_guid_mode1" : k == 1 ? "active_state0_activates_q3" : "active_bQ0_promotes_bQ2",
                 &c, ts, 2, 0u, 0);
  }

  /* [38] 0x6FCE9ED0 QUEST0D_InitTemplePortalObject_6FCE9ED0_113c (ecx=pObjInit, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 73u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 50u, 0u, 5000u, 5000u, 143u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
      if (k == 1) {
        U8(STAGE_QUESTEX0 + 0x0Cu) = 1u; /* schedules timer + sets +0x03=1 + mode 2 */
      } else {
        U8(STAGE_QUESTEX0 + 0x0Bu) = 1u; /* sets mode 2 only */
      }
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCE9ED0u, "QUEST0D_InitTemplePortalObject_6FCE9ED0_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "flag0c_appends_timer_mode2" : "flag0b_sets_mode2",
                 &c, ts, 1, 0u, 0);
  }

  /* [39] 0x6FCDA850 ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c (ebx=pRoom, edi=y, s0=pGame, s1=x, s2=pQuestCustomData, ret 12, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    U32(STAGE_GAME + 0xF0u + 108u * 4u) = STAGE_MONREG0;
    U32(STAGE_MONREG0 + 0x2DCu) = 40u;
    U32(STAGE_MONREG0 + 0x2E0u) = 40u;
    if (k >= 1) {
      stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
      if (k == 1) {
        uint32_t pColl = U32(STAGE_ROOM0 + 0x20u);
        uint32_t pMap  = U32(pColl + 0x20u);
        for (uint32_t i = 0; i < 900u; i++) U16(pMap + i * 2u) = 0xFFFFu;
      }
    }
    uint32_t room = (k == 0) ? 0u : STAGE_ROOM0;
    c.ebx = room; c.edi = 5000u; c.nargs = 3;
    c.args[0] = STAGE_GAME; c.args[1] = 5000u; c.args[2] = STAGE_QUESTEX0; c.calleePop = 12u;
    ts[0] = room; ts[1] = 5000; ts[2] = STAGE_GAME; ts[3] = 5000; ts[4] = STAGE_QUESTEX0;
    run_and_emit(0x6FCDA850u, "ACT4Q3_SpawnDiabloInSanctuary_6FCDA850_113c", k,
                 k == 0 ? "null_room_ret0" : k == 1 ? "blocked_room_ret0" : "open_room_no_logic_assert668",
                 &c, ts, 5, 0xFFFFFFFFu, (k == 2) ? 1 : 0);
  }

  /* [40] 0x6FD09EA0 ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c (eax=pQuest, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 92u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 51u, 0u, 5000u, 5000u, 144u);
    stage_quest_node(STAGE_QUEST0, 0x12u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x00u)  = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTEX0 + 0x04u) = 51u;
    U32(STAGE_QUESTEX0 + 0x08u) = 1u;
    if (k == 1) U32(STAGE_QUEST0 + 0x04u) = 0u;
    if (k == 3) insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    c.eax = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FD09EA0u, "ACT3Q3_OpenSewerLeverObject_6FD09EA0_113c", k,
                 k == 0 ? "flag0_noop" : k == 1 ? "null_game_assert2d3" : k == 2 ? "missing_obj_sets_mode2" : "obj_found_mode1_ev1",
                 &c, ts, 1, 0u, (k == 1) ? 1 : 0);
  }

  /* [41] 0x6FD09960 ACT3Q5_OnStairsProximityTimer_6FD09960_113c (edi=pObjUnit, s0=pQuest, ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 83u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 52u, (k == 1) ? 2u : (k == 3) ? 1u : 0u, 5000u, 5000u, 145u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5002u, 146u);
    link_room_units(STAGE_ROOM0, STAGE_UNIT1, STAGE_UNIT0);
    stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x0Cu) = (k == 0) ? 0u : 2u;
    c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FD09960u, "ACT3Q5_OnStairsProximityTimer_6FD09960_113c", k,
                 k == 0 ? "state0_reschedules" : k == 1 ? "already_mode2_returns" : k == 2 ? "near_mode0_to_mode1" : "near_mode1_to_mode2",
                 &c, ts, 2, 0u, 0);
  }

  /* [42] 0x6FD06A60 ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 147u);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u)   = 1u;
    U8(STAGE_QUESTEX0 + 0x15u) = 1u;
    if (k == 1) stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_j34, 70u, 0u);
    if (k == 2) stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_g34, 71u, 0u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD06A60u, "ACT3Q1_OnPlayerCheckGoldenBirdItems_6FD06A60_113c", k,
                 k == 0 ? "no_items_noop" : k == 1 ? "has_jade_sets_bQ1" : "has_bird_sets_bQ3",
                 &c, ts, 2, 0u, 0);
  }

  /* [43] 0x6FCE99B0 ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c (ecx=pObjInitParam, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1) ? 0x4Au : (k == 2) ? 0x36u : 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 53u, 0u, 5000u, 5000u, 148u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
      U16(STAGE_QUESTEX0 + 0x42u) = 1u;
      U16(STAGE_QUESTEX0 + 0x44u) = 1u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCE99B0u, "ACT2Q4_InitArcanePortalObjectMode_6FCE99B0_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "level4a_mode1_ev1" : k == 2 ? "level36_mode1_ev1" : "other_level_noop",
                 &c, ts, 1, 0u, 0);
  }

  /* [44] 0x6FCDBCE0 ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 149u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    if (k == 1) {
      U16(STAGE_QBITS0 + 0x20u + 0x1Au * 2u) = (1u << 0x0Du); /* quest 0x1a bit 0x0d set -> calls 6FCDB4F0 */
    }
    if (k == 2) {
      U32(STAGE_UNIT0 + 0x0Cu) = 15u; /* distinct guid/client state */
      U32(STAGE_CLIENT0 + 0x170u) = 15u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCDBCE0u, "ACT4Q3_TriggerEndgameOrSendPacket50_6FCDBCE0_113c", k,
                 k == 0 ? "sends_pkt50_q17" : k == 1 ? "bit0d_set_endgame_assert39" : "sends_pkt50_alt_guid",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 1) ? 1 : 0);
  }

  /* [45] 0x6FD08140 ACT3Q2_OnGidbinnBossKilled_6FD08140_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 78u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 12u, 5000u, 5000u, 150u);
    if (k >= 1) U8(STAGE_UDATA0 + 0x16u) = (k == 2) ? 0x02u : 0x00u;
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u)   = (k == 0) ? 0u : 1u;
    U8(STAGE_QUESTEX0 + 0x02u) = 1u;
    if (k == 2) U32(STAGE_QUEST0 + 0x04u) = 0u; /* null pGame -> asserts 2503 inside 0x6FC31A70 after setting +0xB8='g33 ' */
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD08140u, "ACT3Q2_OnGidbinnBossKilled_6FD08140_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "normal_mon_noop" : "special_mon_null_game_assert2503",
                 &c, ts, 2, 0u, (k == 2) ? 1 : 0);
  }

  /* [46] 0x6FD07AF0 ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 94u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, (k == 2) ? 77u : 10u, 1u, 5000u, 5000u, 151u);
    stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = (k == 1) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD07AF0u, "ACT3Q4_OnLamEsensTomePickedUp_6FD07AF0_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "active_null_plr_adds_ffffffff" : "active_adds_guid77",
                 &c, ts, 2, 0u, 0);
  }

  /* [47] 0x6FCE39B0 ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 152u);
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u)   = 1u;
    U8(STAGE_QUESTEX0 + 0x2Bu) = 1u;
    U8(STAGE_QUESTEX0 + 0x10u) = 1u;
    if (k == 1) stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_msf, 70u, 0u);
    if (k == 2) stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_hst, 71u, 0u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE39B0u, "ACT2Q2_Callback14_CountStaffItems_6FCE39B0_113c", k,
                 k == 0 ? "no_items_noop" : k == 1 ? "has_msf_inc18" : "has_hst_inc1c_clears10",
                 &c, ts, 2, 0u, 0);
  }

  /* [48] 0x6FD02B70 QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c (ecx=pQuestData, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 1u : 5u;
    U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 1u : 0u;
    U32(STAGE_QUEST0 + 0x10u) = (k == 2) ? 0x13u : 99u;
    U32(STAGE_QUEST0 + 0xF0u) = 0u; /* k=2 finds pPrev=STAGE_QUEST0 with null pfn -> assert 0x284 */
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FD02B70u, "QUESTS_ChainStatusFilterOrQuest17_6FD02B70_113c", k,
                 k == 0 ? "active_state1_ret1" : k == 1 ? "no_prev_no_q17_ret0" : "bad_pfn_assert284",
                 &c, ts, 1, 0xFFu, (k == 2) ? 1 : 0);
  }

  /* [49] 0x6FCE5F30 ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 153u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    uint32_t cls = (k == 0) ? g_item_ring : (k == 1) ? g_item_tr1 : g_item_vip;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, cls, 70u, 0u, 5000u, 5000u, 154u);
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x08u) = 9u; /* mismatch act -> skip first helper */
    U8(STAGE_QUEST0 + 0x14u) = 1u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE5F30u, "ACT2Q2_Callback_ItemPickedUpUpdateStaffQuest_6FCE5F30_113c", k,
                 k == 0 ? "unrelated_ring_noop" : k == 1 ? "tr1_sets_bQ1" : "vip_sets_bQ6",
                 &c, ts, 2, 0u, 0);
  }

  /* [50] 0x6FCE9A80 ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c (ecx=pOpStrc, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 74u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 54u, (k == 1) ? 2u : 0u, 5000u, 5000u, 155u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5001u, 5001u, 156u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 2) ? 1u : 0u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x10u) = 10u;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCE9A80u, "ACT2Q4_OperateHorazonsJournal_6FCE9A80_113c", k,
                 k == 0 ? "mode0_no_quest_ev1" : k == 1 ? "mode2_inactive_sets_room" : "mode0_active_promotes5",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [51] 0x6FCE66B0 ACT2Q5_OnSummonerKilled_6FCE66B0_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 74u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 250u, 20u, 12u, 5000u, 5000u, 157u);
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u)   = (k == 0) ? 0u : 1u;
    U8(STAGE_QUESTEX0 + 0x08u) = (k == 2) ? 1u : 0u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE66B0u, "ACT2Q5_OnSummonerKilled_6FCE66B0_113c", k,
                 k == 0 ? "inactive_sets_ctrl20_7" : k == 1 ? "active_appends_timer" : "active_timer_already_set",
                 &c, ts, 2, 0u, 0);
  }

  /* [52] 0x6FCE72C0 ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 158u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTCTRL + 0x08u) = (k == 1) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    if (k == 1) {
      U16(STAGE_QBITS0 + 0x20u + 0x0Bu * 2u) = 1u; /* bit 0 set -> ctrl+0x08==0 assert 0x820 */
    } else if (k == 2) {
      U16(STAGE_QBITS0 + 0x20u + 0x0Bu * 2u) = 1u; /* bit 0 set -> sets global q0b bit 0x0d */
    } else if (k == 3) {
      U16(STAGE_QBITS0 + 0x20u + 0x0Bu * 2u) = (1u << 2) | (1u << 4); /* bit2+bit4 -> bQ=2, state=3 */
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE72C0u, "ACT2Q3_Callback13_PlayerEnterSyncState_6FCE72C0_113c", k,
                 k == 0 ? "no_bits_noop" : k == 1 ? "bit0_null_flag8_assert820" : k == 2 ? "bit0_sets_global_0d" : "bit2_bit4_state3",
                 &c, ts, 2, 0u, (k == 1) ? 1 : 0);
  }

  /* [53] 0x6FD07770 ACT3Q2_OnGidbinnPickedUp_6FD07770_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 78u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 159u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    uint32_t cls = (k == 0) ? g_item_ring : g_item_g33;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, cls, 70u, 0u, 5000u, 5000u, 160u);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    if (k == 2) U16(STAGE_QBITS0 + 0x20u + 0x13u * 2u) = (1u << 9); /* bit 9 already set */
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD07770u, "ACT3Q2_OnGidbinnPickedUp_6FD07770_113c", k,
                 k == 0 ? "non_gidbinn_noop" : k == 1 ? "gidbinn_sets_bit9_sound41" : "gidbinn_bit9_already_set",
                 &c, ts, 2, 0u, 0);
  }

  /* [54] 0x6FCD9F20 ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 1) ? 0u : STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 162u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x3Cu) = STAGE_ROOM0;
    if (k == 0) U16(STAGE_QBITS0 + 0x20u + 0x1Au * 2u) = 1u; /* bit 0 already complete -> early return */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCD9F20u, "ACT4Q3_CompleteQuestIfPlayerNearDiabloRoom_6FCD9F20_113c", k,
                 k == 0 ? "already_complete_ret0" : k == 1 ? "null_room_ret0" : "same_room_completes_q1a",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [56] 0x6FCDA960 ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c (ecx=pGame, edx=pQuest, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x16u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x0Du) = 1u;
    if (k == 1) {
      U8(STAGE_QUEST0 + 0x0Cu) = 4u;
      U8(STAGE_QUEST0 + 0x0Bu) = 1u;
    } else if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x10u) = 1u; /* flag10 cleared, pAct3=0 -> pRoom=0 */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FCDA960u, "ACT4Q1_TimerSpawnIzualSpirit_6FCDA960_113c", k,
                 k == 0 ? "clears_0d_ret1" : k == 1 ? "state4_promotes_bQ3" : "flag10_null_act3_clears10",
                 &c, ts, 2, 0xFFu, 0);
  }

  /* [57] 0x6FCD9830 ACT4Q2_SyncQuestDataFromPlayerInventoryAndFlags_6FCD9830_113c (ecx=pQuestData, edx=pNpcParams, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 163u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_quest_node(STAGE_QUEST0, 0x18u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x1Bu;
    if (k == 1) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_hfh, 70u, 0u);
    } else if (k >= 2) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_mss, 71u, 0u);
      U16(STAGE_QBITS0 + 0x20u + 0x1Bu * 2u) = (k == 2) ? (1u << 5) : (1u << 3);
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCD9830u, "ACT4Q2_SyncQuestDataFromPlayerInventoryAndFlags_6FCD9830_113c", k,
                 k == 0 ? "no_mss_sets_state1" : k == 1 ? "has_hfh_inc10_state1" : k == 2 ? "has_mss_bit5_state2" : "has_mss_bit3_state3",
                 &c, ts, 2, 0u, 0);
  }
}

/* Helper for Act 2 Q2 chests (scroll/cube/staff): 3 clean cases avoiding Fog.#10213 gold lookup */
static void emit_a2q2_chest_3(uint32_t va, const char *name) {
  X86CallSpec c;
  int64_t ts[4];
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, 2u, 10u, 55u + (uint32_t)k, (k == 0) ? 1u : 0u, 5000u, 5000u, 200u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, 0u, 0u, 1u, 10u, 1u, 5002u, 5002u, 205u);
    if (k == 2) U32(STAGE_UNIT0 + 0x80u) = 0u; /* assert 4885 in chest drop */
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x10u) = 10u;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(va, name, k,
                 k == 0 ? "already_open_ret0" : k == 1 ? "open_sets_code_no_qctrl_assert507" : "open_sets_code_null_objgame_assert4885",
                 &c, ts, 1, 0xFFFFFFFFu, (k >= 1) ? 1 : 0);
  }
}

/* Helper for Act 3 Q3 Khalim relic chests (brain/eye/heart): 3 clean cases */
static void emit_a3q3_chest_3(uint32_t va, const char *name) {
  X86CallSpec c;
  int64_t ts[4];
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, 2u, 10u, 60u + (uint32_t)k, (k == 0) ? 1u : 0u, 5000u + (uint16_t)k, 5000u, 210u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, 0u, 0u, 1u, 10u, 1u, 5002u, 5002u, 215u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x10u) = 10u;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(va, name, k,
                 k == 0 ? "already_open_ret0" : k == 1 ? "open_no_qctrl_assert507_a" : "open_no_qctrl_assert507_b",
                 &c, ts, 1, 0xFFFFFFFFu, (k >= 1) ? 1 : 0);
  }
}

/* ================================ BATCH 2: 41 Quest Hi-VAs (Part 2) ================================ */

static void emit_batch2_vas(void) {
  X86CallSpec c;
  int64_t ts[8];

  /* [B2-1..3] Act 2 Q2 Scroll / Cube / Staff chests */
  emit_a2q2_chest_3(0x6FCEA290u, "ACT2Q2_OperateHoradricScrollChest_6FCEA290_113c");
  emit_a2q2_chest_3(0x6FCEA050u, "ACT2Q2_OperateHoradricCubeChest_6FCEA050_113c");
  emit_a2q2_chest_3(0x6FCEA170u, "ACT2Q2_OperateStaffOfKingsChest_6FCEA170_113c");

  /* [B2-4..6] Act 3 Q3 Khalim Brain / Eye / Heart chests */
  emit_a3q3_chest_3(0x6FD0A390u, "ACT3Q3_OperateKhalimBrainChest_6FD0A390_113c");
  emit_a3q3_chest_3(0x6FD0A4C0u, "ACT3Q3_OperateKhalimEyeChest_6FD0A4C0_113c");
  emit_a3q3_chest_3(0x6FD0A5F0u, "ACT3Q3_OperateKhalimHeartChest_6FD0A5F0_113c");

  /* [B2-7] 0x6FD050C0 ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 220u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x0Fu, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    if (k == 0) {
      U16(STAGE_QBITS0 + 0x20u + 0x11u * 2u) = 1u << 0;
    } else if (k == 1) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_bbb, 70u, 0u);
    } else if (k == 2) {
      U16(STAGE_QBITS0 + 0x20u + 0x11u * 2u) = 1u << 3;
    } else {
      U16(STAGE_QBITS0 + 0x20u + 0x11u * 2u) = 1u << 2;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD050C0u, "ACT3Q4_SyncLamEsensTomeQuestFromPlayer_6FD050C0_113c", k,
                 k == 0 ? "bit0_sets_global_0d" : k == 1 ? "has_bbb_sets_state4_guid" : k == 2 ? "bit3_sets_state3" : "bit2_sets_state2",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-8] 0x6FD09F60 ACT3Q3_OperateSewerLeverObject_6FD09F60_113c (ecx=pOperateArgs, ret 0, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U32(STAGE_GAME + 0xA8u) = (k == 3) ? 250u : 100u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 92u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 50u, (k == 0) ? 1u : 0u, 5000u, 5000u, 221u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 10u, 51u, 0u, 5005u, 5005u, 222u);
    stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x00u) = 1u;
    U32(STAGE_QUESTEX0 + 0x04u) = 51u;
    if (k >= 2) insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x10u) = 10u;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FD09F60u, "ACT3Q3_OperateSewerLeverObject_6FD09F60_113c", k,
                 k == 0 ? "already_mode1_ret0" : k == 1 ? "stairs_missing_ret0" : k == 2 ? "open_f100_ev1_ev7_flag9" : "open_f250_ev1_ev7_flag9",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-9] 0x6FD08010 ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 76u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 100u, 20u, 12u, 5000u, 5000u, 223u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5002u, 224u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA1, 0u);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x14u;
    U8(STAGE_QUEST0 + 0x09u)  = (k == 0) ? 0u : 1u;
    U8(STAGE_QUESTEX0 + 0x02u) = 1u;
    U8(STAGE_QUESTEX0 + 0x0Cu) = 1u;
    if (k == 1) {
      U16(STAGE_QBITS0 + 0x20u + 0x14u * 2u) = 1u << 0;
    } else if (k == 2) {
      U32(STAGE_QUEST0 + 0x04u) = 0u; /* writes pMonster+0xB8='j34 ', asserts 2503 on pDropGame==0 */
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x0Cu) = (k == 1) ? STAGE_UNIT1 : 0u;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD08010u, "ACT3Q1_OnBossKilledDropJadeFigurine_6FD08010_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "killer_done_noop" : "active_sets_j34_null_game_assert2503",
                 &c, ts, 2, 0u, (k == 2) ? 1 : 0);
  }

  /* [B2-10] 0x6FCDBF30 ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c (ecx=pQuestArg, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 52u, (k == 0) ? 1u : 0u, 5000u, 5000u, 225u);
    if (k == 2) {
      U32(STAGE_GAME + 0xC8u) = STAGE_ACT0;
      stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
      for (uint32_t s = 0; s < 5u; s++) U8(STAGE_QUESTEX0 + 0x0Cu + s) = 1u;
      U32(STAGE_QUESTEX0 + 0x48u) = 3u;
      U8(STAGE_QUESTEX0 + 0x01u)  = 0u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x10u) = 10u;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCDBF30u, "ACT4Q3_OnDiabloSealOperate_6FCDBF30_113c", k,
                 k == 0 ? "already_mode1_ret0" : k == 1 ? "no_quest_mode1_ev1" : "all5_seals_killed3_appends_timer",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-11] 0x6FCD93B0 ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 105u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 105u);
    uint32_t ppNear = (uint32_t)(uintptr_t)bump_alloc(0x10u);
    U32(ppNear + 0x00u) = STAGE_ROOM0;
    U32(ppNear + 0x04u) = (k == 2) ? STAGE_ROOM1 : STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u) = ppNear;
    U32(STAGE_ROOM0 + 0x24u) = (k == 2) ? 2u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 226u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, (k >= 2) ? STAGE_ROOM1 : STAGE_ROOM0, 1u, 256u, 20u, 12u, 5002u, 5002u, 227u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x16u, STAGE_QUESTEX0, 0u);
      U32(STAGE_QUESTEX0 + 0x14u) = STAGE_UNIT1;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCD93B0u, "ACT4Q1_CheckPlayerNearIzualAndMarkQuestBits_6FCD93B0_113c", k,
                 k == 0 ? "missing_quest_assert452" : k == 1 ? "same_room_sets_bits" : k == 2 ? "adj_room_sets_bits" : "far_room_no_bits",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }

  /* [B2-12] 0x6FD07640 ACT3Q1_OnQuestItemPickedUp_6FD07640_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 228u);
    uint32_t icls = (k == 1) ? g_item_g34 : g_item_j34;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, icls, 70u, 0u, 5000u, 5000u, 229u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    if (k == 0) U16(STAGE_QBITS0 + 0x20u + 0x14u * 2u) = 1u << 0;
    if (k == 3) U16(STAGE_QBITS0 + 0x20u + 0x14u * 2u) = 1u << 6;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD07640u, "ACT3Q1_OnQuestItemPickedUp_6FD07640_113c", k,
                 k == 0 ? "bit0_done_noop" : k == 1 ? "g34_sets_state3" : k == 2 ? "j34_sets_state1_bit6_snd48" : "j34_bit6_set_skips_snd",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-13] 0x6FD094C0 ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c (ecx=pQuestArg, ret 0, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 94u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 53u, (k == 1) ? 1u : 0u, 5000u, 5000u, 230u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, (k == 3) ? 12u : 10u, 1u, 5002u, 5002u, 231u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA1, 0u);
    stage_quest_node(STAGE_QUEST0, 0x0Fu, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 0u : 1u;
    if (k >= 2) U16(STAGE_QBITS0 + 0x20u + 0x11u * 2u) = 1u << 0;
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FD094C0u, "ACT3Q4_OnLamEsensTomeStandOperate_6FD094C0_113c", k,
                 k == 0 ? "inactive_ret0" : k == 1 ? "already_mode1_ret0" : k == 2 ? "bit0_done_snd13_g10" : "bit0_done_snd13_g12",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-14] 0x6FD03850 ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 83u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 232u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    if (k == 0) {
      U16(STAGE_QBITS0 + 0x20u + 0x12u * 2u) = 1u << 0;
      U16(STAGE_QBITS0 + 0x20u + 0x15u * 2u) = 1u << 0;
    } else if (k == 1) {
      U16(STAGE_QBITS0 + 0x20u + 0x11u * 2u) = 1u << 0;
      U16(STAGE_QBITS0 + 0x20u + 0x15u * 2u) = 1u << 2;
    } else if (k == 2) {
      U16(STAGE_QBITS0 + 0x20u + 0x15u * 2u) = (1u << 2) | (1u << 3);
    } else {
      U16(STAGE_QBITS0 + 0x20u + 0x11u * 2u) = 1u << 0;
      U16(STAGE_QBITS0 + 0x20u + 0x15u * 2u) = 1u << 3;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD03850u, "ACT3Q5_SyncTravincalQuestStateFromPlayer_6FD03850_113c", k,
                 k == 0 ? "q12_q15_done_deactivates" : k == 1 ? "q11_bit2_sets_2_2" : k == 2 ? "no_q11_bit2_bit3_sets_3_5" : "q11_bit3_sets_3_4",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-15] 0x6FCDABF0 ACT4Q1_OnIzualKilled_6FCDABF0_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 105u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 256u, 20u, 12u, 5010u, 5020u, 233u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 234u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA1, 0u);
    stage_quest_node(STAGE_QUEST0, 0x16u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x19u;
    U8(STAGE_QUEST0 + 0x09u)  = (k == 0) ? 0u : 1u;
    U8(STAGE_QUESTEX0 + 0x0Du) = (k == 1) ? 1u : 0u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x0Cu) = (k == 1) ? STAGE_UNIT1 : 0u;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCDABF0u, "ACT4Q1_OnIzualKilled_6FCDABF0_113c", k,
                 k == 0 ? "inactive_appends_timer" : k == 1 ? "active_killer_sets_bits_pos" : "active_no_killer_appends_timer",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-16] 0x6FD057D0 ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c (ecx=pGame, edx=pQuestData, ret 0, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 100u, 25u, 1u, 5000u, 5000u, 235u);
    stage_quest_node(STAGE_QUEST0, 0x15u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x0Cu) = (k == 0) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x0Du) = 1u;
    U32(STAGE_QUESTEX0 + 0x10u) = 25u;
    if (k == 3) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      U32(STAGE_GAME + 0x10F4u) = 0u; /* asserts 507 on null pQuestCtrl */
    }
    uint32_t g = (k == 1) ? 0u : STAGE_GAME;
    c.ecx = g; c.edx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = g; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FD057D0u, "ACT3Q0_OnWandererSeenSpawnFleshBeasts_6FD057D0_113c", k,
                 k == 0 ? "already_seen_ret1" : k == 1 ? "null_game_assert723" : k == 2 ? "wanderer_missing_marks_seen" : "wanderer_found_no_qctrl_assert507",
                 &c, ts, 2, 0xFFFFFFFFu, (k == 1 || k == 3) ? 1 : 0);
  }

  /* [B2-17] 0x6FD09C80 ACT3Q2_OperateGidbinnAltar_6FD09C80_113c (ecx=pOperateArgs, ret 0, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 78u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 54u, (k == 0) ? 1u : 0u, 5000u, 5000u, 236u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5002u, 237u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA1, 0u);
    stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k == 1) ? 0u : 1u;
    if (k == 3) {
      U8(STAGE_QUEST0 + 0x0Cu) = 2u;
      U8(STAGE_QUESTEX0 + 0x05u) = 1u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    U32(STAGE_SCRATCH + 0x10u) = 10u;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FD09C80u, "ACT3Q2_OperateGidbinnAltar_6FD09C80_113c", k,
                 k == 0 ? "already_mode1_ret0" : k == 1 ? "inactive_quest_ret0" : k == 2 ? "state0_activates_appends_timer" : "state2_timer_set_mode1_ev1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-18] 0x6FCE3A80 ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 238u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    U16(STAGE_QBITS0 + 0x20u + 0x0Au * 2u) = (1u << 4) | (1u << 5) | (1u << 6) | ((k == 3) ? (1u << 0) : 0u);
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    if (k == 1) stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_msf, 70u, 0u);
    if (k == 2) stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_hst, 71u, 0u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE3A80u, "ACT2Q2_Callback11_SyncPlayerStaffItems_6FCE3A80_113c", k,
                 k == 0 ? "no_items_clears_456" : k == 1 ? "has_msf_keeps5_clears46" : k == 2 ? "has_hst_keeps_all" : "bit0_done_keeps_all",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-19] 0x6FCE3320 ACT2Q4_Callback11_SyncPlayerQuestState_6FCE3320_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 239u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    if (k == 0) {
      U16(STAGE_QBITS0 + 0x20u + 0x0Cu * 2u) = 1u << 0;
    } else if (k == 1) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_hst, 70u, 0u);
      U16(STAGE_QBITS0 + 0x20u + 0x0Cu * 2u) = 1u << 5;
    } else if (k == 2) {
      U16(STAGE_QBITS0 + 0x20u + 0x0Cu * 2u) = 1u << 3;
    } else {
      U16(STAGE_QBITS0 + 0x20u + 0x0Bu * 2u) = 1u << 0;
      U16(STAGE_QBITS0 + 0x20u + 0x0Cu * 2u) = 1u << 2;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE3320u, "ACT2Q4_Callback11_SyncPlayerQuestState_6FCE3320_113c", k,
                 k == 0 ? "bit0_sets_global_0d" : k == 1 ? "hst_bit5_sets_4_4" : k == 2 ? "bit3_sets_3_3" : "q0b_bit2_sets_2_2",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-20] 0x6FCE7540 ACT2Q1_OnRadamentKilled_6FCE7540_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 49u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 229u, 20u, 12u, 5000u, 5000u, 240u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x08u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 9u;
    U8(STAGE_QUEST0 + 0x09u)  = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x08u) = (k == 3) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    U8(STAGE_QUESTEX0 + 0x0Au)   = (k == 2) ? 1u : 0u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE7540u, "ACT2Q1_OnRadamentKilled_6FCE7540_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "active_sets_state4_timer" : k == 2 ? "active_timer_already_set" : "no_global_flags_assert2080",
                 &c, ts, 2, 0u, (k == 3) ? 1 : 0);
  }

  /* [B2-21] 0x6FD03B40 ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 241u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u)   = 1u;
    U8(STAGE_QUESTEX0 + 0x01u) = 1u;
    U8(STAGE_QUESTEX0 + 0x0Cu) = 1u;
    if (k == 0) {
      U16(STAGE_QBITS0 + 0x20u + 0x14u * 2u) = 1u << 0;
    } else if (k == 1) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_g34, 70u, 0u);
      U16(STAGE_QBITS0 + 0x20u + 0x14u * 2u) = 1u << 4;
    } else if (k == 2) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_j34, 71u, 0u);
      U16(STAGE_QBITS0 + 0x20u + 0x14u * 2u) = 1u << 2;
    } else {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_j34, 72u, 0u);
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD03B40u, "ACT3Q1_SyncGoldenBirdQuestStateFromPlayer_6FD03B40_113c", k,
                 k == 0 ? "bit0_deactivates" : k == 1 ? "g34_bit4_sets_3_4" : k == 2 ? "j34_bit2_sets_2_2" : "j34_nobit2_sets_1_1",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-22] 0x6FCE6240 ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c (ecx=pOpParam, ret 0, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 66u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 55u, (k == 2) ? 1u : 0u, 5000u, 5000u, 242u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5002u, 243u);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT0, 1u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    if (k == 1) {
      stage_inv_item(STAGE_UNIT1, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_hst, 70u, 0u);
    } else if (k == 2) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      U8(STAGE_UNIT1 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT1 + 0x68u) = 2u;
      U32(STAGE_UNIT1 + 0x64u) = 55u;
    } else if (k == 3) {
      attach_cursor_item(STAGE_UNIT1, g_item_ring, 71u); /* busy */
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCE6240u, "ACT2Q6_OperateHoradricOrificeObject_6FCE6240_113c", k,
                 k == 0 ? "mode0_no_hst_snd13_ret1" : k == 1 ? "mode0_has_hst_mode1_pkt58_ret0" : k == 2 ? "mode1_prev_match_clears_mode2" : "mode0_busy_ret1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-23] 0x6FD06000 ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 244u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    if (k == 0) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_g33, 70u, 0u);
      U16(STAGE_QBITS0 + 0x20u + 0x13u * 2u) = 1u << 0;
    } else if (k == 1) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_g33, 71u, 0u);
    } else if (k == 2) {
      U16(STAGE_QBITS0 + 0x20u + 0x13u * 2u) = (1u << 6) | (1u << 7) | (1u << 8);
    } else {
      U16(STAGE_QBITS0 + 0x20u + 0x13u * 2u) = (1u << 5) | (1u << 3);
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD06000u, "ACT3Q2_InitPlayerGidbinnQuestState_6FD06000_113c", k,
                 k == 0 ? "g33_bit0_inc1c_set2c" : k == 1 ? "g33_active_sets_4_4" : k == 2 ? "bits678_completes_deactivates" : "bits53_sets_2_2",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-24] 0x6FD08310 ACT3Q5_InitCouncilBossPreset_6FD08310_113c (ecx=pObjInitStrc, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 83u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0x129u, 26u, 1u, 5000u, 5000u, 245u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTCTRL + 0x08u) = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    if (k == 1) {
      U16(STAGE_QBITS1 + 0x20u + 0x16u * 2u) = 1u << 0x0Du;
    } else if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x20u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x2Cu) = 26u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    } else if (k == 3) {
      U8(STAGE_QUESTEX0 + 0x20u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x2Cu) = 99u; /* missing, room=0 -> clears +0x20=0 */
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x08u) = (k == 3) ? 0u : STAGE_ROOM0;
    U32(STAGE_SCRATCH + 0x14u) = 5000u;
    U32(STAGE_SCRATCH + 0x18u) = 5000u;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FD08310u, "ACT3Q5_InitCouncilBossPreset_6FD08310_113c", k,
                 k == 0 ? "no_global_assert2092" : k == 1 ? "bit0d_done_noop" : k == 2 ? "already_spawned_noop" : "spawn_fail_clears_flag20",
                 &c, ts, 1, 0u, (k == 0) ? 1 : 0);
  }

  /* [B2-25] 0x6FCE41D0 ACT2Q1_Callback_PlayerEnterSyncRadamentQuestState_6FCE41D0_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 246u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x08u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = 2u;
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    if (k == 0) {
      U16(STAGE_QBITS0 + 0x20u + 9u * 2u) = (1u << 0) | (1u << 5);
    } else if (k == 1) {
      U16(STAGE_QBITS0 + 0x20u + 9u * 2u) = (1u << 0x0Fu) | (1u << 1);
    } else if (k == 2) {
      U16(STAGE_QBITS0 + 0x20u + 9u * 2u) = 1u << 4;
    } else {
      U16(STAGE_QBITS0 + 0x20u + 9u * 2u) = 1u << 2;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE41D0u, "ACT2Q1_Callback_PlayerEnterSyncRadamentQuestState_6FCE41D0_113c", k,
                 k == 0 ? "bits05_no_ass_clears_global0d" : k == 1 ? "bits0f1_sets_ex10_deactivates" : k == 2 ? "bit4_sets_2_3" : "bit2_sets_1_2",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-26] 0x6FD073C0 ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c (eax=pGame, ecx=pUnit, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 83u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 247u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U32(STAGE_QUESTCTRL + 0x08u) = (k == 3) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    if (k == 0) {
      U32(STAGE_QUESTEX0 + 0x30u) = 6u; /* full */
    } else if (k == 1) {
      U8(STAGE_QUEST0 + 0x0Cu) = 0u;
      U16(STAGE_QBITS1 + 0x20u + 0x11u * 2u) = 1u << 0x0Du;
    } else if (k == 2) {
      U32(STAGE_QUESTEX0 + 0x10u) = 99u;
      U32(STAGE_QUESTEX0 + 0x30u) = 1u;
      U8(STAGE_QUEST0 + 0x0Cu)    = 2u;
    }
    c.eax = STAGE_GAME; c.ecx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FD073C0u, "ACT3Q5_OnKhalimWillSmashedCompellingOrb_6FD073C0_113c", k,
                 k == 0 ? "count6_sets_flag5" : k == 1 ? "q11_0d_appends_guid_state4" : k == 2 ? "no_q11_appends_idx1_state5" : "no_global_assert2092",
                 &c, ts, 2, 0u, (k == 3) ? 1 : 0);
  }

  /* [B2-27] 0x6FD03120 ACT3Q7_SyncMephistoQuestStateFromPlayer_6FD03120_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 248u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x15u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    if (k == 0) U16(STAGE_QBITS0 + 0x20u + 0x16u * 2u) = 1u << 0;
    if (k == 1) U16(STAGE_QBITS0 + 0x20u + 0x16u * 2u) = 1u << 9;
    if (k == 2) U16(STAGE_QBITS0 + 0x20u + 0x16u * 2u) = 1u << 5;
    if (k == 3) U16(STAGE_QBITS0 + 0x20u + 0x16u * 2u) = 1u << 2;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD03120u, "ACT3Q7_SyncMephistoQuestStateFromPlayer_6FD03120_113c", k,
                 k == 0 ? "bit0_global0d_ex0c2" : k == 1 ? "bit9_sets_5_4" : k == 2 ? "bit5_sets_4_3" : "bit2_sets_3_2",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-28] 0x6FCDBDC0 ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c (ecx=pGame, edx=pQuest, ret 0, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    if (k == 0) {
      U8(STAGE_QUESTEX0 + 0x02u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x18u) = 5u;
    } else if (k == 1) {
      U8(STAGE_QUESTEX0 + 0x02u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x18u) = 9u;
      U8(STAGE_QUESTEX0 + 0x06u)  = 1u;
      U32(STAGE_QUEST0 + 0x04u)   = 0u; /* assert 723 */
    } else if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x02u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x18u) = 9u;
      U8(STAGE_QUESTEX0 + 0x06u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x08u) = 77u; /* missing object */
    } else {
      U8(STAGE_QUESTEX0 + 0x02u)  = 0u;
      U8(STAGE_QUESTEX0 + 0x03u)  = 0u; /* ret 1 */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FCDBDC0u, "ACT4Q3_TimerCallback_CheckDiabloSpawnAndEndgame_6FCDBDC0_113c", k,
                 k == 0 ? "ticks5_inc6_ret0" : k == 1 ? "ticks9_null_game_assert723" : k == 2 ? "ticks9_missing_seal_ret0" : "inactive_ret1",
                 &c, ts, 2, 0x000000FFu, (k == 1) ? 1 : 0);
  }

  /* [B2-29] 0x6FD045B0 ACT3Q2_GidbinnStatusFilter_6FD045B0_113c (ecx=pQuestData, edx=pPlayer, s0=pGlobal, s1=pCur, s2=pOut, ret 12, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 249u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
    if (k >= 1) U16(STAGE_QBITS0 + 0x20u + 0x0Fu * 2u) = 1u << 0;
    if (k == 1) U16(STAGE_QBITS0 + 0x20u + 0x13u * 2u) = (1u << 0) | (1u << 0x0Du);
    if (k == 2) { U8(STAGE_QUESTEX0 + 0x20u) = 1u; U8(STAGE_GAME + 0x6Au) = 3u; }
    if (k == 3) { U16(STAGE_QBITS0 + 0x20u + 0x13u * 2u) = 1u << 4; U8(STAGE_QUESTEX0 + 0x00u) = 1u; }
    U8(STAGE_SCRATCH) = 0xAAu;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0; c.nargs = 3;
    c.args[0] = STAGE_QBITS1; c.args[1] = STAGE_QBITS0; c.args[2] = STAGE_SCRATCH; c.calleePop = 12u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0; ts[2] = STAGE_QBITS1; ts[3] = STAGE_QBITS0; ts[4] = STAGE_SCRATCH;
    run_and_emit(0x6FD045B0u, "ACT3Q2_GidbinnStatusFilter_6FD045B0_113c", k,
                 k == 0 ? "q0f_unset_out0" : k == 1 ? "done_bit0d_out0d" : k == 2 ? "ex20_g6a3_out8" : "bit4_ex0_out3",
                 &c, ts, 5, 0xFFu, 0);
  }

  /* [B2-30] 0x6FD06E00 ACT3Q4_StatusFilter_6FD06E00_113c (ecx=pQuest, edx=pPlayer, s0=pGlobal, s1=pCur, s2=pOut, ret 12, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 250u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x0Fu, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    if (k >= 1) U16(STAGE_QBITS0 + 0x20u + 0x0Fu * 2u) = 1u << 0;
    if (k == 1) U16(STAGE_QBITS0 + 0x20u + 0x11u * 2u) = 1u << 0;
    if (k == 2) { U8(STAGE_QUEST0 + 0x0Cu) = 2u; U8(STAGE_QUESTEX0 + 0x02u) = 1u; U8(STAGE_GAME + 0x6Au) = 3u; }
    if (k == 3) { U8(STAGE_QUEST0 + 0x0Cu) = 5u; U32(STAGE_QUESTEX0 + 0x08u) = 1u; }
    U8(STAGE_SCRATCH) = 0xAAu;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0; c.nargs = 3;
    c.args[0] = STAGE_QBITS1; c.args[1] = STAGE_QBITS0; c.args[2] = STAGE_SCRATCH; c.calleePop = 12u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0; ts[2] = STAGE_QBITS1; ts[3] = STAGE_QBITS0; ts[4] = STAGE_SCRATCH;
    run_and_emit(0x6FD06E00u, "ACT3Q4_StatusFilter_6FD06E00_113c", k,
                 k == 0 ? "q0f_unset_out0" : k == 1 ? "done_no0d_out0b" : k == 2 ? "seq2_ex02_out8" : "seq5_act3_ex08_out1",
                 &c, ts, 5, 0xFFu, 0);
  }

  /* [B2-31] 0x6FD0A730 QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c (s0..s5, ret 24, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 83u);
    link_room_units(STAGE_ROOM0, 0u, 0u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 55u, 0u, 5000u, 5000u, 251u);
    uint32_t mn = (k == 1) ? 20u : 10u;
    uint32_t mx = (k == 0) ? 0u : (k == 1) ? 10u : 30u;
    c.nargs = 6;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = 15u; c.args[3] = mn; c.args[4] = mx; c.args[5] = 0u;
    c.calleePop = 24u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 15; ts[3] = (int64_t)mn; ts[4] = (int64_t)mx; ts[5] = 0;
    run_and_emit(0x6FD0A730u, "QUESTS_CorruptNearbyMonstersWithUMod21_6FD0A730_113c", k,
                 k == 0 ? "max0_assert32" : k == 1 ? "max_le_min_assert33" : "empty_room_scan_clean",
                 &c, ts, 6, 0u, (k < 2) ? 1 : 0);
  }

  /* [B2-32] 0x6FCDC2C0 ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    uint32_t vcls = (k >= 2) ? 0xF3u : 0x100u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, vcls, 20u, 12u, 5000u, 5000u, 252u);
    stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    if (k == 0) {
      U32(STAGE_QUESTEX0 + 0x48u) = 1u;
    } else if (k == 1) {
      U32(STAGE_GAME + 0xC8u) = STAGE_ACT0;
      U32(STAGE_QUESTEX0 + 0x48u) = 2u;
      for (uint32_t s = 0; s < 5u; s++) U8(STAGE_QUESTEX0 + 0x0Cu + s) = 1u;
    } else if (k == 2) {
      U32(STAGE_GAME + 0x70u) = 0u; /* classic */
      U8(STAGE_QUEST0 + 0x09u) = 0u;
    } else {
      U32(STAGE_GAME + 0x70u) = 1u;
      U8(STAGE_QUEST0 + 0x09u) = 1u;
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x0Cu) = 0u;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCDC2C0u, "ACT4Q3_OnSealBossOrDiabloKilled_6FCDC2C0_113c", k,
                 k == 0 ? "seal_boss_inc_to2" : k == 1 ? "seal_boss_3rd_appends_timer" : k == 2 ? "diablo_classic_sets_flag0d" : "diablo_exp_active_sets_bQ0d",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-33] 0x6FCE97D0 ACT2Q6_OnDurielKilled_6FCE97D0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 73u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 211u, 20u, 12u, 5000u, 5000u, 253u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5002u, 254u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 2u, 10u, 56u, 0u, 5004u, 5004u, 255u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA1, 0u);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT0, 1u, 0u);
    U16(STAGE_CLIENT0 + 0x17Au) = 0xFFFFu;
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k == 1) ? 1u : 0u;
    if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x05u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x2Cu) = 56u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    U32(STAGE_QUESTARG + 0x0Cu) = (k == 1) ? STAGE_UNIT1 : 0u;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE97D0u, "ACT2Q6_OnDurielKilled_6FCE97D0_113c", k,
                 k == 0 ? "inactive_records_room_flag8" : k == 1 ? "active_killer_sets_bit5_timer" : "inactive_opens_linked_obj",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-34] 0x6FD087E0 ACT3Q3_CleanupKhalimItemsOnEnterAct2OrComplete_6FD087E0_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 1u : 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 256u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    if (k == 0) U16(STAGE_QBITS0 + 0x20u + 0x15u * 2u) = 1u << 4;
    if (k == 3) U16(STAGE_QBITS0 + 0x20u + 0x12u * 2u) = 1u << 0;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD087E0u, "ACT3Q3_CleanupKhalimItemsOnEnterAct2OrComplete_6FD087E0_113c", k,
                 k == 0 ? "act3_q15bit4_sets_q12_q15" : k == 1 ? "act3_sets_q12_only" : k == 2 ? "act1_noop" : "q12_already_done_noop",
                 &c, ts, 3, 0u, 0);
  }

  /* [B2-35] 0x6FCDB6A0 ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c (esi=pForgeUnit, s0=pQuestData, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 107u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 57u, 3u, 5000u, 5000u, 257u);
    stage_quest_node(STAGE_QUEST0, 0x18u, STAGE_QUESTEX0, 0u);
    if (k == 0) {
      U8(STAGE_QUESTEX0 + 0x04u) = 1u; /* mode 4, then +0x03==0 returns */
    } else if (k == 1) {
      U8(STAGE_QUESTEX0 + 0x03u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x14u) = 1u;
      U32(STAGE_QUESTEX0 + 0x08u) = 1u;
      U32(STAGE_GAME + 0x10F4u)   = 0u; /* asserts 507 on null pQuestChain */
    } else {
      U8(STAGE_QUESTEX0 + 0x04u)  = 1u;
      U8(STAGE_QUESTEX0 + 0x03u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x14u) = 1u;
      U32(STAGE_QUESTEX0 + 0x08u) = 99u; /* wave out of range -> returns after mode=4 */
    }
    c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FCDB6A0u, "ACT4Q2_ProcessHellforgeSmashRewardWave_6FCDB6A0_113c", k,
                 k == 0 ? "flag4_sets_mode4" : k == 1 ? "wave1_no_qchain_assert507" : "wave99_mode4_oob_ret",
                 &c, ts, 2, 0u, (k == 1) ? 1 : 0);
  }

  /* [B2-36] 0x6FCE9CB0 ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c (eax=pPlayer, s0=pGame, s1=pOrifice, ret 8, void; TS: pGame, pPlayer) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 66u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 258u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, (k == 2) ? 0u : STAGE_ROOM0, 2u, 10u, 58u, 0u, 5000u, 5000u, 259u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    if (k == 1) {
      U8(STAGE_GAME + 0x6Du) = 1u;
      stage_qbits(STAGE_QBITS1, STAGE_UDATA0, 1u);
    }
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    U16(STAGE_CLIENT0 + 0x17Au) = 0xFFFFu;
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x03u) = 1u; /* avoid buggy /25 vs /20 timer delay branch (k2-w15b1-113c.ts:2417) */
    U32(STAGE_QUESTEX0 + 0x18u) = 58u;
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    c.eax = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCE9CB0u, "ACT2Q2_OnHoradricStaffOrificeActivate_6FCE9CB0_113c", k,
                 k == 0 ? "diff0_toggles_portal_flag" : k == 1 ? "diff1_sets_nm_qbits" : "orifice_null_room_assert1670",
                 &c, ts, 2, 0u, (k == 2) ? 1 : 0);
  }

  /* [B2-37] 0x6FD07DB0 ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 83u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, (k == 0) ? 0x16Eu : 0x100u, 27u, 12u, 5000u, 5000u, 260u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    U8(STAGE_QUESTEX0 + 0x0Du) = 1u;
    U8(STAGE_QUESTEX0 + 0x0Eu) = 1u;
    U32(STAGE_QUESTEX0 + 0x34u) = (k == 1) ? 3u : 1u;
    U8(STAGE_QUESTEX0 + 0x0Cu) = (k == 2) ? 1u : 0u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD07DB0u, "ACT3Q5_OnCouncilMemberKilled_6FD07DB0_113c", k,
                 k == 0 ? "cid16e_sets_flag20000" : k == 1 ? "rem3_dec_to2" : k == 2 ? "rem1_ex0c1_sets_state7" : "rem1_ex0c0_sets_state6",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-38] 0x6FD0A140 ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c (ecx=pOpArg, ret 0, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 83u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 59u, (k == 0) ? 1u : 0u, 5000u, 5000u, 261u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5002u, 262u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    if (k >= 2) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_qf2, 70u, 1u, 0u, 0u, 263u);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT2, 4);
      U32(STAGE_QUESTEX0 + 0x38u) = (k == 3) ? 0xFFFFFFFEu : 0u; /* hits < 2 -> increments cleanly */
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FD0A140u, "ACT3Q5_OnCompellingOrbOperate_6FD0A140_113c", k,
                 k == 0 ? "already_mode1_ret0" : k == 1 ? "no_weapon_snd13" : k == 2 ? "qf2_hit0_to1" : "qf2_hit_neg2_to_neg1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-39] 0x6FD09A10 ACT3Q7_OnMephistoKilled_6FD09A10_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 102u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 242u, 20u, 12u, 5000u, 5000u, 264u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 10u, 60u, 0u, 5005u, 5005u, 265u);
    stage_qbits(STAGE_QBITS1, 0u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x15u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k == 1) ? 1u : 0u;
    U32(STAGE_QUESTCTRL + 0x08u) = (k == 3) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x01u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x04u) = 60u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD09A10u, "ACT3Q7_OnMephistoKilled_6FD09A10_113c", k,
                 k == 0 ? "inactive_global0d_mss_flag0b" : k == 1 ? "active_appends_timer" : k == 2 ? "inactive_opens_bridge_obj" : "no_global_assert2080",
                 &c, ts, 2, 0u, (k == 3) ? 1 : 0);
  }

  /* [B2-40] 0x6FCE94E0 A5Q4_OpenTemplePortalObject_6FCE94E0_113c (ecx=pGame, edx=pQuestArg, ret 0, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 66u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 61u, 0u, 5000u, 5000u, 266u);
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x03u) = 1u;
    if (k >= 1) {
      U8(STAGE_QUESTEX0 + 0x0Du)  = 1u;
      U8(STAGE_QUESTEX0 + 0x06u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x28u) = 61u;
      if (k == 2) U8(STAGE_QUESTEX0 + 0x0Cu) = 1u;
      if (k != 3) insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    uint32_t g = (k == 3) ? 0u : STAGE_GAME;
    c.ecx = g; c.edx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = g; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FCE94E0u, "A5Q4_OpenTemplePortalObject_6FCE94E0_113c", k,
                 k == 0 ? "flag0d_0_clears_03_ret1" : k == 1 ? "obj_mode1_ev1_ret1" : k == 2 ? "flag0c_mode2_ret1" : "null_game_assert723",
                 &c, ts, 2, 0xFFFFFFFFu, (k == 3) ? 1 : 0);
  }

  /* [B2-41] 0x6FD06190 ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 267u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    U16(STAGE_QBITS0 + 0x20u + 0x0Fu * 2u) = 1u << 0;
    uint32_t icls = (k == 0) ? g_item_qf2 : (k == 1) ? g_item_qf1 : (k == 2) ? g_item_qey : g_item_qbr;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, icls, 70u, 0u, 5000u, 5000u, 268u);
    stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Bu) = 2u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD06190u, "ACT3Q3_OnKhalimRelicPickedUp_6FD06190_113c", k,
                 k == 0 ? "qf2_sets_bQ7" : k == 1 ? "qf1_sends_pkt5d_sub1" : k == 2 ? "qey_sends_pkt5d_sub2" : "qbr_sends_pkt5d_sub4",
                 &c, ts, 2, 0u, 0);
  }

  /* [B2-42] 0x6FCDB8D0 ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c (ecx=pQuestArg, ret 0, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 107u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 62u, (k >= 2) ? 2u : 0u, 5000u, 5000u, 269u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5002u, 270u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA1, 0u);
    stage_quest_node(STAGE_QUEST0, 0x18u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    if (k == 0) {
      U16(STAGE_QBITS0 + 0x20u + 0x1Bu * 2u) = 1u << 0;
    } else if (k >= 2) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
      U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_hfh, 70u, 1u, 0u, 0u, 271u);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT2, 4);
      U32(STAGE_QUESTEX0 + 0x0Cu) = (k == 3) ? 1u : 0u;
    }
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_UNIT1;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCDB8D0u, "ACT4Q2_OnHellforgeObjectOperate_6FCDB8D0_113c", k,
                 k == 0 ? "bit0_done_snd13" : k == 1 ? "mode0_no_mss_snd13_state1" : k == 2 ? "mode2_hfh_hit0_to1" : "mode2_hfh_hit1_to2",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }
}

/* ========================================================================= */
/* Batch 3: 17 Clean Skills Hi-VAs (0x6FCC0000..0x6FD142D0)                  */
/* ========================================================================= */
static void emit_batch3_vas(void) {
  X86CallSpec c;
  int64_t ts[8];

  /* [B3-1] 0x6FCD5FB0 SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, (k == 3) ? 68u : 1u, 20u, 1u, 5000u, 5000u, 301u);
    U32(STAGE_UDATA0 + 0x28u) = STAGE_AIGEN0;
    if (k >= 2) stage_used_skill(STAGE_UNIT0, 293u, 1u, 0u, 0u, 0u, 0u, 0u);
    uint32_t sid = (k == 0) ? 0xFFFFFFFFu : 293u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)sid; ts[3] = 1;
    run_and_emit(0x6FCD5FB0u, "SKILLS_SrvSt61_PrepareSubmergedSummonParams_6FCD5FB0_113c", k,
                 k == 0 ? "invalid_sid_ret0" : k == 1 ? "no_used_skill_ret0" : k == 2 ? "no_spawn_id_ret0" : "maggot_sets_params_coll_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-2] 0x6FCD4410 SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u); /* town */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 302u);
    U32(STAGE_UDATA0 + 0x28u) = STAGE_AIGEN0;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 21u, 1u, 5002u, 5002u, 303u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) {
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    } else if (k == 3) {
      U16(STAGE_PATH0 + 0x10u) = 55u;
      U16(STAGE_PATH0 + 0x12u) = 2u; /* obj guid lookup -> missing ret 0 */
    }
    uint32_t sid = (k == 0) ? 999u : (k == 1) ? 0u : 70u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)sid; ts[3] = 1;
    run_and_emit(0x6FCD4410u, "SKILLS_SrvDo_SummonFallenShamanPack_6FCD4410_113c", k,
                 k == 0 ? "invalid_sid_ret0" : k == 1 ? "no_summon_ret0" : k == 2 ? "target_in_town_ret0" : "missing_obj_guid_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-3] 0x6FCD3D60 SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u + (uint32_t)k, 1u, 5000u, 5000u, 304u);
    if (k == 2) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      stage_path_target(STAGE_PATH0, STAGE_UNIT0); /* self-target skipped cleanly */
      U32(STAGE_UNIT0 + 0xC4u) = 0u;
    }
    uint32_t sid = (k == 0) ? 0xFFFFFFFFu : 38u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)sid; ts[3] = 1;
    run_and_emit(0x6FCD3D60u, "SKILLS_DoElemMeleeHitAndSetSkillIcon_6FCD3D60_113c", k,
                 k == 0 ? "invalid_sid_ret0" : k == 1 ? "no_target_sets_flag40_ret1" : "self_target_sets_flag40_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-4] 0x6FCD49F0 SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 305u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5006u, 5004u, 306u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 2) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    uint32_t sid = (k == 0) ? 0xFFFFFFFFu : (k == 3) ? 308u : 232u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)sid; ts[3] = 1;
    run_and_emit(0x6FCD49F0u, "SKILLS_SrvDo120_LaunchSkillOrWeaponMissile_6FCD49F0_113c", k,
                 k == 0 ? "invalid_sid_ret0" : k == 1 ? "no_target_ret0" : k == 2 ? "no_srvmissile_sets_flag40_ret0" : "sid308_fires_missile_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-5] 0x6FCD4870 SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c (esi=pUnit, s0=pGame, ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 0u, 0u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, (k == 0) ? 0u : STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, (k == 3) ? 8u : 5u, 6u, 307u);
    if (k >= 2) {
      U32(STAGE_PATH0 + 0x34u) = 0x08u;
      U8(STAGE_PATH0 + 0x65u)  = 4u; /* dx=0, dy=-2 -> spawnY=4, targetY=0 (avoids path.ts:2586 bug) */
      stage_used_skill(STAGE_UNIT0, 173u, (k == 3) ? 5u : 3u, 0u, 0u, 0u, 0u, 0u);
    }
    c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCD4870u, "SKILLS_FireDirectionalMissile143ForSkill173_6FCD4870_113c", k,
                 k == 0 ? "null_path_ret0" : k == 1 ? "flag08_clear_ret0" : k == 2 ? "flag08_lvl3_fires_missile143" : "flag08_lvl5_fires_missile143",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-6] 0x6FCD42D0 SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    if (k == 3) {
      uint32_t pMap = U32(U32(STAGE_ROOM0 + 0x20u) + 0x20u);
      memset((void *)(uintptr_t)pMap, 0xFF, 30u * 30u * 2u); /* solid wall -> spawn returns 0 cleanly */
    }
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, (k >= 2) ? 68u : 1u, 20u, 1u, 5000u, 5000u, 309u);
    U32(STAGE_UDATA0 + 0x28u) = STAGE_AIGEN0;
    U8(STAGE_UNIT0 + 0x4Eu) = 5u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5004u, 5002u, 310u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 3) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    uint32_t sid = (k == 0) ? 0xFFFFFFFFu : 330u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)sid; ts[3] = 1;
    run_and_emit(0x6FCD42D0u, "SKILLS_SrvDo129_SpawnSummonTowardsTarget_6FCD42D0_113c", k,
                 k == 0 ? "invalid_sid_ret0" : k == 1 ? "no_spawn_id_ret0" : k == 2 ? "no_target_ret0" : "blocked_spawn_clears_4e_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-8] 0x6FCD5E50 SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 68u, 20u, 1u, 5000u, 5000u, 311u);
    if (k == 2) {
      stage_used_skill(STAGE_UNIT0, 318u, 1u, 0u, 190u, 0u, 0u, 8u);
    } else if (k == 3) {
      uint32_t pMap = U32(U32(STAGE_ROOM0 + 0x20u) + 0x20u);
      memset((void *)(uintptr_t)pMap, 0xFF, 30u * 30u * 2u);
      stage_used_skill(STAGE_UNIT0, 318u, 1u, 0u, 190u, 5000u, 5000u, 8u);
    }
    uint32_t sid = (k == 0) ? 0xFFFFFFFFu : 318u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)sid; ts[3] = 1;
    run_and_emit(0x6FCD5E50u, "SKILLS_SrvDo139_EmergeSubmergedSummon_6FCD5E50_113c", k,
                 k == 0 ? "invalid_sid_ret0" : k == 1 ? "no_used_skill_ret0" : k == 2 ? "zero_coords_refreshes_ai_ret0" : "clears_coll100_blocked_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-9] 0x6FCD52A0 SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 312u);
    uint32_t sid = (k == 0) ? 0xFFFFFFFFu : (k == 1) ? 302u : 38u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)sid; ts[3] = 1;
    run_and_emit(0x6FCD52A0u, "SKILLS_SrvDo135_SpawnPerimeterRingProjectiles_6FCD52A0_113c", k,
                 k == 0 ? "invalid_sid_ret0" : k == 1 ? "no_srvmissile_ret0" : "sid38_spawns_ring_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-10] 0x6FCD5110 SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 313u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5005u, 5003u, 314u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) {
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    } else if (k == 3) {
      U16(STAGE_PATH0 + 0x10u) = 5004u;
      U16(STAGE_PATH0 + 0x12u) = 5006u;
    }
    uint32_t sid = (k == 0) ? 0xFFFFFFFFu : (k == 1) ? 301u : 308u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)sid; ts[3] = 1;
    run_and_emit(0x6FCD5110u, "SKILLS_SrvDo134_FireProjectileTowardsTargetOrPath_6FCD5110_113c", k,
                 k == 0 ? "invalid_sid_ret0" : k == 1 ? "no_srvmissile_ret0" : k == 2 ? "towards_target_ret1" : "towards_path_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-11] 0x6FCCDFA0 SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0_113c (ecx=pGame, edx=pUnit, s0=nSpellId, s1=0, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 315u);
    if (k == 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    } else if (k == 2) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_g33, 70u, 0u);
    } else if (k == 3) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, 518u, 71u, 0u);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 220u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 220; ts[3] = 0;
    run_and_emit(0x6FCCDFA0u, "SKILLS_SrvDo_FindPotionOrConsumeBook_6FCCDFA0_113c", k,
                 k == 0 ? "null_inv_ret0" : k == 1 ? "empty_inv_ret0" : k == 2 ? "non_book_item_ret0" : "tbk_no_charges_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-12] 0x6FCD5450 SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 316u);
    uint16_t tx = (k == 3) ? 5010u : 5002u;
    uint16_t ty = (k == 3) ? 5002u : 5010u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, tx, ty, 317u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 3) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    uint32_t sid = (k == 0) ? 0xFFFFFFFFu : (k == 1) ? 0u : 308u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)sid; ts[3] = 1;
    run_and_emit(0x6FCD5450u, "SKILLS_SrvDo136_FireSteppedAxisProjectile_6FCD5450_113c", k,
                 k == 0 ? "invalid_sid_ret0" : k == 1 ? "no_srvmissile_ret0" : k == 2 ? "no_target_sets_flag40_ret0" : k == 3 ? "dx_ge_dy_fires_ret1" : "dx_lt_dy_fires_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-13] 0x6FCD5950 SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    link_room_units(STAGE_ROOM0, 0u, 0u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 312u, 20u, 1u, 5000u, 5000u, 318u);
    U32(STAGE_UNIT0 + 0x24u) = 0x29Au + (uint32_t)k; /* hits all 5 rolls 0..4 mod 5! */
    U16(STAGE_PATH0 + 0x10u) = 5002u;
    U16(STAGE_PATH0 + 0x12u) = 5002u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 302u; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 302; ts[3] = 2;
    run_and_emit(0x6FCD5950u, "SKILLS_SrvDo135_ApplyRandomOblivionKnightCurse_6FCD5950_113c", k,
                 k == 0 ? "roll_branch0" : k == 1 ? "roll_branch1" : k == 2 ? "roll_branch2" : k == 3 ? "roll_branch3" : "roll_branch4",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-14] 0x6FCD6380 SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 319u);
    U32(STAGE_PATH0 + 0x48u) = 1u; /* collision pattern */
    if (k >= 2) {
      stage_used_skill(STAGE_UNIT0, 38u, 1u, 0u, 0u, 0u, 0u, 0u);
      U16(STAGE_PATH0 + 0x10u) = (k == 2) ? 9999u : 5004u;
      U16(STAGE_PATH0 + 0x12u) = (k == 2) ? 9999u : 5006u;
    }
    uint32_t sid = (k == 0) ? 0xFFFFFFFFu : 38u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)sid; ts[3] = 1;
    run_and_emit(0x6FCD6380u, "SKILLS_DoChargeOrSmiteKnockbackStart_6FCD6380_113c", k,
                 k == 0 ? "invalid_sid_ret0" : k == 1 ? "no_used_skill_ret0" : k == 2 ? "oob_dest_sets_p4_ret0" : "valid_dest_sets_coll_params_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-15] 0x6FCD3F10 SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 320u);
    uint32_t sid = (k == 0) ? 0xFFFFFFFFu : (k == 3) ? 132u : 38u;
    if (k >= 2) stage_used_skill(STAGE_UNIT0, sid, 1u, (k == 2) ? 2u : 3u, 0u, 0u, 0u, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = (int32_t)sid; ts[3] = 1;
    run_and_emit(0x6FCD3F10u, "SKILLS_DoImpaleOrRabiesStep_6FCD3F10_113c", k,
                 k == 0 ? "invalid_sid_ret0" : k == 1 ? "no_used_skill_ret0" : k == 2 ? "flag2_sid38_sets_frames_ret1" : "flag3_sid132_sets_frames_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-16] 0x6FCD60C0 SKILLS_SrvDo_MonsterLeapStep_6FCD60C0_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nLevel, ret 8, u32) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 321u);
    U32(STAGE_PATH0 + 0x48u) = 1u;
    if (k == 1) {
      stage_used_skill(STAGE_UNIT0, 0u, 1u, 0u, 0u, 0u, 0u, 0u);
      U8(STAGE_UNIT0 + 0x4Eu) = 2u;
    } else if (k == 2) {
      stage_used_skill(STAGE_UNIT0, 0u, 1u, 0x100u, 5010u, 5010u, 0u, 0u);
    } else if (k == 3) {
      stage_used_skill(STAGE_UNIT0, 0u, 1u, 0x100u, 5000u, 5000u, 0u, 0u);
    } else if (k == 4) {
      stage_used_skill(STAGE_UNIT0, 0u, 1u, 0x05u, 5000u, 5000u, 0u, 0u);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FCD60C0u, "SKILLS_SrvDo_MonsterLeapStep_6FCD60C0_113c", k,
                 k == 0 ? "no_used_skill_ret0" : k == 1 ? "byte4e_2_clears_ret1" : k == 2 ? "flag100_not_arrived_ret1" : k == 3 ? "flag100_arrived_resets_coll_ret1" : "default_clears_flags_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-17] 0x6FD13E30 SKILLS_CanMonsterCastAtTarget113c (eax=y, ecx=pTarget, esi=pCaster, s0=pGame, s1=nSkillId, s2=x, ret 12, u32; TS: y, pTarget, pCaster, nSkillId, x) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 3) ? 1u : 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 322u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5002u, 323u);
    uint32_t sid = (k == 0) ? 0xA7u : (k == 1 || k == 2) ? 0xA4u : (k == 3) ? 0xB8u : 0x00u;
    uint32_t tgt = (k == 2) ? 0u : STAGE_UNIT1;
    c.eax = 5002u; c.ecx = tgt; c.esi = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = sid; c.args[2] = 5002u; c.calleePop = 12u;
    ts[0] = 5002; ts[1] = tgt; ts[2] = STAGE_UNIT0; ts[3] = (int32_t)sid; ts[4] = 5002;
    run_and_emit(0x6FD13E30u, "SKILLS_CanMonsterCastAtTarget113c", k,
                 k == 0 ? "sid_a7_ret0" : k == 1 ? "sid_a4_with_target_ret1" : k == 2 ? "sid_a4_null_target_ret0" : k == 3 ? "sid_b8_in_town_ret0" : "sid_0_default_ret1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }
}

/* ========================================================================= */
/* Batch 4: 39 Net-New Hi-VAs (MonAI / Baal AI / Target Selection / Skills) */
/* ========================================================================= */

#define STAGE_MONSTATS_TMP (STAGE_SCRATCH + 0x400u) /* 0x200: custom D2MonStatsTxt */
#define STAGE_AICTRL0      (STAGE_SCRATCH + 0x600u) /* 0x100: D2AiControlStrc */
#define STAGE_AICMD0       (STAGE_SCRATCH + 0x700u) /* 0x100: D2AiCmdStrc */
#define STAGE_SLOTNODE0    (STAGE_SCRATCH + 0x800u) /* 0x040: hostile player list node */

static void stage_ai_monster(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint16_t x, uint16_t y, uint32_t seedLo,
    uint32_t pAiGen, uint32_t pAiCtrl) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 1u, classId, guid, 1u, x, y, seedLo);
  uint32_t pDT = U32(0x6FDE9E1Cu + g_com_rebase);
  if (classId < U32(pDT + 0xA80u)) {
    U32(pUData + 0x00u) = U32(pDT + 0xA78u) + classId * 0x1A8u;
  }
  U32(pUData + 0x28u) = pAiGen;
  U32(pUData + 0x2Cu) = pAiCtrl;
}

static void stage_ai_param(
    uint32_t pAiParam, uint32_t pAiCtrl, uint32_t pTarget,
    uint32_t dist, uint32_t bInMelee, uint32_t pMonStats) {
  U32(pAiParam + 0x00u) = pAiCtrl;
  U32(pAiParam + 0x08u) = pTarget;
  U32(pAiParam + 0x14u) = dist;
  U32(pAiParam + 0x18u) = bInMelee;
  U32(pAiParam + 0x1Cu) = pMonStats;
}

static void stage_hostile_player(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t classId, uint32_t guid, uint16_t x, uint16_t y, uint32_t maxDmg) {
  if (U32(pRoom + 0x20u) == 0u) {
    stage_room_collision(pRoom, 4990u, 4990u, 30u, 30u);
  }
  stage_unit_common(pUnit, pUData, pPath, pRoom, 0u, classId, guid, 1u, x, y, 401u);
  U32(pUnit + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 7, 100 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 6, 80 << 8, 0);
  fn_SetUnitStat((void *)(uintptr_t)pUnit, 0x16, (int32_t)maxDmg, 0);
  U32(STAGE_SLOTNODE0 + 0x00u) = pUnit;
  U32(STAGE_SLOTNODE0 + 0x04u) = 0u;
  U32(STAGE_SLOTNODE0 + 0x08u) = 0u;
  U32(STAGE_GAME + 0x10F8u)    = STAGE_SLOTNODE0;
}

static void emit_batch4_vas(void) {
  X86CallSpec c;
  int64_t ts[12];

  /* [B4-1] 0x6FCD7750 AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c
   * (esi=pUnit, s0=pGame, s1=pTarget, s2=bAllowCloseAttacks, ret 12, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    U8(STAGE_GAME + 0x6Du) = (k == 0) ? 0u : (k == 1) ? 1u : 2u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 544u, 20u, 5000u, 5000u, 202u + (uint32_t)k * 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5000u, 111u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 1 ? 40 : 90) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, (k == 2 ? 20 : 80) << 8, 0);
    if (k == 3) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT1, 0x0B, 1);
    uint32_t allowClose = (k == 2) ? 0u : 1u;
    c.esi = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.args[2] = allowClose; c.calleePop = 12u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT1; ts[3] = allowClose;
    run_and_emit(0x6FCD7750u, "AIBAAL_ChooseCloseRangeActionWeighted_6FCD7750_113c", k,
                 k == 0 ? "diff0_high_hp_allow" : k == 1 ? "diff1_low_baal_hp" : k == 2 ? "low_target_hp_no_close" : "target_state0b",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-2] 0x6FCD75D0 AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c
   * (eax=pTarget, s0=pGame, s1=pUnit, s2=nNearbyCount, s3=bHasCloneOrTentacle, s4=bTargetChilled, ret 20, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    U8(STAGE_GAME + 0x6Du) = (k == 0) ? 0u : 1u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 544u, 20u, 5000u, 5000u, 303u + (uint32_t)k * 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5012u, 5000u, 112u);
    U32(STAGE_UNIT1 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 2 ? 30 : 85) << 8, 0);
    uint32_t nearby  = (k == 0 || k == 3) ? 1u : 3u;
    uint32_t hasCln  = (k == 1 || k == 3) ? 1u : 0u;
    uint32_t chilled = (k == 2 || k == 3) ? 1u : 0u;
    c.eax = STAGE_UNIT1;
    c.nargs = 5; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = nearby; c.args[3] = hasCln; c.args[4] = chilled; c.calleePop = 20u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = nearby; ts[4] = hasCln; ts[5] = chilled;
    run_and_emit(0x6FCD75D0u, "AIBAAL_ChooseMidRangeActionWeighted_6FCD75D0_113c", k,
                 k == 0 ? "diff0_nearby1" : k == 1 ? "diff1_clone_nearby3" : k == 2 ? "chilled_low_hp" : "clone_and_chilled",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [B4-3] 0x6FCD7380 AIBAAL_ChooseActionWeighted_6FCD7380_113c
   * (eax=pUnit, s0=pGame, s1=pAiState, s2=pTarget, s3=nNearby, s4=bHasClone, s5=bChilled, s6=bCursed, s7=nFrameDelta, ret 32, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    U8(STAGE_GAME + 0x6Du) = (k == 0) ? 0u : (k == 1) ? 1u : 2u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 544u, 20u, 5000u, 5000u, 404u + (uint32_t)k * 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    uint16_t tx = (k == 0) ? 5010u : (k == 1) ? 5030u : 5045u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, tx, 5000u, 113u);
    U32(STAGE_UNIT1 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 2 ? 50 : 95) << 8, 0);
    U32(STAGE_AICTRL0 + 0x18u) = (k == 3) ? 3u : 0u;
    uint32_t nearby = (k == 0) ? 1u : (k == 2) ? 5u : 2u;
    uint32_t hasCln = (k == 1 || k == 3) ? 1u : 0u;
    uint32_t chill  = (k == 2) ? 1u : 0u;
    uint32_t curse  = (k == 3) ? 1u : 0u;
    uint32_t fDelta = (k == 1 || k == 2) ? 80u : 20u;
    c.eax = STAGE_UNIT0;
    c.nargs = 8;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_AICTRL0; c.args[2] = STAGE_UNIT1;
    c.args[3] = nearby; c.args[4] = hasCln; c.args[5] = chill; c.args[6] = curse; c.args[7] = fDelta;
    c.calleePop = 32u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = STAGE_AICTRL0; ts[3] = STAGE_UNIT1;
    ts[4] = nearby; ts[5] = hasCln; ts[6] = chill; ts[7] = curse; ts[8] = fDelta;
    run_and_emit(0x6FCD7380u, "AIBAAL_ChooseActionWeighted_6FCD7380_113c", k,
                 k == 0 ? "diff0_near_low_count" : k == 1 ? "diff1_dist30_clone_delta80" : k == 2 ? "diff2_dist45_many_chilled" : "diff2_cursed_field18_3",
                 &c, ts, 9, 0xFFFFFFFFu, 0);
  }

  /* [B4-4] 0x6FCD79B0 AIBAAL_SelectAction_6FCD79B0_113c
   * (ecx=pUnit, eax=pTarget, s0=pGame, s1=pAiState, s2=nFrameDelta, s3=nNearbyCount, s4=pAnchorStaticPath, ret 20, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 544u, 20u, 5000u, 5000u, 505u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5012u, 5000u, 114u);
    U32(STAGE_UNIT1 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 80 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 80 << 8, 0);
    uint32_t tgt = 0u;
    if (k == 0) {
      U32(STAGE_AICTRL0 + 0x14u) = 7u;
    } else if (k == 1) {
      uint32_t pMap = U32(U32(STAGE_ROOM0 + 0x20u) + 0x20u);
      U16(pMap + (10u * 30u + 10u) * 2u) = 0x0040u;
    } else if (k == 3) {
      tgt = STAGE_UNIT1;
      U32(STAGE_AICMD0 + 0x0Cu) = 5000u;
      U32(STAGE_AICMD0 + 0x10u) = 5000u;
    }
    uint32_t anchor = (k == 3) ? STAGE_AICMD0 : 0u;
    c.ecx = STAGE_UNIT0; c.eax = tgt;
    c.nargs = 5; c.args[0] = STAGE_GAME; c.args[1] = STAGE_AICTRL0; c.args[2] = 30u; c.args[3] = 2u; c.args[4] = anchor;
    c.calleePop = 20u;
    ts[0] = STAGE_UNIT0; ts[1] = tgt; ts[2] = STAGE_GAME; ts[3] = STAGE_AICTRL0; ts[4] = 30; ts[5] = 2; ts[6] = anchor;
    run_and_emit(0x6FCD79B0u, "AIBAAL_SelectAction_6FCD79B0_113c", k,
                 k == 0 ? "forced_action_7" : k == 1 ? "no_target_coll40_ret4" : k == 2 ? "no_target_rng" : "target_with_los_weighted",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B4-5] 0x6FCC8E80 AIBAAL_SelectCombatAction_6FCC8E80_113c
   * (eax=pAiControl, s0=pBaalUnit, s1=pTarget, s2=nLifePct, s3=nCloneOrMinionCount, s4=pTetherCoords, ret 20, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 243u, 20u, 5000u, 5000u, 606u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5012u, 5000u, 115u);
    U32(STAGE_UNIT1 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 80 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 80 << 8, 0);
    uint32_t tgt = 0u;
    uint32_t tether = 0u;
    if (k == 0) {
      U32(STAGE_AICTRL0 + 0x14u) = 5u;
    } else if (k == 1) {
      uint32_t pMap = U32(U32(STAGE_ROOM0 + 0x20u) + 0x20u);
      U16(pMap + (10u * 30u + 10u) * 2u) = 0x0040u;
    } else if (k == 3) {
      tgt = STAGE_UNIT1;
      tether = STAGE_AICMD0;
      U32(STAGE_AICMD0 + 0x0Cu) = 5000u;
      U32(STAGE_AICMD0 + 0x10u) = 5000u;
    }
    c.eax = STAGE_AICTRL0;
    c.nargs = 5; c.args[0] = STAGE_UNIT0; c.args[1] = tgt; c.args[2] = 80u; c.args[3] = 2u; c.args[4] = tether;
    c.calleePop = 20u;
    ts[0] = STAGE_AICTRL0; ts[1] = STAGE_UNIT0; ts[2] = tgt; ts[3] = 80; ts[4] = 2; ts[5] = tether;
    run_and_emit(0x6FCC8E80u, "AIBAAL_SelectCombatAction_6FCC8E80_113c", k,
                 k == 0 ? "forced_curstate_5" : k == 1 ? "no_target_coll40_ret10" : k == 2 ? "no_target_rng_ret0b" : "target_with_los_weighted",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [B4-6] 0x6FCC44C0 MONAI_CanShadowCastSkillInContext_6FCC44C0_113c
   * (eax=pAiParam, ecx=nSkillId, ebx=pShadowUnit, s0=pGame, s1=pOwnerUnit, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 417u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 6u, 10u, 1u, 5002u, 5000u, 102u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 30u, 1u, 5004u, 5000u, 103u);
    uint32_t sid = (k == 0) ? 254u : (k == 1) ? 258u : (k == 2) ? 258u : 251u;
    uint32_t bMelee = (k == 0 || k == 1) ? 1u : 0u;
    uint32_t tgt = (k == 3) ? 0u : STAGE_UNIT2;
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, tgt, 4u, bMelee, STAGE_MONSTATS_TMP);
    if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 157, 1); /* Burst of Speed aura already active -> ret 0 */
    c.eax = STAGE_AIPARAM0; c.ecx = sid; c.ebx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = STAGE_AIPARAM0; ts[1] = (int32_t)sid; ts[2] = STAGE_UNIT0; ts[3] = STAGE_GAME; ts[4] = STAGE_UNIT1;
    run_and_emit(0x6FCC44C0u, "MONAI_CanShadowCastSkillInContext_6FCC44C0_113c", k,
                 k == 0 ? "melee_aitype4_ret1" : k == 1 ? "melee_aitype1_mismatch_ret0" : k == 2 ? "ranged_aitype1_aura_active_ret0" : "ranged_aitype5_no_target_ret0",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B4-7] 0x6FCC4890 MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c
   * (eax=nSkillId, ecx=pOwnerUnit, edx=pShadowUnit, s0=pGame, s1=pSkill, s2=pAiParam, ret 12, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 417u, 20u, 5000u, 5000u, (k == 3) ? 202u : 808u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, (k == 1) ? 1u : 6u, 10u, 1u, 5002u, 5000u, 102u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 30u, 1u, 5004u, 5000u, 103u);
    S16(STAGE_MONSTATS_TMP + 0x82u) = 10;
    S16(STAGE_MONSTATS_TMP + 0x84u) = 100;
    U32(STAGE_AICTRL0 + 0x14u) = 50u; /* <= gameFrame 100 */
    U32(STAGE_AICTRL0 + 0x18u) = 2u;  /* < minBound 10 -> clamped to 10 */
    U32(STAGE_AICTRL0 + 0x1Cu) = 20u;
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, STAGE_UNIT2, 4u, 0u, STAGE_MONSTATS_TMP);
    uint32_t pSkill = (k == 0) ? 0u : stage_used_skill(STAGE_UNIT0, 258u, 1u, 0u, 0u, 0u, 0u, 0u);
    uint32_t sid = 258u;
    if (k == 2) U32(STAGE_AICTRL0 + 0x14u) = 200u; /* > gameFrame 100 -> ret 0 after cost roll */
    c.eax = sid; c.ecx = STAGE_UNIT1; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = pSkill; c.args[2] = STAGE_AIPARAM0; c.calleePop = 12u;
    ts[0] = (int32_t)sid; ts[1] = STAGE_UNIT1; ts[2] = STAGE_UNIT0; ts[3] = STAGE_GAME; ts[4] = pSkill; ts[5] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC4890u, "MONAI_EvaluateShadowSkillCastChance_6FCC4890_113c", k,
                 k == 0 ? "null_skill_ret0" : k == 1 ? "owner_class_mismatch_ret0" : k == 2 ? "cooldown_future_ret0" : "valid_updates_threshold_ret1",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [B4-8] 0x6FCD7090 AITARGET_FindBestHostileTargetTether75_6FCD7090_113c
   * (stdcall: pGame, pAttacker, pOutBestScore, pOutCandidateCount, pTetherCoords, pfnFilter, ret 24, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 544u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    if (k == 2) {
      stage_hostile_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 10u, 5008u, 5000u, 200u);
    } else if (k == 3) {
      /* Non-player in slot -> asserts 0xB3 */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5008u, 5000u, 102u);
      U32(STAGE_SLOTNODE0 + 0x00u) = STAGE_UNIT1;
      U32(STAGE_GAME + 0x10F8u)    = STAGE_SLOTNODE0;
    }
    uint32_t pOutScore = STAGE_SCRATCH + 0x10u;
    uint32_t pOutCnt   = STAGE_SCRATCH + 0x14u;
    uint32_t pfnWine   = (k == 0) ? 0u : (0x6FCD6D30u + (uint32_t)g_game_rebase);
    uint32_t pfnTs     = (k == 0) ? 0u : 0x6FCD6D30u;
    c.nargs = 6;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = pOutScore; c.args[3] = pOutCnt; c.args[4] = 0u; c.args[5] = pfnWine;
    c.calleePop = 24u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pOutScore; ts[3] = pOutCnt; ts[4] = 0; ts[5] = pfnTs;
    run_and_emit(0x6FCD7090u, "AITARGET_FindBestHostileTargetTether75_6FCD7090_113c", k,
                 k == 0 ? "null_filter_assert_9e" : k == 1 ? "empty_game_ret0" : k == 2 ? "hostile_player_selected" : "non_player_assert_b3",
                 &c, ts, 6, 0xFFFFFFFFu, (k == 0 || k == 3) ? 1 : 0);
  }

  /* [B4-9] 0x6FCC4610 AITARGET_FindBestHostileTarget_6FCC4610_113c
   * (stdcall: pGame, pAttacker, pOutBestScore, pOutCandidateCount, pTetherCoords, pfnFilter, ret 24, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 243u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    if (k == 2) {
      stage_hostile_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 10u, 5008u, 5000u, 200u);
    } else if (k == 3) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5008u, 5000u, 102u);
      U32(STAGE_SLOTNODE0 + 0x00u) = STAGE_UNIT1;
      U32(STAGE_GAME + 0x10F8u)    = STAGE_SLOTNODE0;
    }
    uint32_t pOutScore = STAGE_SCRATCH + 0x10u;
    uint32_t pOutCnt   = STAGE_SCRATCH + 0x14u;
    uint32_t pfnWine   = (k == 0) ? 0u : (0x6FCC38C0u + (uint32_t)g_game_rebase);
    uint32_t pfnTs     = (k == 0) ? 0u : 0x6FCC38C0u;
    c.nargs = 6;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = pOutScore; c.args[3] = pOutCnt; c.args[4] = 0u; c.args[5] = pfnWine;
    c.calleePop = 24u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pOutScore; ts[3] = pOutCnt; ts[4] = 0; ts[5] = pfnTs;
    run_and_emit(0x6FCC4610u, "AITARGET_FindBestHostileTarget_6FCC4610_113c", k,
                 k == 0 ? "null_filter_assert_37a" : k == 1 ? "empty_game_ret0" : k == 2 ? "hostile_player_selected" : "non_player_assert_395",
                 &c, ts, 6, 0xFFFFFFFFu, (k == 0 || k == 3) ? 1 : 0);
  }

  /* [B4-10] 0x6FCCC8E0 AI_MercOrShadowWarriorThink_6FCCC8E0_113c
   * (ecx=pGame, edx=pMonster, s0=pAiTickArgs, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 20u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cls = (k == 0 || k == 2) ? 0x1A4u : 0x1A2u;
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    if (k == 2) U32(STAGE_AICTRL0 + 0x1Cu) = 999u; /* savedGuid not found -> still stalls 10 */
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCCC8E0u, "AI_MercOrShadowWarriorThink_6FCCC8E0_113c", k,
                 k == 0 ? "class_1a4_dispatches_ac30" : k == 1 ? "class_other_dispatches_a710" : "class_1a4_saved_guid_miss",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-11] 0x6FCC7530 MONAI_SiegeMinionThinkDispatch_6FCC7530_113c
   * (ecx=pGame, edx=pUnit, s0=pAiThinkArg, ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_quest_node(STAGE_QUEST0, 0x23u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x11u) = 0u; /* stall 0x19 path */
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 110u);
    uint32_t cls = (k == 0) ? 0x21Cu : (k == 1) ? 0x21Du : (k == 2) ? 0x21Eu : 0x10u;
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, cls, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC7530u, "MONAI_SiegeMinionThinkDispatch_6FCC7530_113c", k,
                 k == 0 ? "class_21c_thinkC" : k == 1 ? "class_21d_thinkB" : k == 2 ? "class_21e_thinkA" : "other_class_noop",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-12] 0x6FCD1320 MONAI_ForEachPackMemberWithFilter_6FCD1320_113c
   * (esi=pUnit, s0=pGame, s1=pUserParam, s2=pfnFilter, ret 12, u32; TS: pUnit, pGame, pfnFilter, pUserParam) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_ai_monster(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 21u, 5003u, 5000u, 102u, STAGE_AIGEN1, STAGE_AICTRL0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pCtx = STAGE_SCRATCH + 0x20u;
    U32(pCtx + 0x00u) = 1u;  /* classId = 1 */
    U32(pCtx + 0x04u) = 15u; /* maxDist = 15 */
    U32(pCtx + 0x08u) = 0u;  /* count */
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    if (k >= 1) {
      U32(STAGE_AIGEN0 + 0x28u) = STAGE_GAME;
      U32(STAGE_AIGEN0 + 0x2Cu) = (k == 1) ? 999u : 20u; /* boss guid */
      U32(STAGE_AIGEN0 + 0x30u) = 1u;                    /* boss type */
    }
    if (k == 3) {
      uint32_t pMinNode = STAGE_SCRATCH + 0x40u;
      U32(pMinNode + 0x00u) = 21u; /* minion guid */
      U32(pMinNode + 0x04u) = 0u;  /* next */
      U32(STAGE_AIGEN0 + 0x34u) = pMinNode;
    }
    uint32_t pfnWine = 0x6FCD0DB0u + (uint32_t)g_game_rebase;
    c.esi = uArg;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = pCtx; c.args[2] = pfnWine; c.calleePop = 12u;
    ts[0] = uArg; ts[1] = STAGE_GAME; ts[2] = 0x6FCD0DB0u; ts[3] = pCtx;
    run_and_emit(0x6FCD1320u, "MONAI_ForEachPackMemberWithFilter_6FCD1320_113c", k,
                 k == 0 ? "null_unit_ret0" : k == 1 ? "missing_boss_ret0" : k == 2 ? "empty_pack_ret0" : "pack_member_counted",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-13] 0x6FCD2120 MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c
   * (eax=pSourceUnit, ecx=pGame, esi=pTargetMonster, s0=nDurationFrames, ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 10u, 1u, 5000u, 5000u, 101u);
    stage_ai_monster(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 19u, 20u, 5004u, 5000u, 102u, STAGE_AIGEN0, 0u);
    uint32_t tgt = (k == 0) ? 0u : STAGE_UNIT1;
    if (k == 1) U32(STAGE_UNIT1 + 0x10u) = 12u; /* dead -> return */
    uint32_t dur = (k == 3) ? 120u : 50u;
    c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.esi = tgt;
    c.nargs = 1; c.args[0] = dur; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = tgt; ts[3] = dur;
    run_and_emit(0x6FCD2120u, "MONAI_ApplyTauntOrAttractTarget_6FCD2120_113c", k,
                 k == 0 ? "null_target_noop" : k == 1 ? "dead_monster_noop" : k == 2 ? "valid_dur50_taunt" : "valid_dur120_taunt",
                 &c, ts, 4, 0u, 0);
  }

  /* [B4-14] 0x6FCD8070 AIBAAL_ExecuteCommandAction_6FCD8070_113c
   * (eax=pTargetUnit, ecx=pMonster, edx=nActionCode, s0=pGame, s1=pAiControl, s2=pApproachCoords, ret 12, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U8(STAGE_GAME + 0x6Du) = (k == 0) ? 0u : (k == 1) ? 1u : 2u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 544u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    uint32_t cmd = (k <= 2) ? 1u : 5u;
    c.eax = 0u; c.ecx = STAGE_UNIT0; c.edx = cmd;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_AICTRL0; c.args[2] = 0u; c.calleePop = 12u;
    ts[0] = 0; ts[1] = STAGE_UNIT0; ts[2] = cmd; ts[3] = STAGE_GAME; ts[4] = STAGE_AICTRL0; ts[5] = 0;
    run_and_emit(0x6FCD8070u, "AIBAAL_ExecuteCommandAction_6FCD8070_113c", k,
                 k == 0 ? "cmd1_diff0_stall23" : k == 1 ? "cmd1_diff1_stall0f" : k == 2 ? "cmd1_diff2_stall5" : "cmd5_null_coords_stall5",
                 &c, ts, 6, 0u, 0);
  }

  /* [B4-15] 0x6FCC5EB0 MONAI_SiegeMinionThinkA_6FCC5EB0_113c
   * (eax=pAiParam, ecx=pUnit, s0=pGame, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_quest_node(STAGE_QUEST0, 0x23u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x11u) = (k == 0) ? 0u : 1u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 110u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x21Eu, 20u, 5000u, 5000u, 202u, STAGE_AIGEN0, STAGE_AICTRL0);
    S16(STAGE_MONSTATS_TMP + 0x170u) = -1;
    S16(STAGE_MONSTATS_TMP + 0x62u)  = 0; /* aip3=0 -> melee roll fails -> stall 0x19 */
    if (k == 2) {
      stage_hostile_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 10u, 5001u, 5000u, 200u);
    }
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.eax = STAGE_AIPARAM0; c.ecx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_AIPARAM0; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCC5EB0u, "MONAI_SiegeMinionThinkA_6FCC5EB0_113c", k,
                 k == 0 ? "q35_inactive_stall19" : k == 1 ? "no_target_stall19" : "melee_roll_miss_stall19",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-16] 0x6FCC6050 MONAI_SiegeMinionThinkB_6FCC6050_113c
   * (eax=pAiParam, s0=pGame, s1=pUnit, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_quest_node(STAGE_QUEST0, 0x23u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x11u) = (k == 0) ? 0u : 1u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 110u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x21Du, 20u, 5000u, 5000u, 303u, STAGE_AIGEN0, STAGE_AICTRL0);
    S16(STAGE_MONSTATS_TMP + 0x170u) = -1;
    S16(STAGE_MONSTATS_TMP + 0x56u)  = 25; /* aip1 > dist 10 -> skips walk, does atk roll */
    S16(STAGE_MONSTATS_TMP + 0x5Cu)  = 0;  /* aip2 = 0 -> atk roll misses -> stall 10 */
    if (k == 2) {
      stage_hostile_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 10u, 5010u, 5000u, 200u);
    }
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.eax = STAGE_AIPARAM0; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = STAGE_AIPARAM0; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCC6050u, "MONAI_SiegeMinionThinkB_6FCC6050_113c", k,
                 k == 0 ? "q35_inactive_stall19" : k == 1 ? "no_target_stall19" : "ranged_atk_roll_miss_stall10",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-17] 0x6FCC62D0 MONAI_SiegeMinionThinkC_6FCC62D0_113c
   * (eax=pAiParam, ecx=pUnit, s0=pGame, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 30u;
    stage_quest_node(STAGE_QUEST0, 0x23u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x11u) = (k == 0) ? 0u : 1u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 110u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0x21Cu, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    if (k == 1) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1);
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.eax = STAGE_AIPARAM0; c.ecx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_AIPARAM0; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCC62D0u, "MONAI_SiegeMinionThinkC_6FCC62D0_113c", k,
                 k == 0 ? "q35_inactive_stall19" : k == 1 ? "state36_stall19" : "no_target_stall19",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-18] 0x6FCC5C80 MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, 0u);
    if (k == 2) {
      U32(STAGE_AICMD0 + 0x08u) = 8u;
      U32(STAGE_AIGEN0 + 0x20u) = STAGE_AICMD0;
    }
    stage_ai_param(STAGE_AIPARAM0, STAGE_AIGEN0, 0u, (k == 0) ? 25u : 5u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC5C80u, "MONAI_MinionSwitchToBaseAiThink_6FCC5C80_113c", k,
                 k == 0 ? "dist25_stalls10" : k == 1 ? "dist5_broadcast_reinit_stall10" : "has_cmd8_reinit_stall10",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-19] 0x6FCC4D10 AI_TickSummonedTimedAttacker_6FCC4D10_113c
   * (ecx=pGame, edx=pUnit, s0=pAiArgs, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U8(STAGE_GAME + 0x6Du) = (k == 1) ? 1u : 0u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, 202u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5000u, 102u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U32(STAGE_UNIT0 + 0xC8u) |= (1u << 10);
    U32(STAGE_UNIT0 + 0x94u) = 0u;  /* owner type = player */
    U32(STAGE_UNIT0 + 0x98u) = 10u; /* owner guid = 10 */
    S16(STAGE_MONSTATS_TMP + 0x56u) = 0;  /* aip1 diff0 = 0 (never attacks) */
    S16(STAGE_MONSTATS_TMP + 0x5Cu) = 12; /* aip2 diff0 = 12 stall */
    S16(STAGE_MONSTATS_TMP + 0x5Eu) = 24; /* aip2 diff1 = 24 stall */
    S16(STAGE_MONSTATS_TMP + 0x62u) = 10; /* aip3 diff0 = 10 sec */
    U32(STAGE_AICTRL0 + 0x1Cu) = (k == 0) ? 0u : 500u;
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, STAGE_UNIT1, 2u, (k == 2) ? 1u : 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC4D10u, "AI_TickSummonedTimedAttacker_6FCC4D10_113c", k,
                 k == 0 ? "init_expire_frame_stall12" : k == 1 ? "active_diff1_stall24" : "in_range_roll_miss_stall12",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-20] 0x6FCC7410 MONAI_WorldstoneMinionThink_6FCC7410_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 45u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 131u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 540u, 20u + (uint32_t)k, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    link_room_units(STAGE_ROOM0, STAGE_UNIT0, 0u);
    S16(STAGE_MONSTATS_TMP + 0x56u) = 10;
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC7410u, "MONAI_WorldstoneMinionThink_6FCC7410_113c", k,
                 k == 0 ? "no_worldstone_frame100" : k == 1 ? "no_worldstone_frame145" : "no_worldstone_frame190",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-21] 0x6FCC59B0 MONAI_UnburrowThink_6FCC59B0_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, 0u);
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x0C, 1);
    } else if (k == 2) {
      U32(STAGE_AICMD0 + 0x00u) = STAGE_AICMD0; /* circular self-link */
      U32(STAGE_AICMD0 + 0x04u) = STAGE_AICMD0;
      U32(STAGE_AICMD0 + 0x08u) = 10u;
      U32(STAGE_AICMD0 + 0x0Cu) = 5000u;
      U32(STAGE_AICMD0 + 0x10u) = 5005u;
      U32(STAGE_AIGEN0 + 0x20u) = STAGE_AICMD0;
    }
    stage_ai_param(STAGE_AIPARAM0, STAGE_AIGEN0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC59B0u, "MONAI_UnburrowThink_6FCC59B0_113c", k,
                 k == 0 ? "no_cmd10_reinit_stall1" : k == 1 ? "clears_state0c_reinit" : "cmd10_preserved_reinit",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-22] 0x6FCD78A0 AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParamPtr, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 544u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, 0u);
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x0C, 1);
    } else if (k == 2) {
      U32(STAGE_AICMD0 + 0x00u) = STAGE_AICMD0;
      U32(STAGE_AICMD0 + 0x04u) = STAGE_AICMD0;
      U32(STAGE_AICMD0 + 0x08u) = 10u;
      U32(STAGE_AICMD0 + 0x0Cu) = 5000u;
      U32(STAGE_AICMD0 + 0x10u) = 5005u;
      U32(STAGE_AIGEN0 + 0x20u) = STAGE_AICMD0;
    }
    stage_ai_param(STAGE_AIPARAM0, STAGE_AIGEN0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCD78A0u, "AIBAAL_ReinitAiThinkAndRestoreCmd10_6FCD78A0_113c", k,
                 k == 0 ? "no_cmd10_reinit_stall1" : k == 1 ? "clears_state0c_reinit" : "cmd10_preserved_reinit",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-23] 0x6FCC5D70 MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, 202u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5000u, 102u);
    S16(STAGE_MONSTATS_TMP + 0x56u) = 0;  /* aip1 diff0 = 0 */
    S16(STAGE_MONSTATS_TMP + 0x58u) = 0;  /* aip1 diff1 = 0 */
    S16(STAGE_MONSTATS_TMP + 0x5Cu) = 0;  /* aip2 diff0 = 0 */
    S16(STAGE_MONSTATS_TMP + 0x62u) = 12; /* aip3 diff0 = 12 */
    S16(STAGE_MONSTATS_TMP + 0x64u) = 22; /* aip3 diff1 = 22 */
    S16(STAGE_MONSTATS_TMP + 0x68u) = 30; /* aip4 diff0 = 30 */
    S16(STAGE_MONSTATS_TMP + 0x6Au) = 45; /* aip4 diff1 = 45 */
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, (k == 1) ? 0u : STAGE_UNIT1, 2u, (k == 1) ? 0u : 1u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC5D70u, "MONAI_MeleeSkillOrApproachWithTimerThink_6FCC5D70_113c", k,
                 k == 0 ? "melee_miss_stall12_timer30" : k == 1 ? "no_target_roll_timer30" : "diff1_melee_miss_stall22_timer45",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-24] 0x6FCC9D40 AI_Think_TeleportLeashOrApproachOwner_6FCC9D40_113c
   * (ecx=pGame, edx=pMonster, s0=pAiTickArgs, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, (k == 1) ? 1u : 2u, 5002u, 5000u, 102u);
    S16(STAGE_MONSTATS_TMP + 0x56u) = 20; /* walkDist */
    S16(STAGE_MONSTATS_TMP + 0x5Cu) = 10; /* maxIdle */
    S16(STAGE_MONSTATS_TMP + 0x62u) = 50; /* teleportDist */
    U32(STAGE_AICTRL0 + 0x14u) = 3u;
    uint32_t owner = (k == 0) ? 0u : STAGE_UNIT1;
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, owner, 5u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC9D40u, "AI_Think_TeleportLeashOrApproachOwner_6FCC9D40_113c", k,
                 k == 0 ? "null_owner_stall19" : k == 1 ? "owner_idle_inc_counter" : "owner_moving_reset_counter",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-25] 0x6FCD8460 AIBAAL_CloneThink_6FCD8460_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 2u : 0u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 570u, 20u, 5000u, 5000u, 505u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 544u, 30u, 1u, 5002u, 5000u, 103u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    U32(STAGE_UNIT0 + 0xC8u) |= (1u << 10);
    U32(STAGE_UNIT0 + 0x94u) = 1u;  /* owner type = monster (Baal) */
    U32(STAGE_UNIT0 + 0x98u) = 30u; /* owner guid */
    U32(STAGE_AICTRL0 + 0x14u) = 1u; /* forcedAction = 1 (stall) */
    if (k >= 1) {
      stage_hostile_player(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 10u, 5008u, 5000u, 200u);
    }
    if (k == 2) {
      U32(STAGE_AICMD0 + 0x00u) = STAGE_AICMD0;
      U32(STAGE_AICMD0 + 0x04u) = STAGE_AICMD0;
      U32(STAGE_AICMD0 + 0x08u) = 0x0Au;
      U32(STAGE_AICMD0 + 0x0Cu) = 5000u;
      U32(STAGE_AICMD0 + 0x10u) = 5000u;
      U32(STAGE_AIGEN0 + 0x20u) = STAGE_AICMD0;
    }
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCD8460u, "AIBAAL_CloneThink_6FCD8460_113c", k,
                 k == 0 ? "no_target_copy_cmd10_stall0f" : k == 1 ? "target_forced1_diff0" : "existing_cmd10_forced1_diff2",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-26] 0x6FCD8610 AIBAAL_ThroneRoomThink_6FCD8610_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U8(STAGE_GAME + 0x6Du) = (k == 1) ? 1u : 0u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 544u, 20u, 5000u, 5000u, 505u, STAGE_AIGEN0, STAGE_AICTRL0);
    U32(STAGE_AICTRL0 + 0x14u) = (k == 2) ? 7u : 1u;
    if (k == 2) {
      U32(STAGE_AICMD0 + 0x00u) = STAGE_AICMD0;
      U32(STAGE_AICMD0 + 0x04u) = STAGE_AICMD0;
      U32(STAGE_AICMD0 + 0x08u) = 0x0Au;
      U32(STAGE_AICMD0 + 0x0Cu) = 5000u;
      U32(STAGE_AICMD0 + 0x10u) = 5000u;
      U32(STAGE_AIGEN0 + 0x20u) = STAGE_AICMD0;
    }
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCD8610u, "AIBAAL_ThroneRoomThink_6FCD8610_113c", k,
                 k == 0 ? "forced1_diff0_copies_cmd10" : k == 1 ? "forced1_diff1_copies_cmd10" : "existing_cmd10_forced7",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-27] 0x6FCC7A10 MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 35u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 111u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 434u, 20u, 5000u, 5000u, 202u, STAGE_AIGEN0, STAGE_AICTRL0);
    if (k == 2) {
      stage_quest_node(STAGE_QUEST0, 0x20u, STAGE_QUESTEX0, 0u);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 4u, 10u, 1u, 5002u, 5000u, 102u);
      link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT0, 1u, 0u);
      link_room_units(STAGE_ROOM0, STAGE_UNIT0, STAGE_UNIT1);
    } else {
      link_room_units(STAGE_ROOM0, STAGE_UNIT0, 0u);
    }
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC7A10u, "MONAI_RescuedBarbarianSoldierThink_6FCC7A10_113c", k,
                 k == 0 ? "no_prison_no_player_f100" : k == 1 ? "no_prison_no_player_f135" : "nearby_player_roll_miss_stall19",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-28] 0x6FCC5350 AI_TickSummonedFollowTeleportSkill292_6FCC5350_113c
   * (ecx=pGame, edx=pUnit, s0=pAiArgs, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U8(STAGE_GAME + 0x6Du) = (uint8_t)k;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5000u, 102u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U32(STAGE_AIGEN0 + 0x28u) = STAGE_GAME;
    U32(STAGE_AIGEN0 + 0x2Cu) = 10u;
    U32(STAGE_AIGEN0 + 0x30u) = 0u;
    U32(STAGE_AICTRL0 + 0x14u) = 200u; /* >= gameFrame 100 -> stall aip2 */
    S16(STAGE_MONSTATS_TMP + 0x56u) = 10;
    S16(STAGE_MONSTATS_TMP + 0x5Cu) = 11;
    S16(STAGE_MONSTATS_TMP + 0x5Eu) = 22;
    S16(STAGE_MONSTATS_TMP + 0x60u) = 33;
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC5350u, "AI_TickSummonedFollowTeleportSkill292_6FCC5350_113c", k,
                 k == 0 ? "cooldown_diff0_stall11" : k == 1 ? "cooldown_diff1_stall22" : "cooldown_diff2_stall33",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-30] 0x6FCC6B70 AI_ThinkBladeCreeper_6FCC6B70_113c
   * (ecx=pGame, edx=pUnit, s0=pAiThinkArg, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 255, (k == 1) ? 5 : 1, 0, 0, 0);
    S16(STAGE_MONSTATS_TMP + 0x170u) = 255; /* Dragon Talon: calc144=4819, srvmiss=-1 */
    S32(STAGE_AICTRL0 + 0x14u) = (k == 2) ? 500 : -1;
    U32(STAGE_AICTRL0 + 0x1Cu) = 1u; /* skip missile creation, test duration init + stall 3 */
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC6B70u, "AI_ThinkBladeCreeper_6FCC6B70_113c", k,
                 k == 0 ? "init_dur_slvl1_stall3" : k == 1 ? "init_dur_slvl5_stall3" : "active_dur500_stall3",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-31] 0x6FCC7580 MONAI_NihlathakThink_6FCC7580_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_quest_node(STAGE_QUEST0, 0x22u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUEST0 + 0x0Bu) = (k == 0) ? 1u : 3u;
    U8(STAGE_QUEST0 + 0x14u) = 1u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 124u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 526u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    if (k == 1) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x0C, 1);
    S16(STAGE_MONSTATS_TMP + 0x170u) = -1;
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC7580u, "MONAI_NihlathakThink_6FCC7580_113c", k,
                 k == 0 ? "promotes_act5q4_state3_stall19" : k == 1 ? "clears_state0c_stall19" : "already_state3_stall19",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-32] 0x6FCC9610 AIBAAL_CombatThink_6FCC9610_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 243u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    S16(STAGE_MONSTATS_TMP + 0x170u) = (k == 1) ? 255 : -1;
    S16(STAGE_MONSTATS_TMP + 0x174u) = -1;
    S16(STAGE_MONSTATS_TMP + 0x17Eu) = -1;
    U32(STAGE_AICTRL0 + 0x14u) = (k == 2) ? 6u : 5u;
    if (k == 1) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x0C, 1);
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC9610u, "AIBAAL_CombatThink_6FCC9610_113c", k,
                 k == 0 ? "action5_noskill0_stall2" : k == 1 ? "action5_clears_state0c_stall2" : "action6_noskill_stall2",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-33] 0x6FCC8270 MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 110u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 110u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 435u, 20u + (uint32_t)k, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    link_room_units(STAGE_ROOM0, STAGE_UNIT0, 0u);
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 30u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC8270u, "MONAI_StationaryMeleeWithin25ThinkA_6FCC8270_113c", k,
                 k == 0 ? "no_target_stall50_f100" : k == 1 ? "no_target_stall50_f210" : "no_target_stall50_f320",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-34] 0x6FCC8350 MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 110u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 110u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 435u, 20u + (uint32_t)k, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    link_room_units(STAGE_ROOM0, STAGE_UNIT0, 0u);
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 30u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC8350u, "MONAI_StationaryMeleeWithin25ThinkB_6FCC8350_113c", k,
                 k == 0 ? "no_target_stall50_f100" : k == 1 ? "no_target_stall50_f210" : "no_target_stall50_f320",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-35] 0x6FCC5B30 MONAI_NestOrMeleeWanderThink_6FCC5B30_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U32(STAGE_GAME + 0xA8u) = 100u + (uint32_t)k * 25u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t seeds[3] = { 202u, 404u, 808u }; /* lo1%100 = 72, 78, 94 (all >= 20 -> stall 10) */
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, seeds[k], STAGE_AIGEN0, STAGE_AICTRL0);
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 10u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC5B30u, "MONAI_NestOrMeleeWanderThink_6FCC5B30_113c", k,
                 k == 0 ? "seed202_roll72_stall10" : k == 1 ? "seed404_roll78_stall10" : "seed808_roll94_stall10",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-37] 0x6FCC6E60 MONAI_DarkWandererThink_6FCC6E60_113c
   * (ecx=pGame, edx=pUnit, s0=pAiThinkArg, ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 513u, 20u, 5000u, 5000u, 101u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5010u, 5000u, 102u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x1Cu, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x00u)  = 1u;
      U8(STAGE_QUESTEX0 + 0x02u)  = 1u;
      U32(STAGE_QUESTEX0 + 0x04u) = 5005u;
      U32(STAGE_QUESTEX0 + 0x08u) = 5005u;
    }
    uint32_t tgt  = (k <= 1) ? 0u : STAGE_UNIT1;
    uint32_t dist = (k == 2) ? 25u : 8u;
    U32(STAGE_AICTRL0 + 0x14u) = (k == 3) ? 3u : 0u;
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, tgt, dist, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC6E60u, "MONAI_DarkWandererThink_6FCC6E60_113c", k,
                 k == 0 ? "no_spawn_pos_stall0a" : k == 1 ? "init_state1_no_target_stall0a" : k == 2 ? "dist25_stall28" : "state3_stall28",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-38] 0x6FCC6530 MONAI_MeleeAndRangedSkillThink_6FCC6530_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, 202u, STAGE_AIGEN0, STAGE_AICTRL0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5006u, 5000u, 102u);
    S16(STAGE_MONSTATS_TMP + 0x56u)  = 0;  /* aip1 = 0 */
    S16(STAGE_MONSTATS_TMP + 0x5Cu)  = 0;  /* aip2 = 0 */
    S16(STAGE_MONSTATS_TMP + 0x62u)  = 15; /* aip3 = 15 */
    S16(STAGE_MONSTATS_TMP + 0x68u)  = 0;  /* aip4 = 0 */
    S16(STAGE_MONSTATS_TMP + 0x170u) = (k == 1) ? 38 : -1;
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, STAGE_UNIT1, 5u, (k == 0) ? 1u : 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC6530u, "MONAI_MeleeAndRangedSkillThink_6FCC6530_113c", k,
                 k == 0 ? "melee_miss_stall15" : k == 1 ? "ranged_skill_and_move_miss_stall15" : "ranged_noskill_move_miss_stall15",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-39] 0x6FCC80C0 MONAI_BarricadeTauntAndAttackThink_6FCC80C0_113c
   * (ecx=pGame, edx=pUnit, s0=pAiParam, ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 110u);
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 435u, 20u, 5000u, 5000u, (k == 2) ? 909u : 808u, STAGE_AIGEN0, STAGE_AICTRL0);
    uint32_t pHolder = STAGE_SCRATCH + 0x30u;
    U32(STAGE_UDATA0 + 0x30u) = pHolder;
    if (k == 0) {
      uint32_t pNode = STAGE_SCRATCH + 0x40u;
      U32(pNode + 0x00u)   = 1u;
      U32(pHolder + 0x00u) = pNode;
      link_room_units(STAGE_ROOM0, STAGE_UNIT0, 0u);
    } else {
      U32(pHolder + 0x00u) = 0u;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 4u, 10u, 1u, 5002u, 5000u, 102u);
      link_room_units(STAGE_ROOM0, STAGE_UNIT0, STAGE_UNIT1);
      S32(STAGE_AICTRL0 + 0x18u) = (k == 1) ? 0 : (k == 2) ? 10 : -5;
    }
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC80C0u, "MONAI_BarricadeTauntAndAttackThink_6FCC80C0_113c", k,
                 k == 0 ? "interact_busy_stall0a" : k == 1 ? "taunt_timer0_sets_3c_sound12" : k == 2 ? "taunt_timer10_dec_to9" : "taunt_neg_reset0",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-40] 0x6FCC4FD0 AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c
   * (ecx=pGame, edx=pUnit, s0=pAiTickArgs, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    U8(STAGE_GAME + 0x6Du)  = (k == 1) ? 1u : 0u;
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 500u : 100u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t seeds[3] = { 202u, 404u, 808u }; /* lo1%100 = 72, 78, 94 (all >= 3 -> skip 6FCC3B50) */
    stage_ai_monster(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 20u, 5000u, 5000u, seeds[k], STAGE_AIGEN0, STAGE_AICTRL0);
    U32(STAGE_AICTRL0 + 0x1Cu) = (k == 2) ? 1u : 200u;
    S16(STAGE_MONSTATS_TMP + 0x5Cu) = 15; /* aip2 diff0 */
    S16(STAGE_MONSTATS_TMP + 0x5Eu) = 25; /* aip2 diff1 */
    stage_ai_param(STAGE_AIPARAM0, STAGE_AICTRL0, 0u, 0u, 0u, STAGE_MONSTATS_TMP);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_AIPARAM0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_AIPARAM0;
    run_and_emit(0x6FCC4FD0u, "AI_ReverseCheckAndCastRandomPosSkill_6FCC4FD0_113c", k,
                 k == 0 ? "cooldown_rem_diff0_stall15" : k == 1 ? "cooldown_rem_diff1_stall25" : "no_target_stall15",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-41] 0x6FCD5BD0 SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c
   * (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 58u, 20u, 1u, 5000u, 5000u, 101u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 19u, 21u, (k == 1) ? 1u : 12u, 5002u, 5000u, 102u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    if (k == 2) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT1, 0x1E, 1); /* state mask 2 (shatter/corpse consumed? try state 118 / or check blocked cell) */
      /* Also set collision block just in case */
      uint32_t pMap = U32(U32(STAGE_ROOM0 + 0x20u) + 0x20u);
      U16(pMap + (10u * 30u + 12u) * 2u) = 0x3C01u;
    } else if (k == 3) {
      uint32_t pMap = U32(U32(STAGE_ROOM0 + 0x20u) + 0x20u);
      U16(pMap + (10u * 30u + 12u) * 2u) = 0x0001u;
    }
    int32_t sid = (k == 0) ? -1 : 38;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sid; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sid; ts[3] = 1;
    run_and_emit(0x6FCD5BD0u, "SKILLS_SrvDo_MonResurrectCorpse_6FCD5BD0_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "alive_target_sets_flag40" : k == 2 ? "dead_blocked_coll_3c01" : "dead_blocked_coll_0001",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-w12-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-w12] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
    fflush(stderr);
    return 1;
  }

  HMODULE hStorm = LoadLibraryA("Storm.dll");
  g_hFog         = LoadLibraryA("Fog.dll");
  HMODULE hLang  = LoadLibraryA("D2Lang.dll");
  HMODULE hCmp   = LoadLibraryA("D2CMP.dll");
  g_hCom         = LoadLibraryA("D2Common.dll");
  HMODULE hNet   = LoadLibraryA("D2Net.dll");
  g_hGame        = LoadLibraryA("D2Game.dll");
  if (!hStorm || !g_hFog || !hLang || !hCmp || !g_hCom || !hNet || !g_hGame) {
    fprintf(stderr, "[k6-w12] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-w12] unexpected D2Common rebase: %p\n", (void *)g_hCom);
    fflush(stderr);
    return 3;
  }

  {
    typedef void(__fastcall *FogInitSys_t)(int, void *);
    FogInitSys_t pInit = (FogInitSys_t)(uintptr_t)GetProcAddress(g_hFog, MAKEINTRESOURCEA(10089));
    if (pInit) pInit(1, NULL);
  }

  load_datatbls_img(imgPath);
  install_fog_hooks();

  fn_CreateStatListEx   = (Com_CreateStatListEx_t)(uintptr_t)(0x6FD8AF00u + g_com_rebase);
  fn_SetUnitStat        = (Com_SetUnitStat_t)(uintptr_t)(0x6FD8A740u + g_com_rebase);
  fn_AllocStatList      = (Com_AllocStatList_t)(uintptr_t)(0x6FD88100u + g_com_rebase);
  fn_SetStatIfValid     = (Com_SetStatIfValid_t)(uintptr_t)(0x6FD8A7B0u + g_com_rebase);
  fn_SetStatListState   = (Com_SetStatListState_t)(uintptr_t)(0x6FD88060u + g_com_rebase);
  fn_MergeStatLists     = (Com_MergeStatLists_t)(uintptr_t)(0x6FD8A7D0u + g_com_rebase);
  fn_ToggleGfxState     = (Com_ToggleGfxState_t)(uintptr_t)(0x6FD84510u + g_com_rebase);
  fn_AllocSkillList     = (Com_AllocSkillList_t)(uintptr_t)(0x6FD9E3F0u + g_com_rebase);
  fn_SetSkillLevel      = (Com_SetSkillLevel_t)(uintptr_t)(0x6FDA2BC0u + g_com_rebase);
  fn_AllocInventory     = (Com_AllocInventory_t)(uintptr_t)(0x6FD6E710u + g_com_rebase);
  fn_SetCursorItem      = (Com_SetCursorItem_t)(uintptr_t)(0x6FD71790u + g_com_rebase);
  fn_PlaceItemInBodyLoc = (Com_PlaceItemInBodyLoc_t)(uintptr_t)(0x6FD71DA0u + g_com_rebase);
  fn_CheckItemTypeId    = (Com_CheckItemTypeId_t)(uintptr_t)(0x6FC2A430u + g_game_rebase);
  fn_UnitsIsDoor        = (Com_UnitsIsDoor_t)(uintptr_t)(0x6FC2AD6Cu + g_game_rebase);
  fn_IsTwoHand          = (Com_IsTwoHand_t)(uintptr_t)(0x6FC2A940u + g_game_rebase);
  fn_IsAutoStack        = (Com_IsAutoStack_t)(uintptr_t)(0x6FC2AA48u + g_game_rebase);

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_SetCursorItem || !fn_PlaceItemInBodyLoc) {
    fprintf(stderr, "[k6-w12] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-w12] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_batch1_vas();
  emit_batch2_vas();
  emit_batch3_vas();
  emit_batch4_vas();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-w12] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
