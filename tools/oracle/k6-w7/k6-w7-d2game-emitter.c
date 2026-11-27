/*
 * k6-w7-d2game-emitter.c — Milestone #37 [K6] Wave 7 Real-DLL Hi-VA Part 2 Differential Emitter
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables (0x20000000..0x206F7FFF + D2Common .data/.bss)
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert) and Fog.#10042..#10047
 * (deterministic bump allocator), and executes 150 previously un-hit D2Game.dll
 * functions strictly inside 0x6FCC0000..0x6FD142D0 across >= 3 non-degenerate
 * cases each.
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
typedef void  (__stdcall *Com_SetRightSkill_t)(void *pUnit, int32_t skId, int32_t ownerGuid);
typedef void  (__stdcall *Com_SetLeftSkill_t)(void *pUnit, int32_t skId, int32_t ownerGuid);

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

/* Discovered real v1.13c item/monster IDs */
static uint32_t g_item_ring   = 0;
static uint32_t g_item_charm  = 0;
static uint32_t g_item_hp4    = 0;
static uint32_t g_item_hp1    = 0;
static uint32_t g_item_sword  = 0;
static uint32_t g_item_hfh    = 0; /* 'hfh ' Hellforge Hammer */
static uint32_t g_item_g33    = 0; /* 'g33 ' Gidbinn */
static uint32_t g_item_bbb    = 0; /* 'bbb ' Lam Esen's Tome */
static uint32_t g_item_box    = 0; /* 'box ' Horadric Cube */
static uint32_t g_item_qhr    = 0; /* 'qhr ' Khalim's Heart */
static uint32_t g_item_qbr    = 0; /* 'qbr ' Khalim's Brain */
static uint32_t g_item_qey    = 0; /* 'qey ' Khalim's Eye */
static uint32_t g_item_qf2    = 0; /* 'qf2 ' Khalim's Will */
static uint32_t g_item_tbk    = 0; /* 'tbk ' Tome of Town Portal */
static uint32_t g_item_ibk    = 0; /* 'ibk ' Tome of Identify */
static uint32_t g_item_isc    = 0; /* 'isc ' Scroll of Identify */
static uint32_t g_item_tsc    = 0; /* 'tsc ' Scroll of Town Portal */
static uint32_t g_item_key    = 0; /* 'key ' Skeleton Key */
static uint32_t g_item_yps    = 0; /* 'yps ' Antidote Potion */
static uint32_t g_item_wms    = 0; /* 'wms ' Thawing Potion */
static uint32_t g_item_jav    = 0; /* 'jav ' Javelin */
static uint32_t g_item_msf    = 0; /* 'msf ' Staff of Kings */
static uint32_t g_item_hst    = 0; /* 'hst ' Horadric Staff */
static uint32_t g_item_vip    = 0; /* 'vip ' Amulet of the Viper */
static uint32_t g_mon_res_sk  = 0;
static uint32_t g_mon_res_md  = 0;
static uint32_t g_mon_inf     = 0;
static uint32_t g_mon_subm    = 0;
static uint32_t g_sk_aura     = 0;
static int32_t  g_sk_aura_st  = 0;
static uint32_t g_sk_calc12   = 0;

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
              "[k6-w7] SETUP/INIT FAULT after %u emitted: code=0x%08lX eip=%p (game=0x%08lX com=0x%08lX) addr=0x%08X\n",
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

/* ------------------------------- Deterministic Bump Allocator */

static void *bump_alloc(uint32_t dwSize) {
  if (g_in_setup_phase) {
    uint32_t p = (g_setup_top + 3u) & ~3u;
    if (p + dwSize > STAGE_BASE + STAGE_TOTAL_SIZE) {
      fprintf(stderr, "[k6-w7] setup bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 21);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_setup_top = p + dwSize;
    return (void *)(uintptr_t)p;
  } else {
    uint32_t p = (g_heap_top + 3u) & ~3u;
    if (p + dwSize > HEAP_BASE + HEAP_SIZE) {
      fprintf(stderr, "[k6-w7] heap bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 22);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_heap_top = p + dwSize;
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
    memcpy(np, pMem, dwSize);
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
      fprintf(stderr, "[k6-w7] missing Fog.#%u\n", hooks[i].ord);
      TerminateProcess(GetCurrentProcess(), 23);
    }
    hook_module_iat_ptr(g_hCom, orig, hooks[i].fn);
    hook_module_iat_ptr(g_hGame, orig, hooks[i].fn);
  }
}

/* ------------------------------- PAGEIMG Loader */

static void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-w7] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-w7] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(0x6FDE9000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-w7] short read at page %u\n", i);
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
      fprintf(stderr, "[k6-w7] JSON buffer overflow\n");
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
  uintptr_t fn = 0x6FD00310u + g_game_rebase;
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

static void stage_act2_env(void) {
  uint32_t pEnv = (uint32_t)(uintptr_t)bump_alloc(0x40u);
  U32(STAGE_ACT1 + 0x04u)  = pEnv;
  U32(STAGE_GAME + 0xC0u)  = STAGE_ACT1;
}

static void attach_cursor_item(uint32_t pPlayer, uint32_t itemClassId, uint32_t itemGuid) {
  void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)pPlayer);
  U32(pPlayer + 0x60u) = (uint32_t)(uintptr_t)pInv;
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
            "[k6-w7] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-w7] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-w7] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-w7] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
              fnName, canonVa, caseIdx, label, actualPop, spec->calleePop);
      TerminateProcess(GetCurrentProcess(), 33);
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
    if (!g_item_hfh && code == 0x20686668u) g_item_hfh = id;
    if (!g_item_g33 && code == 0x20333367u) g_item_g33 = id;
    if (!g_item_bbb && code == 0x20626262u) g_item_bbb = id;
    if (!g_item_box && code == 0x20786F62u) g_item_box = id;
    if (!g_item_qhr && code == 0x20726871u) g_item_qhr = id;
    if (!g_item_qbr && code == 0x20726271u) g_item_qbr = id;
    if (!g_item_qey && code == 0x20796571u) g_item_qey = id;
    if (!g_item_qf2 && code == 0x20326671u) g_item_qf2 = id;
    if (!g_item_tbk && code == 0x206B6274u) g_item_tbk = id;
    if (!g_item_ibk && code == 0x206B6269u) g_item_ibk = id;
    if (!g_item_isc && code == 0x20637369u) g_item_isc = id;
    if (!g_item_tsc && code == 0x20637374u) g_item_tsc = id;
    if (!g_item_key && code == 0x2079656Bu) g_item_key = id;
    if (!g_item_yps && code == 0x20737079u) g_item_yps = id;
    if (!g_item_wms && code == 0x20736D77u) g_item_wms = id;
    if (!g_item_jav && code == 0x2076616Au) g_item_jav = id;
    if (!g_item_msf && code == 0x2066736Du) g_item_msf = id;
    if (!g_item_hst && code == 0x20747368u) g_item_hst = id;
    if (!g_item_vip && code == 0x20706976u) g_item_vip = id;
    if (!g_item_ring && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x0A)) g_item_ring = id;
    if (!g_item_charm && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x52)) g_item_charm = id;
    if (!g_item_sword && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x1E)) g_item_sword = id;
  }

  uint32_t pSgpt = U32(0x6FDE9E1Cu + g_com_rebase);
  uint32_t pMonStats  = U32(pSgpt + 0x0A78u);
  uint32_t nMonStats  = U32(pSgpt + 0x0A80u);
  uint32_t pMonStats2 = U32(pSgpt + 0x0A94u);
  uint32_t nMonStats2 = U32(pSgpt + 0x0A9Cu);
  for (uint32_t id = 0; id < nMonStats; id++) {
    int16_t ext = S16(pMonStats + id * 0x1A8u + 0x16u);
    if (ext < 0 || (uint32_t)ext >= nMonStats2) continue;
    uint32_t rec2 = pMonStats2 + (uint32_t)ext * 0x134u;
    uint16_t resSk = U16(rec2 + 0x10Cu);
    uint8_t  resMd = U8(rec2 + 0x10Bu);
    uint8_t  infLn = U8(rec2 + 0x109u);
    uint8_t  submF = U8(rec2 + 0x108u);
    if (!g_mon_res_sk && resSk > 0u) g_mon_res_sk = id;
    if (!g_mon_res_md && resSk == 0u && resMd < 0x10u && resMd != 1u) g_mon_res_md = id;
    if (!g_mon_inf && infLn > 0u) g_mon_inf = id;
    if (!g_mon_subm && submF > 0u && submF != 11u) g_mon_subm = id;
  }

  uint32_t pSkills = U32(pSgpt + 0x0B98u);
  uint32_t nSkills = U32(pSgpt + 0x0BA0u);
  uint32_t nStates = U32(pSgpt + 0x00C4u);
  for (uint32_t id = 1; id < nSkills; id++) {
    uint32_t rec = pSkills + id * 0x23Cu;
    uint8_t f0 = U8(rec + 0x04u);
    int16_t ast = S16(rec + 0x80u);
    if (!g_sk_aura && (f0 & 0x20u) && ast >= 0 && (uint32_t)ast < nStates) {
      g_sk_aura = id;
      g_sk_aura_st = ast;
    }
    if (!g_sk_calc12 && U32(rec + 0x138u) != 0u && U32(rec + 0x13Cu) != 0u) {
      g_sk_calc12 = id;
    }
  }
}

/* ------------------------------- Batch 1: Party / Player / Save + C2S */

static void emit_batch1_vas(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [2] 0x6FD10820 PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c (ecx=pGame, edx=pMember, s0=pLeaving, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 103u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 104u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    uint32_t pLeaving = (k == 0) ? STAGE_UNIT0 : (k == 1 ? 0u : STAGE_UNIT1);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = pLeaving; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pLeaving;
    run_and_emit(0x6FD10820u, "PARTY_SendLeftPartyEvent5AToMemberCallback_6FD10820_113c", k,
                 k == 0 ? "self_noop" : k == 1 ? "null_leaving_guid_ff" : "notify_member_5a",
                 &c, ts, 3, 0u, 0);
  }

  /* [3] 0x6FCEBE70 NET_BroadcastSystemChatMessage_6FCEBE70_113c (edx=pMsgBytes, s0=pGame, s1=nColor, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 105u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 106u);
    if (k >= 1) {
      link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, (k == 2) ? STAGE_CLIENT1 : 0u);
      U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    }
    if (k == 2) {
      link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u, 0u);
    }
    memcpy((void *)(uintptr_t)STAGE_SCRATCH, "Hello Sanctuary", 16u);
    uint32_t col = (k == 2) ? 8u : 4u;
    c.edx = STAGE_SCRATCH;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = col; c.calleePop = 8u;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_GAME; ts[2] = col;
    run_and_emit(0x6FCEBE70u, "NET_BroadcastSystemChatMessage_6FCEBE70_113c", k,
                 k == 0 ? "no_clients" : k == 1 ? "one_client_col4" : "two_clients_col8",
                 &c, ts, 3, 0u, 0);
  }

  /* [5] 0x6FCED360 PACKET_SrvMercMoveToCoord_6FCED360_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 108u);
    U8(STAGE_SCRATCH + 0x00u)  = 0x62u;
    U32(STAGE_SCRATCH + 0x01u) = 999u; /* merc guid */
    U16(STAGE_SCRATCH + 0x05u) = (k == 1) ? 5200u : 5005u;
    U16(STAGE_SCRATCH + 0x09u) = 5005u;
    uint32_t len = (k == 0) ? 5u : 13u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCED360u, "PACKET_SrvMercMoveToCoord_6FCED360_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "far_coord_ret1" : "in_range_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [6] 0x6FCED3D0 PACKET_SrvMercMoveToUnit_6FCED3D0_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 109u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 19u, 55u, 1u, 5004u, 5004u, 110u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x63u;
    U32(STAGE_SCRATCH + 0x01u) = 999u; /* merc guid */
    U32(STAGE_SCRATCH + 0x05u) = (k == 2) ? 888u : 55u;
    U32(STAGE_SCRATCH + 0x09u) = (k == 1) ? 7u : 1u;
    uint32_t len = (k == 0) ? 5u : 13u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCED3D0u, "PACKET_SrvMercMoveToUnit_6FCED3D0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "bad_type_ret2" : k == 2 ? "missing_target_ret1" : "valid_target_missing_merc",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [7] 0x6FCEC750 PLAYER_IssueMercAiMoveCommand_6FCEC750_113c (ecx=pGame, eax=dwMercGuid, s0=pPlr, s1=x, s2=y, s3=cmd, ret 0x10, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 111u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 271u, 55u, 1u, 5004u, 5004u, 112u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 3) {
      stage_pet_link(STAGE_UDATA0, 7u, 55u, 0x1234u, 100u, 1u);
      uint32_t pAiG = (uint32_t)(uintptr_t)bump_alloc(0x40u);
      U32(STAGE_UDATA1 + 0x28u) = pAiG;
    }
    uint32_t pg = (k == 0) ? 0u : STAGE_GAME;
    uint32_t mguid = (k == 1) ? 999u : 55u;
    c.ecx = pg; c.eax = mguid;
    c.nargs = 4; c.args[0] = STAGE_UNIT0; c.args[1] = 5010u; c.args[2] = 5012u; c.args[3] = 0x0Du; c.calleePop = 0x10u;
    ts[0] = pg; ts[1] = mguid; ts[2] = STAGE_UNIT0; ts[3] = 5010; ts[4] = 5012; ts[5] = 0x0D;
    run_and_emit(0x6FCEC750u, "PLAYER_IssueMercAiMoveCommand_6FCEC750_113c", k,
                 k == 0 ? "assert_null_game" : k == 1 ? "missing_merc_ret1" : k == 2 ? "unowned_merc_ret1" : "owned_merc_ok_ret0",
                 &c, ts, 6, 0xFFFFFFFFu, k == 0);
  }

  /* [8] 0x6FD0FFD0 PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c (eax=pTarget, edi=pOwner, s0=pGame, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 113u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 114u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 3u, 30u, 1u, 5004u, 5004u, 115u);
    uint32_t n0 = STAGE_SCRATCH + 0x00u, n1 = STAGE_SCRATCH + 0x20u;
    U32(n0 + 0x00u) = 20u; U32(n0 + 0x10u) = n1;
    U32(n1 + 0x00u) = 30u; U32(n1 + 0x10u) = 0u;
    U32(STAGE_UDATA0 + 0x38u) = n0;
    uint32_t pTgt = (k == 0) ? STAGE_UNIT0 : (k == 1 ? STAGE_UNIT1 : STAGE_UNIT2);
    c.eax = pTgt; c.edi = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pTgt; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FD0FFD0u, "PLAYERLIST_RemoveRelationNode_6FD0FFD0_113c", k,
                 k == 0 ? "self_noop" : k == 1 ? "remove_head" : "remove_tail",
                 &c, ts, 3, 0u, 0);
  }

  /* [11] 0x6FD10640 PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c (eax=mask, ecx=pU1, esi=pU2, s0=pGame, s1=bSet, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 120u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 121u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    uint32_t n0 = STAGE_SCRATCH;
    U32(n0 + 0x00u) = 20u; U32(n0 + 0x04u) = 0x06u;
    U32(STAGE_UDATA0 + 0x38u) = n0;
    uint32_t u2 = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    uint32_t bSet = (k == 1) ? 1u : 0u;
    c.eax = 0x04u; c.ecx = STAGE_UNIT0; c.esi = u2;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = bSet; c.calleePop = 8u;
    ts[0] = 0x04; ts[1] = STAGE_UNIT0; ts[2] = u2; ts[3] = STAGE_GAME; ts[4] = bSet;
    run_and_emit(0x6FD10640u, "PARTY_SetOrClearRelationFlagAndBroadcast8C_6FD10640_113c", k,
                 k == 0 ? "self_noop" : k == 1 ? "set_bit04" : "clear_bit04",
                 &c, ts, 5, 0u, 0);
  }

  /* [12] 0x6FCED2C0 PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c (edx=pUnit, s0=pClient, s1=nMode, ret 8, void; asserts 0xFB) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 122u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 123u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    U8(STAGE_CLIENT0 + 0x3D4u) = 1u; /* fast path reads client+0x174 directly */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0xAF, 42, 0);
    uint32_t pUnit = (k == 1) ? STAGE_UNIT1 : STAGE_UNIT0;
    uint32_t pCli  = (k == 0) ? 0u : STAGE_CLIENT0;
    c.edx = pUnit; c.nargs = 2; c.args[0] = pCli; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = pUnit; ts[1] = pCli; ts[2] = 1;
    run_and_emit(0x6FCED2C0u, "PLRMODES_SendPlayerStop0DAndSyncStatAF_6FCED2C0_113c", k,
                 k == 0 ? "assert_null_client" : k == 1 ? "other_unit_no_af" : "self_unit_sync_af",
                 &c, ts, 3, 0u, k == 0);
  }

  /* [13] 0x6FD103E0 PARTY_RefreshInviteRelationNodes_6FD103E0_113c (s0=pGame, s1=pPlayer, ret 8, void; asserts 0x2D3) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 124u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 125u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    uint32_t n0 = STAGE_SCRATCH;
    U32(n0 + 0x00u) = 20u; U32(n0 + 0x0Cu) = 2u;
    U32(STAGE_UDATA0 + 0x38u) = n0;
    if (k == 2) {
      uint32_t pSub = STAGE_PARTYCTRL + 0x10u;
      uint32_t pMem = STAGE_PARTYCTRL + 0x30u;
      U32(STAGE_GAME + 0x1D2Cu) = STAGE_PARTYCTRL;
      U32(STAGE_PARTYCTRL + 0x04u) = pSub;
      U16(pSub + 0x00u) = 1u;
      U32(pSub + 0x04u) = pMem;
      U32(pMem + 0x00u) = 20u;
    }
    uint32_t pg = (k == 0) ? 0u : STAGE_GAME;
    c.nargs = 2; c.args[0] = pg; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = pg; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FD103E0u, "PARTY_RefreshInviteRelationNodes_6FD103E0_113c", k,
                 k == 0 ? "assert_null_game" : k == 1 ? "other_no_party_rel0" : "other_in_party_rel1",
                 &c, ts, 2, 0u, k == 0);
  }

  /* [14] 0x6FCEB840 PLAYER_CalcHealingPotionPercent_6FCEB840_113c (eax=pUnit, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 126u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 2 ? 90 : 20) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    if (k >= 1) {
      void *pSub = fn_AllocStatList(NULL, 0x20000000u, (k == 2) ? 500u : 120u, 0, 10);
      fn_SetStatListState(pSub, 0x64);
      fn_SetStatIfValid(pSub, 0x4A, 128, 0);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 0);
    }
    c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FCEB840u, "PLAYER_CalcHealingPotionPercent_6FCEB840_113c", k,
                 k == 0 ? "no_state64_ret0" : k == 1 ? "partial_pct30" : "clamped_100",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [15] 0x6FCEB720 PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c (eax=pUnit, ret 0, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 127u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, (k == 2 ? 90 : 20) << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x1B, 50, 0);
    if (k >= 1) {
      void *pSub = fn_AllocStatList(NULL, 0x20000000u, (k == 2) ? 4000u : 200u, 0, 10);
      fn_SetStatListState(pSub, 0x6A);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 0);
    }
    c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FCEB720u, "PLAYER_CalcShrineManaRegenPercent_6FCEB720_113c", k,
                 k == 0 ? "no_state6a_ret0" : k == 1 ? "partial_mana_pct" : "clamped_100",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [18] 0x6FD10900 PARTY_CancelPartyInvitation_6FD10900_113c (ecx=pGame, edx=pSrc, s0=pDst, s1=0, s2=0, ret 0xC, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 132u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 133u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    uint32_t n0 = STAGE_SCRATCH + 0x00u, n1 = STAGE_SCRATCH + 0x20u;
    U32(n0 + 0x00u) = 20u; U32(n0 + 0x0Cu) = (k == 0) ? 0u : 4u; U32(STAGE_UDATA0 + 0x38u) = n0;
    U32(n1 + 0x00u) = 10u; U32(n1 + 0x0Cu) = (k == 0) ? 0u : 2u; U32(STAGE_UDATA1 + 0x38u) = n1;
    if (k == 2) {
      uint32_t pSub = STAGE_PARTYCTRL + 0x10u;
      uint32_t pMem = STAGE_PARTYCTRL + 0x30u;
      U32(STAGE_GAME + 0x1D2Cu) = STAGE_PARTYCTRL;
      U32(STAGE_PARTYCTRL + 0x04u) = pSub;
      U16(pSub + 0x00u) = 1u;
      U32(pSub + 0x04u) = pMem;
      U32(pMem + 0x00u) = 20u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_UNIT1; c.args[1] = 0u; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = 0; ts[4] = 0;
    run_and_emit(0x6FD10900u, "PARTY_CancelPartyInvitation_6FD10900_113c", k,
                 k == 0 ? "not_invited_rel0" : k == 1 ? "cancel_both_solo" : "cancel_dst_in_party",
                 &c, ts, 5, 0u, 0);
  }

  /* [19] 0x6FD0AF80 PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c (eax=pPlayerUnit, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cls = (k == 2) ? 4u : 1u; /* 1=Sorc, 4=Barb */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, cls, 10u, 1u, 5000u, 5000u, 134u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 50, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 1, 60, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 45, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 3, 55, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 4, 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 10, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 11, 200 << 8, 0);
    uint32_t u = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = u;
    ts[0] = u;
    run_and_emit(0x6FD0AF80u, "PLAYERSTATS_ResetBaseAttributesToCharStats_6FD0AF80_113c", k,
                 k == 0 ? "null_unit_noop" : k == 1 ? "sorc_reset" : "barb_reset",
                 &c, ts, 1, 0u, 0);
  }

  /* [20] 0x6FCD2820 ARENA_UpdatePlayerArenaScore_6FCD2820_113c (eax=pPlr, ebx=nType, s0=pGame, s1=pTgt, ret 8, void; asserts) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 135u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 136u);
    U32(STAGE_GAME + 0x1D28u) = STAGE_ARENA;
    U32(STAGE_ARENA + 0x04u) = 0u; /* arena txt id 0 */
    uint32_t a0 = STAGE_SCRATCH + 0x00u, a1 = STAGE_SCRATCH + 0x10u;
    S32(a0) = 100; S32(a1) = 500;
    U32(STAGE_UDATA0 + 0x34u) = a0;
    U32(STAGE_UDATA1 + 0x34u) = a1;
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t sType = (k == 1) ? 7u : (k == 2 ? 0u : 2u);
    c.eax = pPlr; c.ebx = sType;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT1; c.calleePop = 8u;
    ts[0] = pPlr; ts[1] = sType; ts[2] = STAGE_GAME; ts[3] = STAGE_UNIT1;
    run_and_emit(0x6FCD2820u, "ARENA_UpdatePlayerArenaScore_6FCD2820_113c", k,
                 k == 0 ? "assert_null_plr" : k == 1 ? "assert_type7" : k == 2 ? "score_type0_direct" : "score_type2_pct",
                 &c, ts, 4, 0u, (k == 0 || k == 1));
  }

  /* [23] 0x6FD0C0E0 PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c
   * ASM: eax=pEndPos, ecx=arg5, edx=arg4, edi=ppCurPos, s0=pPlayerUnit, s1=pGame, s2=bUseCached5C, ret 0xC
   * TS:  (m, pEndPos, arg5, arg4, ppCurPos, pGame, pPlayerUnit, bUseCached5C) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 141u);
    fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    uint32_t ppCur = STAGE_SCRATCH + 0x00u;
    uint32_t buf   = STAGE_SCRATCH + 0x10u;
    uint32_t pEnd  = buf + ((k == 1) ? 2u : 0x100u);
    U32(ppCur) = buf;
    if (k == 2) {
      uint32_t pDesc   = STAGE_SCRATCH + 0x200u;
      uint32_t pCached = STAGE_SCRATCH + 0x210u;
      static const uint8_t kCached[8] = { 'J', 'M', 0, 0, 'A', 'B', 'C', 'D' };
      memcpy((void *)(uintptr_t)pCached, kCached, 8u);
      U32(pDesc + 0x00u) = 8u;
      U32(pDesc + 0x04u) = pCached;
      U32(STAGE_UDATA0 + 0x5Cu) = pDesc;
    }
    c.eax = pEnd; c.ecx = 0u; c.edx = 0u; c.edi = ppCur;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = (k == 2) ? 1u : 0u; c.calleePop = 0xCu;
    ts[0] = pEnd; ts[1] = 0; ts[2] = 0; ts[3] = ppCur; ts[4] = STAGE_GAME; ts[5] = STAGE_UNIT0; ts[6] = (k == 2) ? 1 : 0;
    run_and_emit(0x6FD0C0E0u, "PLAYERSAVE_WritePlayerItemsSection_6FD0C0E0_113c", k,
                 k == 0 ? "empty_inv_ok" : k == 1 ? "buf_too_small_ret3" : "cached5c_flag1",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [24] 0x6FD0C1E0 PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c (eax=pGame, s0=pPlr, s1=ppCur, s2=pEnd, s3=0, s4=0, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 142u);
    U32(STAGE_GAME + 0x70u) = (k == 0) ? 0u : 1u;
    uint32_t ppCur = STAGE_SCRATCH + 0x00u;
    uint32_t buf   = STAGE_SCRATCH + 0x10u;
    uint32_t pEnd  = buf + 0x100u;
    U32(ppCur) = buf;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 271u, 55u, 1u, 5004u, 5004u, 143u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
      stage_pet_link(STAGE_UDATA0, 7u, 55u, 0x1234u, 100u, 1u);
    }
    c.eax = STAGE_GAME;
    c.nargs = 5; c.args[0] = STAGE_UNIT0; c.args[1] = ppCur; c.args[2] = pEnd; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = ppCur; ts[3] = pEnd; ts[4] = 0; ts[5] = 0;
    run_and_emit(0x6FD0C1E0u, "PLAYERSAVE_WriteHirelingItemsSection_6FD0C1E0_113c", k,
                 k == 0 ? "classic_noop" : k == 1 ? "exp_no_merc_jf" : "exp_merc_empty_inv",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [25] 0x6FD0BD10 PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c (s0=pPlr, s1=dwGuid, ret 8, u16) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 144u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 71u, 1u, 0u, 0u, 145u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_ring, 72u, 1u, 0u, 0u, 146u);
    fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 6);
    fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT2, 7);
    uint32_t gid = (k == 0) ? 0xFFFFFFFFu : (k == 1 ? 999u : (k == 2 ? 71u : 72u));
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = gid; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = (int32_t)gid;
    run_and_emit(0x6FD0BD10u, "PLAYERSAVE_FindInventoryItemSaveIndex_6FD0BD10_113c", k,
                 k == 0 ? "guid_ff_ret0" : k == 1 ? "missing_ret0" : k == 2 ? "found_item1" : "found_item2",
                 &c, ts, 2, 0xFFFFu, 0);
  }

  /* [26] 0x6FD0B700 PLAYERSAVE_WriteWaypointSection_6FD0B700_113c (ecx=pEnd, s0=pPlr, s1=ppCur, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, (k == 1) ? 0u : STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 147u);
    if (k == 2) {
      for (uint32_t d = 0; d < 3u; d++) {
        uint32_t wp = STAGE_SCRATCH + 0x200u + d * 0x20u;
        U16(wp + 0x00u) = 0x0102u;
        U32(wp + 0x02u) = 0x0000001Fu | (d << 8);
        U32(STAGE_UDATA0 + 0x1Cu + d * 4u) = wp;
      }
    }
    uint32_t ppCur = STAGE_SCRATCH + 0x00u;
    uint32_t buf   = STAGE_SCRATCH + 0x10u;
    uint32_t pEnd  = buf + ((k == 0) ? 0x20u : 0x100u);
    U32(ppCur) = buf;
    c.ecx = pEnd;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = ppCur; c.calleePop = 8u;
    ts[0] = pEnd; ts[1] = STAGE_UNIT0; ts[2] = ppCur;
    run_and_emit(0x6FD0B700u, "PLAYERSAVE_WriteWaypointSection_6FD0B700_113c", k,
                 k == 0 ? "buf_too_small_ret1" : k == 1 ? "null_plrdata_ret2" : "write_ws_ok_ret0",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [27] 0x6FD0C020 PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c (eax=pGame, s0=pPlr, s1=ppCur, s2=pEnd, s3=0, s4=0, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 10u, 1u, 5000u, 5000u, 148u);
    U32(STAGE_GAME + 0x70u) = (k == 0) ? 0u : 1u;
    uint32_t ppCur = STAGE_SCRATCH + 0x00u;
    uint32_t buf   = STAGE_SCRATCH + 0x10u;
    uint32_t pEnd  = buf + 0x100u;
    U32(ppCur) = buf;
    if (k == 2) {
      /* Clay golem (0x121 != 0x123) -> writes kf + 0 */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 0x121u, 60u, 1u, 5004u, 5004u, 149u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_pet_link(STAGE_UDATA0, 3u, 60u, 0x2222u, 0u, 0u);
    }
    c.eax = STAGE_GAME;
    c.nargs = 5; c.args[0] = STAGE_UNIT0; c.args[1] = ppCur; c.args[2] = pEnd; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = ppCur; ts[3] = pEnd; ts[4] = 0; ts[5] = 0;
    run_and_emit(0x6FD0C020u, "PLAYERSAVE_WriteIronGolemSection_6FD0C020_113c", k,
                 k == 0 ? "classic_noop" : k == 1 ? "exp_no_golem_kf0" : "exp_clay_golem_kf0",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [28] 0x6FD0C120 PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c (eax=pGame, s0=pPlr, s1=pSaveHdr, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 150u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 271u, 55u, (k == 2) ? 12u : 1u, 5004u, 5004u, 151u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 10, 0); /* lvl 10 */
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 13, 123456, 0); /* exp */
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_pet_link(STAGE_UDATA0, 7u, 55u, 0xCAFEBABEu, 1050u, 1u);
    }
    uint32_t pHdr = STAGE_SCRATCH;
    c.eax = STAGE_GAME;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = pHdr; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pHdr;
    run_and_emit(0x6FD0C120u, "PLAYERSAVE_WriteHirelingHeaderFields_6FD0C120_113c", k,
                 k == 0 ? "no_merc_noop" : k == 1 ? "alive_merc_hdr" : "dead_merc_hdr_10000",
                 &c, ts, 3, 0u, 0);
  }

  /* [29] 0x6FD0B7B0 PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c (ecx=pEnd, s0=pPlr, s1=ppCur, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, (k == 1) ? 0u : STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 152u);
    if (k == 2) {
      for (uint8_t d = 0; d < 3u; d++) {
        uint32_t qr = STAGE_SCRATCH + 0x300u + (uint32_t)d * 0x80u;
        attach_quest_bits(STAGE_UDATA0, d, qr);
        set_quest_bit(qr, d + 1u, 0u);
      }
    }
    uint32_t ppCur = STAGE_SCRATCH + 0x00u;
    uint32_t buf   = STAGE_SCRATCH + 0x10u;
    uint32_t pEnd  = buf + ((k == 0) ? 0x50u : 0x200u);
    U32(ppCur) = buf;
    c.ecx = pEnd;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = ppCur; c.calleePop = 8u;
    ts[0] = pEnd; ts[1] = STAGE_UNIT0; ts[2] = ppCur;
    run_and_emit(0x6FD0B7B0u, "PLAYERSAVE_WriteQuestSection_6FD0B7B0_113c", k,
                 k == 0 ? "buf_too_small_ret1" : k == 1 ? "null_plrdata_ret2" : "write_woo_ok_ret0",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [30] 0x6FD0BC40 PLAYERSAVE_WriteSkillSection_6FD0BC40_113c (ebx=pPlr, s0=ppCur, s1=pEnd, ret 8, u32; asserts 0x8A4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 153u);
    if (k >= 2) {
      link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
      U8(STAGE_CLIENT0 + 0x08u) = (k == 2) ? 7u : 1u; /* 7=invalid class -> ret 2; 1=Sorc */
      if (k == 3) {
        attach_skill(STAGE_UNIT0, 36, 5); /* Fire Bolt lvl 5 */
        attach_skill(STAGE_UNIT0, 39, 3); /* Ice Bolt lvl 3 */
      }
    }
    uint32_t ppCur = STAGE_SCRATCH + 0x00u;
    uint32_t buf   = STAGE_SCRATCH + 0x10u;
    uint32_t pEnd  = buf + ((k == 0) ? 4u : 0x100u);
    U32(ppCur) = buf;
    c.ebx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = ppCur; c.args[1] = pEnd; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = ppCur; ts[2] = pEnd;
    run_and_emit(0x6FD0BC40u, "PLAYERSAVE_WriteSkillSection_6FD0BC40_113c", k,
                 k == 0 ? "buf_too_small_ret1" : k == 1 ? "assert_null_client" : k == 2 ? "bad_class7_ret2" : "sorc_if_ok_ret0",
                 &c, ts, 3, 0xFFFFFFFFu, k == 1);
  }

  /* [31] 0x6FD0B610 PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c (ecx=pPlr, s0=ppCur, s1=pEnd, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, (k == 1) ? 0u : STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 154u);
    if (k == 2) {
      for (uint32_t d = 0; d < 3u; d++) {
        uint32_t base = STAGE_SCRATCH + 0x200u + d * 0x40u;
        uint32_t pIntro = base + 0x00u;
        uint32_t pQHold = base + 0x08u;
        uint32_t pQBuf  = base + 0x10u;
        uint32_t pNHold = base + 0x18u;
        uint32_t pNBuf  = base + 0x20u;
        U32(STAGE_UDATA0 + 0x60u + d * 4u) = pIntro;
        U32(pIntro + 0x00u) = pQHold; U32(pQHold) = pQBuf;
        U32(pQBuf + 0x00u) = 0x11110000u + d; U32(pQBuf + 0x04u) = 0x22220000u + d;
        U32(pIntro + 0x04u) = pNHold; U32(pNHold) = pNBuf;
        U32(pNBuf + 0x00u) = 0x33330000u + d; U32(pNBuf + 0x04u) = 0x44440000u + d;
      }
    }
    uint32_t ppCur = STAGE_SCRATCH + 0x00u;
    uint32_t buf   = STAGE_SCRATCH + 0x10u;
    uint32_t pEnd  = buf + ((k == 0) ? 0x10u : 0x100u);
    U32(ppCur) = buf;
    c.ecx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = ppCur; c.args[1] = pEnd; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = ppCur; ts[2] = pEnd;
    run_and_emit(0x6FD0B610u, "PLAYERSAVE_WritePlrIntroSection_6FD0B610_113c", k,
                 k == 0 ? "buf_too_small_ret1" : k == 1 ? "null_plrdata_ret2" : "write_intro_ok_ret0",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [32] 0x6FCEB5B0 C2S_Packet0B_Noop1Byte113c (ecx=pGame, edx=pPlr, s0=pPkt, s1=nLen, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t len = (k == 0) ? 0u : (k == 1 ? 1u : 5u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEB5B0u, "C2S_Packet0B_Noop1Byte113c", k,
                 k == 0 ? "len0_ret3" : k == 1 ? "len1_ret0" : "len5_ret3",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [33] 0x6FCEF070 C2S_Packet34_CainIdentifyItems_6FCEF070_113c (ecx=pGame, edx=pPlr, s0=pPkt, s1=nLen, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 155u);
    U8(STAGE_SCRATCH + 0x00u) = 0x34u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 999u : 77u;
    uint32_t len = (k == 0) ? 4u : 5u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEF070u, "C2S_Packet34_CainIdentifyItems_6FCEF070_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_cain_ret0" : "missing_cain77_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [34] 0x6FCEFB90 C2S_Packet23_MercReviveHandler_6FCEFB90_113c (ecx=pGame, edx=pPlr, s0=pPkt, s1=nLen, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 156u);
    U32(STAGE_GAME + 0x70u) = (k == 0) ? 0u : 1u;
    U8(STAGE_SCRATCH + 0x00u) = 0x62u;
    U32(STAGE_SCRATCH + 0x01u) = 999u;
    uint32_t len = (k == 1) ? 4u : 5u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEFB90u, "C2S_Packet23_MercReviveHandler_6FCEFB90_113c", k,
                 k == 0 ? "classic_ret3" : k == 1 ? "bad_len_ret3" : "exp_missing_npc_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [35] 0x6FCF0060 C2S_Packet_HireMercenary_6FCF0060_113c (ecx=pGame, edx=pPlr, s0=pPkt, s1=nLen, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 157u);
    U8(STAGE_SCRATCH + 0x00u)  = 0x36u;
    U32(STAGE_SCRATCH + 0x01u) = 999u;
    U16(STAGE_SCRATCH + 0x05u) = 1u;
    uint32_t len = (k == 0) ? 5u : (k == 1 ? 8u : 9u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCF0060u, "C2S_Packet_HireMercenary_6FCF0060_113c", k,
                 k == 0 ? "len5_ret3" : k == 1 ? "len8_ret3" : "len9_missing_npc_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [36] 0x6FCEF220 C2S_Packet_NpcBuyItem_6FCEF220_113c (ecx=pGame, edx=pPlr, s0=pPkt, s1=nLen, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 158u);
    U8(STAGE_SCRATCH + 0x00u)  = 0x32u;
    U32(STAGE_SCRATCH + 0x01u) = 999u;
    U32(STAGE_SCRATCH + 0x05u) = 888u;
    U32(STAGE_SCRATCH + 0x09u) = (k == 2) ? 0x80000001u : 0x00000000u;
    U32(STAGE_SCRATCH + 0x0Du) = 100u;
    uint32_t len = (k == 0) ? 9u : 17u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEF220u, "C2S_Packet_NpcBuyItem_6FCEF220_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_npc_tab0" : "missing_npc_fill",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [37..42] 6 Unit-targeted C2S move/skill packets (04, 02, 11, 10, 0A, 09) */
  {
    static const struct { uint32_t va; const char *name; uint8_t op; } kUnitC2S[] = {
      { 0x6FCEE000u, "C2S_Packet04_RunToUnit113c", 0x04u },
      { 0x6FCEE090u, "C2S_Packet02_WalkToUnit113c", 0x02u },
      { 0x6FCEEA50u, "C2S_Packet11_RepeatShiftRightSkillOnUnit113c", 0x11u },
      { 0x6FCEEAB0u, "C2S_Packet10_RepeatRightSkillOnUnit113c", 0x10u },
      { 0x6FCEEB10u, "C2S_Packet0A_RepeatShiftLeftSkillOnUnit113c", 0x0Au },
      { 0x6FCEEB70u, "C2S_Packet09_RepeatLeftSkillOnUnit113c", 0x09u },
      { 0x6FCEE7F0u, "C2S_Packet0E_ShiftRightSkillOnUnit113c", 0x0Eu },
      { 0x6FCEE950u, "C2S_Packet07_ShiftLeftSkillOnUnit113c", 0x07u },
    };
    for (size_t i = 0; i < sizeof(kUnitC2S) / sizeof(kUnitC2S[0]); i++) {
      for (int k = 0; k < 4; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 160u + (uint32_t)i);
        U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 19u, 55u, 1u, 5005u, 5005u, 170u + (uint32_t)i);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
        U8(STAGE_SCRATCH + 0x00u)  = kUnitC2S[i].op;
        U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 9u : 1u; /* unitType >= 6 -> ret 2 */
        U32(STAGE_SCRATCH + 0x05u) = (k == 2) ? 999u : 55u; /* missing -> ret 1; valid & no skill -> ret 3 (for skill pkts) */
        uint32_t len = (k == 0) ? 5u : 9u;
        if (i < 2 && k == 3) {
          /* For 04/02, avoid anim-mode branch by testing far-away target -> ret 1 */
          stage_dynamic_path(STAGE_UNIT1, STAGE_PATH1, STAGE_ROOM0, 5400u, 5400u);
        }
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
        c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
        run_and_emit(kUnitC2S[i].va, kUnitC2S[i].name, k,
                     k == 0 ? "bad_len_ret3" : k == 1 ? "bad_type_ret2" : k == 2 ? "missing_unit_ret1" : (i < 2 ? "far_unit_ret1" : "no_skill_ret3"),
                     &c, ts, 4, 0xFFFFFFFFu, 0);
      }
    }
  }

  /* [45..47] 3 Location-targeted C2S skill packets (0F, 08, 05) */
  {
    static const struct { uint32_t va; const char *name; uint8_t op; } kLocC2S[] = {
      { 0x6FCEE790u, "C2S_Packet0F_RepeatRightSkillOnLocation113c", 0x0Fu },
      { 0x6FCEE8F0u, "C2S_Packet08_RepeatLeftSkillOnLocation113c", 0x08u },
      { 0x6FCEE5A0u, "C2S_Packet05_LeftSkillOnLocation113c", 0x05u },
    };
    for (size_t i = 0; i < sizeof(kLocC2S) / sizeof(kLocC2S[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 180u + (uint32_t)i);
        U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
        U8(STAGE_SCRATCH + 0x00u)  = kLocC2S[i].op;
        U16(STAGE_SCRATCH + 0x01u) = (k == 1) ? 5500u : 5005u; /* k=1 far coord -> ret 1 */
        U16(STAGE_SCRATCH + 0x03u) = 5005u;
        uint32_t len = (k == 0) ? 3u : 5u;
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
        c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
        run_and_emit(kLocC2S[i].va, kLocC2S[i].name, k,
                     k == 0 ? "bad_len_ret3" : k == 1 ? "far_coord_ret1" : "no_skill_ret3",
                     &c, ts, 4, 0xFFFFFFFFu, 0);
      }
    }
  }

  /* [48] 0x6FCEE4B0 C2S_Packet21_MergeStackableItems_6FCEE4B0_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 185u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 71u, 4u, 0u, 0u, 186u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x21u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 999u : 71u;
    U32(STAGE_SCRATCH + 0x05u) = (k == 2) ? 888u : 71u; /* k=3: same guid -> ret 3 */
    uint32_t len = (k == 0) ? 5u : 9u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEE4B0u, "C2S_Packet21_MergeStackableItems_6FCEE4B0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_src_ret1" : k == 2 ? "missing_dst_ret1" : "same_guid_ret3",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [49] 0x6FCEEDE0 C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 187u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_hp1, 71u, 4u, 0u, 0u, 188u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x25u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 999u : 71u;
    U32(STAGE_SCRATCH + 0x05u) = 888u;
    uint32_t len = (k == 0) ? 5u : 9u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEEDE0u, "C2S_Packet25_SwapCursorItemWithBeltItem_6FCEEDE0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_cursor_ret1" : "missing_belt_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [50] 0x6FCEF6B0 C2S_Packet27_IdentifyItem_6FCEF6B0_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 189u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 71u, 4u, 0u, 0u, 190u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x27u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 999u : 71u;
    U32(STAGE_SCRATCH + 0x05u) = 888u;
    uint32_t len = (k == 0) ? 5u : 9u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEF6B0u, "C2S_Packet27_IdentifyItem_6FCEF6B0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_target_ret1" : "missing_scroll_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [51] 0x6FCEDB30 C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 191u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_isc, 71u, 4u, 0u, 0u, 192u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x29u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 999u : 71u;
    U32(STAGE_SCRATCH + 0x05u) = 888u;
    uint32_t len = (k == 0) ? 5u : 9u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEDB30u, "C2S_Packet29_InsertScrollIntoTome_6FCEDB30_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_scroll_ret1" : "missing_tome_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [52] 0x6FCEF400 C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 193u);
    U8(STAGE_SCRATCH + 0x00u)  = 0x27u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 999u : 0xFFFFFFFFu;
    uint32_t len = (k == 0) ? 4u : 5u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEF400u, "C2S_HandlePacket27_IdentifyOrUseCursorItem_6FCEF400_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_item_ret1" : "guid_ff_clear_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [53] 0x6FCEEFE0 C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c (asserts 0x2D3) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 194u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 71u, 0u, 0u, 0u, 195u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U32(STAGE_UDATA0 + 0x6Cu) = 777u; /* pending item guid != 71 -> ret 3 */
    U8(STAGE_SCRATCH + 0x00u)  = 0x27u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 2) ? 999u : 71u;
    uint32_t pg  = (k == 1) ? 0u : STAGE_GAME;
    uint32_t len = (k == 0) ? 4u : 5u;
    c.ecx = pg; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = pg; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEEFE0u, "C2S_Packet27_IdentifyItemWithScroll_6FCEEFE0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "assert_null_game" : k == 2 ? "missing_item_ret2" : "wrong_pending_ret3",
                 &c, ts, 4, 0xFFFFFFFFu, k == 1);
  }

  /* [54] 0x6FCEEBD0 C2S_Packet28_SocketItem_6FCEEBD0_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 196u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 197u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 71u, 4u, 0u, 0u, 198u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
    uint32_t eqGuid = 888u;
    if (k == 3) {
      /* Put a 2nd item equipped + player interacting with another player -> early return 0! */
      uint32_t pEq = (uint32_t)(uintptr_t)bump_alloc(0x100u);
      uint32_t pEqData = (uint32_t)(uintptr_t)bump_alloc(0x100u);
      uint32_t pEqPath = (uint32_t)(uintptr_t)bump_alloc(0x40u);
      stage_unit_common(pEq, pEqData, pEqPath, STAGE_ROOM0, 4u, g_item_sword, 72u, 1u, 0u, 0u, 199u);
      insert_server_unit(STAGE_GAME, pEq);
      fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)pEq, 4);
      eqGuid = 72u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 0u; /* UNIT_PLAYER */
      U32(STAGE_UNIT0 + 0x64u) = 20u;
    }
    U8(STAGE_SCRATCH + 0x00u)  = 0x28u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 999u : 71u;
    U32(STAGE_SCRATCH + 0x05u) = eqGuid;
    uint32_t len = (k == 0) ? 5u : 9u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEEBD0u, "C2S_Packet28_SocketItem_6FCEEBD0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_cursor_ret1" : k == 2 ? "missing_target_ret1" : "interacting_plr_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [55] 0x6FCF1140 C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 200u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_sword, 71u, 4u, 0u, 0u, 201u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x1Bu;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 999u : 71u;
    U8(STAGE_SCRATCH + 0x05u)  = (k == 2) ? 0x0Cu : (k == 3 ? 0x06u : 0x04u);
    uint32_t len = (k == 0) ? 5u : 9u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCF1140u, "C2S_Packet1B_SwapTwoHandedOrDualWeaponBodyLoc_6FCF1140_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_cursor_ret1" : k == 2 ? "oob_loc_ret2" : k == 3 ? "loc6_ret3" : "empty_loc4_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [56] 0x6FCF0E90 C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 202u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 1u, 77u, 0u, 5002u, 5002u, 203u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U8(STAGE_SCRATCH + 0x00u)  = 0x1Cu;
    U32(STAGE_SCRATCH + 0x05u) = (k == 1) ? 999u : 77u;
    U32(STAGE_SCRATCH + 0x09u) = 888u;
    U16(STAGE_SCRATCH + 0x0Du) = (k == 2) ? 9u : 3u; /* k=2 bad subAction -> ret 2; k=3 subAction=3 missing cursor -> ret 1 */
    uint32_t len = (k == 0) ? 9u : 17u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCF0E90u, "C2S_HandlePacket1C_ShrineOrOrificeItemAction_6FCF0E90_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_obj_ret1" : k == 2 ? "bad_sub9_ret2" : "sub3_missing_cursor_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Batch 2: Quest Callbacks & Progression (76 VAs) */

static void emit_batch2_vas(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* 2A [1..7]: 7 SubParty propagation callbacks (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  {
    typedef struct {
      uint32_t va;
      const char *name;
      uint32_t qBitId;
      uint32_t nodeQId;
      uint32_t targetLevelId;
      int needClient;
    } SubPartySpec;
    static const SubPartySpec kSubParty[] = {
      { 0x6FCDA180u, "ACT4Q1_PropagateQuestFailureToSubParty_6FCDA180_113c",                   0x19u, 0x16u, 103u, 0 },
      { 0x6FCDA490u, "ACT4Q3_PropagateQuestCompletionToPartyCallback_6FCDA490_113c",           0x1Au, 0x17u, 103u, 1 },
      { 0x6FCE5B80u, "ACT2Q5_UnitIterate_PropagateCompleteToSubParty_6FCE5B80_113c",           0x0Du, 0x0Cu,  40u, 0 },
      { 0x6FCE5ED0u, "ACT2Q3_UnitIterate_PropagateCompleteToSubParty_6FCE5ED0_113c",           0x0Bu, 0x0Au,  40u, 0 },
      { 0x6FCE65A0u, "ACT2Q6_PropagatePartyCompletionCallback_6FCE65A0_113c",                  0x0Eu, 0x0Du,  40u, 1 },
      { 0x6FD06850u, "ACT3Q7_PropagateMephistoCompletionToPartyCallback_6FD06850_113c",        0x16u, 0x14u,  75u, 1 },
      { 0x6FD06980u, "ACT3Q5_PropagateCouncilCompletionToPartyCallback_6FD06980_113c",         0x15u, 0x13u,  75u, 0 },
    };
    for (size_t i = 0; i < sizeof(kSubParty) / sizeof(kSubParty[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, kSubParty[i].targetLevelId);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 300u + (uint32_t)i);
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5004u, 5004u, 400u + (uint32_t)i);
        attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
        attach_quest_bits(STAGE_UDATA1, 0u, STAGE_QBITS1);
        insert_server_unit(STAGE_GAME, STAGE_UNIT0);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
        stage_quest_node(STAGE_QUEST0, kSubParty[i].nodeQId, STAGE_QUESTEX0, 0u);
        stage_subparty(1u, 10u, 20u);
        if (kSubParty[i].needClient) {
          link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, STAGE_CLIENT1);
          link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u, 0u);
          U16(STAGE_CLIENT0 + 0x0Au) = 0x0020u;
          U16(STAGE_CLIENT1 + 0x0Au) = 0x0020u;
        }
        if (k >= 1) set_quest_bit(STAGE_QBITS0, kSubParty[i].qBitId, 0x0Du);
        if (k == 1) set_quest_bit(STAGE_QBITS0, kSubParty[i].qBitId, 0u);
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
        c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
        run_and_emit(kSubParty[i].va, kSubParty[i].name, k,
                     k == 0 ? "bit0d_clear_noop" : k == 1 ? "propagate_member1_only" : "propagate_both_members",
                     &c, ts, 3, 0xFFFFFFFFu, 0);
      }
    }
  }

  /* 2A [8] 0x6FD06B90 ACT3Q4_PropagateTomeQuestStateToSubParty_6FD06B90_113c (eax=pPlayer, esi=pGame, ret 0, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 310u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5004u, 5004u, 311u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    attach_quest_bits(STAGE_UDATA1, 0u, STAGE_QBITS1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_quest_node(STAGE_QUEST0, 0x12u, STAGE_QUESTEX0, 0u);
    stage_subparty(1u, 10u, 20u);
    U32(STAGE_QUESTEX0 + 0x18u) = (k == 2) ? 7u : 5u;
    if (k == 1) set_quest_bit(STAGE_QBITS0, 0x14u, 0u);
    uint32_t pPl = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = pPl; c.esi = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = pPl;
    run_and_emit(0x6FD06B90u, "ACT3Q4_PropagateTomeQuestStateToSubParty_6FD06B90_113c", k,
                 k == 0 ? "null_player_noop" : k == 1 ? "sync_member1_state5" : "sync_both_state7",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 2B [9..12]: 4 Quest Timer alert callbacks (ecx=pGame, edx=pQuest, ret 0, ret al=1) */
  {
    typedef struct {
      uint32_t va;
      const char *name;
      uint32_t qId;
      uint32_t stateClrOff;
      int mode; /* 0: check +0xC==4; 1: check +0xB!=4; 2: check +0xB not in {3,4,5} */
    } TimerAlertSpec;
    static const TimerAlertSpec kTimerAlerts[] = {
      { 0x6FCE5E30u, "ACT2Q3_TimerSendQuest11Alert_6FCE5E30_113c",             0x0Au, 0x06u, 0 },
      { 0x6FCE6010u, "ACT2Q1_TimerSendQuest9Alert_6FCE6010_113c",              0x08u, 0x0Au, 0 },
      { 0x6FD068B0u, "ACT3Q7_SendMephistoQuestState4Timer_6FD068B0_113c",      0x14u, 0x00u, 1 },
      { 0x6FCE58B0u, "ACT2Q6_TimerSendQuest14Alert_6FCE58B0_113c",             0x0Du, 0x00u, 2 },
    };
    for (size_t i = 0; i < sizeof(kTimerAlerts) / sizeof(kTimerAlerts[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_quest_node(STAGE_QUEST0, kTimerAlerts[i].qId, STAGE_QUESTEX0, 0u);
        U8(STAGE_QUESTEX0 + kTimerAlerts[i].stateClrOff) = 1u;
        U8(STAGE_QUEST0 + 0x14u) = 1u;
        if (kTimerAlerts[i].mode == 0) {
          U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 2u : 4u;
          U8(STAGE_QUEST0 + 0x0Bu) = 1u;
        } else if (kTimerAlerts[i].mode == 1) {
          U8(STAGE_QUEST0 + 0x0Bu) = (k == 0) ? 4u : 2u;
        } else {
          U8(STAGE_QUEST0 + 0x0Bu) = (k == 0) ? 5u : 1u;
        }
        if (k == 2) {
          stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (kTimerAlerts[i].qId == 0x14u) ? 75u : 40u);
          stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 320u + (uint32_t)i);
          attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
          link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
          insert_server_unit(STAGE_GAME, STAGE_UNIT0);
        }
        c.ecx = STAGE_GAME; c.edx = STAGE_QUEST0; c.calleePop = 0u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_QUEST0;
        run_and_emit(kTimerAlerts[i].va, kTimerAlerts[i].name, k,
                     k == 0 ? "skip_branch_clr_flag" : k == 1 ? "fire_no_players" : "fire_with_player",
                     &c, ts, 2, 0xFFu, 0);
      }
    }
  }

  /* 2B [13] 0x6FCE5BE0 ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c (ecx=pGame, edx=pQuest, ret 0, ret al) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Cu, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x14u) = 1u;
    U8(STAGE_QUESTEX0 + 0x08u) = 1u;
    U8(STAGE_QUESTEX0 + 0x09u) = (k == 2) ? 1u : 0u;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 0x4Au);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 325u);
      attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
      set_quest_bit(STAGE_QBITS0, 0x0Du, 0x0Du);
      link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FCE5BE0u, "ACT2Q5_TimerSummonerTauntAndAlert_6FCE5BE0_113c", k,
                 k == 0 ? "taunt_phase_no_players" : k == 1 ? "taunt_phase_in_arcane" : "alert_phase_ret1",
                 &c, ts, 2, 0xFFu, 0);
  }

  /* 2B [14] 0x6FCE6AF0 ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c (ecx=pGame, edx=pQuest, ret 0, ret al) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x01u) = 1u;
    U8(STAGE_QUESTEX0 + 0x02u) = (k == 0) ? 1u : 0u;
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 2) ? 2u : 0u;
    if (k == 2) {
      stage_act2_env();
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 326u);
      attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
      link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
      U8(STAGE_CLIENT0 + 0x1ACu) = 1u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FCE6AF0u, "ACT2Q3_TimerActivateTaintedSunAndSyncPlayers_6FCE6AF0_113c", k,
                 k == 0 ? "already_started" : k == 1 ? "no_act2_defer_flag3" : "activate_and_sync",
                 &c, ts, 2, 0xFFu, 0);
  }

  /* 2B [15] 0x6FCE6A30 ACT2Q3_StartEclipseEvent_6FCE6A30_113c (esi=pQuest, ret 0, ret al) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 1) ? 2u : 0u;
    U8(STAGE_QUEST0 + 0x14u) = 1u;
    if (k >= 1) stage_act2_env();
    if (k == 2) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 327u);
      attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
      link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
      U8(STAGE_CLIENT0 + 0x1ACu) = 1u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.esi = STAGE_QUEST0; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FCE6A30u, "ACT2Q3_StartEclipseEvent_6FCE6A30_113c", k,
                 k == 0 ? "no_act2_ret0" : k == 1 ? "act2_env_no_players_ret1" : "act2_env_with_player_ret1",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* 2B [16] 0x6FCE5E90 ACT2Q3_EndTaintedSunEclipse_6FCE5E90_113c (eax=pGame, s0=pQuest, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x02u) = 1u;
    if (k >= 1) stage_act2_env();
    if (k == 2) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 328u);
      link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
      U8(STAGE_CLIENT0 + 0x1ACu) = 1u;
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FCE5E90u, "ACT2Q3_EndTaintedSunEclipse_6FCE5E90_113c", k,
                 k == 0 ? "no_act2_noop" : k == 1 ? "reset_env_no_players" : "reset_env_send_pkt53",
                 &c, ts, 2, 0u, 0);
  }

  /* 2B [17] 0x6FCE7130 ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c (eax=pQuest, edi=pPlayer, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 329u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    if (k == 0) stage_act2_env();
    uint32_t pPl = (k == 2) ? 0u : STAGE_UNIT0;
    c.eax = STAGE_QUEST0; c.edi = pPl; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = pPl;
    run_and_emit(0x6FCE7130u, "ACT2Q3_TryActivateTaintedSunOrSendPacket5D_6FCE7130_113c", k,
                 k == 0 ? "activated_set_flag2" : k == 1 ? "fallback_send_5d" : "fallback_null_player",
                 &c, ts, 2, 0u, 0);
  }

  /* 2B [18] 0x6FCE6920 ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c (eax=pGame, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = (k == 2) ? 2u : 0u;
      U8(STAGE_QUEST0 + 0x0Bu) = (k == 3) ? 3u : 0u;
      U8(STAGE_QUEST0 + 0x14u) = 1u;
    }
    c.eax = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FCE6920u, "ACT2Q4_ActivateArcaneSanctuaryQuestOrOpenPortal_6FCE6920_113c", k,
                 k == 0 ? "no_quest_noop" : k == 1 ? "seq0_log0_activate" : k == 2 ? "seq2_log0_alert" : "seq0_log3_keep_log",
                 &c, ts, 1, 0u, 0);
  }

  /* 2B [19] 0x6FCE6CA0 ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c (ebx=pGame, edi=pPlayer, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 330u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    if (k >= 1) {
      U32(STAGE_QUESTEX0 + 0x18u) = 5u;
      U32(STAGE_QUESTEX0 + 0x24u) = 3u;
      U32(STAGE_QUESTEX0 + 0x1Cu) = 1u;
      if (k == 2) {
        uint32_t qB = STAGE_SCRATCH + 0x000u;
        uint32_t exB = STAGE_SCRATCH + 0x200u;
        U32(qB + 0x00u) = 0x0Bu; U32(qB + 0x04u) = STAGE_GAME; U32(qB + 0x18u) = exB;
        U8(qB + 0x09u) = 1u; U8(qB + 0x14u) = 1u;
        stage_quest_node(STAGE_QUEST0, 0x09u, STAGE_QUESTEX0, qB);
      } else {
        stage_quest_node(STAGE_QUEST0, 0x09u, STAGE_QUESTEX0, 0u);
      }
    }
    c.ebx = STAGE_GAME; c.edi = STAGE_UNIT0; c.calleePop = 0u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCE6CA0u, "ACT2Q4_CompleteJerhynIntroAndActivateArcane_6FCE6CA0_113c", k,
                 k == 0 ? "no_quest_nodes" : k == 1 ? "update_quest9_only" : "update_q9_and_activate_qB",
                 &c, ts, 2, 0u, 0);
  }

  /* 2C [20..22]: 3 OnNpcActivated Alert callbacks (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  {
    typedef struct {
      uint32_t va;
      const char *name;
      uint32_t qId;
      uint16_t npcClass;
      uint32_t flagOff;
    } NpcAlertSpec;
    static const NpcAlertSpec kNpcAlerts[] = {
      { 0x6FD06D90u, "ACT3Q3_OnCainActivatedSendKhalimsWillAlert_6FD06D90_113c",  0x10u, 0xF5u, 0x01u },
      { 0x6FD06910u, "ACT3Q7_OnOrmusActivatedSendMephistoAlert_6FD06910_113c",    0x14u, 0xFFu, 0x03u },
      { 0x6FD069E0u, "ACT3Q5_OnOrmusActivatedSendTravincalAlert_6FD069E0_113c",   0x13u, 0xFFu, 0x04u },
    };
    for (size_t i = 0; i < sizeof(kNpcAlerts) / sizeof(kNpcAlerts[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_quest_node(STAGE_QUEST0, kNpcAlerts[i].qId, STAGE_QUESTEX0, 0u);
        U8(STAGE_QUEST0 + 0x14u) = 1u;
        U32(STAGE_QUEST0 + 0xA8u) = 0x12345678u;
        U8(STAGE_QUESTEX0 + kNpcAlerts[i].flagOff) = (k >= 1) ? 1u : 0u;
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u,
                          (k == 0) ? 0x99u : (uint32_t)kNpcAlerts[i].npcClass, 55u, 1u, 5002u, 5002u, 335u + (uint32_t)i);
        U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
        U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
        if (k == 2) {
          stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 340u + (uint32_t)i);
          attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
          link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
          insert_server_unit(STAGE_GAME, STAGE_UNIT0);
          U8(STAGE_QUEST0 + 0x0Cu) = 2u;
        }
        c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
        ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
        run_and_emit(kNpcAlerts[i].va, kNpcAlerts[i].name, k,
                     k == 0 ? "wrong_npc_noop" : k == 1 ? "fire_no_players" : "fire_with_player",
                     &c, ts, 2, 0u, 0);
      }
    }
  }

  /* 2D [23] 0x6FD06B20 ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Fu, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x10u) = (k == 0) ? 2u : 1u;
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUESTEX0 + 0x14u) = (k == 1) ? 0u : 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = 2u;
    U8(STAGE_QUEST0 + 0x14u) = 1u;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD06B20u, "ACT3Q1_OnGoldenBirdItemDropped_6FD06B20_113c", k,
                 k == 0 ? "count_2_to_1" : k == 1 ? "count_1_to_0_flag14_off" : "count_0_trigger_alert6",
                 &c, ts, 2, 0u, 0);
  }

  /* 2D [24] 0x6FD06FE0 ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x12u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x08u) = (k == 0) ? 2u : 1u;
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUESTEX0 + 0x02u) = (k == 1) ? 0u : 1u;
    U8(STAGE_QUEST0 + 0x0Cu) = 2u;
    U8(STAGE_QUEST0 + 0x14u) = 1u;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD06FE0u, "ACT3Q4_OnLamEsensTomeDropped_6FD06FE0_113c", k,
                 k == 0 ? "count_2_to_1" : k == 1 ? "count_1_to_0_flag2_off" : "count_0_trigger_alert8",
                 &c, ts, 2, 0u, 0);
  }

  /* 2D [25] 0x6FD06F60 ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 345u);
    stage_quest_node(STAGE_QUEST0, 0x12u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = 1u;
    U8(STAGE_QUEST0 + 0x14u) = 1u;
    U8(STAGE_QUESTEX0 + 0x05u) = (k == 2) ? 1u : 0u;
    if (k >= 1) attach_cursor_item(STAGE_UNIT0, g_item_bbb, 901u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD06F60u, "ACT3Q4_OnPlayerCheckLamEsensTome_6FD06F60_113c", k,
                 k == 0 ? "no_tome_noop" : k == 1 ? "has_tome_flag5_off" : "has_tome_trigger_alert2",
                 &c, ts, 2, 0u, 0);
  }

  /* 2D [26] 0x6FD03B00 ACT3Q4_OnQuestUnitDeactivate113c (eax=pQuest, ecx=pUnit, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x12u, STAGE_QUESTEX0, 0u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, 0u, 0u, 2u, 193u, 0x55u, 0u, 0u, 0u, 346u);
    U8(STAGE_QUESTEX0 + 0x02u) = 1u;
    U32(STAGE_QUESTEX0 + 0x04u) = (k == 0) ? 0x99u : (k == 1 ? 0xFFFFFFFFu : 0x55u);
    uint32_t pU = (k == 1) ? 0u : STAGE_UNIT0;
    c.eax = STAGE_QUEST0; c.ecx = pU; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = pU;
    run_and_emit(0x6FD03B00u, "ACT3Q4_OnQuestUnitDeactivate113c", k,
                 k == 0 ? "guid_mismatch" : k == 1 ? "null_unit_matches_ffffffff" : "unit_guid_matches",
                 &c, ts, 2, 0u, 0);
  }

  /* 2D [27] 0x6FD051C0 ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, (k == 1) ? 5u : 1u, 10u, 1u, 5000u, 5000u, 347u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, (k == 0) ? 0xAAu : 0xFEu, 55u, 1u, 5002u, 5002u, 348u);
    stage_quest_node(STAGE_QUEST0, 0x12u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x0Cu) = 1u;
    U32(STAGE_QUESTEX0 + 0x10u) = 10u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD051C0u, "ACT3Q4_OnAlkorInteractPlayVoice_6FD051C0_113c", k,
                 k == 0 ? "wrong_npc_noop" : k == 1 ? "druid_skip_sound_clr_flag" : "sorc_play_sound43_clr_flag",
                 &c, ts, 2, 0u, 0);
  }

  /* 2D [28] 0x6FD04900 ACT3Q3_OnKhalimsWillCubed113c (eax=pPlayer, ecx=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 349u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
      U32(STAGE_QUESTEX0 + 0x10u) = (k == 1) ? 2u : 5u;
      U32(STAGE_QUESTEX0 + 0x14u) = 3u;
      U32(STAGE_QUESTEX0 + 0x18u) = 4u;
      U32(STAGE_QUESTEX0 + 0x1Cu) = 6u;
      U32(STAGE_QUESTEX0 + 0x20u) = 1u;
    }
    if (k == 2) set_quest_bit(STAGE_QBITS0, 0x12u, 0u);
    c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FD04900u, "ACT3Q3_OnKhalimsWillCubed113c", k,
                 k == 0 ? "no_quest10_noop" : k == 1 ? "update_counters_a" : "update_counters_b",
                 &c, ts, 2, 0u, 0);
  }

  /* 2D [29] 0x6FD049E0 ACT3Q7_Callback14_PlayerJoined113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 350u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x12u, 0u);
    if (k == 1) set_quest_bit(STAGE_QBITS0, 0x12u, 7u);
    if (k == 2) set_quest_bit(STAGE_QBITS0, 0x12u, 2u);
    if (k == 3) U32(STAGE_QUESTEX0 + 0x14u) = 1u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD049E0u, "ACT3Q7_Callback14_PlayerJoined113c", k,
                 k == 0 ? "bit0_complete_noop" : k == 1 ? "bit7_set_state2_7" : k == 2 ? "bit2_set_state2_7" : "nonzero_sum_set_state2_7",
                 &c, ts, 2, 0u, 0);
  }

  /* 2D [30] 0x6FD03050 ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 351u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x01u) = 1u;
    U32(STAGE_QBITS1 + 0x00u) = STAGE_QBITS1 + 0x10u;
    U32(STAGE_QBITS1 + 0x04u) = 0x60u;
    U32(STAGE_QUESTCTRL + 0x08u) = (k == 2) ? 1u : 0u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
    if (k >= 1) set_quest_bit(STAGE_QBITS0, 0x20u, 0u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD03050u, "ACT3Q7_SyncGameQuest20FromPlayer_6FD03050_113c", k,
                 k == 0 ? "bit0_clear_noop" : k == 1 ? "assert_no_history_820" : "sync_game_quest20_bit0d",
                 &c, ts, 2, 0u, k == 1);
  }

  /* 2D [31] 0x6FCE1990 ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c (eax=pQuestSrc, s0=bClear, ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x09u) = (k == 0) ? 0u : 1u;
    U8(STAGE_QUESTEX0 + 0x10u) = 1u;
    U8(STAGE_GAME + 0x6Au) = (k == 2) ? 3u : 0u;
    uint32_t bClr = (k == 1) ? 1u : 0u;
    c.eax = STAGE_QUEST0; c.nargs = 1; c.args[0] = bClr; c.calleePop = 4u;
    ts[0] = STAGE_QUEST0; ts[1] = bClr;
    run_and_emit(0x6FCE1990u, "ACT2Q6_UpdateDurielQuestStateFromPortalFlag_6FCE1990_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "clear_override" : k == 2 ? "game6a_3_sets_8" : "game6a_0_sets_9",
                 &c, ts, 2, 0u, 0);
  }

  /* 2D [32] 0x6FCE23C0 ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t qD = STAGE_SCRATCH + 0x000u, exD = STAGE_SCRATCH + 0x200u;
    U32(qD + 0x00u) = 0x0Du; U32(qD + 0x04u) = STAGE_GAME; U32(qD + 0x18u) = exD; U8(qD + 0x09u) = 1u;
    stage_quest_node(STAGE_QUEST0, 0x09u, STAGE_QUESTEX0, qD);
    U32(STAGE_QUESTEX0 + 0x18u) = 1u; /* msf */
    U32(STAGE_QUESTEX0 + 0x1Cu) = (k == 0) ? 2u : 0u; /* hst */
    U32(STAGE_QUESTEX0 + 0x20u) = 1u; /* box */
    U32(STAGE_QUESTEX0 + 0x24u) = 1u; /* vip */
    U8(STAGE_QUESTEX0 + 0x28u) = (k == 1) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x29u) = (k == 2) ? 1u : 0u;
    uint32_t itemId = (k == 0) ? g_item_hst : (k == 1 ? g_item_msf : (k == 2 ? g_item_box : g_item_vip));
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, itemId, 902u, 4u, 0u, 0u, 352u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT2;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE23C0u, "ACT2Q2_Callback_UnitDropOrDestroyHoradricItem_6FCE23C0_113c", k,
                 k == 0 ? "drop_hst_still_1" : k == 1 ? "drop_msf_updates_duriel" : k == 2 ? "drop_box_updates_duriel" : "drop_vip_no_altar",
                 &c, ts, 2, 0u, 0);
  }

  /* 2D [33] 0x6FCE3E10 ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 353u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    set_quest_bit(STAGE_QBITS0, 0x0Au, 4u);
    set_quest_bit(STAGE_QBITS0, 0x0Au, 5u);
    set_quest_bit(STAGE_QBITS0, 0x0Au, 6u);
    uint32_t itemId = (k == 0) ? g_item_vip : (k == 1 ? g_item_box : g_item_msf);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, itemId, 903u, 4u, 0u, 0u, 354u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT2;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE3E10u, "ACT2Q2_Callback_ClearDroppedStaffItemQuestFlags_6FCE3E10_113c", k,
                 k == 0 ? "clear_vip_bit4" : k == 1 ? "clear_box_bit6" : "clear_msf_bit5",
                 &c, ts, 2, 0u, 0);
  }

  /* 2E [34] 0x6FCD9C00 ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c (eax=pGame, s0=pTargetUnit, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 355u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 256u, 55u, 1u,
                      (k == 2) ? 5002u : 5040u, (k == 2) ? 5002u : 5040u, 356u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_quest_node(STAGE_QUEST0, 0x16u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x12u) = (k == 0) ? 0u : 1u;
    c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FCD9C00u, "ACT4Q1_IsRoomClearOfQuestPlayers_6FCD9C00_113c", k,
                 k == 0 ? "flag12_off_ret0" : k == 1 ? "player_far_clear_ret1" : "player_near_ret0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 2E [35] 0x6FCE4AA0 ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c (eax=pGame, s0=pTargetUnit, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 73u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 357u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 100u, 56u, 0u,
                      (k == 2) ? 5003u : 5050u, (k == 2) ? 5003u : 5050u, 358u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x3Du) = (k == 0) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x0Fu) = 1u;
    c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FCE4AA0u, "ACT2Q6_CheckTalRashaPortalNoPlayerNear_6FCE4AA0_113c", k,
                 k == 0 ? "flag3d_fast_ret1" : k == 1 ? "player_far_ret1" : "player_near_ret0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 2E [36] 0x6FCE1D30 ACT2Q6_StatusFilter_6FCE1D30_113c (ecx=pQuest, edx=pPlayer, s0=pGlob, s1=pQFlags, s2=pOut, ret 0xC, ret al=1) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(STAGE_QBITS0 + 0x04u) = 0x60u;
    U8(STAGE_SCRATCH) = 0xEEu;
    if (k >= 1) set_quest_bit(STAGE_QBITS0, 7u, 0u);
    if (k == 1) { U8(STAGE_QUESTEX0 + 0x10u) = 1u; U8(STAGE_QUESTEX0 + 0x14u) = 9u; }
    if (k == 2) set_quest_bit(STAGE_QBITS0, 0x0Eu, 3u);
    if (k == 3) set_quest_bit(STAGE_QBITS0, 0x0Eu, 4u);
    if (k == 4) { U8(STAGE_QUEST0 + 0x09u) = 1u; U8(STAGE_QUEST0 + 0x0Cu) = 3u; }
    c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = 0u; c.args[1] = STAGE_QBITS0; c.args[2] = STAGE_SCRATCH; c.calleePop = 0x0Cu;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = STAGE_QBITS0; ts[4] = STAGE_SCRATCH;
    run_and_emit(0x6FCE1D30u, "ACT2Q6_StatusFilter_6FCE1D30_113c", k,
                 k == 0 ? "q7_clear_out0" : k == 1 ? "override_out9" : k == 2 ? "bit3_out5" : k == 3 ? "bit4_out6" : "seq3_out0c",
                 &c, ts, 5, 0xFFu, 0);
  }

  /* 2E [37] 0x6FCE4C30 ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c (eax=pQF, ecx=pPlayer, s0=pGame, ret 4, void; TS: pPlayer, pQF, pGame) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 359u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    U8(STAGE_GAME + 0x6Du) = (k == 1) ? 1u : 0u;
    U16(STAGE_CLIENT0 + 0x0Au) = (k == 0) ? 0x0000u : (k == 1 ? 0x0020u : 0x1020u);
    c.eax = STAGE_QBITS0; c.ecx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_QBITS0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCE4C30u, "ACT2Q6_CompleteDurielQuestFlagsAndProgression_6FCE4C30_113c", k,
                 k == 0 ? "classic_norm_prog2" : k == 1 ? "lod_nm_prog7" : "already_higher_prog",
                 &c, ts, 3, 0u, 0);
  }

  /* 2E [38] 0x6FD034D0 ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c (eax=pQF, ecx=pPlayer, s0=pGame, ret 4, void; TS: pQF, pPlayer, pGame) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 360u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    U8(STAGE_GAME + 0x6Du) = (k == 1) ? 1u : 0u;
    U16(STAGE_CLIENT0 + 0x0Au) = (k == 0) ? 0x0000u : (k == 1 ? 0x0020u : 0x1020u);
    c.eax = STAGE_QBITS0; c.ecx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_QBITS0; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FD034D0u, "ACT3Q7_CompleteMephistoPlayerQuestAndAdvanceAct_6FD034D0_113c", k,
                 k == 0 ? "classic_norm_prog3" : k == 1 ? "lod_nm_prog8" : "already_higher_prog",
                 &c, ts, 3, 0u, 0);
  }

  /* 2E [39] 0x6FCD9A30 ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c (eax=pQF, ecx=pPlayer, ebx=pGame, ret 0, void; TS: pQF, pPlayer, pGame) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 361u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    U32(STAGE_GAME + 0x70u) = (k == 0) ? 1u : 0u;
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    U16(STAGE_CLIENT0 + 0x0Au) = (k == 2) ? 0x0020u : 0x0000u;
    c.eax = STAGE_QBITS0; c.ecx = STAGE_UNIT0; c.ebx = STAGE_GAME; c.calleePop = 0u;
    ts[0] = STAGE_QBITS0; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCD9A30u, "ACT4Q3_CompleteQuestForPlayer_6FCD9A30_113c", k,
                 k == 0 ? "lod_no_act4_prog" : k == 1 ? "classic_norm_prog4" : "classic_nm_prog9",
                 &c, ts, 3, 0u, 0);
  }

  /* 2F [40] 0x6FCD9320 ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c (ecx=pQuest, edx=pArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 362u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 0x16u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x19u;
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x19u, 0u);
    if (k == 1) set_quest_bit(STAGE_QBITS0, 0x19u, 4u);
    if (k == 2) set_quest_bit(STAGE_QBITS0, 0x19u, 3u);
    if (k == 3) set_quest_bit(STAGE_QBITS0, 0x19u, 2u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCD9320u, "ACT4Q1_SyncQuestDataFromPlayerFlags_6FCD9320_113c", k,
                 k == 0 ? "bit0_noop" : k == 1 ? "bit4_sync" : k == 2 ? "bit3_sync" : "bit2_sync",
                 &c, ts, 2, 0u, 0);
  }

  /* 2F [41] 0x6FCD8F20 ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c (ecx=pQuest, edx=pArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 363u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x1Au;
    if (k == 0) { set_quest_bit(STAGE_QBITS0, 0x1Au, 9u); set_quest_bit(STAGE_QBITS0, 0x1Au, 0u); }
    if (k == 1) set_quest_bit(STAGE_QBITS0, 0x1Au, 4u);
    if (k == 2) set_quest_bit(STAGE_QBITS0, 0x1Au, 3u);
    if (k == 3) set_quest_bit(STAGE_QBITS0, 0x1Au, 2u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCD8F20u, "ACT4Q3_SyncQuestDataFromPlayerFlags_6FCD8F20_113c", k,
                 k == 0 ? "lod_clr_bit9_then_bit0_stop" : k == 1 ? "bit4_sync" : k == 2 ? "bit3_sync" : "bit2_sync",
                 &c, ts, 2, 0u, 0);
  }

  /* 2F [42] 0x6FCE2900 ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c (ecx=pQuest, edx=pArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 364u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x0Eu;
    set_quest_bit(STAGE_QBITS0, 0x0Au, 9u);
    if (k == 0) { set_quest_bit(STAGE_QBITS0, 0x0Au, 0u); set_quest_bit(STAGE_QBITS0, 0x0Eu, 0u); }
    if (k == 1) set_quest_bit(STAGE_QBITS0, 0x0Eu, 2u);
    if (k == 2) set_quest_bit(STAGE_QBITS0, 0x0Eu, 3u);
    if (k == 3) set_quest_bit(STAGE_QBITS0, 0x0Eu, 4u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG; c.calleePop = 0u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE2900u, "ACT2Q6_Callback11_SyncPlayerQuestState_6FCE2900_113c", k,
                 k == 0 ? "qA_and_qE_complete_set3d" : k == 1 ? "bit2_sync" : k == 2 ? "bit3_sync" : "bit4_sync",
                 &c, ts, 2, 0u, 0);
  }

  /* 2G [43] 0x6FCE4DE0 ACT2Q5_UnitIteratePlaySummonerTauntInArcane_6FCE4DE0_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2) ? 0x4Au : 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 365u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    if (k >= 1) set_quest_bit(STAGE_QBITS0, 0x0Du, 0x0Du);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE4DE0u, "ACT2Q5_UnitIteratePlaySummonerTauntInArcane_6FCE4DE0_113c", k,
                 k == 0 ? "bit0d_clear" : k == 1 ? "wrong_level_40" : "arcane_4a_play_sound33",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [44] 0x6FD030C0 ACT3Q0_MarkWandererSeenCallback113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 1u : 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 366u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    attach_quest_bits(STAGE_UDATA0, 1u, STAGE_QBITS1);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD030C0u, "ACT3Q0_MarkWandererSeenCallback113c", k,
                 k == 0 ? "act1_noop" : k == 1 ? "act3_norm_set_q20" : "act3_nm_set_q20",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [45] 0x6FCE5090 ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 367u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5004u, 5004u, 368u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    attach_quest_bits(STAGE_UDATA1, 0u, STAGE_QBITS1);
    if (k == 1) set_quest_bit(STAGE_QBITS0, 0x0Bu, 0x0Du);
    if (k == 2) set_quest_bit(STAGE_QBITS1, 0x0Bu, 0x0Du);
    uint32_t pPl = (k == 2) ? STAGE_UNIT1 : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = pPl; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pPl; ts[2] = 0;
    run_and_emit(0x6FCE5090u, "ACT2Q3_RefreshPlayerEnvironmentOnSunComplete_6FCE5090_113c", k,
                 k == 0 ? "bit0d_clear_noop" : k == 1 ? "refresh_unit0_sound34" : "refresh_unit1_sound34",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [46] 0x6FD03C70 ACT3Q4_SyncTomePartyQuestStateCallback113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 369u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x12u, STAGE_QUESTEX0, 0u);
      U32(STAGE_QUESTEX0 + 0x18u) = (k == 1) ? 3u : 6u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD03C70u, "ACT3Q4_SyncTomePartyQuestStateCallback113c", k,
                 k == 0 ? "no_quest12_noop" : k == 1 ? "set_q14_bit3" : "set_q14_bit6",
                 &c, ts, 3, 0u, 0);
  }

  /* 2G [47..56]: 10 Act-gated UnitIterate Complete/Update callbacks (ecx=pGame, edx=pPlayer, s0=0, ret 4) */
  {
    typedef struct {
      uint32_t va;
      const char *name;
      uint32_t nodeQId;     /* 0 = no quest node required */
      uint32_t targetLvl;
      uint32_t retMask;
      int needClient;
      int extraMode; /* 0: basic; 1: 0x6FD037D0 toggle (0x12,0); 2: 0x6FCE3480/0x6FCD94F0 preset bits 2..5 */
    } ActCompleteSpec;
    static const ActCompleteSpec kActComp[] = {
      { 0x6FCE3900u, "ACT2Q3_UnitIterate_CompleteInAct2_6FCE3900_113c",                         0x00u,  40u, 0u,          0, 0 },
      { 0x6FCD94F0u, "ACT4Q1_MarkQuestFailedIfPlayerInAct4_6FCD94F0_113c",                      0x00u, 103u, 0u,          0, 2 },
      { 0x6FD05B60u, "ACT3Q7_UnitIterate_CompleteInAct3ForParty_6FD05B60_113c",                 0x14u,  75u, 0u,          1, 0 },
      { 0x6FD037D0u, "ACT3Q5_CompleteCouncilPartyCallback113c",                                 0x00u,  75u, 0u,          0, 1 },
      { 0x6FCE55B0u, "ACT2Q1_GrantRadamentKillFlagsToAct2PlayerCallback_6FCE55B0_113c",         0x00u,  40u, 0u,          1, 0 },
      { 0x6FD064C0u, "ACT3Q4_CompleteLamEsensTomePartyCallback_6FD064C0_113c",                  0x00u,  75u, 0xFFFFFFFFu, 1, 0 },
      { 0x6FCE2E70u, "ACT2Q5_UnitIterate_CompleteInAct2_6FCE2E70_113c",                         0x0Cu,  40u, 0u,          0, 0 },
      { 0x6FCE3480u, "ACT2Q4_UnitIterate_CompleteInAct2_6FCE3480_113c",                         0x00u,  40u, 0u,          0, 2 },
      { 0x6FCE5910u, "ACT2Q6_UnitIterate_CompleteInAct2ForKillers_6FCE5910_113c",               0x0Du,  40u, 0u,          1, 0 },
      { 0x6FD041D0u, "ACT3Q2_SetGidbinnTurnInPartyCallback_6FD041D0_113c",                      0x11u,  75u, 0u,          0, 0 },
      { 0x6FCE29E0u, "ACT2Q6_UnitIterate_SetState5InAct2_6FCE29E0_113c",                        0x0Du,  40u, 0u,          0, 0 },
    };
    for (size_t i = 0; i < sizeof(kActComp) / sizeof(kActComp[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 1u : kActComp[i].targetLvl);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 370u + (uint32_t)i);
        attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
        attach_quest_bits(STAGE_UDATA0, 1u, STAGE_QBITS1);
        U8(STAGE_GAME + 0x6Du) = (k == 2 && kActComp[i].extraMode != 1) ? 1u : 0u;
        if (kActComp[i].nodeQId != 0u) {
          stage_quest_node(STAGE_QUEST0, kActComp[i].nodeQId, STAGE_QUESTEX0, 0u);
        }
        if (kActComp[i].needClient) {
          link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
          U16(STAGE_CLIENT0 + 0x0Au) = 0x0020u;
        }
        if (kActComp[i].extraMode == 1 && k == 2) {
          set_quest_bit(STAGE_QBITS0, 0x12u, 0u);
        }
        if (kActComp[i].extraMode == 2 && k >= 1) {
          uint32_t qb = (k == 2) ? STAGE_QBITS1 : STAGE_QBITS0;
          uint32_t qNum = (kActComp[i].va == 0x6FCD94F0u) ? 0x19u : 0x0Cu;
          set_quest_bit(qb, qNum, 4u);
        }
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
        run_and_emit(kActComp[i].va, kActComp[i].name, k,
                     k == 0 ? "wrong_act_noop" : k == 1 ? "target_act_case1" : "target_act_case2",
                     &c, ts, 3, kActComp[i].retMask, 0);
      }
    }
  }

  /* 2G [58] 0x6FCE3010 ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 385u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    attach_quest_bits(STAGE_UDATA0, 1u, STAGE_QBITS1);
    stage_quest_node(STAGE_QUEST0, 0x0Cu, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 0u : 1u;
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE3010u, "ACT2Q5_UnitIterate_SetState2IfQuestActive_6FCE3010_113c", k,
                 k == 0 ? "seq0_noop" : k == 1 ? "seq1_norm_set_bit2" : "seq1_nm_set_bit2",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [59] 0x6FD04280 ACT3Q2_SetGidbinnState0ECallback_6FD04280_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 386u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x13u, 6u);
    if (k == 1) attach_cursor_item(STAGE_UNIT0, g_item_g33, 904u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD04280u, "ACT3Q2_SetGidbinnState0ECallback_6FD04280_113c", k,
                 k == 0 ? "bit6_set_noop" : k == 1 ? "holds_g33_noop" : "no_g33_set_bit0e",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [60] 0x6FD05370 ACT3Q6_SyncGidbinnState02Callback113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 387u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    attach_quest_bits(STAGE_UDATA0, 1u, STAGE_QBITS1);
    stage_quest_node(STAGE_QUEST0, 0x0Fu, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 1u : (k == 1 ? 2u : 3u);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD05370u, "ACT3Q6_SyncGidbinnState02Callback113c", k,
                 k == 0 ? "seq1_noop" : k == 1 ? "seq2_norm_set_bit2" : "seq3_nm_set_bit2",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [61] 0x6FCE3F40 ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 388u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 9u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x14u) = 2u;
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x0Au, 0u);
    if (k == 1) attach_cursor_item(STAGE_UNIT0, g_item_msf, 905u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE3F40u, "ACT2Q2_PlayerJoinIncrementStaffCountCallback_6FCE3F40_113c", k,
                 k == 0 ? "bit0_complete_noop" : k == 1 ? "holds_msf_noop" : "needs_staff_inc14",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [62] 0x6FCE3630 ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 389u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x9Cu) = 3u;
    if (k == 0) attach_cursor_item(STAGE_UNIT0, g_item_vip, 906u);
    if (k == 1) set_quest_bit(STAGE_QBITS0, 0x0Au, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE3630u, "ACT2Q3_UnitIterate_CountPlayersNeedingViperAmulet_6FCE3630_113c", k,
                 k == 0 ? "holds_vip_noop" : k == 1 ? "bit0_complete_noop" : "needs_vip_inc9c",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [63] 0x6FD03A80 ACT3Q5_SyncCouncilQuestFlagsCallback113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 390u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k >= 1) ? 2u : 1u;
    U8(STAGE_QUESTEX0 + 0x05u) = (k == 2) ? 1u : 0u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD03A80u, "ACT3Q5_SyncCouncilQuestFlagsCallback113c", k,
                 k == 0 ? "seq1_noop" : k == 1 ? "seq2_set_bit2" : "seq2_ext5_set_bit2_3",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [64..65]: 0x6FCE5100 & 0x6FCE5190 Eclipse packet 53 / 53+5D callbacks (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0; asserts 0x7CB) */
  {
    static const uint32_t kEclVa[2] = { 0x6FCE5100u, 0x6FCE5190u };
    static const char *kEclName[2] = {
      "ACT2Q3_SendEclipseStartPacket53Callback_6FCE5100_113c",
      "ACT2Q3_SendEclipseEndPacket53AndAlert5DCallback_6FCE5190_113c",
    };
    for (int i = 0; i < 2; i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0,
                          (k == 0) ? 1u : 0u, 1u, 10u, 1u, 5000u, 5000u, 391u + (uint32_t)i);
        if (k >= 1) {
          link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
          U8(STAGE_CLIENT0 + 0x1ACu) = (k == 2) ? 1u : 0u;
        }
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
        run_and_emit(kEclVa[i], kEclName[i], k,
                     k == 0 ? "assert_no_client_7cb" : k == 1 ? "act_not_1_skip" : "act1_queue_pkt",
                     &c, ts, 3, 0xFFFFFFFFu, k == 0);
      }
    }
  }

  /* 2G [66] 0x6FD05C40 ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 75u : 0x66u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 393u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_quest_node(STAGE_QUEST0, 0x14u, STAGE_QUESTEX0, 0u);
    U16(STAGE_CLIENT0 + 0x0Au) = (k == 2) ? 0x0020u : 0x0000u;
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    if (k == 2) attach_quest_bits(STAGE_UDATA0, 1u, STAGE_QBITS1);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD05C40u, "ACT3Q7_CheckPlayerInDurance3AndAdvanceActCallback_6FD05C40_113c", k,
                 k == 0 ? "wrong_level_noop" : k == 1 ? "durance3_norm_advance" : "durance3_nm_advance",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [67] 0x6FCE5820 ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 40u : 0x49u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 394u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5004u, 5004u, 395u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    attach_quest_bits(STAGE_UDATA1, 0u, STAGE_QBITS1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    if (k == 2) stage_subparty(1u, 10u, 20u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE5820u, "ACT2Q6_UnitIterate_GrantTombEntryState5_6FCE5820_113c", k,
                 k == 0 ? "wrong_level_noop" : k == 1 ? "lair_solo_set_bit5" : "lair_party_propagate_bit5",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [68] 0x6FCE36B0 ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 40u : 61u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 396u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    attach_quest_bits(STAGE_UDATA0, 1u, STAGE_QBITS1);
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x98u) = 61u;
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE36B0u, "ACT2Q3_UnitIterate_CompleteOnAltarLevel_6FCE36B0_113c", k,
                 k == 0 ? "wrong_level_noop" : k == 1 ? "altar_level_norm_complete" : "altar_level_nm_complete",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [69] 0x6FCE31C0 ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret 0|1) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 74u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 397u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x20u) = (k == 2) ? 5010u : 5100u;
    U32(STAGE_QUESTEX0 + 0x24u) = (k == 2) ? 5010u : 5100u;
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x0Eu, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE31C0u, "ACT2Q4_UnitIterate_CheckNearHorazonTome_6FCE31C0_113c", k,
                 k == 0 ? "qE_done_ret0" : k == 1 ? "too_far_ret0" : "near_tome_sets_flag_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 2G [70] 0x6FCDAF20 ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, void; TS: 2 args!) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 75u : 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 398u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    attach_quest_bits(STAGE_UDATA0, 1u, STAGE_QBITS1);
    stage_quest_node(STAGE_QUEST0, 0x18u, STAGE_QUESTEX0, 0u);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    if (k >= 1) set_quest_bit((k == 2) ? STAGE_QBITS1 : STAGE_QBITS0, 0x1Bu, 5u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCDAF20u, "ACT4Q2_CompleteQuestForPlayerOnActChange_6FCDAF20_113c", k,
                 k == 0 ? "act3_noop" : k == 1 ? "act4_norm_complete" : "act4_nm_complete",
                 &c, ts, 2, 0u, 0);
  }

  /* 2G [71..76]: 6 SyncPlayerQuest*State callbacks (ecx=pGame, edx=pPlayer, s0=0, ret 4, ret=0) */
  {
    typedef struct {
      uint32_t va;
      const char *name;
      uint32_t nodeQId;
      int variant; /* 0: seq=2/seq=3&+0xB==1/seq=3&+0xB==2; 1: seq=2/seq=3&extC==1/seq=3&extC==0;
                      2: seq=1/seq=2/seq=3; 3: seq=2&ext1C==1/seq=2&ext1C==0/seq=3; 4: seq=2/seq=3/seq=4&+0xB==2/seq=4&+0xB==4 */
    } SyncStateSpec;
    static const SyncStateSpec kSyncStates[] = {
      { 0x6FCD9290u, "ACT4Q3_SyncPlayerQuest1AState_6FCD9290_113c",             0x17u, 0 },
      { 0x6FCD96A0u, "ACT4Q1_SyncPlayerQuest19State_6FCD96A0_113c",             0x16u, 1 },
      { 0x6FCE3750u, "ACT2Q3_UnitIterate_SyncQuestProgress_6FCE3750_113c",      0x0Au, 2 },
      { 0x6FCE4430u, "ACT2Q1_PlayerJoinSyncQuest9StateCallback_6FCE4430_113c",  0x08u, 0 },
      { 0x6FCD8E80u, "ACT4Q2_SyncPlayerQuest1BState_6FCD8E80_113c",             0x18u, 3 },
      { 0x6FCE3550u, "ACT2Q4_UnitIterate_SyncQuestProgress_6FCE3550_113c",      0x0Bu, 4 },
    };
    for (size_t i = 0; i < sizeof(kSyncStates) / sizeof(kSyncStates[0]); i++) {
      int nCases = (kSyncStates[i].variant == 4) ? 4 : 3;
      for (int k = 0; k < nCases; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 410u + (uint32_t)i);
        attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
        stage_quest_node(STAGE_QUEST0, kSyncStates[i].nodeQId, STAGE_QUESTEX0, 0u);
        if (kSyncStates[i].variant == 0) {
          U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 2u : 3u;
          U8(STAGE_QUEST0 + 0x0Bu) = (k == 1) ? 1u : 2u;
        } else if (kSyncStates[i].variant == 1) {
          U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 2u : 3u;
          U8(STAGE_QUESTEX0 + 0x0Cu) = (k == 1) ? 1u : 0u;
        } else if (kSyncStates[i].variant == 2) {
          U8(STAGE_QUEST0 + 0x0Cu) = (uint8_t)(k + 1);
        } else if (kSyncStates[i].variant == 3) {
          U8(STAGE_QUEST0 + 0x0Cu) = (k == 2) ? 3u : 2u;
          U8(STAGE_QUESTEX0 + 0x1Cu) = (k == 0) ? 1u : 0u;
        } else {
          U8(STAGE_QUEST0 + 0x0Cu) = (k == 0) ? 2u : (k == 1 ? 3u : 4u);
          U8(STAGE_QUEST0 + 0x0Bu) = (k == 2) ? 2u : 4u;
        }
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
        run_and_emit(kSyncStates[i].va, kSyncStates[i].name, k,
                     k == 0 ? "sync_case0" : k == 1 ? "sync_case1" : k == 2 ? "sync_case2" : "sync_case3",
                     &c, ts, 3, 0xFFFFFFFFu, 0);
      }
    }
  }
}

/* ------------------------------- Batch 3: Items, Skills, MonAI, Monster, Missiles (26 VAs) */

static void emit_batch3_vas(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* 3A [1] 0x6FCDDE50 NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c (ecx=pGame, edx=pPlayer, s0=pItem, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 501u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u,
                      (k == 0) ? g_item_ring : g_item_sword, 910u, 0u, 0u, 0u, 502u);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x48, 5, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x49, (k == 1) ? 24 : 36, 0);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_UNIT2; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT2;
    run_and_emit(0x6FCDDE50u, "NPCS_RepairAndRechargePlayerItemWrapper_6FCDDE50_113c", k,
                 k == 0 ? "ring_non_repairable" : k == 1 ? "repair_sword_to_24" : "repair_sword_to_36",
                 &c, ts, 3, 0u, 0);
  }

  /* 3A [2] 0x6FCCDAC0 ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c (ecx=pGame, edx=pPlayer, s0=pScroll, s1=pTarget, s2..s4=0, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 503u);
    stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_sword, 911u, 0u);
    if (k == 0) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 504u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U8(STAGE_UNIT0 + 0x6Cu) = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 0u;
      U32(STAGE_UNIT0 + 0x64u) = 20u;
    } else if (k == 1) {
      U32(STAGE_UDATA2 + 0x18u) = 0x10u; /* already identified */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = 0u; c.args[1] = STAGE_UNIT2; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u;
    c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = STAGE_UNIT2; ts[4] = 0; ts[5] = 0; ts[6] = 0;
    run_and_emit(0x6FCCDAC0u, "ITEMS_SpellIdentifyInventoryItem_6FCCDAC0_113c", k,
                 k == 0 ? "trading_with_player_ret0" : k == 1 ? "already_id_ret0" : "identify_inv_item_ret1",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* 3A [3] 0x6FCF6BC0 ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c (eax=pUnit, edi=pItem, s0=pGame, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 505u);
    stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_sword, 912u, 0u);
    if (k == 0) U32(STAGE_UDATA2 + 0x18u) = 0x10u;
    if (k == 1) U32(STAGE_UDATA2 + 0x14u) = 0x100000u; /* triggers assert 0x1384 */
    if (k == 2) U32(STAGE_UDATA2 + 0x18u) = 0x4000u;   /* clears 0x4000, sets 0x1, sound 6 */
    c.eax = STAGE_UNIT0; c.edi = STAGE_UNIT2; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT2; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCF6BC0u, "ITEMS_SyncNewlyIdentifiedInventoryItem_6FCF6BC0_113c", k,
                 k == 0 ? "already_id_noop" : k == 1 ? "assert_flag_100000" : "clear_4000_sync_sound6",
                 &c, ts, 3, 0u, k == 1);
  }

  /* 3A [4] 0x6FCDDA90 NPCS_IdentifyPendingItemForPlayer_6FCDDA90_113c (ebx=pGame, esi=dwItemGuid, s0=pPlayer, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 506u);
    stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_sword, 913u, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    U32(STAGE_UDATA0 + 0x6Cu) = (k == 0) ? 999u : 913u;
    uint32_t pg = (k == 1) ? 0u : STAGE_GAME;
    c.ebx = pg; c.esi = 913u; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = pg; ts[1] = 913; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCDDA90u, "NPCS_IdentifyPendingItemForPlayer_6FCDDA90_113c", k,
                 k == 0 ? "guid_mismatch_noop" : k == 1 ? "assert_null_game_2d3" : "identify_pending_item",
                 &c, ts, 3, 0u, k == 1);
  }

  /* 3A [5] 0x6FCCCFD0 ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c (edx=pUnit, s0=pItem, s1..s3=0, s4=wSkillId, ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 507u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_tsc, 914u + (uint32_t)k, 0u, 0u, 0u, 508u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t sk = (k == 2) ? 0xDDu : 0xDCu;
    c.edx = pU;
    c.nargs = 5; c.args[0] = STAGE_UNIT2; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = sk;
    c.calleePop = 0x14u;
    ts[0] = sk; ts[1] = pU; ts[2] = STAGE_UNIT2;
    run_and_emit(0x6FCCCFD0u, "ITEMS_SendUseScrollOrTomePacket3F_6FCCCFD0_113c", k,
                 k == 0 ? "null_unit_flag4_only" : k == 1 ? "queue_3f_tp_dc" : "queue_3f_id_dd",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 3A [6] 0x6FCDCBE0 NPC_HealAndCureUnit_6FCDCBE0_113c (s0=pUnit, s1=pbChanged, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 509u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 1) ? (50 << 8) : (100 << 8), 0);
    if (k == 2) {
      void *pSub = fn_AllocStatList(NULL, 0x40u, 0u, 0, 10);
      fn_SetStatListState(pSub, 2); /* poison */
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 0);
    }
    U8(STAGE_SCRATCH) = 0u;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FCDCBE0u, "NPC_HealAndCureUnit_6FCDCBE0_113c", k,
                 k == 0 ? "full_healthy_noop" : k == 1 ? "heal_damaged_life" : "cure_poison_statlist",
                 &c, ts, 2, 0u, 0);
  }

  /* 3A [7] 0x6FCF1B20 ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c (eax=pScroll, s0=pUnit, s1=pOutSpace, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 510u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u,
                      (k == 0) ? g_item_sword : g_item_tsc, 920u, 0u, 0u, 0u, 511u);
    if (k == 2) {
      stage_inv_item(STAGE_UNIT0, STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, g_item_tbk, 921u, 0u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x46, 5, 0);
    }
    c.eax = STAGE_UNIT1; c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FCF1B20u, "ITEMS_FindMatchingInventoryBookForScroll_6FCF1B20_113c", k,
                 k == 0 ? "non_scroll_ret0" : k == 1 ? "no_inv_ret0" : "found_tbk_space15",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 3A [8] 0x6FCF1950 ITEMS_AreWeaponSlotTypesCompatible113c (eax=pA, ecx=pB, ret 0, u32) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    uint32_t pA = STAGE_SCRATCH + 0x00u, pB = STAGE_SCRATCH + 0x40u;
    if (k == 1) { U32(pA + 0x00u) = 1u; U32(pB + 0x08u) = 1u; }
    if (k == 2) { U32(pA + 0x14u) = 1u; U32(pB + 0x10u) = 1u; }
    if (k == 3) { U32(pA + 0x14u) = 1u; U32(pB + 0x14u) = 1u; U32(pA + 0x1Cu) = 1u; U32(pB + 0x1Cu) = 1u; }
    if (k == 4) { U32(pA + 0x24u) = 1u; U32(pB + 0x24u) = 1u; }
    c.eax = pA; c.ecx = pB; c.calleePop = 0u;
    ts[0] = pA; ts[1] = pB;
    run_and_emit(0x6FCF1950u, "ITEMS_AreWeaponSlotTypesCompatible113c", k,
                 k == 0 ? "empty_ret0" : k == 1 ? "bow_quiver_ret1" : k == 2 ? "1h_shield_ret1" : k == 3 ? "dual_wield_ret1" : "both_24_ret1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* 3A [9] 0x6FCF5690 ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c (esi=pUnit, edi=pItem, s0=pGame, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 525u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_sword, 922u, 1u, 0u, 0u, 526u);
    U32(STAGE_UDATA2 + 0x18u) = 0x100u; /* broken flag */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x48, 0, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x49, (k == 2) ? 30 : 20, 0);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    c.esi = pU; c.edi = STAGE_UNIT2; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pU; ts[1] = STAGE_UNIT2; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCF5690u, "ITEMS_RepairBrokenEquippedItemAndRefreshStats_6FCF5690_113c", k,
                 k == 0 ? "null_unit_repair_flags" : k == 1 ? "player_repair_dur20" : "player_repair_dur30",
                 &c, ts, 3, 0u, 0);
  }

  /* 3A [12] 0x6FCF2310 ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c (esi=pUnit, edi=pCurSkill, ebx=bLeft, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 527u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    uint32_t pSkAtk = attach_skill(STAGE_UNIT0, 0, 1);
    uint32_t pSkFb  = attach_skill(STAGE_UNIT0, 36, 1); /* Fire Bolt */
    U32(STAGE_UDATA0 + 0x70u) = 36u; /* dwLeftTargetVal */
    U32(STAGE_UDATA0 + 0x78u) = 0xFFFFFFFFu;
    U32(STAGE_UDATA0 + 0x74u) = 36u; /* dwRightTargetVal */
    U32(STAGE_UDATA0 + 0x7Cu) = 0xFFFFFFFFu;
    uint32_t pU   = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pCur = (k == 1) ? pSkFb : pSkAtk;
    uint32_t bLft = (k == 2) ? 0u : 1u;
    c.esi = pU; c.edi = pCur; c.ebx = bLft; c.calleePop = 0u;
    ts[0] = pU; ts[1] = pCur; ts[2] = bLft;
    run_and_emit(0x6FCF2310u, "ITEMS_RestoreSavedHandSkillIfUsable_6FCF2310_113c", k,
                 k == 0 ? "null_unit_noop" : k == 1 ? "same_skill_noop" : "restore_right_firebolt",
                 &c, ts, 3, 0u, 0);
  }

  /* 3B [13] 0x6FCC0FC0 SKILLS_CountUnitsInRadius_6FCC0FC0_113c (eax=flags, edx=rad, s0=x, s1=pGame, s2=pCenter, s3=y, ret 0x10, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 528u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 55u, 1u, 5003u, 5003u, 529u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 56u, 1u, 5004u, 5004u, 530u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 6, 100 << 8, 0);
    if (k == 1) link_room_units(STAGE_ROOM0, STAGE_UNIT1, 0u);
    if (k == 2) link_room_units(STAGE_ROOM0, STAGE_UNIT1, STAGE_UNIT2);
    c.eax = 0u; c.edx = 20u;
    c.nargs = 4; c.args[0] = 5000u; c.args[1] = STAGE_GAME; c.args[2] = STAGE_UNIT0; c.args[3] = 5000u; c.calleePop = 0x10u;
    ts[0] = 0; ts[1] = 20; ts[2] = 5000; ts[3] = STAGE_GAME; ts[4] = STAGE_UNIT0; ts[5] = 5000;
    run_and_emit(0x6FCC0FC0u, "SKILLS_CountUnitsInRadius_6FCC0FC0_113c", k,
                 k == 0 ? "empty_room_0" : k == 1 ? "one_monster_1" : "two_monsters_2",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* 3B [14] 0x6FCC0F40 SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c (eax=flags, edx=rad, ecx=ring, edi=pOut, s0=x, s1=pGame, s2=pCenter, s3=y, ret 0x10, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 531u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 55u, 1u, 5005u, 5005u, 532u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 56u, 1u, 5012u, 5012u, 533u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 6, 100 << 8, 0);
    if (k == 1) link_room_units(STAGE_ROOM0, STAGE_UNIT1, 0u);
    if (k == 2) link_room_units(STAGE_ROOM0, STAGE_UNIT1, STAGE_UNIT2);
    c.eax = 0u; c.edx = 25u; c.ecx = 10u; c.edi = STAGE_SCRATCH;
    c.nargs = 4; c.args[0] = 5000u; c.args[1] = STAGE_GAME; c.args[2] = STAGE_UNIT0; c.args[3] = 5000u; c.calleePop = 0x10u;
    ts[0] = 0; ts[1] = 25; ts[2] = 10; ts[3] = STAGE_SCRATCH; ts[4] = 5000; ts[5] = STAGE_GAME; ts[6] = STAGE_UNIT0; ts[7] = 5000;
    run_and_emit(0x6FCC0F40u, "SKILLS_FindRingScanTargetInRadius_6FCC0F40_113c", k,
                 k == 0 ? "empty_room_0" : k == 1 ? "one_target_in_ring" : "two_targets_ring_pick",
                 &c, ts, 8, 0xFFFFFFFFu, 0);
  }

  /* 3B [15] 0x6FD11490 SKILLS_ResolveTriggeredCorpseTarget_6FD11490_113c (ecx=pGame, esi=pCaster, ebx=pOutType, s0=0, s1=nLvl, s2=pOutGuid, ret 0xC, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 534u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 55u, 12u, 5002u, 5002u, 535u); /* mode 12 = DEAD */
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      U32(STAGE_PATH0 + 0x5Cu) = 1u;
      U32(STAGE_PATH0 + 0x60u) = 55u;
      link_room_units(STAGE_ROOM0, STAGE_UNIT1, 0u);
    }
    uint32_t outT = (k == 1) ? 0u : STAGE_SCRATCH;
    uint32_t outG = STAGE_SCRATCH + 0x10u;
    c.ecx = STAGE_GAME; c.esi = STAGE_UNIT0; c.ebx = outT;
    c.nargs = 3; c.args[0] = 0u; c.args[1] = 1u; c.args[2] = outG; c.calleePop = 0x0Cu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = outT; ts[3] = 0; ts[4] = 1; ts[5] = outG;
    run_and_emit(0x6FD11490u, "SKILLS_ResolveTriggeredCorpseTarget_6FD11490_113c", k,
                 k == 0 ? "no_target_ret0" : k == 1 ? "corpse_found_null_out" : "corpse_found_write_out",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* 3B [16] 0x6FCC11B0 SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c (ebx=pSkTxt, esi=pDmg, ecx=lvl, edx=skId, s0=pGame, s1=pAtk, s2=pDef, s3=pen, ret 0x10, ret ax) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 10u, 1u, 5000u, 5000u, 536u + (uint32_t)k * 1000u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 55u, 1u, 5002u, 5002u, 537u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, (k == 1) ? 5000 : 10, 0); /* attack rating */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 12, 1, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 31, (k == 1) ? 1 : 9999, 0);  /* defense */
    U16(STAGE_SCRATCH + 0x12Eu) = (k == 0) ? 0x0001u : 0x0004u;
    c.ebx = STAGE_SCRATCH; c.esi = STAGE_DMG; c.ecx = 1u; c.edx = 0u;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.args[3] = 0u; c.calleePop = 0x10u;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_DMG; ts[2] = 1; ts[3] = 0; ts[4] = STAGE_GAME; ts[5] = STAGE_UNIT0; ts[6] = STAGE_UNIT1; ts[7] = 0;
    run_and_emit(0x6FCC11B0u, "SKILLS_RollSkillAttackHitFlags_6FCC11B0_113c", k,
                 k == 0 ? "always_hit_bit0" : k == 1 ? "high_ar_roll_hit" : "low_ar_roll_miss",
                 &c, ts, 8, 0xFFFFu, 0);
  }

  /* 3B [17] 0x6FCC1580 SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c (ecx=pPlayer, eax=pItem, s0=pGame, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 538u);
    U32(STAGE_UNIT0 + 0xC8u) = 0x45u;
    if (k == 2) link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    uint32_t pPl = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = pPl; c.eax = 0u; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pPl; ts[1] = 0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCC1580u, "SKILLS_ClearPlayerCursorIdentifyOrUseState_6FCC1580_113c", k,
                 k == 0 ? "null_player_noop" : k == 1 ? "clear_bit40_no_client" : "clear_bit40_queue_3f",
                 &c, ts, 3, 0u, 0);
  }

  /* 3B [18] 0x6FCCD050 SKILLS_RemoveAuraStateAndEvent9OnSkillChange_6FCCD050_113c (edi=pUnit, eax=nSkillId, s0=pGame, s1=arg14, ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 10u, 1u, 5000u, 5000u, 539u);
    stage_timer_queue(STAGE_GAME);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, g_sk_aura_st, 1);
    if (k == 2) {
      void *pSub = fn_AllocStatList(NULL, 0x40u, 0u, 0, 10);
      fn_SetStatListState(pSub, g_sk_aura_st);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 0);
    }
    int32_t sk = (k == 0) ? -1 : (k == 1 ? 36 : (int32_t)g_sk_aura);
    c.edi = STAGE_UNIT0; c.eax = (uint32_t)sk; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = sk; ts[2] = STAGE_GAME; ts[3] = 0;
    run_and_emit(0x6FCCD050u, "SKILLS_RemoveAuraStateAndEvent9OnSkillChange_6FCCD050_113c", k,
                 k == 0 ? "neg_skill_noop" : k == 1 ? "non_aura_noop" : "remove_aura_state_and_list",
                 &c, ts, 4, 0u, 0);
  }

  /* 3B [19] 0x6FCD3930 SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c (ecx=pGame, edx=pUnit, s0=skId, s1=lvl, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5000u, 5000u, 540u);
    uint32_t pSk = attach_skill(STAGE_UNIT0, 36, 1);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    if (k == 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 20u, 1u, 5012u, 5024u, 541u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1; U32(STAGE_PATH0 + 0x5Cu) = 0u; U32(STAGE_PATH0 + 0x60u) = 20u;
    } else if (k == 2) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 2u, 100u, 30u, 0u, 5033u, 5044u, 542u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT2; U32(STAGE_PATH0 + 0x5Cu) = 2u; U32(STAGE_PATH0 + 0x60u) = 30u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 36u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 36; ts[3] = 1;
    run_and_emit(0x6FCD3930u, "SKILLS_SrvSt59_SaveTargetPosToSkillParams_6FCD3930_113c", k,
                 k == 0 ? "no_target_ret0" : k == 1 ? "dyn_target_save_xy" : "static_obj_save_xy",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 3B [20] 0x6FCD3770 SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c (ecx=pGame, edx=pUnit, s0=skId, s1=lvl, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5000u, 5000u, 543u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5004u, 5004u, 544u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 50 << 8, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1; U32(STAGE_PATH0 + 0x5Cu) = 1u; U32(STAGE_PATH0 + 0x60u) = 20u;
    }
    int32_t sk = (k == 0) ? -1 : (int32_t)g_sk_calc12;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 5;
    run_and_emit(0x6FCD3770u, "SKILLS_SrvDo127_HealTargetByMasteryCalc_6FCD3770_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "no_target_ret0" : "heal_target_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 3B [21] 0x6FCC16A0 SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c (esi=pItem, s0=pGame, s1=pOwner, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 10u, 1u, 5000u, 5000u, 545u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_jav, 925u, 1u, 0u, 0u, 546u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x46, (k == 1) ? 0 : 10, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x48, 3, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x49, 10, 0);
    uint32_t pIt = (k == 0) ? 0u : STAGE_UNIT2;
    c.esi = pIt; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = pIt; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCC16A0u, "SKILLS_ConsumeItemQuantityAndSyncDurability_6FCC16A0_113c", k,
                 k == 0 ? "null_item_ret0" : k == 1 ? "qty0_depleted_ret0" : "qty10_consume_sync_ret10",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 3C [22] 0x6FD12040 AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c (eax=pGame, ebx=pUnit, s0=nDelay, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 55u, 1u, 5000u, 5000u, 547u);
    uint32_t delay = (k == 0) ? 0u : (k == 1 ? 15u : 25u);
    if (k == 2) {
      /* Pre-stage an existing event type 2 at frame 105 (sooner than 100+25=125) */
      uint32_t pEv = (uint32_t)(uintptr_t)bump_alloc(0x30u);
      U8(pEv + 0x00u) = 2u;
      U32(pEv + 0x04u) = 105u;
      U32(pEv + 0x0Cu) = STAGE_UNIT0;
      U32(STAGE_UNIT0 + 0xDCu) = pEv;
    }
    c.eax = STAGE_GAME; c.ebx = STAGE_UNIT0; c.nargs = 1; c.args[0] = delay; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = delay;
    run_and_emit(0x6FD12040u, "AI_ScheduleAiThinkTimerIfSooner_6FD12040_113c", k,
                 k == 0 ? "delay0_clamped_1" : k == 1 ? "delay15_scheduled" : "existing_sooner_keep",
                 &c, ts, 3, 0u, 0);
  }

  /* 3C [23] 0x6FCC4F40 AI_TickAncientStatueRevertCheck_6FCC4F40_113c (ecx=pGame, edx=pUnit, s0=0, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 120u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 540u, 55u, 1u, 5000u, 5000u, 548u);
    U32(STAGE_GAME + 0xA8u) = (k == 0) ? 100u : (k == 1 ? 200u : 300u);
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x23u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x11u) = (k == 2) ? 1u : 0u;
    }
    if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x92, 1); /* keeps stall path cleanly */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCC4F40u, "AI_TickAncientStatueRevertCheck_6FCC4F40_113c", k,
                 k == 0 ? "no_quest_stall_125" : k == 1 ? "flag11_off_stall_225" : "state92_set_stall_325",
                 &c, ts, 3, 0u, 0);
  }

  /* 3C [22] 0x6FCD3120 MONSTER_ClearUnitCollisionAndAttackableFlags_6FCD3120_113c (ecx=pGame, edx=pUnit, s0=0, s1=0, ret 8, u32; TS: pUnit, 0, 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uType = (k == 1) ? 2u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 2) ? STAGE_ROOM0 : 0u, uType, 1u, 55u, 1u, 5000u, 5000u, 550u);
    U32(STAGE_UNIT0 + 0xC4u) = (k == 0) ? 0x0Fu : (k == 1 ? 0xFFu : 0x1Eu);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = 0; ts[2] = 0;
    run_and_emit(0x6FCD3120u, "MONSTER_ClearUnitCollisionAndAttackableFlags_6FCD3120_113c", k,
                 k == 0 ? "mon_clr_0e_to_01" : k == 1 ? "obj_clr_0e_to_f1" : "mon_with_room_to_10",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 3C [26] 0x6FCD2FC0 MONSTER_InitSkillSequenceFrameFromCalc_6FCD2FC0_113c (ecx=pGame, edx=pUnit, s0=skId, s1=lvl, ret 8, u32; TS: pUnit, skId, lvl) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 55u, 1u, 5000u, 5000u, 551u);
    uint32_t pSk = attach_skill(STAGE_UNIT0, (int32_t)g_sk_calc12, 3);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    U32(pSk + 0x0Cu) = (k == 2) ? 2u : 0u;
    int32_t sk = (k == 0) ? -1 : (int32_t)g_sk_calc12;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = sk; ts[2] = 3;
    run_and_emit(0x6FCD2FC0u, "MONSTER_InitSkillSequenceFrameFromCalc_6FCD2FC0_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "flags0_calc1_ret1" : "flags2_clr_calc2_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 3C [27] 0x6FCD2ED0 MONSTER_StartChargeSkillStateAndParam1_6FCD2ED0_113c (ecx=pGame, edx=pUnit, s0=skId, s1=lvl, ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 55u, 1u, 5000u, 5000u, 552u);
    uint32_t pSk = attach_skill(STAGE_UNIT0, (int32_t)g_sk_calc12, 3);
    U32(U32(STAGE_UNIT0 + 0xA8u) + 0x10u) = pSk;
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 500u : 100u;
    if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x0C, 1);
    int32_t sk = (k == 0) ? -1 : (int32_t)g_sk_calc12;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 3;
    run_and_emit(0x6FCD2ED0u, "MONSTER_StartChargeSkillStateAndParam1_6FCD2ED0_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "set_state0c_frame100" : "already_state0c_frame500",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* 3C [28] 0x6FCD3060 MONSTER_HealPercentLifeAndUpdateFrameMetrics_6FCD3060_113c (ecx=pGame, edx=pUnit, s0=skId, s1=lvl, ret 8, u32; TS: pUnit, skId, lvl) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 55u, 1u, 5000u, 5000u, 553u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 400 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
    U32(STAGE_UNIT0 + 0x3Cu) = 77u;
    int32_t sk = (k == 0) ? -1 : (k == 1 ? 0 : (int32_t)g_sk_calc12);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 5u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = sk; ts[2] = 5;
    run_and_emit(0x6FCD3060u, "MONSTER_HealPercentLifeAndUpdateFrameMetrics_6FCD3060_113c", k,
                 k == 0 ? "neg_skill_ret0" : k == 1 ? "calc0_flags_only_ret1" : "calc1_heal_pct_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* 3C [29] 0x6FCD31D0 MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c (ecx=pMissile, edx=nSeedOffset, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 10u, 60u, 0u, 5000u, 5000u, 554u);
    U16(STAGE_PATH0 + 0x10u) = 5008u; /* wTargetX */
    U16(STAGE_PATH0 + 0x12u) = 5008u; /* wTargetY */
    U16(STAGE_UDATA0 + 0x0Eu) = (k == 1) ? 0x60u : 0x20u; /* nTotalFrames */
    U16(STAGE_UDATA0 + 0x10u) = (k == 1) ? 0x60u : 0x20u; /* nRemainingFrames */
    uint32_t pM = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t off = (k == 1) ? 17u : 99u;
    c.ecx = pM; c.edx = off; c.calleePop = 0u;
    ts[0] = pM; ts[1] = off;
    run_and_emit(0x6FCD31D0u, "MISSILE_InitSpiderWebOrChargedBoltPath_6FCD31D0_113c", k,
                 k == 0 ? "null_missile_noop" : k == 1 ? "clamp_frames_4d_path" : "frames_20_path",
                 &c, ts, 2, 0u, 0);
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-w7-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-w7] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
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
    fprintf(stderr, "[k6-w7] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-w7] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_SetCursorItem || !fn_PlaceItemInBodyLoc) {
    fprintf(stderr, "[k6-w7] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-w7] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_batch1_vas();
  emit_batch2_vas();
  emit_batch3_vas();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-w7] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
