/*
 * k6-w8-d2game-emitter.c — Milestone #37 [K6] Wave 8 Real-DLL Differential Emitter (Lo-VA Part 2)
 *
 * Loads real Diablo II: Lord of Destruction v1.13c DLLs (Storm.dll, Fog.dll,
 * D2Lang.dll, D2CMP.dll, D2Common.dll, D2Net.dll, D2Game.dll) under headless Wine,
 * hydrates canonical sgptDataTables (0x20000000..0x206F7FFF + D2Common .data/.bss)
 * from d2game-datatbls-113c.img, hooks Fog.#10024 (assert) and Fog.#10042..10047
 * (deterministic bump allocator), and executes 150 net-new real D2Game.dll functions
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

/* Discovered real v1.13c item/object/missile/monster/skill IDs */
static uint32_t g_item_ring   = 0;
static uint32_t g_item_bkd    = 0; /* "bkd " Scroll of Inifuss (deciphered) */
static uint32_t g_item_bks    = 0; /* "bks " Scroll of Inifuss (undeciphered) */
static uint32_t g_item_malus  = 0; /* "hdm " Horadric Malus */
static uint32_t g_item_potion = 0; /* "ice " Malah's Potion */
static uint32_t g_item_sword  = 0; /* "ssd " Short Sword (weapon with durability) */
static uint32_t g_item_box    = 0; /* "box " Horadric Cube */
static uint32_t g_item_armor  = 0; /* "cap " Cap */
static uint32_t g_missile_cold     = 0; /* MissilesTxt with dwElemLen (+0x78) > 0 */
static uint32_t g_missile_drain    = 0; /* MissilesTxt with dwParam[0] (+0x4C) > 0 */
static uint32_t g_missile_sizehit  = 0; /* MissilesTxt with dwHitPar[0] (+0x78) > 0 & dwHitPar[1] (+0x7C) > 0 */
static uint32_t g_missile_srvdmg5  = 0; /* MissilesTxt with small dwParam[0] */
static uint32_t g_mon_reanim       = 0; /* MonStatsTxt with wAid[0] (+0x80) > 0 */
static uint32_t g_mon_bloodgolem   = 0; /* MonStatsTxt with wSkill1 (+0x170) >= 0 */
static uint32_t g_mon_fetish       = 0x8Du; /* Fetish baseId = 0x8D */
static uint32_t g_mon_overlord_min = 0x1C5u; /* Enslaved/Minion baseId = 0x1C5 */

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
              "[k6-w8] SETUP/INIT FAULT after %u emitted: code=0x%08lX eip=%p (game=0x%08lX com=0x%08lX) addr=0x%08X\n",
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
      fprintf(stderr, "[k6-w8] setup bump overflow (size=%u)\n", dwSize);
      TerminateProcess(GetCurrentProcess(), 21);
    }
    memset((void *)(uintptr_t)p, 0, dwSize);
    g_setup_top = p + dwSize;
    record_alloc_size(p, dwSize);
    return (void *)(uintptr_t)p;
  } else {
    uint32_t p = (g_heap_top + 3u) & ~3u;
    if (p + dwSize > HEAP_BASE + HEAP_SIZE) {
      fprintf(stderr, "[k6-w8] heap bump overflow (size=%u)\n", dwSize);
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
      fprintf(stderr, "[k6-w8] missing Fog.#%u\n", hooks[i].ord);
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
    fprintf(stderr, "[k6-w8] failed to open %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 10);
  }
  uint32_t hdr[8];
  if (fread(hdr, 4, 8, fp) != 8 || hdr[4] != 4100u) {
    fprintf(stderr, "[k6-w8] invalid PAGEIMG header in %s\n", imgPath);
    TerminateProcess(GetCurrentProcess(), 11);
  }
  uint32_t recCount = hdr[5];

  DWORD oldProt = 0;
  VirtualProtect((void *)(0x6FDE9000u + g_com_rebase), 0xA000u, PAGE_READWRITE, &oldProt);

  uint8_t pageBuf[4100];
  for (uint32_t i = 0; i < recCount; i++) {
    if (fread(pageBuf, 1, 4100, fp) != 4100) {
      fprintf(stderr, "[k6-w8] short read at page %u\n", i);
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
      fprintf(stderr, "[k6-w8] JSON buffer overflow\n");
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

  /* Default pGame difficulty = 0, expansion = 1, dwGameFrame = 100 */
  U8(STAGE_GAME + 0x6Du)  = 0u;
  U32(STAGE_GAME + 0x70u) = 1u;
  U32(STAGE_GAME + 0xA8u) = 100u;

  /* Pre-link 2 clean 0x208-byte S2C packet nodes on STAGE_CLIENT free-list (+0x1C0) */
  U32(STAGE_PKTNODE0 + 0x204u) = STAGE_PKTNODE1;
  U32(STAGE_CLIENT + 0x1C0u)   = STAGE_PKTNODE0;
  U32(STAGE_CLIENT + 0x1A8u)   = STAGE_GAME;
}

static uint32_t stage_timer_queue(void) {
  uint32_t pTimer = (uint32_t)(uintptr_t)bump_alloc(0xA20u);
  uint32_t pChunk = (uint32_t)(uintptr_t)bump_alloc(0x7088u);
  for (uint32_t i = 0; i < 7u; i++) {
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
            "[k6-w8] HW FAULT at %s (0x%08X) case %d (%s): code=0x%08X eip=0x%08X (gameVA=0x%08lX) addr=0x%08X\n",
            fnName, canonVa, caseIdx, label, g_fault_code, g_fault_eip, (unsigned long)gameOff, g_fault_addr);
    TerminateProcess(GetCurrentProcess(), 30);
  }

  if (expectAssert && g_thunk_faulted != 2) {
    fprintf(stderr, "[k6-w8] EXPECTED ASSERT did not fire at %s (0x%08X) case %d (%s)\n",
            fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 31);
  }
  if (!expectAssert && g_thunk_faulted == 2) {
    fprintf(stderr, "[k6-w8] UNEXPECTED Fog.#10024 assert line %u at %s (0x%08X) case %d (%s)\n",
            g_assert_line, fnName, canonVa, caseIdx, label);
    TerminateProcess(GetCurrentProcess(), 32);
  }

  if (g_thunk_faulted == 0) {
    uint32_t actualPop = g_thunk_esp_after - g_thunk_esp_before;
    if (actualPop != spec->calleePop) {
      fprintf(stderr,
              "[k6-w8] ESP MISMATCH at %s (0x%08X) case %d (%s): actualPop=0x%X expected=0x%X\n",
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
    if (!g_item_malus && code == 0x206D6468u) g_item_malus = id;  /* "hdm " */
    if (!g_item_bkd && code == 0x20646B62u) g_item_bkd = id;      /* "bkd " */
    if (!g_item_bks && code == 0x20736B62u) g_item_bks = id;      /* "bks " */
    if (!g_item_potion && code == 0x20656369u) g_item_potion = id;/* "ice " */
    if (!g_item_sword && code == 0x20647373u) g_item_sword = id;  /* "ssd " */
    if (!g_item_box && code == 0x20786F62u) g_item_box = id;      /* "box " */
    if (!g_item_armor && code == 0x20706163u) g_item_armor = id;  /* "cap " */
    if (!g_item_ring && fn_CheckItemTypeId((void *)(uintptr_t)STAGE_UNIT2, 0x0A)) g_item_ring = id;
  }

  /* Discover canonical MissilesTxt and MonStatsTxt IDs from sgptDataTables */
  uint32_t pTables = U32(0x6FDE9E1Cu + g_com_rebase);
  if (pTables != 0u) {
    uint32_t pMis = U32(pTables + 0xB64u);
    uint32_t nMis = U32(pTables + 0xB6Cu);
    for (uint32_t id = 1u; id < nMis; id++) {
      uint32_t rec = pMis + id * 0x1A4u;
      int32_t elemLen = S32(rec + 0x78u);
      int32_t hitPar1 = S32(rec + 0x7Cu);
      int32_t par0    = S32(rec + 0x4Cu);
      if (!g_missile_cold && elemLen > 20) g_missile_cold = id;
      if (!g_missile_drain && par0 >= 10 && par0 <= 100) g_missile_drain = id;
      if (!g_missile_sizehit && elemLen >= 1 && hitPar1 >= 50) g_missile_sizehit = id;
      if (!g_missile_srvdmg5 && par0 == 0) g_missile_srvdmg5 = id;
    }
    uint32_t pMon = U32(pTables + 0xA78u);
    uint32_t nMon = U32(pTables + 0xA80u);
    for (uint32_t id = 1u; id < nMon; id++) {
      uint32_t rec = pMon + id * 0x1A8u;
      int16_t aid0 = S16(rec + 0x80u);
      int16_t aip1 = S16(rec + 0x56u);
      int16_t sk0  = S16(rec + 0x170u);
      if (!g_mon_reanim && aid0 >= 30 && aip1 > 0) g_mon_reanim = id;
      if (!g_mon_bloodgolem && sk0 >= 0 && id >= 289u && id <= 295u) g_mon_bloodgolem = id;
    }
    if (!g_mon_bloodgolem) {
      for (uint32_t id = 1u; id < nMon; id++) {
        uint32_t rec = pMon + id * 0x1A8u;
        if (S16(rec + 0x170u) > 0) { g_mon_bloodgolem = id; break; }
      }
    }
  }
}

/* ------------------------------- Helper for 12 SendAlert*IfQuest*Active functions */

static void emit_send_alert_if_quest_active(
    uint32_t va, const char *fnName, uint32_t questRecIdx, uint32_t alertQuestId,
    uint32_t levelId, uint8_t questAct, int hasBit0FCheck) {
  X86CallSpec c;
  int64_t ts[4];
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, levelId);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, (va & 0xFFFFu) + (uint32_t)k);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    /* Link pQuest node for alertQuestId */
    U32(STAGE_GAME + 0x10F4u)  = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)  = alertQuestId;
    U8(STAGE_QUEST0 + 0x08u)   = questAct;
    U8(STAGE_QUEST0 + 0x14u)   = 2u; /* bAlertState */
    U32(STAGE_QUEST0 + 0x18u)  = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xE0u)  = 0u; /* neutral nSeqId */
    U32(STAGE_QUEST0 + 0xE8u)  = 0u; /* null pfnStatus -> default status */

    if (k == 0) {
      /* Case 0: bit 0 set (completed), bit 0x0D & 0x0E clear -> skip alert */
      set_qbit(STAGE_QBITS0, questRecIdx, 0u);
    } else if (k == 1) {
      /* Case 1: all clear -> sends alert 0x5D */
      (void)hasBit0FCheck;
    } else {
      /* Case 2: bit 0 set AND bit 0x0D set -> still sends alert 0x5D with different status byte */
      set_qbit(STAGE_QBITS0, questRecIdx, 0u);
      set_qbit(STAGE_QBITS0, questRecIdx, 0x0Du);
      U8(STAGE_QUEST0 + 0x14u) = 5u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(va, fnName, k,
                 k == 0 ? "completed_skip" : k == 1 ? "active_send_5d" : "bit0d_send_5d_alt",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Batch 1: VAs 1..50 (Quests) */

static void emit_batch_1_to_50(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [1..12] Act 5 & Act 1 SendAlert*IfQuest*Active callbacks */
  emit_send_alert_if_quest_active(0x6FC78D40u, "ACT5Q6_SendAlert24IfQuest28Active_6FC78D40_113c", 0x28u, 0x24u, 109u, 4u, 1);
  emit_send_alert_if_quest_active(0x6FC78F90u, "ACT5Q5_SendAlert23IfQuest27Active_6FC78F90_113c", 0x27u, 0x23u, 109u, 4u, 1);
  emit_send_alert_if_quest_active(0x6FC790C0u, "ACT5Q4_SendAlert22IfQuest26Active_6FC790C0_113c", 0x26u, 0x22u, 109u, 4u, 1);
  emit_send_alert_if_quest_active(0x6FC791D0u, "ACT5Q3_SendAlert21IfQuest25Active_6FC791D0_113c", 0x25u, 0x21u, 109u, 4u, 1);
  emit_send_alert_if_quest_active(0x6FC793F0u, "ACT5Q2_SendAlert20IfQuest24Active_6FC793F0_113c", 0x24u, 0x20u, 109u, 4u, 1);
  emit_send_alert_if_quest_active(0x6FC79620u, "ACT5Q1_SendAlert1FIfQuest23Active_6FC79620_113c", 0x23u, 0x1Fu, 109u, 4u, 1);
  emit_send_alert_if_quest_active(0x6FC82700u, "ACT1Q6_SendAlert06IfQuest06Active_6FC82700_113c", 0x06u, 0x06u, 1u, 0u, 1);
  emit_send_alert_if_quest_active(0x6FC82870u, "ACT1Q5_SendAlert05IfQuest05Active_6FC82870_113c", 0x05u, 0x05u, 1u, 0u, 0);
  emit_send_alert_if_quest_active(0x6FC82A80u, "ACT1Q4_SendAlert04IfQuest04Active_6FC82A80_113c", 0x04u, 0x04u, 1u, 0u, 1);
  emit_send_alert_if_quest_active(0x6FC82AE0u, "ACT1Q3_SendAlert03IfQuest03Active_6FC82AE0_113c", 0x03u, 0x03u, 1u, 0u, 1);
  emit_send_alert_if_quest_active(0x6FC82C00u, "ACT1Q2_SendAlert02IfQuest02Active_6FC82C00_113c", 0x02u, 0x02u, 1u, 0u, 1);
  emit_send_alert_if_quest_active(0x6FC82D30u, "ACT1Q1_SendAlert01IfQuest01Active_6FC82D30_113c", 0x01u, 0x01u, 1u, 0u, 1);

  /* [13..15] ACT5Q5_InitAncientStatueObject1C / 18 / 14 (ecx=pObjInit, tail-calls 0x6FC774F0, void) */
  {
    const uint32_t vas[3] = { 0x6FC78E50u, 0x6FC78EA0u, 0x6FC78EF0u };
    const char *names[3] = {
      "ACT5Q5_InitAncientStatueObject1C_6FC78E50_113c",
      "ACT5Q5_InitAncientStatueObject18_6FC78EA0_113c",
      "ACT5Q5_InitAncientStatueObject14_6FC78EF0_113c",
    };
    for (int f = 0; f < 3; f++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
        U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
        U32(STAGE_QUEST0 + 0x00u)    = 0x23u;
        U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
        U32(STAGE_SCRATCH + 0x00u)   = STAGE_GAME;
        if (k == 0) {
          U32(STAGE_SCRATCH + 0x04u) = 0u; /* NULL object -> 0xFFFFFFFF */
        } else {
          U32(STAGE_UNIT0 + 0x00u) = 2u;
          U32(STAGE_UNIT0 + 0x04u) = (uint32_t)(10 + k); /* non-statue classId so 0x6FC774F0 returns cleanly */
          U32(STAGE_UNIT0 + 0x0Cu) = (k == 1) ? 0x1111u : 0x2222u;
          U32(STAGE_SCRATCH + 0x04u) = STAGE_UNIT0;
        }
        c.ecx = STAGE_SCRATCH;
        ts[0] = STAGE_SCRATCH;
        run_and_emit(vas[f], names[f], k,
                     k == 0 ? "null_obj_ffff" : k == 1 ? "obj_guid_1111" : "obj_guid_2222",
                     &c, ts, 1, 0u, 0);
      }
    }
  }

  /* [16] 0x6FC811B0 ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c (ecx=pQuest, edx=pQuestArg, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U32(STAGE_UNIT0 + 0x0Cu)  = 0x55u;
    U32(STAGE_QUESTARG + 0x0Cu) = (k == 0) ? 0u : STAGE_UNIT0;
    /* Populate all 3 lists: +0x8C (count +0x10C), +0x34 (count +0x64), +0x00 (count +0x30) */
    U32(STAGE_QUESTEX0 + 0x8Cu)  = 0x55u;
    U32(STAGE_QUESTEX0 + 0x90u)  = 0x66u;
    U16(STAGE_QUESTEX0 + 0x10Cu) = 2u;
    U32(STAGE_QUESTEX0 + 0x34u)  = 0x55u;
    U32(STAGE_QUESTEX0 + 0x38u)  = 0x77u;
    U16(STAGE_QUESTEX0 + 0x64u)  = 2u;
    U32(STAGE_QUESTEX0 + 0x00u)  = (k == 2) ? 0x55u : 0x88u;
    U16(STAGE_QUESTEX0 + 0x30u)  = 1u;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC811B0u, "ACT1Q3_Callback11_RemovePlayerGuid_6FC811B0_113c", k,
                 k == 0 ? "null_plr_nomatch" : k == 1 ? "remove_from_two_lists" : "remove_from_all_three",
                 &c, ts, 2, 0u, 0);
  }

  /* [17] 0x6FC81880 ACT1Q4_Callback11_RemovePlayerGuid_6FC81880_113c (ecx=pQuest, edx=pQuestArg, returns int) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 0x42u, 1u, 5000u, 5000u, 1701u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U32(STAGE_QUEST0 + 0xE0u) = 4u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    U32(STAGE_QUESTEX0 + 0xB4u)  = 0x42u;
    U16(STAGE_QUESTEX0 + 0x134u) = (k >= 1) ? 1u : 0u;
    U32(STAGE_QUESTEX0 + 0x138u) = 0x42u;
    U16(STAGE_QUESTEX0 + 0x1B8u) = (k == 2) ? 1u : 0u;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC81880u, "ACT1Q4_Callback11_RemovePlayerGuid_6FC81880_113c", k,
                 k == 0 ? "empty_lists" : k == 1 ? "remove_b4_only" : "remove_both_b4_and_138",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [18] 0x6FC826C0 ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1801u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 1) {
      set_qbit(STAGE_QBITS0, 6u, 1u);
    } else if (k == 2) {
      set_qbit(STAGE_QBITS0, 6u, 1u);
      set_qbit(STAGE_QBITS0, 6u, 0x0Du);
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC826C0u, "ACT1Q6_PlayAndarielDefeatedSoundCallback_6FC826C0_113c", k,
                 k == 0 ? "no_bits" : k == 1 ? "only_bit1" : "bit1_and_0d_plays_21",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [19] 0x6FC82B40 ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 1901u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, (k == 2 ? 1u : 0u));
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 1u : 0u;
    if (k >= 1) set_qbit(STAGE_QBITS0, 2u, 0x0Du);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC82B40u, "ACT1Q2_PlayBloodRavenDefeatedSoundCallback_6FC82B40_113c", k,
                 k == 0 ? "bit0d_clear" : k == 1 ? "norm_plays_22" : "nm_plays_22",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [20] 0x6FC82C60 ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2001u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, (k == 2 ? 2u : 0u));
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 2u : 0u;
    if (k >= 1) set_qbit(STAGE_QBITS0, 1u, 0x0Du);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC82C60u, "ACT1Q1_PlayDenClearedSoundCallback_6FC82C60_113c", k,
                 k == 0 ? "bit0d_clear" : k == 1 ? "norm_plays_23" : "hell_plays_23",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [21] 0x6FC82CD0 ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2101u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 0) set_qbit(STAGE_QBITS0, 1u, 0u);
    else if (k == 1) set_qbit(STAGE_QBITS0, 1u, 1u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC82CD0u, "ACT1Q1_SetCompletedBeforeAlertCallback_6FC82CD0_113c", k,
                 k == 0 ? "bit0_skip" : k == 1 ? "bit1_skip" : "set_0e_alert_and_log28",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [22] 0x6FC895F0 QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c (eax=pPlayer, esi=nNpcClassId, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2201u);
    /* pIntroData at STAGE_QBITS1: [0] -> holder0 -> buf0 (+0x40), [4] -> holder1 -> buf1 (+0x80) */
    U32(STAGE_QBITS1 + 0x00u) = STAGE_QBITS1 + 0x10u;
    U32(STAGE_QBITS1 + 0x10u) = STAGE_QBITS1 + 0x40u;
    U32(STAGE_QBITS1 + 0x04u) = STAGE_QBITS1 + 0x20u;
    U32(STAGE_QBITS1 + 0x20u) = STAGE_QBITS1 + 0x80u;
    U32(STAGE_UDATA0 + 0x60u) = STAGE_QBITS1;
    uint32_t npcId = (k == 0) ? 147u : (k == 1 ? 511u : 9999u);
    c.eax = STAGE_UNIT0; c.esi = npcId; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = npcId; ts[2] = STAGE_GAME;
    run_and_emit(0x6FC895F0u, "QUESTS_SetPlayerNpcIntroFlag_6FC895F0_113c", k,
                 k == 0 ? "npc147_bit1" : k == 1 ? "npc511_bit29" : "unknown_bit0",
                 &c, ts, 3, 0u, 0);
  }

  /* [23] 0x6FC89490 QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c (eax=pPlayer, esi=nNpcClassId, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2301u);
    U32(STAGE_QBITS1 + 0x00u) = STAGE_QBITS1 + 0x10u;
    U32(STAGE_QBITS1 + 0x10u) = STAGE_QBITS1 + 0x40u;
    U32(STAGE_QBITS1 + 0x04u) = STAGE_QBITS1 + 0x20u;
    U32(STAGE_QBITS1 + 0x20u) = STAGE_QBITS1 + 0x80u;
    memset((void *)(uintptr_t)(STAGE_QBITS1 + 0x80u), 0xFF, 8);
    U32(STAGE_UDATA0 + 0x60u) = STAGE_QBITS1;
    uint32_t npcId = (k == 0) ? 148u : (k == 1 ? 520u : 9999u);
    c.eax = STAGE_UNIT0; c.esi = npcId; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = npcId; ts[2] = STAGE_GAME;
    run_and_emit(0x6FC89490u, "QUESTS_ClearPlayerNpcIntroFlag_6FC89490_113c", k,
                 k == 0 ? "clear_npc148_bit2" : k == 1 ? "clear_npc520_bit34" : "clear_unknown_bit0",
                 &c, ts, 3, 0u, 0);
  }

  /* [24] 0x6FC892D0 QUESTS_FreeBitBufferPair_6FC892D0_113c (esi=pPair, edi=pGame, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    if (k >= 1) {
      U32(STAGE_QBITS1 + 0x00u) = STAGE_QBITS1 + 0x10u;
      U32(STAGE_QBITS1 + 0x10u) = STAGE_QBITS1 + 0x40u;
    }
    if (k == 2) {
      U32(STAGE_QBITS1 + 0x04u) = STAGE_QBITS1 + 0x20u;
      U32(STAGE_QBITS1 + 0x20u) = STAGE_QBITS1 + 0x80u;
    }
    c.esi = STAGE_QBITS1; c.edi = STAGE_GAME;
    ts[0] = STAGE_QBITS1; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC892D0u, "QUESTS_FreeBitBufferPair_6FC892D0_113c", k,
                 k == 0 ? "both_null" : k == 1 ? "first_only" : "both_nonnull",
                 &c, ts, 2, 0u, 0);
  }

  /* [25] 0x6FC559C0 QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2501u);
    U32(STAGE_UDATA0 + 0x9Cu) = (k == 0) ? 0u : STAGE_CLIENT;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    set_qbit(STAGE_QBITS0, 1u, 0u);
    U32(STAGE_GAME + 0x10F4u) = STAGE_QUESTCTRL;
    U8(STAGE_QUESTCTRL + 0x20u) = (k == 1) ? 0x03u : 0x07u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC559C0u, "QUESTS_SyncPlayerQuestLogAndPacket89_6FC559C0_113c", k,
                 k == 0 ? "null_client" : k == 1 ? "byte_03" : "byte_07",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [26] 0x6FC7E7F0 ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c (ecx=pGame, stack=[pUnit], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_timer_queue();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 10u, 0u, 5000u, 5000u, 2601u);
    if (k >= 1) {
      U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u)    = 0x22u;
      U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
      U8(STAGE_QUESTEX0 + 0x87u)   = (k == 2) ? 1u : 0u;
    }
    c.ecx = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC7E7F0u, "ACT5Q4_ScheduleTimerEventIfActiveFlag87_6FC7E7F0_113c", k,
                 k == 0 ? "no_quest" : k == 1 ? "flag87_zero" : "flag87_schedules_evt7",
                 &c, ts, 2, 0u, 0);
  }

  /* [27] 0x6FC818D0 ACT1Q4_Callback14_CountPlayerInifussScrolls_6FC818D0_113c (ecx=pQuest, edx=pQuestArg, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2701u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_bkd, 10u, 0u, 0u, 0u, 2702u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 0u);
    }
    if (k == 2) {
      stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 4u, g_item_bks, 11u, 0u, 0u, 0u, 2703u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT2, 0u, 0u, 0u);
    }
    U32(STAGE_QUEST0 + 0x18u)   = STAGE_QUESTEX0;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC818D0u, "ACT1Q4_Callback14_CountPlayerInifussScrolls_6FC818D0_113c", k,
                 k == 0 ? "no_scrolls" : k == 1 ? "bkd_only_inc1" : "both_bkd_bks_inc2",
                 &c, ts, 2, 0u, 0);
  }

  /* [28] 0x6FC855F0 ACT1Q5_OnHoradricMalusDroppedOrRemoved_6FC855F0_113c (ecx=pQuestData, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_QUEST0 + 0x04u) = STAGE_GAME;
    U32(STAGE_QUEST0 + 0x18u) = STAGE_QUESTEX0;
    U8(STAGE_QUEST0 + 0x09u)  = (k == 0) ? 0u : 1u;
    U32(STAGE_QUESTEX0 + 0x9Cu) = (k == 1) ? 3u : 1u;
    U32(STAGE_QUESTEX0 + 0x98u) = 1u; /* != 2 so doesn't invoke stand reset */
    c.ecx = STAGE_QUEST0;
    ts[0] = STAGE_QUEST0;
    run_and_emit(0x6FC855F0u, "ACT1Q5_OnHoradricMalusDroppedOrRemoved_6FC855F0_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "count_3_to_2" : "count_1_to_0_state1",
                 &c, ts, 1, 0u, 0);
  }

  /* [29] 0x6FC808B0 ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c (ecx=pQuest, edx=pQuestArg, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 2901u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_QUEST0 + 0xE0u)   = 6u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    if (k == 0) set_qbit(STAGE_QBITS0, 6u, 0u);
    else if (k == 1) set_qbit(STAGE_QBITS0, 6u, 4u);
    else set_qbit(STAGE_QBITS0, 6u, 2u);
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC808B0u, "ACT1Q6_Callback13_RefreshQuestState_6FC808B0_113c", k,
                 k == 0 ? "bit0_skip" : k == 1 ? "bit4_state2_3" : "bit2_state1_2",
                 &c, ts, 2, 0u, 0);
  }

  /* [30] 0x6FC80E00 ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c (ecx=pQuest, edx=pQuestArg, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 3001u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_QUEST0 + 0xE0u)   = 5u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    if (k == 0) set_qbit(STAGE_QBITS0, 5u, 6u);
    else if (k == 1) set_qbit(STAGE_QBITS0, 5u, 5u);
    else set_qbit(STAGE_QBITS0, 5u, 2u);
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC80E00u, "ACT1Q3_Callback13_RefreshQuestState_6FC80E00_113c", k,
                 k == 0 ? "bit6_state4_3" : k == 1 ? "bit5_state3_2" : "bit2_state1_2",
                 &c, ts, 2, 0u, 0);
  }

  /* [31] 0x6FC81E30 ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c (ecx=pQuest, edx=pQuestArg, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 3101u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_QUEST0 + 0xE0u)   = 2u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    if (k == 0) set_qbit(STAGE_QBITS0, 2u, 0x0Fu);
    else if (k == 1) set_qbit(STAGE_QBITS0, 2u, 4u);
    else set_qbit(STAGE_QBITS0, 2u, 3u);
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC81E30u, "ACT1Q2_Callback13_RefreshQuestState_6FC81E30_113c", k,
                 k == 0 ? "bit0f_skip" : k == 1 ? "bit4_state2_3" : "bit3_state1_3",
                 &c, ts, 2, 0u, 0);
  }

  /* [32] 0x6FC820E0 ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c (ecx=pQuest, edx=pQuestArg, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 3201u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_QUEST0 + 0xE0u)   = 1u;
    U32(STAGE_QUESTARG + 0x00u) = STAGE_GAME;
    U32(STAGE_QUESTARG + 0x0Cu) = STAGE_UNIT0;
    if (k == 0) set_qbit(STAGE_QBITS0, 1u, 0u);
    else if (k == 1) set_qbit(STAGE_QBITS0, 1u, 4u);
    else set_qbit(STAGE_QBITS0, 1u, 2u);
    c.ecx = STAGE_QUEST0; c.edx = STAGE_QUESTARG;
    ts[0] = STAGE_QUEST0; ts[1] = STAGE_QUESTARG;
    run_and_emit(0x6FC820E0u, "ACT1Q1_Callback13_RefreshQuestState_6FC820E0_113c", k,
                 k == 0 ? "bit0_skip" : k == 1 ? "bit4_state2_3" : "bit2_state1_2",
                 &c, ts, 2, 0u, 0);
  }

  /* [33..38] ACT1Q6 / Q3 / Q4 / Q5 / Q2 / Q1 UpdatePlayerQuestStateCallback */
  {
    const uint32_t vas[6]   = { 0x6FC80D00u, 0x6FC81250u, 0x6FC819B0u, 0x6FC81DA0u, 0x6FC82040u, 0x6FC82370u };
    const uint32_t qids[6]  = { 6u, 5u, 4u, 3u, 2u, 1u };
    const char *names[6] = {
      "ACT1Q6_UpdatePlayerQuestStateCallback_6FC80D00_113c",
      "ACT1Q3_UpdatePlayerQuestStateCallback_6FC81250_113c",
      "ACT1Q4_UpdatePlayerQuestStateCallback_6FC819B0_113c",
      "ACT1Q5_UpdatePlayerQuestStateCallback_6FC81DA0_113c",
      "ACT1Q2_UpdatePlayerQuestStateCallback_6FC82040_113c",
      "ACT1Q1_UpdatePlayerQuestStateCallback_6FC82370_113c",
    };
    for (int f = 0; f < 6; f++) {
      for (int k = 0; k < 3; k++) {
        reset_case();
        c = make_call();
        stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
        stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 3300u + (uint32_t)f * 10u + (uint32_t)k);
        stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
        U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
        U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
        U32(STAGE_QUEST0 + 0x00u)    = qids[f];
        if (k == 0) {
          set_qbit(STAGE_QBITS0, qids[f], 0u); /* already done */
        } else if (k == 1) {
          U8(STAGE_QUEST0 + 0x0Cu) = 2u; /* sets bit 2 */
        } else {
          U8(STAGE_QUEST0 + 0x0Cu) = 3u;
          U8(STAGE_QUEST0 + 0x0Bu) = 2u; /* sets bit 4 (or bit 3 on Q4/Q5) */
        }
        c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
        ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
        run_and_emit(vas[f], names[f], k,
                     k == 0 ? "done_skip" : k == 1 ? "last2_set_bit2" : "last3_state2_set_bit",
                     &c, ts, 3, 0xFFFFFFFFu, 0);
      }
    }
  }

  /* [39] 0x6FC78C90 ACT5Q6_RewardPlayerInAct5PartyCallback_6FC78C90_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 1u : 109u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 3901u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U16(STAGE_CLIENT + 0x0Au) = (k == 2) ? 0x0020u : 0x0000u; /* expansion flag */
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC78C90u, "ACT5Q6_RewardPlayerInAct5PartyCallback_6FC78C90_113c", k,
                 k == 0 ? "wrong_act_skip" : k == 1 ? "act5_classic_prog" : "act5_exp_prog",
                 &c, ts, 3, 0u, 0);
  }

  /* [40] 0x6FC77830 ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 4001u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 1) set_qbit(STAGE_QBITS0, 0x25u, 0u);
    else if (k == 2) set_qbit(STAGE_QBITS0, 0x25u, 1u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC77830u, "ACT5Q4_CompleteNihlathakPartyCallback_6FC77830_113c", k,
                 k == 0 ? "q25_incomplete_skip" : k == 1 ? "q25_bit0_awards_q26" : "q25_bit1_awards_q26",
                 &c, ts, 3, 0u, 0);
  }

  /* [41] 0x6FC780A0 ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 1u : 109u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 4101u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 1) set_qbit(STAGE_QBITS0, 0x25u, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC780A0u, "ACT5Q3_CompleteAnyaRescuePartyCallback_6FC780A0_113c", k,
                 k == 0 ? "wrong_act_skip" : k == 1 ? "bit0_skip" : "act5_sets_0d_1",
                 &c, ts, 3, 0u, 0);
  }

  /* [42] 0x6FC782E0 ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 4201u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 0x20u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    U32(STAGE_QUESTEX0 + 0xACu)  = (k == 0) ? 15u : (k == 1 ? 14u : 10u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC782E0u, "ACT5Q2_CompleteSoldierRescuePartyCallback_6FC782E0_113c", k,
                 k == 0 ? "saved15_bit5" : k == 1 ? "saved14_bit6" : "saved10_bit7",
                 &c, ts, 3, 0u, 0);
  }

  /* [43] 0x6FC78640 ACT5Q1_RewardPlayerInAct5PartyCallback_6FC78640_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 1u : 109u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 4301u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 1) set_qbit(STAGE_QBITS0, 0x23u, 0x0Du);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC78640u, "ACT5Q1_RewardPlayerInAct5PartyCallback_6FC78640_113c", k,
                 k == 0 ? "wrong_act" : k == 1 ? "bit0d_skip" : "act5_sets_1_0d",
                 &c, ts, 3, 0u, 0);
  }

  /* [44] 0x6FC83000 ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 40u : 1u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, (k == 1 ? 0x11u : 0x22u), 1u, 5000u, 5000u, 4401u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U16(STAGE_CLIENT + 0x0Au) = 0x0020u;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 6u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC83000u, "ACT1Q6_SyncCompletionForPlayerOutsideAct1_6FC83000_113c", k,
                 k == 0 ? "act2_skip" : k == 1 ? "act1_guid11" : "act1_guid22",
                 &c, ts, 3, 0u, 0);
  }

  /* [45] 0x6FC82640 ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c (ecx=pPlayer, eax=pQuestFlags, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 4501u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U8(STAGE_GAME + 0x6Du)    = (uint8_t)k; /* diff 0, 1, 2 */
    U16(STAGE_CLIENT + 0x0Au) = (k == 2) ? 0x0F20u : 0x0020u; /* already higher progress on k=2 */
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, (uint32_t)k);
    c.ecx = STAGE_UNIT0; c.eax = STAGE_QBITS0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_QBITS0; ts[2] = STAGE_GAME;
    run_and_emit(0x6FC82640u, "ACT1Q6_ApplyAndarielKillDifficultyRecord_6FC82640_113c", k,
                 k == 0 ? "norm_prog1" : k == 1 ? "nm_prog6" : "hell_keep_higher_15",
                 &c, ts, 3, 0u, 0);
  }

  /* [46] 0x6FC80EC0 ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 40u : 1u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 4601u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 1) set_qbit(STAGE_QBITS0, 5u, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC80EC0u, "ACT1Q5_CompleteCharsiImbuePartyCallback_6FC80EC0_113c", k,
                 k == 0 ? "act2_skip" : k == 1 ? "bit0_skip" : "act1_sets_0d_0",
                 &c, ts, 3, 0u, 0);
  }

  /* [47] 0x6FC81EC0 ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 40u : 1u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 4701u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 1) set_qbit(STAGE_QBITS0, 2u, 1u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC81EC0u, "ACT1Q2_CompleteBloodRavenPartyCallback_6FC81EC0_113c", k,
                 k == 0 ? "act2_skip" : k == 1 ? "bit1_skip" : "act1_sets_0d_1",
                 &c, ts, 3, 0u, 0);
  }

  /* [48] 0x6FC821B0 ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 40u : 1u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 4801u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 1) set_qbit(STAGE_QBITS0, 1u, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC821B0u, "ACT1Q1_CompleteDenOfEvilPartyCallback_6FC821B0_113c", k,
                 k == 0 ? "act2_skip" : k == 1 ? "bit0_skip" : "act1_sets_0d_1",
                 &c, ts, 3, 0u, 0);
  }

  /* [49] 0x6FC829B0 ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 40u : 1u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 4901u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    if (k == 1) set_qbit(STAGE_QBITS0, 4u, 1u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC829B0u, "ACT1Q4_CompleteCainRescuePartyCallback_6FC829B0_113c", k,
                 k == 0 ? "act2_skip" : k == 1 ? "bit1_skip" : "act1_sets_0d_1_and_log28",
                 &c, ts, 3, 0u, 0);
  }

  /* [50] 0x6FC83270 QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c (ebx=pGame, stack=[pGuidList, nQuestId, wSoundId], ret 0xC, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 7u, 1u, 5000u, 5000u, 5001u);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    U32(STAGE_SCRATCH + 0x00u) = 7u;
    U16(STAGE_SCRATCH + 0x80u) = (k == 0) ? 0u : 1u;
    uint32_t snd = (k == 2) ? 0x25u : 0u;
    c.ebx = STAGE_GAME;
    c.nargs = 3; c.args[0] = STAGE_SCRATCH; c.args[1] = 3u; c.args[2] = snd;
    c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_SCRATCH; ts[2] = 3; ts[3] = snd;
    run_and_emit(0x6FC83270u, "QUESTS_CompleteQuestForGuidListPlayers_6FC83270_113c", k,
                 k == 0 ? "empty_list" : k == 1 ? "complete_no_sound" : "complete_with_sound_25",
                 &c, ts, 4, 0u, 0);
  }
}

/* ------------------------------- Helper for 9 PropagateQuestStateToPartyCallback functions */

static void emit_propagate_quest_to_party(
    uint32_t va, const char *fnName, uint32_t questRecIdx, uint32_t levelId,
    uint32_t extraQuestNodeId, uint32_t extraQuestRecIdx) {
  X86CallSpec c;
  int64_t ts[3];
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, levelId);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, (va & 0xFFFFu) + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5002u, 5002u, (va & 0xFFFFu) + 0x100u + (uint32_t)k);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U32(STAGE_UDATA1 + 0x9Cu) = STAGE_CLIENT;
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    stage_player_qbits(STAGE_UDATA1, STAGE_QBITS1, 0u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);

    /* Stage party 1 with UNIT0 (guid 1) and UNIT1 (guid 2) */
    uint32_t pParty = STAGE_PARTYCTRL + 0x20u;
    uint32_t pMem0  = STAGE_PARTYCTRL + 0x40u;
    uint32_t pMem1  = STAGE_PARTYCTRL + 0x50u;
    U32(STAGE_GAME + 0x1D2Cu)     = STAGE_PARTYCTRL;
    U32(STAGE_PARTYCTRL + 0x04u)  = pParty;
    U16(pParty + 0x00u)           = 1u;
    U32(pParty + 0x04u)           = pMem0;
    U32(pMem0 + 0x00u)            = 1u;
    U32(pMem0 + 0x04u)            = pMem1;
    U32(pMem1 + 0x00u)            = 2u;

    if (extraQuestNodeId != 0u) {
      U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
      U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
      U32(STAGE_QUEST0 + 0x00u)    = extraQuestNodeId;
      U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
      U32(STAGE_QUESTEX0 + 0xACu)  = 15u; /* savedSoldiers for ACT5Q2 */
    }
    if (extraQuestRecIdx != 0u) {
      set_qbit(STAGE_QBITS1, extraQuestRecIdx, 0u); /* prerequisite quest for ACT5Q4 */
    }

    if (k == 0) {
      /* bit 0x0D clear on UNIT0 -> no propagation */
    } else if (k == 1) {
      /* bit 0x0D set on UNIT0, but UNIT0 not in party (empty party) -> no propagation */
      set_qbit(STAGE_QBITS0, questRecIdx, 0x0Du);
      U32(STAGE_PARTYCTRL + 0x04u) = 0u;
    } else {
      /* bit 0x0D set on UNIT0 and UNIT1 in party -> propagates to UNIT1 */
      set_qbit(STAGE_QBITS0, questRecIdx, 0x0Du);
    }

    c.ecx = STAGE_GAME;
    c.edx = STAGE_UNIT0;
    c.nargs = 1;
    c.args[0] = 0u;
    c.calleePop = 4u;
    ts[0] = STAGE_GAME;
    ts[1] = STAGE_UNIT0;
    ts[2] = 0;
    run_and_emit(va, fnName, k,
                 k == 0 ? "bit0d_clear" : k == 1 ? "no_party" : "propagates_to_party_member",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }
}

/* ------------------------------- Helper for 5 MonUMod elemental damage functions */

static void emit_monumod_elemental(uint32_t va, const char *fnName, uint32_t umodId) {
  X86CallSpec c;
  int64_t ts[3];
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 0) ? 0u : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 10u, 1u, 5000u, 5000u, (va & 0xFFFFu) + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 2 ? 45 : 15), 0);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 2u : 0u;
    uint32_t bChamp = (k == 2) ? 1u : 0u;
    c.ecx = STAGE_UNIT0;
    c.edx = umodId;
    c.nargs = 1;
    c.args[0] = bChamp;
    c.calleePop = 4u;
    ts[0] = STAGE_UNIT0;
    ts[1] = (int64_t)umodId;
    ts[2] = (int64_t)bChamp;
    run_and_emit(va, fnName, k,
                 k == 0 ? "non_monster_skip" : k == 1 ? "normal_unique_lvl15" : "hell_champ_lvl45",
                 &c, ts, 3, 0u, 0);
  }
}

static void emit_batch_51_to_96(void) {
  X86CallSpec c;
  int64_t ts[8];

  /* [51..59] 9x PropagateQuestStateToPartyCallback */
  emit_propagate_quest_to_party(0x6FC7AB00u, "ACT5Q6_PropagateQuestStateToPartyCallback_6FC7AB00_113c", 0x28u, 109u, 0u, 0u);
  emit_propagate_quest_to_party(0x6FC7AF50u, "ACT5Q4_PropagateQuestStateToPartyCallback_6FC7AF50_113c", 0x26u, 109u, 0u, 0x25u);
  emit_propagate_quest_to_party(0x6FC7B120u, "ACT5Q3_PropagateQuestStateToPartyCallback_6FC7B120_113c", 0x25u, 109u, 0u, 0u);
  emit_propagate_quest_to_party(0x6FC7B180u, "ACT5Q2_PropagateQuestStateToPartyCallback_6FC7B180_113c", 0x24u, 109u, 0x20u, 0u);
  emit_propagate_quest_to_party(0x6FC7B490u, "ACT5Q1_PropagateQuestStateToPartyCallback_6FC7B490_113c", 0x23u, 109u, 0u, 0u);
  emit_propagate_quest_to_party(0x6FC83D70u, "ACT1Q6_PropagateQuestStateToPartyCallback_6FC83D70_113c", 0x06u, 40u,  0u, 0u);
  emit_propagate_quest_to_party(0x6FC84150u, "ACT1Q5_PropagateQuestStateToPartyCallback_6FC84150_113c", 0x05u, 1u,   0u, 0u);
  emit_propagate_quest_to_party(0x6FC84FE0u, "ACT1Q2_PropagateQuestStateToPartyCallback_6FC84FE0_113c", 0x02u, 1u,   0u, 0u);
  emit_propagate_quest_to_party(0x6FC85200u, "ACT1Q1_PropagateQuestStateToPartyCallback_6FC85200_113c", 0x01u, 1u,   0u, 0u);

  /* [61] 0x6FC81910 ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, ret u32=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, (k == 2 ? 0x42u : 7u), 1u, 5000u, 5000u, 6101u + (uint32_t)k);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 4u;
    U32(STAGE_QUEST0 + 0x18u)    = STAGE_QUESTEX0;
    if (k == 0) set_qbit(STAGE_QBITS0, 4u, 0u);
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC81910u, "ACT1Q4_SetCompletedBeforeAndAddGuidCallback_6FC81910_113c", k,
                 k == 0 ? "bit0_skip" : k == 1 ? "set_0e_add_guid7" : "set_0e_add_guid42",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [62] 0x6FC77750 ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, ret u32=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 6201u + (uint32_t)k);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 0 ? 15 : 25), 0);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 0x23u;
    U8(STAGE_QUEST0 + 0x0Cu)     = (k == 1) ? 2u : 3u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC77750u, "ACT5Q5_SyncRiteOfPassageQuestStateCallback_6FC77750_113c", k,
                 k == 0 ? "level_too_low" : k == 1 ? "sync_state_2" : "sync_state_3",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [63] 0x6FC77320 ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c (ecx=pGame, edx=pPlayer, stack=[0], ret 4, ret u32=0) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 0 ? 1u : 109u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 6301u + (uint32_t)k);
    stage_player_qbits(STAGE_UDATA0, STAGE_QBITS0, 0u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u) = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)    = 0x24u;
    U8(STAGE_QUEST0 + 0x0Cu)     = (k == 1) ? 2u : 3u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0;
    run_and_emit(0x6FC77320u, "ACT5Q6_SyncBaalQuestStateCallback_6FC77320_113c", k,
                 k == 0 ? "act1_skip" : k == 1 ? "act5_state_2" : "act5_state_3",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [64] 0x6FC73470 SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c (eax=pItem, edx=nMaxBytes, stack=[pOutBuf], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, 0x11u, 0u, 5000u, 5000u, 6401u);
    U32(STAGE_UDATA0 + 0x00u) = 2u; /* normal quality */
    U32(STAGE_UDATA0 + 0x14u) = 0x00200010u; /* identified + simple/compact? */
    U16(STAGE_UDATA0 + 0x30u) = 101u; /* wItemFormat */
    uint32_t itemPtr = (k == 0) ? 0u : STAGE_UNIT0;
    if (k == 1) U32(STAGE_UNIT0 + 0xC8u) = 0x8000u; /* flagged -> skip */
    uint32_t maxB = (k == 2) ? 0u : 256u; /* k==2 triggers assert 0x75A when capacity=0 */
    c.eax = itemPtr; c.edx = maxB; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = itemPtr; ts[1] = maxB; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC73470u, "SAVE_SerializeUnflaggedItemToBuffer_6FC73470_113c", k,
                 k == 0 ? "null_item" : k == 1 ? "flag_8000_skip" : "zero_cap_assert_75a",
                 &c, ts, 3, 0xFFFFFFFFu, (k == 2 ? 1 : 0));
  }

  /* [65] 0x6FCACFB0 PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c (eax=pPlayerUnit, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 0x55u, 1u, 5000u, 5000u, 6501u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k == 2) {
      uint32_t pParty = STAGE_PARTYCTRL + 0x20u;
      uint32_t pMem0  = STAGE_PARTYCTRL + 0x40u;
      U32(STAGE_GAME + 0x1D2Cu)    = STAGE_PARTYCTRL;
      U32(STAGE_PARTYCTRL + 0x04u) = pParty;
      U16(pParty + 0x00u)          = 7u;
      U32(pParty + 0x04u)          = pMem0;
      U32(pMem0 + 0x00u)           = 0x55u;
    }
    uint32_t targetPlayer = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = targetPlayer; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = targetPlayer; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCACFB0u, "PARTY_BroadcastPlayerPartyIdPacket8D_6FCACFB0_113c", k,
                 k == 0 ? "null_player_ffff" : k == 1 ? "unpartied_ffff" : "party_id_7",
                 &c, ts, 2, 0u, 0);
  }

  /* [66] 0x6FCBD550 CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c (eax=pRoom, edi=pClient, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 1u);
    if (k >= 1) {
      U32(STAGE_SCRATCH + 0x00u) = STAGE_ROOM0;
      U32(STAGE_SCRATCH + 0x04u) = STAGE_ROOM1;
      U32(STAGE_ROOM0 + 0x00u)   = STAGE_SCRATCH;
      U32(STAGE_ROOM0 + 0x24u)   = (k == 1) ? 0u : 2u;
      /* Attach STAGE_CLIENT to both rooms' pClientList (+0x48), nNumClients (+0x78) */
      U32(STAGE_SCRATCH + 0x20u) = STAGE_CLIENT;
      U32(STAGE_SCRATCH + 0x30u) = STAGE_CLIENT;
      U32(STAGE_ROOM0 + 0x48u)   = STAGE_SCRATCH + 0x20u;
      U32(STAGE_ROOM0 + 0x78u)   = 1u;
      U32(STAGE_ROOM1 + 0x48u)   = STAGE_SCRATCH + 0x30u;
      U32(STAGE_ROOM1 + 0x78u)   = 1u;
    }
    uint32_t roomArg = (k == 0) ? 0u : STAGE_ROOM0;
    c.eax = roomArg; c.edi = STAGE_CLIENT;
    ts[0] = roomArg; ts[1] = STAGE_CLIENT;
    run_and_emit(0x6FCBD550u, "CLIENT_RemoveClientFromAdjacentRooms_6FCBD550_113c", k,
                 k == 0 ? "null_room_assert_14e" : k == 1 ? "zero_adj_rooms" : "remove_from_2_adj_rooms",
                 &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [67] 0x6FC97D90 PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c (esi=pPlayer, ebx=pItem, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, (uint32_t)(0x10 + k), 1u, 5000u, 5000u, 6701u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, (uint32_t)(0x80 + k), 0u, 5000u, 5000u, 6702u);
    U32(STAGE_UDATA0 + 0x9Cu) = (k == 0) ? 0u : STAGE_CLIENT;
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT1);
    c.esi = STAGE_UNIT0; c.ebx = STAGE_UNIT1;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FC97D90u, "PLAYER_ClearCursorItemAndNotify42_6FC97D90_113c", k,
                 k == 0 ? "null_client_clear" : k == 1 ? "notify42_guid11" : "notify42_guid12",
                 &c, ts, 2, 0u, 0);
  }

  /* [68] 0x6FC46B30 PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c (eax=nSkillId, edi=nY, stack=[pUnit, nX], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    /* k=0: invalid skill (-1) -> 0; k=1: town room (lvl 1), non-town skill (Fire Bolt 36) -> 0; k=2: wilderness room (lvl 2), Fire Bolt -> 1 */
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 2 ? 2u : 1u));
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 6801u);
    uint32_t skId = (k == 0) ? 0xFFFFFFFFu : 36u;
    c.eax = skId; c.edi = 5005u; c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = 5005u; c.calleePop = 8u;
    ts[0] = (int32_t)skId; ts[1] = 5005; ts[2] = STAGE_UNIT0; ts[3] = 5005;
    run_and_emit(0x6FC46B30u, "PLRMODE_CanCastSkillAtTargetSubtile_6FC46B30_113c", k,
                 k == 0 ? "neg_skill_0" : k == 1 ? "town_rejects_firebolt" : "wilderness_allows_firebolt",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [68] 0x6FC4DE30 CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c (eax=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U8(STAGE_GAME + 0x6Au) = (k == 0) ? 0u : (k == 1 ? 1u : 2u);
    U32(STAGE_GAME + 0x88u) = STAGE_CLIENT;
    U32(STAGE_CLIENT + 0x16Cu) = 0u;    /* uType */
    U32(STAGE_CLIENT + 0x170u) = 99u;   /* missing GUID */
    U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT0; /* stale ptr cleared when gameType==1|2 and lookup fails */
    U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
    if (k == 1) U32(STAGE_CLIENT + 0x174u) = 0u;
    c.eax = STAGE_GAME;
    ts[0] = STAGE_GAME;
    run_and_emit(0x6FC4DE30u, "CLIENTS_SaveAndDrainAllSinglePlayerClients_6FC4DE30_113c", k,
                 k == 0 ? "gametype0_skip" : k == 1 ? "gametype1_null_player" : "gametype2_clears_stale_ptr",
                 &c, ts, 1, 0u, 0);
  }

  /* [71] 0x6FC90BF0 NET_SendEventMessagePacket5A_6FC90BF0_113c (eax=szName, dl=bEventType, esi=pPlayer, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 7101u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    uint32_t szPtr = 0u;
    if (k == 1) {
      szPtr = STAGE_SCRATCH;
      memcpy((void *)(uintptr_t)szPtr, "Paladin", 8u);
    } else if (k == 2) {
      szPtr = STAGE_SCRATCH;
      memcpy((void *)(uintptr_t)szPtr, "Sorceress", 10u);
    }
    uint32_t evType = (k == 0) ? 2u : (k == 1 ? 3u : 7u);
    c.eax = szPtr; c.edx = evType; c.esi = STAGE_UNIT0;
    ts[0] = szPtr; ts[1] = evType; ts[2] = STAGE_UNIT0;
    run_and_emit(0x6FC90BF0u, "NET_SendEventMessagePacket5A_6FC90BF0_113c", k,
                 k == 0 ? "null_name_ev2" : k == 1 ? "paladin_ev3" : "sorceress_ev7",
                 &c, ts, 3, 0u, 0);
  }

  /* [72] 0x6FCAA2A0 NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c (edx=pClient, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_CLIENT + 0x1B8u) = STAGE_SCRATCH;
    U32(STAGE_SCRATCH + 0x00u) = (k == 2) ? 4u : 0u;
    U32(STAGE_CLIENT + 0x3BCu) = (uint32_t)k; /* 0, 1, 2 entries */
    for (uint32_t i = 0; i < 18u; i++) U8(STAGE_CLIENT + 0x1CCu + i) = (uint8_t)(0x30u + i);
    c.edx = STAGE_CLIENT;
    ts[0] = STAGE_CLIENT;
    run_and_emit(0x6FCAA2A0u, "NET_FlushPacket16_GroundUnitBatch_6FCAA2A0_113c", k,
                 k == 0 ? "zero_entries" : k == 1 ? "one_entry_at_0" : "two_entries_at_4",
                 &c, ts, 1, 0u, 0);
  }

  /* [71] 0x6FC97F00 PLAYER_PruneAndCountLiveCorpses_6FC97F00_113c (eax=pPlayer, ebx=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 7401u);
    if (k >= 1) {
      uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = pInv;
      uint32_t pCorpse0 = STAGE_SCRATCH + 0x00u;
      uint32_t pCorpse1 = STAGE_SCRATCH + 0x20u;
      U32(pCorpse0 + 0x00u) = 1u; U32(pCorpse0 + 0x04u) = 55u; U32(pCorpse0 + 0x0Cu) = pCorpse1;
      U32(pCorpse1 + 0x00u) = 1u; U32(pCorpse1 + 0x04u) = 66u; U32(pCorpse1 + 0x0Cu) = 0u;
      U32(pInv + 0x34u) = pCorpse0; U32(pInv + 0x38u) = pCorpse1; U32(pInv + 0x3Cu) = 2u;
      if (k == 2) {
        stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 55u, 17u, 5002u, 5002u, 7402u);
        insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      }
    }
    c.eax = STAGE_UNIT0; c.ebx = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC97F00u, "PLAYER_PruneAndCountLiveCorpses_6FC97F00_113c", k,
                 k == 0 ? "null_inv_0" : k == 1 ? "prune_both_stale_0" : "one_live_one_pruned_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [75] 0x6FCBD610 CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c (esi=pClient, stack=[pGame], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    U32(STAGE_ACT0 + 0x04u) = STAGE_SCRATCH; /* pEnvironment */
    U32(STAGE_ACT0 + 0x08u) = (k == 1) ? 1u : 40u; /* dwTownId */
    U32(STAGE_SCRATCH + 0x00u) = (k == 1) ? 2u : 5u;    /* dwCycleIndex */
    U32(STAGE_SCRATCH + 0x08u) = (k == 1) ? 100u : 777u;/* dwTicks */
    U32(STAGE_SCRATCH + 0x30u) = (k == 2) ? 1u : 0u;    /* dwEclipse */
    U32(STAGE_GAME + 0x7Cu) = 0x11223344u;
    U32(STAGE_GAME + 0x80u) = 0x55667788u;
    U8(STAGE_CLIENT + 0x1ACu) = (k == 2) ? 1u : 0u;
    U32(STAGE_GAME + 0xBCu + 0u) = STAGE_ACT0;
    U32(STAGE_GAME + 0xBCu + 4u) = STAGE_ACT0;
    uint32_t cliArg = (k == 0) ? 0u : STAGE_CLIENT;
    c.esi = cliArg; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = cliArg; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCBD610u, "CLIENT_SendLoadActAndEnvStatePackets_6FCBD610_113c", k,
                 k == 0 ? "null_client_assert_7cb" : k == 1 ? "act0_cycle2" : "act1_eclipse1",
                 &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [76] 0x6FCBC6F0 PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0_113c (eax=pGame, stack=[pJoinQueue], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t qArg = (k == 0) ? 0u : STAGE_SCRATCH;
    if (k == 2) {
      U32(STAGE_SCRATCH + 0x04u) = STAGE_SCRATCH + 0x20u;
      U32(STAGE_SCRATCH + 0x20u) = 0x99u; /* missing guid -> assert 0x9A */
    }
    c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = qArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = qArg;
    run_and_emit(0x6FCBC6F0u, "PARTY_ProcessPendingJoinRelationQueue_6FCBC6F0_113c", k,
                 k == 0 ? "null_queue_assert_95" : k == 1 ? "empty_queue_noop" : "missing_player_assert_9a",
                 &c, ts, 2, 0u, (k == 1 ? 0 : 1));
  }

  /* [77] 0x6FC57730 PLAYER_ApplyDeathExpPenalty_6FC57730_113c (eax=pGame, stack=[pPlayer], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 7701u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U8(STAGE_GAME + 0x6Du) = (k == 0) ? 0u : (k == 1 ? 1u : 2u); /* Normal(0%), NM(5%), Hell(10%) */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 0 ? 1 : 20), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 13, (k == 2 ? 400000 : 500000), 0);
    c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = STAGE_UNIT0; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC57730u, "PLAYER_ApplyDeathExpPenalty_6FC57730_113c", k,
                 k == 0 ? "lvl1_noop" : k == 1 ? "nm_5pct_penalty" : "hell_10pct_clamp_floor",
                 &c, ts, 2, 0u, 0);
  }

  /* [75] 0x6FC4CD10 SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c (eax=pUnit, esi=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, (uint32_t)(10 + k), 3u, 5000u, 5000u, 7801u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k >= 1) {
      uint32_t cliRoom = (k == 1) ? STAGE_ROOM1 : STAGE_ROOM0;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, cliRoom, 0u, 0u, 1u, 1u, 5000u, 5000u, 7802u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_GAME + 0x88u)    = STAGE_CLIENT;
      U32(STAGE_CLIENT + 0x04u)  = 4u; /* in-game state */
      U32(STAGE_CLIENT + 0x16Cu) = 0u;
      U32(STAGE_CLIENT + 0x170u) = 1u;
      U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT1;
      U32(STAGE_CLIENT + 0x1A8u) = STAGE_GAME;
      U32(STAGE_CLIENT + 0x1B4u) = cliRoom;
      U32(STAGE_SCRATCH + 0x00u) = cliRoom;
      U32(cliRoom + 0x00u)       = STAGE_SCRATCH;
      U32(cliRoom + 0x24u)       = 1u;
    }
    c.eax = STAGE_UNIT0; c.esi = STAGE_GAME;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC4CD10u, "SUNIT_BroadcastRemoveAndFreeUnit_6FC4CD10_113c", k,
                 k == 0 ? "free_unit_no_clients" : k == 1 ? "client_far_room_no_bcast" : "broadcast_and_free_unit",
                 &c, ts, 2, 0u, 0);
  }

  /* [76] 0x6FC8E470 OBJ_EventHoverMsgTimeout_6FC8E470_113c (ecx=pGame, edx=pObject, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 1u, 0u, 5000u, 5000u, 8001u);
    stage_timer_queue();
    if (k >= 1) {
      U32(STAGE_UNIT0 + 0xA4u) = STAGE_SCRATCH;
      U32(STAGE_SCRATCH + 0x04u) = (k == 1) ? 250u : 50u; /* > 100 reschedules; <= 100 frees & sets flag 0x100 */
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC8E470u, "OBJ_EventHoverMsgTimeout_6FC8E470_113c", k,
                 k == 0 ? "null_hover_noop" : k == 1 ? "future_timeout_reschedule" : "expired_clear_and_flag100",
                 &c, ts, 2, 0u, 0);
  }

  /* [81] 0x6FC99AA0 EVENT_HandleFreeHoverMsg_6FC99AA0_113c (ecx=pGame, edx=pUnit, stack=[0, 0], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 8101u);
    stage_timer_queue();
    if (k >= 1) {
      U32(STAGE_UNIT0 + 0xA4u) = STAGE_SCRATCH;
      U32(STAGE_SCRATCH + 0x04u) = (k == 1) ? 300u : 80u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    run_and_emit(0x6FC99AA0u, "EVENT_HandleFreeHoverMsg_6FC99AA0_113c", k,
                 k == 0 ? "null_hover_noop" : k == 1 ? "future_reschedule" : "expired_clear_flag100",
                 &c, ts, 4, 0u, 0);
  }

  /* [82] 0x6FC221D0 STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c (ecx=pHashTable, eax=nBucketIndex, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t ht      = STAGE_SCRATCH + 0x00u;
    uint32_t buckets = STAGE_SCRATCH + 0x40u;
    uint32_t node0   = STAGE_SCRATCH + 0x100u;
    uint32_t node1   = STAGE_SCRATCH + 0x120u;
    U32(ht + 0x10u) = 5u; /* fullness score */
    U32(ht + 0x1Cu) = buckets;
    U32(ht + 0x24u) = (k == 0) ? 0x3FFu : 7u;
    U32(buckets + 0x00u) = 0u; /* linkOffset = 0 */
    if (k == 1) {
      U32(buckets + 0x08u) = 0u; /* empty chain -> score 5 -> 2 */
    } else if (k == 2) {
      U32(buckets + 0x08u) = node0;
      U32(node0 + 0x04u)   = node1;
      U32(node1 + 0x04u)   = 0u; /* 2-node chain -> score 5 -> 2 -> 4 */
    }
    c.ecx = ht; c.eax = 0u;
    ts[0] = ht; ts[1] = 0;
    run_and_emit(0x6FC221D0u, "STORM_TSHashTableCheckChainAndGrow_6FC221D0_113c", k,
                 k == 0 ? "mask_max_skip" : k == 1 ? "empty_bucket_dec3" : "two_node_chain_score4",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [83] 0x6FC4E5D0 OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c (eax=pRoomCoords, esi=pPos, stack=[pRoom, nSizeX, nSizeY], ret 0xC) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pGrid = STAGE_SCRATCH + 0x00u;
    uint32_t pMap  = STAGE_SCRATCH + 0x100u;
    uint32_t pRc   = STAGE_SCRATCH + 0x40u;
    uint32_t pPos  = STAGE_SCRATCH + 0x60u;
    U32(STAGE_ROOM0 + 0x20u) = pGrid;
    U32(STAGE_ROOM0 + 0x4Cu) = 100u; U32(STAGE_ROOM0 + 0x50u) = 100u;
    U32(STAGE_ROOM0 + 0x54u) = 20u;  U32(STAGE_ROOM0 + 0x58u) = 20u;
    U32(pGrid + 0x00u) = 100u; U32(pGrid + 0x04u) = 100u;
    U32(pGrid + 0x08u) = 20u;  U32(pGrid + 0x0Cu) = 20u;
    U32(pGrid + 0x20u) = pMap;
    U32(pRc + 0x00u) = 100u; U32(pRc + 0x04u) = 100u;
    U32(pRc + 0x08u) = 20u;  U32(pRc + 0x0Cu) = 20u;
    U32(pPos + 0x00u) = (k == 0) ? 101u : 110u; /* k=0 fails border margin (<= 102) */
    U32(pPos + 0x04u) = 110u;
    if (k == 1) {
      /* Set wall collision bit 0x0001 at (110, 110) -> local (10, 10) -> idx 210 */
      U16(pMap + 210u * 2u) = 0x0001u;
    }
    c.eax = pRc; c.esi = pPos;
    c.nargs = 3; c.args[0] = STAGE_ROOM0; c.args[1] = 2u; c.args[2] = 2u; c.calleePop = 12u;
    ts[0] = pRc; ts[1] = pPos; ts[2] = STAGE_ROOM0; ts[3] = 2; ts[4] = 2;
    run_and_emit(0x6FC4E5D0u, "OBJECTS_CheckSpawnSpotClearMargin2_6FC4E5D0_113c", k,
                 k == 0 ? "border_reject_0" : k == 1 ? "collision_reject_0" : "clear_spot_1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [84] 0x6FC4E660 OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c (eax=pRoomCoords, esi=pPos, edi=nSizeX, stack=[pRoom, nSizeY], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t pGrid = STAGE_SCRATCH + 0x00u;
    uint32_t pMap  = STAGE_SCRATCH + 0x100u;
    uint32_t pRc   = STAGE_SCRATCH + 0x40u;
    uint32_t pPos  = STAGE_SCRATCH + 0x60u;
    U32(STAGE_ROOM0 + 0x20u) = pGrid;
    U32(STAGE_ROOM0 + 0x4Cu) = 100u; U32(STAGE_ROOM0 + 0x50u) = 100u;
    U32(STAGE_ROOM0 + 0x54u) = 24u;  U32(STAGE_ROOM0 + 0x58u) = 24u;
    U32(pGrid + 0x00u) = 100u; U32(pGrid + 0x04u) = 100u;
    U32(pGrid + 0x08u) = 24u;  U32(pGrid + 0x0Cu) = 24u;
    U32(pGrid + 0x20u) = pMap;
    U32(pRc + 0x00u) = 100u; U32(pRc + 0x04u) = 100u;
    U32(pRc + 0x08u) = 24u;  U32(pRc + 0x0Cu) = 24u;
    U32(pPos + 0x00u) = (k == 0) ? 101u : 112u;
    U32(pPos + 0x04u) = 112u;
    if (k == 1) {
      /* Set 0x0400 wide collision bit at (114, 112) -> local (14, 12) -> idx 12*24+14 = 302 */
      U16(pMap + 302u * 2u) = 0x0400u;
    }
    c.eax = pRc; c.esi = pPos; c.edi = 2u;
    c.nargs = 2; c.args[0] = STAGE_ROOM0; c.args[1] = 2u; c.calleePop = 8u;
    ts[0] = pRc; ts[1] = pPos; ts[2] = 2; ts[3] = STAGE_ROOM0; ts[4] = 2;
    run_and_emit(0x6FC4E660u, "OBJECTS_CheckSpawnSpotClearMargin7_6FC4E660_113c", k,
                 k == 0 ? "border_reject_0" : k == 1 ? "wide_0c01_reject_0" : "clear_spot_1",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [85] 0x6FC22510 STORM_TSListArraySetCount_6FC22510_113c (eax=pListArray, edi=nNewCount, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t arr  = STAGE_SCRATCH + 0x00u;
    uint32_t data = STAGE_SCRATCH + 0x40u;
    U32(arr + 0x00u) = 6u; /* capacity = 6 (avoids SMemReAlloc) */
    U32(arr + 0x04u) = (k == 2) ? 3u : 1u; /* old count */
    U32(arr + 0x08u) = data;
    U32(arr + 0x0Cu) = 4u;
    /* Initialize existing TSExplicitList entries [0..2] as empty sentinel lists */
    for (uint32_t i = 0; i < 3u; i++) {
      uint32_t lst = data + i * 12u;
      U32(lst + 0x00u) = 0u;
      U32(lst + 0x04u) = lst + 4u;
      U32(lst + 0x08u) = ~(lst + 4u);
    }
    uint32_t newCnt = (k == 0) ? 1u : (k == 1 ? 4u : 1u);
    c.eax = arr; c.edi = newCnt;
    ts[0] = arr; ts[1] = newCnt;
    run_and_emit(0x6FC22510u, "STORM_TSListArraySetCount_6FC22510_113c", k,
                 k == 0 ? "same_count_1" : k == 1 ? "grow_in_place_1_to_4" : "shrink_3_to_1",
                 &c, ts, 2, 0u, 0);
  }

  /* [86..90] 5x MonUMod Elemental Damage Stats */
  emit_monumod_elemental(0x6FC421D0u, "MONUMOD_ApplyPoisonEnchantedStats_6FC421D0_113c", 23u);
  emit_monumod_elemental(0x6FC42320u, "MONUMOD_ApplyColdEnchantedStats_6FC42320_113c", 18u);
  emit_monumod_elemental(0x6FC42490u, "MONUMOD_ApplyColdDamageAndLengthStats_6FC42490_113c", 18u);
  emit_monumod_elemental(0x6FC42600u, "MONUMOD_ApplyLightningEnchantedStats_6FC42600_113c", 17u);
  emit_monumod_elemental(0x6FC42740u, "MONUMOD_ApplyFireEnchantedStats_6FC42740_113c", 9u);

  /* [91] 0x6FC43850 MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c (ecx=pUnit, edx=nUModId, stack=[bBoss], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5000u, 5000u, 9101u + (uint32_t)k);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, (k == 2 ? 40 : 12), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 100 << 8, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 100 << 8, 0);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 2u : 0u;
    uint32_t bBoss = (k == 0) ? 0u : 1u;
    c.ecx = STAGE_UNIT0; c.edx = 0x24u; c.nargs = 1; c.args[0] = bBoss; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = 0x24; ts[2] = bBoss;
    run_and_emit(0x6FC43850u, "MONUMOD_ApplyChampionGhostlyStats_6FC43850_113c", k,
                 k == 0 ? "minion_skip" : k == 1 ? "normal_ghostly_lvl12" : "hell_ghostly_lvl40",
                 &c, ts, 3, 0u, 0);
  }

  /* [92] 0x6FC42BC0 MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c (ecx=pMonster, edx=nUModId, stack=[bBoss], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t cls = (k == 2) ? 0x76u : 1u; /* 0x76 halves damage bonus */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, (k == 0 ? 0u : 1u), cls, 10u, 1u, 5000u, 5000u, 9201u);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 2u : 0u;
    uint32_t bBoss = (k == 1) ? 0u : 1u;
    c.ecx = STAGE_UNIT0; c.edx = 5u; c.nargs = 1; c.args[0] = bBoss; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = 5; ts[2] = bBoss;
    run_and_emit(0x6FC42BC0u, "MONUMOD_ApplyStrongToHitAndDamageBonus_6FC42BC0_113c", k,
                 k == 0 ? "non_monster_skip" : k == 1 ? "minion_strong_norm" : "boss_class76_halved_hell",
                 &c, ts, 3, 0u, 0);
  }

  /* [89] 0x6FC43570 MONUMOD_RollSelfResurrectEvent7_6FC43570_113c (ecx=pGame, edx=pUnit, stack=[0, 0], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t monCls = g_mon_reanim ? g_mon_reanim : 1u;
    /* k=0: mode!=0 skip; k=1: mode==0 class 1 (wAid=0 -> seed step only); k=2: mode==0 reanim class (high wAid -> seed step + event 7) */
    uint32_t clsUse = (k == 2) ? monCls : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, clsUse, 10u, (k == 0 ? 1u : 0u), 5000u, 5000u, (k == 2 ? 0x00000003u : 0x12345679u));
    stage_timer_queue();
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    run_and_emit(0x6FC43570u, "MONUMOD_RollSelfResurrectEvent7_6FC43570_113c", k,
                 k == 0 ? "mode1_skip" : k == 1 ? "mode0_no_revive_roll" : "mode0_reanim_roll",
                 &c, ts, 4, 0u, 0);
  }

  /* [94] 0x6FC70130 STATES_OnStateRemovedResetMonsterAi_6FC70130_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t uType = (k == 2) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, uType, 1u, 10u, 1u, 5000u, 5000u, 9401u);
    if (k == 1) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 1, 1);
    if (k == 2) fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 2, 1);
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    uint32_t stId = (k == 2) ? 2u : 1u;
    c.ecx = uArg; c.edx = stId; c.nargs = 1; c.args[0] = 0u; c.calleePop = 4u;
    ts[0] = uArg; ts[1] = stId; ts[2] = 0;
    run_and_emit(0x6FC70130u, "STATES_OnStateRemovedResetMonsterAi_6FC70130_113c", k,
                 k == 0 ? "null_unit_noop" : k == 1 ? "player_clear_state1" : "monster_clear_state2",
                 &c, ts, 3, 0u, 0);
  }

  /* [95] 0x6FC64A60 STATES_OnTransformStateRemoved_6FC64A60_113c (ecx=pUnit, edx=nState, stack=[pStatList], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 5u, 1u, 1u, 5000u, 5000u, 9501u);
    U32(STAGE_UNIT0 + 0xA8u) = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    uint32_t pSl = 0u;
    uint32_t stId = (k == 2) ? 140u : 139u; /* Werewolf=139, Werebear=140 */
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, (int32_t)stId, 1);
    if (k >= 1) {
      int32_t skId = (k == 1) ? 223 : 228;
      fn_SetSkillLevel((void *)(uintptr_t)STAGE_UNIT0, skId, 5, 0, 0, 0);
      pSl = (uint32_t)(uintptr_t)fn_AllocStatList(NULL, 0u, 0u, 0, 1);
      fn_SetStatIfValid((void *)(uintptr_t)pSl, 0x15E, skId, 0u);
    }
    c.ecx = STAGE_UNIT0; c.edx = stId; c.nargs = 1; c.args[0] = pSl; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = stId; ts[2] = pSl;
    run_and_emit(0x6FC64A60u, "STATES_OnTransformStateRemoved_6FC64A60_113c", k,
                 k == 0 ? "null_statlist_clears_group" : k == 1 ? "werewolf_reset_slot10" : "werebear_reset_slot10",
                 &c, ts, 3, 0u, 0);
  }

  /* [96] 0x6FC96570 MONSTER_EventHoverMsgTimeout_6FC96570_113c (ecx=pGame, edx=pMonster, stack=[0, 0], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5000u, 5000u, 9601u);
    stage_timer_queue();
    if (k >= 1) {
      U32(STAGE_UNIT0 + 0xA4u) = STAGE_SCRATCH;
      U32(STAGE_SCRATCH + 0x04u) = (k == 1) ? 400u : 20u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 0; ts[3] = 0;
    run_and_emit(0x6FC96570u, "MONSTER_EventHoverMsgTimeout_6FC96570_113c", k,
                 k == 0 ? "null_hover_noop" : k == 1 ? "future_reschedule" : "expired_clear_flag100",
                 &c, ts, 4, 0u, 0);
  }

  /* [97] 0x6FCAF470 INVENTORY_FreeAllItems_6FCAF470_113c (eax=pInventory, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 9701u);
    uint32_t pInv = (k == 0) ? 0u : (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    if (pInv != 0u) U32(STAGE_UNIT0 + 0x60u) = pInv;
    if (k == 2) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 0x33u, 0u, 5000u, 5000u, 9702u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 1u);
    }
    c.eax = pInv; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = pInv; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCAF470u, "INVENTORY_FreeAllItems_6FCAF470_113c", k,
                 k == 0 ? "null_inv" : k == 1 ? "empty_inv" : "frees_1_item_unit",
                 &c, ts, 2, 0u, 0);
  }

  /* [98] 0x6FCBB570 ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c (ecx=pUnit, ebx=pGame, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 9801u);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    if (k == 0) {
      /* Empty node list, flags=0 -> 0 */
    } else if (k == 1) {
      /* Unit flag bit 0x16 (0x400000) set -> 1 */
      U32(STAGE_UNIT0 + 0xC8u) = 0x00400000u;
    } else {
      /* Live inventory node referencing item guid 0x44 in STAGE_GAME item hash -> 1 */
      U32(STAGE_SCRATCH + 0x00u) = 0x44u;
      U32(pInv + 0x2Cu) = STAGE_SCRATCH;
      U32(pInv + 0x30u) = STAGE_SCRATCH;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 0x44u, 0u, 5000u, 5000u, 9802u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    c.ecx = STAGE_UNIT0; c.ebx = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FCBB570u, "ITEMS_HasUnitFlagOrLiveInventoryNodeItem_6FCBB570_113c", k,
                 k == 0 ? "no_flag_no_node_0" : k == 1 ? "flag_bit16_1" : "live_inv_node_item_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [99] 0x6FC91060 CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c (stdcall stack=[pGame, nMaxItemLevel, nItemType], ret 0xC, ret u16) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_GAME + 0xD0u) = 0x13579BDFu + (uint32_t)k * 0x11111u;
    U32(STAGE_GAME + 0xD4u) = 0x0000029Au;
    U16(STAGE_GAME + 0x78u) = 101u;
    uint32_t maxLvl = (k == 0) ? 0u : (k == 1 ? 15u : 60u);
    uint32_t itype  = (k == 0) ? 0x2Du : (k == 1 ? 0x1Eu : 0x03u); /* weapon, sword(0x1E), armor(0x03) */
    c.nargs = 3; c.args[0] = STAGE_GAME; c.args[1] = maxLvl; c.args[2] = itype; c.calleePop = 12u;
    ts[0] = STAGE_GAME; ts[1] = maxLvl; ts[2] = itype;
    run_and_emit(0x6FC91060u, "CUBE_RollRandomItemIdByTypeAndLevel_6FC91060_113c", k,
                 k == 0 ? "maxlvl0_none" : k == 1 ? "sword_lvl15" : "armor_lvl60",
                 &c, ts, 3, 0xFFFFu, 0);
  }

  /* [100] 0x6FC91270 STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c (eax=pPlayer, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 10001u);
    U32(STAGE_UNIT0 + 0x64u) = (uint32_t)(k + 10);
    U32(STAGE_UNIT0 + 0x68u) = (uint32_t)k;
    U8(STAGE_UNIT0 + 0x6Cu)  = (k == 0) ? 0u : 1u;
    if (k == 2) {
      uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(STAGE_UNIT0 + 0x60u) = pInv;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, g_item_ring, 0x55u, 0u, 5000u, 5000u, 10002u);
      attach_inv_item_raw(STAGE_UNIT0, STAGE_UNIT1, 0u, 0u, 1u);
    }
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC91270u, "STASH_ClearKillerInfoAndRecountScrolls_6FC91270_113c", k,
                 k == 0 ? "inactive_clears_killer" : k == 1 ? "active_clears_killer_no_inv" : "active_clears_killer_with_inv",
                 &c, ts, 2, 0u, 0);
  }
}

/* ------------------------------- Helpers for Batch 3 (VAs 97..150) */

static void stage_mon_txt(uint32_t pUData, uint32_t classId) {
  uint32_t pTables = U32(0x6FDE9E1Cu + g_com_rebase);
  if (pTables != 0u) {
    uint32_t nMon = U32(pTables + 0xA80u);
    uint32_t pMon = U32(pTables + 0xA78u);
    if (classId < nMon) {
      U32(pUData + 0x00u) = pMon + classId * 0x1A8u;
    }
  }
}

static uint32_t stage_used_skill(uint32_t pUnit, int32_t skillId, int32_t lvl) {
  uint32_t pInfo = U32(pUnit + 0xA8u);
  if (pInfo == 0u) {
    pInfo = (uint32_t)(uintptr_t)fn_AllocSkillList(NULL);
    U32(pUnit + 0xA8u) = pInfo;
  }
  fn_SetSkillLevel((void *)(uintptr_t)pUnit, skillId, lvl, 1, 0, 0);
  uint32_t pSkill = U32(pInfo + 0x04u); /* pFirstSkill */
  U32(pInfo + 0x10u) = pSkill;          /* pUsedSkill */
  return pSkill;
}

static void stage_item_defaults(uint32_t pUData, uint16_t fmt, uint32_t ilvl, uint32_t seedLo) {
  U32(pUData + 0x00u) = 4u; /* quality magic/normal */
  U32(pUData + 0x04u) = seedLo;
  U32(pUData + 0x08u) = 0x0000029Au;
  U32(pUData + 0x0Cu) = seedLo;
  U32(pUData + 0x2Cu) = ilvl;
  U16(pUData + 0x30u) = fmt;
}

/* ------------------------------- Batch 3: VAs 97..150 (Skills, Missiles, MonAI, Items/Cube/NPCs/Player) */

static void emit_batch_97_to_150(void) {
  X86CallSpec c;
  int64_t ts[10];

  /* [97] 0x6FC6E900 SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c (eax=pOwner, stack=[pMonster], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 9701u + (uint32_t)k);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 364u, 2u, 1u, 5002u, 5002u, 9711u + (uint32_t)k);
    stage_mon_txt(STAGE_UDATA1, 364u);
    if (k >= 1) {
      void *pSl = fn_AllocStatList(NULL, 0u, 0u, 0, 1);
      fn_SetStatListState(pSl, 0x61);
      fn_SetStatIfValid(pSl, 0x15F, (k == 1 ? 5 : 15), 0u);
      fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSl, 1);
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x61, 1);
    }
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_UNIT1; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FC6E900u, "SKILLS_InitNecroMageSkeletonComponents_6FC6E900_113c", k,
                 k == 0 ? "default_tier1_mage" : k == 1 ? "state61_tier5_mage" : "state61_tier15_mage",
                 &c, ts, 2, 0u, 0);
  }

  /* [98] 0x6FCBF730 SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c (esi=pMonster, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    /* Boss monster UNIT0 (guid=20), minion monster UNIT1 (guid=21) */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 20u, 1u, 5000u, 5000u, 9801u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 21u, 1u, 5002u, 5002u, 9802u);
    stage_mon_txt(STAGE_UDATA0, 1u);
    stage_mon_txt(STAGE_UDATA1, 1u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAi0 = STAGE_SCRATCH + 0x00u;
    uint32_t pAi1 = STAGE_SCRATCH + 0x60u;
    uint32_t pNode = STAGE_SCRATCH + 0xC0u;
    U32(STAGE_UDATA0 + 0x28u) = pAi0;
    U32(STAGE_UDATA1 + 0x28u) = pAi1;
    U32(pAi0 + 0x28u) = STAGE_GAME; U32(pAi0 + 0x2Cu) = 20u; U32(pAi0 + 0x30u) = 1u; U32(pAi0 + 0x34u) = pNode;
    U32(pAi1 + 0x28u) = STAGE_GAME; U32(pAi1 + 0x2Cu) = 20u; U32(pAi1 + 0x30u) = 1u;
    U32(pNode + 0x00u) = 21u; U32(pNode + 0x04u) = 0u;
    uint32_t argMon = (k == 0) ? 0u : (k == 1 ? STAGE_UNIT1 : STAGE_UNIT0);
    c.esi = argMon;
    ts[0] = argMon;
    run_and_emit(0x6FCBF730u, "SKILLS_UnlinkMonsterFromMinionList_6FCBF730_113c", k,
                 k == 0 ? "null_mon_noop" : k == 1 ? "unlink_minion_from_boss" : "free_boss_minion_list",
                 &c, ts, 1, 0u, 0);
  }

  /* [99] 0x6FCB64B0 PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c (ebx=pGame, stack=[pPetTypeSlot], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t pSlot  = STAGE_PETCTRL + 0x00u;
    uint32_t pNode0 = STAGE_PETCTRL + 0x20u;
    uint32_t pNode1 = STAGE_PETCTRL + 0x50u;
    if (k == 0) {
      U32(pSlot + 0x00u) = 0u; U32(pSlot + 0x04u) = 99u;
    } else if (k == 1) {
      U32(pSlot + 0x00u) = pNode0; U32(pSlot + 0x04u) = 1u;
      U32(pNode0 + 0x04u) = 500u; U32(pNode0 + 0x14u) = 0u;
    } else {
      U32(pSlot + 0x00u) = pNode0; U32(pSlot + 0x04u) = 2u;
      U32(pNode0 + 0x04u) = 501u; U32(pNode0 + 0x14u) = pNode1;
      U32(pNode1 + 0x04u) = 502u; U32(pNode1 + 0x14u) = 0u;
    }
    c.ebx = STAGE_GAME; c.nargs = 1; c.args[0] = pSlot; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pSlot;
    run_and_emit(0x6FCB64B0u, "PETS_KillAllPetsInSlotAndClear_6FCB64B0_113c", k,
                 k == 0 ? "empty_slot_clears_count" : k == 1 ? "one_missing_pet_node" : "two_missing_pet_nodes",
                 &c, ts, 2, 0u, 0);
  }

  /* [100] 0x6FC6F920 SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 10001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 10002u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    if (k == 0) {
      /* Self-target -> returns 0 after setting flag 0x40 */
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT0;
      U32(STAGE_PATH0 + 0x5Cu) = 0u;
      U32(STAGE_PATH0 + 0x60u) = 1u;
    } else if (k == 2) {
      /* Point STAGE_PATH0 target at STAGE_UNIT1 */
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      U32(STAGE_PATH0 + 0x5Cu) = 1u;
      U32(STAGE_PATH0 + 0x60u) = 2u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 32u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 32; ts[3] = 1;
    run_and_emit(0x6FC6F920u, "SKILLS_SrvDo32_FlagSkillEndAndExecuteEvents_6FC6F920_113c", k,
                 k == 0 ? "self_target_0" : k == 1 ? "no_target_sets_flag40_0" : "with_target_execs_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [101] 0x6FC62AD0 SKILLS_CanCastAtNonTownTargetCoords_6FC62AD0_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, (k == 1 ? 1u : 2u)); /* 1=Rogue Encampment town, 2=Blood Moor */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 0 ? 0u : STAGE_ROOM0), 0u, 1u, 1u, 1u, 5000u, 5000u, 10101u);
    if (k == 0) {
      U32(STAGE_PATH0 + 0x1Cu) = 0u; /* null room */
    } else {
      U16(STAGE_PATH0 + 0x10u) = 5005u; /* targetX */
      U16(STAGE_PATH0 + 0x12u) = 5005u; /* targetY */
      U32(STAGE_SCRATCH + 0x00u) = STAGE_ROOM0;
      U32(STAGE_ROOM0 + 0x00u)   = STAGE_SCRATCH;
      U32(STAGE_ROOM0 + 0x24u)   = 1u;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 54u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 54; ts[3] = 1;
    run_and_emit(0x6FC62AD0u, "SKILLS_CanCastAtNonTownTargetCoords_6FC62AD0_113c", k,
                 k == 0 ? "null_room_0" : k == 1 ? "town_room_0" : "wilderness_room_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [102] 0x6FCBFEF0 SKILLS_DoUnsummonStart_6FCBFEF0_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 10201u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_used_skill(STAGE_UNIT0, 209, 1); /* Unsummon */
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 363u, 88u, 1u, 5002u, 5002u, 10202u);
      stage_mon_txt(STAGE_UDATA1, 363u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_PATH0 + 0x58u) = STAGE_UNIT1;
      U32(STAGE_PATH0 + 0x5Cu) = 1u;
      U32(STAGE_PATH0 + 0x60u) = 88u;
      if (k == 2) {
        /* Make UNIT0 the pack leader of UNIT1 AND register pet guid 88 under petType 3 (Skeleton, unsummonable) */
        uint32_t pAi = STAGE_SCRATCH + 0x00u;
        U32(STAGE_UDATA1 + 0x28u) = pAi;
        U32(pAi + 0x28u) = STAGE_GAME; U32(pAi + 0x2Cu) = 1u; U32(pAi + 0x30u) = 0u;
        uint32_t pPetTbl  = STAGE_PETCTRL + 0x00u;
        uint32_t pSlots   = STAGE_PETCTRL + 0x10u;
        uint32_t pPetNode = STAGE_PETCTRL + 0x180u;
        U32(STAGE_UDATA0 + 0x44u) = pPetTbl;
        U32(pPetTbl + 0x00u)      = pSlots;
        U32(pSlots + 3u * 0x0Cu)  = pPetNode;
        U32(pPetNode + 0x04u)     = 88u;
      }
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = 209u; c.args[1] = 1u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 209; ts[3] = 1;
    run_and_emit(0x6FCBFEF0u, "SKILLS_DoUnsummonStart_6FCBFEF0_113c", k,
                 k == 0 ? "no_target_0" : k == 1 ? "not_owned_pet_0" : "owned_skeleton_pet_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [103] 0x6FC2BEE0 SKILLS_SrvSt59_Submerge_6FC2BEE0_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5000u, 5000u, 10301u);
    if (k >= 1) {
      stage_used_skill(STAGE_UNIT0, 200, (k == 1 ? 1 : 5));
    }
    if (k == 2) {
      fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x0C, 1);
      U32(STAGE_GAME + 0xA8u) = 250u;
    }
    int32_t skId = (k == 0) ? -1 : 200;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = (uint32_t)skId; c.args[1] = (uint32_t)(k == 2 ? 5 : 1); c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = (k == 2 ? 5 : 1);
    run_and_emit(0x6FC2BEE0u, "SKILLS_SrvSt59_Submerge_6FC2BEE0_113c", k,
                 k == 0 ? "neg_skill_0" : k == 1 ? "sets_state0c_and_param1" : "already_state0c_frame250",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [104] 0x6FC2BE20 SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c (esi=pUnit, eax=nHpCostFixed, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 10401u);
    /* Attach state 0x72 stat list with skillId = 36 (Fire Bolt, param5=0) or 200 */
    void *pSl = fn_AllocStatList(NULL, 0u, 0u, 0, 1);
    fn_SetStatListState(pSl, 0x72);
    U32((uint32_t)(uintptr_t)pSl + 0x1Cu) = 36u; /* dwSkillId in D2StatListStrc? Wait: verify via STATLIST_SetStat */
    fn_MergeStatLists((void *)(uintptr_t)STAGE_UNIT0, pSl, 1);
    fn_ToggleGfxState((void *)(uintptr_t)STAGE_UNIT0, 0x72, 1);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 0 ? 0x200 : 0x5000), 0);
    uint32_t cost = (k == 0) ? 0x1000u : (k == 1 ? 0x800u : 0x2000u);
    c.esi = STAGE_UNIT0; c.eax = cost;
    ts[0] = STAGE_UNIT0; ts[1] = cost;
    run_and_emit(0x6FC2BE20u, "SKILLS_ApplyBloodManaHealthCost_6FC2BE20_113c", k,
                 k == 0 ? "hp_below_cost_clamps_100_0" : k == 1 ? "deducts_800_returns_1" : "deducts_2000_returns_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [105] 0x6FC2BF90 SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c (ecx=pGame, edx=pUnit, stack=[skId, skLvl], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 10501u);
    if (k >= 1) {
      stage_used_skill(STAGE_UNIT0, (k == 1 ? 75 : 85), (k == 1 ? 1 : 3)); /* 75=Clay Golem, 85=Blood Golem */
    }
    uint32_t skId = (k == 2) ? 85u : 75u;
    uint32_t skLvl = (k == 2) ? 3u : 1u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = skId; c.args[1] = skLvl; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = skId; ts[3] = skLvl;
    run_and_emit(0x6FC2BF90u, "SKILLS_SrvSt60_InitSummonParams_6FC2BF90_113c", k,
                 k == 0 ? "no_used_skill_0" : k == 1 ? "clay_golem_params_1" : "blood_golem_params_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [106] 0x6FC46A80 SKILLS_SetupChargeOrLeapPath_6FC46A80_113c (edi=pUnit, stack=[pSkill], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t uType = (k == 2) ? 1u : 0u;
    uint32_t clsId = (k == 2) ? 1u : 4u; /* Barbarian or Monster 1 */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, (k == 0 ? 0u : STAGE_PATH0), STAGE_ROOM0, uType, clsId, 1u, 1u, 5000u, 5000u, 10601u);
    uint32_t pSkill = stage_used_skill(STAGE_UNIT0, 132, 1); /* Leap */
    if (k == 1) {
      U32(pSkill + 0x18u) = 0u; U32(pSkill + 0x1Cu) = 0u; /* zero coords -> returns 0 after setting param0C */
    } else if (k == 2) {
      U32(pSkill + 0x18u) = 5005u; U32(pSkill + 0x1Cu) = 5005u;
    }
    c.edi = STAGE_UNIT0; c.nargs = 1; c.args[0] = pSkill; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pSkill; ts[2] = 0;
    run_and_emit(0x6FC46A80u, "SKILLS_SetupChargeOrLeapPath_6FC46A80_113c", k,
                 k == 0 ? "null_path_0" : k == 1 ? "zero_target_coords_0" : "monster_leap_path_1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [107] 0x6FC46F70 SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c (eax=pUnit, stack=[pGame, nSkillId], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    uint32_t lvlId = (k == 1) ? 1u : 109u; /* Act 0 vs Act 4 */
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, lvlId);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 0 ? 0u : STAGE_ROOM0), 0u, 4u, 1u, 1u, 5000u, 5000u, 10701u + (uint32_t)k * 77u);
    if (k == 0) U32(STAGE_PATH0 + 0x1Cu) = 0u;
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 2u : 0u; /* Normal vs Hell */
    c.eax = STAGE_UNIT0; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = 131u; c.calleePop = 8u; /* 131 = Find Potion */
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = 131;
    run_and_emit(0x6FC46F70u, "SKILLS_SelectPotionCodeFromActAndDifficulty_6FC46F70_113c", k,
                 k == 0 ? "null_room_0" : k == 1 ? "act1_normal_potion" : "act5_hell_potion",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [108] 0x6FC6F370 SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c (ecx=pAuraCtx, edx=pTarget, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 10801u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 2u, 1u, (uint16_t)(k == 2 ? 5020u : 5001u), 5000u, 10802u);
    stage_mon_txt(STAGE_UDATA1, 1u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x10000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x10000, 0);
    uint32_t pAuraCtx = STAGE_SCRATCH + 0x00u;
    uint32_t pSubCtx  = STAGE_SCRATCH + 0x40u;
    U32(pAuraCtx + 0x00u) = STAGE_GAME;
    U32(pAuraCtx + 0x04u) = STAGE_UNIT0;
    U32(pAuraCtx + 0x0Cu) = (k == 0) ? 0u : pSubCtx;
    U32(pSubCtx + 0x00u)  = STAGE_DMG;
    U32(pSubCtx + 0x04u)  = 5000u;
    U32(pSubCtx + 0x08u)  = 5000u;
    U32(pSubCtx + 0x0Cu)  = 25u; /* maxPhysDistSq */
    U16(STAGE_DMG + 0x04u) = 0x0001u; /* RESULTFLAG_HIT */
    U32(STAGE_DMG + 0x08u) = 0x400u;  /* phys damage */
    U32(STAGE_DMG + 0x14u) = 0x300u;  /* fire damage */
    c.ecx = pAuraCtx; c.edx = STAGE_UNIT1;
    ts[0] = pAuraCtx; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FC6F370u, "SKILLS_ApplyCorpseExplosionAreaDamageCallback_6FC6F370_113c", k,
                 k == 0 ? "null_subctx_0" : k == 1 ? "close_phys_plus_fire_1" : "far_zeroes_phys_fire_only_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [109] 0x6FC6E500 SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c (stdcall [pDef, pAtk, pDmg, skId, skLvl], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 10901u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, (k == 2 ? 0x120 : 0x2000), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x2000, 0);
    uint32_t bgCls = g_mon_bloodgolem ? g_mon_bloodgolem : 290u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, bgCls, 2u, 1u, 5002u, 5002u, 10902u);
    stage_mon_txt(STAGE_UDATA1, bgCls);
    uint32_t pAi = STAGE_SCRATCH + 0x00u;
    U32(STAGE_UDATA1 + 0x28u) = pAi;
    U32(pAi + 0x28u) = STAGE_GAME; U32(pAi + 0x2Cu) = 1u; U32(pAi + 0x30u) = 0u;
    U32(STAGE_DMG + 0x4Cu) = (k == 0) ? 0u : 0x1000u;
    c.nargs = 5;
    c.args[0] = STAGE_UNIT1; c.args[1] = 0u; c.args[2] = STAGE_DMG; c.args[3] = 85u; c.args[4] = 1u;
    c.calleePop = 20u;
    ts[0] = STAGE_UNIT1; ts[1] = 0; ts[2] = STAGE_DMG; ts[3] = 85; ts[4] = 1;
    run_and_emit(0x6FC6E500u, "SKILLS_TransferGolemDamageToOwnerLife_6FC6E500_113c", k,
                 k == 0 ? "zero_dmg_0" : k == 1 ? "transfers_dmg_to_owner" : "clamps_owner_life_at_100",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [110] 0x6FCB72C0 PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c (eax=pPetSlot, ecx=pTargetRoom, ebx=pGame, stack=[nX, nY], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t pSlot  = STAGE_PETCTRL + 0x00u;
    uint32_t pNode0 = STAGE_PETCTRL + 0x20u;
    if (k >= 1) {
      U32(pSlot + 0x00u)  = pNode0;
      U8(pNode0 + 0x00u)  = (k == 1) ? 1u : 0u; /* bit0 = skip flag */
      U32(pNode0 + 0x04u) = 42u;
      U32(pNode0 + 0x14u) = 0u;
    }
    uint32_t gameArg = (k == 2) ? 0u : STAGE_GAME; /* k=2 tests null-game assert 0x2D3 */
    c.eax = pSlot; c.ecx = STAGE_ROOM0; c.ebx = gameArg;
    c.nargs = 2; c.args[0] = 5010u; c.args[1] = 5020u; c.calleePop = 8u;
    ts[0] = pSlot; ts[1] = STAGE_ROOM0; ts[2] = gameArg; ts[3] = 5010; ts[4] = 5020;
    run_and_emit(0x6FCB72C0u, "PETS_WarpPetListBucketToRoomAndCoord_6FCB72C0_113c", k,
                 k == 0 ? "empty_slot_noop" : k == 1 ? "bit0_skipped_node" : "null_game_assert_2d3",
                 &c, ts, 5, 0u, (k == 2 ? 1 : 0));
  }

  /* [111] 0x6FC2C1B0 SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c (ecx=pGame, edx=pUnit, stack=[0,0], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, 0u, (k == 1 ? 0u : 1u), 1u, 10u, 12u, 5000u, 5000u, 11101u);
    U32(STAGE_PATH0 + 0x1Cu) = 0u; /* null room: 0x6FCD33B0 returns early, 0x6FC2C1B0 clears flags & sets colmask 0x100 */
    stage_mon_txt(STAGE_UDATA0, 1u);
    U32(STAGE_UNIT0 + 0xC4u) = 0x0000001Eu; /* dead/corpse bits + extra bit */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x2000, 0);
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = uArg; c.nargs = 2; c.args[0] = 0u; c.args[1] = 0u; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = uArg; ts[2] = 0; ts[3] = 0;
    run_and_emit(0x6FC2C1B0u, "SKILLS_SrvDo_ResurrectMonsterAndSetCollisionMask_6FC2C1B0_113c", k,
                 k == 0 ? "null_unit_0" : k == 1 ? "player_unit_0" : "resurrects_monster_colmask_1",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [112] 0x6FC7E8D0 ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c (ecx=pObjInit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 114u);
    stage_timer_queue();
    U32(STAGE_GAME + 0xA8u)       = 100u; /* dwGameFrame */
    U32(STAGE_GAME + 0x10F4u)     = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x00u)  = STAGE_QUEST0;
    U32(STAGE_QUEST0 + 0x00u)     = 0x21u; /* Act 5 Q3 */
    U32(STAGE_QUEST0 + 0x04u)     = STAGE_GAME;
    U8(STAGE_QUEST0 + 0x09u)      = (k == 0) ? 0u : 1u;
    U32(STAGE_QUEST0 + 0x18u)     = STAGE_QUESTEX0;
    U8(STAGE_QUESTEX0 + 0xA4u)    = (k == 1) ? 1u : 0u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, (k == 1 ? 0x5555u : 0x7777u), 0u, 5000u, 5000u, 11201u);
    U32(STAGE_SCRATCH + 0x00u)    = STAGE_GAME;
    U32(STAGE_SCRATCH + 0x04u)    = STAGE_UNIT0;
    c.ecx = STAGE_SCRATCH;
    ts[0] = STAGE_SCRATCH;
    run_and_emit(0x6FC7E8D0u, "ACT5Q3_InitFrozenAnyaObject_6FC7E8D0_113c", k,
                 k == 0 ? "inactive_quest_noop" : k == 1 ? "already_started_sets_guid" : "schedules_event7_frame125",
                 &c, ts, 1, 0u, 0);
  }

  /* [113] 0x6FCB7640 PETS_FreePlayerPetTable_6FCB7640_113c (ecx=pGame, edx=pPlayer, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, (k == 0 ? 0u : STAGE_UDATA0), STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 11301u);
    if (k == 2) {
      uint32_t pPetTbl = STAGE_PETCTRL + 0x00u;
      uint32_t pSlots  = STAGE_PETCTRL + 0x10u; /* 20*12 = 0xF0 zeroed slots */
      U32(STAGE_UDATA0 + 0x44u) = pPetTbl;
      U32(pPetTbl + 0x00u)      = pSlots;
    }
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FCB7640u, "PETS_FreePlayerPetTable_6FCB7640_113c", k,
                 k == 0 ? "null_pdata_assert_14f" : k == 1 ? "null_pet_table_noop" : "clears_pet_table_ptr",
                 &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [114] 0x6FC62510 SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c (eax=pCaster, edi=pTarget, stack=[pGame, nMis, nSk, nLvl], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u); /* town */
    stage_room(STAGE_ROOM1, STAGE_ROOMEX1, STAGE_LEVEL1, 2u); /* wilderness */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, (k == 1 ? STAGE_ROOM0 : STAGE_ROOM1), 0u, 1u, 1u, 1u, 5000u, 5000u, 11401u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, (k == 2 ? STAGE_ROOM0 : STAGE_ROOM1), 1u, 1u, 2u, 1u, 5004u, 5004u, 11402u);
    uint32_t casterArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.eax = casterArg; c.edi = STAGE_UNIT1;
    c.nargs = 4; c.args[0] = STAGE_GAME; c.args[1] = 1u; c.args[2] = 36u; c.args[3] = 1u; c.calleePop = 16u;
    ts[0] = casterArg; ts[1] = STAGE_UNIT1; ts[2] = STAGE_GAME; ts[3] = 1; ts[4] = 36; ts[5] = 1;
    run_and_emit(0x6FC62510u, "SKILLS_SpawnProjectileAtTargetUnitIfBothOutsideTown_6FC62510_113c", k,
                 k == 0 ? "null_caster_0" : k == 1 ? "caster_in_town_0" : "target_in_town_0",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [115] 0x6FC62B40 SKILLS_ApplyDirectSkillElemDamageAndIcon_6FC62B40_113c (ecx=pGame, stack=[pAtk, pDef, 0, skId, skLvl], ret 0x14) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 11501u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 1 ? 2u : 0u), 0u, 2u, 1u, 5002u, 5002u, 11502u);
    if (k == 2) {
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x20000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x20000, 0);
    }
    uint32_t atkArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME;
    c.nargs = 5; c.args[0] = atkArg; c.args[1] = STAGE_UNIT1; c.args[2] = 0u; c.args[3] = 36u; c.args[4] = 1u; c.calleePop = 20u;
    ts[0] = STAGE_GAME; ts[1] = atkArg; ts[2] = STAGE_UNIT1; ts[3] = 0; ts[4] = 36; ts[5] = 1;
    run_and_emit(0x6FC62B40u, "SKILLS_ApplyDirectSkillElemDamageAndIcon_6FC62B40_113c", k,
                 k == 0 ? "null_attacker_0" : k == 1 ? "object_defender_0" : "applies_firebolt_elem_dmg_1",
                 &c, ts, 6, 0xFFFFFFFFu, 0);
  }

  /* [116] 0x6FC59080 MISSILES_ApplyColdLengthToDamage_6FC59080_113c (edx=pMissile, stack=[pUnit, pDamage], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t misCls = g_missile_cold ? g_missile_cold : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, misCls, 10u, 0u, 5000u, 5000u, 11601u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x38, (k == 1 ? 200 : 0x200000), 0);
    U32(STAGE_DMG + 0x30u) = 99u; /* dwFreezeLen gets zeroed when applied */
    U32(STAGE_DMG + 0x34u) = 77u;
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.edx = misArg; c.nargs = 2; c.args[0] = 0u; c.args[1] = STAGE_DMG; c.calleePop = 8u;
    ts[0] = misArg; ts[1] = 0; ts[2] = STAGE_DMG;
    run_and_emit(0x6FC59080u, "MISSILES_ApplyColdLengthToDamage_6FC59080_113c", k,
                 k == 0 ? "null_missile_noop" : k == 1 ? "small_cold_len_200" : "large_cold_len_2m",
                 &c, ts, 3, 0u, 0);
  }

  /* [117] 0x6FC596E0 MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c (ecx=pGame, edx=pMissile, stack=[pTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t misCls = g_missile_drain ? g_missile_drain : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, misCls, 10u, 0u, 5000u, 5000u, 11701u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5002u, 5002u, 11702u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 8, (k == 1 ? 0 : 0x4000), 0);
    uint32_t tgtArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = tgtArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = tgtArg;
    run_and_emit(0x6FC596E0u, "MISSILES_SrvDo_DrainPlayerManaPct_6FC596E0_113c", k,
                 k == 0 ? "null_target_2" : k == 1 ? "zero_mana_1" : "drains_player_mana_2",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [118] 0x6FC5A1D0 MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c (ecx=pGame, ebx=pMissile, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t ownerType = (k == 0) ? 2u : 0u; /* k=0: object (static path), k=2: player (dynamic path) */
    uint16_t ox = (k == 0) ? 5060u : 5040u;
    uint16_t oy = (k == 0) ? 5070u : 5050u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, ownerType, 1u, 1u, 1u, ox, oy, 11801u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 3u, 1u, 20u, 0u, 5000u, 5000u, 11802u);
    U32(STAGE_UNIT1 + 0x94u) = ownerType;
    U32(STAGE_UNIT1 + 0x98u) = 1u;
    U32(STAGE_UNIT1 + 0xC8u) = (k == 1) ? 0u : (1u << 10);
    c.ecx = STAGE_GAME; c.ebx = STAGE_UNIT1;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FC5A1D0u, "MISSILES_WarpPathToOwnerPos_6FC5A1D0_113c", k,
                 k == 0 ? "warps_to_object_owner_5060_5070" : k == 1 ? "no_owner_bit_noop" : "warps_to_player_owner_5040_5050",
                 &c, ts, 2, 0u, 0);
  }

  /* [119] 0x6FC59E30 MISSILES_SrvDmg14_HolyBoltHeal_6FC59E30_113c (ecx=pGame, edx=pMissile, stack=[pTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 3u, 1u, 1u, 5000u, 5000u, 11901u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 3u, 1u, 20u, 0u, 5001u, 5001u, 11902u);
    U32(STAGE_UNIT1 + 0x94u) = 0u; U32(STAGE_UNIT1 + 0x98u) = 1u; U32(STAGE_UNIT1 + 0xC8u) = (1u << 10);
    U16(STAGE_UDATA1 + 0x0Au) = 101u; /* Holy Bolt */
    U16(STAGE_UDATA1 + 0x0Cu) = (uint16_t)(k == 2 ? 5u : 1u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 0u, 0u, 2u, 1u, 5002u, 5002u, 11903u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 6, (k == 1 ? 0x1000 : 0x3F00), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT2, 7, 0x4000, 0);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = STAGE_UNIT2; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = STAGE_UNIT2;
    run_and_emit(0x6FC59E30u, "MISSILES_SrvDmg14_HolyBoltHeal_6FC59E30_113c", k,
                 k == 0 ? "null_missile_1" : k == 1 ? "heals_injured_ally" : "clamps_heal_to_max_life",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [120] 0x6FC5A920 MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c (ecx=pGame, edx=pMissile, stack=[pTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 12001u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 6, 0x1000, 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 7, 0x4000, 0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 3u, 1u, 20u, 0u, 5001u, 5001u, 12002u);
    U32(STAGE_UNIT1 + 0x94u) = 0u; U32(STAGE_UNIT1 + 0x98u) = 1u;
    U32(STAGE_UNIT1 + 0xC8u) = (k == 1) ? 0u : (1u << 10);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 48, 0x500, 0); /* firemindam */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 49, 0x500, 0); /* firemaxdam */
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 12003u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = STAGE_UNIT2; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = STAGE_UNIT2;
    run_and_emit(0x6FC5A920u, "MISSILE_SrvDmg_HealOwnerFromElemDamage_6FC5A920_113c", k,
                 k == 0 ? "null_missile_1" : k == 1 ? "no_owner_bit_1" : "heals_owner_returns_2_or_3",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [121] 0x6FC5AAA0 MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c (ecx=pGame, edx=pMis, stack=[pTgt, pDmg], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 12101u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 0x19, (k == 2 ? 150 : 50), 0); /* STAT_DAMAGEPERCENT */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 3u, 1u, 20u, 0u, 5001u, 5001u, 12102u);
    U32(STAGE_UNIT1 + 0x94u) = 0u; U32(STAGE_UNIT1 + 0x98u) = 1u; U32(STAGE_UNIT1 + 0xC8u) = (1u << 10);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, (k == 0 ? 0u : 1u), 1u, 2u, 1u, 5002u, 5002u, 12103u);
    U32(STAGE_DMG + 0x08u) = 1000u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT1; c.nargs = 2; c.args[0] = STAGE_UNIT2; c.args[1] = STAGE_DMG; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1; ts[2] = STAGE_UNIT2; ts[3] = STAGE_DMG;
    run_and_emit(0x6FC5AAA0u, "MISSILE_SrvDmg_ApplyOwnerDmgPercentAndDemonUndeadBonus_6FC5AAA0_113c", k,
                 k == 0 ? "player_target_noop" : k == 1 ? "owner_50pct_bonus" : "owner_150pct_bonus",
                 &c, ts, 4, 0u, 0);
  }

  /* [122] 0x6FC59A40 MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c (ecx=pGame, edx=pMis, stack=[pTgt, pDmg], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    uint32_t misCls = g_missile_sizehit ? g_missile_sizehit : 1u;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, misCls, 20u, 0u, 5000u, 5000u, (k == 2 ? 0x00000001u : 0x12345679u));
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 1 ? 0u : 1u), 1u, 2u, 1u, 5002u, 5002u, 12202u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 2; c.args[0] = STAGE_UNIT1; c.args[1] = STAGE_DMG; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = STAGE_UNIT1; ts[3] = STAGE_DMG;
    run_and_emit(0x6FC59A40u, "MISSILES_SrvHit_RollSizeScaledHitFlag_6FC59A40_113c", k,
                 k == 0 ? "null_missile_noop" : k == 1 ? "player_target_roll" : "monster_target_roll",
                 &c, ts, 4, 0u, 0);
  }

  /* [123] 0x6FC61AE0 MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 1u, 20u, 0u, 5000u, 5000u, 12301u);
    U16(STAGE_UDATA0 + 0x10u) = (uint16_t)(k == 2 ? 0u : 10u); /* nRemainingFrames */
    U32(STAGE_PATH0 + 0x7Cu)  = (k == 0) ? 0x1800u : 0u; /* velocity: moving vs stopped */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC61AE0u, "MISSILE_SrvDo_StoppedSubtileCollision_6FC61AE0_113c", k,
                 k == 0 ? "moving_skips_mask40" : k == 1 ? "stopped_stamps_mask40_alive" : "stopped_expired_0",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [124] 0x6FC60860 MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c (ecx=pGame, edx=pMissile, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, (k == 1 ? 0u : 1u), 5030u, 5040u, 12401u);
    if (k >= 1) insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 3u, 1u, 20u, 0u, 5000u, 5000u, 12402u);
    U32(STAGE_UNIT1 + 0x94u) = 0u; U32(STAGE_UNIT1 + 0x98u) = 1u; U32(STAGE_UNIT1 + 0xC8u) = (1u << 10);
    U16(STAGE_UDATA1 + 0x10u) = 3u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT1;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT1;
    run_and_emit(0x6FC60860u, "MISSILE_SrvDo_FollowOwnerOrCollide_6FC60860_113c", k,
                 k == 0 ? "missing_owner_collide_2" : k == 1 ? "dead_owner_collide_2" : "live_owner_warps_1",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [125] 0x6FC5BBB0 MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c (ecx=pGame, edx=pMis, stack=[pTgt], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x08u) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u)    = STAGE_QBITS0 + 0x10u;
    U32(STAGE_QBITS0 + 0x04u)    = 0x60u;
    set_qbit(STAGE_QBITS0, 0x24u, 0u); /* bit 0 set -> CheckNotIntro returns 0 -> skips monster spawn, toggles room portal flag */
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 1u, 20u, 0u, 5000u, 5000u, 12501u);
    U32(STAGE_UDATA0 + 0x28u) = (k == 1) ? 1u : 0u; /* nTargetX */
    uint32_t tgtArg = (k == 0) ? STAGE_UNIT0 : 0u;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = tgtArg; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = tgtArg;
    run_and_emit(0x6FC5BBB0u, "MISSILE_SrvDmg_TriggerQuest24PortalSpawnOnExpire_6FC5BBB0_113c", k,
                 k == 0 ? "nonnull_target_noop" : k == 1 ? "already_triggered_noop" : "triggers_targetx1_and_portal_flag",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [126] 0x6FC5F670 MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c (ecx=pGame, edx=pMis, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 109u);
    U32(STAGE_GAME + 0x10F4u)    = STAGE_QUESTCTRL;
    U32(STAGE_QUESTCTRL + 0x08u) = STAGE_QBITS0;
    U32(STAGE_QBITS0 + 0x00u)    = STAGE_QBITS0 + 0x10u;
    U32(STAGE_QBITS0 + 0x04u)    = 0x60u;
    set_qbit(STAGE_QBITS0, 0x24u, 0u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 3u, 1u, 20u, 0u, 5000u, 5000u, 12601u);
    U16(STAGE_UDATA0 + 0x10u) = (uint16_t)(k == 0 ? 150u : (k == 1 ? 50u : 0u));
    U32(STAGE_UDATA0 + 0x28u) = 0u; /* nTargetX */
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC5F670u, "MISSILE_SrvDo_LinearQuest24PortalTrigger_6FC5F670_113c", k,
                 k == 0 ? "rem150_no_trigger" : k == 1 ? "rem50_triggers_portal_flag" : "rem0_triggers_and_expires",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [127] 0x6FC59DA0 MISSILES_SrvDmg05_DispatchSkillSrvDo_6FC59DA0_113c (ecx=pGame, edx=pMis, stack=[pTgt], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 1u, 1u, 1u, 5000u, 5000u, 12701u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    uint32_t misCls = g_missile_srvdmg5 ? g_missile_srvdmg5 : 1u;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 3u, misCls, 20u, 0u, 5001u, 5001u, 12702u);
    U32(STAGE_UNIT1 + 0x94u) = 0u; U32(STAGE_UNIT1 + 0x98u) = 1u; U32(STAGE_UNIT1 + 0xC8u) = (1u << 10);
    U16(STAGE_UDATA1 + 0x0Au) = (uint16_t)(k == 1 ? 0u : 36u); /* skillId */
    U16(STAGE_UDATA1 + 0x0Cu) = (uint16_t)(k == 1 ? 0u : 1u);  /* level */
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 2u, 1u, 5002u, 5002u, 12703u);
    uint32_t misArg = (k == 0) ? 0u : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = misArg; c.nargs = 1; c.args[0] = STAGE_UNIT2; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = misArg; ts[2] = STAGE_UNIT2;
    run_and_emit(0x6FC59DA0u, "MISSILES_SrvDmg05_DispatchSkillSrvDo_6FC59DA0_113c", k,
                 k == 0 ? "null_missile_1" : k == 1 ? "zero_skill_skips_1" : "binds_target_and_dispatches_1",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [128] 0x6FC35C40 AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c (ecx=pGame, edx=pOrigin, stack=[pCand, pCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 110u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 449u, 10u, 1u, 5000u, 5000u, 12801u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, g_mon_overlord_min, 11u, 1u, 5002u, 5002u, 12802u);
    stage_mon_txt(STAGE_UDATA0, 449u);
    stage_mon_txt(STAGE_UDATA1, g_mon_overlord_min);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, (k == 2 ? 0x100 : 0x1000), 0);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x1000, 0);
    uint32_t pCtx = STAGE_SCRATCH;
    U32(pCtx + 0x00u) = 100u; /* maxInjuredDistSq */
    U32(pCtx + 0x04u) = 100u; /* maxWhipDistSq */
    U32(pCtx + 0x08u) = 50u;  /* injuredPctThreshold */
    uint32_t candArg = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c.ecx = STAGE_GAME; c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = candArg; c.args[1] = pCtx; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = candArg; ts[3] = pCtx;
    run_and_emit(0x6FC35C40u, "AI_ScanOverlordMinionTargetsCallback_6FC35C40_113c", k,
                 k == 0 ? "self_cand_skip" : k == 1 ? "full_hp_minion_whippable" : "injured_minion_both_slots",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [129] 0x6FC9BB90 AI_ScanCallbackFetishMinions_6FC9BB90_113c (edx=pUnit, stack=[pCand, pCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 76u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 278u, 10u, 1u, 5000u, 5000u, 12901u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, g_mon_fetish, 11u, (k == 1 ? 0x0Cu : 1u), 5003u, 5004u, 12902u);
    stage_mon_txt(STAGE_UDATA0, 278u);
    stage_mon_txt(STAGE_UDATA1, g_mon_fetish);
    U32(STAGE_UNIT1 + 0xC4u) |= 2u; /* bit 1 required */
    uint32_t pCtx = STAGE_SCRATCH;
    U32(pCtx + 0x04u) = 999u; /* bestCorpseDist */
    U32(pCtx + 0x08u) = 200u; /* maxDistSq */
    U32(pCtx + 0x10u) = 999u; /* bestAliveDist */
    U32(pCtx + 0x18u) = 2u;   /* skip packLeader check */
    uint32_t candArg = (k == 0) ? STAGE_UNIT0 : STAGE_UNIT1;
    c.edx = STAGE_UNIT0; c.nargs = 2; c.args[0] = candArg; c.args[1] = pCtx; c.calleePop = 8u;
    ts[0] = STAGE_UNIT0; ts[1] = candArg; ts[2] = pCtx;
    run_and_emit(0x6FC9BB90u, "AI_ScanCallbackFetishMinions_6FC9BB90_113c", k,
                 k == 0 ? "self_skip" : k == 1 ? "corpse_fetish_recorded" : "alive_fetish_counted",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [130] 0x6FC416A0 AIGENERAL_RemoveFromMinionList_6FC416A0_113c (eax=pMinion, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 30u, 1u, 5000u, 5000u, 13001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 1u, 31u, 1u, 5002u, 5002u, 13002u);
    stage_unit_common(STAGE_UNIT2, STAGE_UDATA2, STAGE_PATH2, STAGE_ROOM0, 1u, 1u, 32u, 1u, 5004u, 5004u, 13003u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    insert_server_unit(STAGE_GAME, STAGE_UNIT2);
    uint32_t pAi0 = STAGE_SCRATCH + 0x00u;
    uint32_t pAi1 = STAGE_SCRATCH + 0x40u;
    uint32_t pAi2 = STAGE_SCRATCH + 0x80u;
    uint32_t pN1  = STAGE_SCRATCH + 0xC0u;
    uint32_t pN2  = STAGE_SCRATCH + 0xD0u;
    U32(STAGE_UDATA0 + 0x28u) = pAi0;
    U32(STAGE_UDATA1 + 0x28u) = pAi1;
    U32(STAGE_UDATA2 + 0x28u) = pAi2;
    U32(pAi0 + 0x28u) = STAGE_GAME; U32(pAi0 + 0x2Cu) = 30u; U32(pAi0 + 0x30u) = 1u; U32(pAi0 + 0x34u) = pN1;
    U32(pAi1 + 0x28u) = STAGE_GAME; U32(pAi1 + 0x2Cu) = 30u; U32(pAi1 + 0x30u) = 1u;
    U32(pAi2 + 0x28u) = STAGE_GAME; U32(pAi2 + 0x2Cu) = 30u; U32(pAi2 + 0x30u) = 1u;
    U32(pN1 + 0x00u) = 31u; U32(pN1 + 0x04u) = pN2;
    U32(pN2 + 0x00u) = 32u; U32(pN2 + 0x04u) = 0u;
    uint32_t minArg = (k == 0) ? 0u : (k == 1 ? STAGE_UNIT1 : STAGE_UNIT2);
    c.eax = minArg;
    ts[0] = STAGE_GAME; ts[1] = minArg;
    run_and_emit(0x6FC416A0u, "AIGENERAL_RemoveFromMinionList_6FC416A0_113c", k,
                 k == 0 ? "null_minion_noop" : k == 1 ? "unlink_head_minion" : "unlink_tail_minion",
                 &c, ts, 2, 0u, 0);
  }

  /* [131] 0x6FC359B0 AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c (edx=pUnit, stack=[pAiThinkArg], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 131u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 544u, 40u, 1u, 5010u, 5025u, 13101u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 1u, 543u, 41u, 1u, 5000u, 5005u, 13102u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    uint32_t pAi0      = STAGE_SCRATCH + 0x00u;
    uint32_t pAiParam  = STAGE_SCRATCH + 0x40u;
    uint32_t pThinkArg = STAGE_SCRATCH + 0x80u;
    U32(STAGE_UDATA0 + 0x28u) = pAi0;
    U32(pAi0 + 0x28u) = (k == 0) ? 0u : STAGE_GAME;
    U32(pAi0 + 0x2Cu) = (k == 2) ? 40u : 41u; /* k=1: owner=UNIT1, k=2: self-owner -> rolls seed%100 */
    U32(pAi0 + 0x30u) = 1u;
    U32(pThinkArg + 0x00u) = pAiParam;
    c.edx = STAGE_UNIT0; c.nargs = 1; c.args[0] = pThinkArg; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = pThinkArg;
    run_and_emit(0x6FC359B0u, "AI_InitBaalThroneTentaclePositionDelta_6FC359B0_113c", k,
                 k == 0 ? "null_owner_assert_e17" : k == 1 ? "owner_delta_10_20" : "self_owner_rolls_param1c",
                 &c, ts, 2, 0u, (k == 0 ? 1 : 0));
  }

  /* [132] 0x6FC9BE10 AI_UnburrowAndScheduleThink_6FC9BE10_113c (eax=pGame, esi=pUnit, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 41u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5000u, 5000u, 13201u);
    stage_timer_queue();
    U32(STAGE_UNIT0 + 0xC4u) = (k == 0) ? 0x0Fu : (k == 1 ? 0x1Eu : 0xFFu);
    U32(STAGE_GAME + 0xA8u)  = (k == 0) ? 100u : (k == 1 ? 200u : 500u);
    c.eax = STAGE_GAME; c.esi = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC9BE10u, "AI_UnburrowAndScheduleThink_6FC9BE10_113c", k,
                 k == 0 ? "unburrow_frame100" : k == 1 ? "unburrow_frame200" : "unburrow_frame500",
                 &c, ts, 2, 0u, 0);
  }

  /* [133] 0x6FC39A00 AI_MapAiAction5_WalkAndMode9_113c (ecx=pGame, edx=pUnit, stack=[pAiArgs, pEntry], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 148u, 10u, 1u, 5000u, 5000u, 13301u);
    uint32_t pEntry = STAGE_SCRATCH + 0x00u;
    U32(pEntry + 0x04u) = (k == 1) ? 0u : 5010u; /* nX */
    U32(pEntry + 0x08u) = (k == 2) ? 0u : 5020u; /* nY */
    uint32_t uArg = (k == 0) ? 0u : STAGE_UNIT0;
    c.ecx = STAGE_GAME; c.edx = uArg; c.nargs = 2; c.args[0] = 0u; c.args[1] = pEntry; c.calleePop = 8u;
    ts[0] = STAGE_GAME; ts[1] = uArg; ts[2] = pEntry;
    run_and_emit(0x6FC39A00u, "AI_MapAiAction5_WalkAndMode9_113c", k,
                 k == 0 ? "null_unit_0" : k == 1 ? "zero_x_0" : "zero_y_0",
                 &c, ts, 3, 0xFFu, 0);
  }

  /* [134] 0x6FCA4720 AI_SelectHostileTargetByMetrics_6FCA4720_113c (edi=pGame, esi=pMon, ebx=pMonStats, stack=[pDefaultTarget], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5000u, 5000u, 13401u);
    stage_mon_txt(STAGE_UDATA0, 1u);
    uint32_t pMonStats = U32(STAGE_UDATA0 + 0x00u);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_ROOM0;
    U32(STAGE_ROOM0 + 0x00u)   = STAGE_SCRATCH;
    U32(STAGE_ROOM0 + 0x24u)   = 1u;
    if (k == 2) {
      /* Place a hostile player unit in the room */
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5002u, 5002u, 13402u);
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT1; /* pUnitFirst */
    }
    uint32_t defTgt = (k == 0) ? 0u : STAGE_UNIT0;
    c.edi = STAGE_GAME; c.esi = STAGE_UNIT0; c.ebx = pMonStats;
    c.nargs = 1; c.args[0] = defTgt; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0; ts[2] = pMonStats; ts[3] = defTgt;
    run_and_emit(0x6FCA4720u, "AI_SelectHostileTargetByMetrics_6FCA4720_113c", k,
                 k == 0 ? "empty_room_null_default" : k == 1 ? "empty_room_returns_default" : "room_with_player_scan",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [135] 0x6FC90CF0 CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c (eax=pCubeMainTxt, ebx=pInv, stack=[pGame, pCubeOutCtx], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 13501u);
    uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
    U32(STAGE_UNIT0 + 0x60u) = pInv;
    uint32_t pRecipe = STAGE_SCRATCH + 0x00u;
    uint32_t pOutCtx = STAGE_SCRATCH + 0x200u;
    /* k=0: null recipe -> 0; k=1: recipe with 0 inputs (all 7 slots empty) -> 1; k=2: recipe with 1 required input -> 0 */
    if (k == 2) {
      U8(pRecipe + 0x10u) = 1u; /* bNumInputs = 1 */
      U8(pRecipe + 0x14u) = 1u; /* Input[0].bFlags = 1 (active item match required) */
    }
    uint32_t recArg = (k == 0) ? 0u : pRecipe;
    c.eax = recArg; c.ebx = pInv; c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = pOutCtx; c.calleePop = 8u;
    ts[0] = recArg; ts[1] = pInv; ts[2] = STAGE_GAME; ts[3] = pOutCtx;
    run_and_emit(0x6FC90CF0u, "CUBE_ValidateAllRecipeInputSlots_6FC90CF0_113c", k,
                 k == 0 ? "null_recipe_0" : k == 1 ? "empty_recipe_matches_1" : "missing_input_fails_0",
                 &c, ts, 4, 0xFFFFFFFFu, 0);
  }

  /* [136] 0x6FCB0170 NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c (eax=pGame, stack=[pNpcSlot], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 148u, 10u, 1u, 5000u, 5000u, 13601u);
    uint32_t pSlot = STAGE_NPCCTRL + 0x00u;
    if (k >= 1) {
      uint32_t pVendorInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(pSlot + 0x04u) = pVendorInv;
    }
    if (k == 2) {
      uint32_t pGambleNode = STAGE_NPCCTRL + 0x80u;
      uint32_t pGambleInv  = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT0);
      U32(pGambleNode + 0x00u) = pGambleInv;
      U32(pGambleNode + 0x08u) = 0u;
      U32(pSlot + 0x08u) = pGambleNode;
      U32(pSlot + 0x0Cu) = 1u; /* has gamble */
    }
    c.eax = STAGE_GAME; c.nargs = 1; c.args[0] = pSlot; c.calleePop = 4u;
    ts[0] = STAGE_GAME; ts[1] = pSlot;
    run_and_emit(0x6FCB0170u, "NPCS_FreeVendorAndGambleInventoriesForSlot_6FCB0170_113c", k,
                 k == 0 ? "empty_slot_noop" : k == 1 ? "frees_vendor_inv" : "frees_vendor_and_gamble_inv",
                 &c, ts, 2, 0u, 0);
  }

  /* [137] 0x6FC34B30 ITEMS_RollRareNameIdByFormat_6FC34B30_113c (esi=pItem, edi=bIsPrefix, ret, u16) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, 50u, 0u, 5000u, 5000u, 13701u);
    stage_item_defaults(STAGE_UDATA0, (uint16_t)(k == 0 ? 0u : 100u), 50u, 0x13572469u + (uint32_t)k * 31u);
    uint32_t isPref = (k == 2) ? 0u : 1u;
    c.esi = STAGE_UNIT0; c.edi = isPref;
    ts[0] = STAGE_UNIT0; ts[1] = isPref;
    run_and_emit(0x6FC34B30u, "ITEMS_RollRareNameIdByFormat_6FC34B30_113c", k,
                 k == 0 ? "fmt0_prefix_roll" : k == 1 ? "fmt100_prefix_roll" : "fmt100_suffix_roll",
                 &c, ts, 2, 0xFFFFu, 0);
  }

  /* [138] 0x6FC341E0 ITEMS_ApplySetItemModsByFormat_6FC341E0_113c (eax=pItem, stack=[pItemDrop], ret 4) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, 51u, 0u, 5000u, 5000u, 13801u);
    stage_item_defaults(STAGE_UDATA0, (uint16_t)(k == 0 ? 0u : 100u), (k == 1 ? 1u : 85u), 0x24681357u + (uint32_t)k);
    U32(STAGE_SCRATCH + 0x00u) = STAGE_GAME; /* pItemDrop->pGame */
    c.eax = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_SCRATCH; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_SCRATCH;
    run_and_emit(0x6FC341E0u, "ITEMS_ApplySetItemModsByFormat_6FC341E0_113c", k,
                 k == 0 ? "fmt0_ring_set" : k == 1 ? "fmt100_ilvl1_ring" : "fmt100_ilvl85_ring",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [139] 0x6FC34B50 ITEMS_RollMagicAffixByFormat_6FC34B50_113c (esi=pItem, ebx=bIsPref, edi=nForced, stack=[bAllowMagic, bForce, bApply, dwReqGrp], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, 52u, 0u, 5000u, 5000u, 13901u);
    stage_item_defaults(STAGE_UDATA0, (uint16_t)(k == 0 ? 0u : 100u), 50u, 0x36925815u + (uint32_t)k * 17u);
    uint32_t isPref = (k == 2) ? 0u : 1u;
    c.esi = STAGE_UNIT0; c.ebx = isPref; c.edi = 0u;
    c.nargs = 4; c.args[0] = 1u; c.args[1] = 1u; c.args[2] = 0u; c.args[3] = 0u; c.calleePop = 16u;
    ts[0] = STAGE_UNIT0; ts[1] = isPref; ts[2] = 0; ts[3] = 1; ts[4] = 1; ts[5] = 0; ts[6] = 0;
    run_and_emit(0x6FC34B50u, "ITEMS_RollMagicAffixByFormat_6FC34B50_113c", k,
                 k == 0 ? "fmt0_prefix" : k == 1 ? "fmt100_prefix" : "fmt100_suffix",
                 &c, ts, 7, 0xFFFFFFFFu, 0);
  }

  /* [140] 0x6FC2EE70 ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c (eax=pGame, esi=pItem, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, g_item_ring, (uint32_t)(60 + k), 3u, 5000u, 5000u, 14001u);
    insert_server_unit(STAGE_GAME, STAGE_UNIT0);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 14002u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
      U32(STAGE_GAME + 0x88u)    = STAGE_CLIENT;
      U32(STAGE_CLIENT + 0x04u)  = 4u;
      U32(STAGE_CLIENT + 0x16Cu) = 0u;
      U32(STAGE_CLIENT + 0x170u) = 1u;
      U32(STAGE_CLIENT + 0x174u) = STAGE_UNIT1;
      if (k == 2) {
        uint32_t pInv = (uint32_t)(uintptr_t)fn_AllocInventory(NULL, (void *)(uintptr_t)STAGE_UNIT1);
        U32(STAGE_UNIT1 + 0x60u) = pInv;
        fn_SetCursorItem((void *)(uintptr_t)pInv, (void *)(uintptr_t)STAGE_UNIT0);
      }
    }
    c.eax = STAGE_GAME; c.esi = STAGE_UNIT0;
    ts[0] = STAGE_GAME; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC2EE70u, "ITEMS_RemoveItemFromAllPlayersAndFree_6FC2EE70_113c", k,
                 k == 0 ? "no_players_free_item" : k == 1 ? "player_without_item_free" : "removes_from_cursor_and_frees",
                 &c, ts, 2, 0u, 0);
  }

  /* [141] 0x6FC34370 ITEMS_RollRareSuffixId_6FC34370_113c (stack=[pItem, bIsPrefix], ret 8, u16; TS=(bIsPrefix, pItem)) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    uint32_t clsId = (k == 2) ? g_item_sword : g_item_ring;
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 4u, clsId, 53u, 0u, 5000u, 5000u, 14101u);
    stage_item_defaults(STAGE_UDATA0, 0u, 40u, 0x456789ABu + (uint32_t)k * 13u);
    uint32_t isPref = (k == 1) ? 1u : 0u;
    c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = isPref; c.calleePop = 8u;
    ts[0] = isPref; ts[1] = STAGE_UNIT0;
    run_and_emit(0x6FC34370u, "ITEMS_RollRareSuffixId_6FC34370_113c", k,
                 k == 0 ? "ring_suffix" : k == 1 ? "ring_prefix" : "sword_suffix",
                 &c, ts, 2, 0xFFFFu, 0);
  }

  /* [142] 0x6FC6C9E0 ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c (eax=nChance, edx=pUnit, ecx=pItem, stack=[pGame, nLoss], ret 8, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 4u, 1u, 1u, 5000u, 5000u, 14201u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    uint32_t itemCls = (k == 0) ? g_item_ring : g_item_sword;
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, itemCls, 54u, 1u, 5000u, 5000u, 14202u);
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x48, 20, 0); /* durability */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 0x49, 24, 0); /* max durability */
    uint32_t chance = (k == 1) ? 0u : 100u; /* k=1: roll >= 0 -> seed step only; k=2: 100% -> loses 3 durability + pkt 0x3E */
    c.eax = chance; c.edx = STAGE_UNIT0; c.ecx = STAGE_UNIT1;
    c.nargs = 2; c.args[0] = STAGE_GAME; c.args[1] = 3u; c.calleePop = 8u;
    ts[0] = chance; ts[1] = STAGE_UNIT0; ts[2] = STAGE_UNIT1; ts[3] = STAGE_GAME; ts[4] = 3;
    run_and_emit(0x6FC6C9E0u, "ITEMS_RollAndApplyWeaponDurabilityOrQuantityLoss_6FC6C9E0_113c", k,
                 k == 0 ? "non_weapon_ring_noop" : k == 1 ? "chance0_steps_seed_only" : "chance100_loses_3_durability",
                 &c, ts, 5, 0u, 0);
  }

  /* [143] 0x6FC2F8F0 ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c (ecx=nReqType, stack=[pGame, pSeed, nLvl, bSkipRarity], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_SCRATCH + 0x00u) = 0x11223345u + (uint32_t)k * 99u;
    U32(STAGE_SCRATCH + 0x04u) = 0x0000029Au;
    uint32_t reqType = (k == 0) ? 0x1Bu : (k == 1 ? 0x1Eu : 0x1Cu); /* 0x1B=bow, 0x1E=sword, 0x1C=axe */
    uint32_t lvl = (k == 0) ? 25u : (k == 1 ? 15u : 50u);
    c.ecx = reqType; c.nargs = 4;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_SCRATCH; c.args[2] = lvl; c.args[3] = 1u; c.calleePop = 16u;
    ts[0] = reqType; ts[1] = STAGE_GAME; ts[2] = STAGE_SCRATCH; ts[3] = lvl; ts[4] = 1;
    run_and_emit(0x6FC2F8F0u, "ITEMS_RollSpawnableWeaponId_6FC2F8F0_113c", k,
                 k == 0 ? "bow_lvl25" : k == 1 ? "sword_lvl15" : "axe_lvl50",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [144] 0x6FC2FA30 ITEMS_RollSpawnableArmorId_6FC2FA30_113c (ecx=nReqType, stack=[pGame, pSeed, nLvl, bSkipRarity], ret 0x10) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    U32(STAGE_SCRATCH + 0x00u) = 0x55667789u + (uint32_t)k * 71u;
    U32(STAGE_SCRATCH + 0x04u) = 0x0000029Au;
    uint32_t reqType = (k == 0) ? 0x25u : (k == 1 ? 0x03u : 0x0Fu); /* 0x25=helm, 0x03=armor, 0x0F=boots */
    uint32_t lvl = (k == 0) ? 25u : (k == 1 ? 12u : 45u);
    c.ecx = reqType; c.nargs = 4;
    c.args[0] = STAGE_GAME; c.args[1] = STAGE_SCRATCH; c.args[2] = lvl; c.args[3] = 1u; c.calleePop = 16u;
    ts[0] = reqType; ts[1] = STAGE_GAME; ts[2] = STAGE_SCRATCH; ts[3] = lvl; ts[4] = 1;
    run_and_emit(0x6FC2FA30u, "ITEMS_RollSpawnableArmorId_6FC2FA30_113c", k,
                 k == 0 ? "helm_lvl25" : k == 1 ? "armor_lvl12" : "boots_lvl45",
                 &c, ts, 5, 0xFFFFFFFFu, 0);
  }

  /* [145] 0x6FC583A0 PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c (ecx=pVictim, ebx=pGame, eax=pAttacker, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 14501u);
    U32(STAGE_UDATA0 + 0x9Cu) = STAGE_CLIENT;
    U8(STAGE_GAME + 0x6Du) = 1u; /* Nightmare: 5% exp penalty */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 12, 20, 0);     /* level 20 */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 13, 500000, 0); /* experience */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 14, 0, 0);      /* 0 inv gold (avoid spawning ground gold unit) */
    fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT0, 15, 0, 0);      /* 0 stash gold */
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 1 ? 0u : 1u), 1u, 2u, 1u, 5002u, 5002u, 14502u);
    uint32_t atkArg = (k == 0) ? 0u : STAGE_UNIT1; /* k=0: null atk -> exp penalty; k=1: player killer -> skips exp; k=2: monster killer -> exp penalty */
    if (k == 2) U8(STAGE_GAME + 0x6Du) = 2u;       /* Hell: 10% exp penalty */
    c.ecx = STAGE_UNIT0; c.ebx = STAGE_GAME; c.eax = atkArg;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME; ts[2] = atkArg;
    run_and_emit(0x6FC583A0u, "PLAYER_ApplyDeathGoldAndExpPenalties_6FC583A0_113c", k,
                 k == 0 ? "null_killer_nm_exp_loss" : k == 1 ? "pvp_killer_skips_exp_loss" : "monster_killer_hell_exp_loss",
                 &c, ts, 3, 0u, 0);
  }

  /* [146] 0x6FC955C0 MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c (ebx=pMon, stack=[pGame], ret 4, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5000u, 5000u, 14601u);
    stage_mon_txt(STAGE_UDATA0, 1u);
    if (k >= 1) {
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, (k == 1 ? 0x11u : 1u), 5001u, 5001u, 14602u);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 6, 0x20000, 0);
      fn_SetUnitStat((void *)(uintptr_t)STAGE_UNIT1, 7, 0x20000, 0);
      U32(STAGE_ROOM0 + 0x74u) = STAGE_UNIT1; /* pUnitFirst */
    }
    c.ebx = STAGE_UNIT0; c.nargs = 1; c.args[0] = STAGE_GAME; c.calleePop = 4u;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC955C0u, "MONSTER_ApplyRoomCrushDamageToNearbyPlayers_6FC955C0_113c", k,
                 k == 0 ? "empty_room_noop" : k == 1 ? "dead_player_skipped" : "crushes_adjacent_player",
                 &c, ts, 2, 0u, 0);
  }

  /* [147] 0x6FC43980 MONUMOD_RollRandomUniqueBossMod_6FC43980_113c (eax=pGame, stack=[pUnit, pExcludeFlags], ret 8) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 1u, 1u, 10u, 1u, 5000u, 5000u, 0x12345679u + (uint32_t)k * 97u);
    stage_mon_txt(STAGE_UDATA0, 1u);
    U8(STAGE_GAME + 0x6Du) = (k == 2) ? 2u : 0u;
    uint32_t gameArg = (k == 0) ? 0u : STAGE_GAME;
    c.eax = gameArg; c.nargs = 2; c.args[0] = STAGE_UNIT0; c.args[1] = STAGE_SCRATCH; c.calleePop = 8u;
    ts[0] = gameArg; ts[1] = STAGE_UNIT0; ts[2] = STAGE_SCRATCH;
    run_and_emit(0x6FC43980u, "MONUMOD_RollRandomUniqueBossMod_6FC43980_113c", k,
                 k == 0 ? "null_game_0" : k == 1 ? "normal_diff_boss_mod" : "hell_diff_boss_mod",
                 &c, ts, 3, 0xFFFFFFFFu, 0);
  }

  /* [148] 0x6FC58AB0 PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c (eax=pPlayer, esi=pGame, ret, void) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 14801u);
    U32(STAGE_UNIT0 + 0x64u) = 90u;
    U32(STAGE_UNIT0 + 0x68u) = 4u;
    U8(STAGE_UNIT0 + 0x6Cu)  = (k == 0) ? 0u : 1u;
    if (k >= 1) {
      uint32_t itemCls = (k == 1) ? g_item_ring : g_item_box;
      stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 4u, itemCls, 90u, 0u, 5000u, 5000u, 14802u);
      insert_server_unit(STAGE_GAME, STAGE_UNIT1);
    }
    c.eax = STAGE_UNIT0; c.esi = STAGE_GAME;
    ts[0] = STAGE_UNIT0; ts[1] = STAGE_GAME;
    run_and_emit(0x6FC58AB0u, "PLAYER_ClearActiveInteractOnDeath_6FC58AB0_113c", k,
                 k == 0 ? "inactive_noop" : k == 1 ? "non_box_item_skip" : "box_item_clears_interact",
                 &c, ts, 2, 0u, 0);
  }

  /* [149] 0x6FC70DB0 SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c (ecx=pTarget, edx=pCtx, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 2u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 0u, 2u, 1u, 1u, 5000u, 5000u, 14901u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, (k == 0 ? 0u : 1u), 1u, 2u, 1u, 5002u, 5002u, 14902u);
    if (k >= 1) stage_mon_txt(STAGE_UDATA1, 1u);
    stage_timer_queue();
    uint32_t pCtx = STAGE_SCRATCH;
    U32(pCtx + 0x00u) = STAGE_GAME;
    U32(pCtx + 0x04u) = STAGE_UNIT0;
    U8(pCtx + 0x10u)  = (k == 2) ? 1u : 0u; /* 0 = terror, 1 = confusion */
    U32(pCtx + 0x14u) = 0x55AAu;
    U32(pCtx + 0x18u) = (k == 2) ? 80u : 50u;
    c.ecx = STAGE_UNIT1; c.edx = pCtx;
    ts[0] = STAGE_UNIT1; ts[1] = pCtx;
    run_and_emit(0x6FC70DB0u, "SKILLS_ApplyTerrorOrConfusionCallback_6FC70DB0_113c", k,
                 k == 0 ? "player_target_rejected_0" : k == 1 ? "terror_sets_mode1_event0a" : "confusion_sets_mode2_event0a",
                 &c, ts, 2, 0xFFFFFFFFu, 0);
  }

  /* [150] 0x6FC8F4F0 D2Game_6FC8F4F0_113c (ecx=pObjInteractArg, ret) */
  for (int k = 0; k < 3; k++) {
    reset_case();
    c = make_call();
    stage_room(STAGE_ROOM0, STAGE_ROOMEX0, STAGE_LEVEL0, 1u);
    stage_unit_common(STAGE_UNIT0, STAGE_UDATA0, STAGE_PATH0, STAGE_ROOM0, 2u, 1u, 10u, (k == 1 ? 1u : 2u), 5000u, 5000u, 15001u);
    stage_unit_common(STAGE_UNIT1, STAGE_UDATA1, STAGE_PATH1, STAGE_ROOM0, 0u, 0u, 1u, 1u, 5000u, 5000u, 15002u);
    uint32_t pArg = STAGE_SCRATCH;
    U32(pArg + 0x00u) = STAGE_GAME;
    U32(pArg + 0x04u) = (k == 0) ? 0u : STAGE_UNIT0;
    U32(pArg + 0x08u) = STAGE_UNIT1;
    c.ecx = pArg;
    ts[0] = pArg;
    run_and_emit(0x6FC8F4F0u, "D2Game_6FC8F4F0_113c", k,
                 k == 0 ? "null_obj_0" : k == 1 ? "mode1_returns_0" : "mode2_dispatches_6fc8dfc0",
                 &c, ts, 1, 0xFFFFFFFFu, 0);
  }
}

int main(int argc, char **argv) {
  const char *imgPath = (argc > 1) ? argv[1] : "d2game-datatbls-113c.img";
  const char *outPath = (argc > 2) ? argv[2] : "k6-w8-d2game-vectors.ndjson";

  SetErrorMode(SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX | SEM_NOOPENFILEERRORBOX);
  AddVectoredExceptionHandler(1, k6_veh);

  void *pTbls  = VirtualAlloc((void *)DATATBLS_BASE, DATATBLS_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pStage = VirtualAlloc((void *)STAGE_BASE, STAGE_TOTAL_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  void *pHeap  = VirtualAlloc((void *)HEAP_BASE, HEAP_SIZE, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if ((uintptr_t)pTbls != DATATBLS_BASE || (uintptr_t)pStage != STAGE_BASE || (uintptr_t)pHeap != HEAP_BASE) {
    fprintf(stderr, "[k6-w8] VirtualAlloc failed (%p %p %p)\n", pTbls, pStage, pHeap);
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
    fprintf(stderr, "[k6-w8] LoadLibraryA failed (%p %p %p %p %p %p %p)\n",
            (void *)hStorm, (void *)g_hFog, (void *)hLang, (void *)hCmp,
            (void *)g_hCom, (void *)hNet, (void *)g_hGame);
    fflush(stderr);
    return 2;
  }

  g_com_rebase  = (uintptr_t)g_hCom - D2COM_PREF_BASE;
  g_game_rebase = (uintptr_t)g_hGame - D2GAME_PREF_BASE;
  if (g_com_rebase != 0) {
    fprintf(stderr, "[k6-w8] unexpected D2Common rebase: %p\n", (void *)g_hCom);
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
    fprintf(stderr, "[k6-w8] missing D2Common export\n");
    return 4;
  }

  discover_table_ids();

  g_out_fp = fopen(outPath, "wb");
  if (!g_out_fp) {
    fprintf(stderr, "[k6-w8] failed to open %s for writing\n", outPath);
    return 5;
  }

  emit_batch_1_to_50();
  emit_batch_51_to_96();
  emit_batch_97_to_150();

  fclose(g_out_fp);
  fprintf(stderr, "[k6-w8] emitted %u vectors\n", g_total_emitted);
  fflush(stderr);
  TerminateProcess(GetCurrentProcess(), 0);
  return 0;
}
