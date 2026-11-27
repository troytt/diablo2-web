/*
 * k6-w13-d2game-emitter.c — Milestone #37 [K6] Wave 13 Real-DLL Differential Emitter (Lo-VA Part 4)
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables (0x20000000..0x206F7FFF + D2Common .data/.bss)
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert) and Fog.#10042..10047
 * (deterministic bump allocator), and executes net-new real D2Game.dll functions
 * strictly inside 0x6FC20000..0x6FCBFFFF (>= 3 non-degenerate cases per VA).
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
#define STAGE_FIXED_SIZE  0x00009000u
#define STAGE_SETUP_BASE  0x30020000u
#define STAGE_TOTAL_SIZE  0x00040000u

#define HEAP_BASE         0x40000000u
#define HEAP_SIZE         0x00200000u

/* Fixed staged object addresses inside 0x30000000..0x30008FFF */
#define STAGE_GAME        (STAGE_BASE + 0x0000u) /* 0x2000: D2GameStrc */
#define STAGE_CLIENT      (STAGE_BASE + 0x2000u) /* 0x0600: D2ClientStrc #0 */
#define STAGE_PKTNODE0    (STAGE_BASE + 0x2600u) /* 0x0210: D2PacketDataStrc #0 */
#define STAGE_PKTNODE1    (STAGE_BASE + 0x2810u) /* 0x0210: D2PacketDataStrc #1 */
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
#define STAGE_QUESTARG    (STAGE_BASE + 0x6600u) /* 0x0100: D2QuestArgStrc */
#define STAGE_QBITS0      (STAGE_BASE + 0x6700u) /* 0x0100: quest bit record + buffer */
#define STAGE_PETCTRL     (STAGE_BASE + 0x6800u) /* 0x0200: pPlayerPets + buckets/nodes */
#define STAGE_PARTYCTRL   (STAGE_BASE + 0x6A00u) /* 0x0200: pPartyControl + nodes */
#define STAGE_NPCCTRL     (STAGE_BASE + 0x6C00u) /* 0x1200: pNpcControl + 64*0x44 array */
#define STAGE_QBITS1      (STAGE_BASE + 0x7E00u) /* 0x0200: secondary quest/intro bit buffers */
#define STAGE_SCRATCH     (STAGE_BASE + 0x8000u) /* 0x1000: out-params / packets / ctx */

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

/* D2Common helper function pointers (resolved via ordinal on g_hCom) */
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
typedef int32_t(__stdcall *Com_HasObjectSubClassBit0_t)(void *pUnit);
typedef int32_t(__stdcall *Com_CheckCompactSave_t)(int32_t itemClassId);
typedef int32_t(__stdcall *Com_GetItemType_t)(void *pUnit);

static Com_CreateStatListEx_t      fn_CreateStatListEx      = NULL;
static Com_SetUnitStat_t           fn_SetUnitStat           = NULL;
static Com_AllocStatList_t         fn_AllocStatList         = NULL;
static Com_SetStatIfValid_t        fn_SetStatIfValid        = NULL;
static Com_SetStatListState_t      fn_SetStatListState      = NULL;
static Com_MergeStatLists_t        fn_MergeStatLists        = NULL;
static Com_ToggleGfxState_t        fn_ToggleGfxState        = NULL;
static Com_AllocSkillList_t        fn_AllocSkillList        = NULL;
static Com_SetSkillLevel_t         fn_SetSkillLevel         = NULL;
static Com_AllocInventory_t        fn_AllocInventory        = NULL;
static Com_SetCursorItem_t         fn_SetCursorItem         = NULL;
static Com_PlaceItemInBodyLoc_t    fn_PlaceItemInBodyLoc    = NULL;
static Com_CheckItemTypeId_t       fn_CheckItemTypeId       = NULL;
static Com_UnitsIsDoor_t           fn_UnitsIsDoor           = NULL;
static Com_HasObjectSubClassBit0_t fn_HasObjectSubClassBit0 = NULL;
static Com_CheckCompactSave_t      fn_CheckCompactSave      = NULL;
static Com_GetItemType_t           fn_GetItemType           = NULL;

/* Discovered real v1.13c item IDs */
static uint32_t g_item_ring   = 0;
static uint32_t g_item_malus  = 0; /* "hdm " Horadric Malus */
static uint32_t g_item_potion = 0; /* "ice " Malah's Potion */
static uint32_t g_item_sword  = 0; /* "ssd " Short Sword */
static uint32_t g_item_armor  = 0; /* "cap " Cap */
static uint32_t g_item_gold   = 0; /* "gld " Gold */
static uint32_t g_item_ear    = 0; /* "ear " Ear */
static uint32_t g_item_tome   = 0; /* "tbk " Tome of Town Portal */
static uint32_t g_item_scroll = 0; /* "tsc " Scroll of Town Portal */
static uint32_t g_item_charm  = 0; /* "cm1 " Small Charm */
static uint32_t g_item_throw  = 0; /* "jav " Javelin */
static uint32_t g_item_wand   = 0; /* "wnd " Wand */
static uint32_t g_item_bkd    = 0; /* "bkd " Scroll of Inifuss */
static uint32_t g_item_trs    = 0; /* "trs " Horadric Scroll */
static uint32_t g_item_gem    = 0; /* Chipped gem (type 0x14, upgrade != "non ") */
static uint32_t g_obj_well    = 0; /* Well object with parm0 > 0 and heal flags */
static uint32_t g_obj_chest   = 0; /* Chest object with byte +0x121 == 0 and animlen > 0 */
static uint32_t g_obj_chest1  = 0; /* Chest object with byte +0x121 != 0 and animlen > 0 */
static uint32_t g_obj_sel     = 0; /* Object with +0x141 != 0 and selectable mode 1 */

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
              "[k6-w13] SETUP/INIT FAULT after %u emitted: code=0x%08lX eip=%p (game=0x%08lX com=0x%08lX) addr=0x%08X\n",
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

#define MAX_TRACKED_ALLOCS 512
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
      fprintf(stderr, "[k6-w13] setup bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 21);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_setup_top = p + dwSize;
    record_alloc_size(p, dwSize);
    return (void *)(uintptr_t)p;
  } else {
    uint32_t p = (g_heap_top + 3u) & ~3u;
    if (p + dwSize > HEAP_BASE + HEAP_SIZE) {
      fprintf(stderr, "[k6-w13] heap bump overflow (size=%u)\n", dwSize);
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
      fprintf(stderr, "[k6-w13] missing Fog.#%u\n", hooks[i].ord);
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
    fprintf(stderr, "[k6-w13] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-w13] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(0x6FDE9000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-w13] short read at page %u\n", i);
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

static char g_pre_json[131072];

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
      fprintf(stderr, "[k6-w13] JSON buffer overflow\n");
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
  U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
  U32(STAGE_CLIENT + 0x1A8u)   = STAGE_GAME;
}

static uint32_t stage_timer_queue(void) {
  uint32_t pTimer = (uint32_t)(uintptr_t)bump_alloc(0xA20u);
  uint32_t pChunk = (uint32_t)(uintptr_t)bump_alloc(0x7088u);
  for (uint32_t i = 0; i < 24u; i++) {
    U32(pChunk + i * 0x30u + 0x1Cu) = pChunk + (i + 1u) * 0x30u;
  }
  U32(pChunk + 0x7080u) = pChunk;
  U32(pTimer + 0xA1Cu)  = pChunk;
  U32(STAGE_GAME + 0xB8u) = pTimer;
  return pTimer;
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
    uint32_t pObjectsBase = U32(0x6FDF0B94u + g_com_rebase);
    uint32_t nObjectsCnt  = U32(0x6FDF0B98u + g_com_rebase);
    if (classId < nObjectsCnt) {
      U32(pUData + 0x00u) = pObjectsBase + classId * 0x1C0u;
    }
  }
  fn_CreateStatListEx((void *)(uintptr_t)pUnit, 0u, NULL, (void *)(uintptr_t)STAGE_GAME);
}

static void attach_inv_item_raw(uint32_t pUnit, uint32_t pItem, uint8_t invPage, uint8_t bodyLoc, uint8_t nodePosOther) {
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
  U32(pInv + 0x14u) = U32(pInv + 0x14u) + 1u;
}

static void stage_player_qbits(uint32_t pUData, uint32_t pRecBase, uint32_t diffIdx) {
  U32(pRecBase + 0x00u) = pRecBase + 0x10u;
  U32(pRecBase + 0x04u) = 0x60u;
  U32(pUData + 0x10u + diffIdx * 4u) = pRecBase;
}

static void set_qbit(uint32_t pRecBase, uint32_t questIdx, uint32_t bitIdx) {
  uint32_t absBit = questIdx * 16u + bitIdx;
  uint32_t byteAddr = (pRecBase + 0x10u) + (absBit >> 3);
  U8(byteAddr) = (uint8_t)(U8(byteAddr) | (1u << (absBit & 7u)));
}

static void stage_quest_node(uint32_t questId, uint8_t bActive, uint8_t bState) {
  U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
  U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
  U32(STAGE_QUEST0 + 0x00u)    = questId;
  U32(STAGE_QUEST0 + 0x04u)    = STAGE_GAME;
  U8(STAGE_QUEST0 + 0x09u)     = bActive;
  U8(STAGE_QUEST0 + 0x0Cu)     = bState;
  U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
  U32(STAGE_QUEST0 + 0xF4u)    = 0u;
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

static uint32_t rebase_game_va(uint32_t canonVa) {
  return canonVa ? (uint32_t)((canonVa - D2GAME_PREF_BASE) + (uintptr_t)g_hGame) : 0u;
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
  static char postJson[131072];
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
            "[k6-w13] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-w13] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-w13] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-w13] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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
    if (!g_item_malus  && code == 0x206D6468u) g_item_malus  = id; /* "hdm " */
    if (!g_item_potion && code == 0x20656369u) g_item_potion = id; /* "ice " */
    if (!g_item_sword  && code == 0x20647373u) g_item_sword  = id; /* "ssd " */
    if (!g_item_armor  && code == 0x20706163u) g_item_armor  = id; /* "cap " */
    if (!g_item_gold   && code == 0x20646C67u) g_item_gold   = id; /* "gld " */
    if (!g_item_ear    && code == 0x20726165u) g_item_ear    = id; /* "ear " */
    if (!g_item_tome   && code == 0x206B6274u) g_item_tome   = id; /* "tbk " */
    if (!g_item_scroll && code == 0x20637374u) g_item_scroll = id; /* "tsc " */
    if (!g_item_charm  && code == 0x20316D63u) g_item_charm  = id; /* "cm1 " */
    if (!g_item_throw  && code == 0x2076616Au) g_item_throw  = id; /* "jav " */
    if (!g_item_wand   && code == 0x20646E77u) g_item_wand   = id; /* "wnd " */
    if (!g_item_bkd    && code == 0x20646B62u) g_item_bkd    = id; /* "bkd " */
    if (!g_item_trs    && code == 0x20737274u) g_item_trs    = id; /* "trs " */
    if (!g_item_ring   && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x0A)) g_item_ring = id;
    if (!g_item_gem    && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x14) &&
        U32(pItems + id * 0x1A8u + 0xBCu) != 0x206E6F6Eu) g_item_gem = id;
  }

  uint32_t pObjs = U32(0x6FDF0B94u + g_com_rebase);
  uint32_t nObjs = U32(0x6FDF0B98u + g_com_rebase);
  for (uint32_t id = 1; id < nObjs; id++) {
    uint32_t rec = pObjs + id * 0x1C0u;
    if (!g_obj_well && U32(rec + 0x180u) > 0u && U32(rec + 0x180u) <= 8u &&
        (U32(rec + 0x184u) & 3u) != 0u && U32(rec + 0x178u) > 0u) {
      g_obj_well = id;
    }
    if (!g_obj_chest && U8(rec + 0x121u) == 0u && (U32(rec + 0xDCu) >> 8) > 0u) {
      g_obj_chest = id;
    }
    if (!g_obj_chest1 && U8(rec + 0x121u) != 0u && (U32(rec + 0xDCu) >> 8) > 0u) {
      g_obj_chest1 = id;
    }
    if (!g_obj_sel && U8(rec + 0x141u) != 0u && U8(rec + 0xC5u) != 0u && (U32(rec + 0xDCu) >> 8) > 0u) {
      g_obj_sel = id;
    }
  }
}

/* ------------------------------- Shared Staging Helpers (Skills/Missiles/Rooms) */

static uint32_t stage_used_skill(uint32_t pUnit, int32_t skillId, int32_t lvl) {
  uint32_t pInfo = U32(pUnit + 0xA8u);
  if (pInfo == 0u) {
    pInfo = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(pUnit + 0xA8u) = pInfo;
  }
  fn_SetSkillLevel((void *)(uintptr_t)pUnit, skillId, lvl, 1, 0, 0);
  uint32_t pSkill = U32(pInfo + 0x04u);
  U32(pInfo + 0x10u) = pSkill;
  return pSkill;
}

static void stage_path_target(uint32_t pPath, uint32_t pTarget) {
  U32(pPath + 0x58u) = pTarget;
  U32(pPath + 0x5Cu) = pTarget ? U32(pTarget + 0x00u) : 0u;
  U32(pPath + 0x60u) = pTarget ? U32(pTarget + 0x0Cu) : 0u;
}

static void stage_missile_unit(
    uint32_t pUnit, uint32_t pUData, uint32_t pPath, uint32_t pRoom,
    uint32_t misCls, uint32_t guid, uint16_t x, uint16_t y, uint32_t seedLo,
    int hasOwner, uint32_t ownerType, uint32_t ownerGuid,
    uint16_t skillId, uint16_t skillLvl, uint16_t totalFr, uint16_t remFr, uint32_t targetX) {
  stage_unit_common(pUnit, pUData, pPath, pRoom, 3u, misCls, guid, 0u, x, y, seedLo);
  U16(pUData + 0x0Au) = skillId;
  U16(pUData + 0x0Cu) = skillLvl;
  U16(pUData + 0x0Eu) = totalFr;
  U16(pUData + 0x10u) = remFr;
  U32(pUData + 0x28u) = targetX;
  if (hasOwner) {
    U32(pUnit + 0x94u) = ownerType;
    U32(pUnit + 0x98u) = ownerGuid;
    U32(pUnit + 0xC8u) = (1u << 10);
  }
}

static void stage_room_self_adj(uint32_t pRoom, uint32_t scratchSlot) {
  U32(scratchSlot)   = pRoom;
  U32(pRoom + 0x00u) = scratchSlot;
  U32(pRoom + 0x24u) = 1u;
}

static uint32_t stage_statlist_state(
    uint32_t pTarget, uint32_t flags, int32_t stateId, uint32_t expireFrame, uint32_t skId, uint32_t skLvl) {
  void *pSl = fn_AllocStatList(NULL, flags, expireFrame, (int32_t)U32(pTarget + 0x00u), (int32_t)U32(pTarget + 0x0Cu));
  fn_SetStatListState(pSl, stateId);
  if (skId != 0u) U32((uintptr_t)pSl + 0x1Cu) = skId;
  if (skLvl != 0u) U32((uintptr_t)pSl + 0x20u) = skLvl;
  fn_MergeStatLists((void *)(uintptr_t)pTarget, pSl, 1);
  fn_ToggleGfxState((void *)(uintptr_t)pTarget, stateId, 1);
  return (uint32_t)(uintptr_t)pSl;
}

static void stage_dmg_struct(
    uint32_t addr, uint32_t hitFlags, uint16_t resFlags,
    int32_t phys, int32_t fire, int32_t ltng, int32_t cold) {
  memset((void *)(uintptr_t)addr, 0, 0x70u);
  U32(addr + 0x00u) = hitFlags;
  U16(addr + 0x04u) = resFlags;
  S32(addr + 0x08u) = phys;
  S32(addr + 0x14u) = fire;
  S32(addr + 0x1Cu) = ltng;
  S32(addr + 0x28u) = cold;
}

static void stage_obj_seed(uint32_t seedLo, uint32_t seedHi) {
  uint32_t pObjCtrl = STAGE_SCRATCH + 0x500u;
  U32(pObjCtrl + 0x00u) = seedLo;
  U32(pObjCtrl + 0x04u) = seedHi;
  U32(STAGE_GAME + 0x10F0u) = pObjCtrl;
}

static void stage_op_args(uint32_t addr, uint32_t pGame, uint32_t pObj, uint32_t pPlr, uint32_t pSeed, uint32_t objIdx) {
  U32(addr + 0x00u) = pGame;
  U32(addr + 0x04u) = pObj;
  U32(addr + 0x08u) = pPlr;
  U32(addr + 0x0Cu) = pSeed;
  U32(addr + 0x10u) = objIdx;
}

/* ------------------------------- Batch 1: 52 Quest Lo-VAs */

static void emit_batch_1(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [B1-01] 0x6FC80DA0 ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c (ecx=pObjInit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 27u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x6Cu, 40u, 0u, 5000u, 5000u, 101u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    if (k >= 1) {
      stage_quest_node(5u, (k == 1 ? 0u : 1u), 0u);
    }
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC80DA0u, "ACT1Q5_InitHoradricMalusStandObject_6FC80DA0_113c", k,
                 k == 0 ? "missing_quest5_assert_423" : k == 1 ? "inactive_sets_mode3" : "active_keeps_mode0",
                 &c, ts, 1, 0u, (k == 0 ? 1 : 0));
  }

  /* [B1-02] 0x6FC765B0 ACT5Q5_InitSummitDoorObject_6FC765B0_113c (ecx=pObjInit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 120u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x223u, 41u, 1u, 5000u, 5000u, 102u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    if (k >= 1) {
      stage_quest_node(0x23u, 1u, 0u);
      U8(STAGE_QUESTEX0 + 0x4Au) = (k == 2) ? 1u : 0u;
    }
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC765B0u, "ACT5Q5_InitSummitDoorObject_6FC765B0_113c", k,
                 k == 0 ? "missing_quest23_noop" : k == 1 ? "closed_sets_mode0" : "open_sets_mode2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-03] 0x6FC83CC0 ACT1_InitAkaraIntroQuestDescriptor_6FC83CC0_113c (ecx=pQuest, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0xA4u) = 0xDEADBEEFu;
    U8(pq + 0x0Bu) = 9u;
    U8(pq + 0x0Cu) = 7u;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC83CC0u, "ACT1_InitAkaraIntroQuestDescriptor_6FC83CC0_113c", k,
                 k == 0 ? "init_slot0" : k == 1 ? "init_slot1" : "init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-04] 0x6FC85410 ACT1Q1_SequenceFilter_6FC85410_113c (ecx=pQuestData, ret, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(1u, (k == 1 ? 0u : 1u), (k == 0 ? 2u : 0u));
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC85410u, "ACT1Q1_SequenceFilter_6FC85410_113c", k,
                 k == 0 ? "state2_noop" : k == 1 ? "inactive_noop" : "state0_active_appends_timer",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [B1-05] 0x6FC7A7C0 ACT5Q0_InitQuest2ADescriptor_6FC7A7C0_113c (ecx=pQuest, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0xA8u) = 0xCAFEBABEu;
    U8(pq + 0x0Cu) = 5u;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC7A7C0u, "ACT5Q0_InitQuest2ADescriptor_6FC7A7C0_113c", k,
                 k == 0 ? "init_slot0" : k == 1 ? "init_slot1" : "init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-06] 0x6FC814A0 ACT1Q4_InitCainGibbetObject_6FC814A0_113c (ecx=pObjInit, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 38u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x1Eu, 42u, (k == 1 ? 2u : 0u), 5000u, 5000u, 106u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    if (k >= 2) {
      stage_quest_node(4u, (k == 2 ? 0u : 1u), 0u);
      U32(STAGE_QUESTEX0 + 0x58u) = 3u;
      U8(STAGE_QUESTEX0 + 0x50u) = 0u;
    }
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC814A0u, "ACT1Q4_InitCainGibbetObject_6FC814A0_113c", k,
                 k == 0 ? "no_quest_sets_mode2" : k == 1 ? "no_quest_already_mode2" : k == 2 ? "inactive_forces_mode1" : "active_uses_saved_mode3",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-07] 0x6FC82D90 ACT1Q0_InitQuestDescriptor_6FC82D90_113c (ecx=pQuest, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0xACu) = 0x11223344u;
    U32(pq + 0x18u) = STAGE_QUESTEX0;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC82D90u, "ACT1Q0_InitQuestDescriptor_6FC82D90_113c", k,
                 k == 0 ? "init_slot0" : k == 1 ? "init_slot1" : "init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-08] 0x6FC82FA0 ACT1_InitCainIntroQuestDescriptor_6FC82FA0_113c (ecx=pQuest, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0xB0u) = 0x55667788u;
    U8(pq + 0x0Bu) = 4u;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC82FA0u, "ACT1_InitCainIntroQuestDescriptor_6FC82FA0_113c", k,
                 k == 0 ? "init_slot0" : k == 1 ? "init_slot1" : "init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-09] 0x6FC774A0 ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c (ecx=pObjInit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 120u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x222u, 45u + (uint32_t)k, 0u, 5000u, 5000u, 109u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    if (k >= 1) {
      stage_quest_node(0x23u, 1u, 0u);
      U32(STAGE_QUESTEX0 + 0x4Cu) = (uint32_t)k;
    }
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC774A0u, "ACT5Q5_InitWorldstoneKeepEntranceObject_6FC774A0_113c", k,
                 k == 0 ? "missing_quest23_noop" : k == 1 ? "records_guid_mode1" : "records_guid_mode2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-10] 0x6FC774F0 ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c (eax=pObjInit, edx=pQuestDataEx, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    static const uint32_t clsIds[4] = { 0x1DAu, 0x1DBu, 0x1DCu, 0x10u };
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 120u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, clsIds[k], 50u, 0u, 5000u, 5000u, 110u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_QUESTEX0 + 0x30u) = 1u;
    U32(STAGE_QUESTEX0 + 0x34u) = 2u;
    U32(STAGE_QUESTEX0 + 0x38u) = 3u;
    c.eax = STAGE_SCRATCH; c.edx = STAGE_QUESTEX0;
    ts[0] = STAGE_SCRATCH; ts[1] = STAGE_QUESTEX0;
    run_and_emit(0x6FC774F0u, "ACT5Q5_SyncAncientStatueObjectAnimMode_6FC774F0_113c", k,
                 k == 0 ? "statue_1da_slot1" : k == 1 ? "statue_1db_slot0" : k == 2 ? "statue_1dc_slot2" : "other_class_noop",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-11] 0x6FC56100 QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c (ecx=pOpStrc, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 61u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x95u, 51u, (k == 1 ? 2u : 0u), 5000u, 5000u, 111u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    if (k == 2) {
      stage_quest_node(0x0Au, 1u, 0u);
      U8(STAGE_QUESTEX0 + 0x04u) = 0u;
    }
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC56100u, "QUESTS_OnTaintedSunAltarInitOrFallbackMode2_6FC56100_113c", k,
                 k == 0 ? "no_quest_sets_mode2" : k == 1 ? "no_quest_already_mode2" : "quest0a_delegates",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-12] 0x6FC773D0 ACT5Q5_InitAncientsAltarObject_6FC773D0_113c (ecx=pObjInit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 120u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x222u, 52u, 0u, 5000u, 5000u, 112u);
    stage_quest_node(0x23u, 1u, 0u);
    U8(STAGE_QUESTEX0 + 0x00u)  = (k == 0) ? 1u : 0u;
    U32(STAGE_QUESTEX0 + 0x60u) = (k == 1) ? 2u : 0u;
    U32(STAGE_SCRATCH + 0x00u)  = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u)  = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC773D0u, "ACT5Q5_InitAncientsAltarObject_6FC773D0_113c", k,
                 k == 0 ? "flag0_set_keeps_mode0" : k == 1 ? "flag0_clr_mode2_already" : "flag0_clr_sets_mode1_and_60_2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-13] 0x6FC83D20 ACT1Q3_ActivateQuestState1_6FC83D20_113c (edx=pQuestData, ret, u8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(3u, 1u, (k == 0 ? 0u : (uint8_t)(k + 1)));
    c.edx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC83D20u, "ACT1Q3_ActivateQuestState1_6FC83D20_113c", k,
                 k == 0 ? "state0_promotes_to_1" : k == 1 ? "state2_unchanged" : "state3_unchanged",
                 &c, ts, 1, 0xFFu, 0);
  }

  /* [B1-14] 0x6FC85440 ACT1Q2_OnBurialGroundsEntered_6FC85440_113c (ecx=pQuestData, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(4u, 1u, (k == 1 ? 6u : 2u));
    U8(STAGE_QUESTEX0 + 0x4Fu) = (k == 0) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x47u) = 0u;
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC85440u, "ACT1Q2_OnBurialGroundsEntered_6FC85440_113c", k,
                 k == 0 ? "flag4f_1_skip" : k == 1 ? "state6_skip" : "promotes_state3_and_calls_6fc84940",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-15] 0x6FC554A0 QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c (eax=pfn, ecx=pQuestData, edx=pArg, stack=[nNewState, bNotify], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(1u, 1u, 0u);
    uint32_t pfn = (k == 2) ? (D2GAME_PREF_BASE + 0x62A80u) : 0u;
    uint32_t bNotify = (k == 0) ? 0u : 1u;
    uint32_t newState = (uint32_t)(k + 1);
    c.eax = rebase_game_va(pfn); c.ecx = STAGE_QUEST0; c.edx = 0u;
    c.nargs = 2; c.args[0] = newState; c.args[1] = bNotify; c.calleePop = 8u;
    ts[0] = pfn; ts[1] = STAGE_QUEST0; ts[2] = 0; ts[3] = newState; ts[4] = bNotify;
    run_and_emit(0x6FC554A0u, "QUESTS_SetMainStateAndIterateLivingPlayers_6FC554A0_113c", k,
                 k == 0 ? "no_notify_sets_0b" : k == 1 ? "notify_null_cb_assert_5b8" : "notify_valid_cb_no_players",
                 &c, ts, 5, 0u, (k == 1 ? 1 : 0));
  }

  /* [B1-16] 0x6FC54DA0 QUESTS_InitAct1Quest4Object_6FC54DA0_113c (ecx=pObjInit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 4u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x3Du, 55u, (k == 1 ? 2u : 0u), 5000u, 5000u, 116u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    if (k == 2) {
      stage_quest_node(4u, 1u, 0u);
      U32(STAGE_QUESTEX0 + 0x54u) = 3u;
    }
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC54DA0u, "QUESTS_InitAct1Quest4Object_6FC54DA0_113c", k,
                 k == 0 ? "no_quest_sets_mode2" : k == 1 ? "no_quest_already_mode2" : "quest4_sets_mode3_and_guid",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-17] 0x6FC828D0 ACT1Q4_InitInifussTreeObject_6FC828D0_113c (ecx=pObjInit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 5u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, (k == 2 ? 0x3Du : 0x1Eu), 56u, 0u, 5000u, 5000u, 117u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    if (k >= 1) {
      stage_quest_node(4u, 1u, 0u);
    }
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC828D0u, "ACT1Q4_InitInifussTreeObject_6FC828D0_113c", k,
                 k == 0 ? "no_quest_sets_mode2" : k == 1 ? "non_tree_attaches" : "tree_3d_records_guid_and_attaches",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-18] 0x6FC83350 ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c (esi=pQuestData, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(3u, 1u, 1u);
    U8(STAGE_QUEST0 + 0x0Au) = 1u;
    U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(STAGE_QBITS0 + 0x04u) = 0x60u;
    U32(STAGE_QUESTCTRL + 0x08u) = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
    U16(STAGE_QUESTEX0 + 0x64u) = (k == 2) ? 2u : 0u;
    c.esi = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC83350u, "ACT1Q3_CompleteCharsiImbueQuestGlobal_6FC83350_113c", k,
                 k == 0 ? "uninit_qctrl_assert_820" : k == 1 ? "count0_clears_0a" : "count2_sets_cb_6fc811b0",
                 &c, ts, 1, 0u, (k == 0 ? 1 : 0));
  }

  /* [B1-19] 0x6FC837E0 ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c (eax=pPlayer, edi=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 119u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    set_qbit(STAGE_QBITS0, 3u, 1u);
    if (k == 0) {
      set_qbit(STAGE_QBITS0, 3u, 0x0Fu);
    } else if (k == 2) {
      stage_quest_node(3u, 1u, 1u);
      U8(STAGE_QUEST0 + 0x0Au) = 1u;
    }
    c.eax = STAGE_UNIT0; c.edi = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC837E0u, "ACT1Q3_InitPlayerQuestStateAndResetFlag0A_6FC837E0_113c", k,
                 k == 0 ? "bit0f_set_early_return" : k == 1 ? "missing_quest3_assert_160" : "clears_quest3_flag0a",
                 &c, ts, 2, 0u, (k == 1 ? 1 : 0));
  }

  /* [B1-20] 0x6FC83BB0 ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c (eax=pPlayer, edi=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 120u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    set_qbit(STAGE_QBITS0, 0x29u, 1u);
    if (k == 0) {
      set_qbit(STAGE_QBITS0, 0x29u, 0x0Fu);
    } else if (k == 2) {
      stage_quest_node(0x1Eu, 1u, 1u);
      U8(STAGE_QUEST0 + 0x0Au) = 1u;
    }
    c.eax = STAGE_UNIT0; c.edi = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC83BB0u, "ACT1Q1_InitPlayerQuestStateAndResetFlag0A_6FC83BB0_113c", k,
                 k == 0 ? "bit0f_set_early_return" : k == 1 ? "missing_quest1e_assert_e1" : "clears_quest1e_flag0a",
                 &c, ts, 2, 0u, (k == 1 ? 1 : 0));
  }

  /* [B1-21] 0x6FC81340 ACT1Q4_SpawnTristramPortalObject_6FC81340_113c (ecx=pGame, edx=pUnit, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 4u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x11u, 60u, 0u, 5000u, 5000u, 121u);
    if (k >= 1) {
      stage_quest_node(4u, 1u, 1u);
      U8(STAGE_QUESTEX0 + 0x95u) = (k == 1) ? 1u : 0u;
      U32(STAGE_QUESTEX0 + 0x9Cu) = 100u;
      U32(STAGE_QUESTEX0 + 0xA0u) = 200u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC81340u, "ACT1Q4_SpawnTristramPortalObject_6FC81340_113c", k,
                 k == 0 ? "no_quest4_ret1" : k == 1 ? "already_spawned_ret1" : "room_not_found_bumps_xy_by3",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B1-22] 0x6FC54E10 QUESTS_InitAct1Quest3Object_6FC54E10_113c (ecx=pObjInit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 27u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x6Cu, 61u, 0u, 5000u, 5000u, 122u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    if (k >= 1) {
      stage_quest_node(3u, (k == 1 ? 0u : 1u), 0u);
      U32(STAGE_QUESTEX0 + 0x98u) = 3u;
    }
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC54E10u, "QUESTS_InitAct1Quest3Object_6FC54E10_113c", k,
                 k == 0 ? "no_quest3_sets_mode2" : k == 1 ? "inactive_forces_mode2" : "active_uses_saved_mode3",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-23] 0x6FC7BDB0 ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c (ecx=pQuestData, edx=pQuestArg, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 110u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, (k == 1 ? 0u : STAGE_PATH0), STAGE_ROOM0, 1u, 0x1FFu, 62u, 1u, 5000u, 5000u, 123u);
    stage_quest_node(0x1Fu, (k == 0 ? 0u : 1u), 1u);
    U32(STAGE_QBITS0 + 0x00u) = STAGE_QBITS0 + 0x10u;
    U32(STAGE_QBITS0 + 0x04u) = 0x60u;
    U32(STAGE_QUESTCTRL + 0x08u) = 1u;
    U32(STAGE_QUESTCTRL + 0x0Cu) = STAGE_QBITS0;
    U8(STAGE_QUEST0 + 0x0Bu) = 1u;
    U8(STAGE_QUEST0 + 0x14u) = 5u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x08u) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC7BDB0u, "ACT5Q1_OnShenkKilledCompleteQuest_6FC7BDB0_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "null_room_noop" : "completes_quest23_no_players",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-24] 0x6FC7E840 ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c (ebx=pQuest, edi=pObject, ret, void) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    uint32_t lvl = (k == 3) ? 114u : 0x6Du;
    uint32_t mode = (k == 0) ? 1u : (k == 4) ? 3u : 2u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x22Eu, 63u, mode, 5000u, 5000u, 124u);
    stage_quest_node(0x21u, 1u, 1u);
    if (k == 1) {
      U32(STAGE_QUESTEX0 + 0xDCu) = 2u;
    } else if (k == 2) {
      U32(STAGE_QUESTEX0 + 0xDCu) = 5u;
    } else if (k == 3) {
      U8(STAGE_QUESTEX0 + 0xADu) = 1u;
    }
    c.ebx = STAGE_QUEST0; c.edi = STAGE_UNIT0;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC7E840u, "ACT5Q3_UpdateAnyaObjectTimer_6FC7E840_113c", k,
                 k == 0 ? "mode1_to_2" : k == 1 ? "mode2_town_inc3" : k == 2 ? "mode2_town_reaches6_mode3" : k == 3 ? "mode2_other_ad1_mode3" : "mode3_to_4",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-25] 0x6FC83730 ACT1Q5_OnMoldyTomeActivated_6FC83730_113c (ecx=pQuestData, edx=pQuestArg, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 20u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 125u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 0) set_qbit(STAGE_QBITS0, 3u, 6u);
    stage_quest_node(3u, 1u, 1u);
    U8(STAGE_QUEST0 + 0x14u) = 5u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    if (k == 2) insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC83730u, "ACT1Q5_OnMoldyTomeActivated_6FC83730_113c", k,
                 k == 0 ? "bit6_already_set" : k == 1 ? "sets_bit6_and_speech24" : "sets_bit6_and_alerts_player",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-26] 0x6FC88F00 ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c (ebx=pQuestData, edi=pObject, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    uint32_t lvl = (k == 2) ? 38u : 1u;
    uint32_t mode = (k == 0) ? 1u : (k == 3) ? 3u : 2u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvl);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x1Eu, 65u, mode, 5000u, 5000u, 126u);
    stage_quest_node(4u, 1u, 1u);
    if (k == 1) {
      U32(STAGE_QUESTEX0 + 0x80u) = 5u;
    } else if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x91u) = 1u;
    }
    c.ebx = STAGE_QUEST0; c.edi = STAGE_UNIT0;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC88F00u, "ACT1Q4_StepCainObjectAnimAndReschedule_6FC88F00_113c", k,
                 k == 0 ? "mode1_to_2" : k == 1 ? "mode2_town_reaches6_mode3" : k == 2 ? "mode2_tristram_flag91_mode3" : "mode3_to_4",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-27] 0x6FC7E560 ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c (stack=[pQuest, pQuestDataEx], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 120u);
    stage_quest_node(0x23u, 1u, 1u);
    U32(STAGE_QUESTEX0 + 0x14u) = 70u;
    U32(STAGE_QUESTEX0 + 0x18u) = 71u;
    U32(STAGE_QUESTEX0 + 0x1Cu) = 72u;
    U32(STAGE_QUESTEX0 + 0x40u) = 3u;
    U32(STAGE_QUESTEX0 + 0x44u) = 3u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x1DAu, 70u, 2u, 5000u, 5000u, 127u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x1DBu, 71u, 2u, 5005u, 5000u, 128u);
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 2u, 0x1DCu, 72u, 2u, 5010u, 5000u, 129u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    }
    c.nargs = 2; c.args[0] = STAGE_QUEST0; c.args[1] = STAGE_QUESTEX0; c.calleePop = 8u;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTEX0;
    run_and_emit(0x6FC7E560u, "ACT5Q5_DeactivateAncientStatuesAndReset_6FC7E560_113c", k,
                 k == 0 ? "all_missing_ret0" : k == 1 ? "only_first_found_ret0" : "all3_found_deactivates_ret1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B1-28] 0x6FC7E660 ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c (ecx=pGame, edx=pQuest, ret, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 120u);
    stage_quest_node(0x23u, 1u, 1u);
    U8(STAGE_QUESTEX0 + 0x04u) = 1u;
    U32(STAGE_QUESTEX0 + 0x0Cu) = (k == 0) ? 1u : 0u;
    U8(STAGE_QUESTEX0 + 0x11u)  = (k == 1) ? 0u : 1u;
    U32(STAGE_QUESTEX0 + 0x14u) = 75u;
    U8(STAGE_QUESTEX0 + 0x3Cu)  = (k >= 2) ? 1u : 0u;
    if (k == 3) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x1DAu, 75u, 0u, 5000u, 5000u, 130u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_QUEST0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FC7E660u, "ACT5Q5_ActivateAncientStatueObjects_6FC7E660_113c", k,
                 k == 0 ? "guard_0c_nonzero_ret1" : k == 1 ? "guard_11_zero_ret1" : k == 2 ? "statue_missing_ret0" : "statue_activated_ret1",
                 &c, ts, 2, 0xFFu, 0);
  }

  /* [B1-29] 0x6FC89130 ACT1Q2_InitQuestData_6FC89130_113c (ecx=pQuest, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0x04u) = STAGE_GAME;
    U32(pq + 0x18u) = 0u;
    U32(pq + 0xA4u) = 0x12345678u;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC89130u, "ACT1Q2_InitQuestData_6FC89130_113c", k,
                 k == 0 ? "alloc_init_slot0" : k == 1 ? "alloc_init_slot1" : "alloc_init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-30] 0x6FC7FC20 ACT5Q3_InitQuestData_6FC7FC20_113c (ecx=pQuest, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0x04u) = STAGE_GAME;
    U32(pq + 0x18u) = 0u;
    U8(pq + 0x0Cu) = 3u;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC7FC20u, "ACT5Q3_InitQuestData_6FC7FC20_113c", k,
                 k == 0 ? "alloc_init_slot0" : k == 1 ? "alloc_init_slot1" : "alloc_init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-31] 0x6FC7EE30 ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c (ebx=pQuest, edi=pObject, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 111u);
    uint32_t mode = (k == 1) ? 1u : (k == 2) ? 2u : 3u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x1DAu, 80u, mode, 5000u, 5000u, 131u);
    stage_quest_node(0x20u, 1u, 1u);
    U32(STAGE_QUESTEX0 + 0xECu) = (k == 0) ? 999u : 80u;
    if (k == 2) {
      U8(STAGE_QUESTEX0 + 0x108u)  = 1u;
      U32(STAGE_QUESTEX0 + 0xFCu)  = 5u;
    }
    c.ebx = STAGE_QUEST0; c.edi = STAGE_UNIT0;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC7EE30u, "ACT5Q2_UpdatePrisonDoorObjectTimer_6FC7EE30_113c", k,
                 k == 0 ? "guid_not_found_noop" : k == 1 ? "mode1_to_2" : k == 2 ? "mode2_reaches6_mode3" : "mode3_to_4",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-32] 0x6FC7CC70 ACT5Q2_InitQuestData_6FC7CC70_113c (ecx=pQuest, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0x04u) = STAGE_GAME;
    U32(pq + 0x18u) = 0u;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC7CC70u, "ACT5Q2_InitQuestData_6FC7CC70_113c", k,
                 k == 0 ? "alloc_init_slot0" : k == 1 ? "alloc_init_slot1" : "alloc_init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-33] 0x6FC87210 ACT1Q5_InitQuestData_6FC87210_113c (ecx=pQuest, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0x04u) = STAGE_GAME;
    U32(pq + 0x18u) = 0u;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC87210u, "ACT1Q5_InitQuestData_6FC87210_113c", k,
                 k == 0 ? "alloc_init_slot0" : k == 1 ? "alloc_init_slot1" : "alloc_init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-34] 0x6FC84AA0 ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c (ecx=pQuestData, ret, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(3u, (k == 3 ? 0u : 1u), (k == 0 ? 0u : k == 1 ? 2u : 5u));
    U32(STAGE_QUEST0 + 0x10u) = 6u;
    if (k == 3) {
      /* chain to quest 6, but leave STAGE_QUEST0+0xF0 == 0 -> asserts 0x362 */
      uint32_t q2 = STAGE_SCRATCH;
      U32(q2 + 0x00u) = 6u;
      U32(q2 + 0x04u) = STAGE_GAME;
      U32(STAGE_QUEST0 + 0xF4u) = q2;
    }
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC84AA0u, "ACT1Q3_ActivateOrChainQuest_6FC84AA0_113c", k,
                 k == 0 ? "state0_activates_1" : k == 1 ? "state2_active_ret1" : k == 2 ? "state5_no_next_ret0" : "chain_null_f0_assert_362",
                 &c, ts, 1, 0xFFu, (k == 3 ? 1 : 0));
  }

  /* [B1-35] 0x6FC84E10 ACT1Q2_ActivateOrChainQuest_6FC84E10_113c (ecx=pQuestData, ret, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(2u, (k == 3 ? 0u : 1u), (k == 0 ? 0u : k == 1 ? 2u : 5u));
    U32(STAGE_QUEST0 + 0x10u) = 4u;
    if (k == 3) {
      uint32_t q2 = STAGE_SCRATCH;
      U32(q2 + 0x00u) = 4u;
      U32(q2 + 0x04u) = STAGE_GAME;
      U32(STAGE_QUEST0 + 0xF4u) = q2;
    }
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC84E10u, "ACT1Q2_ActivateOrChainQuest_6FC84E10_113c", k,
                 k == 0 ? "state0_activates_1" : k == 1 ? "state2_active_ret1" : k == 2 ? "state5_no_next_ret0" : "chain_null_f0_assert_23b",
                 &c, ts, 1, 0xFFu, (k == 3 ? 1 : 0));
  }

  /* [B1-36] 0x6FC887D0 ACT1Q4_InitQuestData_6FC887D0_113c (ecx=pQuest, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0x04u) = STAGE_GAME;
    U32(pq + 0x18u) = 0u;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC887D0u, "ACT1Q4_InitQuestData_6FC887D0_113c", k,
                 k == 0 ? "alloc_init_slot0" : k == 1 ? "alloc_init_slot1" : "alloc_init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-37] 0x6FC87C60 ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c (ecx=pGame, edx=pQuestData, ret, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(6u, 1u, 1u);
    U8(STAGE_QUEST0 + 0x0Bu) = 1u;
    U8(STAGE_QUEST0 + 0x14u) = 5u;
    U16(STAGE_QUESTEX0 + 0x192u) = (k == 0) ? 3u : (k == 1 || k == 2) ? 9u : 11u;
    uint32_t gArg = (k == 1) ? 0u : STAGE_GAME;
    c.ecx = gArg; c.edx = STAGE_QUEST0;
    ts[0] = gArg; ts[1] = STAGE_QUEST0;
    run_and_emit(0x6FC87C60u, "ACT1Q6_TimerTickAndarielDeathSequence_6FC87C60_113c", k,
                 k == 0 ? "tick_4_ret0" : k == 1 ? "tick_10_null_game_assert_2d3" : k == 2 ? "tick_10_valid_game_ret0" : "tick_12_promotes_state3_ret1",
                 &c, ts, 2, 0xFFu, (k == 1 ? 1 : 0));
  }

  /* [B1-38] 0x6FC89200 ACT1Q5_InitQuestData_6FC89200_113c (ecx=pQuestData, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0x04u) = STAGE_GAME;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC89200u, "ACT1Q5_InitQuestData_6FC89200_113c", k,
                 k == 0 ? "alloc_init_slot0" : k == 1 ? "alloc_init_slot1" : "alloc_init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-39] 0x6FC7BEA0 ACT5Q1_InitQuestData_6FC7BEA0_113c (ecx=pQuestData, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0x04u) = STAGE_GAME;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC7BEA0u, "ACT5Q1_InitQuestData_6FC7BEA0_113c", k,
                 k == 0 ? "alloc_init_slot0" : k == 1 ? "alloc_init_slot1" : "alloc_init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-40] 0x6FC85990 ACT1Q1_InitQuestData_6FC85990_113c (ecx=pQuestData, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0x04u) = STAGE_GAME;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC85990u, "ACT1Q1_InitQuestData_6FC85990_113c", k,
                 k == 0 ? "alloc_init_slot0" : k == 1 ? "alloc_init_slot1" : "alloc_init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-41] 0x6FC80080 ACT5Q6_InitQuestTableRecord_6FC80080_113c (ecx=pQuest, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pq = STAGE_QUEST0 + (uint32_t)k * 0x100u;
    U32(pq + 0x04u) = STAGE_GAME;
    c.ecx = pq;
    ts[0] = pq;
    run_and_emit(0x6FC80080u, "ACT5Q6_InitQuestTableRecord_6FC80080_113c", k,
                 k == 0 ? "alloc_init_slot0" : k == 1 ? "alloc_init_slot1" : "alloc_init_slot2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-42] 0x6FC78AE0 ACT5Q6_SendPacket5DAndTriggerSpeech53_6FC78AE0_113c (ecx=pGame, edx=pPlayer, stack=[_arg0], ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 132u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 142u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k >= 1) set_qbit(STAGE_QBITS0, 0x28u, 0x0Du);
    if (k == 2) U32(STAGE_UNIT0 + 0xC4u) = 0x00000004u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = (uint32_t)k; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = k;
    run_and_emit(0x6FC78AE0u, "ACT5Q6_SendPacket5DAndTriggerSpeech53_6FC78AE0_113c", k,
                 k == 0 ? "bit0d_clear_noop" : k == 1 ? "bit0d_set_sends_5d_speech53" : "bit0d_set_second_seed",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B1-43] 0x6FC85500 ACT1Q5_StatusFilter_6FC85500_113c (ecx=pQuestData, edx=pPlayer, stack=[pGlobal, pPlayerFlags, pOut], ret 0xc, u8) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 143u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U16(STAGE_CLIENT + 0x172u) = 0xFFFFu;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    stage_quest_node(3u, (k == 1 ? 0u : 1u), (k == 4 ? 3u : 5u));
    U8(STAGE_QUEST0 + 0x0Bu) = 7u;
    if (k == 0) set_qbit(STAGE_QBITS0, 3u, 1u);
    else if (k == 2) set_qbit(STAGE_QBITS0, 3u, 0x0Du);
    else if (k == 3) set_qbit(STAGE_QBITS0, 3u, 0x0Eu);
    c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_QBITS1; c.args[1] = STAGE_QBITS0; c.args[2] = STAGE_SCRATCH; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0; ts[2] = STAGE_QBITS1; ts[3] = STAGE_QBITS0; ts[4] = STAGE_SCRATCH;
    run_and_emit(0x6FC85500u, "ACT1Q5_StatusFilter_6FC85500_113c", k,
                 k == 0 ? "bit1_out_0a" : k == 1 ? "inactive_out_0" : k == 2 ? "bit0d_out_0d" : k == 3 ? "bit0e_out_0c" : "state3_out_0b_7",
                 &c, ts, 5, 0xFFu, 0);
  }

  /* [B1-44] 0x6FC56070 QUESTS_UseQuestScrollItem_6FC56070_113c (ecx=pGame, esi=pPlayer, eax=dwItemGuid, ret, void) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 40u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 145u);
    U32(STAGE_UDATA0 + 0x9Cu) = 0u; /* null client so trs branch does not serialize uninit stack padding */
    stage_quest_node(0x0Du, 1u, 1u);
    U32(STAGE_GAME + 0xC0u) = STAGE_ACT1;
    U32(STAGE_ACT1 + 0x48u) = STAGE_DRLG0;
    U32(STAGE_DRLG0 + 0x480u) = 0x45u; /* dwBossTombLevel */
    if (k >= 2) {
      U32(STAGE_UNIT0 + 0x60u) = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      uint32_t cls = (k == 4) ? g_item_trs : g_item_ring;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, cls, 90u, 0u, 5000u, 5000u, 146u);
      if (k >= 3) {
        attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 1u);
      }
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t gArg = (k == 0) ? 0u : STAGE_GAME;
    c.ecx = gArg; c.esi = STAGE_UNIT0; c.eax = 90u;
    ts[0] = gArg; ts[1] = STAGE_UNIT0; ts[2] = 90;
    run_and_emit(0x6FC56070u, "QUESTS_UseQuestScrollItem_6FC56070_113c", k,
                 k == 0 ? "null_game_assert_2d3" : k == 1 ? "item_not_found_noop" : k == 2 ? "item_not_in_inv_noop" : k == 3 ? "non_scroll_noop" : "trs_scroll_records_tomb",
                 &c, ts, 3, 0u, (k == 0 ? 1 : 0));
  }

  /* [B1-46] 0x6FC846D0 ACT1Q4_ActivateOrChainQuest_6FC846D0_113c (ecx=pQuestData, ret, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(4u, (k == 3 ? 0u : 1u), (k == 0 ? 0u : k == 1 ? 2u : 6u));
    U32(STAGE_QUEST0 + 0x10u) = 3u;
    if (k == 3) {
      uint32_t q2 = STAGE_SCRATCH;
      U32(q2 + 0x00u) = 3u;
      U32(q2 + 0x04u) = STAGE_GAME;
      U32(STAGE_QUEST0 + 0xF4u) = q2;
    }
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC846D0u, "ACT1Q4_ActivateOrChainQuest_6FC846D0_113c", k,
                 k == 0 ? "state0_activates_1" : k == 1 ? "state2_active_ret1" : k == 2 ? "state6_no_next_ret0" : "chain_null_f0_assert_899",
                 &c, ts, 1, 0xFFu, (k == 3 ? 1 : 0));
  }

  /* [B1-47] 0x6FC87D20 ACT1Q4_OnCairnStoneInit_6FC87D20_113c (ecx=pObjInitArgs, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 4u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x11u, 95u, 1u, 5000u, 5000u, 147u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    if (k >= 1) {
      stage_quest_node(4u, (k == 3 ? 0u : 1u), 1u);
      if (k == 1) {
        U8(STAGE_QUESTEX0 + 0x4Du) = 1u; /* sets mode 2 */
      } else if (k == 2) {
        U8(STAGE_QUESTEX0 + 0x11u + 0x4Bu) = 1u; /* clears flag and sets mode 0 */
      } else {
        U8(STAGE_QUESTEX0 + 0x4Cu) = 1u; /* inactive -> records guid + appends timer + sets mode 2 */
      }
    }
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC87D20u, "ACT1Q4_OnCairnStoneInit_6FC87D20_113c", k,
                 k == 0 ? "no_quest4_sets_mode2" : k == 1 ? "active_flag4d_mode2" : k == 2 ? "active_stone_bit_mode0" : "inactive_stone11_appends_timer",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-48] 0x6FC83930 ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c (ecx=pGame, edx=pPlayer, stack=[_pArg], ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 17u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 148u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k >= 1) {
      stage_quest_node(2u, 1u, 1u);
      U8(STAGE_QUESTEX0 + 0x02u) = (k == 1) ? 0u : 1u;
      U32(STAGE_QUESTEX0 + 0x08u) = 99u;
    }
    if (k >= 2) {
      uint32_t monRoom = (k == 2) ? STAGE_ROOM0 : STAGE_ROOM1;
      if (k == 3) stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 17u);
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, monRoom, 1u, 0x10Bu, 99u, 1u, 5005u, 5005u, 149u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC83930u, "ACT1Q2_CompleteBloodRavenForNearbyPartyCallback_6FC83930_113c", k,
                 k == 0 ? "missing_quest2_assert_133" : k == 1 ? "flag02_zero_noop" : k == 2 ? "same_room_sets_q2_bits" : "far_room_no_bits",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [B1-49] 0x6FC78930 ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c (ecx=pQuest, edx=pQuestArg, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 150u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U16(STAGE_CLIENT + 0x0Au) = 0x0220u; /* Expansion flag 0x20, curProg=2 */
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    stage_quest_node(0x24u, 1u, 0u);
    U32(STAGE_QUEST0 + 0xE0u) = 0x28u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    if (k == 0) set_qbit(STAGE_QBITS0, 0x28u, 0u);
    else if (k == 1) set_qbit(STAGE_QBITS0, 0x28u, 1u);
    else if (k == 2) set_qbit(STAGE_QBITS0, 0x28u, 3u);
    else set_qbit(STAGE_QBITS0, 0x28u, 2u);
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC78930u, "ACT5Q6_Callback11_OnPlayerConnect_6FC78930_113c", k,
                 k == 0 ? "bit0_advances_prog5" : k == 1 ? "bit1_noop" : k == 2 ? "bit3_sets_state3" : "bit2_sets_flag90_and_state3",
                 &c, ts, 2, 0u, 0);
  }

  /* [B1-50] 0x6FC84940 ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c (esi=pQuestData, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 38u);
    stage_quest_node(4u, 1u, 1u);
    U8(STAGE_QUEST0 + 0x14u) = 5u;
    U8(STAGE_QUESTEX0 + 0x47u) = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTEX0 + 0x30u) = 110u;
    U32(STAGE_QUESTEX0 + 0x58u) = 2u;
    if (k == 1) {
      U32(STAGE_QUEST0 + 0x04u) = 0u; /* null pGame when flag47==1 -> asserts 0x2d3 */
    } else if (k == 2) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x1Eu, 110u, 2u, 5000u, 5000u, 151u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.esi = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC84940u, "ACT1Q4_PromoteQuestState3AndUpdatePlayers_6FC84940_113c", k,
                 k == 0 ? "flag47_0_promotes_state3" : k == 1 ? "flag47_1_null_game_assert_2d3" : "flag47_1_resets_gibbet_mode0",
                 &c, ts, 1, 0u, (k == 1 ? 1 : 0));
  }

  /* [B1-51] 0x6FC833C0 ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c (stack=[pQuestData], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_quest_node(4u, 1u, 1u);
    U32(STAGE_QUESTCTRL + 0x18u) = 0x13579BDFu + (uint32_t)k * 0x11111111u;
    U32(STAGE_QUESTCTRL + 0x1Cu) = 0x0000029Au + (uint32_t)k;
    c.nargs = 1; c.args[0] = STAGE_QUEST0; c.calleePop = 4u;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC833C0u, "ACT1Q4_RandomizeCairnStonesOrder_6FC833C0_113c", k,
                 k == 0 ? "seed_order_0" : k == 1 ? "seed_order_1" : "seed_order_2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B1-52] 0x6FC84C10 ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c (eax=pQuestData, ret, u8) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 27u);
    stage_quest_node(3u, (k == 0 ? 0u : 1u), 1u);
    U8(STAGE_QUESTEX0 + 0x01u) = (k <= 1) ? 0u : 1u;
    U32(STAGE_QUESTEX0 + 0x04u) = 115u;
    U32(STAGE_QUESTEX0 + 0x98u) = 2u;
    if (k == 2) {
      U32(STAGE_QUEST0 + 0x04u) = 0u; /* null game with bState01==1 -> asserts 0x2d3 */
    } else if (k == 3) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x6Cu, 115u, 2u, 5000u, 5000u, 152u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    }
    c.eax = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC84C10u, "ACT1Q3_PromoteQuestState3AndResetMalusStand_6FC84C10_113c", k,
                 k == 0 ? "inactive_ret0" : k == 1 ? "flag01_0_clears_98_ret0" : k == 2 ? "null_game_assert_2d3" : "resets_malus_stand_mode0_ret1",
                 &c, ts, 1, 0xFFu, (k == 2 ? 1 : 0));
  }

  /* [B1-53] 0x6FC7B8C0 ACT5Q3_StatusFilter_6FC7B8C0_113c (ecx=pQuestData, edx=pPlayer, stack=[pGlobal, pPlayerFlags, pOut], ret 0xc, u8) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 153u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U16(STAGE_CLIENT + 0x172u) = 0xFFFFu;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    stage_quest_node(0x21u, 1u, (k == 3 ? 3u : 5u));
    U32(STAGE_QUEST0 + 0xE0u) = 0x25u;
    U8(STAGE_QUEST0 + 0x0Bu) = 4u;
    if (k == 0) set_qbit(STAGE_QBITS0, 0x25u, 0u);
    else if (k == 1) { set_qbit(STAGE_QBITS0, 0x25u, 1u); set_qbit(STAGE_QBITS0, 0x25u, 8u); }
    else if (k == 2) set_qbit(STAGE_QBITS0, 0x25u, 0x0Eu);
    else if (k == 4) set_qbit(STAGE_QBITS0, 0x25u, 0x0Du);
    c.ecx = STAGE_QUEST0; c.edx = STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_QBITS1; c.args[1] = STAGE_QBITS0; c.args[2] = STAGE_SCRATCH; c.calleePop = 0xCu;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_UNIT0; ts[2] = STAGE_QBITS1; ts[3] = STAGE_QBITS0; ts[4] = STAGE_SCRATCH;
    run_and_emit(0x6FC7B8C0u, "ACT5Q3_StatusFilter_6FC7B8C0_113c", k,
                 k == 0 ? "bit0_out_0" : k == 1 ? "bit1_bit8_out_6" : k == 2 ? "bit0e_out_0c" : k == 3 ? "state3_out_0b_4" : "bit0d_no_bit8",
                 &c, ts, 5, 0xFFu, 0);
  }
}

/* ------------------------------- Batch 2: 34 Monster/Object/DRLG Lo-VAs */

static void emit_batch_2(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [B2-01] 0x6FC954E0 MONMODE_EnterSequenceMode14_6FC954E0_113c (ecx=pGame, edx=pModeChange, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u + (uint32_t)k, 1u, 5000u, 5000u, 201u);
    U32(STAGE_UNIT0 + 0xC4u) = (k == 2) ? 0x00000004u : 0x00000044u;
    if (k >= 1) {
      stage_used_skill(STAGE_UNIT0, 0, k == 1 ? 1 : 3);
    }
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = STAGE_SCRATCH;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FC954E0u, "MONMODE_EnterSequenceMode14_6FC954E0_113c", k,
                 k == 0 ? "no_skill_sets_mode14_clears_40" : k == 1 ? "attack_lvl1_starts" : "attack_lvl3_starts",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B2-02] 0x6FC959B0 MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c (ecx=pGame, edx=pUnit, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 11u, 8u, 5000u, 5000u, 202u);
    U32(STAGE_UNIT0 + 0x44u) = (k == 0) ? 0x0400u : (k == 1) ? 0x0F00u : 0x1000u; /* dwFramePrecise */
    U32(STAGE_UNIT0 + 0x48u) = 0x1000u;                                           /* dwFrameCountPrecise */
    U16(STAGE_UNIT0 + 0x4Cu) = 0x0100u;                                           /* wAnimSpeed */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC959B0u, "MONMODE_StepPathAndAdvanceToMode11_6FC959B0_113c", k,
                 k == 0 ? "anim_in_progress_stays_mode8" : k == 1 ? "anim_finishes_enters_mode11" : "anim_already_done_enters_mode11",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* (MONMODE_StepPathOrFinishToDeadMode12 skipped: TS UNITS_UpdateAnimFrame113c pAnimData mismatch for mode 0x0C) */

  /* [B2-04] 0x6FC96F20 MONSTER_StepSkillCastAnim_6FC96F20_113c (ecx=pGame, edx=pMonster, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 13u, 8u, 5000u, 5000u, 204u);
    U32(STAGE_UNIT0 + 0x44u) = 0x0400u + (uint32_t)k * 0x100u; /* dwFramePrecise */
    U32(STAGE_UNIT0 + 0x48u) = 0x1000u;                        /* dwFrameCountPrecise */
    U16(STAGE_UNIT0 + 0x4Cu) = 0x0100u;                        /* wAnimSpeed */
    uint32_t pSk = stage_used_skill(STAGE_UNIT0, 0, 1);
    if (k == 1) {
      U8(STAGE_UNIT0 + 0x4Eu) = 1u;
      U32(STAGE_UNIT0 + 0xC4u) = 0x00000044u; /* UNITFLAG_SKILLMODE skips DoUsedSkillAction */
    } else if (k == 2) {
      U32(pSk + 0x0Cu) = 1u; /* flag bit 0 -> validates path target & steps path */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC96F20u, "MONSTER_StepSkillCastAnim_6FC96F20_113c", k,
                 k == 0 ? "action0_advances_ret1" : k == 1 ? "in_skillmode_skips_action_ret1" : "skill_flag1_steps_path_ret1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B2-05] 0x6FC98B60 MONSTER_AutoEquipInteractItem_6FC98B60_113c (al=bInitBodyLoc, stack=[pGame, pUnit], ret 8, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 205u);
    if (k >= 1) {
      U32(STAGE_UDATA0 + 0x90u) = 50u; /* D2PlayerDataStrc.dwInteractItemGuid */
    }
    if (k == 3) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_sword, 50u, 0u, 5000u, 5000u, 206u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 1u, 0u, 1u); /* invPage=1 -> not 0 -> skips equip */
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    uint32_t gArg = (k == 1) ? 0u : STAGE_GAME;
    c.eax = (uint32_t)k; c.nargs = 2; c.args[0] = gArg; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = gArg; ts[1] = STAGE_UNIT0; ts[2] = k;
    run_and_emit(0x6FC98B60u, "MONSTER_AutoEquipInteractItem_6FC98B60_113c", k,
                 k == 0 ? "no_interact_item_noop" : k == 1 ? "null_game_assert_2d3" : k == 2 ? "item_missing_clears_interact" : "invpage1_clears_interact",
                 &c, ts, 3, 0u, (k == 1 ? 1 : 0));
  }

  /* [B2-06] 0x6FC68410 MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c (stack=[pGame, pMonster, pfnCallbackVa], ret 0xc, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t monArg = 0u;
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1 ? 0u : 1u), 148u, 20u, 1u, 5000u, 5000u, 207u);
      monArg = STAGE_UNIT0;
    }
    if (k >= 2) {
      U32(STAGE_UDATA0 + 0x30u) = STAGE_SCRATCH;
      if (k == 3) {
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5005u, 5000u, 208u);
        U32(STAGE_UDATA1 + 0x9Cu) = STAGE_CLIENT;
        U32(STAGE_UNIT1 + 0x64u)  = 20u;
        U32(STAGE_UNIT1 + 0x68u)  = 1u;
        U8(STAGE_UNIT1 + 0x6Cu)   = 1u;
        U32(STAGE_SCRATCH + 0x10u) = STAGE_UNIT1;
        U32(STAGE_SCRATCH + 0x18u) = 0u;
        U32(STAGE_SCRATCH + 0x00u) = STAGE_SCRATCH + 0x10u;
      }
    }
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = monArg; c.args[2] = 0u; c.calleePop = 0xCu;
    ts[0] = STAGE_GAME; ts[1] = monArg; ts[2] = 0;
    run_and_emit(0x6FC68410u, "MONSTER_CloseAllNpcInteractionsAndNotify_6FC68410_113c", k,
                 k == 0 ? "null_monster_noop" : k == 1 ? "non_monster_noop" : k == 2 ? "empty_interact_list" : "notifies_client_and_clears_player",
                 &c, ts, 3, 0u, 0);
  }

  /* [B2-07] 0x6FCA9730 MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c (eax=pMonsterUnit, stack=[pGame], ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 1 ? 0u : STAGE_ROOM0), 1u, 1u, 21u, 1u, 5000u, 5000u, 209u);
    if (k == 0) {
      U32(STAGE_PATH0 + 0x48u) = 1u; /* D2DynamicPathStrc.dwCollisionPattern == 1 -> early ret 0 */
    }
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCA9730u, "MONSTER_UnburrowOrResurrectCollisionInit_6FCA9730_113c", k,
                 k == 0 ? "pattern1_early_ret0" : k == 1 ? "null_room_warp_fail_ret0" : "pattern0_unburrow_inits_collision",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B2-08] 0x6FC958D0 MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c (eax=pMonster, ecx=pKiller, stack=[pGame], ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    static const uint32_t npcIds[3] = { 148u, 154u, 155u }; /* Akara, Charsi, Warriv: wTcId==0 */
    U8(STAGE_GAME + 0x6Du) = (uint8_t)k;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, npcIds[k], 22u, 12u, 5000u, 5000u, 210u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5005u, 5000u, 211u);
    c.eax = STAGE_UNIT0; c.ecx = STAGE_UNIT1; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    run_and_emit(0x6FC958D0u, "MONMODE_DropTreasureOnDeathWrapper_6FC958D0_113c", k,
                 k == 0 ? "npc148_norm_notc" : k == 1 ? "npc154_nm_notc" : "npc155_hell_notc",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B2-09] 0x6FC53620 OBJECTS_InitFn59_ActivateAndScheduleEvents7And1_6FC53620_113c (ecx=pObjInit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    U32(STAGE_GAME + 0xA8u) = (k == 2) ? 250u : 100u;
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cls = (k == 2) ? g_obj_chest : 5u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, cls, 30u, (k == 0 ? 1u : 0u), 5000u, 5000u, 212u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x10u) = U32(STAGE_UDATA0 + 0x00u);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC53620u, "OBJECTS_InitFn59_ActivateAndScheduleEvents7And1_6FC53620_113c", k,
                 k == 0 ? "mode1_early_return" : k == 1 ? "mode0_schedules_7_and_1" : "mode0_frame250_schedules",
                 &c, ts, 1, 0u, 0);
  }

  /* (OBJECTS_TrySpawnTargetSpotObject67 / SpawnPresetTorchOrBrazier / SpawnPresetBrazierOrTorch244 skipped: TS allocInitAndPlaceObjectUnit113c heapTop 16B short) */

  /* [B2-11] 0x6FC525C0 OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c (ecx=pGame, edx=pRoom, stack=[nObjectId, x, y, nInitMode], ret 0x10, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_obj_seed(0x12345679u, 0x29Au);
    uint32_t objId = (k == 0) ? 0x23Du : (k == 1) ? 0x244u : 0x23Eu;
    uint32_t rmArg = (k == 2) ? 0u : STAGE_ROOM0;
    c.ecx = STAGE_GAME; c.edx = rmArg;
    c.nargs = 4; c.args[0] = objId; c.args[1] = 5000u; c.args[2] = 5000u; c.args[3] = 0u; c.calleePop = 0x10u;
    ts[0] = STAGE_GAME; ts[1] = rmArg; ts[2] = objId; ts[3] = 5000; ts[4] = 5000; ts[5] = 0;
    run_and_emit(0x6FC525C0u, "OBJECTS_SpawnPresetShrineFromGroup_6FC525C0_113c", k,
                 k == 0 ? "id_below_range_ret0" : k == 1 ? "id_above_range_ret0" : "null_room_assert_de",
                 &c, ts, 6, 0xFFFFFFFFu, (k == 2 ? 1 : 0));
  }

  /* [B2-14] 0x6FC4F580 OBJECTS_OperateGoldChestOrPile_6FC4F580_113c (ecx=pOperateArgs, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_obj_seed(0x11223345u + (uint32_t)k * 0x101u, 0x29Au);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_chest, 32u, (k == 0 ? 2u : 0u), 5000u, 5000u, 214u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
    U32(STAGE_SCRATCH + 0x08u) = STAGE_ROOM0;
    U32(STAGE_SCRATCH + 0x0Cu) = STAGE_SCRATCH + 0x500u;
    U32(STAGE_SCRATCH + 0x14u) = 100u; /* outside room box -> safe non-spawn roll iterations */
    U32(STAGE_SCRATCH + 0x18u) = 100u;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC4F580u, "OBJECTS_OperateGoldChestOrPile_6FC4F580_113c", k,
                 k == 0 ? "mode2_noop" : k == 1 ? "mode0_rolls_piles_seed1" : "mode0_rolls_piles_seed2",
                 &c, ts, 1, 0u, 0);
  }

  /* [B2-15] 0x6FC4FEC0 OBJECTS_PopulateGridObjectsInRect_6FC4FEC0_113c (ecx=pGame, edx=pRoom, stack=[pRect], ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_obj_seed(0x33445567u + (uint32_t)k, 0x29Au);
    U32(STAGE_SCRATCH + 0x00u) = 100u;
    U32(STAGE_SCRATCH + 0x04u) = 100u;
    U32(STAGE_SCRATCH + 0x08u) = (uint32_t)(k * 2);
    U32(STAGE_SCRATCH + 0x0Cu) = (uint32_t)(k * 2);
    c.ecx = STAGE_GAME; c.edx = STAGE_ROOM0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_ROOM0; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC4FEC0u, "OBJECTS_PopulateGridObjectsInRect_6FC4FEC0_113c", k,
                 k == 0 ? "rect_1x1_steps_seed" : k == 1 ? "rect_3x3_steps_seed" : "rect_5x5_steps_seed",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B2-16] 0x6FC8EC20 OBJ_OperateChestAndDropTreasure_6FC8EC20_113c (ecx=pOperateArgs, ret, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cls = (k == 3) ? g_obj_chest1 : g_obj_chest;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 3 ? 0u : STAGE_ROOM0), 2u, cls, 33u, (k == 0 ? 1u : 0u), 5000u, 5000u, 215u);
    if (k == 2) U32(STAGE_UNIT0 + 0x80u) = 0u; /* null pGame -> asserts 0x1315 */
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, (k == 1 ? 0u : STAGE_UNIT0), 0u, STAGE_SCRATCH + 0x500u, cls);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8EC20u, "OBJ_OperateChestAndDropTreasure_6FC8EC20_113c", k,
                 k == 0 ? "mode1_early_ret1" : k == 1 ? "null_obj_assert_1313" : k == 2 ? "null_game_assert_1315" : "null_room_opens_chest_schedules",
                 &c, ts, 1, 0xFFFFFFFFu, (k == 1 || k == 2 ? 1 : 0));
  }

  /* [B2-17] 0x6FC8EB40 OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c (ecx=pOperateArgs, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_chest, 34u, (k == 0 ? 2u : 0u), 5000u, 5000u, 216u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 9u, 1u, 5005u, 5000u, 217u);
    if (k == 2) U32(STAGE_UNIT0 + 0x7Cu) = STAGE_SCRATCH + 0x200u;
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, (k == 2 ? STAGE_UNIT1 : 0u), STAGE_SCRATCH + 0x500u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8EB40u, "OBJ_OperateTrappedChestOrUrn_6FC8EB40_113c", k,
                 k == 0 ? "mode2_ret1" : k == 1 ? "mode0_null_player_schedules_1_and_a" : "mode0_writes_player_guid_to_7c",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-18] 0x6FC8ECD0 OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c (ecx=pOperateArgs, ret, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cls = (k == 2) ? g_obj_chest1 : g_obj_chest;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 2 ? 0u : STAGE_ROOM0), 2u, cls, 35u, (k == 0 ? 1u : 0u), 5000u, 5000u, 218u);
    /* Seed roll: k=1 -> 50 > 0x14 (no drop); k=2,3 -> 5 <= 0x14 (triggers drop check) */
    stage_obj_seed(0u, (k == 1) ? 50u : 5u);
    if (k == 3) U32(STAGE_UNIT0 + 0x80u) = 0u; /* asserts 0x1315 inside 0x6FC8B570 */
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, STAGE_SCRATCH + 0x500u, cls);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8ECD0u, "OBJ_OperateUrnRoll21PercentTreasure_6FC8ECD0_113c", k,
                 k == 0 ? "mode1_ret1" : k == 1 ? "roll_miss_skips_drop" : k == 2 ? "roll_hit_null_room_opens" : "roll_hit_null_game_assert_1315",
                 &c, ts, 1, 0xFFFFFFFFu, (k == 3 ? 1 : 0));
  }

  /* [B2-19] 0x6FC8EF40 OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c (ecx=pOperateArgs, ret, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 3 ? 0u : STAGE_ROOM0), 2u, g_obj_chest, 36u, (k == 0 ? 1u : 0u), 5000u, 5000u, 219u);
    if (k == 2) U32(STAGE_UNIT0 + 0x80u) = 0u;
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, (k == 1 ? 0u : STAGE_UNIT0), 0u, STAGE_SCRATCH + 0x500u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8EF40u, "OBJ_OperateEvilUrnOrChestWithMonsterRoll_6FC8EF40_113c", k,
                 k == 0 ? "mode1_ret1" : k == 1 ? "null_obj_assert_1313" : k == 2 ? "null_game_assert_1315" : "drop_ret0_early_ret1",
                 &c, ts, 1, 0xFFFFFFFFu, (k == 1 || k == 2 ? 1 : 0));
  }

  /* [B2-20] 0x6FC8F520 OBJ_DeactivateShrineOrStashObject_6FC8F520_113c (eax=pGame, edx=pPlayer, ecx=pObject, ret, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 220u);
    U32(STAGE_UNIT0 + 0x64u) = 55u;
    U32(STAGE_UNIT0 + 0x68u) = 2u;
    U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
    uint32_t objArg = 0u;
    if (k >= 1) {
      uint32_t cls = (k == 1) ? 0x98u : (k == 2) ? 0x151u : 0x10u;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, cls, 55u, 2u, 5005u, 5000u, 221u);
      if (k == 2) {
        U32(STAGE_UNIT1 + 0x7Cu) = STAGE_SCRATCH + 0x100u;
        U32(STAGE_UDATA1 + 0x08u) = STAGE_SCRATCH + 0x100u;
        U32(STAGE_SCRATCH + 0x100u) = STAGE_SCRATCH + 0x120u;
        U32(STAGE_SCRATCH + 0x120u) = 1u;
        insert_server_unit(STAGE_GAME, STAGE_UNIT0);
      }
      objArg = STAGE_UNIT1;
    }
    c.eax = STAGE_GAME; c.edx = STAGE_UNIT0; c.ecx = objArg;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = objArg;
    run_and_emit(0x6FC8F520u, "OBJ_DeactivateShrineOrStashObject_6FC8F520_113c", k,
                 k == 0 ? "null_obj_clears_player" : k == 1 ? "obj98_resets_mode0" : k == 2 ? "obj151_clears_owner" : "other_obj_clears_player",
                 &c, ts, 3, 0u, 0);
  }

  /* [B2-21] 0x6FC8D740 OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c (ecx=pOperateArgs, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x0Bu, 37u, (k == 0 ? 1u : 0u), 5000u, 5000u, 222u);
    U32(STAGE_UNIT0 + 0xC4u) = 0x00000006u;
    U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT0;
    if (k == 2) {
      /* Chain to an adjacent mode-0 barrel (classId=0x0B) within distance 2! */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x0Bu, 38u, 0u, 5001u, 5000u, 223u);
      U32(STAGE_UNIT1 + 0xC4u) = 0x00000006u;
      U32(STAGE_UNIT0 + 0xE8u) = STAGE_UNIT1;
    }
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, STAGE_SCRATCH + 0x500u, 0x0Bu);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8D740u, "OBJECTS_OperateEvilUrnSporeTrap_6FC8D740_113c", k,
                 k == 0 ? "mode1_noop_ret0" : k == 1 ? "single_urn_opens_and_schedules" : "chains_to_adjacent_urn",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-22] 0x6FC8AD60 OBJECTS_ExecuteUrnSporeTrapAndChain_6FC8AD60_113c (edi=pOperateArgs, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x0Bu, 39u, 1u, 5000u, 5000u, 224u);
    U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT0;
    if (k == 1) {
      /* Far player (outside radius 3) + dead player (mode 0x11) -> skipped cleanly */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 0x11u, 5000u, 5000u, 225u);
      U32(STAGE_UNIT0 + 0xE8u) = STAGE_UNIT1;
    } else if (k == 2) {
      /* Adjacent mode-0 barrel (classId=0x0B) -> triggers chain operate */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x0Bu, 40u, 0u, 5001u, 5001u, 226u);
      U32(STAGE_UNIT0 + 0xE8u) = STAGE_UNIT1;
    }
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, STAGE_SCRATCH + 0x500u, 0x0Bu);
    c.edi = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8AD60u, "OBJECTS_ExecuteUrnSporeTrapAndChain_6FC8AD60_113c", k,
                 k == 0 ? "self_only_noop" : k == 1 ? "dead_player_skipped" : "chains_adjacent_barrel",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-23] 0x6FC8E0E0 OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c (ecx=pOpStrc, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    /* Town level (1) makes OBJECTS_ApplyTrapDamageToTarget return immediately cleanly, non-town with null player asserts 0x3f */
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2 ? 2u : 1u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_chest, 41u, (k == 0 ? 1u : 0u), 5000u, 5000u, 227u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5001u, 5000u, 228u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, (k == 2 ? 0u : STAGE_UNIT1), STAGE_SCRATCH + 0x500u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8E0E0u, "OBJECTS_OperateFireAndLightningTrap_6FC8E0E0_113c", k,
                 k == 0 ? "mode1_noop_ret0" : k == 1 ? "town_target_opens_and_schedules" : "null_target_assert_3f",
                 &c, ts, 1, 0xFFFFFFFFu, (k == 2 ? 1 : 0));
  }

  /* [B2-24] 0x6FC8DE00 OBJ_OperateGenericMode0To1_6FC8DE00_113c (ecx=pOperateArgs, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cls = (k == 2) ? g_obj_sel : g_obj_chest;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, cls, 42u, (k == 0 ? 2u : 0u), 5000u, 5000u, 229u);
    U32(STAGE_UNIT0 + 0xC4u) = 0x00000004u;
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, STAGE_SCRATCH + 0x500u, cls);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8DE00u, "OBJ_OperateGenericMode0To1_6FC8DE00_113c", k,
                 k == 0 ? "mode2_noop_ret1" : k == 1 ? "chest_mode0_to_1" : "selectable_obj_sets_bit1_and_event1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-25] 0x6FC8BCB0 OBJ_OperateFn_DungeonStairOrTileWarp_6FC8BCB0_113c (ecx=pOperateArgs, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t mode = (k == 0) ? 0u : (k == 1) ? 1u : 2u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 5u, 43u, mode, 5000u, 5000u, 230u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, 0u, 5u);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8BCB0u, "OBJ_OperateFn_DungeonStairOrTileWarp_6FC8BCB0_113c", k,
                 k == 0 ? "mode0_sets_mode2" : k == 1 ? "mode1_noop_ret1" : "mode2_no_tile_assert_40e",
                 &c, ts, 1, 0xFFFFFFFFu, (k == 2 ? 1 : 0));
  }

  /* [B2-26] 0x6FC8DFC0 OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c (ecx=pOperateArgs, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x300u);
    uint32_t mode = (k == 0) ? 0u : (k == 1) ? 1u : 2u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_chest, 44u, mode, 5000u, 5000u, 231u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, 0u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8DFC0u, "OBJ_OperateFn_TrapDoorOrDelayedTileWarp_6FC8DFC0_113c", k,
                 k == 0 ? "mode0_sets_mode1_schedules" : k == 1 ? "mode1_noop_ret1" : "mode2_no_tile_in_adj_ret1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B2-27] 0x6FC8BE40 OBJ_OperateFn_FindPairedObjectAndTeleportPad_6FC8BE40_113c (ecx=pOperateArgs, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 74u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x300u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 0 ? 0u : STAGE_ROOM0), 2u, 0xC0u, 45u, 0u, 5000u, 5000u, 232u);
    U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT0;
    if (k == 2) {
      /* Paired object of same classId 0xC0 -> invokes 0x6FC8BD60 (pColl=0 so FindFree returns 0 cleanly!) */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0xC0u, 46u, 0u, 5010u, 5010u, 233u);
      U32(STAGE_UNIT0 + 0xE8u) = STAGE_UNIT1;
    }
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, 0u, 0u, 0xC0u);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8BE40u, "OBJ_OperateFn_FindPairedObjectAndTeleportPad_6FC8BE40_113c", k,
                 k == 0 ? "null_room_ret0" : k == 1 ? "no_paired_obj_ret0" : "paired_obj_calls_6fc8bd60",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* (OBJ_TeleportPlayerToRoomPad skipped: real DLL returns pRoom from UNITROOM_RefreshUnit113c in eax, whereas TS returns hardcoded 1) */

  /* [B2-29] 0x6FC8BB60 OBJ_OperateFn_CowAndSpecialPortal_6FC8BB60_113c (ecx=pOperateArgs, ret, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t objCls = (k == 2) ? 0x179u : 0x64u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, objCls, 48u, 0u, 5000u, 5000u, 236u);
    if (k == 2) U8(STAGE_UDATA0 + 0x04u) = 0xFEu; /* invalid level -> act >= 5 -> asserts 0xfcb */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 1 ? 1u : 0u), 0u, 1u, 1u, 5005u, 5000u, 237u);
    uint32_t plrArg = (k == 0) ? 0u : STAGE_UNIT1;
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, plrArg, 0u, objCls);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8BB60u, "OBJ_OperateFn_CowAndSpecialPortal_6FC8BB60_113c", k,
                 k == 0 ? "null_player_assert_fb3" : k == 1 ? "non_player_assert_fb3" : k == 2 ? "bad_act_assert_fcb" : "cow_portal_no_room_assert_fcd",
                 &c, ts, 1, 0xFFFFFFFFu, 1);
  }

  /* [B2-30] 0x6FC89CA0 OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c (ecx=pGame, edx=pObject, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_well, 49u, 2u, 5000u, 5000u, 238u);
    uint32_t pObjs = U32(0x6FDF0B94u + g_com_rebase);
    uint32_t parm0 = U32(pObjs + g_obj_well * 0x1C0u + 0x180u);
    U8(STAGE_UDATA0 + 0x04u) = (k == 0) ? (uint8_t)(parm0 * 2u) : (k == 1) ? 0u : (uint8_t)(parm0 - 1u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC89CA0u, "OBJ_IncrementWellChargesAndRefresh_6FC89CA0_113c", k,
                 k == 0 ? "full_charges_assert_dc" : k == 1 ? "inc_from_0_refreshes" : "inc_reaches_step_changes_mode",
                 &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [B2-31] 0x6FC8CEE0 OBJ_OperateWell_6FC8CEE0_113c (ecx=pObjOpArgs, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_well, 50u, 0u, 5000u, 5000u, 239u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5005u, 5000u, 240u);
    U32(STAGE_UDATA1 + 0x9Cu) = STAGE_CLIENT;
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0); /* maxhp = 100 << 8 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, (k == 2 ? 0x1000 : 0x6400), 0); /* curhp */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 9, 0x6400, 0); /* maxmana */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 8, (k == 2 ? 0x1000 : 0x6400), 0); /* curmana */
    U8(STAGE_UDATA0 + 0x04u) = (k == 0) ? 0u : 2u;
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, STAGE_UNIT1, 0u, g_obj_well);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8CEE0u, "OBJ_OperateWell_6FC8CEE0_113c", k,
                 k == 0 ? "zero_charges_ret0" : k == 1 ? "full_hp_mana_no_heal" : "wounded_player_healed_decrements_charges",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Batch 3: 60 Skills/Missiles/Pets Lo-VAs */

static void emit_batch_3(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [B3-01] 0x6FC597C0 MISSILES_InitGuidedOrLinearPath_6FC597C0_113c (esi=pMissile, stack=[pTargetUnit], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 301u, 5000u, 5000u, 301u, 0, 0u, 0u, 12u, 2u, 20u, 20u, 0u);
    U32(STAGE_UDATA0 + 0x2Cu) = (uint32_t)(30u | (30u << 16)); /* packed dx=30, dy=30 (dist>=25) */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 302u, (k == 2 ? 12u : 1u), 5040u, 5040u, 302u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t tgtArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.esi = misArg; c.nargs = 1; c.args[0] = tgtArg; c.calleePop = 4u;
    ts[0] = misArg; ts[1] = tgtArg;
    run_and_emit(0x6FC597C0u, "MISSILES_InitGuidedOrLinearPath_6FC597C0_113c", k,
                 k == 0 ? "null_missile_noop" : k == 1 ? "live_target_sets_guided_path" : "dead_target_uses_packed_offset",
                 &c, ts, 2, 0u, 0);
  }


  /* [B3-03] 0x6FC5B7C0 MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c (ecx=pGame, edx=pMissile, stack=[pHitUnit], ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x300u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 306u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t mCls = (k == 1) ? 43u : 4u; /* 43 has p4c>0; 4 falls back to skill calc1 */
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, mCls, 305u, 5002u, 5002u, 307u,
                       1, 0u, 1u, 24u, 2u, 20u, 10u, 0u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 306u, 1u, 5003u, 5002u, 308u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 6, 0x6400, 0);
    U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT2;
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = (k == 2 ? STAGE_UNIT2 : 0u); c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = c.args[0];
    run_and_emit(0x6FC5B7C0u, "MISSILE_SrvHit_RadialStatsDamageByCalc1_6FC5B7C0_113c", k,
                 k == 0 ? "null_missile_ret1" : k == 1 ? "fixed_radius_hits_room" : "calc1_radius_hits_room",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-04] 0x6FC5C490 MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c (ecx=pGame, edx=pMissile, stack=[pHitUnit], ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 309u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t mCls = (k == 0) ? 4u : 43u; /* 4 has no sub24; 43 has sub24=221, p4c=1, p50=2 */
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, mCls, 307u, 5002u, 5002u, 310u,
                       1, 0u, 1u, 24u, (uint16_t)(k == 2 ? 2u : 1u), 20u, 10u, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC5C490u, "MISSILE_SrvHit_SpawnScatteredSubMissiles_6FC5C490_113c", k,
                 k == 0 ? "no_submissile_ret1" : k == 1 ? "lvl1_spawns_1_sub" : "lvl2_spawns_3_subs",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }


  /* [B3-06] 0x6FC5D8C0 MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c (ecx=pGame, edx=pMissile, stack=[pHitUnit], ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x300u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 313u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 43u, 309u, 5002u, 5002u, 314u,
                       1, 0u, 1u, 24u, 2u, 20u, 10u, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t hitArg = (k == 1) ? STAGE_UNIT1 : 0u; /* k=1: player hitUnit (uType!=1) -> ret 2; k=2: null hit -> radial + ring18 */
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = hitArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = hitArg;
    run_and_emit(0x6FC5D8C0u, "MISSILE_SrvHit_RadialDamageAndRing18IfFlag0B_6FC5D8C0_113c", k,
                 k == 0 ? "null_missile_ret1" : k == 1 ? "non_monster_hit_ret2" : "null_hit_radial_and_ring",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-07] 0x6FC5DD60 MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c (ecx=pGame, edx=pMissile, stack=[pTargetUnit], ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x300u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 315u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t mCls = (k == 0) ? 4u : 43u;
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, mCls, 310u, 5002u, 5002u, 316u,
                       1, 0u, 1u, 24u, 2u, 20u, 10u, 0u);
    if (k == 2) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 311u, 1u, 5003u, 5002u, 317u);
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT2;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC5DD60u, "MISSILE_SrvDmg_SpawnAuraSubMissilesStrictCount_6FC5DD60_113c", k,
                 k == 0 ? "no_submissile_ret1" : k == 1 ? "no_targets_in_room" : "monster_in_room_spawns_sub",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-08] 0x6FC5E740 MISSILES_SrvHit_AttractMonsterToTargetGuid_6FC5E740_113c (ecx=pGame, edx=pMissile, stack=[pHitTarget], ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 318u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 312u, 1u, 5004u, 5002u, 319u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 313u, 5002u, 5002u, 320u,
                       1, 0u, 1u, (uint16_t)(k == 0 ? 0xFFFFu : 86u), 2u, 20u, 10u, 312u);
    uint32_t hitArg = (k == 1) ? STAGE_UNIT1 : STAGE_UNIT2;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = hitArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = hitArg;
    run_and_emit(0x6FC5E740u, "MISSILES_SrvHit_AttractMonsterToTargetGuid_6FC5E740_113c", k,
                 k == 0 ? "invalid_skill_ret1" : k == 1 ? "player_hit_not_monster_ret1" : "valid_monster_attracts_target",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }


  /* [B3-10] 0x6FC60070 MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c (ecx=pGame, edx=pMissile, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 322u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 106u, 315u, 5002u, 5002u, 323u,
                       (k == 2 ? 1 : 0), 0u, 1u, 24u, 2u, 20u, 15u, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC60070u, "MISSILE_SrvDo_ScatterSubMissile_6FC60070_113c", k,
                 k == 0 ? "null_missile_ret2" : k == 1 ? "no_owner_steps" : "with_owner_scatters_sub",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-11] 0x6FC606D0 MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c (ecx=pGame, edx=pMissile, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 324u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint16_t rem = (k == 1) ? 20u : 15u; /* elapsed = 0 for k=1 (<2), 5 for k=2 (>=2) */
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 106u, 316u, 5002u, 5002u, 325u,
                       1, 0u, 1u, 24u, 2u, 20u, rem, 0u);
    U16(STAGE_PATH0 + 0x20u) = 5010u; /* first point X */
    U16(STAGE_PATH0 + 0x22u) = 5006u; /* first point Y */
    if (k == 2) U32(STAGE_PATH0 + 0x10u) = 0x08u; /* dwPathFlags bit 0x08 */
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC606D0u, "MISSILE_SrvDo_PerpendicularSubMissiles_6FC606D0_113c", k,
                 k == 0 ? "null_missile_ret2" : k == 1 ? "elapsed0_caches_perp_vec" : "elapsed5_flag08_spawns_perp",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-12] 0x6FC608D0 MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c (ecx=pGame, edx=pMissile, ret, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 5u, 317u, 0u, 5002u, 5002u, 326u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint16_t rem = (k == 1 || k == 2) ? 1u : 5u;
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 318u, 5002u, 5002u, 327u,
                       0, 0u, 0u, 0u, 1u, 20u, rem, 317u);
    uint32_t gArg   = (k == 1) ? 0u : STAGE_GAME;
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = gArg; c.edx = misArg;
    ts[0] = gArg; ts[1] = misArg;
    run_and_emit(0x6FC608D0u, "MISSILES_SrvDo_StashGoldFountain_6FC608D0_113c", k,
                 k == 0 ? "null_missile_ret2" : k == 1 ? "rem1_null_game_assert_2d3" : k == 2 ? "rem1_sets_obj_sound_5c" : "rem5_fountain_step",
                 &c, ts, 2, 0xFFFFFFFFu, (k == 1 ? 1 : 0));
  }

  /* [B3-13] 0x6FC60E10 MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c (ecx=pGame, edx=pMissile, ret, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* missile 39 has p38=2 (step), p3c=4 (srvDoFunc=4 -> Nihlathak CE) */
    uint16_t rem = (k == 1) ? 19u : 18u; /* elapsed=1 (1%2!=0) vs elapsed=2 (2%2==0) */
    uint16_t sk  = (k == 2) ? 0u : 74u;
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 39u, 319u, 5002u, 5002u, 328u,
                       0, 0u, 0u, sk, 1u, 20u, rem, 0u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC60E10u, "MISSILE_SrvDo_PeriodicSrvDoFunc_6FC60E10_113c", k,
                 k == 0 ? "null_missile_ret2" : k == 1 ? "off_period_linear_step" : k == 2 ? "on_period_skill0_ret2" : "on_period_dispatches_srvdo",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-14] 0x6FC61240 MISSILE_SrvDo_HomingTargetStep_6FC61240_113c (ecx=pGame, edx=pMissile, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 320u, 1u, 5012u, 5008u, 329u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, 321u, 5002u, 5002u, 330u,
                       0, 0u, 0u, 12u, 2u, 20u, 15u, 0u);
    if (k == 2) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = misArg;
    ts[0] = STAGE_GAME; ts[1] = misArg;
    run_and_emit(0x6FC61240u, "MISSILE_SrvDo_HomingTargetStep_6FC61240_113c", k,
                 k == 0 ? "null_missile_ret2" : k == 1 ? "no_target_linear_step" : "live_target_homing_step",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-15] 0x6FC61C30 MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c (ecx=pGame, edx=pMissile, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* missile 546 has multi-slot sub18=654, p38=25, p3c=3 */
    uint32_t mCls = (k == 0) ? 4u : 546u;
    uint16_t rem  = (k == 1) ? 30u : 5u; /* total=40 -> elapsed=10 (<25) vs elapsed=35 (>=25) */
    stage_missile_unit(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, mCls, 322u, 5002u, 5002u, 331u,
                       0, 0u, 0u, 24u, 2u, 40u, rem, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC61C30u, "MISSILE_SrvDo_StoppedRandomSlotSubMissile_6FC61C30_113c", k,
                 k == 0 ? "no_valid_slots_ret2" : k == 1 ? "elapsed_lt_thresh_waits" : "elapsed_ge_thresh_spawns_slot",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-16] 0x6FC2C5D0 SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 323u, 1u, 5000u, 5000u, 332u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 324u, 1u, 5004u, 5000u, 333u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    int32_t sk = (k == 0) ? -1 : 311;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC2C5D0u, "SKILLS_SrvDo131_ImpregnateTarget_6FC2C5D0_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_target_sets_flag40_ret0" : "valid_target_applies_state6e",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-17] 0x6FC2C760 SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c (ecx=pGame, edx=pAttacker, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 334u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 5000, 0); /* high AR */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 20, 0);   /* mindmg */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 30, 0);   /* maxdmg */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 325u, 1u, 5002u, 5000u, 335u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    int32_t sk = (k == 0) ? -1 : 254;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC2C760u, "SKILLS_SrvDo_MeleePctPhysAndLeech_6FC2C760_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_target_ret0" : "hits_monster_target_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-18] 0x6FC2C900 SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x300u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 326u, 1u, 5000u, 5000u, 336u);
    int32_t sk = (k == 0) ? -1 : (k == 1) ? 68 : 311; /* 68 has srvMis=-1; 311 has srvMis=523 */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC2C900u, "SKILLS_SrvDo_RadialPhysAndElemDamage_6FC2C900_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_srvmis_ret0" : "valid_srvmis_applies_radial",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }




  /* [B3-22] 0x6FC47A10 SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c (eax=nSkillId, stack=[pGame, pUnit, pTarget, nLevel], ret 0x10, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 343u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 15, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 25, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 331u, 1u, 5002u, 5000u, 344u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    int32_t sk = (k == 0) ? -1 : 254;
    uint32_t tgtArg = (k == 1) ? 0u : STAGE_UNIT1;
    c.eax = (uint32_t)sk;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = tgtArg; c.args[3] = 2u; c.calleePop = 0x10u;
    /* Note TS parameter order: (m, nSkillId, pUnit, pGame, pTarget, nSkillLevel) */
    ts[0] = sk; ts[1] = STAGE_UNIT0; ts[2] = STAGE_GAME; ts[3] = tgtArg; ts[4] = 2;
    run_and_emit(0x6FC47A10u, "SKILLS_ExecuteTargetedMeleeSkillHit_6FC47A10_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "null_target_ret0" : "valid_target_melee_hit_ret1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-23] 0x6FC48290 SKILLS_SrvDo037_LeapAttackAndChargeInit_6FC48290_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 345u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    if (k >= 2) {
      stage_used_skill(STAGE_UNIT0, 143, 2);
      if (k == 3) {
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 332u, 1u, 5010u, 5000u, 346u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
        stage_path_target(STAGE_PATH0, STAGE_UNIT1);
        stage_statlist_state(STAGE_UNIT0, 2u, 0x0C, 200u, 0u, 0u); /* already in state 0x0C -> ret 0 */
      }
    }
    int32_t sk = (k == 0) ? -1 : 143;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC48290u, "SKILLS_SrvDo037_LeapAttackAndChargeInit_6FC48290_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_skill_queues_a5" : k == 2 ? "no_coords_queues_a5" : "state0c_active_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-24] 0x6FC48BE0 SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 347u);
    if (k >= 1) {
      uint32_t pSk = stage_used_skill(STAGE_UNIT0, 151, 2);
      if (k == 2) {
        U32(pSk + 0x1Cu) = 5005u; /* nParam1 */
        U32(pSk + 0x20u) = 5000u; /* nParam2 */
        U32(pSk + 0x18u) = 0u;    /* dwFlags & 1 == 0 -> ret 0 */
      } else if (k == 3) {
        U32(pSk + 0x1Cu) = 5005u;
        U32(pSk + 0x20u) = 5000u;
        U32(pSk + 0x18u) = 3u;    /* (dwFlags & 3) == 3 -> EndCharge & ret 1 */
      }
    }
    int32_t sk = (k == 0) ? -1 : 151;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC48BE0u, "SKILLS_SrvDo_WhirlwindTick_6FC48BE0_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "param0_ends_charge_ret0" : k == 2 ? "flag0_ret0" : "flag3_ends_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-25] 0x6FC48E70 SKILLS_ApplyProgressiveChargeState_6FC48E70_113c (ebx=pUnit, stack=[pGame, nSkillId, nLevel], ret 0xc, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 348u);
    if (k >= 1) {
      uint32_t pSk = stage_used_skill(STAGE_UNIT0, 254, 2);
      U32(pSk + 0x1Cu) = (k == 2) ? 1u : 0u; /* nParam1 */
    }
    int32_t sk = (k == 0) ? -1 : 254;
    c.ebx = STAGE_UNIT0; c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = (uint32_t)sk; c.args[2] = 2u; c.calleePop = 0xCu;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC48E70u, "SKILLS_ApplyProgressiveChargeState_6FC48E70_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "param1_zero_ret0" : "param1_set_applies_charge_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-26] 0x6FC49600 SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* Monster unit (uType=1) avoids PLAYER_ScheduleSkillActionFrameEvents while exercising both even and odd frames */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 333u, 1u, 5000u, 5000u, 349u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5002u, 5000u, 350u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    U32(STAGE_UNIT0 + 0x38u) = (k == 2) ? 0x100u : 0x200u; /* odd frameIdx=1 vs even frameIdx=2 */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 254u; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 254; ts[3] = 2;
    run_and_emit(0x6FC49600u, "SKILLS_SrvDo_ProgressiveChargeDualHit_6FC49600_113c", k,
                 k == 0 ? "no_target_ret0" : k == 1 ? "even_frame_executes_melee" : "odd_frame_sets_flag40",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-27] 0x6FC61FB0 SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c (stack=[pDefender, pAttacker, pDmg, nSkillId, nLevel], ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 351u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 334u, 1u, 5002u, 5000u, 352u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 0x10000, 0); /* maxmana = 256 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 0x10000, 0); /* curmana = 256 */
    if (k == 2) {
      stage_statlist_state(STAGE_UNIT0, 2u, 30, 500u, 58u, 5u); /* Energy Shield state 30 */
    }
    stage_dmg_struct(STAGE_SCRATCH + 0x200u, 1u, 1u, 0x2000, 0, 0, 0);
    uint32_t defArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.nargs = 5; c.args[0] = defArg; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_SCRATCH + 0x200u; c.args[3] = 58u; c.args[4] = 5u; c.calleePop = 0x14u;
    ts[0] = defArg; ts[1] = STAGE_UNIT1; ts[2] = STAGE_SCRATCH + 0x200u; ts[3] = 58; ts[4] = 5;
    run_and_emit(0x6FC61FB0u, "SKILLS_AbsorbDamageByManaShield_6FC61FB0_113c", k,
                 k == 0 ? "null_defender_ret0" : k == 1 ? "no_shield_state_ret0" : "shield_active_absorbs_to_mana",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-28] 0x6FC64600 SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c (stack=[pDefender, pAttacker, pDmg, nSkillId, nLevel], ret 0x14, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 353u);
    if (k >= 2) {
      uint32_t pSl = stage_statlist_state(STAGE_UNIT0, 2u, 151, 500u, 235u, 3u); /* Cyclone Armor state 151 */
      fn_SetStatIfValid((void *)(uintptr_t)pSl, 133, 200, 0); /* max absorb */
      fn_SetStatIfValid((void *)(uintptr_t)pSl, 132, 200, 0); /* cur absorb */
    }
    int32_t fire = (k == 2) ? 0x3200 : 0x20000; /* 50 pts (partial) vs 512 pts (depletes armor) */
    stage_dmg_struct(STAGE_SCRATCH + 0x200u, 1u, 1u, 0, fire, 0x1000, 0);
    uint32_t defArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.nargs = 5; c.args[0] = defArg; c.args[1] = 0u; c.args[2] = STAGE_SCRATCH + 0x200u; c.args[3] = 235u; c.args[4] = 3u; c.calleePop = 0x14u;
    ts[0] = defArg; ts[1] = 0; ts[2] = STAGE_SCRATCH + 0x200u; ts[3] = 235; ts[4] = 3;
    run_and_emit(0x6FC64600u, "SKILLS_AbsorbElementalDamageByCycloneArmor_6FC64600_113c", k,
                 k == 0 ? "null_defender_ret0" : k == 1 ? "no_cyclone_state_ret0" : k == 2 ? "partial_elem_absorb" : "full_depletion_clears_state",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-29] 0x6FC65000 SKILLS_SrvDo036_MeleeHitWithPhysScaleAndLeech_6FC65000_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 354u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 15, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 25, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 335u, 1u, 5002u, 5000u, 355u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    int32_t sk = (k == 0) ? -1 : 254;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC65000u, "SKILLS_SrvDo036_MeleeHitWithPhysScaleAndLeech_6FC65000_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_target_ret0" : "hits_target_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-30] 0x6FC652C0 SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 356u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 336u, 1u, 5006u, 5002u, 357u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    int32_t sk = (k == 0) ? 68 : 280; /* 68 has no missile; 280 has srvMis=564 */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC652C0u, "SKILLS_SrvDo_SpawnChargedAreaControllerWithPacketA3_6FC652C0_113c", k,
                 k == 0 ? "no_missile_ret0" : k == 1 ? "no_coords_ret0" : "with_target_coords",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-31] 0x6FC65850 SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2 ? 1u : 2u)); /* 1=Rogue Encampment town, 2=Blood Moor */
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x300u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 358u);
    if (k >= 2) {
      stage_statlist_state(STAGE_UNIT0, 2u, 46, 500u, 118u, 3u); /* Holy Shock state 46 */
    }
    int32_t sk  = (k == 0) ? -1 : 118;
    int32_t lvl = (k == 0) ? 0 : 3;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = (uint32_t)lvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = lvl;
    run_and_emit(0x6FC65850u, "SKILLS_Event05_PeriodicAuraRandomMissileStrike_6FC65850_113c", k,
                 k == 0 ? "invalid_skill_deletes_ev5" : k == 1 ? "no_state_deletes_ev5" : k == 2 ? "in_town_reschedules" : "outside_town_pulses",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-32] 0x6FC6CC50 SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 359u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 337u, 1u, 5002u, 5000u, 360u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    int32_t sk = (k == 0) ? -1 : 97;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC6CC50u, "SKILLS_SrvDo060_PaladinSmite_6FC6CC50_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_target_ret0" : "smites_hostile_monster",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-33] 0x6FC6CE10 SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x300u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 361u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 338u, 1u, 5002u, 5000u, 362u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    int32_t sk = (k == 0) ? -1 : 34;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC6CE10u, "SKILLS_SrvDo_LightningStrikeBounce_6FC6CE10_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_target_ret0" : "strikes_monster_spawns_bolt",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }


  /* [B3-35] 0x6FC6DFE0 SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c (stack=[pDefender, pAttacker, pDmg, nSkillId, nLevel], ret 0x14, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 365u);
    if (k >= 2) {
      uint32_t pSl = stage_statlist_state(STAGE_UNIT0, 2u, 14, 500u, 68u, 3u); /* Bone Armor state 14 */
      fn_SetStatIfValid((void *)(uintptr_t)pSl, 133, 200, 0);
      fn_SetStatIfValid((void *)(uintptr_t)pSl, 132, 200, 0);
    }
    int32_t phys = (k == 2) ? 0x3200 : 0x20000; /* 50 pts (partial) vs 512 pts (breaks armor) */
    stage_dmg_struct(STAGE_SCRATCH + 0x200u, 1u, 1u, phys, 0, 0, 0);
    uint32_t defArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.nargs = 5; c.args[0] = defArg; c.args[1] = 0u; c.args[2] = STAGE_SCRATCH + 0x200u; c.args[3] = 68u; c.args[4] = 3u; c.calleePop = 0x14u;
    ts[0] = defArg; ts[1] = 0; ts[2] = STAGE_SCRATCH + 0x200u; ts[3] = 68; ts[4] = 3;
    run_and_emit(0x6FC6DFE0u, "SKILLS_AbsorbPhysicalDamageByBoneArmor_6FC6DFE0_113c", k,
                 k == 0 ? "null_defender_ret0" : k == 1 ? "no_bone_armor_ret0" : k == 2 ? "partial_phys_absorb" : "full_depletion_clears_state",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-36] 0x6FC6E5F0 SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c (ecx=pGame, edx=_nEvent, stack=[pAttacker, pDefender, pDmg, nSkillId, nLevel], ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 290u, 340u, 1u, 5000u, 5000u, 366u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x1000, 0);
    uint32_t defType = (k == 1) ? 2u : 0u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, defType, 0u, 1u, 1u, 5002u, 5000u, 367u);
    stage_dmg_struct(STAGE_SCRATCH + 0x200u, 1u, 1u, 0x2000, 0, 0, 0);
    uint32_t atkArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = 0u;
    c.nargs = 5; c.args[0] = atkArg; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_SCRATCH + 0x200u; c.args[3] = 85u; c.args[4] = 3u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = 0; ts[2] = atkArg; ts[3] = STAGE_UNIT1; ts[4] = STAGE_SCRATCH + 0x200u; ts[5] = 85; ts[6] = 3;
    run_and_emit(0x6FC6E5F0u, "SKILLS_BloodGolemShareLifeSteal_6FC6E5F0_113c", k,
                 k == 0 ? "null_attacker_ret0" : k == 1 ? "object_defender_ret0" : "heals_attacker_from_phys",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B3-37] 0x6FC6E760 SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c (ecx=pGame, edx=_nEvent, stack=[pDefender, pAttacker, pDmg, nSkillId, nLevel], ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 341u, 1u, 5000u, 5000u, 368u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, (k == 1 ? 0u : 1u), 5002u, 5000u, 369u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x1000, 0);
    stage_dmg_struct(STAGE_SCRATCH + 0x200u, 1u, 1u, 0x2000, 0, 0, 0);
    uint32_t defArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = 0u;
    c.nargs = 5; c.args[0] = defArg; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_SCRATCH + 0x200u; c.args[3] = 82u; c.args[4] = 2u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = 0; ts[2] = defArg; ts[3] = STAGE_UNIT1; ts[4] = STAGE_SCRATCH + 0x200u; ts[5] = 82; ts[6] = 2;
    run_and_emit(0x6FC6E760u, "SKILLS_LifeTapHealAttackerOnHit_6FC6E760_113c", k,
                 k == 0 ? "null_defender_ret0" : k == 1 ? "dead_attacker_ret0" : "heals_wounded_attacker_50pct",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B3-38] 0x6FC6EF70 SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c (stack=[pAttacker, pDefender, pDmg, nSkillId, nLevel], ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 370u);
    if (k >= 1) fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x96, 70, 0); /* slowtarget = 70% */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 1 ? 0u : 1u), (k == 1 ? 0u : 1u), 342u, 1u, 5002u, 5000u, 371u);
    c.nargs = 5; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_UNIT1; c.args[2] = 0u; c.args[3] = 0u; c.args[4] = 0u; c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1; ts[2] = 0; ts[3] = 0; ts[4] = 0;
    run_and_emit(0x6FC6EF70u, "SKILLS_ApplySlowTargetOnHit_6FC6EF70_113c", k,
                 k == 0 ? "zero_slow_stat_ret0" : k == 1 ? "player_defender_clamped_50" : "monster_defender_clamped_70",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-39] 0x6FC6F090 SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c (ecx=pGame, edx=_nEvent, stack=[pUnit, pTarget, pDmg, nSkillId, nLevel], ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 372u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x6400, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 343u, 1u, 5002u, 5000u, 373u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    if (k == 2) {
      stage_statlist_state(STAGE_UNIT0, 2u, 55, 500u, 76u, 2u); /* Iron Maiden state 55 */
    }
    stage_dmg_struct(STAGE_SCRATCH + 0x200u, 1u, 1u, (k == 0 ? 0 : 0x1000), 0, 0, 0);
    c.ecx = STAGE_GAME; c.edx = 0u;
    c.nargs = 5; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_UNIT1; c.args[2] = STAGE_SCRATCH + 0x200u; c.args[3] = 76u; c.args[4] = 2u; c.calleePop = 0x14u;
    ts[0] = STAGE_GAME; ts[1] = 0; ts[2] = STAGE_UNIT0; ts[3] = STAGE_UNIT1; ts[4] = STAGE_SCRATCH + 0x200u; ts[5] = 76; ts[6] = 2;
    run_and_emit(0x6FC6F090u, "SKILLS_IronMaidenThornsReflectDamage_6FC6F090_113c", k,
                 k == 0 ? "zero_phys_ret0" : k == 1 ? "no_im_state_ret0" : "reflects_phys_to_attacker",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B3-40] 0x6FC6F4D0 SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_room_self_adj(STAGE_ROOM0, STAGE_SCRATCH + 0x300u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 374u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 344u, (k == 2 ? 12u : 1u), 5002u, 5000u, 375u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x3200, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 74u; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 74; ts[3] = 2;
    run_and_emit(0x6FC6F4D0u, "SKILLS_SrvDo_CorpseExplosion_6FC6F4D0_113c", k,
                 k == 0 ? "no_target_ret0" : k == 1 ? "live_target_not_corpse_ret0" : "explodes_dead_corpse_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-41] 0x6FC6F7D0 SKILLS_SrvDo064_NonTownMeleeHitWithElemConversion_6FC6F7D0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1 ? 1u : 2u)); /* 1=town, 2=outside town */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 376u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 5000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 21, 15, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 22, 25, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 345u, 1u, 5002u, 5000u, 377u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 259u; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 259; ts[3] = 2;
    run_and_emit(0x6FC6F7D0u, "SKILLS_SrvDo064_NonTownMeleeHitWithElemConversion_6FC6F7D0_113c", k,
                 k == 0 ? "no_target_ret0" : k == 1 ? "target_in_town_ret0" : "outside_town_hits_and_converts",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-42] 0x6FC70470 SKILLS_ApplyDimVisionToTarget_6FC70470_113c (stack=[pGame, pUnit, pTarget, nSkillLevel], ret 0x10, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    U8(STAGE_GAME + 0x6Du) = (uint8_t)k; /* diff 0, 1, 2 scales duration via DifficultyLevels.txt */
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 378u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 346u, 1u, 5004u, 5000u, 379u);
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.args[3] = (uint32_t)(k + 1); c.calleePop = 0x10u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = k + 1;
    run_and_emit(0x6FC70470u, "SKILLS_ApplyDimVisionToTarget_6FC70470_113c", k,
                 k == 0 ? "norm_lvl1_applies_dimvision" : k == 1 ? "nm_lvl2_applies_dimvision" : "hell_lvl3_applies_dimvision",
                 &c, ts, 4, 0u, 0);
  }

  /* [B3-43] 0x6FCB14F0 SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 347u, 1u, 5000u, 5000u, 380u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x3200, 0);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x45, 1);
    if (k == 2) {
      uint32_t pSl = stage_statlist_state(STAGE_UNIT0, 2u, 0x6D, 0u, 0u, 0u);
      fn_SetStatIfValid((void *)(uintptr_t)pSl, 0xB0, 12, 0);
      fn_SetStatIfValid((void *)(uintptr_t)pSl, 0xB1, 150, 0);
    }
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = uArg; c.edx = 0x45u; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = 0x45; ts[2] = 0;
    run_and_emit(0x6FCB14F0u, "SKILLS_RestoreConvertedMonsterAlignmentAndStats_6FCB14F0_113c", k,
                 k == 0 ? "null_unit_assert_a2a" : k == 1 ? "no_savelist_restores_align" : "with_savelist_restores_hp_lvl",
                 &c, ts, 3, 0u, (k == 0 ? 1 : 0));
  }

  /* [B3-44] 0x6FCB18D0 SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c (stack=[pAttacker, pStatList, pDmg], ret 0xc, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 381u);
    uint32_t pSl = stage_statlist_state(STAGE_UNIT0, 2u, 125, 500u, 259u, 3u);
    fn_SetStatIfValid((void *)(uintptr_t)pSl, 0x15E, (k == 0 ? -1 : 259), 0);
    fn_SetStatIfValid((void *)(uintptr_t)pSl, 0x15F, 3, 0);
    fn_SetStatIfValid((void *)(uintptr_t)pSl, 321, (k == 2 ? 2 : 0), 0); /* charges */
    stage_dmg_struct(STAGE_SCRATCH + 0x200u, 1u, 1u, 0x2000, 0, 0, 0);
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pSl; c.args[2] = STAGE_SCRATCH + 0x200u; c.calleePop = 0xCu;
    /* Note TS parameter order: (m, pAttacker, pDmg, pStatList) */
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH + 0x200u; ts[2] = pSl;
    run_and_emit(0x6FCB18D0u, "SKILLS_ApplyProgressiveElemChargeAndConversion_6FCB18D0_113c", k,
                 k == 0 ? "invalid_skill_noop" : k == 1 ? "zero_charges_noop" : "stage2_fof_converts_and_adds_fire",
                 &c, ts, 3, 0u, 0);
  }

  /* [B3-45] 0x6FCB1A30 SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c (stack=[pAttacker, pStatList, pDmg], ret 0xc, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 382u);
    uint32_t pSl = stage_statlist_state(STAGE_UNIT0, 2u, 126, 500u, 274u, 3u);
    fn_SetStatIfValid((void *)(uintptr_t)pSl, 0x15E, (k == 0 ? -1 : 274), 0);
    fn_SetStatIfValid((void *)(uintptr_t)pSl, 0x15F, 3, 0);
    fn_SetStatIfValid((void *)(uintptr_t)pSl, 322, (k == 2 ? 2 : 0), 0);
    stage_dmg_struct(STAGE_SCRATCH + 0x200u, 1u, 1u, 0x2000, 0, 0, 0);
    c.nargs = 3; c.args[0] = STAGE_UNIT0; c.args[1] = pSl; c.args[2] = STAGE_SCRATCH + 0x200u; c.calleePop = 0xCu;
    ts[0] = STAGE_UNIT0; ts[1] = pSl; ts[2] = STAGE_SCRATCH + 0x200u;
    run_and_emit(0x6FCB1A30u, "SKILLS_ApplyProgressiveElemChargeWithFreeze_6FCB1A30_113c", k,
                 k == 0 ? "invalid_skill_noop" : k == 1 ? "zero_charges_noop" : "stage2_boi_adds_cold_and_freeze",
                 &c, ts, 3, 0u, 0);
  }

  /* [B3-46] 0x6FCB1F10 SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c (eax=pUnit, stack=[pStatList, pDmg], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 383u);
    uint32_t pSl = stage_statlist_state(STAGE_UNIT0, 2u, 122, 500u, 254u, 3u);
    fn_SetStatIfValid((void *)(uintptr_t)pSl, 0x15E, (k == 0 ? -1 : 254), 0);
    fn_SetStatIfValid((void *)(uintptr_t)pSl, 0x15F, 3, 0);
    fn_SetStatIfValid((void *)(uintptr_t)pSl, 318, (k == 2 ? 3 : 0), 0);
    stage_dmg_struct(STAGE_SCRATCH + 0x200u, 1u, 1u, 0x2000, 0, 0, 0);
    c.eax = STAGE_UNIT0; c.nargs = 2; c.args[0] = pSl; c.args[1] = STAGE_SCRATCH + 0x200u; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = pSl; ts[2] = STAGE_SCRATCH + 0x200u;
    run_and_emit(0x6FCB1F10u, "SKILLS_ApplyDelayedChargeDamageMultiplier_6FCB1F10_113c", k,
                 k == 0 ? "invalid_skill_noop" : k == 1 ? "zero_stage_noop" : "stage3_ts_adds_phys_mult",
                 &c, ts, 3, 0u, 0);
  }

  /* [B3-47] 0x6FCB2940 SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c (ecx=pGame, edx=pAttacker, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 384u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, 5000, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 348u, 1u, 5002u, 5000u, 385u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    int32_t sk = (k == 0) ? -1 : 255;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FCB2940u, "SKILLS_SrvDo067_DragonTalonKickHit_6FCB2940_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_target_ret0" : "kicks_monster_target_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B3-48] 0x6FCB2BB0 SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c (ebx=nSkillId, stack=[pGame, pAttacker, pDefender, pSkillsTxt, nLevel, bForceKB], ret 0x18, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 386u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 19, (k == 0 ? 1 : 5000), 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 349u, 1u, 5002u, 5000u, 389u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    uint32_t pSkillsBase = U32(U32(0x6FDE9E1Cu + g_com_rebase) + 0xB98u);
    uint32_t pSkTxt = pSkillsBase + 255u * 0x23Cu;
    uint32_t forceKb = (k == 2) ? 1u : 0u;
    c.ebx = 255u;
    c.nargs = 6; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = STAGE_UNIT1; c.args[3] = pSkTxt; c.args[4] = 2u; c.args[5] = forceKb; c.calleePop = 0x18u;
    ts[0] = 255; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = STAGE_UNIT1; ts[4] = pSkTxt; ts[5] = 2; ts[6] = (int64_t)forceKb;
    run_and_emit(0x6FCB2BB0u, "SKILLS_RollHitAndAllocKickProgressiveCombat_6FCB2BB0_113c", k,
                 k == 0 ? "low_ar_roll" : k == 1 ? "high_ar_no_kb" : "high_ar_force_kb",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [B3-49] 0x6FCB2DF0 SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 390u);
    if (k >= 2) {
      uint32_t pSk = stage_used_skill(STAGE_UNIT0, 255, 2);
      U32(pSk + 0x1Cu) = 77u; /* param1 cleared when no target */
    }
    if (k == 3) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 350u, 1u, 5001u, 5000u, 391u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    int32_t sk = (k == 0) ? -1 : 255;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FCB2DF0u, "SKILLS_SrvDo075_DragonTalonKickHit_6FCB2DF0_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_used_skill_ret0" : k == 2 ? "no_target_clears_param1" : "nearby_target_kicks",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }


  /* [B3-51] 0x6FCB3850 SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c (ecx=pAuraCtx, edx=pTargetUnit, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 394u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 352u, (k == 1 ? 12u : 1u), 5004u, 5000u, 395u);
    uint32_t pCtx  = STAGE_SCRATCH + 0x100u;
    uint32_t pDesc = STAGE_SCRATCH + 0x140u;
    U32(pCtx + 0x00u) = STAGE_GAME;
    U32(pCtx + 0x04u) = STAGE_UNIT0;
    U32(pCtx + 0x0Cu) = pDesc;
    U32(pDesc + 0x00u) = 71u;  /* skillId = Dim Vision */
    U32(pDesc + 0x04u) = 2u;   /* skillLvl */
    U32(pDesc + 0x08u) = 23u;  /* state = Dim Vision */
    U32(pDesc + 0x10u) = 250u; /* expireFrame */
    uint32_t tgtArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = pCtx; c.edx = tgtArg;
    ts[0] = pCtx; ts[1] = tgtArg;
    run_and_emit(0x6FCB3850u, "SKILLS_ApplyRadialAuraStatsAndBlindAiCallback_6FCB3850_113c", k,
                 k == 0 ? "null_target_ret0" : k == 1 ? "dead_monster_ret0" : "live_monster_applies_aura_ret1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [B3-52] 0x6FCB5370 SKILLS_AddProgressiveChargeStage_6FCB5370_113c (ebx=pUnit, stack=[pGame, nSkillId, nLevel, nState, nStatId], ret 0x14, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 396u);
    if (k == 2) {
      uint32_t pSl = stage_statlist_state(STAGE_UNIT0, 2u, 122, 200u, 254u, 2u);
      fn_SetStatIfValid((void *)(uintptr_t)pSl, 318, 1, 0);
    }
    int32_t sk = (k == 0) ? -1 : 254;
    c.ebx = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = STAGE_GAME; c.args[1] = (uint32_t)sk; c.args[2] = 2u; c.args[3] = 122u; c.args[4] = 318u; c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = sk; ts[3] = 2; ts[4] = 122; ts[5] = 318;
    run_and_emit(0x6FCB5370u, "SKILLS_AddProgressiveChargeStage_6FCB5370_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "fresh_charge_stage1_ret1" : "existing_stage1_inc_stage2_ret1",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [B3-53] 0x6FCB6D70 PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c (eax=pPetUnit, stack=[pGame, pOwnerPlayer], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 397u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_GAME + 0x10B0u) = STAGE_CLIENT; /* pClientList */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 363u, 353u, 1u, 5002u, 5000u, 398u);
    if (k == 2) {
      uint32_t pPets = STAGE_SCRATCH + 0x100u;
      uint32_t pArr  = STAGE_SCRATCH + 0x140u;
      uint32_t pNode = STAGE_SCRATCH + 0x280u;
      U32(STAGE_UDATA0 + 0x44u) = pPets;
      U32(pPets + 0x00u) = pArr;
      U32(pArr + 1u * 12u + 0x00u) = pNode;
      U32(pArr + 1u * 12u + 0x08u) = 1u;
      U32(pNode + 0x00u) = 363u;
      U32(pNode + 0x04u) = 353u;
    }
    uint32_t ownArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = STAGE_UNIT1; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = ownArg; c.calleePop = 8u;
    ts[0] = STAGE_UNIT1; ts[1] = STAGE_GAME; ts[2] = ownArg;
    run_and_emit(0x6FCB6D70u, "PETS_BroadcastPetAssignPacketToAllPlayers_6FCB6D70_113c", k,
                 k == 0 ? "null_owner_assert_402" : k == 1 ? "null_player_pets_ret0" : "found_pet_broadcasts_pkt9a_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [B3-54] 0x6FCB8070 PETS_UnsummonPetAndCheckNodeStillExists_6FCB8070_113c (eax=pPetUnit, edi=pPlayerUnit, stack=[pGame], ret 4, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 399u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 271u, 354u, 1u, 5002u, 5000u, 400u);
    if (k == 2) {
      /* Merc pet in slot 7: skipped by unsummon, node remains -> ret 1 */
      uint32_t pPets = STAGE_SCRATCH + 0x100u;
      uint32_t pArr  = STAGE_SCRATCH + 0x140u;
      uint32_t pNode = STAGE_SCRATCH + 0x280u;
      U32(STAGE_UDATA0 + 0x44u) = pPets;
      U32(pPets + 0x00u) = pArr;
      U32(pArr + 7u * 12u + 0x00u) = pNode;
      U32(pArr + 7u * 12u + 0x08u) = 1u;
      U32(pNode + 0x00u) = 271u;
      U32(pNode + 0x04u) = 354u;
    }
    uint32_t plrArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = STAGE_UNIT1; c.edi = plrArg; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT1; ts[1] = plrArg; ts[2] = STAGE_GAME;
    run_and_emit(0x6FCB8070u, "PETS_UnsummonPetAndCheckNodeStillExists_6FCB8070_113c", k,
                 k == 0 ? "null_player_assert_2d3" : k == 1 ? "null_player_pets_ret0" : "merc_type7_stays_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }

  /* [B3-55] 0x6FCB8120 PETS_OnPetOrMercKilled_6FCB8120_113c (stack=[pGame, pPlayerUnit, pPetUnit], ret 0xc, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 401u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_GAME + 0x10B0u) = STAGE_CLIENT;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 271u, 355u, 1u, 5002u, 5000u, 402u);
    if (k == 2) {
      uint32_t pPets = STAGE_SCRATCH + 0x100u;
      uint32_t pArr  = STAGE_SCRATCH + 0x140u;
      uint32_t pNode = STAGE_SCRATCH + 0x280u;
      U32(STAGE_UDATA0 + 0x44u) = pPets;
      U32(pPets + 0x00u) = pArr;
      U32(pArr + 7u * 12u + 0x00u) = pNode;
      U32(pArr + 7u * 12u + 0x08u) = 1u;
      U32(pNode + 0x00u) = 271u;
      U32(pNode + 0x04u) = 355u;
    }
    uint32_t plrArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = plrArg; c.args[2] = STAGE_UNIT1; c.calleePop = 0xCu;
    ts[0] = STAGE_GAME; ts[1] = plrArg; ts[2] = STAGE_UNIT1;
    run_and_emit(0x6FCB8120u, "PETS_OnPetOrMercKilled_6FCB8120_113c", k,
                 k == 0 ? "null_player_assert_2a0" : k == 1 ? "null_player_pets_noop" : "merc_type7_broadcasts_death",
                 &c, ts, 3, 0u, (k == 0 ? 1 : 0));
  }

  /* [B3-56] 0x6FCB8490 SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c (eax=pCasterUnit, stack=[pCorpseUnit, nSkillId, nLevel, bSkipRoll], ret 0x10, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 403u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x1000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 0x1000, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 356u, 12u, 5002u, 5000u, 404u);
    int32_t sk = (k == 0) ? -1 : 124;
    uint32_t crpArg = (k == 1) ? 0u : STAGE_UNIT1;
    c.eax = STAGE_UNIT0;
    c.nargs = 4; c.args[0] = crpArg; c.args[1] = (uint32_t)sk; c.args[2] = 3u; c.args[3] = 1u; c.calleePop = 0x10u;
    /* Note TS parameter order: (m, pCasterUnit, nSkillId, pCorpseUnit, nLevel, bSkipRoll) */
    ts[0] = STAGE_UNIT0; ts[1] = sk; ts[2] = crpArg; ts[3] = 3; ts[4] = 1;
    run_and_emit(0x6FCB8490u, "SKILLS_TryRedeemCorpseHealLifeAndMana_6FCB8490_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "null_corpse_ret0" : "redeems_corpse_heals_hp_mana_ret1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B3-57] 0x6FCB87D0 SKILLS_RollUnitWeaponBasePhysicalDamage256ths_6FCB87D0_113c (esi=pUnit, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 405u + (uint32_t)k * 37u);
    if (k >= 1) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x15, (k == 1 ? 10 : 25), 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x16, (k == 1 ? 20 : 60), 0);
    }
    c.esi = STAGE_UNIT0;
    ts[0] = STAGE_UNIT0;
    run_and_emit(0x6FCB87D0u, "SKILLS_RollUnitWeaponBasePhysicalDamage256ths_6FCB87D0_113c", k,
                 k == 0 ? "unarmed_default_1_2" : k == 1 ? "unarmed_10_20" : "unarmed_25_60",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B3-58] 0x6FCB8950 SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 357u, 1u, 5000u, 5000u, 408u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x3200, 0);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x45, 1);
    if (k == 2) {
      uint32_t pSl = stage_statlist_state(STAGE_UNIT0, 2u, 0x6D, 0u, 0u, 0u);
      fn_SetStatIfValid((void *)(uintptr_t)pSl, 0xB0, 14, 0);
      fn_SetStatIfValid((void *)(uintptr_t)pSl, 0xB1, 180, 0);
    }
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = uArg; c.edx = 0x45u; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = 0x45; ts[2] = 0;
    run_and_emit(0x6FCB8950u, "SKILLS_RestoreMindBlastConvertedMonster_6FCB8950_113c", k,
                 k == 0 ? "null_unit_assert_a2a" : k == 1 ? "no_savelist_restores_align" : "with_savelist_restores_stats",
                 &c, ts, 3, 0u, (k == 0 ? 1 : 0));
  }

  /* [B3-59] 0x6FCB9B60 SKILLS_ScalePoisonAndCurseDurations_6FCB9B60_113c (edi=nDurationPct, stack=[pGame, pUnit], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 409u);
    if (k == 1) {
      stage_statlist_state(STAGE_UNIT0, 2u, 2, 200u, 0u, 0u); /* STATE_POISON (2), expire=200 */
    } else if (k == 2) {
      stage_statlist_state(STAGE_UNIT0, 2u, 9, 300u, 0u, 0u); /* STATE_AMPLIFYDAMAGE (9), expire=300 */
    }
    c.edi = 50u; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.calleePop = 8u;
    ts[0] = 50; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FCB9B60u, "SKILLS_ScalePoisonAndCurseDurations_6FCB9B60_113c", k,
                 k == 0 ? "clean_unit_ret0" : k == 1 ? "poison_scaled_50pct_ret1" : "curse_scaled_50pct_ret1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [B3-60] 0x6FCBF4A0 SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c (eax=pGame, edx=pUnit, ecx=dwOwnerItemGuid, stack=[pSkill], ret 4, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 410u);
    uint32_t pSk = stage_used_skill(STAGE_UNIT0, 71, 2);
    if (k >= 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_wand, 77u, 1u, 0u, 0u, 411u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 4u, 0u);
      if (k == 3) {
        /* Stat 204 (ITEM_CHARGED_SKILL), layer=(71<<6)|2, val=(5<<8)|10 */
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 204, (5 << 8) | 10, (71 << 6) | 2);
      }
    }
    uint32_t gArg = (k == 0) ? 0u : STAGE_GAME;
    c.eax = gArg; c.edx = STAGE_UNIT0; c.ecx = 77u; c.nargs = 1; c.args[0] = pSk; c.calleePop = 4u;
    ts[0] = gArg; ts[1] = STAGE_UNIT0; ts[2] = 77; ts[3] = pSk;
    run_and_emit(0x6FCBF4A0u, "SKILLS_ConsumeEquippedItemSkillCharge_6FCBF4A0_113c", k,
                 k == 0 ? "null_game_assert_2d3" : k == 1 ? "item_not_found_ret0" : k == 2 ? "item_no_charges_ret0" : "decrements_charge_ret1",
                 &c, ts, 4, 0xFFFFFFFFu, (k == 0 ? 1 : 0));
  }
}

/* ------------------------------- Batch 4: 20 Trade/Client/Party/Items/Skills Lo-VAs */

static void emit_batch_4(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [B4-01] 0x6FC91B00 PLRTRADE_MirrorItemToPartnerTradeGrid_6FC91B00_113c (eax=pItemUnit, ecx=pGame, stack=[pPlayerUnit], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 501u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_UNIT0 + 0x64u)  = 99u; /* partner GUID not found */
    U32(STAGE_UNIT0 + 0x68u)  = (k == 0) ? 2u : 0u;
    U8(STAGE_UNIT0 + 0x6Cu)   = (k == 0) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_sword, 501u, 0u, 0u, 0u, 502u);
    uint32_t gArg = (k == 1) ? 0u : STAGE_GAME;
    c.eax = STAGE_UNIT1; c.ecx = gArg; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_UNIT1; ts[1] = gArg; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FC91B00u, "PLRTRADE_MirrorItemToPartnerTradeGrid_6FC91B00_113c", k,
                 k == 0 ? "busy_interact_sends_pkt77" : k == 1 ? "null_game_assert_2d3" : "partner_missing_sends_pkt77",
                 &c, ts, 3, 0u, (k == 1 ? 1 : 0));
  }

  /* [B4-02] 0x6FC47030 PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c (eax=pSkill, stack=[pGame, pUnit, nX, nY], ret 0x10, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 503u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 401u, 1u, 5004u, 5002u, 504u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pSk = 0u;
    if (k >= 1) {
      pSk = stage_used_skill(STAGE_UNIT0, 143, 2);
      U32(pSk + 0x24u) = 1u; /* nParam3 = targetType */
      U32(pSk + 0x28u) = (k == 2) ? 401u : 999u; /* nParam4 = targetId */
    }
    c.eax = pSk;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = STAGE_UNIT0; c.args[2] = 5000u; c.args[3] = 5000u; c.calleePop = 0x10u;
    ts[0] = pSk; ts[1] = STAGE_GAME; ts[2] = STAGE_UNIT0; ts[3] = 5000; ts[4] = 5000;
    run_and_emit(0x6FC47030u, "PLRMODE_SetupRetreatFromSkillTargetPath_6FC47030_113c", k,
                 k == 0 ? "null_skill_ret0" : k == 1 ? "target_not_found_ret0" : "sets_retreat_path_ret1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [B4-03] 0x6FC58930 PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c (esi=pPlayer, ebx=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 505u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    if (k == 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 2u, 0x10Bu, 402u, 0u, 5002u, 5000u, 506u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 2u;
      U32(STAGE_UNIT0 + 0x64u) = 402u;
    } else if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 148u, 403u, 1u, 5002u, 5000u, 507u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 1u;
      U32(STAGE_UNIT0 + 0x64u) = 403u;
    }
    c.esi = STAGE_UNIT0; c.ebx = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC58930u, "PLAYER_CloseActiveInteractAndSendPacket62_6FC58930_113c", k,
                 k == 0 ? "inactive_sends_zero_pkt62" : k == 1 ? "object_deactivates_and_pkt62" : "npc_clears_and_pkt62",
                 &c, ts, 2, 0u, 0);
  }

  /* [B4-05] 0x6FC6AE90 CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c (eax=pOutBuf, ecx=pClient, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 508u);
    if (k == 2) {
      U8(STAGE_CLIENT + 0x3D4u)  = 1u;
      U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0;
    }
    uint32_t cliArg = (k == 0) ? 0u : STAGE_CLIENT;
    c.eax = STAGE_SCRATCH; c.ecx = cliArg;
    ts[0] = STAGE_SCRATCH; ts[1] = cliArg;
    run_and_emit(0x6FC6AE90u, "CLIENTS_BuildPlayerPortraitDescString_6FC6AE90_113c", k,
                 k == 0 ? "null_client_assert_fb" : k == 1 ? "no_player_header_only" : "builds_sorc_portrait_string",
                 &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [B4-06] 0x6FC7D690 D2Game_6FC7D690_113c (ecx=pObjInteractArg, ret, u32) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 120u);
    uint32_t oMode = (k >= 2) ? 2u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 0x222u, 404u, oMode, 5000u, 5000u, 509u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5002u, 5000u, 510u);
    if (k >= 1) {
      stage_quest_node(0x23u, 1u, 1u);
      U8(STAGE_QUESTEX0 + 0x00u) = (k == 3) ? 1u : 0u;
      U8(STAGE_QUESTEX0 + 0x48u) = (k == 3) ? 1u : 0u;
    }
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, STAGE_UNIT1, 0u, 0x222u);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC7D690u, "D2Game_6FC7D690_113c", k,
                 k == 0 ? "no_quest23_ret0" : k == 1 ? "mode0_qdata0_sets_mode1" : k == 2 ? "mode2_qdata0_sets_sound13" : "mode2_flag48_resets_mode0",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B4-07] 0x6FC7E2A0 D2Game_6FC7E2A0_113c (ecx=pObjInteractArg, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 120u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, g_obj_chest, 405u, 0u, 5000u, 5000u, 511u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5002u, 5000u, 512u);
    U32(STAGE_UDATA1 + 0x9Cu) = STAGE_CLIENT;
    stage_player_qbits(STAGE_UDATA1, STAGE_QBITS0, 0u);
    if (k >= 1) {
      stage_quest_node(0x23u, 0u, 1u);
      U32(STAGE_QUEST0 + 0xE0u) = 0x27u;
      if (k == 2) {
        set_qbit(STAGE_QBITS0, 0x27u, 0u);
      }
    }
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, STAGE_UNIT1, 0u, g_obj_chest);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC7E2A0u, "D2Game_6FC7E2A0_113c", k,
                 k == 0 ? "no_quest23_ret0" : k == 1 ? "not_done_speech13" : "done_opens_door_schedules_ev1",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B4-08] 0x6FC8D620 D2Game_6FC8D620_113c (ecx=pObjInteractArg, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1 ? 0x4Au : 2u));
    uint32_t oCls = (k == 1) ? g_obj_chest1 : g_obj_chest;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, oCls, 406u, (k == 2 ? 2u : 0u), 5000u, 5000u, 513u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5002u, 5000u, 514u);
    stage_op_args(STAGE_SCRATCH, STAGE_GAME, STAGE_UNIT0, STAGE_UNIT1, 0u, oCls);
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC8D620u, "D2Game_6FC8D620_113c", k,
                 k == 0 ? "mode0_chest_schedules_ev1" : k == 1 ? "mode0_chest1_schedules_ev1" : "mode2_other_lvl_noop",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B4-09] 0x6FC93570 D2Game_6FC93570_113c (ecx=pGame, edx=pPlayer, stack=[arg1, arg2], ret 8, void) */
  for (int k = 0; k < 5; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 515u);
    U32(STAGE_UNIT0 + 0xC8u)  = 0x00400000u;
    U32(STAGE_UDATA0 + 0x5Cu) = STAGE_SCRATCH + 0x100u;
    static const uint32_t stList[5] = { 2u, 7u, 0x0Eu, 8u, 8u };
    U32(STAGE_UDATA0 + 0x50u) = stList[k];
    U32(STAGE_SCRATCH + 0x114u) = (k == 4) ? 1u : 0u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    run_and_emit(0x6FC93570u, "D2Game_6FC93570_113c", k,
                 k == 0 ? "state2_noop" : k == 1 ? "state7_to_8_ev0d" : k == 2 ? "state0e_to_0f_ev0d" : k == 3 ? "state8_no_flag14_to_3" : "state8_flag14_to_0b",
                 &c, ts, 4, 0u, 0);
  }

  /* [B4-10] 0x6FC93AA0 D2Game_6FC93AA0_113c (eax=pGame, edi=pPlayer, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 516u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5002u, 5000u, 517u);
    U32(STAGE_UDATA1 + 0x9Cu) = STAGE_CLIENT;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) {
      U8(STAGE_UNIT0 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT0 + 0x68u) = 0u;
      U32(STAGE_UNIT0 + 0x64u) = 2u;
    }
    if (k == 2) {
      U8(STAGE_UNIT1 + 0x6Cu)  = 1u;
      U32(STAGE_UNIT1 + 0x68u) = 0u;
      U32(STAGE_UNIT1 + 0x64u) = 1u;
    }
    c.eax = STAGE_GAME; c.edi = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC93AA0u, "D2Game_6FC93AA0_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "one_sided_clears_self" : "mutual_trade_cancels_both_sends_77",
                 &c, ts, 2, 0u, 0);
  }

  /* [B4-11] 0x6FC99910 PLAYER_LootPlayerCorpseUnit_6FC99910_113c (eax=pLooterPlayer, ecx=pGame, stack=[pCorpseUnit], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 518u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 17u, 5002u, 5000u, 519u);
    uint32_t pInv0 = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    uint32_t pInv1 = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
    U32(STAGE_UNIT0 + 0x60u) = pInv0;
    U32(STAGE_UNIT1 + 0x60u) = pInv1;
    if (k >= 1) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT1, 7, 1); /* STATE_PLAYERBODY */
      U32(pInv1 + 0x1Cu) = (k == 2) ? 1u : 99u; /* dwLeftItemGuid / owner guid */
      if (k == 2) {
        fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x0D, 500, 0); /* stored exp */
      }
    }
    c.eax = STAGE_UNIT0; c.ecx = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    /* Note TS parameter order: (m, pGame, pLooterPlayer, pCorpseUnit) */
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1;
    run_and_emit(0x6FC99910u, "PLAYER_LootPlayerCorpseUnit_6FC99910_113c", k,
                 k == 0 ? "no_state7_noop" : k == 1 ? "wrong_owner_cannot_loot" : "matching_owner_loots_exp_and_corpse",
                 &c, ts, 3, 0u, 0);
  }

  /* [B4-12] 0x6FCBC840 PARTY_LeavePartyForPlayer_6FCBC840_113c (eax=pPlayerUnit, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 4; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 1 ? 1u : 0u), 0u, 1u, 1u, 5000u, 5000u, 520u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U16(STAGE_CLIENT + 0x172u) = (k == 3) ? 1u : 0xFFFFu;
    if (k == 3) {
      uint32_t pCtrl = STAGE_SCRATCH + 0x100u;
      uint32_t pSub  = STAGE_SCRATCH + 0x120u;
      uint32_t pMem  = STAGE_SCRATCH + 0x140u;
      U32(STAGE_GAME + 0x1D2Cu) = pCtrl;
      U32(pCtrl + 0x04u) = pSub;
      U16(pSub + 0x00u)  = 1u;
      U32(pSub + 0x04u)  = pMem;
      U32(pMem + 0x00u)  = 1u;
    }
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = uArg; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCBC840u, "PARTY_LeavePartyForPlayer_6FCBC840_113c", k,
                 k == 0 ? "null_player_assert_130" : k == 1 ? "non_player_assert_130" : k == 2 ? "no_party_ffff_noop" : "leaves_subparty_unlinks_member",
                 &c, ts, 2, 0u, (k <= 1 ? 1 : 0));
  }

  /* [B4-13] 0x6FC33A30 ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c (edi=pItem, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t cls = (k == 2) ? g_item_throw : g_item_sword; /* neither has a set item calling Fog TxtLink */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, cls, 502u, 0u, 0u, 0u, 521u + (uint32_t)k);
    U32(STAGE_UDATA0 + 0x18u) = 0x12345679u + (uint32_t)k * 17u;
    U32(STAGE_UDATA0 + 0x1Cu) = 0x29Au;
    U16(STAGE_UDATA0 + 0x3Cu) = 100u; /* wItemFormat */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x48, (k == 2 ? 200 : 10), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x49, (k == 2 ? 200 : 20), 0);
    uint32_t itArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.edi = itArg;
    ts[0] = itArg;
    run_and_emit(0x6FC33A30u, "ITEMS_ApplyCraftedOrSetItemCell_6FC33A30_113c", k,
                 k == 0 ? "null_item_ret0" : k == 1 ? "sword_doubles_durability" : "jav_clamps_durability_255",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }

  /* [B4-14] 0x6FC2DBD0 SKILLS_SrvDo_ImpTeleportOrMountSiegeBeast_6FC2DBD0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 407u, 1u, 5000u, 5000u, 524u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 408u, 1u, 5004u, 5000u, 525u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    int32_t sk = (k == 0) ? -1 : (k == 1) ? 74 : 254; /* 74 auraSt=-1; 254 auraSt=122 */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FC2DBD0u, "SKILLS_SrvDo_ImpTeleportOrMountSiegeBeast_6FC2DBD0_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_aurastate_ret0" : "valid_skill_checks_mount",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-14] 0x6FCB2360 SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c (eax=pAttacker, stack=[pGame, pDmg, pDefender, nSkillId, nLevel], ret 0x14, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 528u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0, 50, 0); /* strength = 50 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 2, 50, 0); /* dexterity = 50 */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 410u, 1u, 5002u, 5000u, 529u);
    stage_dmg_struct(STAGE_SCRATCH + 0x200u, 0u, 1u, 0, 0, 0, 0);
    if (k == 2) S32(STAGE_SCRATCH + 0x20Cu) = 100; /* +100% physPct */
    uint32_t lvl = (k == 0) ? 1u : 5u;
    c.eax = STAGE_UNIT0;
    c.nargs = 5; c.args[0] = STAGE_GAME; c.args[1] = STAGE_SCRATCH + 0x200u; c.args[2] = STAGE_UNIT1; c.args[3] = 255u; c.args[4] = lvl; c.calleePop = 0x14u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = STAGE_SCRATCH + 0x200u; ts[3] = STAGE_UNIT1; ts[4] = 255; ts[5] = (int64_t)lvl;
    run_and_emit(0x6FCB2360u, "SKILLS_CalcKickAndProgressiveFinishDamage_6FCB2360_113c", k,
                 k == 0 ? "dtalon_lvl1_kick_dmg" : k == 1 ? "dtalon_lvl5_kick_dmg" : "dtalon_lvl5_plus100pct",
                 &c, ts, 6, 0u, 0);
  }

  /* [B4-17] 0x6FCB3680 SKILLS_SrvDo252_DragonFlight_6FCB3680_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 2 ? 0u : STAGE_ROOM0), 0u, 6u, 1u, 1u, 5000u, 5000u, 530u);
    U32(STAGE_UNIT0 + 0xC4u) = 0x44u;
    U32(STAGE_UNIT0 + 0x38u) = (k == 2) ? 0x200u : 0x100u; /* even frame 2 vs odd frame 1 */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 411u, 1u, 5002u, 5000u, 531u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k >= 1) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    int32_t sk = (k == 0) ? -1 : 275;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FCB3680u, "SKILLS_SrvDo252_DragonFlight_6FCB3680_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "odd_frame_executes_kick" : "even_frame_null_room_ret0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-16] 0x6FCB4F50 SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 540u + (uint32_t)k * 13u);
    int32_t sk = (k == 0) ? -1 : (k == 1) ? 68 : 280;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FCB4F50u, "SKILLS_SrvDo_SpawnChargedGuidedNova_6FCB4F50_113c", k,
                 k == 0 ? "invalid_skill_steps_seed" : k == 1 ? "no_missile_steps_seed" : "no_coords_steps_seed",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-17] 0x6FCB5560 SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 552u);
    U32(STAGE_UNIT0 + 0xC4u) = 0x44u;
    if (k >= 1) {
      stage_used_skill(STAGE_UNIT0, (k == 1 ? 68 : 280), 2);
    }
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 413u, 1u, 5006u, 5002u, 553u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    }
    int32_t sk = (k == 1) ? 68 : 280;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FCB5560u, "SKILLS_SrvDo_FireChargedChannelMissile_6FCB5560_113c", k,
                 k == 0 ? "no_skill_ret0" : k == 1 ? "no_missile_ret0" : "fires_channel_missile",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-22] 0x6FCB5BC0 SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 554u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 9, 0x10000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 8, 0x10000, 0);
    if (k == 2) {
      stage_used_skill(STAGE_UNIT0, 280, 2);
    }
    int32_t sk = (k == 0) ? -1 : 280;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FCB5BC0u, "SKILLS_SrvDo077_ChannelChargedStream_6FCB5BC0_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_skill_ret0" : "starts_channel_stream",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-23] 0x6FCB5FE0 SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c (ecx=pGame, edx=pUnit, stack=[nSkillId, nLevel], ret 8, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 6u, 1u, 1u, 5000u, 5000u, 555u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 414u, 1u, 5002u, 5000u, 556u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 2) stage_path_target(STAGE_PATH0, STAGE_UNIT1);
    int32_t sk = (k == 0) ? -1 : 255;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)sk; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = sk; ts[3] = 2;
    run_and_emit(0x6FCB5FE0u, "SKILLS_SrvDo078_DragonTalonMultiKick_6FCB5FE0_113c", k,
                 k == 0 ? "invalid_skill_ret0" : k == 1 ? "no_target_ret0" : "multi_kick_on_target",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [B4-24] 0x6FCBA630 AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c (ecx=pAuraCtx, edx=pTargetUnit, ret, u32) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    stage_timer_queue();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 557u);
    uint32_t tType = (k == 2) ? 0u : 1u;
    uint32_t tCls  = (k == 0) ? 9999u : 1u; /* 9999 invalid; 1 non-undead; k=2 player uType=0 */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, tType, tCls, 415u, 1u, 5002u, 5000u, 558u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x6400, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x6400, 0);
    uint32_t pCtx = STAGE_SCRATCH + 0x100u;
    uint32_t pSub = STAGE_SCRATCH + 0x140u;
    U32(pCtx + 0x00u) = STAGE_GAME;
    U32(pCtx + 0x04u) = STAGE_UNIT0;
    U32(pCtx + 0x0Cu) = pSub;
    U32(pSub + 0x00u) = 119u; /* Sanctuary */
    U32(pSub + 0x04u) = 2u;   /* lvl */
    U32(pSub + 0x08u) = 47u;  /* state 47 */
    U32(pSub + 0x48u) = 0u;
    c.ecx = pCtx; c.edx = STAGE_UNIT1;
    ts[0] = pCtx; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FCBA630u, "AURAS_ApplyUndeadPulseBuffAndDamageCallback_6FCBA630_113c", k,
                 k == 0 ? "invalid_monclass_ret0" : k == 1 ? "non_undead_ret0" : "player_target_applies_pulse",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-w13-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-w13] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
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
    fprintf(stderr, "[k6-w13] LoadLibraryA failed (%p %p %p %p %p %p %p)\n",
            (void *)hStorm, (void *)g_hFog, (void *)hLang, (void *)hCmp,
            (void *)g_hCom, (void *)hNet, (void *)g_hGame);
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-w13] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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

  fn_CreateStatListEx      = (Com_CreateStatListEx_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11166));
  fn_SetUnitStat           = (Com_SetUnitStat_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10887));
  fn_AllocStatList         = (Com_AllocStatList_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11013));
  fn_SetStatIfValid        = (Com_SetStatIfValid_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10188));
  fn_SetStatListState      = (Com_SetStatListState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10785));
  fn_MergeStatLists        = (Com_MergeStatLists_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10807));
  fn_ToggleGfxState        = (Com_ToggleGfxState_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10945));
  fn_AllocSkillList        = (Com_AllocSkillList_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10856));
  fn_SetSkillLevel         = (Com_SetSkillLevel_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10302));
  fn_AllocInventory        = (Com_AllocInventory_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10387));
  fn_SetCursorItem         = (Com_SetCursorItem_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10466));
  fn_PlaceItemInBodyLoc    = (Com_PlaceItemInBodyLoc_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11041));
  fn_CheckItemTypeId       = (Com_CheckItemTypeId_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10744));
  fn_UnitsIsDoor           = (Com_UnitsIsDoor_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11020));
  fn_HasObjectSubClassBit0 = (Com_HasObjectSubClassBit0_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(10934));
  fn_CheckCompactSave      = (Com_CheckCompactSave_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11064));
  fn_GetItemType           = (Com_GetItemType_t)(uintptr_t)GetProcAddress(g_hCom, MAKEINTRESOURCEA(11088));

  if (!fn_CreateStatListEx || !fn_SetUnitStat || !fn_AllocStatList || !fn_SetStatIfValid ||
      !fn_SetStatListState || !fn_MergeStatLists || !fn_ToggleGfxState || !fn_AllocSkillList ||
      !fn_SetSkillLevel || !fn_AllocInventory || !fn_SetCursorItem || !fn_PlaceItemInBodyLoc ||
      !fn_CheckItemTypeId || !fn_UnitsIsDoor || !fn_HasObjectSubClassBit0 ||
      !fn_CheckCompactSave || !fn_GetItemType) {
    fprintf(stderr, "[k6-w13] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-w13] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_batch_1();
  emit_batch_2();
  emit_batch_3();
  emit_batch_4();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-w13] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
