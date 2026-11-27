/*
 * k6-w6-d2game-emitter.c — Milestone #37 [K6] Wave 6 Real-DLL Hi-VA Differential Emitter
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables (0x20000000..0x206F7FFF + D2Common .data/.bss)
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert) and Fog.#10042..#10047
 * (deterministic bump allocator), and executes 150 previously un-hit D2Game.dll
 * functions strictly inside 0x6FCC0000..0x6FD18000 across >= 3 non-degenerate
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
static uint32_t g_mon_res_sk  = 0; /* MonStats2 with wResurrectSkill > 0 */
static uint32_t g_mon_res_md  = 0; /* MonStats2 with wResurrectSkill == 0 and nResurrectMode < 16 */
static uint32_t g_mon_inf     = 0; /* MonStats2 with uInfernoLen > 0 */
static uint32_t g_mon_subm    = 0; /* MonStats2 with bSubmergeFrames > 0 && != 11 */

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
              "[k6-w6] SETUP/INIT FAULT after %u emitted: code=0x%08lX eip=%p (game=0x%08lX com=0x%08lX) addr=0x%08X\n",
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

/* ------------------------------- Deterministic Bump Allocator (matches SparseMemory113c) */

static void *bump_alloc(uint32_t dwSize) {
  if (g_in_setup_phase) {
    uint32_t p = (g_setup_top + 3u) & ~3u;
    if (p + dwSize > STAGE_BASE + STAGE_TOTAL_SIZE) {
      fprintf(stderr, "[k6-w6] setup bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 21);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_setup_top = p + dwSize;
    return (void *)(uintptr_t)p;
  } else {
    uint32_t p = (g_heap_top + 3u) & ~3u;
    if (p + dwSize > HEAP_BASE + HEAP_SIZE) {
      fprintf(stderr, "[k6-w6] heap bump overflow (size=%u)\n", dwSize);
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
      fprintf(stderr, "[k6-w6] missing Fog.#%u\n", hooks[i].ord);
      TerminateProcess(GetCurrentProcess(), 23);
    }
    hook_module_iat_ptr(g_hCom, orig, hooks[i].fn);
    hook_module_iat_ptr(g_hGame, orig, hooks[i].fn);
  }
}

/* ------------------------------- PAGEIMG Loader (d2game-datatbls-113c.img) */

static void load_datatbls_img(const char *imgPath) {
  FILE *fp = fopen(imgPath, "rb");
  if (!fp) {
    fprintf(stderr, "[k6-w6] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-w6] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(0x6FDE9000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-w6] short read at page %u\n", i);
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
      fprintf(stderr, "[k6-w6] JSON buffer overflow\n");
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

  /* Default pGame difficulty = 0, expansion = 1, dwGameFrame = 100 */
  U8(STAGE_GAME + 0x6Du)  = 0u;
  U32(STAGE_GAME + 0x70u) = 1u;
  U32(STAGE_GAME + 0xA8u) = 100u;

  /* Pre-link 4 clean 0x208-byte S2C packet nodes on STAGE_CLIENT0 (+0x1C0) */
  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_PKTNODE1 + 0x204u) = STAGE_PKTNODE2;
  U32(STAGE_PKTNODE2 + 0x204u) = STAGE_PKTNODE3;
  U32(STAGE_CLIENT0 + 0x1C0u)  = STAGE_PKTNODE0;

  /* Pre-link 4 clean 0x208-byte S2C packet nodes on STAGE_CLIENT1 (+0x1C0) */
  U32(STAGE_PKTNODE4 + 0x204u) = STAGE_PKTNODE5;
  U32(STAGE_PKTNODE5 + 0x204u) = STAGE_PKTNODE6;
  U32(STAGE_PKTNODE6 + 0x204u) = STAGE_PKTNODE7;
  U32(STAGE_CLIENT1 + 0x1C0u)  = STAGE_PKTNODE4;
}

static void stage_room(uint32_t pRoom, uint32_t pRoomEx, uint32_t pLevel, uint32_t levelId) {
  uint32_t pAct = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  U32(pAct + 0x08u)     = 1u; /* dwTownId */
  U32(pAct + 0x10u)     = pRoom;
  U32(pAct + 0x48u)     = STAGE_DRLG0;
  U32(STAGE_DRLG0 + 0x47Cu) = pLevel;
  if (U32(STAGE_GAME + 0xBCu) == 0u) {
    U32(STAGE_GAME + 0xBCu) = pAct;
  }
  U32(pRoom + 0x10u)    = pRoomEx;
  U32(pRoom + 0x2Cu)    = pAct; /* pAct — prevents UNITROOM_RefreshUnit NULL deref */
  U32(pRoom + 0x4Cu)    = 4800u; /* nSubtileX */
  U32(pRoom + 0x50u)    = 4800u; /* nSubtileY */
  U32(pRoom + 0x54u)    = 1000u; /* nSubtileWidth */
  U32(pRoom + 0x58u)    = 1000u; /* nSubtileHeight */
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
  U32(pPath + 0x1Cu)  = pRoom;   /* D2DynamicPathStrc.pRoom */
  U32(pPath + 0x30u)  = pUnit;   /* D2DynamicPathStrc.pUnit */
  U32(pPath + 0x7Cu)  = 0x1800u; /* D2DynamicPathStrc.dwVelocity */
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
  U8(pUnit + 0x18u)  = 0u; /* nAct */
  U32(pUnit + 0x1Cu) = (pRoom == STAGE_ROOM1) ? STAGE_ACT1 : STAGE_ACT0;
  U32(pUnit + 0x20u) = seedLo ? seedLo : 0x12345679u;
  U32(pUnit + 0x24u) = 0x0000029Au;
  U32(pUnit + 0x28u) = seedLo ? seedLo : 0x12345679u;
  U32(pUnit + 0x80u) = STAGE_GAME;
  U32(pUnit + 0xC4u) = 0x00000004u; /* UNITFLAG_TARGETABLE */
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
  U32(pClient + 0x04u) = 4u; /* CLIENTSTATE_INGAME */
  U32(pClient + 0x16Cu) = U32(pPlayer + 0x00u);
  U32(pClient + 0x170u) = U32(pPlayer + 0x0Cu);
  U32(pClient + 0x174u) = pPlayer;
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

  /* Switch allocator to runtime heap at 0x40000000 right before target call */
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
            "[k6-w6] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-w6] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-w6] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-w6] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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
    if (!g_item_hp4 && code == 0x20347068u) g_item_hp4 = id; /* "hp4 " */
    if (!g_item_hp1 && code == 0x20317068u) g_item_hp1 = id; /* "hp1 " */
    if (!g_item_hfh && code == 0x20686668u) g_item_hfh = id; /* "hfh " */
    if (!g_item_g33 && code == 0x20333367u) g_item_g33 = id; /* "g33 " */
    if (!g_item_bbb && code == 0x20626262u) g_item_bbb = id; /* "bbb " */
    if (!g_item_box && code == 0x20786F62u) g_item_box = id; /* "box " */
    if (!g_item_qhr && code == 0x20726871u) g_item_qhr = id; /* "qhr " */
    if (!g_item_qbr && code == 0x20726271u) g_item_qbr = id; /* "qbr " */
    if (!g_item_qey && code == 0x20796571u) g_item_qey = id; /* "qey " */
    if (!g_item_qf2 && code == 0x20326671u) g_item_qf2 = id; /* "qf2 " */
    if (!g_item_tbk && code == 0x206B6274u) g_item_tbk = id; /* "tbk " */
    if (!g_item_ring && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x0A)) g_item_ring = id;
    if (!g_item_charm && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x52)) g_item_charm = id;
    if (!g_item_sword && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x1E)) g_item_sword = id;
  }

  /* Scan MonStats2 via sgptDataTables */
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
}

/* ------------------------------- Batch 1: 67 Non-Quest Hi-VA Functions */

static void emit_batch1_vas(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [1] 0x6FCEB1A0 STATES_ClearGfxStateFlag_6FCEB1A0_113c (ecx=pUnit, edx=nState, s0=0, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 101u);
    int32_t st = (k == 0) ? 12 : (k == 1 ? 32 : 55);
    if (k >= 1) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, st, 1);
    c.ecx = STAGE_UNIT0; c.edx = (uint32_t)st;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = st;
    run_and_emit(0x6FCEB1A0u, "STATES_ClearGfxStateFlag_6FCEB1A0_113c", k,
                 k == 0 ? "already_clear" : k == 1 ? "clear_st32" : "clear_st55", &c, ts, 2, 0u, 0);
  }

  /* [2] 0x6FCDC7D0 HIRELING_GetVendorNameIdRange_6FCDC7D0_113c (eax=vendorId, edi=pLow, esi=pHigh, ebx=pClass, s0=pGame, ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t pLow = STAGE_SCRATCH + 0x00u;
    uint32_t pHigh = STAGE_SCRATCH + 0x04u;
    uint32_t pCls = (k == 2) ? 0u : (STAGE_SCRATCH + 0x08u);
    U32(pLow) = 0xAAu; U32(pHigh) = 0xBBu; U32(STAGE_SCRATCH + 0x08u) = 0xCCu;
    /* Kashya=150 (Act1), Greiz=198 (Act2), Asheara=252 (Act3), invalid=999 */
    int32_t vend = (k == 0) ? 999 : (k == 1 ? 150 : (k == 2 ? 198 : 252));
    c.eax = (uint32_t)vend; c.edi = pLow; c.esi = pHigh; c.ebx = pCls;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = vend; ts[1] = pLow; ts[2] = pHigh; ts[3] = pCls; ts[4] = STAGE_GAME;
    run_and_emit(0x6FCDC7D0u, "HIRELING_GetVendorNameIdRange_6FCDC7D0_113c", k,
                 k == 0 ? "invalid_vendor" : k == 1 ? "kashya_150" : k == 2 ? "greiz_null_outcls" : "asheara_252",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [3] 0x6FCD2E00 MONSTER_FindNextAnimEventInRemainingFrames_6FCD2E00_113c (eax=pUnit, ret 0) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 103u);
    uint32_t pAnim = STAGE_SCRATCH;
    U32(STAGE_UNIT0 + 0x50u) = pAnim;
    U32(pAnim + 0x08u) = 12u; /* maxFrames */
    U32(STAGE_UNIT0 + 0x48u) = (k == 0) ? (16u << 8) : (10u << 8); /* frameCount */
    U32(STAGE_UNIT0 + 0x44u) = (k == 1) ? (10u << 8) : (3u << 8);  /* curFrame */
    U8(pAnim + 0x10u + 3u)   = (k == 2) ? 0x00u : 0x02u;           /* event byte at curFrame=3 */
    c.eax = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FCD2E00u, "MONSTER_FindNextAnimEventInRemainingFrames_6FCD2E00_113c", k,
                 k == 0 ? "frame_oob" : k == 1 ? "at_end" : k == 2 ? "no_event" : "hit_ev2",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [5] 0x6FD009D0 SUNIT_GetLastAttacker113c (eax=pUnit, s0=pGame, ret 4; TS(pGame, pUnit)) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 11u, 1u, 5000u, 5000u, 105u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 42u, 1u, 5002u, 5002u, 106u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U32(STAGE_UNIT0 + 0xC8u) = 0x20000u;
      U32(STAGE_UNIT0 + 0x9Cu) = 0u; /* UNIT_PLAYER */
      U32(STAGE_UNIT0 + 0xA0u) = (k == 1) ? 999u : 42u;
    }
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FD009D0u, "SUNIT_GetLastAttacker113c", k,
                 k == 0 ? "flag_clear" : k == 1 ? "missing_attacker" : "found_attacker",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [6] 0x6FD00410 SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c (ecx=pGame, edx=pPlayer, s0..2=0, ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pPlr = (k == 0) ? 0u : STAGE_UNIT0;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1) ? 1u : 0u, 1u, 1u, 1u, 5000u, 5000u, 107u);
      U32(STAGE_UDATA0 + 0x148u) = 0x1111u;
      U32(STAGE_UDATA0 + 0x14Cu) = 0x2222u;
    }
    c.ecx = STAGE_GAME; c.edx = pPlr;
    c.nargs = 3; c.args[0] = 0u; c.args[1] = 0u; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_GAME; ts[1] = pPlr;
    run_and_emit(0x6FD00410u, "SUNIT_ClearPlayerTimeoutEvent_6FD00410_113c", k,
                 k == 0 ? "null_player" : k == 1 ? "not_player" : "clear_fields",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [7] 0x6FCEA410 MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c
   * (eax=ppMonReg, edx=nDstReg, ebx=bSkipDec, s0=nSrcReg, s1=nArg2, s2=nArg3, s3=pUnit, ret 0x10) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    uint32_t ppReg = STAGE_SCRATCH;
    U32(ppReg + 0u) = STAGE_MONREG0;
    U32(ppReg + 4u) = STAGE_MONREG1;
    U32(STAGE_MONREG0 + 0x2C8u) = 5u;
    U32(STAGE_MONREG0 + 0x2CCu) = 20u;
    U32(STAGE_MONREG1 + 0x2C8u) = 3u;
    U32(STAGE_MONREG1 + 0x2CCu) = 15u;
    uint32_t pUnit = 0u;
    if (k >= 2) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 108u);
      if (k == 3) U8(STAGE_UDATA0 + 0x16u) = 1u; /* unique monster flag */
      pUnit = STAGE_UNIT0;
    }
    uint32_t dstReg = 1u, srcReg = 0u;
    uint32_t skipDec = (k == 0) ? 1u : 0u;
    c.eax = ppReg; c.edx = dstReg; c.ebx = skipDec;
    c.nargs = 4; c.args[0] = srcReg; c.args[1] = 0u; c.args[2] = 0u; c.args[3] = pUnit; c.calleePop = 0x10u;
    ts[0] = ppReg; ts[1] = dstReg; ts[2] = skipDec; ts[3] = srcReg; ts[4] = 0; ts[5] = 0; ts[6] = pUnit;
    run_and_emit(0x6FCEA410u, "MONREG_UpdateMonsterRegionTransferCounts_6FCEA410_113c", k,
                 k == 0 ? "null_skip" : k == 1 ? "null_dec_dst" : k == 2 ? "normal_mon" : "unique_mon",
                 &c, ts, 7, 0u, 0);
  }

  /* [8] 0x6FD00210 SUNIT_CanTargetOwnPetWithSkill113c (esi=pOwner, eax=pTarget, ecx=nSkillId, ret 0) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 77u, 1u, 5000u, 5000u, 109u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 363u, 88u, 1u, 5005u, 5005u, 110u);
    uint32_t pAiG = STAGE_SCRATCH;
    U32(STAGE_UDATA1 + 0x28u) = pAiG;
    U32(pAiG + 0x28u) = STAGE_GAME;
    U32(pAiG + 0x2Cu) = (k == 2) ? 999u : 77u; /* owner guid */
    U32(pAiG + 0x30u) = 0u;                    /* UNIT_PLAYER */
    /* Find a skill whose SkillsTxt +0x07 has bit 1 (0x02) set (e.g. Unsummon = 216) */
    uint32_t skId = (k == 0) ? 0xFFFFFFFFu : (k == 1 ? 36u : 216u);
    c.esi = STAGE_UNIT0; c.eax = STAGE_UNIT1; c.ecx = skId;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = (int32_t)skId;
    run_and_emit(0x6FD00210u, "SUNIT_CanTargetOwnPetWithSkill113c", k,
                 k == 0 ? "neg_skill" : k == 1 ? "firebolt_no_flag" : k == 2 ? "wrong_owner" : "unsummon_own_pet",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [9] 0x6FD00BF0 SUNIT_CancelPlayerUnitInteraction_6FD00BF0_113c (eax=pPlayer, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 111u);
    if (k == 0) {
      U8(STAGE_UNIT0 + 0x6Cu) = 0u; /* not interacting */
    } else if (k == 1) {
      /* Interacting with object class 0x151 (337) -> sets *(*pField7C) = 0xFFFFFFFF */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x151u, 51u, 1u, 5004u, 5004u, 113u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_UNIT1 + 0x7Cu) = STAGE_SCRATCH;
      U32(STAGE_SCRATCH)       = STAGE_SCRATCH + 0x10u;
      U32(STAGE_SCRATCH + 0x10u) = 7u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 2u;
      U32(STAGE_UNIT0 + 0x64u) = 51u;
    } else {
      /* Interacting with NPC monster -> removes player from interact list */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 148u, 52u, 1u, 5004u, 5004u, 114u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      uint32_t pInteract = STAGE_SCRATCH;
      uint32_t pNode = STAGE_SCRATCH + 0x10u;
      U32(STAGE_UDATA1 + 0x30u) = pInteract;
      U32(pInteract) = pNode;
      U32(pNode + 0x00u) = STAGE_UNIT0;
      U32(STAGE_GAME + 0x1D24u) = STAGE_NPCCTRL;
      U32(STAGE_NPCCTRL + 0x04u) = STAGE_NPCCTRL + 0x10u;
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 1u;
      U32(STAGE_UNIT0 + 0x64u) = 52u;
    }
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FD00BF0u, "SUNIT_CancelPlayerUnitInteraction_6FD00BF0_113c", k,
                 k == 0 ? "not_interacting" : k == 1 ? "obj_0x151" : "npc_monster",
                 &c, ts, 2, 0u, 0);
  }

  /* [10] 0x6FCF1780 ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c (ecx=pGame, edx=pItem, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, 20u, 0u, 0u, 0u, 115u);
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 500u : 50u;
    if (k >= 1) {
      void *pSub = fn_AllocStatList(NULL, 0x20000000u, 100u, 4, 20);
      fn_SetStatIfValid(pSub, 0, 5, 0);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSub, 0);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCF1780u, "ITEMS_ExpireTimedStatSubListsEvent_6FCF1780_113c", k,
                 k == 0 ? "no_sublist" : k == 1 ? "not_expired" : "expired_at_500",
                 &c, ts, 2, 0u, 0);
  }

  /* [11] 0x6FCF1A30 ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c (ecx=pUnit, eax=pSkill, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1) ? 1u : 2u); /* lvl 1 = Rogue Encampment (town) */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 116u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 200 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 200 << 8, 0);
    uint32_t pSk = (k == 0) ? 0u : attach_skill(STAGE_UNIT0, 36, 3); /* Fire Bolt (cannot cast in town -> reason 2) */
    c.ecx = STAGE_UNIT0; c.eax = pSk;
    ts[0] = STAGE_UNIT0; ts[1] = pSk;
    run_and_emit(0x6FCF1A30u, "ITEMS_CheckSkillUseNotBlocked2Or7_6FCF1A30_113c", k,
                 k == 0 ? "assert_null_skill" : k == 1 ? "blocked_in_town" : "allowed_outside_town",
                 &c, ts, 2, 0xFFFFFFFFu, k == 0);
  }

  /* [12] 0x6FCF1A00 ITEMS_DoItemRecordsMatchCodePair113c (eax=pTxtA, esi=pTxtB, ecx=dwCode1, edx=dwCode2, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pA = STAGE_SCRATCH + 0x000u;
    uint32_t pB = STAGE_SCRATCH + 0x200u;
    U32(pA + 0x80u) = 0x20317068u; /* "hp1 " */
    U32(pB + 0x80u) = 0x2031706Du; /* "mp1 " */
    uint32_t c1 = (k == 0) ? 0x20317068u : (k == 1 ? 0x2031706Du : 0x20397068u);
    uint32_t c2 = (k == 0) ? 0x2031706Du : 0x20317068u;
    c.eax = pA; c.esi = pB; c.ecx = c1; c.edx = c2;
    ts[0] = pA; ts[1] = pB; ts[2] = c1; ts[3] = c2;
    run_and_emit(0x6FCF1A00u, "ITEMS_DoItemRecordsMatchCodePair113c", k,
                 k == 0 ? "direct_match" : k == 1 ? "swapped_match" : "mismatch",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [13] 0x6FCF1720 ITEMS_GetOppositeHandOrRingBodyLoc113c (eax=nBodyLoc, ret 0) */
  {
    const uint32_t locs[5] = {4u, 5u, 6u, 11u, 3u};
    for (int k = 0; k < 5; k++) {
      reset_case();
      c = make_call();
      c.eax = locs[k];
      ts[0] = locs[k];
      run_and_emit(0x6FCF1720u, "ITEMS_GetOppositeHandOrRingBodyLoc113c", k,
                   k == 0 ? "loc4_to_5" : k == 1 ? "loc5_to_4" : k == 2 ? "loc6_to_7" : k == 3 ? "loc11_to_12" : "loc3_to_0",
                   &c, ts, 1, 0xFFFFFFFFu, 0);
    }
  }

  /* [14] 0x6FCF6710 ITEMS_OnCharmPlacedInInventory_6FCF6710_113c (eax=pUnit, ecx=pItem, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 117u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 50, 0); /* level 50 */
    fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u,
                      (k == 2) ? g_item_charm : g_item_ring, 30u, (k == 0) ? 1u : 0u, 0u, 0u, 118u);
    U8(STAGE_UDATA1 + 0x45u) = 0u; /* invPage = inventory */
    U32(STAGE_UDATA1 + 0x18u) = 0x10u; /* ITEMFLAG_IDENTIFIED */
    c.eax = STAGE_UNIT0; c.ecx = STAGE_UNIT1;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCF6710u, "ITEMS_OnCharmPlacedInInventory_6FCF6710_113c", k,
                 k == 0 ? "mode_not_0" : k == 1 ? "not_charm" : "usable_charm",
                 &c, ts, 3, 0u, 0);
  }

  /* [15] 0x6FCDCB90 NPC_ClearPlayerInteractState_6FCDCB90_113c (eax=pNpcUnit, ecx=pPlayer, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 119u);
    U32(STAGE_UNIT0 + 0x64u) = 55u;
    U32(STAGE_UNIT0 + 0x68u) = 1u;
    U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
    uint32_t pNpc = (k == 0) ? 0u : STAGE_UNIT1;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 148u, 55u, 1u, 5005u, 5005u, 120u);
      if (k == 2) {
        uint32_t pInteract = STAGE_SCRATCH;
        uint32_t pNode = STAGE_SCRATCH + 0x10u;
        U32(STAGE_UDATA1 + 0x30u) = pInteract;
        U32(pInteract) = pNode;
        U32(pNode + 0x00u) = STAGE_UNIT0;
      }
    }
    c.eax = pNpc; c.ecx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pNpc; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCDCB90u, "NPC_ClearPlayerInteractState_6FCDCB90_113c", k,
                 k == 0 ? "null_npc" : k == 1 ? "npc_no_interact" : "npc_unlink_player",
                 &c, ts, 3, 0u, 0);
  }

  /* [16] 0x6FCF4FF0 ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0_113c (ecx=pUnit, eax=pItem, s0=pGame, ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 121u);
    if (k >= 1) fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 40u,
                      (k == 3) ? 1u : 0u, 0u, 0u, 122u);
    U8(STAGE_UDATA1 + 0x44u) = (k == 1) ? 0x0Bu : ((k == 3) ? 0x06u : 0x00u); /* bodyLoc */
    c.ecx = STAGE_UNIT0; c.eax = STAGE_UNIT1;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCF4FF0u, "ITEMS_OnInsertOrEquipUpdateStats_6FCF4FF0_113c", k,
                 k == 0 ? "null_inv" : k == 1 ? "swap_slot_0b" : k == 2 ? "stored_ring" : "equipped_ring",
                 &c, ts, 3, 0u, 0);
  }

  /* [17] 0x6FCF16B0 ITEMS_AreAffixesEqual113c (ebx=pItem1, edi=pItem2, ret 0) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, 41u, 0u, 0u, 0u, 123u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 42u, 0u, 0u, 0u, 124u);
    /* wAutoAffix at +0x36, wMagicPrefix[0..2] at +0x38, wMagicSuffix[0..2] at +0x3E */
    U16(STAGE_UDATA0 + 0x36u) = 10u; U16(STAGE_UDATA1 + 0x36u) = (k == 2) ? 11u : 10u;
    U16(STAGE_UDATA0 + 0x38u) = 20u; U16(STAGE_UDATA1 + 0x38u) = (k == 0) ? 21u : 20u;
    U16(STAGE_UDATA0 + 0x3Eu) = 30u; U16(STAGE_UDATA1 + 0x3Eu) = (k == 1) ? 31u : 30u;
    c.ebx = STAGE_UNIT0; c.edi = STAGE_UNIT1;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FCF16B0u, "ITEMS_AreAffixesEqual113c", k,
                 k == 0 ? "prefix_diff" : k == 1 ? "suffix_diff" : k == 2 ? "auto_diff" : "all_equal",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [18] 0x6FCF1650 ITEMS_PlaceItemInSocketInventory_6FCF1650_113c (edi=pUnit, esi=pItem, ret 0; asserts 0x19A1/0x19A2) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_sword, 45u, 0u, 0u, 0u, 125u);
    fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 46u, 0u, 0u, 0u, 126u);
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t pI = (k == 1) ? 0u : STAGE_UNIT1;
    c.edi = pU; c.esi = pI;
    ts[0] = pU; ts[1] = pI;
    run_and_emit(0x6FCF1650u, "ITEMS_PlaceItemInSocketInventory_6FCF1650_113c", k,
                 k == 0 ? "assert_null_unit" : k == 1 ? "assert_null_item" : "place_in_socket",
                 &c, ts, 2, 0xFFFFFFFFu, k < 2);
  }

  /* [19] 0x6FCDCAA0 NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c (eax=pNpc, ebx=pGame, s0=pItem, ret 4, retMask=0xFF) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 148u, 10u, 1u, 5000u, 5000u, 127u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u,
                      (k == 1) ? g_item_hp4 : g_item_hp1, 11u, 0u, 0u, 0u, 128u);
    U32(STAGE_GAME + 0x1D24u)  = STAGE_NPCCTRL;
    U32(STAGE_NPCCTRL + 0x04u) = STAGE_NPCCTRL + 0x10u;
    uint32_t pSlot0 = STAGE_NPCCTRL + 0x10u;
    U32(pSlot0 + 0x00u) = (k == 0) ? 999u : 148u; /* slot classId */
    U32(STAGE_SCRATCH)  = (k == 3) ? 0x20317068u : 0x20397068u; /* "hp1 " vs "hp9 " */
    U32(pSlot0 + 0x34u) = STAGE_SCRATCH;
    U32(pSlot0 + 0x38u) = 1u;
    U8(STAGE_GAME + 0x6Du) = (k == 1) ? 1u : 0u; /* difficulty > 0 for hp4 */
    c.eax = STAGE_UNIT0; c.ebx = STAGE_GAME;
    c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT1;
    run_and_emit(0x6FCDCAA0u, "NPC_IsPermStoreItemBaseCode_6FCDCAA0_113c", k,
                 k == 0 ? "no_npc_slot" : k == 1 ? "nm_hp4_perm" : k == 2 ? "not_in_list" : "in_perm_list",
                 &c, ts, 3, 0xFFu, 0);
  }

  /* [20] 0x6FCDCA20 NPC_RefreshInventoryItemStatLists_6FCDCA20_113c (ebx=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    if (k >= 1) {
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 129u);
      if (k == 2) {
        void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 60u, 1u, 0u, 0u, 130u);
        fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 6);
      }
    }
    c.ebx = pU;
    ts[0] = pU;
    run_and_emit(0x6FCDCA20u, "NPC_RefreshInventoryItemStatLists_6FCDCA20_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "null_inv" : "with_equipped_ring",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [21] 0x6FCD31B0 SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c (ecx=pGame, edx=pUnit, s0..1=0, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 131u);
    U32(STAGE_UNIT0 + 0xC4u) = (k == 0) ? 0x0000001Fu : (k == 1 ? 0x0000000Eu : 0x00000106u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCD31B0u, "SKILLS_SrvSt_ClearUnitFlags0EAndMarkDeadCollision_6FCD31B0_113c", k,
                 k == 0 ? "flags_1f_to_11" : k == 1 ? "flags_0e_to_00" : "flags_106_to_100",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [22] 0x6FCD3570 SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c (ecx=pGame, edx=pUnit, s0..1=0, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 132u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 11u, 1u, 5005u, 5005u, 133u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT0; /* self target */
      U32(STAGE_PATH0 + 0x5Cu) = 1u;
      U32(STAGE_PATH0 + 0x60u) = 10u;
    } else if (k == 2) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1; /* valid other target */
      U32(STAGE_PATH0 + 0x5Cu) = 0u;
      U32(STAGE_PATH0 + 0x60u) = 11u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCD3570u, "SKILLS_SrvDo002_ValidateNonSelfPathTarget_6FCD3570_113c", k,
                 k == 0 ? "no_target" : k == 1 ? "self_target" : "valid_target",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [23] 0x6FCD2E90 SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c (ecx=pGame, edx=pUnit, s0..1=0, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 134u);
    U8(STAGE_UNIT0 + 0x4Eu)  = 0x77u;
    U32(STAGE_UNIT0 + 0x3Cu) = 0x5555u;
    U32(STAGE_UNIT0 + 0x44u) = (k == 0) ? 0u : (k == 1 ? (5u << 8) : 0xFFFFFE00u);
    U32(STAGE_UNIT0 + 0x48u) = 12u << 8;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCD2E90u, "SKILLS_SrvDo124_ClearSeqFlagAndFrameCount_6FCD2E90_113c", k,
                 k == 0 ? "frame_0_zeroes_3c" : k == 1 ? "frame_5_keeps_3c" : "frame_neg_zeroes_3c",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [24] 0x6FCC20C0 SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c (edi=pGame, esi=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 135u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 11u, 1u, 5002u, 5002u, 136u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 1) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT0;
      U32(STAGE_PATH0 + 0x5Cu) = 1u;
      U32(STAGE_PATH0 + 0x60u) = 10u;
    } else if (k == 2) {
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      U32(STAGE_PATH0 + 0x5Cu) = 0u;
      U32(STAGE_PATH0 + 0x60u) = 11u;
    }
    c.edi = STAGE_GAME; c.esi = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCC20C0u, "SKILLS_ExecuteMeleeEventsOnPathTarget_6FCC20C0_113c", k,
                 k == 0 ? "no_target" : k == 1 ? "self_target" : "exec_target",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [25] 0x6FCC35D0 SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c (eax=pUnit, s0=nSlowPct, ret 4; asserts 0xA2A) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT0;
    int32_t slow = (k == 1) ? 0 : 50;
    if (k >= 1) {
      stage_timer_queue(STAGE_GAME);
      stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 137u);
      U32(STAGE_GAME + 0xA8u)  = 120u;
      U32(STAGE_UNIT0 + 0x44u) = 100u << 8;
      U32(STAGE_UNIT0 + 0x48u) = 16u << 8;
      U16(STAGE_UNIT0 + 0x4Cu) = 256u;
      U32(STAGE_UNIT0 + 0x50u) = STAGE_SCRATCH;
      U32(STAGE_SCRATCH + 0x08u) = 16u;
      U8(STAGE_SCRATCH + 0x10u + 8u) = 1u;
    }
    c.eax = pU; c.nargs = 1; c.args[0] = (uint32_t)slow; c.calleePop = 4u;
    ts[0] = pU; ts[1] = slow;
    run_and_emit(0x6FCC35D0u, "SKILLS_ScaleUnitAnimEventsBySlowPct_6FCC35D0_113c", k,
                 k == 0 ? "assert_null_unit" : k == 1 ? "slow_0" : "slow_50",
                 &c, ts, 2, 0u, k == 0);
  }

  /* [27] 0x6FCD3270 SKILLS_InitInfernoSeqFrames_6FCD3270_113c (esi=pUnit, s0=pSkillsTxt, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uType = (k == 0) ? 0u : 1u;
    uint32_t clsId = (k == 0) ? 1u : g_mon_inf;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, clsId, 10u, 1u, 5000u, 5000u, 139u);
    uint32_t pSkTxt = STAGE_SCRATCH;
    U8(pSkTxt + 0x11u) = (k == 1) ? 0x0Eu : 0x05u;
    c.esi = STAGE_UNIT0; c.nargs = 1; c.args[0] = pSkTxt; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pSkTxt;
    run_and_emit(0x6FCD3270u, "SKILLS_InitInfernoSeqFrames_6FCD3270_113c", k,
                 k == 0 ? "player_default_0x500" : k == 1 ? "mon_anim_0e" : "mon_anim_other",
                 &c, ts, 2, 0u, 0);
  }

  /* [28] 0x6FD11420 SKILLS_ResolveTriggeredAttackerTarget_6FD11420_113c (eax=pGame, esi=pCaster, ebx=pOutType, s0=pOutGuid, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 140u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 19u, 99u, 1u, 5005u, 5005u, 141u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pOutTy = STAGE_SCRATCH + 0x00u;
    uint32_t pOutId = STAGE_SCRATCH + 0x04u;
    U32(pOutTy) = 0xAAu; U32(pOutId) = 0xBBu;
    if (k == 0) {
      /* Already has valid path target */
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      U32(STAGE_PATH0 + 0x5Cu) = 1u;
      U32(STAGE_PATH0 + 0x60u) = 99u;
    } else if (k == 2) {
      /* No path target, last attacker is STAGE_UNIT1 */
      U32(STAGE_UNIT0 + 0xC8u) = 0x20000u;
      U32(STAGE_UNIT0 + 0x9Cu) = 1u;
      U32(STAGE_UNIT0 + 0xA0u) = 99u;
    }
    c.eax = STAGE_GAME; c.esi = STAGE_UNIT0; c.ebx = pOutTy;
    c.nargs = 1; c.args[0] = pOutId; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pOutTy; ts[3] = pOutId;
    run_and_emit(0x6FD11420u, "SKILLS_ResolveTriggeredAttackerTarget_6FD11420_113c", k,
                 k == 0 ? "existing_target" : k == 1 ? "no_attacker" : "last_attacker_found",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [29] 0x6FCC5D40 MONAI_Stall200IfUnitHasRoom_6FCC5D40_113c (ecx=pGame, edx=pUnit, s0=0, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, (k == 0) ? 0u : STAGE_PATH0, STAGE_ROOM0,
                      1u, 19u, 10u, 1u, 5000u, 5000u, 142u);
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 300u : 100u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCC5D40u, "MONAI_Stall200IfUnitHasRoom_6FCC5D40_113c", k,
                 k == 0 ? "no_room" : k == 1 ? "stall_at_100" : "stall_at_300",
                 &c, ts, 2, 0u, 0);
  }

  /* [30] 0x6FCC4180 MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c (ecx=pGame, edx=pSelf, s0=pCand, s1=0, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 143u);
    /* Monster class 487 (Imp / Minion) or Fallen (19): test player (not mon), far mon, near mon */
    uint32_t uTy = (k == 0) ? 0u : 1u;
    uint16_t cx  = (k == 1) ? 5100u : 5005u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, uTy, 19u, 11u, 1u, cx, 5000u, 144u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    run_and_emit(0x6FCC4180u, "MONAI_MatchImpregnatableMonsterWithin25Callback_6FCC4180_113c", k,
                 k == 0 ? "not_monster" : k == 1 ? "too_far" : "within_25",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [31] 0x6FCC39E0 MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c (ecx=pGame, edx=pSelf, s0=pCand, s1=pScanCtx, ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 544u, 10u, 1u, 5000u, 5000u, 145u);
    uint32_t pCand = (k == 0) ? 0u : STAGE_UNIT1;
    if (k >= 1) {
      uint32_t cls = (k == 1) ? 1u : 0x233u;
      uint16_t cx  = (k == 2) ? 5080u : 5004u;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, cls, 11u, 0u, cx, 5000u, 146u);
    }
    U32(STAGE_SCRATCH + 0x04u) = 20u; /* maxDist */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = pCand; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pCand; ts[3] = STAGE_SCRATCH;
    run_and_emit(0x6FCC39E0u, "MONAI_MatchNearbyWorldstoneObject233Callback_6FCC39E0_113c", k,
                 k == 0 ? "null_cand" : k == 1 ? "wrong_cls" : k == 2 ? "too_far" : "match_0x233",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [32] 0x6FCD6C90 AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c (esi=pSkill, edi=pUnit, ret 0) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 147u);
    uint32_t pSk = 0u;
    if (k == 1) pSk = attach_skill(STAGE_UNIT0, 0x3B, 1); /* Blizzard -> 1 */
    if (k == 2) pSk = attach_skill(STAGE_UNIT0, 0x33, 2); /* Firewall lvl 2 -> 0 */
    if (k == 3) pSk = attach_skill(STAGE_UNIT0, 0x33, 5); /* Firewall lvl 5 -> 1 */
    if (k == 4) pSk = attach_skill(STAGE_UNIT0, 0x1B, 9); /* Immolation Arrow lvl 9 -> 1 */
    c.esi = pSk; c.edi = STAGE_UNIT0;
    ts[0] = pSk; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCD6C90u, "AIBAAL_IsHighThreatAoESkill_6FCD6C90_113c", k,
                 k == 0 ? "null" : k == 1 ? "blizzard" : k == 2 ? "fw_lvl2" : k == 3 ? "fw_lvl5" : "immo_lvl9",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [33] 0x6FD120C0 AI_ScheduleAiThinkTimer_6FD120C0_113c (eax=pGame, ebx=pUnit, s0=nDelay, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 148u);
    uint32_t delay = (k == 0) ? 0u : (k == 1 ? 15u : 45u);
    c.eax = STAGE_GAME; c.ebx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = delay; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = delay;
    run_and_emit(0x6FD120C0u, "AI_ScheduleAiThinkTimer_6FD120C0_113c", k,
                 k == 0 ? "delay_0_to_1" : k == 1 ? "delay_15" : "delay_45",
                 &c, ts, 3, 0u, 0);
  }

  /* [34] 0x6FCD12B0 MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c (ecx=pGame, edx=pSelf, s0=pCand, s1=pCtx, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 58u, 10u, 1u, 5000u, 5000u, 149u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 19u, 11u, (k == 0) ? 1u : 12u, 5004u, 5000u, 150u);
    U32(STAGE_UNIT1 + 0xC4u) = 0x00000006u; /* bit 1 (0x02) corpse flag set */
    uint32_t pAiG = STAGE_SCRATCH + 0x100u;
    U32(STAGE_UDATA1 + 0x28u) = pAiG;
    U32(pAiG + 0x28u) = STAGE_GAME;
    U32(pAiG + 0x2Cu) = (k == 1) ? 999u : 10u; /* pack leader guid */
    U32(pAiG + 0x30u) = 1u; /* UNIT_MONSTER */
    U32(STAGE_SCRATCH + 0x0Cu) = 20u; /* maxDist */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_SCRATCH;
    run_and_emit(0x6FCD12B0u, "MONAI_TrackPackCorpseInRangeCallback_6FCD12B0_113c", k,
                 k == 0 ? "alive_skip" : k == 1 ? "other_pack" : "own_pack_corpse",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [35] 0x6FCC5AC0 MONAI_RecordPathTargetInteractByUnitType_6FCC5AC0_113c (ecx=pGame, edx=pUnit, s0=0, ret 4) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 151u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k >= 1) {
      uint32_t tType = (k == 1) ? 0u : (k == 2 ? 1u : 3u);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, tType, 1u, 70u + (uint32_t)k, 1u, 5005u, 5005u, 152u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      U32(STAGE_PATH0 + 0x5Cu) = tType;
      U32(STAGE_PATH0 + 0x60u) = 70u + (uint32_t)k;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCC5AC0u, "MONAI_RecordPathTargetInteractByUnitType_6FCC5AC0_113c", k,
                 k == 0 ? "no_target" : k == 1 ? "player_tgt" : k == 2 ? "mon_tgt" : "missile_tgt",
                 &c, ts, 2, 0u, 0);
  }

  /* [36] 0x6FCD6D30 AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c (ecx=pU1, edx=pU2, ret 0; asserts 0x11D/0x11E) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 544u, 10u, 1u, 5000u, 5000u, 153u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 11u, 1u,
                      (k == 3) ? 6200u : 5010u, 5000u, 154u);
    if (k == 2) U8(STAGE_UNIT1 + 0x18u) = 4u; /* different act */
    uint32_t u1 = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t u2 = (k == 1) ? 0u : STAGE_UNIT1;
    c.ecx = u1; c.edx = u2;
    ts[0] = u1; ts[1] = u2;
    run_and_emit(0x6FCD6D30u, "AIBAAL_AreUnitsInSameActWithin1020_6FCD6D30_113c", k,
                 k == 0 ? "assert_u1" : k == 1 ? "assert_u2" : k == 2 ? "diff_act" : k == 3 ? "too_far" : "near_same_act",
                 &c, ts, 2, 0xFFFFFFFFu, k < 2);
  }

  /* [37] 0x6FD13CB0 AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c (edi=pUnit, eax=bEquipSkill, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cls = (k == 2 && g_mon_res_sk != 0u) ? g_mon_res_sk : (g_mon_res_md ? g_mon_res_md : 19u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, cls, 10u, 1u, 5000u, 5000u, 155u);
    uint32_t bEq = (k == 0) ? 0u : 1u;
    c.edi = STAGE_UNIT0; c.eax = bEq;
    ts[0] = STAGE_UNIT0; ts[1] = bEq;
    run_and_emit(0x6FD13CB0u, "AI_SelectMonsterResurrectSkillAndMode_6FD13CB0_113c", k,
                 k == 0 ? "equip_0" : k == 1 ? "mode_only" : "resurrect_skill",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [38] 0x6FD11A20 AI_SetAiControlOverrides113c (eax=pUnit, edx=nPathType, esi=nVelPct, ecx=nDist, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 156u);
    U32(STAGE_UDATA0 + 0x2Cu) = STAGE_SCRATCH;
    int32_t pt  = (k == 0) ? 1 : (k == 1 ? 3 : 0);
    int32_t vel = (k == 0) ? 50 : (k == 1 ? -20 : 100);
    uint32_t dst = (k == 0) ? 100u : (k == 1 ? 15u : 0u);
    c.eax = STAGE_UNIT0; c.edx = (uint32_t)pt; c.esi = (uint32_t)vel; c.ecx = dst;
    ts[0] = STAGE_UNIT0; ts[1] = pt; ts[2] = vel; ts[3] = dst;
    run_and_emit(0x6FD11A20u, "AI_SetAiControlOverrides113c", k,
                 k == 0 ? "remap1_clamp77" : k == 1 ? "pt3_negvel" : "vel100_nodist",
                 &c, ts, 4, 0u, 0);
  }

  /* [39] 0x6FCC4450 AI_SyncSummonSkillLevelFromOwner_6FCC4450_113c (edx=pUnit, s0=pAiArgs, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 77u, 1u, 5000u, 5000u, 157u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k == 2) attach_skill(STAGE_UNIT0, 70, 9); /* Raise Skeleton lvl 9 */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 363u, 88u, 1u, 5004u, 5004u, 158u);
    uint32_t pAiG   = STAGE_SCRATCH + 0x000u;
    uint32_t pAiArg = STAGE_SCRATCH + 0x080u;
    uint32_t pAiCmd = STAGE_SCRATCH + 0x100u;
    uint32_t pMonSt = STAGE_SCRATCH + 0x200u;
    U32(STAGE_UDATA1 + 0x28u) = pAiG;
    U32(pAiG + 0x28u) = STAGE_GAME;
    U32(pAiG + 0x2Cu) = 77u;
    U32(pAiG + 0x30u) = 0u;
    U32(pAiArg + 0x00u) = pAiCmd;
    U32(pAiArg + 0x1Cu) = pMonSt;
    S16(pMonSt + 0x80u) = 70; /* Raise Skeleton */
    uint32_t pU = (k == 0) ? 0u : STAGE_UNIT1;
    c.edx = pU; c.nargs = 1; c.args[0] = pAiArg; c.calleePop = 4u;
    ts[0] = pU; ts[1] = pAiArg;
    run_and_emit(0x6FCC4450u, "AI_SyncSummonSkillLevelFromOwner_6FCC4450_113c", k,
                 k == 0 ? "null_unit" : k == 1 ? "owner_no_skill" : "sync_lvl_9",
                 &c, ts, 2, 0u, 0);
  }

  /* [40] 0x6FCD14B0 MONAI_FindNearestFriendlyMonsterCallback_6FCD14B0_113c (ecx=pGame, edx=pOrigin, s0=pCand, s1=pFindCtx, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 159u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 19u, 11u, (k == 0) ? 12u : 1u,
                      (k == 1) ? 5015u : 5004u, 5000u, 160u);
    U32(STAGE_SCRATCH + 0x04u) = 50u; /* bestDist */
    U32(STAGE_SCRATCH + 0x0Cu) = 30u; /* maxDist */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_SCRATCH;
    run_and_emit(0x6FCD14B0u, "MONAI_FindNearestFriendlyMonsterCallback_6FCD14B0_113c", k,
                 k == 0 ? "dead_skip" : k == 1 ? "friendly_dist15" : "friendly_dist4",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [41] 0x6FD10040 PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c (ecx=pGame, edx=pOwner, s0=pTarget, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 161u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 162u);
    uint32_t n0 = STAGE_SCRATCH + 0x00u, n1 = STAGE_SCRATCH + 0x20u;
    U32(n0 + 0x00u) = 99u; U32(n0 + 0x10u) = n1;
    U32(n1 + 0x00u) = 20u; U32(n1 + 0x10u) = 0u;
    U32(STAGE_UDATA0 + 0x38u) = (k == 0) ? 0u : (k == 1 ? n1 : n0);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    run_and_emit(0x6FD10040u, "PLAYERLIST_RemoveRelationNodeCallback_6FD10040_113c", k,
                 k == 0 ? "empty_list" : k == 1 ? "remove_head" : "remove_tail",
                 &c, ts, 3, 0u, 0);
  }

  /* [42] 0x6FCEB590 PACKET_Recv12_ClearGfxState0C_6FCEB590_113c (edx=pPlayer, s0=pPkt, s1=nLen, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 163u);
    if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 12, 1);
    uint32_t len = (k == 0) ? 4u : 1u;
    c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH; ts[2] = len;
    run_and_emit(0x6FCEB590u, "PACKET_Recv12_ClearGfxState0C_6FCEB590_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "already_clear" : "clear_st12",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [44] 0x6FD10060 PARTY_FindPlayerRelationNode113c (edi=pOwner, esi=pTarget, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 165u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 166u);
    uint32_t n0 = STAGE_SCRATCH + 0x00u, n1 = STAGE_SCRATCH + 0x20u;
    U32(n0 + 0x00u) = 99u; U32(n0 + 0x10u) = n1;
    U32(n1 + 0x00u) = 20u; U32(n1 + 0x10u) = 0u;
    U32(STAGE_UDATA0 + 0x38u) = (k == 1) ? 0u : n0;
    uint32_t tgt = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c.edi = STAGE_UNIT0; c.esi = tgt;
    ts[0] = STAGE_UNIT0; ts[1] = tgt;
    run_and_emit(0x6FD10060u, "PARTY_FindPlayerRelationNode113c", k,
                 k == 0 ? "self_ret0" : k == 1 ? "empty_ret0" : "found_n1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [45] 0x6FCECB10 PACKET_IsInteractingWithDifferentPlayer113c (ecx=pPlayer, s0=pGame, s1=pOther, ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 167u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 168u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 3u, 30u, 1u, 5004u, 5004u, 169u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    if (k >= 1) {
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x68u) = (k == 1) ? 1u : 0u; /* 1=NPC, 0=Player */
      U32(STAGE_UNIT0 + 0x64u) = 20u;
    }
    uint32_t other = (k == 2) ? STAGE_UNIT1 : STAGE_UNIT2;
    c.ecx = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = other; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = other;
    run_and_emit(0x6FCECB10u, "PACKET_IsInteractingWithDifferentPlayer113c", k,
                 k == 0 ? "not_interacting" : k == 1 ? "interacting_npc" : k == 2 ? "same_player" : "different_player",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [47] 0x6FCEB4A0 PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 171u);
    /* IntroData at pPlayerData + diff*4 + 0x60 -> [+4] pBitFieldHolder -> [+0] pBitBuffer */
    uint32_t pIntro = STAGE_SCRATCH + 0x40u;
    uint32_t pHold  = STAGE_SCRATCH + 0x50u;
    uint32_t pBuf   = STAGE_SCRATCH + 0x60u;
    U32(STAGE_UDATA0 + 0x60u) = pIntro;
    U32(pIntro + 0x04u)       = pHold;
    U32(pHold + 0x00u)        = pBuf;
    memset((void *)(uintptr_t)pBuf, 0xFF, 0x20u);
    U8(STAGE_SCRATCH + 0x00u) = 0x3Bu;
    U16(STAGE_SCRATCH + 0x01u) = (k == 1) ? 9999u : 148u; /* Akara=148 */
    uint32_t len = (k == 0) ? 2u : 3u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEB4A0u, "PACKET_Srv3B_ClearNpcIntroFlag_6FCEB4A0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "oob_npc_ret2" : "clear_akara_intro",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [48] 0x6FD141C0 PARTY_EnableHostilityFlag08_6FD141C0_113c (eax=pTarget, ebx=pGame, edi=pOwner, ret 0; asserts 0x24) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 172u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 173u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    if (k == 2) {
      /* Pre-existing node so we test updating existing node vs allocating new node */
      uint32_t n0 = STAGE_SCRATCH;
      U32(n0 + 0x00u) = 20u;
      U32(n0 + 0x04u) = 0x02u;
      U32(STAGE_UDATA0 + 0x38u) = n0;
    }
    uint32_t pOwn = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = STAGE_UNIT1; c.ebx = STAGE_GAME; c.edi = pOwn;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_GAME; ts[2] = pOwn;
    run_and_emit(0x6FD141C0u, "PARTY_EnableHostilityFlag08_6FD141C0_113c", k,
                 k == 0 ? "assert_null_owner" : k == 1 ? "alloc_and_set_08" : "existing_set_08",
                 &c, ts, 3, 0u, k == 0);
  }

  /* [49] 0x6FD102A0 PARTY_TestPlayerRelationFlags113c (edi=pOwner, esi=pTarget, s0=dwMask, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 174u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 175u);
    uint32_t n0 = STAGE_SCRATCH;
    U32(n0 + 0x00u) = 20u;
    U32(n0 + 0x04u) = 0x0Au;
    U32(STAGE_UDATA0 + 0x38u) = (k == 0) ? 0u : n0;
    uint32_t mask = (k == 1) ? 0x04u : 0x08u;
    c.edi = STAGE_UNIT0; c.esi = STAGE_UNIT1;
    c.nargs = 1; c.args[0] = mask; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = mask;
    run_and_emit(0x6FD102A0u, "PARTY_TestPlayerRelationFlags113c", k,
                 k == 0 ? "no_node" : k == 1 ? "bit_clear" : "bit_08_set",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [50] 0x6FD100E0 PARTY_GetHostileCooldownTick113c (edi=pOwner, esi=pTarget, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 176u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 177u);
    U32(STAGE_UDATA0 + 0x160u) = 0x12345u;
    uint32_t n0 = STAGE_SCRATCH;
    U32(n0 + 0x00u) = 20u;
    U32(n0 + 0x08u) = 0x67890u;
    U32(STAGE_UDATA0 + 0x38u) = (k == 1) ? 0u : n0;
    uint32_t tgt = (k == 0) ? 0u : STAGE_UNIT1;
    c.edi = STAGE_UNIT0; c.esi = tgt;
    ts[0] = STAGE_UNIT0; ts[1] = tgt;
    run_and_emit(0x6FD100E0u, "PARTY_GetHostileCooldownTick113c", k,
                 k == 0 ? "null_target_global_tick" : k == 1 ? "no_node_ret0" : "node_tick",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [51] 0x6FD10390 PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c (eax=pPlayer, ecx=pGame, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 178u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 179u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    if (k >= 1) {
      uint32_t n0 = STAGE_SCRATCH + 0x00u;
      U32(n0 + 0x00u) = 20u;
      U32(STAGE_UDATA0 + 0x38u) = n0;
    }
    if (k == 2) {
      uint32_t n1 = STAGE_SCRATCH + 0x20u;
      U32(n1 + 0x00u) = 10u;
      U32(STAGE_UDATA1 + 0x38u) = n1;
    }
    c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FD10390u, "PLAYERLIST_FreeAllPlayerRelations_6FD10390_113c", k,
                 k == 0 ? "already_empty" : k == 1 ? "clear_own_list" : "clear_both_players",
                 &c, ts, 2, 0u, 0);
  }

  /* [52] 0x6FCEB3D0 PACKET_C2S58_MarkQuestIntroSeen113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 180u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    U8(STAGE_SCRATCH + 0x00u)  = 0x58u;
    U16(STAGE_SCRATCH + 0x01u) = (k == 1) ? 0x30u : 0x05u; /* >= 0x2A -> 2, else set bit 12 on quest 5 */
    uint32_t len = (k == 0) ? 2u : 3u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEB3D0u, "PACKET_C2S58_MarkQuestIntroSeen113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "oob_qid_ret2" : "set_q5_bit12",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [53] 0x6FD14210 PARTY_ClearHostilityFlag08_6FD14210_113c (eax=pTarget, ebx=pGame, edi=pOwner, ret 0; asserts 0x15) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 181u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 182u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    if (k == 2) {
      uint32_t n0 = STAGE_SCRATCH;
      U32(n0 + 0x00u) = 20u;
      U32(n0 + 0x04u) = 0x0Au; /* has 0x08 + 0x02 -> clears 0x08 leaves 0x02 */
      U32(STAGE_UDATA0 + 0x38u) = n0;
    }
    uint32_t pOwn = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = STAGE_UNIT1; c.ebx = STAGE_GAME; c.edi = pOwn;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_GAME; ts[2] = pOwn;
    run_and_emit(0x6FD14210u, "PARTY_ClearHostilityFlag08_6FD14210_113c", k,
                 k == 0 ? "assert_null_owner" : k == 1 ? "alloc_and_clear_08" : "existing_clear_08",
                 &c, ts, 3, 0xFFFFFFFFu, k == 0);
  }

  /* [57] 0x6FCEC6E0 PACKET_C2S4B_RequestUnitRefresh113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 189u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 19u, 55u, 1u, 5005u, 5005u, 190u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x4Bu;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 9u : 1u; /* dwUnitType >= 6 -> ret 2 */
    U32(STAGE_SCRATCH + 0x05u) = (k == 2) ? 999u : 55u; /* dwUnitId */
    uint32_t len = (k == 0) ? 5u : 9u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEC6E0u, "PACKET_C2S4B_RequestUnitRefresh113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "bad_type_ret2" : k == 2 ? "missing_ret1" : "refresh_ok_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [58] 0x6FD0FD40 SUBPARTY_ClearUnitBucketList_6FD0FD40_113c (edi=pGame, eax=pUnit, ret 0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 191u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 192u);
    if (k == 0) {
      U32(STAGE_UNIT0 + 0xD0u) = 0x0Bu; /* not in bucket */
    } else {
      uint32_t n0 = STAGE_SCRATCH + 0x00u, n1 = STAGE_SCRATCH + 0x20u;
      U32(STAGE_UNIT0 + 0xD0u) = 2u;
      U32(STAGE_UNIT1 + 0xD0u) = 2u;
      U32(n0 + 0x00u) = STAGE_UNIT0;
      U32(n0 + 0x08u) = (k == 2) ? n1 : 0u;
      U32(n1 + 0x00u) = STAGE_UNIT1;
      U32(STAGE_GAME + 0x10F8u + 2u * 4u) = n0;
    }
    c.edi = STAGE_GAME; c.eax = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FD0FD40u, "SUBPARTY_ClearUnitBucketList_6FD0FD40_113c", k,
                 k == 0 ? "bucket_0b_noop" : k == 1 ? "clear_1_node" : "clear_2_nodes",
                 &c, ts, 2, 0u, 0);
  }

  /* [59] 0x6FD0FED0 SUBPARTY_CreatePlayerBucketHead_6FD0FED0_113c (eax=pGame, ebx=pPlayer, s0=dwArg4, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 193u);
    U32(STAGE_UNIT0 + 0xD0u) = (k == 0) ? 1u : 0x0Bu;
    if (k == 2) U32(STAGE_GAME + 0x10F8u) = STAGE_SCRATCH; /* slot 0 occupied -> picks slot 1 */
    uint32_t arg4 = 0x42u + (uint32_t)k;
    c.eax = STAGE_GAME; c.ebx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = arg4; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = arg4;
    run_and_emit(0x6FD0FED0u, "SUBPARTY_CreatePlayerBucketHead_6FD0FED0_113c", k,
                 k == 0 ? "already_in_bucket" : k == 1 ? "alloc_slot0" : "alloc_slot1",
                 &c, ts, 3, 0u, 0);
  }

  /* [60] 0x6FD0FDB0 SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c (esi=pGame, ebx=nBucket, s0=pUnit, s1=dwArg4, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 19u, 10u, 1u, 5000u, 5000u, 194u);
    U32(STAGE_UNIT0 + 0xD0u) = 0x0Bu;
    uint32_t bkt = (k == 0) ? 7u : (k == 1 ? 8u : 9u);
    if (k == 2) U32(STAGE_GAME + 0x10F8u + 9u * 4u) = STAGE_SCRATCH; /* prepend before existing head */
    c.esi = STAGE_GAME; c.ebx = bkt;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = 0x77u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = bkt; ts[2] = STAGE_UNIT0; ts[3] = 0x77;
    run_and_emit(0x6FD0FDB0u, "SUBPARTY_PrependUnitToBucket8Or9_6FD0FDB0_113c", k,
                 k == 0 ? "invalid_bkt7" : k == 1 ? "bkt8_empty" : "bkt9_prepend",
                 &c, ts, 4, 0u, 0);
  }

  /* [61] 0x6FD105B0 PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c (eax=pPlr2, ecx=pPlr1, s0=pGame, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 195u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 196u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    if (k >= 1) {
      uint32_t n0 = STAGE_SCRATCH;
      U32(n0 + 0x00u) = 20u;
      U32(n0 + 0x04u) = (k == 1) ? 0x08u : 0x04u;
      U32(STAGE_UDATA0 + 0x38u) = n0;
    }
    c.eax = STAGE_UNIT1; c.ecx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FD105B0u, "PARTY_BroadcastPacket8CRelationFlags_6FD105B0_113c", k,
                 k == 0 ? "no_node" : k == 1 ? "bcast_08" : "bcast_04",
                 &c, ts, 3, 0u, 0);
  }

  /* [62] 0x6FD109E0 PARTY_SyncMutualRelationState_6FD109E0_113c (ebx=pUnit1, s0=pUnit2, ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 10u, 1u, 5000u, 5000u, 197u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 2u, 20u, 1u, 5002u, 5002u, 198u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, STAGE_CLIENT1);
    link_player_client(STAGE_UNIT1, STAGE_UDATA1, STAGE_CLIENT1, 2u, 0u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT0;
    uint32_t n0 = STAGE_SCRATCH + 0x00u, n1 = STAGE_SCRATCH + 0x20u;
    U32(n0 + 0x00u) = 20u; U32(n0 + 0x0Cu) = 0u; U32(STAGE_UDATA0 + 0x38u) = n0;
    U32(n1 + 0x00u) = 10u; U32(n1 + 0x0Cu) = (k == 1) ? 4u : 0u; U32(STAGE_UDATA1 + 0x38u) = n1;
    if (k == 2) {
      /* Put UNIT0 in sub-party 1 */
      uint32_t pSub = STAGE_PARTYCTRL + 0x10u;
      uint32_t pMem = STAGE_PARTYCTRL + 0x30u;
      U32(STAGE_GAME + 0x10E8u) = STAGE_PARTYCTRL;
      U32(STAGE_PARTYCTRL + 0x04u) = pSub;
      U16(pSub + 0x00u) = 1u;
      U32(pSub + 0x04u) = pMem;
      U32(pMem + 0x00u) = 10u;
    }
    uint32_t u2 = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c.ebx = STAGE_UNIT0; c.nargs = 1; c.args[0] = u2; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = u2;
    run_and_emit(0x6FD109E0u, "PARTY_SyncMutualRelationState_6FD109E0_113c", k,
                 k == 0 ? "same_guid_noop" : k == 1 ? "rel_4_to_2" : "in_party_1_1",
                 &c, ts, 2, 0u, 0);
  }

  /* [63] 0x6FCED4F0 C2S_ValidatePacket5ByteItem_6FCED4F0_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 199u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 88u, 4u, 0u, 0u, 200u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x16u;
    U32(STAGE_SCRATCH + 0x01u) = (k == 1) ? 999u : 88u;
    uint32_t len = (k == 0) ? 4u : 5u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCED4F0u, "C2S_ValidatePacket5ByteItem_6FCED4F0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "missing_item_ret1" : "cursor_owned_ret3",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [64] 0x6FCED440 C2S_SyncObjectCollisionByGuid_6FCED440_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 201u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 1u, 77u, 0u,
                      (k == 1) ? 5100u : 5002u, 5000u, 202u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    U8(STAGE_SCRATCH + 0x00u)  = 0x13u;
    U32(STAGE_SCRATCH + 0x01u) = 77u;
    uint32_t len = (k == 0) ? 3u : 5u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCED440u, "C2S_SyncObjectCollisionByGuid_6FCED440_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "too_far_ret1" : "in_range_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [65] 0x6FCECE90 C2S_ValidateStoredOrEquippedItem_6FCECE90_113c (eax=pGame, ecx=dwItemGuid, s0=pPlayer, ret 4; asserts 0x45C) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 203u);
    void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 91u, 1u, 0u, 0u, 204u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) U32(STAGE_UNIT1 + 0x10u) = 4u; /* cursor mode -> invalid */
    if (k == 3) fn_PlaceItemInBodyLoc(pInv, (void *)(uintptr_t)STAGE_UNIT1, 6);
    uint32_t pg = (k == 0) ? 0u : STAGE_GAME;
    uint32_t gid = (k == 1) ? 999u : 91u;
    c.eax = pg; c.ecx = gid;
    c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = pg; ts[1] = gid; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCECE90u, "C2S_ValidateStoredOrEquippedItem_6FCECE90_113c", k,
                 k == 0 ? "assert_null_game" : k == 1 ? "missing_ret1" : k == 2 ? "bad_mode_ret1" : "equipped_ok_ret0",
                 &c, ts, 3, 0xFFFFFFFFu, k == 0);
  }

  /* [66] 0x6FCEC860 C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8; asserts 0x27) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 205u);
    if (k >= 2) U32(STAGE_GAME + 0x1D28u) = STAGE_ARENA;
    if (k == 2) U32(STAGE_ARENA + 0x08u) = 0x10000u; /* arena flag blocks */
    U8(STAGE_SCRATCH + 0x00u)  = 0x5Du;
    U8(STAGE_SCRATCH + 0x01u)  = (k == 3) ? 0x0Fu : 0x02u; /* > 0x0A -> ret 2 */
    U32(STAGE_SCRATCH + 0x02u) = 999u; /* missing target guid -> returns 0 cleanly */
    uint32_t len = (k == 0) ? 4u : 6u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEC860u, "C2S_HandlePacket5D_PartyRelationAction_6FCEC860_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "assert_null_arena" : k == 2 ? "arena_blocked_ret3" : k == 3 ? "bad_action_ret2" : "dispatch_ok_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, k == 1);
  }

  /* [67] 0x6FCEC8E0 C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c (ecx=pGame, edx=pPlayer, s0=pPkt, s1=nLen, ret 8; asserts 0x27) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 206u);
    if (k >= 2) U32(STAGE_GAME + 0x1D28u) = STAGE_ARENA;
    if (k == 2) U32(STAGE_ARENA + 0x08u) = 0x10000u;
    U8(STAGE_SCRATCH + 0x00u)  = 0x5Eu;
    U8(STAGE_SCRATCH + 0x01u)  = (k == 3) ? 0x0Bu : 0x02u;
    U8(STAGE_SCRATCH + 0x02u)  = 1u;
    U32(STAGE_SCRATCH + 0x03u) = 999u;
    uint32_t len = (k == 0) ? 5u : 7u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 2; c.args[0] = STAGE_SCRATCH; c.args[1] = len; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH; ts[3] = len;
    run_and_emit(0x6FCEC8E0u, "C2S_HandlePacket5E_PartyRelationToggle_6FCEC8E0_113c", k,
                 k == 0 ? "bad_len_ret3" : k == 1 ? "assert_null_arena" : k == 2 ? "arena_blocked_ret3" : k == 3 ? "bad_action_ret2" : "dispatch_ok_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, k == 1);
  }
}

/* ------------------------------- Batch 2: 69 Quest Hi-VA Functions (Batch 2A + 2B) */

static void emit_batch2_vas(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [61..69] 9 Quest RemovePlayerGuidIfQuestState1AndNot0 wrappers (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  {
    static const struct { uint32_t va; const char *name; uint32_t qFlag; } kRemGuid[] = {
      { 0x6FCE2AF0u, "ACT2Q6_Callback10_RemovePlayerGuid_6FCE2AF0_113c", 0x0Eu },
      { 0x6FCE2F00u, "ACT2Q5_Callback10_RemovePlayerGuid_6FCE2F00_113c", 0x0Du },
      { 0x6FCE3620u, "ACT2Q4_Callback10_RemovePlayerGuid_6FCE3620_113c", 0x0Cu },
      { 0x6FCE3EB0u, "ACT2Q2_Callback10_RemovePlayerGuid_6FCE3EB0_113c", 0x0Au },
      { 0x6FCE44D0u, "ACT2Q1_Callback10_RemovePlayerGuid_6FCE44D0_113c", 0x09u },
      { 0x6FD03390u, "ACT3Q5_Callback14_RemovePlayerGuid_6FD03390_113c", 0x15u },
      { 0x6FD03960u, "ACT3Q6_Callback14_RemovePlayerGuid_6FD03960_113c", 0x16u },
      { 0x6FD03B30u, "ACT3Q2_Callback14_RemovePlayerGuid_6FD03B30_113c", 0x13u },
      { 0x6FD05220u, "ACT3Q4_Callback14_RemovePlayerGuid_6FD05220_113c", 0x11u },
    };
    for (size_t i = 0; i < sizeof(kRemGuid) / sizeof(kRemGuid[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 100u + (uint32_t)i, 1u, 5000u, 5000u, 210u + (uint32_t)i);
        attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
        U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
        U32(STAGE_QUEST0 + 0xE0u) = kRemGuid[i].qFlag;
        U32(STAGE_QUEST0 + 0x1Cu) = 100u + (uint32_t)i;
        U32(STAGE_QUEST0 + 0x20u) = 999u;
        U16(STAGE_QUEST0 + 0x9Cu) = 2u;
        U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
        U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
        if (k == 1) {
          set_quest_bit(STAGE_QBITS0, kRemGuid[i].qFlag, 1u);
        } else if (k == 2) {
          set_quest_bit(STAGE_QBITS0, kRemGuid[i].qFlag, 1u);
          set_quest_bit(STAGE_QBITS0, kRemGuid[i].qFlag, 0u);
        }
        c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
        ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
        run_and_emit(kRemGuid[i].va, kRemGuid[i].name, k,
                     k == 0 ? "bits_clear_noop" : k == 1 ? "bit1_only_noop" : "both_set_remove",
                     &c, ts, 2, 0u, 0);
      }
    }
  }

  /* [70..72] 3 Quest GuidListRemove callbacks (ecx=pQuest, edx=pQuestArg, ret 0, u32) */
  {
    static const struct { uint32_t va; const char *name; uint32_t useDataEx; } kGuidRem[] = {
      { 0x6FCE4550u, "ACT2Q0_Callback10_RemovePlayerGuidFromDataEx_6FCE4550_113c", 1u },
      { 0x6FCD8E60u, "ACT4Q2_Callback10_RemovePlayerGuid_6FCD8E60_113c", 0u },
      { 0x6FCD94D0u, "ACT4Q1_Callback10_RemovePlayerGuid_6FCD94D0_113c", 0u },
    };
    for (size_t i = 0; i < sizeof(kGuidRem) / sizeof(kGuidRem[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, (k == 2) ? 77u : 55u, 1u, 5000u, 5000u, 220u + (uint32_t)i);
        U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
        uint32_t pList = kGuidRem[i].useDataEx ? STAGE_QUESTEX0 : (STAGE_QUEST0 + 0x1Cu);
        U32(pList + 0x00u) = 77u;
        U32(pList + 0x04u) = 88u;
        U16(pList + 0x80u) = 2u;
        U32(STAGE_QUESTARG + 0x0Cu) = (k == 0) ? 0u : STAGE_UNIT0;
        c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
        ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
        run_and_emit(kGuidRem[i].va, kGuidRem[i].name, k,
                     k == 0 ? "null_player_miss" : k == 1 ? "guid_miss" : "guid_hit_remove",
                     &c, ts, 2, 0xFFFFFFFFu, 0);
      }
    }
  }

  /* [73] 0x6FCE3970 ACT2Q3_Callback10_RemovePlayerAndDataExGuid_6FCE3970_113c (ecx=pQuest, edx=pQuestArg, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, (k == 0) ? 33u : 77u, 1u, 5000u, 5000u, 224u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xE0u) = 0x0Bu;
    U32(STAGE_QUEST0 + 0x1Cu) = 77u;
    U16(STAGE_QUEST0 + 0x9Cu) = 1u;
    U32(STAGE_QUESTEX0 + 0x14u) = 77u;
    U32(STAGE_QUESTEX0 + 0x18u) = 88u;
    U16(STAGE_QUESTEX0 + 0x94u) = 2u;
    if (k == 2) {
      set_quest_bit(STAGE_QBITS0, 0x0Bu, 1u);
      set_quest_bit(STAGE_QBITS0, 0x0Bu, 0u);
    }
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE3970u, "ACT2Q3_Callback10_RemovePlayerAndDataExGuid_6FCE3970_113c", k,
                 k == 0 ? "miss_both" : k == 1 ? "remove_dataex_only" : "remove_both_lists",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [74..75] 2 StatusFilter zeroers (ecx=pQ, edx=pPlr, s0=pGlob, s1=pFlags, s2=pStatus, ret 0xC, retMask=0xFF) */
  {
    static const struct { uint32_t va; const char *name; } kZeroFilter[] = {
      { 0x6FCE25E0u, "ACT2Q8_StatusFilter_6FCE25E0_113c" },
      { 0x6FD03040u, "ACT3Q2_DarkWandererStatusFilter113c" },
    };
    for (size_t i = 0; i < sizeof(kZeroFilter) / sizeof(kZeroFilter[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        U8(STAGE_SCRATCH + 0x00u) = 0x11u;
        U8(STAGE_SCRATCH + 0x04u) = 0x22u;
        U8(STAGE_SCRATCH + 0x08u) = 0x33u;
        uint32_t pSt = STAGE_SCRATCH + (uint32_t)(k * 4);
        c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0;
        c.nargs = 3; c.args[0] = STAGE_QBITS0; c.args[1] = STAGE_QBITS1; c.args[2] = pSt; c.calleePop = 0xCu;
        ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0; ts[2] = STAGE_QBITS0; ts[3] = STAGE_QBITS1; ts[4] = pSt;
        run_and_emit(kZeroFilter[i].va, kZeroFilter[i].name, k,
                     k == 0 ? "clear_slot0" : k == 1 ? "clear_slot1" : "clear_slot2",
                     &c, ts, 5, 0xFFu, 0);
      }
    }
  }

  /* [76] 0x6FCE27C0 ACT2Q7_ClearNpcIdleTimerOnInteract_6FCE27C0_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xA8u) = 0x12345678u;
    U8(STAGE_QUESTEX0 + 0x00u) = (k == 2) ? 0u : 1u;
    if (k >= 1) {
      U16(STAGE_UNIT1 + 0x04u) = (k == 1) ? 0x100u : 0x179u;
      U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    }
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE27C0u, "ACT2Q7_ClearNpcIdleTimerOnInteract_6FCE27C0_113c", k,
                 k == 0 ? "null_npc" : k == 1 ? "wrong_class" : k == 2 ? "flag_zero" : "clear_timer",
                 &c, ts, 2, 0u, 0);
  }

  /* [77] 0x6FD02B10 ACT3Q4_ClearOrmusNpcWaitFlag113c (eax=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U8(STAGE_QUESTEX0 + 0x00u) = 0x01u;
    if (k == 1) stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
    if (k == 2) stage_quest_node(STAGE_QUEST0, 0x12u, STAGE_QUESTEX0, 0u);
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FD02B10u, "ACT3Q4_ClearOrmusNpcWaitFlag113c", k,
                 k == 0 ? "no_qctrl" : k == 1 ? "wrong_qid" : "clear_q12_flag",
                 &c, ts, 1, 0u, 0);
  }

  /* [78] 0x6FD02CD0 ACT3Q1_GetQuestDataByte04_113c (eax=pGame, ret 0, retMask=0xFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x04u) = (k == 1) ? 0x03u : 0x07u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FD02CD0u, "ACT3Q1_GetQuestDataByte04_113c", k,
                 k == 0 ? "missing_ret0" : k == 1 ? "byte_3" : "byte_7",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [79] 0x6FCD8940 QUEST_Act4DiabloSealCheck113c (eax=pGame, ret 0, retMask=0xFFFFFFFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x13u) = (k == 1) ? 0u : 5u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCD8940u, "QUEST_Act4DiabloSealCheck113c", k,
                 k == 0 ? "missing_ret0" : k == 1 ? "zero_ret0" : "five_ret5",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [80] 0x6FCE2120 ACT2Q3_GetAltarState_6FCE2120_113c (eax=pAct, ret 0, retMask=0xFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_ACT0 + 0x04u) = STAGE_GAME;
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x04u) = (k == 1) ? 2u : 9u;
    }
    c.eax = STAGE_ACT0; ts[0] = STAGE_ACT0;
    run_and_emit(0x6FCE2120u, "ACT2Q3_GetAltarState_6FCE2120_113c", k,
                 k == 0 ? "missing_ret0" : k == 1 ? "state_2" : "state_9",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [81] 0x6FD02B40 ACT3Q4_CheckOrmusNpcWaitFlag113c (eax=pGame, ret 0, retMask=0xFFFFFFFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x12u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x00u) = (k == 2) ? 1u : 0u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FD02B40u, "ACT3Q4_CheckOrmusNpcWaitFlag113c", k,
                 k == 0 ? "missing_ret0" : k == 1 ? "flag0_ret0" : "flag1_ret1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [82] 0x6FD02960 ACT3Q5_IsCompellingOrbIntact113c (eax=pGame, ret 0, retMask=0xFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x0Cu) = (k == 2) ? 1u : 0u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FD02960u, "ACT3Q5_IsCompellingOrbIntact113c", k,
                 k == 0 ? "missing_ret1" : k == 1 ? "intact_ret1" : "smashed_ret0",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [83] 0x6FCE2460 ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c (eax=pGame, ret 0, retMask=0xFF) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 8u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 1) ? 0u : 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = (k == 3) ? 5u : 2u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCE2460u, "ACT2Q1_IsRadamentKilledOrInactive_6FCE2460_113c", k,
                 k == 0 ? "missing_ret1" : k == 1 ? "inactive_ret1" : k == 2 ? "active_s2_ret0" : "killed_s5_ret1",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [84] 0x6FCE1B20 ACT2Q2_IsQuestInState01_6FCE1B20_113c (eax=pGame, ret 0, retMask=0xFF) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 1) ? 0u : 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = (k == 3) ? 1u : 2u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCE1B20u, "ACT2Q2_IsQuestInState01_6FCE1B20_113c", k,
                 k == 0 ? "missing_ret0" : k == 1 ? "inactive_ret0" : k == 2 ? "state2_ret0" : "state1_ret1",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [85] 0x6FCE1A00 ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c (eax=pGame, ret 0, retMask=0xFF) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 1) ? 0u : 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = (k == 2) ? 3u : 4u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCE1A00u, "ACT2Q2_IsHoradricStaffQuestInactiveOrCompleted_6FCE1A00_113c", k,
                 k == 0 ? "missing_ret1" : k == 1 ? "inactive_ret1" : k == 2 ? "state3_ret0" : "state4_ret1",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [86] 0x6FCE2040 ACT2Q4_IsPortalOpen_6FCE2040_113c (eax=pGame, ret 0, retMask=0xFFFFFFFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
      U16(STAGE_QUESTEX0 + 0x40u) = (k == 2) ? 2u : 1u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCE2040u, "ACT2Q4_IsPortalOpen_6FCE2040_113c", k,
                 k == 0 ? "missing_ret0" : k == 1 ? "closed_ret0" : "open_ret1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [87] 0x6FCE21A0 ACT2Q3_IsEclipseInactive_6FCE21A0_113c (eax=pGame, ret 0, retMask=0xFF) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 1) ? 0u : 1u;
      U8(STAGE_QUEST0 + 0x0Cu) = (k == 2) ? 3u : 4u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCE21A0u, "ACT2Q3_IsEclipseInactive_6FCE21A0_113c", k,
                 k == 0 ? "missing_ret1" : k == 1 ? "inactive_ret1" : k == 2 ? "state3_ret0" : "state4_ret1",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [88] 0x6FCE1A60 ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c (eax=pGame, ret 0, retMask=0xFFFFFFFF) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUEST0 + 0x09u) = (k == 1) ? 0u : 1u;
      U8(STAGE_QUESTEX0 + 0x0Bu) = (k == 2) ? 1u : 0u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCE1A60u, "ACT2Q2_CanSpawnViperAmuletChest_6FCE1A60_113c", k,
                 k == 0 ? "missing_ret0" : k == 1 ? "inactive_ret0" : k == 2 ? "spawned_ret0" : "can_spawn_ret1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [89] 0x6FCE2380 ACT2Q2_AddStaffCount_6FCE2380_113c (eax=pAct, s0=nDelta, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_ACT0 + 0x04u) = STAGE_GAME;
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 9u, STAGE_QUESTEX0, 0u);
      U32(STAGE_QUESTEX0 + 0x24u) = 10u;
    }
    int32_t delta = (k == 2) ? -3 : 4;
    c.eax = STAGE_ACT0; c.nargs = 1; c.args[0] = (uint32_t)delta; c.calleePop = 4u;
    ts[0] = STAGE_ACT0; ts[1] = delta;
    run_and_emit(0x6FCE2380u, "ACT2Q2_AddStaffCount_6FCE2380_113c", k,
                 k == 0 ? "missing_noop" : k == 1 ? "add_pos4" : "add_neg3",
                 &c, ts, 2, 0u, 0);
  }

  /* [90] 0x6FD02DB0 ACT3Q2_AddQuestDataCount1C_113c (eax=pGame, s0=nDelta, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
      U32(STAGE_QUESTEX0 + 0x1Cu) = 5u;
    }
    int32_t delta = (k == 2) ? -2 : 3;
    c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = (uint32_t)delta; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = delta;
    run_and_emit(0x6FD02DB0u, "ACT3Q2_AddQuestDataCount1C_113c", k,
                 k == 0 ? "missing_noop" : k == 1 ? "add_pos3" : "add_neg2",
                 &c, ts, 2, 0u, 0);
  }

  /* [91] 0x6FCD88C0 ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c (eax=pGame, ret 0, retMask=0xFFFFFFFF) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_GAME + 0x70u) = (k == 0) ? 1u : 0u;
    if (k >= 2) {
      stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x14u) = (k == 3) ? 1u : 0u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCD88C0u, "ACT4Q2_IsClassicDiabloDropBlocked_6FCD88C0_113c", k,
                 k == 0 ? "expansion_ret0" : k == 1 ? "classic_missing_ret1" : k == 2 ? "classic_allow_ret0" : "classic_blocked_ret1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [92] 0x6FD02C40 ACT3Q1_GetHratliTargetCoords113c (eax=pGame, ecx=pOutCoords, ret 0, retMask=0xFFFFFFFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x11u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x06u)  = (k == 2) ? 1u : 0u;
      U32(STAGE_QUESTEX0 + 0x10u) = 5123u;
      U32(STAGE_QUESTEX0 + 0x14u) = 5456u;
    }
    c.eax = STAGE_GAME; c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FD02C40u, "ACT3Q1_GetHratliTargetCoords113c", k,
                 k == 0 ? "missing_ret0" : k == 1 ? "flag0_ret0" : "copy_coords_ret1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [93] 0x6FCE1F40 ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c (eax=pGame, ret 0, retMask=0xFFFFFFFF) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x18u) = (k == 1) ? 1u : 0u;
      U8(STAGE_QUESTEX0 + 0x19u) = (k == 2) ? 1u : 0u;
      U16(STAGE_QUESTEX0 + 0x40u) = 2u;
    }
    c.eax = STAGE_GAME; ts[0] = STAGE_GAME;
    run_and_emit(0x6FCE1F40u, "ACT2Q1_IsSewerTrapDoorOpen_6FCE1F40_113c", k,
                 k == 0 ? "missing_ret1" : k == 1 ? "flag18_ret0" : k == 2 ? "flag19_ret0" : "open_ret1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [94] 0x6FCE1EE0 ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c (eax=pGame, ecx=pOutCoord, ret 0, retMask=0xFFFFFFFF) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(STAGE_QUEST0, 0x0Bu, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x30u) = 5200u;
    U32(STAGE_QUESTEX0 + 0x34u) = 5300u;
    if (k == 1) U8(STAGE_QUESTEX0 + 0x18u) = 1u;
    if (k == 2) U8(STAGE_QUESTEX0 + 0x19u) = 1u;
    c.eax = STAGE_GAME; c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FCE1EE0u, "ACT2Q1_GetRadamentSpawnCoords_6FCE1EE0_113c", k,
                 k == 0 ? "none_ret0" : k == 1 ? "exact_xy_ret1" : "y_minus_4_ret1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [95] 0x6FD02900 ACT3Q5_IsDuranceEntryBlocked113c (eax=pGame, s0=pUnit, ret 4, retMask=0xFFFFFFFF) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0) ? 0x65u : 83u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 225u);
    if (k >= 2) {
      stage_quest_node(STAGE_QUEST0, 0x13u, STAGE_QUESTEX0, 0u);
      U8(STAGE_QUESTEX0 + 0x0Cu) = (k == 2) ? 0u : 1u;
    }
    c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FD02900u, "ACT3Q5_IsDuranceEntryBlocked113c", k,
                 k == 0 ? "lvl65_ret0" : k == 1 ? "missing_ret0" : k == 2 ? "orb_intact_blocked" : "orb_smashed_open",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [96..97] 2 Quest ChainStatusFilters (ecx=pQuestData, ret 0, retMask=0xFF; asserts 0x1F5/0x328) */
  {
    static const struct { uint32_t va; const char *name; uint8_t termState; } kChainFilter[] = {
      { 0x6FD02A40u, "QUESTS_ChainStatusFilterNotState7_6FD02A40_113c", 7u },
      { 0x6FD02F00u, "QUESTS_ChainStatusFilterNotState5_6FD02F00_113c", 5u },
    };
    for (size_t i = 0; i < sizeof(kChainFilter) / sizeof(kChainFilter[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        uint32_t pPrev = STAGE_SCRATCH + 0x200u;
        stage_quest_node(STAGE_QUEST0, 0x15u, STAGE_QUESTEX0, (k == 2) ? pPrev : 0u);
        U32(STAGE_QUEST0 + 0x10u) = 0x14u;
        U8(STAGE_QUEST0 + 0x09u)  = 1u;
        U8(STAGE_QUEST0 + 0x0Cu)  = (k == 0) ? 2u : kChainFilter[i].termState;
        U32(STAGE_QUEST0 + 0xF0u) = 0u; /* NULL triggers IsBadCodePtr assert when pPrev found */
        if (k == 2) {
          U32(pPrev + 0x00u) = 0x14u;
          U32(pPrev + 0x04u) = STAGE_GAME;
        }
        c.ecx = STAGE_QUEST0; ts[0] = STAGE_QUEST0;
        run_and_emit(kChainFilter[i].va, kChainFilter[i].name, k,
                     k == 0 ? "active_ret1" : k == 1 ? "no_prev_ret0" : "assert_null_pfn",
                     &c, ts, 1, 0xFFu, k == 2);
      }
    }
  }

  /* [98] 0x6FCD87F0 ACT4Q2_Callback04_ItemPickedUp_6FCD87F0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, (k == 0) ? g_item_hp4 : g_item_hfh, 200u, 0u, 5000u, 5000u, 226u);
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U32(STAGE_QUESTEX0 + 0x10u) = (k == 2) ? 7u : 3u;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCD87F0u, "ACT4Q2_Callback04_ItemPickedUp_6FCD87F0_113c", k,
                 k == 0 ? "other_item_noop" : k == 1 ? "hfh_dec_from_3" : "hfh_dec_from_7",
                 &c, ts, 2, 0u, 0);
  }

  /* [99..100] 2 CheckPlayerNear* distance callbacks (ecx=pGame, edx=pPlayer, s0=pQuestDataEx, ret 4, void) */
  {
    static const struct { uint32_t va; const char *name; uint32_t offPtr; uint32_t offFlag; uint16_t nearDx; uint16_t farDx; } kNear[] = {
      { 0x6FCD8A50u, "ACT4Q1_CheckPlayerNearIzualCallback_6FCD8A50_113c", 0x14u, 0x18u, 2u, 20u },
      { 0x6FCE1A40u, "ACT2Q4_CheckPlayerNearHorazonTomeCallback_6FCE1A40_113c", 0x40u, 0x44u, 5u, 25u },
    };
    for (size_t i = 0; i < sizeof(kNear) / sizeof(kNear[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
        uint16_t dx = (k == 0) ? kNear[i].farDx : (k == 1 ? kNear[i].nearDx : 0u);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, (uint16_t)(5000u + dx), 5000u, 227u + (uint32_t)i);
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 256u, 2u, 1u, 5000u, 5000u, 229u + (uint32_t)i);
        U32(STAGE_QUESTEX0 + kNear[i].offPtr) = STAGE_UNIT1;
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
        c.nargs = 1; c.args[0] = STAGE_QUESTEX0; c.calleePop = 4u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_QUESTEX0;
        run_and_emit(kNear[i].va, kNear[i].name, k,
                     k == 0 ? "far_noop" : k == 1 ? "near_set_flag" : "exact_same_tile",
                     &c, ts, 3, 0u, 0);
      }
    }
  }

  /* [101] 0x6FCD8CC0 ACT4Q2_Callback14_PlayerJoined_6FCD8CC0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 231u);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, (k == 1) ? g_item_hp4 : g_item_hfh, 201u, 0u, 5000u, 5000u, 232u);
      fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
    }
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U32(STAGE_QUESTEX0 + 0x10u) = 2u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCD8CC0u, "ACT4Q2_Callback14_PlayerJoined_6FCD8CC0_113c", k,
                 k == 0 ? "no_inv" : k == 1 ? "other_item" : "has_hfh_inc",
                 &c, ts, 2, 0u, 0);
  }

  /* [102] 0x6FCE29C0 ACT2Q6_ClearQuest10State9ForPlayer_6FCE29C0_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 233u);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    attach_quest_bits(STAGE_UDATA0, (k == 2) ? 1u : 0u, STAGE_QBITS0);
    if (k >= 1) set_quest_bit(STAGE_QBITS0, 0x0Au, 9u);
    if (k == 2) set_quest_bit(STAGE_QBITS0, 0x0Au, 0u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE29C0u, "ACT2Q6_ClearQuest10State9ForPlayer_6FCE29C0_113c", k,
                 k == 0 ? "already_clear" : k == 1 ? "clear_norm" : "clear_nm_keep_bit0",
                 &c, ts, 2, 0u, 0);
  }

  /* [103] 0x6FD041A0 ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 234u);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_g33, 202u, 0u, 5000u, 5000u, 235u);
      fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
    }
    U32(STAGE_QUEST0 + 0x18u)   = STAGE_QUESTEX0;
    U32(STAGE_QUESTEX0 + 0x1Cu) = (k == 2) ? 1u : 0u; /* k=1 -> becomes 1 & clears +0x20; k=2 -> becomes 2 */
    U8(STAGE_QUESTEX0 + 0x20u)  = 1u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD041A0u, "ACT3Q2_OnPlayerEnteredCheckGidbinn_6FD041A0_113c", k,
                 k == 0 ? "no_gidbinn" : k == 1 ? "first_clears_spawn" : "second_keeps_spawn",
                 &c, ts, 2, 0u, 0);
  }

  /* [104] 0x6FD02D00 ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, (k == 0) ? g_item_hp4 : g_item_g33, 203u, 0u, 5000u, 5000u, 236u);
    U32(STAGE_QUEST0 + 0x18u)   = STAGE_QUESTEX0;
    U8(STAGE_QUEST0 + 0x09u)    = 1u;
    U8(STAGE_QUEST0 + 0x0Cu)    = (k == 2) ? 5u : 2u;
    U8(STAGE_QUESTEX0 + 0x00u)  = 1u;
    U32(STAGE_QUESTEX0 + 0x1Cu) = (k == 1) ? 2u : 1u;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT1;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FD02D00u, "ACT3Q2_OnGidbinnItemRemoved_6FD02D00_113c", k,
                 k == 0 ? "other_item" : k == 1 ? "count_2_to_1" : k == 2 ? "seq5_no_respawn" : "zero_reenable_spawn",
                 &c, ts, 2, 0u, 0);
  }

  /* [105] 0x6FCD9BC0 ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 237u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    attach_quest_bits(STAGE_UDATA0, (k == 2) ? 1u : 0u, STAGE_QBITS0);
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x1Au, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCD9BC0u, "ACT4Q3_SyncDiabloQuestStateCallback_6FCD9BC0_113c", k,
                 k == 0 ? "already_complete" : k == 1 ? "sync_norm" : "sync_nm",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [106..107] 2 pure SetState0E callbacks without 0x5D (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  {
    static const struct { uint32_t va; const char *name; uint32_t qFlag; } kSet0E[] = {
      { 0x6FD05230u, "ACT3Q6_SetGidbinnState0ECallback113c", 0x11u },
      { 0x6FCE3510u, "ACT2Q4_UnitIterateSetQuest12State14_6FCE3510_113c", 0x0Cu },
    };
    for (size_t i = 0; i < sizeof(kSet0E) / sizeof(kSet0E[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 238u + (uint32_t)i);
        attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
        if (k == 0) set_quest_bit(STAGE_QBITS0, kSet0E[i].qFlag, 0u);
        if (k == 1) set_quest_bit(STAGE_QBITS0, kSet0E[i].qFlag, 1u);
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
        c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
        run_and_emit(kSet0E[i].va, kSet0E[i].name, k,
                     k == 0 ? "bit0_skip" : k == 1 ? "bit1_skip" : "set_bit0e",
                     &c, ts, 3, 0xFFFFFFFFu, 0);
      }
    }
  }

  /* [108] 0x6FD05080 ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 240u);
    stage_quest_node(STAGE_QUEST0, 0x0Fu, STAGE_QUESTEX0, 0u);
    if (k >= 1) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, (k == 1) ? g_item_hp4 : g_item_bbb, 204u, 0u, 5000u, 5000u, 241u);
      fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD05080u, "ACT3Q4_CheckPlayerHasLamEsensTome_6FD05080_113c", k,
                 k == 0 ? "no_inv" : k == 1 ? "other_item" : "has_tome_set_flag",
                 &c, ts, 3, 0u, 0);
  }

  /* [109] 0x6FCE3EF0 ACT2Q2_UnitIterateCountPlayersMissingCube_6FCE3EF0_113c (ecx=pGame, edx=pUnit, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 242u);
    if (k >= 1) stage_quest_node(STAGE_QUEST0, 9u, STAGE_QUESTEX0, 0u);
    if (k == 2) {
      void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_box, 205u, 0u, 5000u, 5000u, 243u);
      fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE3EF0u, "ACT2Q2_UnitIterateCountPlayersMissingCube_6FCE3EF0_113c", k,
                 k == 0 ? "no_quest_ctrl" : k == 1 ? "missing_cube_inc" : "has_cube_noop",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [110] 0x6FD06420 ACT3Q3_SendKhalimsWillQuestAlertCallback_6FD06420_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 244u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x08u)  = 2u; /* Act 3 */
    U8(STAGE_QUEST0 + 0x0Bu)  = 3u;
    U8(STAGE_QUEST0 + 0x0Cu)  = 2u;
    U8(STAGE_QUEST0 + 0x0Du)  = 5u;
    U8(STAGE_QUEST0 + 0x14u)  = 4u;
    U32(STAGE_QUEST0 + 0xE0u) = 0x12u;
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x12u, 0u);
    if (k == 1) set_quest_bit(STAGE_QBITS0, 0x12u, 0x0Fu);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD06420u, "ACT3Q3_SendKhalimsWillQuestAlertCallback_6FD06420_113c", k,
                 k == 0 ? "bit0_skip" : k == 1 ? "bitf_skip" : "eligible_send5d",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [111] 0x6FCD8FE0 ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c (ecx=pQuest, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 245u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    U32(STAGE_GAME + 0x70u) = (k == 0) ? 0u : 1u;
    if (k >= 1) set_quest_bit(STAGE_QBITS0, 0x1Au, 9u);
    if (k == 2) set_quest_bit(STAGE_QBITS0, 0x1Cu, 0u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCD8FE0u, "ACT4Q3_Callback14_ClearState09IfAct5Incomplete_6FCD8FE0_113c", k,
                 k == 0 ? "classic_noop" : k == 1 ? "exp_clear_9" : k == 2 ? "act5_started_keep_9" : "exp_clear_9_alt",
                 &c, ts, 2, 0u, 0);
  }

  /* [112] 0x6FCE2150 ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c (eax=nAct, ecx=pGame, ret 0, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_ACT1 + 0x04u) = STAGE_SCRATCH + 0x100u;
    U32(STAGE_GAME + 0xC0u) = STAGE_ACT1;
    stage_quest_node(STAGE_QUEST0, 0x0Au, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUESTEX0 + 0x03u) = (k == 1) ? 0u : 1u;
    uint32_t actNo = (k == 0) ? 0u : 1u;
    c.eax = actNo; c.ecx = STAGE_GAME;
    ts[0] = actNo; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCE2150u, "ACT2Q3_InitAct2EclipseIfActive_6FCE2150_113c", k,
                 k == 0 ? "not_act1" : k == 1 ? "flag_zero" : "init_eclipse",
                 &c, ts, 2, 0u, 0);
  }

  /* [113] 0x6FD06470 ACT3Q4_GrantPlayerStatPointsReward_6FD06470_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 246u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 4, (k == 2) ? 10 : 2, 0);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    if (k >= 1) set_quest_bit(STAGE_QBITS0, 0x11u, 1u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FD06470u, "ACT3Q4_GrantPlayerStatPointsReward_6FD06470_113c", k,
                 k == 0 ? "bit1_clear_noop" : k == 1 ? "grant_plus5_from2" : "grant_plus5_from10",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [114..120] 7 UnitIterateSetCompletionState / Sync callbacks (2-bit check + set 0x0E + 0x5D via 0x6FC54AA0) */
  {
    static const struct { uint32_t va; const char *name; uint32_t qFlag; uint32_t bit1; uint32_t lvl; } kSync2[] = {
      { 0x6FCE4D90u, "ACT2Q5_UnitIterateSetCompletionState_6FCE4D90_113c", 0x0Du, 1u, 40u },
      { 0x6FCE5260u, "ACT2Q3_UnitIterateSetCompletionState_6FCE5260_113c", 0x0Bu, 1u, 40u },
      { 0x6FCE5560u, "ACT2Q1_UnitIterateSetCompletionState_6FCE5560_113c", 0x09u, 1u, 40u },
      { 0x6FD05B10u, "ACT3Q6_UpdatePlayerQuestState0E_6FD05B10_113c", 0x16u, 0x0Bu, 75u },
      { 0x6FD05CD0u, "ACT3Q5_UpdatePlayerQuestState0E_6FD05CD0_113c", 0x15u, 4u, 75u },
      { 0x6FCD9920u, "ACT4Q2_SyncHellforgeQuestStateCallback_6FCD9920_113c", 0x1Bu, 1u, 103u },
      { 0x6FCD9CD0u, "ACT4Q1_SyncIzualQuestStateCallback_6FCD9CD0_113c", 0x19u, 1u, 103u },
    };
    for (size_t i = 0; i < sizeof(kSync2) / sizeof(kSync2[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, kSync2[i].lvl);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 250u + (uint32_t)i);
        link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
        attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
        if (k == 0) set_quest_bit(STAGE_QBITS0, kSync2[i].qFlag, 0u);
        if (k == 1) set_quest_bit(STAGE_QBITS0, kSync2[i].qFlag, kSync2[i].bit1);
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
        c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
        run_and_emit(kSync2[i].va, kSync2[i].name, k,
                     k == 0 ? "bit0_skip" : k == 1 ? "bit2nd_skip" : "set0e_send5d",
                     &c, ts, 3, 0xFFFFFFFFu, 0);
      }
    }
  }

  /* [121] 0x6FCDA010 ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c (ecx=pGame, edx=pPlayer, s0=0, ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1) ? 1u : 103u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 260u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 0x17u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x1Cu) = 3u;
    U32(STAGE_GAME + 0x70u) = (k == 2) ? 0u : 1u; /* k=2 Classic, k=3 Expansion */
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x1Au, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCDA010u, "ACT4Q3_CompleteQuestIfPlayerInAct4_6FCDA010_113c", k,
                 k == 0 ? "already_done" : k == 1 ? "act1_skip" : k == 2 ? "act4_classic_complete" : "act4_exp_complete",
                 &c, ts, 3, 0u, 0);
  }

  /* [122] 0x6FCE2DC0 ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c (ecx=pQuestData, edx=pQuestArg, ret 0, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 261u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    U32(STAGE_QUEST0 + 0xE0u) = 0x0Du;
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x0Du, 0u);
    if (k == 1) set_quest_bit(STAGE_QBITS0, 0x0Du, 0x0Fu);
    if (k == 3) set_quest_bit(STAGE_QBITS0, 0x0Du, 2u);
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FCE2DC0u, "ACT2Q5_Callback13_UpdateStartedState_6FCE2DC0_113c", k,
                 k == 0 ? "bit0_skip" : k == 1 ? "bitf_skip" : k == 2 ? "bit2_clear_noop" : "bit2_set_update",
                 &c, ts, 2, 0u, 0);
  }

  /* [123..125] 3 Khalim missing-item counters (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  {
    uint32_t khalimItems[3] = { g_item_qhr, g_item_qbr, g_item_qey };
    static const struct { uint32_t va; const char *name; } kKhalim[] = {
      { 0x6FD047D0u, "ACT3Q3_CountPlayerMissingKhalimHeart_6FD047D0_113c" },
      { 0x6FD04830u, "ACT3Q3_CountPlayerMissingKhalimBrain_6FD04830_113c" },
      { 0x6FD04890u, "ACT3Q3_CountPlayerMissingKhalimEye_6FD04890_113c" },
    };
    for (size_t i = 0; i < 3; i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 262u + (uint32_t)i);
        stage_quest_node(STAGE_QUEST0, 0x10u, STAGE_QUESTEX0, 0u);
        U32(STAGE_QUESTEX0 + 0x0Cu) = 2u;
        if (k >= 1) {
          void *pInv = fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
          U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)pInv;
          uint32_t itemCls = (k == 1) ? khalimItems[i] : g_item_qf2;
          stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, itemCls, 210u + (uint32_t)i, 0u, 5000u, 5000u, 266u + (uint32_t)i);
          fn_SetCursorItem(pInv, (void *)(uintptr_t)STAGE_UNIT1);
        }
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
        c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
        run_and_emit(kKhalim[i].va, kKhalim[i].name, k,
                     k == 0 ? "missing_inc" : k == 1 ? "has_organ_noop" : "has_flail_noop",
                     &c, ts, 3, 0xFFFFFFFFu, 0);
      }
    }
  }

  /* [126] 0x6FCE4170 ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c (eax=pPlayer, s0=pGame, ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 270u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    if (k == 1) { set_quest_bit(STAGE_QBITS0, 0x0Au, 0u); }
    if (k == 2) { set_quest_bit(STAGE_QBITS0, 0x0Au, 0u); set_quest_bit(STAGE_QBITS0, 0x0Au, 0x0Du); }
    if (k == 3) { set_quest_bit(STAGE_QBITS0, 0x0Au, 0x0Fu); set_quest_bit(STAGE_QBITS0, 0x0Au, 0x0Eu); }
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCE4170u, "ACT2Q2_CanPlayerReceiveViperAmulet_6FCE4170_113c", k,
                 k == 0 ? "incomplete_ret1" : k == 1 ? "complete_ret0" : k == 2 ? "bitd_ret1" : "bite_ret1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [127] 0x6FCE4BD0 ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c (ecx=pGame, edx=pUnit, s0=0, ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 271u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x0Eu, 0u);
    if (k == 1) set_quest_bit(STAGE_QBITS0, 0x0Eu, 3u);
    if (k == 2) set_quest_bit(STAGE_QBITS0, 0x0Eu, 4u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE4BD0u, "ACT2Q6_UnitIterateSetCompletionState_6FCE4BD0_113c", k,
                 k == 0 ? "bit0_skip" : k == 1 ? "bit3_skip" : k == 2 ? "bit4_skip" : "set0e_send5d",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [128] 0x6FCE2A90 ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c (ecx=pGame, edx=pUnit, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 272u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 0x0Du, STAGE_QUESTEX0, 0u);
    U8(STAGE_QUEST0 + 0x0Cu) = (k == 1) ? 1u : 2u;
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x0Eu, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE2A90u, "ACT2Q6_UnitIterateSetQuest14State2_6FCE2A90_113c", k,
                 k == 0 ? "bit0_skip" : k == 1 ? "seq1_skip" : "seq2_set_bit2",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [129] 0x6FCE3FC0 ACT2Q2_UnitIterateCountEligibleAmuletPlayers_6FCE3FC0_113c (ecx=pGame, edx=pUnit, s0=0, ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 273u);
    attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
    stage_quest_node(STAGE_QUEST0, 9u, STAGE_QUESTEX0, 0u);
    U32(STAGE_QUESTEX0 + 0x14u) = 4u;
    if (k == 0) set_quest_bit(STAGE_QBITS0, 0x0Au, 0u);
    if (k == 1) set_quest_bit(STAGE_QBITS0, 0x0Au, 3u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FCE3FC0u, "ACT2Q2_UnitIterateCountEligibleAmuletPlayers_6FCE3FC0_113c", k,
                 k == 0 ? "bit0_skip" : k == 1 ? "bit3_skip" : "eligible_inc",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Batch 3: 21 Final Hi-VA Functions (Total = 150 VAs) */

static void emit_batch3_vas(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [130..141] 12 SendQuestAlertIfEligible callbacks (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  {
    static const struct { uint32_t va; const char *name; uint32_t qFlag; uint32_t alertQ; uint32_t lvl; uint8_t act; } kAlert[] = {
      { 0x6FD05BE0u, "ACT3Q7_SendMephistoQuestAlertCallback_6FD05BE0_113c", 0x16u, 0x14u, 75u, 2u },
      { 0x6FD05D20u, "ACT3Q5_SendTravincalQuestAlertCallback_6FD05D20_113c", 0x15u, 0x13u, 75u, 2u },
      { 0x6FD06130u, "ACT3Q2_SendGidbinnQuestAlertCallback_6FD06130_113c", 0x13u, 0x11u, 75u, 2u },
      { 0x6FD06550u, "ACT3Q4_SendLamEsensTomeQuestAlertCallback_6FD06550_113c", 0x11u, 0x0Fu, 75u, 2u },
      { 0x6FCD9970u, "ACT4Q2_SendQuestAlertIfEligible_6FCD9970_113c", 0x1Bu, 0x18u, 103u, 3u },
      { 0x6FCD99D0u, "ACT4Q3_SendQuestAlertIfEligible_6FCD99D0_113c", 0x1Au, 0x17u, 103u, 3u },
      { 0x6FCD9D20u, "ACT4Q1_SendQuestAlertIfEligible_6FCD9D20_113c", 0x19u, 0x16u, 103u, 3u },
      { 0x6FCE4D30u, "ACT2Q6_SendAlert0DIfQuest14Active_6FCE4D30_113c", 0x0Eu, 0x0Du, 40u, 1u },
      { 0x6FCE4E30u, "ACT2Q5_SendAlert0CIfQuest13Active_6FCE4E30_113c", 0x0Du, 0x0Cu, 40u, 1u },
      { 0x6FCE5030u, "ACT2Q4_SendAlert0BIfQuest12Active_6FCE5030_113c", 0x0Cu, 0x0Bu, 40u, 1u },
      { 0x6FCE52B0u, "ACT2Q3_SendAlert0AIfQuest11Active_6FCE52B0_113c", 0x0Bu, 0x0Au, 40u, 1u },
      { 0x6FCE5630u, "ACT2Q1_SendAlert08IfQuest9Active_6FCE5630_113c", 0x09u, 0x08u, 40u, 1u },
    };
    for (size_t i = 0; i < sizeof(kAlert) / sizeof(kAlert[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, kAlert[i].lvl);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 280u + (uint32_t)i);
        link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
        attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
        stage_quest_node(STAGE_QUEST0, kAlert[i].alertQ, STAGE_QUESTEX0, 0u);
        U8(STAGE_QUEST0 + 0x08u)  = kAlert[i].act;
        U8(STAGE_QUEST0 + 0x0Bu)  = 3u;
        U8(STAGE_QUEST0 + 0x0Cu)  = 2u;
        U8(STAGE_QUEST0 + 0x0Du)  = 5u;
        U8(STAGE_QUEST0 + 0x14u)  = 4u;
        U32(STAGE_QUEST0 + 0xE0u) = kAlert[i].qFlag;
        if (k == 0) {
          set_quest_bit(STAGE_QBITS0, kAlert[i].qFlag, 0u); /* completed -> no alert */
        } else if (k == 2) {
          set_quest_bit(STAGE_QBITS0, kAlert[i].qFlag, 0u);
          set_quest_bit(STAGE_QBITS0, kAlert[i].qFlag, 0x0Eu); /* newly completed -> alert status 0x0C */
        }
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
        c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
        run_and_emit(kAlert[i].va, kAlert[i].name, k,
                     k == 0 ? "completed_noop" : k == 1 ? "incomplete_send_st03" : "bite_send_st0c",
                     &c, ts, 3, 0xFFFFFFFFu, 0);
      }
    }
  }

  /* [142] 0x6FD04A50 ACT3Q7_SendQuestUpdatePacket5D_113c (eax=pQuest, edx=nSubState, s0=pQuestArg, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 75u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 295u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    U8(STAGE_QUEST0 + 0x14u) = 0x06u;
    U32(STAGE_QUESTARG + 0x0Cu) = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t sub = (k == 1) ? 0x03u : 0x07u;
    c.eax = STAGE_QUEST0; c.edx = sub;
    c.nargs = 1; c.args[0] = STAGE_QUESTARG; c.calleePop = 4u;
    ts[0] = STAGE_QUEST0; ts[1] = sub; ts[2] = STAGE_QUESTARG;
    run_and_emit(0x6FD04A50u, "ACT3Q7_SendQuestUpdatePacket5D_113c", k,
                 k == 0 ? "null_player_noop" : k == 1 ? "send_sub3" : "send_sub7",
                 &c, ts, 3, 0u, 0);
  }

  /* [143..146] 4 NotifyPlayerState0D callbacks (ecx=pGame, edx=pPlayer, s0=0, ret 4, u32) */
  {
    static const struct { uint32_t va; const char *name; uint32_t qFlag; uint32_t lvl; } kNotify[] = {
      { 0x6FD03320u, "ACT3Q7_NotifyPlayerMephistoState0DCallback_6FD03320_113c", 0x16u, 75u },
      { 0x6FD03760u, "ACT3Q5_NotifyPlayerTravincalState0DCallback_6FD03760_113c", 0x15u, 75u },
      { 0x6FCD9C60u, "ACT4Q1_BroadcastIzualQuestChatCallback_6FCD9C60_113c", 0x19u, 103u },
      { 0x6FCE4CC0u, "ACT2Q6_RefreshPlayerActTransitionOnDurielComplete_6FCE4CC0_113c", 0x0Eu, 40u },
    };
    for (size_t i = 0; i < sizeof(kNotify) / sizeof(kNotify[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, kNotify[i].lvl);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 300u + (uint32_t)i);
        U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
        attach_quest_bits(STAGE_UDATA0, (k == 2) ? 1u : 0u, STAGE_QBITS0);
        if (k >= 1) set_quest_bit(STAGE_QBITS0, kNotify[i].qFlag, 0x0Du);
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
        c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
        run_and_emit(kNotify[i].va, kNotify[i].name, k,
                     k == 0 ? "bitd_clear_noop" : k == 1 ? "notify_norm" : "notify_nm",
                     &c, ts, 3, 0xFFFFFFFFu, 0);
      }
    }
  }

  /* [147..148] 2 PlayerEnterSyncIntroState callbacks (ecx=pQuestData, edx=pQuestArg, ret 0, void; asserts 0x820) */
  {
    static const struct { uint32_t va; const char *name; uint32_t qFlag; } kSyncIntro[] = {
      { 0x6FCE44E0u, "ACT2Q0_Callback_PlayerEnterSyncWarrivIntroState_6FCE44E0_113c", 8u },
      { 0x6FD05450u, "ACT3Q0_SyncHratliIntroQuestFromPlayer_6FD05450_113c", 0x10u },
    };
    for (size_t i = 0; i < sizeof(kSyncIntro) / sizeof(kSyncIntro[0]); i++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 310u + (uint32_t)i);
        attach_quest_bits(STAGE_UDATA0, 0u, STAGE_QBITS0);
        U32(STAGE_QBITS1 + 0x00u) = STAGE_QBITS1 + 0x10u;
        U32(STAGE_QBITS1 + 0x04u) = 0x60u;
        U32(STAGE_QUESTCTRL + 0x08u) = (k == 2) ? 1u : 0u;
        U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS1;
        U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
        U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
        U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
        U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
        if (k >= 1) set_quest_bit(STAGE_QBITS0, kSyncIntro[i].qFlag, 0u);
        c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
        ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
        run_and_emit(kSyncIntro[i].va, kSyncIntro[i].name, k,
                     k == 0 ? "bit0_clear_noop" : k == 1 ? "assert_no_global_flags" : "sync_global_bit0d",
                     &c, ts, 2, 0u, k == 1);
      }
    }
  }

  /* [149] 0x6FCD6720 SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c (eax=pGame, ebx=pUnit, ret 0, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue(STAGE_GAME);
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 250u : 100u;
    uint32_t uType = (k == 0) ? 0u : 1u;
    uint32_t cls   = (k == 0) ? 1u : (k == 1 ? g_mon_subm : 19u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, cls, 10u, 1u, 5000u, 5000u, 315u);
    c.eax = STAGE_GAME; c.ebx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCD6720u, "SKILLS_ScheduleUnitTimerEventType1_6FCD6720_113c", k,
                 k == 0 ? "player_default11" : k == 1 ? "mon_submerge_frames" : "mon_frame250",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [150] 0x6FCF3450 ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c (esi=pItem, edi=pUnit, s0=nDelta, ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pUnit = (k == 2) ? STAGE_UNIT1 : STAGE_UNIT0;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 316u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 19u, 2u, 1u, 5002u, 5002u, 317u);
    link_player_client(STAGE_UNIT0, STAGE_UDATA0, STAGE_CLIENT0, 1u, 0u);
    uint32_t itemCls = (k == 0) ? g_item_hp4 : (k == 1 ? g_item_tbk : g_item_hp1);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, itemCls, 300u, 0u, 5000u, 5000u, 318u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 0x46, 10, 0);
    int32_t delta = (k == 0) ? 3 : (k == 1 ? 5 : -2);
    c.esi = STAGE_UNIT2; c.edi = pUnit;
    c.nargs = 1; c.args[0] = (uint32_t)delta; c.calleePop = 4u;
    ts[0] = STAGE_UNIT2; ts[1] = pUnit; ts[2] = delta;
    run_and_emit(0x6FCF3450u, "ITEMS_AddBookQuantityAndSync3EAnd22_6FCF3450_113c", k,
                 k == 0 ? "hp4_player_add3" : k == 1 ? "tbk_no_skill_add5" : "hp1_mon_sub2",
                 &c, ts, 3, 0u, 0);
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-w6-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-w6] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
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
    fprintf(stderr, "[k6-w6] LoadLibraryA failed\n");
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-w6] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-w6] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-w6] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_batch1_vas();
  emit_batch2_vas();
  emit_batch3_vas();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-w6] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
