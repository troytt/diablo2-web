/*
 * k6-w10-d2game-emitter.c — Milestone #37 [K6] Wave 10 Real-DLL Hi-VA Part 3 Differential Emitter
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables (0x20000000..0x206F7FFF + D2Common .data/.bss)
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert) and Fog.#10042..#10047
 * (deterministic bump allocator with per-allocation size tracking for Fog.#10047),
 * and executes 150 previously un-hit D2Game.dll functions strictly inside
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

/* Discovered real v1.13c item/monster/unique/skill IDs */
static uint32_t g_item_ring   = 0;
static uint32_t g_item_charm  = 0;
static uint32_t g_item_hp4    = 0;
static uint32_t g_item_hp1    = 0;
static uint32_t g_item_rvs    = 0; /* 'rvs ' Rejuvenation Potion */
static uint32_t g_item_vps    = 0; /* 'vps ' Stamina Potion */
static uint32_t g_item_yps    = 0; /* 'yps ' Antidote Potion */
static uint32_t g_item_wms    = 0; /* 'wms ' Thawing Potion */
static uint32_t g_item_sword  = 0;
static uint32_t g_item_bow    = 0;
static uint32_t g_item_aqv    = 0;
static uint32_t g_item_claw   = 0;
static uint32_t g_item_shld   = 0;
static uint32_t g_item_jav    = 0;
static uint32_t g_item_autost = 0;
static uint32_t g_item_gld    = 0;
static uint32_t g_item_tbk    = 0;
static uint32_t g_item_ibk    = 0;
static uint32_t g_item_isc    = 0;
static uint32_t g_item_tsc    = 0;
static uint32_t g_item_key    = 0;
static uint32_t g_item_hst    = 0;
static uint32_t g_item_msf    = 0;
static uint32_t g_item_vip    = 0;
static uint32_t g_item_qf2    = 0;
static uint32_t g_item_qhr    = 0;
static uint32_t g_mon_town    = 0;
static uint32_t g_mon_boss    = 0;
static uint32_t g_uniq_carry1 = 0;

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
      /* Scrub 0x280 bytes below ESP for -O2 == -fno-omit-frame-pointer == -O1 parity */
      "leal -0x280(%esp), %edi\n\t"
      "xorl %eax, %eax\n\t"
      "movl $0xA0, %ecx\n\t"
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
              "[k6-w10] SETUP/INIT FAULT after %u emitted: code=0x%08lX eip=%p (game=0x%08lX com=0x%08lX) addr=0x%08X\n",
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
      fprintf(stderr, "[k6-w10] setup bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 21);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_setup_top = p + dwSize;
    record_alloc_size(p, dwSize);
    return (void *)(uintptr_t)p;
  } else {
    uint32_t p = (g_heap_top + 3u) & ~3u;
    if (p + dwSize > HEAP_BASE + HEAP_SIZE) {
      fprintf(stderr, "[k6-w10] heap bump overflow (size=%u)\n", dwSize);
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
      fprintf(stderr, "[k6-w10] missing Fog.#%u\n", hooks[i].ord);
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
    fprintf(stderr, "[k6-w10] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-w10] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(0x6FDE9000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-w10] short read at page %u\n", i);
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
      fprintf(stderr, "[k6-w10] JSON buffer overflow\n");
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

static void stage_subparty(uint16_t partyId, uint32_t guid0, uint32_t guid1) {
  uint32_t pSub  = STAGE_PARTYCTRL + 0x20u;
  uint32_t pMem0 = STAGE_PARTYCTRL + 0x40u;
  uint32_t pMem1 = STAGE_PARTYCTRL + 0x50u;
  U32(STAGE_GAME + 0x1D2Cu)    = STAGE_PARTYCTRL;
  U32(STAGE_PARTYCTRL + 0x04u) = pSub;
  U16(pSub + 0x00u)  = partyId;
  U32(pSub + 0x04u)  = pMem0;
  U32(pSub + 0x08u)  = 0u;
  U32(pMem0 + 0x00u) = guid0;
  U32(pMem0 + 0x04u) = guid1 ? pMem1 : 0u;
  if (guid1) {
    U32(pMem1 + 0x00u) = guid1;
    U32(pMem1 + 0x04u) = 0u;
  }
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
  for (uint32_t i = 0; i < 6u; i++) {
    uint32_t node = pChunk + i * 0x30u;
    U32(node + 0x1Cu) = (i + 1u < 6u) ? (pChunk + (i + 1u) * 0x30u) : 0u;
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
            "[k6-w10] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-w10] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-w10] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-w10] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
              fnName, canonVa, caseIdx, label, actualPop, spec->calleePop);
      TerminateProcess(GetCurrentProcess(), 33);
    }
    canonicalize_d2game_ptrs_range(STAGE_BASE, STAGE_BASE + STAGE_FIXED_SIZE);
    if (setupTop > STAGE_SETUP_BASE) {
      canonicalize_d2game_ptrs_range(STAGE_SETUP_BASE, setupTop);
    }
    if (g_heap_top > HEAP_BASE) {
      canonicalize_d2game_ptrs_range(HEAP_BASE, g_heap_top);
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
    if (!g_item_hp1 && code == 0x20317068u) g_item_hp1 = id;
    if (!g_item_rvs && code == 0x20737672u) g_item_rvs = id;
    if (!g_item_vps && code == 0x20737076u) g_item_vps = id;
    if (!g_item_yps && code == 0x20737079u) g_item_yps = id;
    if (!g_item_wms && code == 0x20736D77u) g_item_wms = id;
    if (!g_item_gld && code == 0x20646C67u) g_item_gld = id;
    if (!g_item_tbk && code == 0x206B6274u) g_item_tbk = id;
    if (!g_item_ibk && code == 0x206B6269u) g_item_ibk = id;
    if (!g_item_isc && code == 0x20637369u) g_item_isc = id;
    if (!g_item_tsc && code == 0x20637374u) g_item_tsc = id;
    if (!g_item_key && code == 0x2079656Bu) g_item_key = id;
    if (!g_item_jav && code == 0x2076616Au) g_item_jav = id;
    if (!g_item_hst && code == 0x20747368u) g_item_hst = id;
    if (!g_item_msf && code == 0x2066736Du) g_item_msf = id;
    if (!g_item_vip && code == 0x20706976u) g_item_vip = id;
    if (!g_item_qf2 && code == 0x20326671u) g_item_qf2 = id;
    if (!g_item_qhr && code == 0x20726871u) g_item_qhr = id;
    if (!g_item_ring && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x0A)) g_item_ring = id;
    if (!g_item_charm && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x52)) g_item_charm = id;
    if (!g_item_sword && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x1E)) g_item_sword = id;
    if (!g_item_bow && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x1B)) g_item_bow = id;
    if (!g_item_aqv && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x05)) g_item_aqv = id;
    if (!g_item_claw && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x43)) g_item_claw = id;
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
    uint8_t f0d = U8(pMonStats + id * 0x1A8u + 0x0Du);
    if (!g_mon_town && (f0d & 3u) == 3u) g_mon_town = id;
    if (!g_mon_boss && (f0c & 0x40u) != 0u) g_mon_boss = id;
  }

  uint32_t pUniq = U32(pSgpt + 0x0C24u);
  uint32_t nUniq = U32(pSgpt + 0x0C28u);
  for (uint32_t id = 0; id < nUniq; id++) {
    if (!g_uniq_carry1 && (U8(pUniq + id * 0x14Cu + 0x2Cu) & 4u) != 0u) {
      g_uniq_carry1 = id;
    }
  }
}

/* =========================================================================
 * BATCH 1 (40 VAs): C2S (3) + DRLG/Room/SUnit (3) + Party/Player/Client (8)
 *                   + Items/Cube/Trade (25) + Quests (1 helper: 0x6FCE8950)
 * ========================================================================= */
static void emit_batch1_vas(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [1] 0x6FCEF2F0 C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 101u);
    attach_cursor_item(STAGE_UNIT0, g_item_ring, 70u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    U8(STAGE_SCRATCH + 0x00u) = 0x1Au;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 999u : 70u;
    U8(STAGE_SCRATCH + 0x05u) = (k == 2) ? 0x0Bu : 0x06u;
    uint32_t len = (k == 0) ? 8u : 9u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEF2F0u, "C2S_Packet1A_EquipCursorItem_6FCEF2F0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_cursor_ret1" : "bad_bodyloc_ret2",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [2] 0x6FCED8D0 C2S_PacketUseQuestScrollItem_6FCED8D0_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 40u); /* Act 2 */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 102u);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM1, 4u, g_item_isc, 71u, 3u, 5000u, 5000u, 103u);
    if (k == 3) insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    U8(STAGE_SCRATCH + 0x00u) = 0x20u;
    U32(STAGE_SCRATCH + 0x01u) = 71u;
    uint32_t g = (k == 1) ? 0u : STAGE_GAME;
    uint32_t len = (k == 0) ? 4u : 5u;
    c.ecx = g; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = g; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCED8D0u, "C2S_PacketUseQuestScrollItem_6FCED8D0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "null_game_assert" : k == 2 ? "item_missing_ret1" : "wrong_act_ret2",
                 &c, ts, 4, 0xFFFFFFFFu, k == 1 ? 1 : 0);
  }

  /* [3] 0x6FCF1200 C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 104u);
    attach_cursor_item(STAGE_UNIT0, g_item_ring, 72u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    U8(STAGE_SCRATCH + 0x00u) = 0x1Du;
    U32(STAGE_SCRATCH + 0x01u) = 72u;
    U8(STAGE_SCRATCH + 0x05u) = (k == 1) ? 0x00u : 0x06u;
    uint32_t len = (k == 0) ? 8u : 9u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCF1200u, "C2S_Packet1D_SwapCursorWithBodyItem_6FCF1200_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "bad_bodyloc_ret2" : "empty_bodyloc_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [4] 0x6FD00D00 SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c (eax=nY, ecx=pRoom, edx=pUnit, s0=pGame, s1=nX, ret 8, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2) ? 6u : 4u, g_item_ring, 73u, 0u, 5000u, 5000u, 105u);
    U32(STAGE_UNIT0 + 0xC8u) = 0x101u;
    uint32_t g = (k == 0) ? 0u : STAGE_GAME;
    uint32_t u = (k == 1) ? 0u : STAGE_UNIT0;
    c.eax = 5020u; c.ecx = STAGE_ROOM0; c.edx = u;
    c.nargs = 2; c.args[0] = g; c.args[1] = 5010u; c.calleePop = 8u;
    ts[0] = 5020; ts[1] = STAGE_ROOM0; ts[2] = u; ts[3] = g; ts[4] = 5010;
    run_and_emit(0x6FD00D00u, "SUNIT_PlaceUnitAtRoomAndCoords_6FD00D00_113c", k,
                 k == 0 ? "null_game_assert" : k == 1 ? "null_unit_assert" : k == 2 ? "bad_type6_assert" : "item_mode0_act_flags",
                 &c, ts, 5, 0u, (k <= 2) ? 1 : 0);
  }

  /* [5] 0x6FD142D0 OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c (s0=pGame, s1=pObj, s2=pTarget, s3=nElemType, ret 0x10, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 1u : 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 40u, 0u, 5000u, 5000u, 106u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 107u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 400 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 400 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 2, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 31, 10, 0);
    uint32_t elem = (k == 1) ? 1u : 2u;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.args[3] = elem; c.calleePop = 0x10u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = elem;
    run_and_emit(0x6FD142D0u, "OBJECTS_ApplyTrapDamageToTarget_6FD142D0_113c", k,
                 k == 0 ? "town_noop" : k == 1 ? "fire_trap_roll" : "cold_trap_roll",
                 &c, ts, 4, 0u, 0);
  }

  /* [6] 0x6FD01C00 DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c (eax=pSourceUnit, esi=pPlayerUnit, s0=pGame, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 108u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 5u, 0u, 50u, 0u, 5000u, 5000u, 109u);
    uint32_t g = (k == 0) ? 0u : STAGE_GAME;
    uint32_t p = (k == 1) ? 0u : STAGE_UNIT0;
    uint32_t src = STAGE_UNIT1;
    c.eax = src; c.esi = p; c.nargs = 1; c.args[0] = g; c.calleePop = 4u;
    ts[0] = src; ts[1] = p; ts[2] = g;
    run_and_emit(0x6FD01C00u, "DUNGEON_ExecuteRoomTileWarpTransition_6FD01C00_113c", k,
                 k == 0 ? "null_game_assert" : k == 1 ? "null_player_assert" : "no_target_room_assert71",
                 &c, ts, 3, 0u, 1);
  }

  /* [7] 0x6FCE8950 ACT2Q6_WarpPlayerThroughRoomTileUnit_6FCE8950_113c (ebx=pOperateArgs, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 40u, 2u, 5000u, 5000u, 110u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 5u, 0u, 50u, 0u, 5000u, 5000u, 111u);
    link_room_units(STAGE_ROOM0, (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1, 0u);
    U32(STAGE_SCRATCH + 0x00u) = (k == 1) ? 0u : STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = (k == 2) ? 0u : STAGE_UNIT0;
    c.ebx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FCE8950u, "ACT2Q6_WarpPlayerThroughRoomTileUnit_6FCE8950_113c", k,
                 k == 0 ? "no_tile_in_room" : k == 1 ? "tile_null_game_assert" : "tile_null_plr_assert",
                 &c, ts, 1, 0u, (k >= 1) ? 1 : 0);
  }

  /* [8] 0x6FD095E0 D2Game_6FD095E0_113c (ecx=pObjInteractArg, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 40u, (k == 0) ? 1u : 2u, 5000u, 5000u, 112u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 5u, 0u, 50u, 0u, 5000u, 5000u, 113u);
    link_room_units(STAGE_ROOM0, STAGE_UNIT1, 0u);
    U32(STAGE_SCRATCH + 0x00u) = (k == 1) ? 0u : STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = (k == 2) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FD095E0u, "D2Game_6FD095E0_113c", k,
                 k == 0 ? "mode1_skip_ret0" : k == 1 ? "mode2_assert_game" : "mode2_assert_plr",
                 &c, ts, 1, 0xFFFFFFFFu, (k >= 1) ? 1 : 0);
  }

  /* [9] 0x6FCDB4F0 D2Game_6FCDB4F0_113c (eax=pGame, esi=pUnit, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0) ? 1u : 0u, 1u, 10u, 1u, 5000u, 5000u, 114u);
    if (k >= 1) {
      uint32_t cli = (k == 1) ? STAGE_CLIENT0 : STAGE_CLIENT1;
      link_player_client(STAGE_UNIT0, STAGE_UDATA0, cli, (uint32_t)k, 0u);
      U8(cli + 0x1ACu) = 3u; /* already in Act 4 */
      U32(STAGE_GAME + 0xC8u) = STAGE_ACT0;
      U32(STAGE_LEVEL0 + 0x10u) = STAGE_ROOMEX0;
      U32(STAGE_LEVEL0 + 0x1D8u) = 1u;
      U32(STAGE_LEVEL0 + 0x2Cu) = 10u;
      U32(STAGE_LEVEL0 + 0x30u) = 10u;
      U32(STAGE_LEVEL0 + 0x34u) = 0u;
      U32(STAGE_ROOMEX0 + 0x28u) = 0x03100000u;
      U32(STAGE_ROOMEX0 + 0x30u) = 0u;
      U32(STAGE_ROOMEX0 + 0x34u) = 0u;
      U32(STAGE_ROOMEX0 + 0x38u) = 0u;
      U32(STAGE_ROOMEX0 + 0x3Cu) = 100u;
      U32(STAGE_ROOMEX0 + 0x40u) = 100u;
    }
    c.eax = STAGE_GAME; c.esi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCDB4F0u, "D2Game_6FCDB4F0_113c", k,
                 k == 0 ? "mon_assert507" : k == 1 ? "plr_cli0_pkt5d" : "plr_cli1_pkt5d",
                 &c, ts, 2, 0u, (k == 0) ? 1 : 0);
  }

  /* [10] 0x6FD110F0 PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c (ecx=pGame, edx=pPlayer, s0..s2=0, ret 0xC, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 115u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 11u, 1u, 5002u, 5002u, 116u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      stage_subparty(1u, 10u, (k == 2) ? 11u : 0u);
      U16(STAGE_CLIENT0 + 0x17Au) = 1u;
      U16(STAGE_CLIENT1 + 0x17Au) = 1u;
    }
    uint32_t plr = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = plr;
    c.nargs = 3; c.args[0] = 0u; c.args[1] = 0u; c.args[2] = 0u; c.calleePop = 0x0Cu;
    ts[0] = STAGE_GAME; ts[1] = plr; ts[2] = 0; ts[3] = 0; ts[4] = 0;
    run_and_emit(0x6FD110F0u, "PARTY_NotifySubPartyAndLeaveParty_6FD110F0_113c", k,
                 k == 0 ? "null_plr_assert210" : k == 1 ? "solo_party_leave" : "two_member_party_leave",
                 &c, ts, 5, 0u, (k == 0) ? 1 : 0);
  }

  /* [11] 0x6FD08F30 D2Game_6FD08F30_113c (ecx=pGame, edx=pQuest, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 28u);
    stage_quest_node(STAGE_QUEST0, 4u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x05u) = 1u;
    U8(STAGE_QUESTEX0 + 0x18u) = (k == 0) ? 0u : 1u;
    U8(STAGE_QUESTEX0 + 0x03u) = (k == 0) ? 0u : 1u;
    U8(STAGE_QUESTEX0 + 0x02u) = 0u;
    U32(STAGE_QUESTEX0 + 0x08u) = 5000u;
    U32(STAGE_QUESTEX0 + 0x0Cu) = 5000u;
    if (k == 2) {
      U32(STAGE_GAME + 0xC4u) = STAGE_ACT0;
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 117u);
      link_room_units(STAGE_ROOM0, STAGE_UNIT0, 0u);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FD08F30u, "D2Game_6FD08F30_113c", k,
                 k == 0 ? "flag18_off_clr05" : k == 1 ? "act2_null_ret1" : "room_no_plr_ret1",
                 &c, ts, 2, 0xFFu, 0);
  }

  /* (Note: 0x6FCEFE40 skipped — hits TS parity bugs in 0x6FCABF50 m.alloc(8) & 0x6FD019C0 GetTickCount read) */

  /* [12] 0x6FCEFF30 PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=len, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 119u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, g_mon_town, 30u, 1u, 5005u, 5005u, 120u);
    U32(STAGE_UDATA1 + 0x28u) = STAGE_AIGEN0;
    if (k == 3) insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x59u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 6u : 1u;
    U32(STAGE_SCRATCH + 0x05u) = 30u;
    U32(STAGE_SCRATCH + 0x09u) = 5012u;
    U32(STAGE_SCRATCH + 0x0Du) = 5015u;
    uint32_t len = (k == 0) ? 16u : 17u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEFF30u, "PACKET_C2S59_MoveTownNpcToCoords_6FCEFF30_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "bad_type_ret2" : k == 2 ? "npc_missing_ret1" : "move_town_npc_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [14] 0x6FCE1030 D2Game_6FCE1030_113c (s0=pGame, s1=pPlayer, s2=nSellerClassId, ret 0xC, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 121u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 271u, 31u, 1u, 5002u, 5002u, 122u);
    U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
    uint32_t pTable = STAGE_NPCCTRL + 0x10u;
    U32(STAGE_NPCCTRL + 0x04u) = pTable;
    uint32_t sellerId = 150u;
    if (k >= 1) {
      U32(pTable + 0x00u) = sellerId;
      U32(pTable + 0x10u) = (k == 2) ? (STAGE_SCRATCH + 0x100u) : 0u;
    }
    if (k == 2) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_pet_link(STAGE_UDATA0, 7u, 31u, 1234u, 1u, 1u);
      U32(STAGE_GAME + 0x70u) = 0u; /* non-expansion path: finds existing pet -> returns early cleanly */
    }
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = sellerId; c.calleePop = 0x0Cu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sellerId;
    run_and_emit(0x6FCE1030u, "D2Game_6FCE1030_113c", k,
                 k == 0 ? "seller_missing" : k == 1 ? "shop_null" : "classic_has_merc_return",
                 &c, ts, 3, 0u, 0);
  }

  /* [15] 0x6FCEC030 PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c (eax=pPlayer, ecx=pUnit, s0=bForceSync, ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 123u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 1 ? 150 : 200) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 80 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, (k == 3) ? 500 : 100, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 13, (k == 3) ? 9000 : 1000, 0);
    uint32_t pSync = STAGE_CLIENT0 + 0x48Cu;
    U16(pSync + 0x04u) = 200u; /* prevLife */
    U16(pSync + 0x06u) = 80u;  /* prevMana */
    U16(pSync + 0x08u) = (k == 2) ? 40u : 50u; /* prevStam */
    U32(pSync + 0x14u) = 100u; /* prevGold */
    U32(pSync + 0x18u) = 1000u; /* prevExp */
    uint32_t force = (k >= 2) ? 1u : 0u;
    uint32_t plr = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = plr; c.ecx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = force; c.calleePop = 4u;
    ts[0] = plr; ts[1] = STAGE_UNIT0; ts[2] = force;
    run_and_emit(0x6FCEC030u, "PLAYER_SyncClientLifeManaStaminaGoldAndCoords_6FCEC030_113c", k,
                 k == 0 ? "null_plr_ret0" : k == 1 ? "hp_drop_pkt95_ret1" : k == 2 ? "force_stam_pkt96_ret1" : "force_gold_exp_sync_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [16] 0x6FCCEA40 ITEMS_UseFlatOrBuffPotion_6FCCEA40_113c (ecx=pGame, edx=pUnit, s0=pItem, s1..s4=0, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 124u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 50 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 20 << 8, 0);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, (k == 1) ? g_item_rvs : g_item_hp4, 74u, 0u, 0u, 0u, 125u);
    uint32_t item = (k == 0) ? 0u : STAGE_UNIT2;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = item; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = item; ts[3] = 0; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    run_and_emit(0x6FCCEA40u, "ITEMS_UseFlatOrBuffPotion_6FCCEA40_113c", k,
                 k == 0 ? "null_item_ret0" : k == 1 ? "rejuv_potion_heal" : "hp4_potion_heal",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [17..18 skipped: 0x6FCCDEE0 & 0x6FCCDF20 hardcode skillId=0x2F (Fireball), blocked by 0x6FCC19A0 wDoFuncIdx dispatch parity gap] */

  /* [19] 0x6FCF5740 ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c (eax=pItem, ecx=pUnit, edx=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 131u);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_sword, 77u, (k == 1) ? 1u : 0u, 0u, 0u, 132u);
    if (k == 0) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_sword, 77u, 0u);
    } else {
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT2, 4);
      U32(STAGE_UNIT2 + 0x10u) = (k == 1) ? 1u : 0u;
    }
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x48, (k == 2) ? 5 : 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x49, 20, 0);
    c.eax = STAGE_UNIT2; c.ecx = STAGE_UNIT0; c.edx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_UNIT2; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCF5740u, "ITEMS_BreakEquippedItemAtZeroDurability_6FCF5740_113c", k,
                 k == 0 ? "mode0_break_dur0" : k == 1 ? "mode1_equipped_break" : "bodyloc_mode0_break",
                 &c, ts, 3, 0u, 0);
  }

  /* [20] 0x6FCEECE0 ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c (eax=nBodyLoc, ecx=pMerc, s0=pGame, s1=pPlayer, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 133u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 271u, 20u, 1u, 5002u, 5002u, 134u);
    void *pInvP = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInvP;
    if (k >= 1) {
      void *pInvM = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
      U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)pInvM;
      if (k == 2) {
        stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_sword, 78u, 0u, 0u, 0u, 135u);
        fn_PlaceItemInBodyLoc(pInvM, (void *)(uintptr_t)STAGE_UNIT2, 4);
        U32(STAGE_UNIT2 + 0x10u) = 0u; /* mode != 1 -> ret 2 */
      }
    }
    U32(STAGE_GAME + 0x70u) = (k == 0) ? 0u : 1u;
    uint32_t bodyLoc = (k == 1) ? 0u : 4u;
    c.eax = bodyLoc; c.ecx = STAGE_UNIT1;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = bodyLoc; ts[1] = STAGE_UNIT1; ts[2] = STAGE_GAME; ts[3] = STAGE_UNIT0;
    run_and_emit(0x6FCEECE0u, "ITEMS_UnequipMercBodyLocItemToPlayerCursor_6FCEECE0_113c", k,
                 k == 0 ? "classic_ret3" : k == 1 ? "bad_bodyloc_ret3" : "mode0_item_ret2",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [21] 0x6FCF3C40 ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c (eax=pScrollItem, ebx=pGame, edi=pUnit, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 136u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_isc, 79u, 4u, 0u, 0u, 137u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x46, 1, 0);
    if (k == 2) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_ibk, 80u, 0u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x46, 5, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      fn_SetCursorItem((void *)(uintptr_t)U32(STAGE_UNIT0 + 0x60u), (void *)(uintptr_t)STAGE_UNIT1);
    } else if (k == 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    }
    uint32_t g = (k == 0) ? 0u : STAGE_GAME;
    c.eax = STAGE_UNIT1; c.ebx = g; c.edi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_UNIT1; ts[1] = g; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCF3C40u, "ITEMS_FillTomeWithFirstMatchingScroll_6FCF3C40_113c", k,
                 k == 0 ? "null_game_assert" : k == 1 ? "no_tome_ret0" : "insert_isc_into_ibk",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }

  /* [22] 0x6FCCDBF0 ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0_113c (s0=pOwner, s1=pTarget, s2=0, s3=dwStatAndLayer, s4=0, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 138u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5010u, 5010u, 139u);
    uint32_t pSgpt = U32(0x6FDE9E1Cu + g_com_rebase);
    uint32_t shift = U32(pSgpt + 0x0C6Cu) & 0x1Fu;
    uint32_t layer = (0x2Au << shift) | 1u; /* Static Field lv 1 (srvDoFunc=20) */
    uint32_t packed = (195u << 16) | (layer & 0xFFFFu);
    if (k >= 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 195, 100, (int32_t)layer);
    link_room_units(STAGE_ROOM0, STAGE_UNIT0, STAGE_UNIT1);
    U16(STAGE_PATH0 + 0x10u) = 5008u;
    U16(STAGE_PATH0 + 0x12u) = 5008u;
    uint32_t owner = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t tgt = (k == 2) ? STAGE_UNIT1 : 0u;
    c.nargs = 5; c.args[0] = owner; c.args[1] = tgt; c.args[2] = 0u; c.args[3] = packed; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = owner; ts[1] = tgt; ts[2] = 0; ts[3] = packed; ts[4] = 0;
    run_and_emit(0x6FCCDBF0u, "ITEMEVENT_TriggerChanceToCastSkill_6FCCDBF0_113c", k,
                 k == 0 ? "null_owner_ret0" : k == 1 ? "coord_cast_100pct_ret1" : "target_cast_100pct_ret1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [23] 0x6FCF1E10 ITEMS_BuildItemDropParamsFromItem113c (esi=pOutDrop, ebx=pSourceItem, s0=pGame, s1=nClassId, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_sword, 81u, 3u, (uint16_t)(5000u + k * 10u), (uint16_t)(5010u + k * 5u), 140u + (uint32_t)k);
    U32(STAGE_UDATA2 + 0x2Cu) = (uint32_t)(25 + k * 15); /* dwItemLevel */
    U32(STAGE_UDATA2 + 0x0Cu) = 100u + (uint32_t)k; /* dwOwnerGUID */
    U16(STAGE_GAME + 0x78u) = (uint16_t)(100u + k);
    uint32_t clsId = g_item_ring + (uint32_t)k;
    c.esi = STAGE_SCRATCH; c.ebx = STAGE_UNIT2;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = clsId; c.calleePop = 8u;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_UNIT2; ts[2] = STAGE_GAME; ts[3] = clsId;
    run_and_emit(0x6FCF1E10u, "ITEMS_BuildItemDropParamsFromItem113c", k,
                 k == 0 ? "drop_params_ilvl25" : k == 1 ? "drop_params_ilvl40" : "drop_params_ilvl55",
                 &c, ts, 4, 0u, 0);
  }

  /* [24] 0x6FCDC6B0 ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c (ecx=pUnit, ebx=pItem, s0=pnOutFreeSpace, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 143u);
    uint32_t clsId = (k == 1) ? g_item_ring : (g_item_autost ? g_item_autost : g_item_jav);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, clsId, 82u, 3u, 5000u, 5000u, 144u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x46, 5, 0);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    }
    if (k == 2) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, clsId, 83u, 0u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x46, 10, 0);
    }
    c.ecx = STAGE_UNIT0; c.ebx = STAGE_UNIT1;
    c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FCDC6B0u, "ITEMS_FindAutoStackCompatItemInInventory_6FCDC6B0_113c", k,
                 k == 0 ? "no_inv_ret0" : k == 1 ? "non_stackable_ret0" : "autostack_scan",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [25] 0x6FCF5590 ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c (eax=pUnit, s0=pGame, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 145u);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    if (k == 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    } else if (k == 2) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_ring, 84u, 0u);
    }
    uint32_t u = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = u; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = u; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCF5590u, "ITEMS_StripAndEmptyUnitInventory_6FCF5590_113c", k,
                 k == 0 ? "null_unit_noop" : k == 1 ? "empty_inv" : "strip_inv_with_item",
                 &c, ts, 2, 0u, 0);
  }

  /* [26] 0x6FCCDDC0 ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0_113c (s0=pOwner, s1=pTarget, s2=pDmg, s3=packed, s4=0, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 146u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5010u, 5010u, 147u);
    uint32_t pSgpt = U32(0x6FDE9E1Cu + g_com_rebase);
    uint32_t shift = U32(pSgpt + 0x0C6Cu) & 0x1Fu;
    uint32_t layer = (0x2Au << shift) | 1u; /* Static Field lv 1 (srvDoFunc=20) */
    uint32_t packed = (198u << 16) | (layer & 0xFFFFu);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 198, 100, (int32_t)layer);
    link_room_units(STAGE_ROOM0, STAGE_UNIT0, STAGE_UNIT1);
    U8(STAGE_DMG + 0x00u) = (k == 0) ? 0x00u : 0x20u;
    U16(STAGE_PATH0 + 0x10u) = 5008u;
    U16(STAGE_PATH0 + 0x12u) = 5008u;
    uint32_t tgt = (k == 2) ? STAGE_UNIT1 : 0u;
    c.nargs = 5; c.args[0] = STAGE_UNIT0; c.args[1] = tgt; c.args[2] = STAGE_DMG; c.args[3] = packed; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = tgt; ts[2] = STAGE_DMG; ts[3] = packed; ts[4] = 0;
    run_and_emit(0x6FCCDDC0u, "ITEMEVENT_TriggerMeleeChanceToCastSkill_6FCCDDC0_113c", k,
                 k == 0 ? "dmg_no_bit20_ret0" : k == 1 ? "coord_trigger_ret1" : "target_trigger_ret1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [27] 0x6FCF4140 ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c (eax=pUnit, s0=pGame, ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 148u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    if (k == 2) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    } else if (k == 3) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_key, 85u, 0u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x46, 5, 0);
    }
    uint32_t g = (k == 0) ? 0u : STAGE_GAME;
    uint32_t u = (k == 1) ? 0u : STAGE_UNIT0;
    c.eax = u; c.nargs = 1; c.args[0] = g; c.calleePop = 4u;
    ts[0] = u; ts[1] = g;
    run_and_emit(0x6FCF4140u, "ITEMS_ConsumeSkeletonKeyFromInventory_6FCF4140_113c", k,
                 k == 0 ? "null_game_assert" : k == 1 ? "null_unit_assert" : k == 2 ? "no_key_ret0" : "dec_key_qty5_to_4_ret1",
                 &c, ts, 2, 0xFFFFFFFFu, (k <= 1) ? 1 : 0);
  }

  /* [28] 0x6FCCF210 ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c (ecx=pGame, s0=pAttacker, s1=pDefender, s2=0, s3=packed, s4=0, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 149u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5010u, 5010u, 150u);
    uint32_t packed = (155u << 16) | 1u; /* item_reanimate stat=155, monster class 1 */
    if (k >= 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 155, 100, 1);
    if (k == 1) U8(STAGE_UDATA1 + 0x16u) = 0x04u; /* boss/champion bit blocks reanimate */
    uint32_t att = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME;
    c.nargs = 5; c.args[0] = att; c.args[1] = STAGE_UNIT1; c.args[2] = 0u; c.args[3] = packed; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = att; ts[2] = STAGE_UNIT1; ts[3] = 0; ts[4] = 0; ts[5] = packed;
    run_and_emit(0x6FCCF210u, "ITEMEVENT_TryScheduleReanimateOnKill_6FCCF210_113c", k,
                 k == 0 ? "null_att_ret0" : k == 1 ? "boss_flag_ret0" : "schedule_reanimate_ret1",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [29] 0x6FCF3A10 ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c (s0=pGame, s1=pUnit, s2=pScrollItem, ret 0xC, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 151u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_isc, 86u, 3u, 5000u, 5000u, 152u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x46, 5, 0);
    if (k == 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
    } else if (k == 2) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_ibk, 87u, 0u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x46, 18, 0); /* 18+5=23 > 20 -> partial top-up */
    }
    uint32_t g = (k == 0) ? 0u : STAGE_GAME;
    c.nargs = 3; c.args[0] = g; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.calleePop = 0x0Cu;
    ts[0] = g; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    run_and_emit(0x6FCF3A10u, "ITEMS_AutoStackGroundScrollIntoInventoryTome_6FCF3A10_113c", k,
                 k == 0 ? "null_game_assert" : k == 1 ? "no_tome_ret0" : "overflow_tome_partial_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }

  /* [30] 0x6FCF3280 ITEMS_ClearInvalidRunewordOnItem_6FCF3280_113c (eax=pItemUnit, ecx=pOwnerUnit, s0=pGame, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 153u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    if (k == 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_sword, 88u, 0u, 0u, 0u, 153u);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT2, 4);
      U32(STAGE_UNIT2 + 0x10u) = 0u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    } else if (k == 2) {
      attach_cursor_item(STAGE_UNIT0, g_item_sword, 89u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    }
    uint32_t item = (k == 0) ? 0u : STAGE_UNIT2;
    c.eax = item; c.ecx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = item; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCF3280u, "ITEMS_ClearInvalidRunewordOnItem_6FCF3280_113c", k,
                 k == 0 ? "null_item_noop" : k == 1 ? "mode0_inv_remove" : "mode4_cursor_destroy",
                 &c, ts, 3, 0u, 0);
  }

  /* [31] 0x6FCCF370 ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c (ecx=pGame, edx=pUnit, s0=pItem, s1..s4=0, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 154u);
    if (k == 1) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 2, 1); /* poisoned */
    if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 1, 1); /* freeze */
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, (k == 1) ? g_item_yps : g_item_wms, 90u, 0u, 0u, 0u, 155u);
    uint32_t item = (k == 0) ? 0u : STAGE_UNIT2;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = item; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = item; ts[3] = 0; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    run_and_emit(0x6FCCF370u, "ITEMS_UseAntidoteOrThawingCurePotion_6FCCF370_113c", k,
                 k == 0 ? "null_item_ret0" : k == 1 ? "antidote_cure_buff_ret1" : "thawing_cure_buff_ret1",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [32] 0x6FCF1F60 ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c (edi=pItem, eax=pUnit, esi=pOutHandFlags, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pCls = (k == 2) ? 4u : 6u; /* Barb vs Assassin */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, pCls, 10u, 1u, 5000u, 5000u, 156u);
    uint32_t iCls = (k == 2) ? g_item_bow : (k == 3 ? g_item_claw : g_item_ring);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, iCls, 91u, 0u, 0u, 0u, 157u);
    uint32_t item = (k == 0) ? 0u : STAGE_UNIT2;
    uint32_t unit = (k == 1) ? 0u : STAGE_UNIT0;
    c.edi = item; c.eax = unit; c.esi = STAGE_SCRATCH; c.calleePop = 0u;
    ts[0] = item; ts[1] = unit; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FCF1F60u, "ITEMS_PopulateHandItemFlagsStrc_6FCF1F60_113c", k,
                 k == 0 ? "null_item_assert" : k == 1 ? "null_unit_assert" : k == 2 ? "barb_bow_flags" : "sin_claw_flags",
                 &c, ts, 3, 0u, (k <= 1) ? 1 : 0);
  }

  /* [33] 0x6FCCD580 ITEMMODS_ApplyMonsterFlee_6FCCD580_113c (ecx=pGame, edx=nAttackType, s0=pAttacker, s1=pDefender, s2=0, s3=nStatParam, s4=0, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 158u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5005u, 5005u, 159u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 30, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 200 << 8, 0);
    if (k >= 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 112, 128, 0); /* item_howl */
    uint32_t att = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t atkType = (k == 2) ? 6u : 1u;
    uint32_t statParam = (112u << 16);
    c.ecx = STAGE_GAME; c.edx = atkType;
    c.nargs = 5; c.args[0] = att; c.args[1] = STAGE_UNIT1; c.args[2] = 0u; c.args[3] = statParam; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = atkType; ts[2] = att; ts[3] = STAGE_UNIT1; ts[4] = 0; ts[5] = statParam; ts[6] = 0;
    run_and_emit(0x6FCCD580u, "ITEMMODS_ApplyMonsterFlee_6FCCD580_113c", k,
                 k == 0 ? "null_att_ret0" : k == 1 ? "melee_flee_proc_ret1" : "ranged_flee_proc_ret1",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [34] 0x6FCF36D0 ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c (edi=pTargetItem, s0=pGame, s1=pUnit, s2=pSourceItem, ret 0xC, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 160u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    uint32_t srcCls = (k == 0) ? g_item_ring : g_item_key;
    stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_key, 92u, 0u);
    attach_cursor_item(STAGE_UNIT0, srcCls, 93u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x46, (k == 1) ? 10 : 4, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x46, (k == 1) ? 5 : 3, 0);
    c.edi = STAGE_UNIT1;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT2; c.calleePop = 0x0Cu;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = STAGE_UNIT2;
    run_and_emit(0x6FCF36D0u, "ITEMS_MergeCursorStackIntoTargetStack_6FCF36D0_113c", k,
                 k == 0 ? "incompat_noop" : k == 1 ? "overflow_split_12_3" : "full_merge_7_clear_cursor",
                 &c, ts, 4, 0u, 0);
  }

  /* [35] 0x6FCF4230 ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c (eax=dwSrcGuid, ebx=dwDstGuid, s0=pGame, s1=pUnit, s2=pOutReject, ret 0xC, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 161u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, g_item_key, 94u, 0u);
    attach_cursor_item(STAGE_UNIT0, g_item_key, 95u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x46, 5, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x46, 4, 0);
    uint32_t g = (k == 0) ? 0u : STAGE_GAME;
    uint32_t srcG = (k == 1) ? 94u : 95u;
    uint32_t dstG = (k == 2) ? 999u : 94u;
    c.eax = srcG; c.ebx = dstG;
    c.nargs = 3; c.args[0] = g; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_SCRATCH; c.calleePop = 0x0Cu;
    ts[0] = srcG; ts[1] = dstG; ts[2] = g; ts[3] = STAGE_UNIT0; ts[4] = STAGE_SCRATCH;
    run_and_emit(0x6FCF4230u, "ITEMS_MergeCompatibleWeaponStackFromCursor_6FCF4230_113c", k,
                 k == 0 ? "null_game_assert" : k == 1 ? "same_guid_reject1" : k == 2 ? "missing_dst_reject1" : "merge_keys_ret1",
                 &c, ts, 5, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }

  /* [36] 0x6FCCCC30 ITEMMODS_ApplyCrushingBlow_6FCCCC30_113c (edx=nAttackType, s0=pAttacker, s1=pDefender, s2=pDamage, s3=nStatParam, s4=0, ret 0x14, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 162u);
    uint32_t defType = (k == 2) ? 0u : 1u;
    uint32_t defCls  = (k == 3) ? g_mon_boss : 1u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, defType, defCls, 20u, 1u, 5005u, 5005u, 163u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 400 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 400 << 8, 0);
    if (k == 3) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x24, 50, 0); /* 50% phys res */
    if (k >= 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 136, 100, 0); /* item_crushingblow */
    uint32_t att = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t atkType = (k == 3) ? 6u : 1u;
    uint32_t statParam = (136u << 16);
    c.edx = atkType;
    c.nargs = 5; c.args[0] = att; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_DMG; c.args[3] = statParam; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = atkType; ts[1] = att; ts[2] = STAGE_UNIT1; ts[3] = STAGE_DMG; ts[4] = statParam; ts[5] = 0;
    run_and_emit(0x6FCCCC30u, "ITEMMODS_ApplyCrushingBlow_6FCCCC30_113c", k,
                 k == 0 ? "null_att_ret0" : k == 1 ? "normal_mon_div4" : k == 2 ? "pvp_div10" : "ranged_boss_physres50",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [37] 0x6FCF6C80 ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c (esi=pPlayer, s0=pGame, s1=pGoldItem, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 164u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 10, 0); /* max gold = 100000 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, (k == 0) ? 1000 : (k == 1 ? 50000 : 99000), 0);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_gld, 96u, 3u, 5000u, 5000u, 165u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 14, (k == 2) ? 500 : 2500, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    c.esi = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT2; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT2;
    run_and_emit(0x6FCF6C80u, "ITEMS_PickupGoldItemAndDistributeOrDropRemainder_6FCF6C80_113c", k,
                 k == 0 ? "pickup_2500_from_1000" : k == 1 ? "pickup_2500_from_50000" : "pickup_500_near_cap",
                 &c, ts, 3, 0u, 0);
  }

  /* [38] 0x6FCCE4D0 ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c (ecx=pGame, edx=pUnit, s0=pItem, s1..s4=0, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 166u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 40 << 8, 0);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, (k == 1) ? g_item_vps : g_item_yps, 97u, 0u, 0u, 0u, 167u);
    uint32_t item = (k == 0) ? 0u : STAGE_UNIT2;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = item; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = item; ts[3] = 0; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    run_and_emit(0x6FCCE4D0u, "ITEMS_UseTimedStateBuffPotion_6FCCE4D0_113c", k,
                 k == 0 ? "null_item_ret0" : k == 1 ? "stamina_potion_ret1" : "antidote_buff_ret1",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [39] 0x6FCF2070 ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c (eax=pFirstInvItem, ebx=pCandItemsTxt, s0=pCandItem, ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 168u);
    uint32_t pItems = U32(0x6FDEFB98u + g_com_rebase);
    uint32_t invCls  = (k == 1) ? g_item_msf : (k == 2 ? g_item_qhr : g_item_ring);
    uint32_t candCls = (k == 1) ? g_item_hst : (k == 2 ? g_item_qf2 : g_item_ring);
    stage_inv_item(STAGE_UNIT0, STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, invCls, 98u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, candCls, 99u, 3u, 0u, 0u, 169u);
    if (k == 3 && g_uniq_carry1) {
      U32(STAGE_UDATA1 + 0x00u) = 7u; /* unique */
      U32(STAGE_UDATA1 + 0x34u) = g_uniq_carry1; /* dwItemCell / fileIndex */
      U32(STAGE_UDATA2 + 0x00u) = 7u;
      U32(STAGE_UDATA2 + 0x34u) = g_uniq_carry1;
    }
    uint32_t firstInv = (k == 0) ? 0u : STAGE_UNIT1;
    uint32_t candTxt = pItems + candCls * 0x1A8u;
    c.eax = firstInv; c.ebx = candTxt;
    c.nargs = 1; c.args[0] = STAGE_UNIT2; c.calleePop = 4u;
    ts[0] = firstInv; ts[1] = candTxt; ts[2] = STAGE_UNIT2;
    run_and_emit(0x6FCF2070u, "ITEMS_HasConflictingCarry1OrQuestItemInList_6FCF2070_113c", k,
                 k == 0 ? "empty_inv_ret0" : k == 1 ? "hst_vs_msf_conflict_ret1" : k == 2 ? "qf2_vs_qhr_conflict_ret1" : "carry1_unique_conflict_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [40] 0x6FCF1C00 ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c (eax=pInOutBodyLoc, ebx=pItem, esi=ppPri, s0=pUnit, s1=ppSec, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 10u, 1u, 5000u, 5000u, 170u); /* Barb */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, (k == 3) ? g_item_bow : g_item_sword, 100u, 1u, 0u, 0u, 171u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, (k == 3) ? g_item_aqv : g_item_shld, 101u, 4u, 0u, 0u, 172u);
    uint32_t pLoc = STAGE_SCRATCH + 0x00u;
    uint32_t ppPri = STAGE_SCRATCH + 0x04u;
    uint32_t ppSec = STAGE_SCRATCH + 0x08u;
    U32(pLoc)  = 4u; /* RARM */
    U32(ppPri) = (k == 1) ? 0u : STAGE_UNIT1;
    U32(ppSec) = (k == 0) ? STAGE_UNIT2 : 0u; /* k==0: both non-null -> ret 0 */
    c.eax = pLoc; c.ebx = STAGE_UNIT2; c.esi = ppPri;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = ppSec; c.calleePop = 8u;
    ts[0] = pLoc; ts[1] = STAGE_UNIT2; ts[2] = ppPri; ts[3] = STAGE_UNIT0; ts[4] = ppSec;
    run_and_emit(0x6FCF1C00u, "ITEMS_CanEquipPairedBodyLocItem_6FCF1C00_113c", k,
                 k == 0 ? "both_occupied_ret0" : k == 1 ? "both_empty_ret1" : k == 2 ? "sword_and_shield" : "bow_and_arrows",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }
}

static void stage_path_target(uint32_t pPath, uint32_t pTarget) {
  U32(pPath + 0x58u) = pTarget;
  if (pTarget != 0u) {
    U32(pPath + 0x5Cu) = U32(pTarget + 0x00u);
    U32(pPath + 0x60u) = U32(pTarget + 0x0Cu);
  } else {
    U32(pPath + 0x5Cu) = 0u;
    U32(pPath + 0x60u) = 0u;
  }
}

static uint32_t stage_used_skill(uint32_t pUnit, int32_t skillId, int32_t level) {
  void *pSkList = fn_AllocSkillList(NULL);
  U32(pUnit + 0xA8u) = (uint32_t)(uintptr_t)pSkList;
  fn_SetSkillLevel((void *)(uintptr_t)pUnit, skillId, level, 0, 0, 0);
  uint32_t pFirst = U32((uint32_t)(uintptr_t)pSkList + 0x04u);
  U32((uint32_t)(uintptr_t)pSkList + 0x10u) = pFirst;
  return pFirst;
}

static void emit_batch2_vas(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* B2 [1] 0x6FCD36A0 MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 201u);
    if (k >= 1) {
      stage_used_skill(STAGE_UNIT0, 0, 1);
    }
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 2u, 21u, 1u, 5010u, 5020u, 202u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    } else if (k == 3) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 5u, 22u, 0u, 5030u, 5040u, 203u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    run_and_emit(0x6FCD36A0u, "MONSTER_LockTargetUnitIntoSkillParamsAndSetPathPos_6FCD36A0_113c", k,
                 k == 0 ? "no_skill_ret0" : k == 1 ? "no_target_ret0" : k == 2 ? "dyn_target_lock" : "static_target_lock",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B2 [2] 0x6FCC09F0 STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 10u, 1u, 5000u, 5000u, 204u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5005u, 5005u, 205u);
    uint32_t sk = (k == 0) ? 8u : (k == 1 ? 12u : 28u);
    uint32_t lvl = (k == 0) ? 1u : (k == 1 ? 5u : 10u);
    uint32_t statId = (k == 2) ? 31u : 16u;
    uint32_t stateId = (k == 2) ? 15u : 12u;
    c.ecx = lvl; c.edx = sk; c.esi = 0u;
    c.nargs = 4; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_UNIT1; c.args[2] = statId; c.args[3] = stateId; c.calleePop = 0x10u;
    ts[0] = lvl; ts[1] = sk; ts[2] = 0; ts[3] = STAGE_UNIT0; ts[4] = STAGE_UNIT1; ts[5] = statId; ts[6] = stateId;
    run_and_emit(0x6FCC09F0u, "STATES_SetupAndCreateSkillAuraStatList_6FCC09F0_113c", k,
                 k == 0 ? "sk8_lvl1_st12" : k == 1 ? "sk12_lvl5_st12" : "sk28_lvl10_st15",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* B2 [3] 0x6FCD35A0 MONSTER_InitChargeOrLeapSkillTargetParams_6FCD35A0_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 206u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 33u, 1u, 5008u, 5008u, 207u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      stage_used_skill(STAGE_UNIT0, 12, 3);
    }
    if (k >= 2) {
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    int32_t sk = (k == 0) ? -1 : (k == 3 ? 28 : 12);
    int32_t lvl = (k == 3) ? 6 : 3;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = (uint32_t)lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = lvl;
    run_and_emit(0x6FCD35A0u, "MONSTER_InitChargeOrLeapSkillTargetParams_6FCD35A0_113c", k,
                 k == 0 ? "neg_sk_ret0" : k == 1 ? "no_target_ret0" : k == 2 ? "sk12_roll_ok" : "sk28_roll_ok",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B2 [4] 0x6FCD33B0 MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    uint32_t pRoom = (k == 0) ? 0u : STAGE_ROOM0;
    uint32_t uType = (k == 2) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, pRoom, uType, 1u, 20u, 1u, 5000u, 5000u, 208u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100, 0);
    if (k == 2) {
      U32(STAGE_GAME + 0xF0u) = STAGE_MONREG0;
      U32(STAGE_MONREG0 + 0x2D0u) = 5u; /* act active evil count */
    }
    c.eax = STAGE_GAME; c.esi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCD33B0u, "MONSTER_ReactivateOrResurrectInRoom_6FCD33B0_113c", k,
                 k == 0 ? "no_room_ret0" : k == 1 ? "player_reactivate" : "monster_resurrect",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* B2 [5] 0x6FD0DF60 MONSTER_FindValidFloorSpawnCoords113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    U32(STAGE_ROOM0 + 0x5Cu) = 998u; /* roomTileX -> (998+2)*5+3 = 5003 */
    U32(STAGE_ROOM0 + 0x60u) = 998u; /* roomTileY */
    U32(STAGE_ROOM0 + 0x6Cu) = 0x12345679u;
    U32(STAGE_ROOM0 + 0x70u) = 0x29Au;
    if (k >= 1) {
      uint32_t pTiles = STAGE_SCRATCH + 0x100u;
      uint32_t pFloorArr = STAGE_SCRATCH + 0x140u;
      uint32_t pTileEntry = STAGE_SCRATCH + 0x280u;
      U32(STAGE_ROOM0 + 0x08u) = pTiles;
      U32(pTiles + 0x08u) = pFloorArr;
      U32(pTiles + 0x0Cu) = 3u;
      U16(pTileEntry + 0x06u) = (k == 2) ? 0x0002u : 0x0000u;
      for (uint32_t f = 0; f < 3u; f++) {
        uint32_t ft = pFloorArr + f * 0x30u;
        U32(ft + 0x08u) = 2u;
        U32(ft + 0x0Cu) = 2u;
        U32(ft + 0x18u) = pTileEntry;
      }
    }
    uint32_t pOutX = STAGE_SCRATCH + 0x00u;
    uint32_t pOutY = STAGE_SCRATCH + 0x04u;
    c.nargs = 3; c.args[0] = STAGE_ROOM0; c.args[1] = pOutX; c.args[2] = pOutY; c.calleePop = 0x0Cu;
    ts[0] = STAGE_ROOM0; ts[1] = pOutX; ts[2] = pOutY;
    run_and_emit(0x6FD0DF60u, "MONSTER_FindValidFloorSpawnCoords113c", k,
                 k == 0 ? "no_tiles_ret0" : k == 1 ? "no_flag2_ret0" : "valid_floor_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* B2 [6] 0x6FD0DF20 MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 0u : 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 209u);
    /* Put subclass table on room/level: invalid classId (-1) for k==1, blocked collision for k==2 */
    if (k == 2) {
      /* Fill collision grid with solid wall so MONSTER_Create fails cleanly while still exercising DRLG resolve + ring search */
      uint32_t pGrid = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pBuf = U32(pGrid + 0x20u);
      for (uint32_t i = 0; i < 900u; i++) U16(pBuf + i * 2u) = 0xFFFFu;
    }
    uint32_t subIdx = (k == 1) ? 9999u : 0u;
    c.edi = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = STAGE_GAME; c.args[1] = subIdx; c.args[2] = 1u; c.args[3] = 2u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = 1; ts[2] = subIdx; ts[3] = STAGE_GAME; ts[4] = 2; ts[5] = 0;
    run_and_emit(0x6FD0DF20u, "MONSTER_SpawnSubClassMinionInRing_6FD0DF20_113c", k,
                 k == 0 ? "lvl0_ret0" : k == 1 ? "subidx_oob_ret0" : "subidx0_blocked_ret0",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* B2 [7] 0x6FD0DE90 MONSTER_SpawnMinionPackInRing_6FD0DE90_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 210u);
    if (k == 2) {
      uint32_t pGrid = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pBuf = U32(pGrid + 0x20u);
      for (uint32_t i = 0; i < 900u; i++) U16(pBuf + i * 2u) = 0xFFFFu;
    }
    uint32_t nCnt = (k == 1) ? 0u : 2u;
    uint32_t pLdr = (k == 0) ? 0u : STAGE_UNIT0;
    int32_t clsId = (k == 2) ? 1 : -1;
    c.eax = nCnt; c.ebx = STAGE_GAME; c.esi = pLdr;
    c.nargs = 4; c.args[0] = (uint32_t)clsId; c.args[1] = 1u; c.args[2] = 2u; c.args[3] = 0u; c.calleePop = 0x10u;
    ts[0] = nCnt; ts[1] = STAGE_GAME; ts[2] = pLdr; ts[3] = 1; ts[4] = clsId; ts[5] = 2; ts[6] = 0;
    run_and_emit(0x6FD0DE90u, "MONSTER_SpawnMinionPackInRing_6FD0DE90_113c", k,
                 k == 0 ? "null_leader_ret0" : k == 1 ? "zero_count_ret0" : "blocked_loop_ret0",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* B2 [8] 0x6FD0F8B0 MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    if (k == 2) {
      uint32_t pGrid = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pBuf = U32(pGrid + 0x20u);
      for (uint32_t i = 0; i < 900u; i++) U16(pBuf + i * 2u) = 0xFFFFu;
    }
    int32_t clsId = (k == 0) ? -1 : (k == 1 ? 9999 : 1);
    c.eax = (uint32_t)clsId; c.ecx = 1u; c.edx = STAGE_ROOM0; c.esi = STAGE_GAME;
    c.nargs = 5; c.args[0] = 5000u; c.args[1] = 5000u; c.args[2] = 2u; c.args[3] = 1u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = clsId; ts[1] = 1; ts[2] = STAGE_ROOM0; ts[3] = STAGE_GAME; ts[4] = 5000; ts[5] = 5000; ts[6] = 2; ts[7] = 1; ts[8] = 0;
    run_and_emit(0x6FD0F8B0u, "MONSTER_SpawnSelfOwnedLeader_6FD0F8B0_113c", k,
                 k == 0 ? "neg_class_ret0" : k == 1 ? "oob_class_ret0" : "blocked_room_ret0",
                 &c, ts, 9, 0xFFFFFFFFu, 0);
  }

  /* B2 [9] 0x6FD0F7D0 MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 211u);
    if (k == 2) {
      uint32_t pGrid = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pBuf = U32(pGrid + 0x20u);
      for (uint32_t i = 0; i < 900u; i++) U16(pBuf + i * 2u) = 0xFFFFu;
    }
    uint32_t nCnt = (k == 1) ? 0u : 2u;
    uint32_t pLdr = (k == 0) ? 0u : STAGE_UNIT0;
    int32_t clsId = (k == 2) ? 1 : -1;
    c.eax = nCnt; c.esi = STAGE_GAME;
    c.nargs = 7; c.args[0] = pLdr; c.args[1] = 5000u; c.args[2] = 5000u; c.args[3] = (uint32_t)clsId; c.args[4] = 1u; c.args[5] = 2u; c.args[6] = 0u; c.calleePop = 0x1Cu;
    ts[0] = nCnt; ts[1] = STAGE_GAME; ts[2] = pLdr; ts[3] = 5000; ts[4] = 5000; ts[5] = clsId; ts[6] = 1; ts[7] = 2; ts[8] = 0;
    run_and_emit(0x6FD0F7D0u, "MONSTER_SpawnMinionPackAtCoords_6FD0F7D0_113c", k,
                 k == 0 ? "null_leader_ret0" : k == 1 ? "zero_count_ret0" : "blocked_loop_ret0",
                 &c, ts, 9, 0xFFFFFFFFu, 0);
  }

  /* B2 [10] 0x6FD0E0A0 MONSTER_SpawnFetishPartyMinions113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 212u);
    if (k == 2) {
      uint32_t pGrid = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pBuf = U32(pGrid + 0x20u);
      for (uint32_t i = 0; i < 900u; i++) U16(pBuf + i * 2u) = 0xFFFFu;
    }
    uint32_t grp = (k == 2) ? 5u : (uint32_t)k; /* 5 clamps to 0 */
    uint32_t pLdr = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t nCnt = (k == 1) ? 0u : 2u;
    c.eax = grp;
    c.nargs = 6; c.args[0] = STAGE_GAME; c.args[1] = pLdr; c.args[2] = 1u; c.args[3] = 1u; c.args[4] = nCnt; c.args[5] = 0u; c.calleePop = 0x18u;
    ts[0] = grp; ts[1] = STAGE_GAME; ts[2] = pLdr; ts[3] = 1; ts[4] = 1; ts[5] = nCnt; ts[6] = 0;
    run_and_emit(0x6FD0E0A0u, "MONSTER_SpawnFetishPartyMinions113c", k,
                 k == 0 ? "null_leader_ret0" : k == 1 ? "seed_step_cnt0" : "clamp_grp_loop_blocked",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* B2 [11] 0x6FD0F6B0 MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    /* Level 1 (Rogue Encampment) has bNumMon == 0 -> assert 0x4F0; Level 2 (Blood Moor) has bNumMon > 0 */
    uint32_t lvlId = (k == 0) ? 1u : (k == 1 ? 2u : 3u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    U32(STAGE_ROOM0 + 0x6Cu) = 0x12345679u + (uint32_t)k * 77u;
    U32(STAGE_ROOM0 + 0x70u) = 0x29Au;
    /* Block grid so MONSTER_SpawnAtCoords returns 0 cleanly without needing full unit allocator */
    uint32_t pGrid = U32(STAGE_ROOM0 + 0x20u);
    uint32_t pBuf = U32(pGrid + 0x20u);
    for (uint32_t i = 0; i < 900u; i++) U16(pBuf + i * 2u) = 0xFFFFu;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = 5000u; c.args[3] = 5000u; c.calleePop = 0x10u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = 5000; ts[3] = 5000;
    run_and_emit(0x6FD0F6B0u, "MONSTER_SpawnRandomLevelMonAtCoords_6FD0F6B0_113c", k,
                 k == 0 ? "town_nummon0_assert4f0" : k == 1 ? "lvl2_roll_blocked" : "lvl3_roll_blocked",
                 &c, ts, 4, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }

  /* B2 [12] 0x6FCFE380 SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    /* UNIT0 = missile (type 3), UNIT1 = owner player (type 0), UNIT2 = target monster (type 1) */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 56u, 50u, 0u, 5000u, 5000u, 213u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 214u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5002u, 5002u, 215u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 6, 5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 7, 5000, 0);
    link_room_units(STAGE_ROOM0, STAGE_UNIT1, STAGE_UNIT2);
    if (k >= 1) {
      U32(STAGE_UNIT0 + 0xC8u) |= 0x400u; /* has owner */
      U32(STAGE_UNIT0 + 0x94u) = 0u; /* owner type = player */
      U32(STAGE_UNIT0 + 0x98u) = 10u; /* owner guid */
    }
    if (k == 2) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      U32(STAGE_DMG + 0x00u) = 0x00000001u;
      U32(STAGE_DMG + 0x08u) = 256u; /* phys dmg */
    }
    c.nargs = 10;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = 5000u; c.args[3] = 5000u; c.args[4] = 8u;
    c.args[5] = STAGE_DMG; c.args[6] = 0u; c.args[7] = 0u; c.args[8] = 0u; c.args[9] = 0u;
    c.calleePop = 0x28u;
    for (int i = 0; i < 10; i++) ts[i] = c.args[i];
    run_and_emit(0x6FCFE380u, "SUNITDMG_ApplyRadialMissileSplashDamage_6FCFE380_113c", k,
                 k == 0 ? "no_owner_flag_ret0" : k == 1 ? "owner_missing_ret0" : "splash_hit_ret1",
                 &c, ts, 10, 0xFFFFFFFFu, 0);
  }

  /* B2 [13] 0x6FCC1600 SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 10u, 1u, 5000u, 5000u, 216u);
    stage_used_skill(STAGE_UNIT0, 0, 1);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    if (k == 1) {
      /* Equip javelin (throwable, qty 5) in right hand (bodyLoc 4) -> returns 1 */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_jav, 50u, 1u, 0u, 0u, 217u);
      U8(STAGE_UDATA1 + 0x45u) = 4u;
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 70, 5, 0);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4);
    } else if (k == 2) {
      /* Equip non-throwable 1H sword (durability 10/10) -> returns 0 cleanly (broken sword hits TS 0x6FC98A90 parity bug) */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_sword, 51u, 1u, 0u, 0u, 218u);
      U8(STAGE_UDATA1 + 0x45u) = 4u;
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 72, 10, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 73, 10, 0);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FCC1600u, "SKILLS_EnsureWeaponOrQuiverElseStartModeCast_6FCC1600_113c", k,
                 k == 0 ? "unarmed_ret0" : k == 1 ? "equipped_jav_ret1" : "equipped_1h_sword_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B2 [14] 0x6FCD4660 SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 219u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5001u, 5001u, 220u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 1) {
      stage_path_target(STAGE_PATH0, STAGE_UNIT0); /* self -> ret 0 */
    } else if (k == 2) {
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    uint32_t sk = (k == 2) ? 0u : 6u; /* skill 0 Attack has SrvSt=0 or simple */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = sk; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 1;
    run_and_emit(0x6FCD4660u, "SKILLS_SrvDo113_ExecuteCombatAndRestartSkill_6FCD4660_113c", k,
                 k == 0 ? "no_target_ret0" : k == 1 ? "self_target_ret0" : "hit_and_restart",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B2 [15] 0x6FCC1280 SKILLS_RespecPlayerClassSkills_6FCC1280_113c (eax=pPlayer, s0=pGame, ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 1) ? 1u : 0u;
    uint32_t cls = (k == 3) ? 0u : 1u; /* 1=Sorc, 0=Ama */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, cls, 10u, 1u, 5000u, 5000u, 221u);
    if (k >= 2) {
      /* Leave pClient == 0 to avoid NET_SendPacket21 (0x6FCAD5F0) TS m.alloc(0x0c) parity bug while exercising full respec loop */
      fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      void *pSkList = fn_AllocSkillList(NULL);
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)pSkList;
      if (k == 2) {
        fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 36, 3, 0, 0, 0); /* Sorc Fire Bolt lvl 3 */
      } else {
        fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 6, 2, 0, 0, 0);  /* Ama Magic Arrow lvl 2 */
        fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, 7, 4, 0, 0, 0);  /* Ama Fire Arrow lvl 4 */
      }
    }
    uint32_t plr = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = plr; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = plr; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCC1280u, "SKILLS_RespecPlayerClassSkills_6FCC1280_113c", k,
                 k == 0 ? "null_noop" : k == 1 ? "mon_noop" : k == 2 ? "sorc_respec_3pts" : "ama_respec_6pts",
                 &c, ts, 2, 0u, 0);
  }

  /* B2 [16] 0x6FCD3890 SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 222u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5005u, 5005u, 223u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    if (k == 2) {
      stage_used_skill(STAGE_UNIT0, 0, 1);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FCD3890u, "SKILLS_SrvSt58_ComputeApproachPathToTarget_6FCD3890_113c", k,
                 k == 0 ? "no_target_ret0" : k == 1 ? "no_skill_ret0" : "compute_path_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B2 [17] 0x6FCC34E0 SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c (ebx=pGame, s0=pCaster, s1=pTarget, s2=nState, s3=nSkillId, s4=nSkillLevel, ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 10u, 1u, 5000u, 5000u, 224u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 11u, 1u, 5002u, 5002u, 225u);
    int32_t sk = (k == 0) ? -1 : (k == 1 ? 99 : 103); /* Prayer / Thorns */
    uint32_t st = (k == 1) ? 34u : 36u;
    uint32_t caster = (k == 2) ? 0u : STAGE_UNIT0;
    c.ebx = STAGE_GAME;
    c.nargs = 5; c.args[0] = caster; c.args[1] = STAGE_UNIT1; c.args[2] = st; c.args[3] = (uint32_t)sk; c.args[4] = 5u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = caster; ts[2] = STAGE_UNIT1; ts[3] = st; ts[4] = sk; ts[5] = 5;
    run_and_emit(0x6FCC34E0u, "SKILLS_CreateTimedAuraStatListOnTarget_6FCC34E0_113c", k,
                 k == 0 ? "neg_sk_ret0" : k == 1 ? "prayer_from_caster" : "thorns_null_caster",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* B2 [18] 0x6FCC2EE0 SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c (esi=pUnit, ecx=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 226u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 2u, 21u, (k == 2) ? 12u : 1u, 5002u, 5002u, 227u);
    U32(STAGE_UDATA0 + 0x40u) = 21u; /* linked target guid */
    if (k == 1) {
      U32(STAGE_UDATA1 + 0x30u) = STAGE_SCRATCH + 0x100u; /* valid pInteract for MONSTER_FreeInteractData */
      U32(STAGE_UNIT1 + 0xC8u) |= 0x100u; /* summon flag -> SUNIT_FreeUnit */
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    } else if (k == 2) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT1); /* non-summon -> flag 0x4000000 + exp */
    }
    c.esi = STAGE_UNIT0; c.ecx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCC2EE0u, "SKILLS_FreeOrDistributeExpForLinkedMonster_6FCC2EE0_113c", k,
                 k == 0 ? "guid_missing_clr" : k == 1 ? "summon_free_unit" : "nonsummon_flag_exp",
                 &c, ts, 2, 0u, 0);
  }

  /* B2 [19] 0x6FCD4D30 SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 228u);
    /* k=0: neg skill -> ret 0; k=1: skill 0 (srvMissile=-1) -> ret 0; k=2: skill 38 (srvMissile=56) with no target -> sets flag 0x40 & ret 0 */
    int32_t sk = (k == 0) ? -1 : (k == 1 ? 0 : 38);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 3;
    run_and_emit(0x6FCD4D30u, "SKILLS_SrvDo132_SpawnNovaWithCalcSubLoopFrames_6FCD4D30_113c", k,
                 k == 0 ? "neg_sk_ret0" : k == 1 ? "no_missile_ret0" : "flag40_no_target_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B2 [20] 0x6FCCDB30 SKILLS_RestartAuraEvent9AndTriggerOnSkillChange_6FCCDB30_113c (edi=pUnit, s0=pGame, s1=nEventArg14, s2=nSkillId, s3=nSkillLevel, ret 0x10, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 10u, 1u, 5000u, 5000u, 229u);
    /* k=0: non-aura skill 36 -> noop; k=1: Prayer (99, f0=0x20, f1=0x05, no 0x80 trigger) -> schedules event 9; k=2: Thorns (103, f0=0x20, f1=0x05) -> schedules event 9 at different frame/arg */
    uint32_t sk = (k == 0) ? 36u : (k == 1 ? 99u : 103u);
    uint32_t arg14 = (k == 2) ? 7u : 3u;
    c.edi = STAGE_UNIT0;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = arg14; c.args[2] = sk; c.args[3] = 5u; c.calleePop = 0x10u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = arg14; ts[3] = sk; ts[4] = 5;
    run_and_emit(0x6FCCDB30u, "SKILLS_RestartAuraEvent9AndTriggerOnSkillChange_6FCCDB30_113c", k,
                 k == 0 ? "non_aura_noop" : k == 1 ? "prayer_ev9" : "thorns_ev9",
                 &c, ts, 5, 0u, 0);
  }

  /* B2 [21] 0x6FCC0E80 SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 230u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5001u, 5001u, 231u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    uint32_t sk = (k == 2) ? 36u : 12u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = sk; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 1;
    run_and_emit(0x6FCC0E80u, "SKILLS_AllocSkillMinDamCombatOnPathTarget_6FCC0E80_113c", k,
                 k == 0 ? "no_target_ret0" : k == 1 ? "sk12_alloc_combat" : "sk36_alloc_combat",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* (Note: 0x6FCC1350 skipped — D2Common.#10601 Fog TxtLink ptr 0x020B0EA0 is outside PAGEIMG snapshot) */

  /* B2 [23] 0x6FCC26E0 SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c (esi=pMissileParams, s0=pGame, s1=nCount, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* Missile params at STAGE_SCRATCH with invalid missileId (-1) so MISSILE_CreateServerProjectile returns 0 cleanly while recording final dx/dy in pMissileParams+0x1c/+0x20! */
    uint32_t pPar = STAGE_SCRATCH;
    S32(pPar + 0x0Cu) = -1; /* invalid missile id -> safe no-op return 0 */
    uint32_t nCnt = (k == 0) ? 1u : (k == 1 ? 3u : 10u);
    c.esi = pPar; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = nCnt; c.calleePop = 8u;
    ts[0] = pPar; ts[1] = STAGE_GAME; ts[2] = nCnt;
    run_and_emit(0x6FCC26E0u, "SKILLS_SpawnBurstProjectilesPattern_6FCC26E0_113c", k,
                 k == 0 ? "count1_center" : k == 1 ? "count3_ring0" : "count10_ring1",
                 &c, ts, 3, 0u, 0);
  }

  /* B2 [24] 0x6FCD46B0 SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 233u);
    link_room_units(STAGE_ROOM0, STAGE_UNIT0, 0u);
    /* First path point lives at pPath + 0x10 (wTargetX) / +0x12 (wTargetY) or pPoints; let's check PATH_GetFirstPointX -> pPath + 0x08/0x0C? No, pPath + 0x10/+0x12! */
    U16(STAGE_PATH0 + 0x10u) = (k == 0) ? 100u : (k == 1 ? 5008u : 5012u);
    U16(STAGE_PATH0 + 0x12u) = (k == 0) ? 100u : (k == 1 ? 5006u : 5010u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FCD46B0u, "SKILLS_SrvDo_TeleportMonsterToFirstPathPoint_6FCD46B0_113c", k,
                 k == 0 ? "oob_target_ret0" : k == 1 ? "warp_5008_5006" : "warp_5012_5010",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B2 [25] 0x6FCC37D0 SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c (ecx=pGame, edx=pUnit, s0=nEventArg, s1=nSkillId, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 10u, 1u, 5000u, 5000u, 234u);
    if (k == 1) {
      /* Dead unit -> deletes event 9 instead of rescheduling */
      U32(STAGE_UNIT0 + 0x10u) = 0u; /* PLRMODE_DEATH */
    }
    if (k == 2) {
      /* Living unit with item_aura stat 0x97 for skill 99 (Prayer, wDoFuncIdx = 65 -> wired in TS!) */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x97, 5, 99);
    }
    int32_t sk = (k == 0) ? -1 : 99;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 3u; c.args[1] = (uint32_t)sk; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 3; ts[3] = sk;
    run_and_emit(0x6FCC37D0u, "SKILLS_OnPeriodicItemAuraEvent9_6FCC37D0_113c", k,
                 k == 0 ? "neg_sk_del_ev9" : k == 1 ? "dead_del_ev9" : "active_prayer_resched",
                 &c, ts, 4, 0u, 0);
  }

  /* B2 [26] 0x6FCD4760 SKILLS_SrvDo_SubmergeOrBurrowMonster_6FCD4760_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    uint32_t pRoom = (k == 0) ? 0u : STAGE_ROOM0;
    uint16_t px = (k == 2) ? 5008u : 5002u;
    uint16_t py = (k == 2) ? 5008u : 5002u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, pRoom, 1u, 1u, 20u, 1u, px, py, 235u);
    if (k >= 1) {
      link_room_units(STAGE_ROOM0, STAGE_UNIT0, 0u);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 1;
    run_and_emit(0x6FCD4760u, "SKILLS_SrvDo_SubmergeOrBurrowMonster_6FCD4760_113c", k,
                 k == 0 ? "no_room_ret0" : k == 1 ? "burrow_5002" : "burrow_5008",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B2 [27] 0x6FCC3120 SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c (eax=nSkillId, ecx=nSkillLevel, s0=pGame, s1=pUnit, s2=nEvalSkillLevel, s3=bUseEvent8, ret 0x10) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 10u, 1u, 5000u, 5000u, 236u);
    int32_t sk = (k == 0) ? -1 : (k == 1 ? 36 : (k == 2 ? 99 : 57)); /* -1, FireBolt(non-periodic), Prayer(aura), ThunderStorm(periodic) */
    uint32_t useEv8 = (k == 3) ? 1u : 0u;
    c.eax = (uint32_t)sk; c.ecx = 4u;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = 5u; c.args[3] = useEv8; c.calleePop = 0x10u;
    ts[0] = sk; ts[1] = 4; ts[2] = STAGE_GAME; ts[3] = STAGE_UNIT0; ts[4] = 5; ts[5] = useEv8;
    run_and_emit(0x6FCC3120u, "SKILLS_SchedulePeriodicSkillEvent_6FCC3120_113c", k,
                 k == 0 ? "neg_sk_ret0" : k == 1 ? "non_periodic_ret0" : k == 2 ? "prayer_ev9" : "tstorm_ev8",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* B2 [28] 0x6FCCE0E0 SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0_113c (ecx=pGame, edx=nEventType, s0=pAttacker, s1=pDefender, s2=0, s3=dwStatAndLayer, s4=0, ret 0x14) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 237u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0) ? 0u : 1u, 1u, 20u, 1u, 5002u, 5002u, 238u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 50, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 5, 0);
    if (k >= 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 134, 20, 0); /* item_hitblindstarget */
    }
    uint32_t evType = (k == 3) ? 6u : 5u;
    uint32_t statLayer = (134u << 16);
    c.ecx = STAGE_GAME; c.edx = evType;
    c.nargs = 5; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_UNIT1; c.args[2] = 0u; c.args[3] = statLayer; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = evType; ts[2] = STAGE_UNIT0; ts[3] = STAGE_UNIT1; ts[4] = 0; ts[5] = statLayer; ts[6] = 0;
    run_and_emit(0x6FCCE0E0u, "SKILLS_OnHitEffect_HitBlindsTarget_6FCCE0E0_113c", k,
                 k == 0 ? "def_player_ret0" : k == 1 ? "zero_stat_ret0" : k == 2 ? "melee_blind_proc" : "ranged_ev6_blind_proc",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* B2 [29] 0x6FCD5D40 SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 239u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 2u, 21u, (k == 3) ? 12u : 1u, 5002u, 5002u, 240u);
    if (k == 3) {
      U32(STAGE_UDATA1 + 0x30u) = STAGE_SCRATCH + 0x100u; /* valid pInteract for SUNIT_FreeUnit */
    }
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 10000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 2000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 4000, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 2) {
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    int32_t sk = (k == 0) ? -1 : 12;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 5;
    run_and_emit(0x6FCD5D40u, "SKILLS_SrvDo138_ConsumeCorpseAndHealCaster_6FCD5D40_113c", k,
                 k == 0 ? "neg_sk_ret0" : k == 1 ? "no_target_ret0" : k == 2 ? "alive_mon_ret0" : "consume_corpse_heal",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B2 [30] 0x6FCD41B0 SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 241u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5001u, 5001u, 242u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 500, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 31, 50, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) {
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    int32_t sk = (k == 0) ? -1 : 12;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 3;
    run_and_emit(0x6FCD41B0u, "SKILLS_SrvDo_MonsterOrFeralRageMeleeHit_6FCD41B0_113c", k,
                 k == 0 ? "neg_sk_ret0" : k == 1 ? "no_target_ret0" : "mon_melee_alloc_combat",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B2 [31] 0x6FCED790 SKILLS_TestPathReachableToCoords_6FCED790_113c (eax=targetY, ecx=targetX, s0=pGame, s1=pUnit, ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 243u);
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1); /* uninterruptable/frozen state 0x36 -> ret 0 */
    }
    uint32_t tx = (k == 0) ? 100u : (k == 2 ? 5005u : 5010u);
    uint32_t ty = (k == 0) ? 100u : (k == 2 ? 5005u : 5000u);
    if (k == 3) {
      /* Wall blocking 5005,5000 -> unreachable -> ret 0 (restores path) */
      uint32_t pGrid = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pBuf = U32(pGrid + 0x20u);
      for (uint32_t yy = 0; yy < 30u; yy++) U16(pBuf + (yy * 30u + 15u) * 2u) = 0x0409u;
    }
    c.eax = ty; c.ecx = tx;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = ty; ts[1] = tx; ts[2] = STAGE_GAME; ts[3] = STAGE_UNIT0;
    run_and_emit(0x6FCED790u, "SKILLS_TestPathReachableToCoords_6FCED790_113c", k,
                 k == 0 ? "oob_ret0" : k == 1 ? "state36_ret0" : k == 2 ? "reachable_ret1" : "wall_blocked_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }
}

/* =========================================================================
 * BATCH 3 (41 VAs): Party/Player/Client (5) + Combat/SUnitDmg (5)
 *                   + Items/Cube/Trade (7) + Skills (1) + Quests (23)
 * ========================================================================= */
static void emit_batch3_vas(void) {
  X86CallSpec c;
  int64_t ts[12];

  /* B3 [1] 0x6FD08EB0 D2Game_6FD08EB0_113c (ecx=pObjInteractArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 79u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 40u, 0u, 5000u, 5000u, 301u);
    uint32_t pArg = STAGE_SCRATCH;
    U32(pArg + 0x00u) = STAGE_GAME;
    U32(pArg + 0x04u) = STAGE_UNIT0;
    U32(pArg + 0x08u) = STAGE_ROOM0;
    U32(pArg + 0x14u) = 5012u;
    U32(pArg + 0x18u) = 5024u;
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 2) ? 1u : 0u;
    }
    c.ecx = pArg; c.calleePop = 0u;
    ts[0] = pArg;
    run_and_emit(0x6FD08EB0u, "D2Game_6FD08EB0_113c", k,
                 k == 0 ? "no_quest_mode2" : k == 1 ? "flag09_zero_mode2" : "active_save_coords",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [2] 0x6FD10B10 PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c (ecx=pGame, edx=pExistingPlayer, s0=pJoiningPlayer, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 302u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 11u, 1u, 5002u, 5002u, 303u);
    if (k == 2) {
      stage_subparty(3u, 10u, 0u);
    }
    uint32_t pJoin = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pJoin; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pJoin;
    run_and_emit(0x6FD10B10u, "PARTY_InitPlayerRelationOnJoinCallback_6FD10B10_113c", k,
                 k == 0 ? "self_join_rel1" : k == 1 ? "other_noparty_rel0" : "other_inparty_rel1",
                 &c, ts, 3, 0u, 0);
  }

  /* B3 [3] 0x6FD10A70 PARTY_DispatchRelationAction_6FD10A70_113c (eax=dwTargetGuid, ebx=nActionIdx, edi=pGame, s0=pSourcePlayer, s1=dwExtraArg, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 304u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 11u, 1u, 5002u, 5002u, 305u);
    if (k == 2) {
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t pGame = (k == 0) ? 0u : STAGE_GAME;
    uint32_t actIdx = (k == 2) ? 0u : 1u; /* table[0] == NULL -> returns 0 cleanly */
    c.eax = 11u; c.ebx = actIdx; c.edi = pGame;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = 11; ts[1] = actIdx; ts[2] = pGame; ts[3] = STAGE_UNIT0; ts[4] = 0;
    run_and_emit(0x6FD10A70u, "PARTY_DispatchRelationAction_6FD10A70_113c", k,
                 k == 0 ? "null_game_assert2d3" : k == 1 ? "target_missing_ret0" : "idx0_null_handler_ret0",
                 &c, ts, 5, 0xFFFFFFFFu, (k == 0) ? 1 : 0);
  }

  /* B3 [4] 0x6FCECA00 PACKET_DeliverChatIfNotSquelched_6FCECA00_113c (ecx=pClient, edx=pChatDesc, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 306u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    memcpy((void *)(uintptr_t)(STAGE_CLIENT0 + 0x0Du), "Hero", 5);
    uint32_t pDesc = STAGE_SCRATCH + 0x00u;
    uint32_t pRaw  = STAGE_SCRATCH + 0x100u;
    uint32_t pMsg  = STAGE_SCRATCH + 0x300u;
    U32(pDesc + 0x00u) = pMsg;
    U32(pDesc + 0x04u) = pRaw;
    U32(pDesc + 0x08u) = (k == 2) ? 10u : 0xFFFFFFFFu;
    if (k == 1) {
      memcpy((void *)(uintptr_t)(pRaw + 0x103u), "Other", 6);
    } else {
      memcpy((void *)(uintptr_t)(pRaw + 0x103u), "Hero", 5);
    }
    if (k == 2) {
      U32(STAGE_CLIENT0 + 0x1A8u) = 0u; /* null pGame with senderGuid != -1 -> assert 0x2D3 */
    }
    uint32_t pCli = (k == 0) ? 0u : STAGE_CLIENT0;
    c.ecx = pCli; c.edx = pDesc; c.calleePop = 0u;
    ts[0] = pCli; ts[1] = pDesc;
    run_and_emit(0x6FCECA00u, "PACKET_DeliverChatIfNotSquelched_6FCECA00_113c", k,
                 k == 0 ? "null_client_assert996" : k == 1 ? "name_mismatch_noop" : "null_game_assert2d3",
                 &c, ts, 2, 0u, (k == 0 || k == 2) ? 1 : 0);
  }

  /* B3 [5] 0x6FCF00A0 PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c (ecx=pGame, edx=pUnit, s0=pPacket, s1=nPacketSize, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 307u);
    uint32_t pPkt = STAGE_SCRATCH;
    U8(pPkt + 0u) = 0x14u;
    U8(pPkt + 1u) = 0x00u;
    U8(pPkt + 2u) = 0x01u;
    uint32_t sz = 12u;
    if (k == 0) {
      sz = 3u;
    } else if (k == 1) {
      memset((void *)(uintptr_t)(pPkt + 3u), 'A', 260);
      U8(pPkt + 263u) = 0u;
      sz = 270u;
    } else {
      U8(pPkt + 3u) = 'H'; U8(pPkt + 4u) = 0xFFu; U8(pPkt + 5u) = 0u;
      sz = 8u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = pPkt; c.args[1] = sz; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pPkt; ts[3] = sz;
    run_and_emit(0x6FCF00A0u, "PACKET_C2S14_SetUnitOverheadChat_6FCF00A0_113c", k,
                 k == 0 ? "short_pkt_ret3" : k == 1 ? "msg_too_long_ret2" : "ff_byte_skip_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* Removed SUNITDMG_OpenMatchingObjectAtUnitPos (TS UNITS_ChangeAnimMode113c skips pUnit+0x44..0x54 animdata refresh). */

  /* B3 [7] 0x6FCCFC50 MONSTER_MorphMonsterClassId_6FCCFC50_113c (eax=pUnit, s0=pGame, s1=nNewClassId, s2=nAnimMode, ret 0xC, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uType = (k == 1) ? 0u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 20u, 1u, 5000u, 5000u, 310u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    int32_t newCls = (k == 2) ? 9999 : 2;
    c.eax = pU;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = (uint32_t)newCls; c.args[2] = 1u; c.calleePop = 0x0Cu;
    ts[0] = pU; ts[1] = STAGE_GAME; ts[2] = newCls; ts[3] = 1;
    run_and_emit(0x6FCCFC50u, "MONSTER_MorphMonsterClassId_6FCCFC50_113c", k,
                 k == 0 ? "null_unit_ret0" : k == 1 ? "player_ret0" : "oob_class_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B3 [8] 0x6FD0FB80 MONSTER_SpawnFallenShamanPack_6FD0FB80_113c (eax=pUnit, ecx=nClassId, s0=pGame, s1=pRoom, s2=0, s3=0, s4=dwSpawnFlags, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    uint32_t pGrid = U32(STAGE_ROOM0 + 0x20u);
    uint32_t pBuf = U32(pGrid + 0x20u);
    for (uint32_t i = 0; i < 900u; i++) U16(pBuf + i * 2u) = 0xFFFFu;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 2) ? 2u : 1u, 1u, 20u, 1u, 5000u, 5000u, 311u);
    uint32_t clsId = (k == 0) ? 1u : 0x154u;
    uint32_t pU = (k == 1) ? 0u : STAGE_UNIT0;
    c.eax = pU; c.ecx = clsId;
    c.nargs = 5; c.args[0] = STAGE_GAME; c.args[1] = STAGE_ROOM0; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = pU; ts[1] = clsId; ts[2] = STAGE_GAME; ts[3] = STAGE_ROOM0; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    run_and_emit(0x6FD0FB80u, "MONSTER_SpawnFallenShamanPack_6FD0FB80_113c", k,
                 k == 0 ? "wrong_cls_ret0" : k == 1 ? "null_unit_ret0" : "shaman_pack_blocked_ret0",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* Removed SUNITDMG_OnStunOrFreezeEndNeutralCallback (TS UNITS_ChangeAnimMode113c skips pUnit+0x44..0x54 animdata refresh). */

  /* B3 [10] 0x6FD0F940 MONSTER_SpawnPresetPackTable_6FD0F940_113c (eax=pPackTable, ecx=pGame, ebx=nDefaultMode, s0=pRoom, s1=baseX, s2=baseY, s3=pOwnerUnit, s4=nBaseClassId, s5=dwSpawnFlags, ret 0x18, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    uint32_t pGrid = U32(STAGE_ROOM0 + 0x20u);
    uint32_t pBuf = U32(pGrid + 0x20u);
    for (uint32_t i = 0; i < 900u; i++) U16(pBuf + i * 2u) = 0xFFFFu;
    uint32_t pTbl = STAGE_SCRATCH;
    if (k == 0) {
      U32(pTbl + 0x00u) = 0u; /* 0 entries */
    } else {
      U32(pTbl + 0x00u) = 2u; /* 2 entries */
      U8(pTbl + 0x08u)  = (k == 1) ? 1u : 0u;
      S32(pTbl + 0x0Cu) = 1; S32(pTbl + 0x10u) = 1; U32(pTbl + 0x14u) = (k == 1) ? 0u : 2u;
      S32(pTbl + 0x18u) = 2; S32(pTbl + 0x1Cu) = 2; U32(pTbl + 0x20u) = (k == 1) ? 1u : 3u;
    }
    int32_t baseCls = (k == 1) ? -1 : 1;
    c.eax = pTbl; c.ecx = STAGE_GAME; c.ebx = 8u;
    c.nargs = 6; c.args[0] = STAGE_ROOM0; c.args[1] = 5000u; c.args[2] = 5000u; c.args[3] = 0u; c.args[4] = (uint32_t)baseCls; c.args[5] = 0u; c.calleePop = 0x18u;
    ts[0] = pTbl; ts[1] = STAGE_ROOM0; ts[2] = STAGE_GAME; ts[3] = 5000; ts[4] = 5000; ts[5] = baseCls; ts[6] = 0; ts[7] = 8; ts[8] = 0;
    run_and_emit(0x6FD0F940u, "MONSTER_SpawnPresetPackTable_6FD0F940_113c", k,
                 k == 0 ? "empty_table_ret0" : k == 1 ? "invalid_cls_case01" : "blocked_case23",
                 &c, ts, 9, 0xFFFFFFFFu, 0);
  }

  /* B3 [11] 0x6FCCDEE0 ITEMS_SpellCastFireballAtCoords_6FCCDEE0_113c (ecx=pGame, edx=pPlayer, s0=pItem, s1=0, s2=nX, s3=nY, s4=0, ret 0x14, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 313u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 50u, 4u, 0u, 0u, 314u);
    if (k == 1) {
      U32(STAGE_UNIT0 + 0x80u) = 0u; /* null pGame on caster -> 0x6FD11730 returns 0 cleanly */
    } else if (k == 2) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1); /* state 0x36 blocks triggered cast */
    }
    uint32_t pItem = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = pItem; c.args[1] = 0u; c.args[2] = 5005u; c.args[3] = 5006u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pItem; ts[3] = 0; ts[4] = 5005; ts[5] = 5006; ts[6] = 0;
    run_and_emit(0x6FCCDEE0u, "ITEMS_SpellCastFireballAtCoords_6FCCDEE0_113c", k,
                 k == 0 ? "null_item_noop" : k == 1 ? "caster_null_game" : "caster_state36_blocked",
                 &c, ts, 7, 0u, 0);
  }

  /* B3 [12] 0x6FCCDF20 ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20_113c (ecx=pGame, edx=pPlayer, s0=pItem, s1..s4=0, ret 0x14, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 315u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 50u, 4u, 0u, 0u, 316u);
    if (k == 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1); /* path coord fallback blocked by state 0x36 */
    } else if (k == 2) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5003u, 5003u, 317u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      stage_path_target(STAGE_PATH0, STAGE_UNIT2);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1); /* target branch blocked by state 0x36 */
    }
    uint32_t pItem = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = pItem; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pItem; ts[3] = 0; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    run_and_emit(0x6FCCDF20u, "ITEMS_SpellCastFireballAtTargetOrPath_6FCCDF20_113c", k,
                 k == 0 ? "null_item_noop" : k == 1 ? "no_target_state36" : "with_target_state36",
                 &c, ts, 7, 0u, 0);
  }

  /* Removed ITEMS_SetDroppedItemGroundModeAndRefreshOwner (TS UNITS_ChangeAnimMode113c skips animdata refresh)
     and ITEMMODS_ApplyAttackerTakesDamage (TS SUNITDMG_ApplyDamage113c omits pMonsterData+0x54 = 0x13). */

  /* B3 [15] 0x6FCF5080 ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c (eax=pSourceItem, s0=pGame, s1=pOwnerUnit, s2=pDestItem, s3=bSyncClient, ret 0x10, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 322u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_sword, 50u, 4u, 0u, 0u, 323u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_sword, 51u, 4u, 0u, 0u, 324u);
    if (k >= 1) {
      U32(STAGE_UDATA1 + 0x18u) |= 0x800u; /* ITEMFLAG_SOCKETED */
    }
    if (k == 2) {
      void *pSubInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
      U32(STAGE_UNIT1 + 0x60u) = (uint32_t)(uintptr_t)pSubInv;
    }
    c.eax = STAGE_UNIT1;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT2; c.args[3] = 0u; c.calleePop = 0x10u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = STAGE_UNIT2; ts[4] = 0;
    run_and_emit(0x6FCF5080u, "ITEMS_DuplicateAndSocketAllSubItems_6FCF5080_113c", k,
                 k == 0 ? "not_socketed_ret1" : k == 1 ? "null_srcinv_ret0" : "empty_srcinv_ret1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* B3 [16] 0x6FCF6590 ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c (eax=pItem, ecx=pUnit, s0=pGame, s1=bFromGroundRoom, s2=nInvPage, s3=szFile, s4=nLine, ret 0x14, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 325u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, (k == 3) ? g_item_charm : g_item_ring, 50u, 4u, 0u, 0u, 326u);
    if (k >= 2) {
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    }
    uint32_t pGame = (k == 0) ? 0u : STAGE_GAME;
    c.eax = STAGE_UNIT1; c.ecx = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = pGame; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = pGame; ts[3] = 0; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    run_and_emit(0x6FCF6590u, "ITEMS_AutoPlaceItemIntoUnitGridPage_6FCF6590_113c", k,
                 k == 0 ? "null_game_assert747" : k == 1 ? "null_inv_assert74a" : k == 2 ? "place_ring_ret1" : "place_charm_ret1",
                 &c, ts, 7, 0xFFFFFFFFu, (k <= 1) ? 1 : 0);
  }

  /* B3 [17] 0x6FCF7160 ITEMS_PickupGroundItemToCursor_6FCF7160_113c (eax=pUnit, ebx=pGame, s0=dwItemGuid, s1=pOutRejectReason, ret 8, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 327u);
    if (k >= 2) {
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 55u, (k == 3) ? 3u : 0u, 5000u, 5000u, 328u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      if (k == 3) {
        link_room_units(STAGE_ROOM0, STAGE_UNIT1, STAGE_UNIT0);
      }
    }
    uint32_t pGame = (k == 0) ? 0u : STAGE_GAME;
    uint32_t pU = (k == 1) ? 0u : STAGE_UNIT0;
    uint32_t pOut = STAGE_SCRATCH;
    c.eax = pU; c.ebx = pGame;
    c.nargs = 2; c.args[0] = 55u; c.args[1] = pOut; c.calleePop = 8u;
    ts[0] = pU; ts[1] = pGame; ts[2] = 55; ts[3] = pOut;
    run_and_emit(0x6FCF7160u, "ITEMS_PickupGroundItemToCursor_6FCF7160_113c", k,
                 k == 0 ? "null_game_assert559" : k == 1 ? "null_unit_assert55a" : k == 2 ? "not_ground_reject1" : "pickup_ring_cursor",
                 &c, ts, 4, 0u, (k <= 1) ? 1 : 0);
  }

  /* B3 [18] 0x6FD11730 SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c (eax=pCasterUnit, ebx=nY, s0=nSkillId, s1=nSkillLevel, s2=nX, s3=bForce, ret 0x10, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 329u);
    if (k == 1) {
      U32(STAGE_UNIT0 + 0x80u) = 0u; /* null pGame */
    } else if (k == 2) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x36, 1); /* state 0x36 blocks */
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = pU; c.ebx = 5006u;
    c.nargs = 4; c.args[0] = 0x2Fu; c.args[1] = 1u; c.args[2] = 5005u; c.args[3] = 0u; c.calleePop = 0x10u;
    ts[0] = pU; ts[1] = 5006; ts[2] = 0x2F; ts[3] = 1; ts[4] = 5005; ts[5] = 0;
    run_and_emit(0x6FD11730u, "SKILLS_CastTriggeredCoordSkillAndQueue9A_6FD11730_113c", k,
                 k == 0 ? "null_caster_ret0" : k == 1 ? "null_game_ret0" : "state36_ret0",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* B3 [19] 0x6FCE3190 ACT2Q4_UnitIterateCheckQuest12State13_6FCE3190_113c (ecx=pGame, edx=pUnit, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 330u);
    U8(STAGE_GAME + 0x6Du) = (uint8_t)k; /* diff 0, 1, 2 */
    U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x20u;
    U32(STAGE_QBITS0 + 0x04u) = 96u;
    if (k == 2) {
      U16(STAGE_QBITS0 + 0x20u + 12u * 2u) = (1u << 13);
    }
    U32(STAGE_UDATA0 + 0x10u + (uint32_t)k * 4u) = STAGE_QBITS0;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE3190u, "ACT2Q4_UnitIterateCheckQuest12State13_6FCE3190_113c", k,
                 k == 0 ? "diff0_bit0" : k == 1 ? "diff1_bit0" : "diff2_bit1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* B3 [20] 0x6FD02E00 ACT3Q3_InitSewerStairsObject_6FD02E00_113c (ecx=pObjInitStrc, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 40u, 0u, 5000u, 5000u, 331u);
    uint32_t pInit = STAGE_SCRATCH;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x04u) = STAGE_UNIT0;
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 1) ? 1u : 0u;
    }
    c.ecx = pInit; c.calleePop = 0u;
    ts[0] = pInit;
    run_and_emit(0x6FD02E00u, "ACT3Q3_InitSewerStairsObject_6FD02E00_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "active_keep_mode0" : "done_open_mode2",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [21] 0x6FD02A00 ACT3Q5_InitCompellingOrbObject_6FD02A00_113c (ecx=pObjInitStrc, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 83u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 40u, 0u, 5000u, 5000u, 332u);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x0Cu) = (k == 0) ? 0u : (uint8_t)k;
    uint32_t pInit = STAGE_SCRATCH;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x04u) = STAGE_UNIT0;
    c.ecx = pInit; c.calleePop = 0u;
    ts[0] = pInit;
    run_and_emit(0x6FD02A00u, "ACT3Q5_InitCompellingOrbObject_6FD02A00_113c", k,
                 k == 0 ? "orb_intact_mode0" : k == 1 ? "orb_smashed1_mode2" : "orb_smashed2_mode2",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [22] 0x6FCD8870 ACT4Q2_InitHellforgeObject_6FCD8870_113c (ecx=pObjInit, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 107u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 40u, 0u, 5000u, 5000u, 333u);
    uint32_t pInit = STAGE_SCRATCH;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x04u) = STAGE_UNIT0;
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
      U32(STAGE_QUESTEX0 + 0x40u) = (k == 2) ? 2u : 0u;
    }
    c.ecx = pInit; c.calleePop = 0u;
    ts[0] = pInit;
    run_and_emit(0x6FCD8870u, "ACT4Q2_InitHellforgeObject_6FCD8870_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "first_init_mode1" : "already2_mode2",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [23] 0x6FD0AB10 QUESTS_SpawnProjectile12B_6FD0AB10_113c (edx=pOwnerUnit, s0=pGame, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 2) ? STAGE_ROOM0 : 0u, 1u, 1u, 20u, 1u, 5000u, 5000u, 334u);
    uint32_t pOwner = (k == 0) ? 0u : STAGE_UNIT0;
    c.edx = pOwner; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pOwner; ts[1] = STAGE_GAME;
    run_and_emit(0x6FD0AB10u, "QUESTS_SpawnProjectile12B_6FD0AB10_113c", k,
                 k == 0 ? "null_owner_ret0" : k == 1 ? "no_room_ret0" : "spawn_missile_12b",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* B3 [24] 0x6FCDA4F0 ACT4Q3_SeqCallback_6FCDA4F0_113c (ecx=pQuestData, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 2u : 0u;
    U8(STAGE_QUEST0 + 0x09u) = (k == 2) ? 1u : 0u;
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCDA4F0u, "ACT4Q3_SeqCallback_6FCDA4F0_113c", k,
                 k == 0 ? "state2_noop_ret1" : k == 1 ? "flag09_0_noop_ret1" : "promote_state1_ret1",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* B3 [25] 0x6FD04120 ACT3Q2_InitGidbinnAltarObject_6FD04120_113c (ecx=pObjInitStrc, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 78u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 42u, 0u, 5000u, 5000u, 335u);
    uint32_t pInit = STAGE_SCRATCH;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x04u) = STAGE_UNIT0;
    U32(pInit + 0x14u) = 5010u + (uint32_t)k;
    U32(pInit + 0x18u) = 5020u + (uint32_t)k;
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
      U32(STAGE_QUESTEX0 + 0x2Cu) = (k == 2) ? 2u : 1u;
    }
    c.ecx = pInit; c.calleePop = 0u;
    ts[0] = pInit;
    run_and_emit(0x6FD04120u, "ACT3Q2_InitGidbinnAltarObject_6FD04120_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "init_mode1" : "init_mode2",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [26] 0x6FCD97D0 ACT4Q2_InitHadrielQuestDescriptor_6FCD97D0_113c (ecx=pQuestData, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pQ = (k == 0) ? STAGE_QUEST0 : (k == 1 ? STAGE_QUESTEX0 : STAGE_SCRATCH);
    if (k == 1) {
      U32(pQ + 0xA4u) = 0xDEADBEEFu;
      U8(pQ + 0x0Cu) = 7u;
    }
    c.ecx = pQ; c.calleePop = 0u;
    ts[0] = pQ;
    run_and_emit(0x6FCD97D0u, "ACT4Q2_InitHadrielQuestDescriptor_6FCD97D0_113c", k,
                 k == 0 ? "clean_q0" : k == 1 ? "dirty_clear_qex" : "scratch_q",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [27] 0x6FCE69D0 ACT2Q5_SeqCallback_6FCE69D0_113c (ecx=pQuestData, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Cu, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUEST0 + 0x10u) = 99u; /* linked quest absent -> chain filter returns 0 cleanly */
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 2u : 0u;
    U8(STAGE_QUEST0 + 0x09u) = (k == 2) ? 1u : 0u;
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCE69D0u, "ACT2Q5_SeqCallback_6FCE69D0_113c", k,
                 k == 0 ? "state2_noop" : k == 1 ? "flag09_0_noop" : "promote_state1_chain",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* B3 [28] 0x6FD06760 ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c (eax=pGame, edx=pPlayerUnit, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 336u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x1Cu, STAGE_QUESTEX0, 0u);
      if (k == 1) U8(STAGE_QUESTEX0 + 0x0Cu) = 1u; /* already triggered -> noop */
    }
    c.eax = STAGE_GAME; c.edx = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FD06760u, "ACT3Q0_ScheduleDarkWandererTimerOnPlayerSeen_6FD06760_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "already_seen_noop" : "schedule_wanderer_timer",
                 &c, ts, 2, 0u, 0);
  }

  /* B3 [29] 0x6FD08780 ACT1Q4_SpawnSmithBossInBarracks_6FD08780_113c (esi=pQuestState, ebx=pRoom, s0=pGame, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 28u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    uint32_t pQ = (k == 1) ? STAGE_SCRATCH : STAGE_QUESTEX0;
    U8(pQ + 0x04u) = (k == 1) ? 0x77u : 0x00u; /* verified cleared back to 0 */
    uint32_t pR = (k == 2) ? STAGE_ROOM0 : 0u;
    c.esi = pQ; c.ebx = pR;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pQ; ts[1] = pR; ts[2] = STAGE_GAME;
    run_and_emit(0x6FD08780u, "ACT1Q4_SpawnSmithBossInBarracks_6FD08780_113c", k,
                 k == 0 ? "null_room_clr4" : k == 1 ? "null_room_dirty_clr4" : "no_roomex_assert766",
                 &c, ts, 3, 0u, (k == 2) ? 1 : 0);
  }

  /* B3 [30] 0x6FCD9D80 ACT4Prologue_InitQuestDescriptor_6FCD9D80_113c (ecx=pQuestData, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pQ = (k == 0) ? STAGE_QUEST0 : (k == 1 ? STAGE_QUESTEX0 : STAGE_SCRATCH);
    if (k == 1) U32(pQ + 0xA8u) = 0x12345678u;
    c.ecx = pQ; c.calleePop = 0u;
    ts[0] = pQ;
    run_and_emit(0x6FCD9D80u, "ACT4Prologue_InitQuestDescriptor_6FCD9D80_113c", k,
                 k == 0 ? "clean_q0" : k == 1 ? "dirty_clear_qex" : "scratch_q",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [31] 0x6FCE5730 ACT2Intro_InitQuestData_6FCE5730_113c (ecx=pQuestData, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pQ = (k == 0) ? STAGE_QUEST0 : (k == 1 ? STAGE_QUESTEX0 : STAGE_SCRATCH);
    if (k == 1) U32(pQ + 0xACu) = 0xCAFEBABEu;
    c.ecx = pQ; c.calleePop = 0u;
    ts[0] = pQ;
    run_and_emit(0x6FCE5730u, "ACT2Intro_InitQuestData_6FCE5730_113c", k,
                 k == 0 ? "clean_q0" : k == 1 ? "dirty_clear_qex" : "scratch_q",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [32] 0x6FD06700 ACT3_InitKurastNpcIntroQuestTable_6FD06700_113c (ecx=pQuestData, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pQ = (k == 0) ? STAGE_QUEST0 : (k == 1 ? STAGE_QUESTEX0 : STAGE_SCRATCH);
    if (k == 1) U32(pQ + 0xB0u) = 0xFEEDFACEu;
    c.ecx = pQ; c.calleePop = 0u;
    ts[0] = pQ;
    run_and_emit(0x6FD06700u, "ACT3_InitKurastNpcIntroQuestTable_6FD06700_113c", k,
                 k == 0 ? "clean_q0" : k == 1 ? "dirty_clear_qex" : "scratch_q",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [33] 0x6FD04980 ACT3Q3_InitSewerLeverObject_6FD04980_113c (ecx=pObjInitStrc, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 92u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 45u, 0u, 5000u, 5000u, 337u);
    uint32_t pInit = STAGE_SCRATCH;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x04u) = STAGE_UNIT0;
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 2) ? 1u : 0u;
      U32(STAGE_QUESTEX0 + 0x08u) = 1u;
    }
    c.ecx = pInit; c.calleePop = 0u;
    ts[0] = pInit;
    run_and_emit(0x6FD04980u, "ACT3Q3_InitSewerLeverObject_6FD04980_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "done_open_mode2" : "active_saved_mode1",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [34] 0x6FCE27F0 ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c (ecx=pInteractArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 66u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 46u, 0u, 5000u, 5000u, 338u);
    uint32_t pInit = STAGE_SCRATCH;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x04u) = STAGE_UNIT0;
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 2) ? 1u : 0u;
      U32(STAGE_QUESTEX0 + 0x18u) = 1u;
    }
    c.ecx = pInit; c.calleePop = 0u;
    ts[0] = pInit;
    run_and_emit(0x6FCE27F0u, "ACT2Q6_ActivateHoradricOrifice_6FCE27F0_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "done_open_mode2" : "active_saved_mode1",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [35] 0x6FCD8A70 ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c (ecx=pQuestData, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x16u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 1u : 5u;
    U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 1u : 0u;
    U32(STAGE_QUEST0 + 0x10u) = (k == 2) ? 0x16u : 99u; /* k=1 missing -> ret 0; k=2 self with pfn=0 -> assert 0xA1 */
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCD8A70u, "ACT4Q1_EnsureStartedOrInvokeLinkedQuestCallback_6FCD8A70_113c", k,
                 k == 0 ? "started_ret1" : k == 1 ? "missing_link_ret0" : "bad_pfn_assert_a1",
                 &c, ts, 1, 0xFFu, (k == 2) ? 1 : 0);
  }

  /* B3 [36] 0x6FCDC4A0 ACT4Q3_OnSeal5Operate_6FCDC4A0_113c (ecx=pQuestArg, ret 0, void/u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 47u, (k == 0) ? 2u : 0u, 5000u, 5000u, 339u);
    uint32_t pArg = STAGE_SCRATCH;
    U32(pArg + 0x00u) = STAGE_GAME;
    U32(pArg + 0x04u) = STAGE_UNIT0;
    if (k == 2) {
      stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    }
    c.ecx = pArg; c.calleePop = 0u;
    ts[0] = pArg;
    run_and_emit(0x6FCDC4A0u, "ACT4Q3_OnSeal5Operate_6FCDC4A0_113c", k,
                 k == 0 ? "already_open_noop" : k == 1 ? "no_quest_noop" : "seal5_offset_oob",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [37] 0x6FCDC510 ACT4Q3_OnSeal3Operate_6FCDC510_113c (ecx=pQuestArg, ret 0, void/u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 48u, (k == 0) ? 2u : 0u, 5000u, 5000u, 340u);
    uint32_t pArg = STAGE_SCRATCH;
    U32(pArg + 0x00u) = STAGE_GAME;
    U32(pArg + 0x04u) = STAGE_UNIT0;
    if (k == 2) {
      stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    }
    c.ecx = pArg; c.calleePop = 0u;
    ts[0] = pArg;
    run_and_emit(0x6FCDC510u, "ACT4Q3_OnSeal3Operate_6FCDC510_113c", k,
                 k == 0 ? "already_open_noop" : k == 1 ? "no_quest_noop" : "seal3_offset_oob",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [38] 0x6FCDC580 ACT4Q3_OnSeal1Operate_6FCDC580_113c (ecx=pQuestArg, ret 0, void/u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 10u, 49u, (k == 0) ? 2u : 0u, 5000u, 5000u, 341u);
    uint32_t pArg = STAGE_SCRATCH;
    U32(pArg + 0x00u) = STAGE_GAME;
    U32(pArg + 0x04u) = STAGE_UNIT0;
    if (k == 2) {
      stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    }
    c.ecx = pArg; c.calleePop = 0u;
    ts[0] = pArg;
    run_and_emit(0x6FCDC580u, "ACT4Q3_OnSeal1Operate_6FCDC580_113c", k,
                 k == 0 ? "already_open_noop" : k == 1 ? "no_quest_noop" : "seal1_offset_oob",
                 &c, ts, 1, 0u, 0);
  }

  /* B3 [39] 0x6FCE21E0 ACT2Q3_SeqFilter_6FCE21E0_113c (ecx=pQuestData, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 1u : 5u;
    U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 1u : 0u;
    U32(STAGE_QUEST0 + 0x10u) = (k == 2) ? 0x0Au : 99u;
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCE21E0u, "ACT2Q3_SeqFilter_6FCE21E0_113c", k,
                 k == 0 ? "started_ret1" : k == 1 ? "missing_ref_ret0" : "bad_pfn_assert_2a5",
                 &c, ts, 1, 0xFFu, (k == 2) ? 1 : 0);
  }

  /* B3 [40] 0x6FCE24A0 ACT2Q1_SeqFilter_6FCE24A0_113c (ecx=pQuestData, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x08u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 1u : 5u;
    U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 1u : 0u;
    U32(STAGE_QUEST0 + 0x10u) = (k == 2) ? 0x08u : 99u;
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCE24A0u, "ACT2Q1_SeqFilter_6FCE24A0_113c", k,
                 k == 0 ? "started_ret1" : k == 1 ? "missing_ref_ret0" : "bad_pfn_assert_243",
                 &c, ts, 1, 0xFFu, (k == 2) ? 1 : 0);
  }

  /* B3 [41] 0x6FCE7250 ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c (esi=pQuest, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTCTRL + 0x18u) = 0x12345679u;
    U32(STAGE_QUESTCTRL + 0x1Cu) = 0x29Au;
    if (k == 0) U8(STAGE_QUEST0 + 0x0Cu) = 1u;
    if (k == 1) U8(STAGE_QUESTEX0 + 0x01u) = 1u;
    if (k == 2) U32(STAGE_GAME + 0x10F4u) = 0u; /* null pQuestControl -> assert 0x1FB */
    c.esi = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCE7250u, "ACT2Q3_ScheduleTaintedSunTimer_6FCE7250_113c", k,
                 k == 0 ? "state_nz_noop" : k == 1 ? "already_sched_noop" : k == 2 ? "null_ctrl_assert1fb" : "sched_tainted_sun",
                 &c, ts, 1, 0u, (k == 2) ? 1 : 0);
  }

  /* B3 [42] 0x6FCE1FF0 ACT2Q4_ChainSeqFilter_6FCE1FF0_113c (edi=pQuestData, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
    if (k == 0) U32(STAGE_GAME + 0x10F4u) = 0u;
    U32(STAGE_QUEST0 + 0x10u) = (k == 2) ? 0x0Bu : 99u;
    c.edi = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCE1FF0u, "ACT2Q4_ChainSeqFilter_6FCE1FF0_113c", k,
                 k == 0 ? "no_ctrl_ret0" : k == 1 ? "missing_ref_ret0" : "bad_pfn_assert_34e",
                 &c, ts, 1, 0xFFu, (k == 2) ? 1 : 0);
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

static void stage_qbits(uint32_t pQBits, uint32_t pUData, uint32_t diff) {
  U32(pQBits + 0x00u) = pQBits + 0x20u;
  U32(pQBits + 0x04u) = 96u;
  if (pUData) U32(pUData + 0x10u + diff * 4u) = pQBits;
}

static void emit_batch4_vas(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* B4 [1..6] Quest Descriptor Table Init Functions (6 VAs: 2 Act 2, 2 Act 3, 2 Act 4) */
  emit_quest_init_3(0x6FCE5690u, "ACT2Q0_InitQuestData_6FCE5690_113c");
  emit_quest_init_3(0x6FCE7ED0u, "ACT2Q2_InitQuestTableRecord_6FCE7ED0_113c");
  emit_quest_init_3(0x6FD05920u, "ACT3Q0_InitQuestData_6FD05920_113c");
  emit_quest_init_3(0x6FD092D0u, "ACT3Q1_InitQuestTableRecord_6FD092D0_113c");
  emit_quest_init_3(0x6FCDAE40u, "ACT4Q1_InitQuestData_6FCDAE40_113c");
  emit_quest_init_3(0x6FCDC5F0u, "ACT4Q3_InitQuestTableRecord_6FCDC5F0_113c");

  /* B4 [13] 0x6FD02D40 QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c (ecx=pQuestData, ret 0, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 0u : (k == 1) ? 2u : 5u;
    U8(STAGE_QUEST0 + 0x09u) = (k <= 1) ? 1u : 0u;
    U32(STAGE_QUEST0 + 0x10u) = (k == 3) ? 0x11u : 99u;
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FD02D40u, "QUESTS_ChainStatusFilterPromoteState1A_6FD02D40_113c", k,
                 k == 0 ? "promote_0_to_1" : k == 1 ? "keep_state_2" : k == 2 ? "no_prev_ret0" : "null_pfn_assert2dc",
                 &c, ts, 1, 0xFFu, (k == 3) ? 1 : 0);
  }

  /* B4 [14] 0x6FD02E80 QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c (ecx=pQuestData, ret 0, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x12u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 0u : (k == 1) ? 3u : 5u;
    U8(STAGE_QUEST0 + 0x09u) = (k <= 1) ? 1u : 0u;
    U32(STAGE_QUEST0 + 0x10u) = (k == 3) ? 0x12u : 99u;
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FD02E80u, "QUESTS_ChainStatusFilterPromoteState1B_6FD02E80_113c", k,
                 k == 0 ? "promote_0_to_1" : k == 1 ? "keep_state_3" : k == 2 ? "no_prev_ret0" : "null_pfn_assert21b",
                 &c, ts, 1, 0xFFu, (k == 3) ? 1 : 0);
  }

  /* B4 [15] 0x6FCDA080 ACT4Q1_OnPlainsOfDespairEntered_6FCDA080_113c (eax=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x16u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 2) ? 1u : 0u;
      U8(STAGE_QUEST0 + 0x0Bu) = 0u;
      U8(STAGE_QUEST0 + 0x14u) = 1u;
    }
    c.eax = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FCDA080u, "ACT4Q1_OnPlainsOfDespairEntered_6FCDA080_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "inactive_noop" : "active_set_b_to_2",
                 &c, ts, 1, 0u, 0);
  }

  /* B4 [16] 0x6FD08290 ACT3Q0_InitDarkWandererPreset_6FD08290_113c (ecx=pObjInitStrc, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pInit = STAGE_SCRATCH;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x08u) = 0u; /* null room -> spawn returns 0 cleanly */
    U32(pInit + 0x14u) = 5000u;
    U32(pInit + 0x18u) = 5010u;
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x1Cu, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x01u) = (k == 2) ? 1u : 0u;
    }
    c.ecx = pInit; c.calleePop = 0u;
    ts[0] = pInit;
    run_and_emit(0x6FD08290u, "ACT3Q0_InitDarkWandererPreset_6FD08290_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "flag1_zero_mark0" : "flag1_set_write_coords",
                 &c, ts, 1, 0u, 0);
  }

  /* B4 [17] 0x6FCE1BA0 ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c (eax=pQuestData, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    if (k >= 1) {
      U32(STAGE_GAME + 0xC0u) = STAGE_ACT1;
      U32(STAGE_ACT1 + 0x48u) = STAGE_DRLG0;
      U32(STAGE_DRLG0 + 0x94u) = (k == 1) ? 0x42u : 0x45u;
    }
    if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x38u) = 1u;
      U16(STAGE_QUESTEX0 + 0x3Au) = 6u; /* wrap to 0 */
      U32(STAGE_QUESTEX0 + 0x48u) = 0x137u;
    }
    c.eax = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCE1BA0u, "ACT2Q6_GetNextFalseTombSymbolObjectId_6FCE1BA0_113c", k,
                 k == 0 ? "no_act2_ret133" : k == 1 ? "populate_false_tombs" : "wrap_slot6_to_0",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* B4 [18] 0x6FD08200 ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c (ebx=pQuest, eax=pMonsterUnit, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 76u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 0x44u, 1u, 5000u, 5000u, 401u);
    stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k >= 1) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x0Cu) = (k == 2) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x01u) = 1u;
    c.ebx = STAGE_QUEST0; c.eax = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FD08200u, "ACT3Q1_AttachGoldenBirdBossMonster_6FD08200_113c", k,
                 k == 0 ? "inactive_ret0" : k == 1 ? "flag0c_zero_ret0" : "attach_boss_ret1",
                 &c, ts, 2, 0xFFu, 0);
  }

  /* B4 [19] 0x6FCDC220 ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c (ecx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 396u, 0x55u, 2u, 5000u, 5000u, 402u);
    uint32_t pArg = STAGE_SCRATCH;
    U32(pArg + 0x00u) = STAGE_GAME;
    U32(pArg + 0x04u) = STAGE_UNIT0;
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x11u) = (k == 1) ? 1u : 0u;
      if (k == 3) {
        for (uint32_t s = 0; s < 5u; s++) U8(STAGE_QUESTEX0 + 0x0Cu + s) = 1u;
        U32(STAGE_QUESTEX0 + 0x48u) = 3u;
        U8(STAGE_QUESTEX0 + 0x13u) = 1u; /* skip KillAllChaosSanctuaryMonsters loop */
      }
    }
    c.ecx = pArg; c.calleePop = 0u;
    ts[0] = pArg;
    run_and_emit(0x6FCDC220u, "ACT4Q3_OnSealObjectActivatedTriggerCheck_6FCDC220_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "already_spawned_noop" : k == 2 ? "seals_incomplete" : "all_seals_queue_timer",
                 &c, ts, 1, 0u, 0);
  }

  /* B4 [20] 0x6FCDF8F0 QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c (eax=pUnit, s0=nSkillId, s1=nConsumeCount, ret 8, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 403u);
    if (k >= 2) {
      uint32_t pSk = stage_used_skill(STAGE_UNIT0, 36, 3);
      U32(pSk + 0x30u) = 5u; /* nQuantity = 5 charges */
    }
    int32_t skId = (k == 0) ? -1 : 36;
    int32_t consume = (k == 3) ? 5 : 2;
    c.eax = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = (uint32_t)consume; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = skId; ts[2] = consume;
    run_and_emit(0x6FCDF8F0u, "QUESTS_ConsumeSkillChargesAndSyncPacket22_6FCDF8F0_113c", k,
                 k == 0 ? "neg_skill_noop" : k == 1 ? "missing_skill_noop" : k == 2 ? "consume_5_to_3_assert996" : "drain_5_to_0_assert996",
                 &c, ts, 3, 0u, (k >= 2) ? 1 : 0);
  }

  /* B4 [21] 0x6FCE5C60 ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 0x4Au : 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 404u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    if (k == 0) U16(STAGE_QBITS0 + 0x20u + 0x0Cu * 2u) = 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE5C60u, "ACT2Q4_UnitIterate_CompleteArcaneSanctuaryInLevel74_6FCE5C60_113c", k,
                 k == 0 ? "already_done_noop" : k == 1 ? "wrong_level_noop" : "level74_complete_bits",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* B4 [22] 0x6FCE6600 ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c (eax=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Cu, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 2) ? 1u : 0u;
      U8(STAGE_QUEST0 + 0x0Bu) = 0u;
      U8(STAGE_QUEST0 + 0x0Cu) = 0u;
      U8(STAGE_QUEST0 + 0x14u) = 1u;
    }
    c.eax = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FCE6600u, "ACT2Q5_ActivateSummonerQuestAndSyncPlayers_6FCE6600_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "inactive_noop" : "activate_summoner_state",
                 &c, ts, 1, 0u, 0);
  }

  /* B4 [23] 0x6FD07A40 ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 0x22u, 1u, 5000u, 5000u, 405u);
    stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k >= 1) ? 1u : 0u;
    U8(STAGE_QUEST0 + 0x14u) = 1u;
    /* populate guid list at STAGE_QUESTEX0 + 0x1C with player guid 0x22 */
    U32(STAGE_QUESTEX0 + 0x1Cu) = 0x22u;
    U16(STAGE_QUESTEX0 + 0x9Cu) = 1u;
    uint32_t pArg = STAGE_QUESTARG;
    U32(pArg + 0x0Cu) = (k == 2) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = pArg; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = pArg;
    run_and_emit(0x6FD07A40u, "ACT3Q4_OnLamEsensTomeDropped_6FD07A40_113c", k,
                 k == 0 ? "inactive_rm_guid" : k == 1 ? "active_rm_set3" : "active_null_plr_set3",
                 &c, ts, 2, 0u, 0);
  }

  /* B4 [24] 0x6FCE4B10 ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c (ebx=pGame, ecx=pPlayer, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    if (k >= 1) {
      U32(STAGE_GAME + 0xC0u) = STAGE_ACT1;
      U32(STAGE_ACT1 + 0x48u) = STAGE_DRLG0;
      U32(STAGE_DRLG0 + 0x94u) = (k == 1) ? 0x44u : 0x46u;
    }
    c.ebx = STAGE_GAME; c.ecx = 0u; c.calleePop = 0u;
    ts[0] = 0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCE4B10u, "ACT2Q6_SendBossTombSymbolPacket50_6FCE4B10_113c", k,
                 k == 0 ? "no_act2_noop" : k == 1 ? "tomb_44_record" : "tomb_46_record",
                 &c, ts, 2, 0u, 0);
  }

  /* B4 [25] 0x6FCE59A0 ACT2Q6_UnitIterate_CompleteInTalRashaChamber_6FCE59A0_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 3) ? 0x49u : 40u);
    uint32_t pR = (k == 0) ? 0u : STAGE_ROOM0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, pR, 0u, 1u, 10u, 1u, 5000u, 5000u, 406u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    if (k >= 2) {
      stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE59A0u, "ACT2Q6_UnitIterate_CompleteInTalRashaChamber_6FCE59A0_113c", k,
                 k == 0 ? "no_room_ret0" : k == 1 ? "missing_q0d_assert191" : k == 2 ? "wrong_lvl_noop" : "chamber_complete_duriel",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 1) ? 1 : 0);
  }

  /* B4 [26] 0x6FD036A0 ACT3Q5_CountPlayersMissingFlailOrCubeCallback_6FD036A0_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 1u : 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 407u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    if (k == 2) U16(STAGE_QBITS0 + 0x20u + 0x12u * 2u) = 1u; /* bit 0 set -> skip flail count */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD036A0u, "ACT3Q5_CountPlayersMissingFlailOrCubeCallback_6FD036A0_113c", k,
                 k == 0 ? "act1_noop" : k == 1 ? "missing_both_inc2" : "q12_done_inc_cube_only",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* B4 [27] 0x6FCDA270 ACT4Q1_SeqCallback_6FCDA270_113c (ecx=pQuestData, ret 0, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x18u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 0u : (k == 1) ? 2u : 5u;
    U8(STAGE_QUEST0 + 0x09u) = (k <= 1) ? 1u : 0u;
    U32(STAGE_QUEST0 + 0x10u) = (k == 3) ? 0x18u : 99u;
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCDA270u, "ACT4Q1_SeqCallback_6FCDA270_113c", k,
                 k == 0 ? "promote_0_to_1" : k == 1 ? "active_state2_ret1" : k == 2 ? "no_next_ret0" : "null_pfn_assert15d",
                 &c, ts, 1, 0xFFu, (k == 3) ? 1 : 0);
  }

  /* B4 [28] 0x6FCE6390 ACT2Q3_SeqCallback_6FCE6390_113c (ecx=pQuestData, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, (k == 2) ? 0x0Au : 0x0Bu, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 0u : 2u;
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    c.ecx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCE6390u, "ACT2Q3_SeqCallback_6FCE6390_113c", k,
                 k == 0 ? "promote_0_to_1" : k == 1 ? "no_q0a_ret1" : "q0a_null_pfn_assert3ee",
                 &c, ts, 1, 0xFFu, (k == 2) ? 1 : 0);
  }

  /* B4 [29] 0x6FD046F0 ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 408u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
    if (k == 0) {
      U16(STAGE_QBITS0 + 0x20u + 0x13u * 2u) = 1u;
    } else if (k == 1) {
      U8(STAGE_QUESTEX0 + 0x00u) = 1u;
    } else {
      U8(STAGE_QUEST0 + 0x0Cu) = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD046F0u, "ACT3Q2_SyncPlayerGidbinnStateCallback_6FD046F0_113c", k,
                 k == 0 ? "done_noop" : k == 1 ? "ex0_set_bits4_2" : "state2_set_bit3",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* B4 [30] 0x6FD03560 ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 409u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (uint8_t)(2u + (uint32_t)k);
    U8(STAGE_QUEST0 + 0x0Bu) = (k == 2) ? 3u : 4u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD03560u, "ACT3Q7_SyncPlayerMephistoBitsFromQuest14Callback_6FD03560_113c", k,
                 k == 0 ? "state2_bit2" : k == 1 ? "state3_bit3" : k == 2 ? "state4_sub3_bit5" : "state5_sub4_bit9",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* B4 [31] 0x6FCE54A0 ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 410u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_quest_node(STAGE_QUEST0, 8u, STAGE_QUESTEX0, 0u);
    if (k == 1) U16(STAGE_QBITS0 + 0x20u + 9u * 2u) = (1u << 5);
    if (k == 2) U16(STAGE_QBITS0 + 0x20u + 9u * 2u) = (1u << 13);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE54A0u, "ACT2Q1_PlayerJoinBookOfSkillCountAndRefreshCallback_6FCE54A0_113c", k,
                 k == 0 ? "no_bits_noop" : k == 1 ? "bit5_inc_counter" : "bit13_set_interact32",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* B4 [32] 0x6FCD9B00 ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c (ecx=pGame, edx=pPlayerUnit, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 108u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 411u);
    uint32_t diff = (k == 2) ? 1u : 0u;
    U8(STAGE_GAME + 0x6Du) = (uint8_t)diff;
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, diff);
    if (k >= 1) U16(STAGE_QBITS0 + 0x20u + 0x1Au * 2u) = (1u << 13);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCD9B00u, "ACT4Q3_NotifyDiabloKilledAndPlaySpeech_6FCD9B00_113c", k,
                 k == 0 ? "bit13_clear_noop" : k == 1 ? "diff0_set_speech4b" : "diff1_set_speech4b",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* B4 [33] 0x6FCDB3B0 ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c (eax=pQuestState, ecx=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    if (k == 0) {
      U8(STAGE_QUESTEX0 + 0x13u) = 1u;
    } else if (k == 2) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x6Cu);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 0xF3u, 20u, 1u, 5000u, 5000u, 412u); /* Diablo skipped */
      link_room_units(STAGE_ROOM0, STAGE_UNIT0, 0u);
      U32(STAGE_GAME + 0xC8u) = STAGE_ACT0;
      U32(STAGE_ACT0 + 0x10u) = STAGE_ROOM0;
    }
    c.eax = STAGE_QUESTEX0; c.ecx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_QUESTEX0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCDB3B0u, "ACT4Q3_KillAllChaosSanctuaryMonsters_6FCDB3B0_113c", k,
                 k == 0 ? "already_killed_noop" : k == 1 ? "null_act3_assert798" : "room_diablo_skipped",
                 &c, ts, 2, 0u, (k == 1) ? 1 : 0);
  }

  /* B4 [34] 0x6FCE6D20 ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c (eax=pGame, s0=pUnit, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 0x31u : 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 413u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 8u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = 1u;
      U8(STAGE_QUEST0 + 0x0Bu) = 0u;
      U32(STAGE_QUEST0 + 0xA8u) = 0x12345678u;
    }
    c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCE6D20u, "ACT2Q1_OnPlayerEnterSewersLevel3_6FCE6D20_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "wrong_lvl_noop" : "sewers3_promote_state3",
                 &c, ts, 2, 0u, 0);
  }

  /* B4 [35] 0x6FCE6070 ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x31u);
    uint32_t pR = (k == 0) ? 0u : STAGE_ROOM0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, pR, 0u, 1u, 10u, 1u, 5000u, 5000u, 414u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    if (k == 2) {
      stage_quest_node(STAGE_QUEST0, 8u, STAGE_QUESTEX0, 0u);
      U32(STAGE_QUEST0 + 0xE0u) = 9u;
      U32(STAGE_QUESTEX0 + 0x04u) = STAGE_ROOM0;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE6070u, "ACT2Q1_UnitIterate_GrantRadamentKillInRoom_6FCE6070_113c", k,
                 k == 0 ? "no_room_ret0" : k == 1 ? "no_quest8_assert186" : "same_room_grant_bits",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 1) ? 1 : 0);
  }

  /* B4 [36] 0x6FD02780 ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c (eax=pGame, ebx=pUnit, esi=pOutCoords, ret 0, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_room_collision(STAGE_ROOM0, 4970u, 4970u, 50u, 50u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 415u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x1Cu, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x00u) = (k >= 2) ? 1u : 0u;
      U8(STAGE_QUESTEX0 + 0x02u) = (k == 2) ? 1u : 0u;
      U32(STAGE_QUESTEX0 + 0x04u) = 5000u;
      U32(STAGE_QUESTEX0 + 0x08u) = 5000u;
    }
    uint32_t pOut = STAGE_SCRATCH;
    c.eax = STAGE_GAME; c.ebx = STAGE_UNIT0; c.esi = pOut; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pOut;
    run_and_emit(0x6FD02780u, "ACT5Q3_FindAnyaTownSpawnPosition_6FD02780_113c", k,
                 k == 0 ? "no_q1c_ret0" : k == 1 ? "flag0_zero_ret0" : k == 2 ? "cached_coords_ret1" : "compute_y_minus20_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* B4 [37] 0x6FD0AA30 QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c (eax=pGame, esi=pBossUnit, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 136u);
    uint32_t cls = (k == 0) ? 1u : (k == 1) ? 0x2C0u : (k == 2) ? 0x2C1u : 0x2C5u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, cls, 20u, 12u, 5000u, 5000u, 416u);
    c.eax = STAGE_GAME; c.esi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FD0AA30u, "QUESTS_OnUberTristramBossKilledDropTorchAndStandards_6FD0AA30_113c", k,
                 k == 0 ? "bad_cls_asserte6" : k == 1 ? "uber_meph_flag" : k == 2 ? "uber_baal_flag" : "uber_diablo_flag",
                 &c, ts, 2, 0u, (k == 0) ? 1 : 0);
  }

  /* B4 [38] 0x6FD08560 ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c (ecx=pObjInitStrc, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 78u);
    uint32_t pInit = STAGE_SCRATCH;
    U32(pInit + 0x00u) = STAGE_GAME;
    U32(pInit + 0x08u) = STAGE_ROOM0;
    U32(pInit + 0x14u) = 5000u;
    U32(pInit + 0x18u) = 5005u;
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Eu, STAGE_QUESTEX0, 0u);
      stage_qbits(STAGE_QBITS0, 0u, 0u);
      U32(STAGE_QUESTCTRL + 0x08u) = (k == 1) ? 0u : 1u;
      U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
      if (k == 3) {
        U16(STAGE_QBITS0 + 0x20u + 0x10u * 2u) = (1u << 13);
        U8(STAGE_QUESTEX0 + 0x00u) = 1u;
        U32(STAGE_QUESTEX0 + 0x0Cu) = 0x33u;
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0xFDu, 0x33u, 1u, 5000u, 5005u, 417u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      }
    }
    c.ecx = pInit; c.calleePop = 0u;
    ts[0] = pInit;
    run_and_emit(0x6FD08560u, "ACT3Q2_InitGidbinnBossActivePreset_6FD08560_113c", k,
                 k == 0 ? "no_q0e_noop" : k == 1 ? "no_qctrl8_assert82c" : k == 2 ? "bit13_clear_store_xy" : "existing_boss_set3",
                 &c, ts, 1, 0u, (k == 1) ? 1 : 0);
  }

  /* B4 [39] 0x6FCE2F10 ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x4Au);
    uint32_t pR = (k == 0) ? 0u : STAGE_ROOM0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, pR, 0u, 1u, 10u, 1u, 5000u, 5000u, 418u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    if (k == 2) {
      stage_quest_node(STAGE_QUEST0, 0x0Cu, STAGE_QUESTEX0, 0u);
      U32(STAGE_QUESTEX0 + 0x04u) = STAGE_ROOM0;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE2F10u, "ACT2Q5_UnitIterate_CompleteNearSummonerRoom_6FCE2F10_113c", k,
                 k == 0 ? "no_room_ret0" : k == 1 ? "no_q0c_assert10d" : "same_room_set_q0d",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 1) ? 1 : 0);
  }

  /* B4 [40] 0x6FD05D80 ACT3Q5_UpdateTravincalNearCouncilKillCallback_6FD05D80_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 1u : 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 419u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x159u, 0x77u, 1u, 5001u, 5001u, 420u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x00u) = 0x77u;
    if (k == 2) U16(STAGE_QBITS0 + 0x20u + 0x12u * 2u) = 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD05D80u, "ACT3Q5_UpdateTravincalNearCouncilKillCallback_6FD05D80_113c", k,
                 k == 0 ? "act1_noop" : k == 1 ? "q12_clear_set4_13" : "q12_done_set0_13",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* B4 [41] 0x6FCE7D00 ACT2Q2_CleanupHoradricStaffItemsOnEnterAct1_6FCE7D00_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 40u : 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 421u);
    stage_qbits(STAGE_QBITS0, STAGE_UDATA0, 0u);
    if (k == 0) U16(STAGE_QBITS0 + 0x20u + 0x0Au * 2u) = 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE7D00u, "ACT2Q2_CleanupHoradricStaffItemsOnEnterAct1_6FCE7D00_113c", k,
                 k == 0 ? "q0a_done_noop" : k == 1 ? "act0_noop" : "act1_set_bits0_13",
                 &c, ts, 3, 0u, 0);
  }

  /* B4 [42] 0x6FCD58A0 SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 422u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5005u, 5002u, 423u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    int32_t skId = (k == 0) ? -1 : (k == 1) ? 0 : 38; /* 38 has wSrvMissile=56 */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = 2;
    run_and_emit(0x6FCD58A0u, "SKILLS_SrvDo134_LaunchSubClassIndexedMissile_6FCD58A0_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "no_missile_ret0" : "sk38_spawn_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B4 [44] 0x6FCC2A40 SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 10u, 1u, 5000u, 5000u, 426u);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      if (k == 2) {
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_jav, 51u, 1u, 0u, 0u, 427u);
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 70, 10, 0); /* quantity */
        fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4);
        stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_jav, 52u, 1u, 0u, 0u, 428u);
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 70, 10, 0);
        fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT2, 5);
        U32(STAGE_PATH0 + 0x10u) = 5005u;
        U32(STAGE_PATH0 + 0x14u) = 5002u;
      }
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 2u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 2; ts[3] = 1;
    run_and_emit(0x6FCC2A40u, "SKILLS_CreateOffhandThrowProjectile_6FCC2A40_113c", k,
                 k == 0 ? "no_inv_ret0" : k == 1 ? "empty_inv_ret0" : "dual_jav_throw_offhand",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B4 [45] 0x6FCC2B40 SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c (ecx=pGame, edx=pUnit, s0=nSkillId, s1=nSkillLevel, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 10u, 1u, 5000u, 5000u, 429u);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      if (k == 2) {
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_jav, 53u, 1u, 0u, 0u, 430u);
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 70, 10, 0);
        fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 4);
        stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_jav, 54u, 1u, 0u, 0u, 431u);
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 70, 10, 0);
        fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT2, 5);
        U32(STAGE_PATH0 + 0x10u) = 5005u;
        U32(STAGE_PATH0 + 0x14u) = 5002u;
      }
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 2u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 2; ts[3] = 1;
    run_and_emit(0x6FCC2B40u, "SKILLS_CreateMainhandThrowProjectile_6FCC2B40_113c", k,
                 k == 0 ? "no_inv_ret0" : k == 1 ? "empty_inv_ret0" : "main_jav_throw",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B4 [47] 0x6FCD1520 MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c (ecx=pGame, edx=pOriginUnit, s0=pCandidateUnit, s1=pBestCtx, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 433u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5004u, 5003u, 434u);
    U32(STAGE_UNIT1 + 0xC4u) |= 4u;
    uint32_t pCtx = STAGE_SCRATCH;
    U32(pCtx + 0x00u) = 0u;
    U32(pCtx + 0x04u) = 100u;
    U32(pCtx + 0x08u) = (k == 0) ? STAGE_UNIT1 : 0u;
    if (k == 1) U32(STAGE_UNIT1 + 0xC4u) &= ~4u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = pCtx; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = pCtx;
    run_and_emit(0x6FCD1520u, "MONAI_FindClosestWalkableHostileMeleeTargetCallback_6FCD1520_113c", k,
                 k == 0 ? "excluded_cand" : k == 1 ? "non_attackable" : "closer_walkable_match",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B4 [48] 0x6FCD1580 MONAI_FindClosestLoSHostileMeleeTargetCallback_6FCD1580_113c (ecx=pGame, edx=pOriginUnit, s0=pCandidateUnit, s1=pBestCtx, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 435u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5004u, 5003u, 436u);
    U32(STAGE_UNIT1 + 0xC4u) |= 4u;
    uint32_t pCtx = STAGE_SCRATCH;
    U32(pCtx + 0x00u) = 0u;
    U32(pCtx + 0x04u) = 100u;
    U32(pCtx + 0x08u) = (k == 0) ? STAGE_UNIT1 : 0u;
    if (k == 1) U32(STAGE_UNIT1 + 0xC4u) &= ~4u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = pCtx; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = pCtx;
    run_and_emit(0x6FCD1580u, "MONAI_FindClosestLoSHostileMeleeTargetCallback_6FCD1580_113c", k,
                 k == 0 ? "excluded_cand" : k == 1 ? "non_attackable" : "closer_los_match",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B4 [49] 0x6FCC4260 AI_InitSummonSkillLevelAndBasicAttack_6FCC4260_113c (edx=pUnit, s0=pAiArgs, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 437u);
    uint32_t pAiArgs = STAGE_AIPARAM0;
    uint32_t pAiCmd  = STAGE_SCRATCH;
    uint32_t pMonSt  = STAGE_SCRATCH + 0x100u;
    U32(pAiArgs + 0x00u) = pAiCmd;
    U32(pAiArgs + 0x1Cu) = pMonSt;
    U32(pAiCmd + 0x1Cu)  = 99u;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5002u, 5002u, 438u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_used_skill(STAGE_UNIT1, 36, 7);
      void *pSkList = fn_AllocSkillList(NULL);
      U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)pSkList;
      U32(STAGE_UDATA0 + 0x28u) = STAGE_AIGEN0;
      U32(STAGE_AIGEN0 + 0x28u) = STAGE_GAME;
      U32(STAGE_AIGEN0 + 0x2Cu) = 10u; /* owner guid */
      U32(STAGE_AIGEN0 + 0x30u) = 0u;  /* owner type = player */
      U16(pMonSt + 0x80u) = 36u;
    }
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.edx = pU; c.nargs = 1; c.args[0] = pAiArgs; c.calleePop = 4u;
    ts[0] = pU; ts[1] = pAiArgs;
    run_and_emit(0x6FCC4260u, "AI_InitSummonSkillLevelAndBasicAttack_6FCC4260_113c", k,
                 k == 0 ? "null_unit_set1" : k == 1 ? "no_aigen_set1" : "owner_sk36_lvl7_init_basic",
                 &c, ts, 2, 0u, 0);
  }

  /* B4 [50] 0x6FCC5230 AI_ScanRoomTargetAndCountAlliesCallback_6FCC5230_113c (ecx=pGame, edx=pOriginUnit, s0=pCandidateUnit, s1=pScanCtx, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 439u);
    uint32_t cType = (k == 2) ? 0u : 1u;
    uint32_t cCls  = (k == 1) ? 0x19Au : 1u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, cType, cCls, 21u, 1u, 5004u, 5003u, 440u);
    U32(STAGE_UNIT1 + 0xC4u) |= 4u;
    uint32_t pCtx = STAGE_SCRATCH;
    U32(pCtx + 0x00u) = STAGE_UNIT0;
    U32(pCtx + 0x14u) = 9999u;
    uint32_t pCand = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = pCand; c.args[1] = pCtx; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pCand; ts[3] = pCtx;
    run_and_emit(0x6FCC5230u, "AI_ScanRoomTargetAndCountAlliesCallback_6FCC5230_113c", k,
                 k == 0 ? "self_noop" : k == 1 ? "aligned_ally_inc20" : "hostile_player_record",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* B4 [51] 0x6FD112C0 SKILLS_RollRandomUnblockedTargetPos_6FD112C0_113c (s0=pUnit, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4970u, 4970u, 60u, 60u);
    if (k == 1) {
      uint32_t pGrid = U32(STAGE_ROOM0 + 0x20u);
      uint32_t pBuf = U32(pGrid + 0x20u);
      for (uint32_t i = 0; i < 3600u; i++) U16(pBuf + i * 2u) = 0xFFFFu;
    }
    uint32_t pR = (k == 0) ? 0u : STAGE_ROOM0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, pR, 1u, 1u, 20u, 1u, 5000u, 5000u, 441u);
    U8(STAGE_PATH0 + 0x3Eu) = 1u; /* collision pattern */
    U16(STAGE_PATH0 + 0x3Cu) = 0x0001u; /* footprint mask */
    c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FD112C0u, "SKILLS_RollRandomUnblockedTargetPos_6FD112C0_113c", k,
                 k == 0 ? "no_room_ret0" : k == 1 ? "blocked_10tries_ret0" : "open_grid_set_target_ret1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* B4 [52] 0x6FCC3E80 AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c (eax=pTetherCoords, ecx=pCandidateUnit, s0=pAttackerUnit, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 442u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5005u, 5005u, 443u);
    U32(STAGE_UNIT1 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, (k == 2) ? 500 : 5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 5000, 0);
    uint32_t pTether = 0u;
    if (k == 1) {
      pTether = STAGE_SCRATCH;
      U32(pTether + 0x0Cu) = 5070u; /* dist from UNIT0 ~ 90 > 0x55; dist from UNIT1 ~ 80 < 0x55 */
      U32(pTether + 0x10u) = 5070u;
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x24, 25, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x27, 50, 0);
    } else if (k == 2) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT1, 0x0B, 1); /* cold state +100 */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x16, 40, 0); /* maxdamage */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x31, 30, 0); /* firemaxdam */
    }
    c.eax = pTether; c.ecx = STAGE_UNIT1; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = pTether; ts[1] = STAGE_UNIT1; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCC3E80u, "AITARGET_EvaluateTargetThreatScore_6FCC3E80_113c", k,
                 k == 0 ? "baseline_score" : k == 1 ? "tether_and_res_score" : "cold_lowhp_dmg_score",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* B4 [53] 0x6FCD6DA0 AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c (eax=pTetherCoords, ecx=pCandidateUnit, s0=pAttackerUnit, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_collision(STAGE_ROOM0, 4990u, 4990u, 30u, 30u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 444u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5005u, 5005u, 445u);
    U32(STAGE_UNIT1 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, (k == 2) ? 400 : 5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 5000, 0);
    uint32_t pTether = 0u;
    if (k == 1) {
      pTether = STAGE_SCRATCH;
      U32(pTether + 0x0Cu) = 5060u;
      U32(pTether + 0x10u) = 5060u;
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x24, 30, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x2B, 60, 0);
    } else if (k == 2) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT1, 0x0B, 1);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x16, 60, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x33, 50, 0);
    }
    c.eax = pTether; c.ecx = STAGE_UNIT1; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = pTether; ts[1] = STAGE_UNIT1; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCD6DA0u, "AITARGET_EvaluateTargetThreatScoreTether75_6FCD6DA0_113c", k,
                 k == 0 ? "baseline_score" : k == 1 ? "tether75_and_res_score" : "cold_lowhp_dmg_score",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-w10-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-w10] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
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
    fprintf(stderr, "[k6-w10] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-w10] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-w10] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-w10] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_batch1_vas();
  emit_batch2_vas();
  emit_batch3_vas();
  emit_batch4_vas();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-w10] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
