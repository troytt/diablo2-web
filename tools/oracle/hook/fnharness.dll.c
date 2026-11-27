/*
 * fnharness.dll — function-level oracle for original Diablo II 1.13c.
 *
 * Reuses the d2oracle frame-hook technique (GAME_UpdateGameFrame call sites
 * D2Game 0x6FC4E2DB / 0x6FC72712) to get control on the game thread once a
 * single-player game runs (all data tables loaded, a real player unit
 * exists). It then reads C:\oracle\fn-req.ndjson, calls ORIGINAL 1.13c
 * functions and writes one JSON array per request to
 * C:\oracle\out\fn-resp.ndjson, then touches C:\oracle\out\done.
 *
 * Request line: a JSON array of integers [op, a0, a1, ...]. Response line:
 * a JSON array of integers (one result, or several for range ops); a call
 * that faulted answers ["fault"].
 *
 * Every address below is a 1.13c preferred-base VA, rebased at runtime.
 * Calling conventions and evidence: kb/engine/oracle-fn-harness-113c.md.
 */
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#define ORACLE_DIR "C:\\oracle\\"

static FILE *g_log;
static HMODULE g_d2game, g_d2common;
static uintptr_t g_game_pref, g_common_pref;
static void *g_frame_fn;
static volatile LONG g_frames;

static void logf_(const char *fmt, ...) {
  if (!g_log) return;
  va_list ap;
  va_start(ap, fmt);
  fprintf(g_log, "[%lu] ", GetTickCount());
  vfprintf(g_log, fmt, ap);
  fputc('\n', g_log);
  fflush(g_log);
  va_end(ap);
}

static uintptr_t pref_base(HMODULE m) {
  IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)m;
  IMAGE_NT_HEADERS32 *nt = (IMAGE_NT_HEADERS32 *)((uint8_t *)m + dos->e_lfanew);
  return nt->OptionalHeader.ImageBase;
}
static uintptr_t G(uintptr_t va) { return va - g_game_pref + (uintptr_t)g_d2game; }
static uintptr_t C(uintptr_t va) { return va - g_common_pref + (uintptr_t)g_d2common; }

#define RD32(p, o) (*(uint32_t *)((uint8_t *)(p) + (o)))

/* ------------------------------------------------------------ safe call */
/*
 * Generic call with fault recovery. Arguments are staged in globals: up to
 * 8 stack arguments (pushed right-to-left) and the six general registers.
 * esp is restored from g_sc_esp after the call, so stdcall and cdecl
 * callees both work. A vectored exception handler redirects a fault that
 * happens inside the call to sc_fault, which unwinds to the saved esp.
 */
uint32_t g_sc_fn, g_sc_n, g_sc_args[8], g_sc_ret, g_sc_esp, g_sc_fault;
uint32_t g_sc_eax, g_sc_ecx, g_sc_edx, g_sc_ebx, g_sc_esi, g_sc_edi;
volatile LONG g_sc_active;
void sc_fault(void);

__attribute__((naked)) static void sc_call(void) {
  __asm__ volatile(
      "pushal\n\t"
      "mov %esp, _g_sc_esp\n\t"
      "mov _g_sc_n, %ecx\n\t"
      "1:\n\t"
      "test %ecx, %ecx\n\t"
      "jz 2f\n\t"
      "dec %ecx\n\t"
      "pushl _g_sc_args(,%ecx,4)\n\t"
      "jmp 1b\n\t"
      "2:\n\t"
      "mov _g_sc_eax, %eax\n\t"
      "mov _g_sc_ecx, %ecx\n\t"
      "mov _g_sc_edx, %edx\n\t"
      "mov _g_sc_ebx, %ebx\n\t"
      "mov _g_sc_esi, %esi\n\t"
      "mov _g_sc_edi, %edi\n\t"
      "call *_g_sc_fn\n\t"
      "mov %eax, _g_sc_ret\n\t"
      "mov _g_sc_esp, %esp\n\t"
      "popal\n\t"
      "ret\n\t"
      ".globl _sc_fault\n"
      "_sc_fault:\n\t"
      "mov _g_sc_esp, %esp\n\t"
      "movl $1, _g_sc_fault\n\t"
      "popal\n\t"
      "ret\n\t");
}

static LONG CALLBACK veh(EXCEPTION_POINTERS *ep) {
  DWORD code = ep->ExceptionRecord->ExceptionCode;
  if (!g_sc_active) return EXCEPTION_CONTINUE_SEARCH;
  if (code == EXCEPTION_ACCESS_VIOLATION || code == EXCEPTION_INT_DIVIDE_BY_ZERO ||
      code == EXCEPTION_INT_OVERFLOW || code == EXCEPTION_ILLEGAL_INSTRUCTION ||
      code == EXCEPTION_ARRAY_BOUNDS_EXCEEDED || code == EXCEPTION_STACK_OVERFLOW) {
    ep->ContextRecord->Eip = (DWORD)(uintptr_t)sc_fault;
    return EXCEPTION_CONTINUE_EXECUTION;
  }
  return EXCEPTION_CONTINUE_SEARCH;
}

/* Returns 0 on success (result in *out), 1 on fault. */
static int sc(uintptr_t fn, int n, const uint32_t *args, uint32_t *out) {
  g_sc_fn = (uint32_t)fn;
  g_sc_n = (uint32_t)n;
  for (int i = 0; i < n; i++) g_sc_args[i] = args[i];
  g_sc_fault = 0;
  g_sc_active = 1;
  sc_call();
  g_sc_active = 0;
  g_sc_eax = g_sc_ecx = g_sc_edx = g_sc_ebx = g_sc_esi = g_sc_edi = 0;
  *out = g_sc_ret;
  return (int)g_sc_fault;
}

/* ------------------------------------------------------------ functions */
/* D2Common (preferred base 0x6FD50000). */
#define VA_SKCALC 0x6FDA1070   /* #10147 SkillCalc callback (unit, code, skill, lvl) */
#define VA_SKFORM 0x6FDA1BF0   /* #10786 EvaluateSkillFormula (unit, calcIdx, skill, lvl) */
#define VA_ELMIN 0x6FDA0460    /* #10121 (unit, skill, lvl, bMastery) -> 256ths */
#define VA_ELMAX 0x6FDA0360    /* #11091 (unit, skill, lvl, bMastery) -> 256ths */
#define VA_ELEN 0x6FD9E900     /* #10510 (unit, skill, lvl, 0) -> frames */
#define VA_PHMIN 0x6FDA1FF0    /* #10297 SKILLS_GetMaxPhysDamage (unit, skill, lvl, bStrBonus) -> 256ths */
#define VA_PHMAX 0x6FDA2100    /* #10567 SKILLS_GetMinPhysDamage (unit, skill, lvl, bStrBonus) -> 256ths */
#define VA_TOHIT 0x6FD9EA50    /* #10653 (unit, skill, lvl) */
#define VA_RAWMANA 0x6FD9EA00  /* #10090 (skill, lvl) -> 256ths, no lvl guard */
#define VA_ADDSKILL 0x6FDA2660 /* #10008 SKILLS_AddSkill (unit, skill) -> pSkill */
#define VA_SETSTAT 0x6FD8A740  /* #10887 STATLIST_SetUnitStat (unit, stat, value, layer) */
#define VA_GETSTAT 0x6FD88B70  /* #10973 STATLIST_GetUnitStat accrued (unit, stat, layer) */
#define VA_GETBASE 0x6FD88C20  /* #10587 STATLIST_GetUnitBaseStat (unit, stat, layer) */
#define VA_CHKSTATE 0x6FD83CD0     /* #10494 STATES_CheckState (unit, stateId), ret 8 */
#define VA_CHKSTATEMASK 0x6FD83D10 /* #10866 STATES_CheckStateMask (unit, maskIdx), ret 8 -> 0x6FD83C20 */
#define VA_TOGGFXSTATE 0x6FD84450  /* #11039 STATES_ToggleGfxStateFlag (unit, stateId, bSet), ret 0xC */
#define VA_TOGSTATE_EXP 0x6FD84510 /* #10945 STATES_ToggleState (unit, stateId, bSet), ret 0xC */
#define VA_TOGSTATE 0x6FD88730     /* internal STATES_ToggleState: ebx=stateId, stack(unit, bSet), ret 8 */
#define VA_MULDIV 0x6FD511E0   /* internal: eax=b, edx=a, ecx=div -> a*b/div */
#define VA_DIMRET 0x6FD9DC30   /* #10115 (lvl, a, b) */
#define VA_BAND5 0x6FD9DDB0    /* internal: eax=lvl, ecx=&lev[5] */
#define VA_AR 0x6FD81EA0       /* #10621 UNITS_GetAttackRate (unit) */
#define VA_DEF 0x6FD82890      /* #10672 UNITS_GetDefense (unit) */
#define VA_BLOCK 0x6FD81D20    /* #10212 UNITS_GetBlockRate (unit, bExpansion) */
#define VA_DIMINISH 0x6FD823E0 /* internal: eax=rate index (0x6FDE4608 table), stack unit */
#define VA_EXPTHRESH 0x6FDAE810 /* #10399 GetExpThreshold (class, level) */
#define VA_GETX 0x6FD51050     /* internal UNITS_GetX(ecx=pUnit), ret */
#define VA_GETY 0x6FD51080     /* internal UNITS_GetY(ecx=pUnit), ret */
#define VA_ADDROOM 0x6FDB6800  /* #10531 UNITROOM_AddUnitToRoom(unit, room, unused), ret 0xC */
#define VA_REFUNIT 0x6FDB65C0  /* #10158 UNITROOM_RefreshUnit(unit), ret 4 */
#define VA_REMROOM 0x6FDB6700  /* #11016 UNITROOM_RemoveUnitFromRoom(unit), ret 4 */
/* D2Game (preferred base 0x6FC20000). */
#define GVA_MULDIV 0x6FC214D0   /* internal: eax=b, edx=a, ecx=div (same body as 0x6FD511E0) */
#define GVA_INITTQ 0x6FCAE630   /* internal EVENT_InitTimerQueue(ebx=pGame), ret */
#define GVA_FREETQ 0x6FCAE4D0   /* internal EVENT_FreeTimerQueue(edi=pGame), ret */
#define GVA_SETEVENT 0x6FCAEA80 /* ecx=pGame, edx=pUnit, stack(type,frame,fn,arg14,arg18), ret 0x14 */
#define GVA_SETPERS 0x6FCAE810  /* edi=pGame, eax=pUnit, ebx=type, stack(fn,arg14,arg18), ret 0xC */
#define GVA_NEXTEVFR 0x6FCAE490 /* eax=pUnit, esi=type -> earliest positive dwFrame */
#define GVA_REMUEV 0x6FCAE880   /* eax=pGame, stack(pUnit), ret 4 */
#define GVA_DELEVTYP 0x6FCAE8C0 /* ecx=pGame, eax=pUnit, ebx=type, stack(fn), ret 4 */
#define GVA_DELEVARG 0x6FCAE900 /* ecx=pGame, eax=pUnit, ebx=arg14Filter, stack(type), ret 4 */
#define GVA_UPDTIM 0x6FCAF070   /* internal EVENT_UpdateTimers(esi=pGame), ret */
#define GVA_MONCLR 0x6FD00750   /* internal MONSTER_ClearModeEvents(eax=pGame, ebx=pUnit), ret */
#define GVA_NEWUID 0x6FCFF9C0   /* edx=pGame, ecx=unitType -> new dwUnitId */
#define GVA_REMSUNIT 0x6FD002A0 /* edx=pGame, esi=pUnit, ret */
#define GVA_INSSUNIT 0x6FD00310 /* edx=pGame, esi=pUnit, ret */
#define GVA_GETSUNIT 0x6FD003A0 /* ecx=pGame, eax=unitType, edx=unitId -> pUnit */
#define GVA_IAT_SEND 0x6FD18B64 /* D2Game IAT slot for D2Net.#10002 SendPacket(q,cid,pkt,len) */
#define GVA_HIT 0x6FCFDE90      /* eax=attacker; stack defender, extraToHitPct, bMissile; ret 0xC */
#define GVA_RESIST 0x6FCFB3C0   /* ebx=descriptor (0x6FD22AB0 + i*0x2C), edi=context */
#define GVA_RESDESC 0x6FD22AB0
#define GVA_STEAL 0x6FCFBA40    /* eax=pDamage, edx=pGame, ecx=defender; stack attacker; ret 4 */
#define GVA_EXPLVL 0x6FCFAA40   /* eax=clvl, ecx=mlvl, edx=exp */
#define GVA_EXPRATIO 0x6FCFA9E0 /* eax=exp; stack clvl; ret 4 */
#define GVA_VITALLOC 0x6FD0AD10 /* eax=n, esi=player: vitality points */
#define GVA_ENEALLOC 0x6FD0AE20 /* eax=n, esi=player: energy points (same convention) */
#define GVA_LEVELUP 0x6FD0B090  /* esi=player; stack pGame; ret 4 */
#define GVA_DMGRES 0x6FCFC0B0   /* SUNITDMG_CalcResistAndAbsorb stdcall(pGame, attacker, defender, pDamage), ret 0x10 */
#define VA_ANIMRATE 0x6FD83110  /* #10819 UNITS_UpdateAnimRateAndVelocity stdcall(unit, file, line), ret 0xC */
#define VA_ANIMDATA 0x6FD91EF0  /* #10385 stdcall(cofName, &frames, &speed, &firstEventFrame), ret 0x10 */
#define VA_ALLOC_SL 0x6FD88100  /* #11013 STATLIST_AllocStatList(pool, flags, expire, uType, uGuid), ret 0x14 */
#define VA_SETSLSTAT 0x6FD8A7B0 /* #10188 STATLIST_SetStatIfListIsValid(pList, stat, val, layer), ret 0x10 */
#define VA_ALLOC_SLEX 0x6FD8AF00 /* #11166 STATLIST_AllocStatListEx(unit, bFlags, cb, game), ret 0x10 */
#define VA_MERGE_SL 0x6FD8A7D0  /* #10807 STATLIST_MergeStatLists(targetUnit, pList, bType), ret 0x0C */
#define VA_UNLINK_SL 0x6FD8A5F0 /* #11111 STATLIST_UnlinkSubList(unit, pList), ret 0x08 */
#define VA_FREE_SL 0x6FD8A9F0   /* internal STATLIST_FreeStatListEx(ecx=pList), ret */

static uint8_t *g_game, *g_player, *g_monster;

static int call_unit_skill(uintptr_t va, int n, uint32_t a1, uint32_t a2,
                           uint32_t a3, uint32_t *out) {
  uint32_t args[4] = {(uint32_t)(uintptr_t)g_player, a1, a2, a3};
  return sc(C(va), n, args, out);
}

/* Skill record field offsets that hold a calc index (evidence: SkillCalc
 * switch 0x6FDA1673..0x6FDA16EB, #10121 0x6FDA04BA, #10297 0x6FDA20BA,
 * toht 0x6FD9EA84, #10510 0x6FD9E991). */
static int calc_field_ok(uint32_t off) {
  static const uint32_t ok[] = {0x60,  0x64,  0x68,  0x6C,  0x70,  0x74,  0x78,
                                0x7C,  0xA4,  0xA8,  0xAC,  0xB0,  0xB4,  0xC0,
                                0x138, 0x13C, 0x140, 0x144, 0x170, 0x1A0, 0x1D8,
                                0x210, 0x224};
  for (unsigned i = 0; i < sizeof ok / sizeof ok[0]; i++)
    if (ok[i] == off) return 1;
  return 0;
}

static uint8_t *skill_rec(int32_t id) {
  /* sgptDataTables (0x6FDE9E1C) +0xB98 pSkillsTxt, +0xBA0 count, stride 0x23C */
  uint8_t *dt = *(uint8_t **)C(0x6FDE9E1C);
  if (!dt || id < 0 || id >= (int32_t)RD32(dt, 0xBA0)) return NULL;
  return (uint8_t *)(uintptr_t)RD32(dt, 0xB98) + id * 0x23C;
}

static uint8_t *native_skill(int32_t id) {
  /* unit+0xA8 pSkills; pSkills+0x04 first; skill+0x00 pTxt (word id),
   * +0x04 next, +0x28 hard level, +0x34 owner (-1 = native). */
  uint8_t *list = (uint8_t *)(uintptr_t)RD32(g_player, 0xA8);
  if (!list) return NULL;
  for (uint8_t *s = (uint8_t *)(uintptr_t)RD32(list, 4); s;
       s = (uint8_t *)(uintptr_t)RD32(s, 4)) {
    uint8_t *txt = (uint8_t *)(uintptr_t)RD32(s, 0);
    if (txt && *(int16_t *)txt == id && RD32(s, 0x34) == 0xFFFFFFFF) return s;
  }
  return NULL;
}


/* ---- unit-selected stat helpers (sel 0 = player, 1 = monster) ---- */
static int32_t g_uorig[2][1024];
static uint8_t g_uorig_set[2][1024];

static uint8_t *unit_sel(int32_t sel) { return sel == 1 ? g_monster : g_player; }

static int ustat(int op, uint8_t *u, int32_t stat, int32_t layer, uint32_t *out) {
  uint32_t args[3] = {(uint32_t)(uintptr_t)u, (uint32_t)stat, (uint32_t)layer};
  return sc(C(op == 0 ? VA_GETSTAT : VA_GETBASE), 3, args, out);
}
static int uset(uint8_t *u, int32_t stat, int32_t v) {
  uint32_t args[4] = {(uint32_t)(uintptr_t)u, (uint32_t)stat, (uint32_t)v, 0}, r;
  return sc(C(VA_SETSTAT), 4, args, &r);
}
static int usave_set(int32_t sel, int32_t stat, int32_t v) {
  uint8_t *u = unit_sel(sel);
  if (!u || stat < 0 || stat >= 1024) return 2;
  if (!g_uorig_set[sel][stat]) {
    uint32_t ov;
    if (ustat(1, u, stat, 0, &ov)) return 1;
    g_uorig[sel][stat] = (int32_t)ov;
    g_uorig_set[sel][stat] = 1;
  }
  return uset(u, stat, v);
}

/* Temporarily override the player's class id (D2UnitStrc+0x04, read by
 * CharStats lookups such as #10621 0x6FD81F42 and #10212 0x6FD81D9B). */
static uint32_t g_saved_class;
static void class_push(int32_t cls) {
  g_saved_class = RD32(g_player, 4);
  if (cls >= 0 && cls <= 6) RD32(g_player, 4) = (uint32_t)cls;
}
static void class_pop(void) { RD32(g_player, 4) = g_saved_class; }

static uint8_t g_fake_game[0x200];
static int32_t g_penalty;
static uint8_t g_dmg[0x100];
static uint8_t g_dmgres[0x100];
static int32_t g_anim_last[3];

/* First-touch originals so SETSKILL / SETSTAT can be undone exactly. */
static int32_t g_orig_hard[1024];
static uint8_t g_orig_hard_set[1024];
static int32_t g_orig_stat[1024];
static uint8_t g_orig_stat_set[1024];

/* ---- v2: D2Net.#10002 S2C packet capture ring & stateful snapshot scratch ---- */
typedef int(__stdcall *d2net_send_fn)(int nQueue, int nClientId, const uint8_t *pPacket, int nLen);
static d2net_send_fn g_orig_net_send;
static volatile LONG g_net_capture;

#define MAX_S2C_CAP 64
struct s2c_pkt {
  int queue;
  int client_id;
  int len;
  uint8_t bytes[0x208];
};
static struct s2c_pkt g_s2c_ring[MAX_S2C_CAP];
static int g_s2c_count;
static uint8_t g_snap_buf[512];

static int __stdcall hook_net_send(int nQueue, int nClientId, const uint8_t *pPacket, int nLen) {
  if (g_net_capture) {
    if (pPacket && nLen > 0 && nLen <= 0x204 && g_s2c_count < MAX_S2C_CAP) {
      struct s2c_pkt *p = &g_s2c_ring[g_s2c_count++];
      p->queue = nQueue;
      p->client_id = nClientId;
      p->len = nLen;
      memcpy(p->bytes, pPacket, (size_t)nLen);
    }
    return nLen;
  }
  return g_orig_net_send ? g_orig_net_send(nQueue, nClientId, pPacket, nLen) : 0;
}

static int install_net_hook(void) {
  uintptr_t *iat = (uintptr_t *)G(GVA_IAT_SEND);
  DWORD old;
  if (!VirtualProtect(iat, sizeof(uintptr_t), PAGE_EXECUTE_READWRITE, &old)) return 0;
  g_orig_net_send = (d2net_send_fn)(*iat);
  *iat = (uintptr_t)hook_net_send;
  VirtualProtect(iat, sizeof(uintptr_t), old, &old);
  return 1;
}

static uint32_t *unit_state_flags(uint8_t *u) {
  if (!u) return NULL;
  uint8_t *lex = (uint8_t *)(uintptr_t)RD32(u, 0x5C);
  if (!lex || !(RD32(lex, 0x10) & 0x80000000u)) return NULL;
  return (uint32_t *)(uintptr_t)RD32(lex, 0x58);
}

static uint8_t g_orig_state_saved[2][256];
static uint32_t g_orig_state_act[2][256];
static uint32_t g_orig_state_drt[2][256];
static uint32_t g_orig_uflags2[2];
static uint8_t g_orig_uflags2_saved[2];

/* Evaluate one non-range op. Returns 0 ok, 1 fault, 2 bad request. */
static int eval_op(int32_t op, const int32_t *a, int na, int32_t *res) {
  uint32_t r = 0;
  int f = 0;
#define NEED(k) \
  if (na < (k)) return 2
  switch (op) {
    case 0: /* echo */
      NEED(1);
      *res = a[0];
      return 0;
    case 1: /* SKCALC skill lvl code */
      NEED(3);
      if (a[2] < 0 || a[2] > 72) return 2;
      f = call_unit_skill(VA_SKCALC, 4, (uint32_t)a[2], (uint32_t)a[0], (uint32_t)a[1], &r);
      break;
    case 2: { /* SKFORM skill lvl fieldOffset */
      NEED(3);
      uint8_t *rec = skill_rec(a[0]);
      if (!rec || !calc_field_ok((uint32_t)a[2])) return 2;
      f = call_unit_skill(VA_SKFORM, 4, RD32(rec, a[2]), (uint32_t)a[0], (uint32_t)a[1], &r);
      break;
    }
    case 3: /* ELMIN skill lvl mastery */
      NEED(3);
      f = call_unit_skill(VA_ELMIN, 4, (uint32_t)a[0], (uint32_t)a[1], (uint32_t)a[2], &r);
      break;
    case 4:
      NEED(3);
      f = call_unit_skill(VA_ELMAX, 4, (uint32_t)a[0], (uint32_t)a[1], (uint32_t)a[2], &r);
      break;
    case 5:
      NEED(2);
      f = call_unit_skill(VA_ELEN, 4, (uint32_t)a[0], (uint32_t)a[1], 0, &r);
      break;
    case 6:
      NEED(3);
      f = call_unit_skill(VA_PHMIN, 4, (uint32_t)a[0], (uint32_t)a[1], (uint32_t)a[2], &r);
      break;
    case 7:
      NEED(3);
      f = call_unit_skill(VA_PHMAX, 4, (uint32_t)a[0], (uint32_t)a[1], (uint32_t)a[2], &r);
      break;
    case 8:
      NEED(2);
      f = call_unit_skill(VA_TOHIT, 3, (uint32_t)a[0], (uint32_t)a[1], 0, &r);
      break;
    case 9: {
      NEED(2);
      uint32_t args[2] = {(uint32_t)a[0], (uint32_t)a[1]};
      f = sc(C(VA_RAWMANA), 2, args, &r);
      break;
    }
    case 10: { /* SETSKILL skill hardLvl -> previous hard level (-1 = added) */
      NEED(2);
      if (!skill_rec(a[0])) return 2;
      uint8_t *s = native_skill(a[0]);
      int32_t prev = -1;
      if (s) {
        prev = (int32_t)RD32(s, 0x28);
      } else {
        uint32_t args[2] = {(uint32_t)(uintptr_t)g_player, (uint32_t)a[0]};
        f = sc(C(VA_ADDSKILL), 2, args, &r);
        if (f) break;
        s = native_skill(a[0]);
        if (!s) return 2;
      }
      if (a[0] < 1024 && !g_orig_hard_set[a[0]]) {
        g_orig_hard_set[a[0]] = 1;
        g_orig_hard[a[0]] = prev < 0 ? 0 : prev;
      }
      RD32(s, 0x28) = (uint32_t)a[1];
      r = (uint32_t)prev;
      break;
    }
    case 14: { /* RESTORESKILL skill -> hard level before the first SETSKILL (0 if added) */
      NEED(1);
      if (a[0] < 0 || a[0] >= 1024 || !g_orig_hard_set[a[0]]) return 2;
      uint8_t *s = native_skill(a[0]);
      if (!s) return 2;
      RD32(s, 0x28) = (uint32_t)g_orig_hard[a[0]];
      r = (uint32_t)g_orig_hard[a[0]];
      break;
    }
    case 15: { /* RESTORESTAT stat -> base value (layer 0) before the first SETSTAT */
      NEED(1);
      if (a[0] < 0 || a[0] >= 1024 || !g_orig_stat_set[a[0]]) return 2;
      uint32_t args[4] = {(uint32_t)(uintptr_t)g_player, (uint32_t)a[0],
                          (uint32_t)g_orig_stat[a[0]], 0};
      f = sc(C(VA_SETSTAT), 4, args, &r);
      r = (uint32_t)g_orig_stat[a[0]];
      break;
    }
    case 11: { /* SETSTAT stat value layer (player) */
      NEED(3);
      if (a[0] >= 0 && a[0] < 1024 && a[2] == 0 && !g_orig_stat_set[a[0]]) {
        uint32_t ga[3] = {(uint32_t)(uintptr_t)g_player, (uint32_t)a[0], 0};
        uint32_t ov = 0;
        if (sc(C(VA_GETBASE), 3, ga, &ov)) return 1;
        g_orig_stat_set[a[0]] = 1;
        g_orig_stat[a[0]] = (int32_t)ov;
      }
      uint32_t args[4] = {(uint32_t)(uintptr_t)g_player, (uint32_t)a[0], (uint32_t)a[1],
                          (uint32_t)a[2]};
      f = sc(C(VA_SETSTAT), 4, args, &r);
      r = 0;
      break;
    }
    case 12:
    case 13: { /* GETSTAT / GETBASE stat layer (player) */
      NEED(2);
      uint32_t args[3] = {(uint32_t)(uintptr_t)g_player, (uint32_t)a[0], (uint32_t)a[1]};
      f = sc(C(op == 12 ? VA_GETSTAT : VA_GETBASE), 3, args, &r);
      break;
    }
    case 20: /* MULDIV a b c  ->  a*b/c  (edx=a, eax=b, ecx=c) */
      NEED(3);
      g_sc_edx = (uint32_t)a[0];
      g_sc_eax = (uint32_t)a[1];
      g_sc_ecx = (uint32_t)a[2];
      f = sc(C(VA_MULDIV), 0, NULL, &r);
      break;
    case 21: { /* DIMRET lvl a b */
      NEED(3);
      uint32_t args[3] = {(uint32_t)a[0], (uint32_t)a[1], (uint32_t)a[2]};
      f = sc(C(VA_DIMRET), 3, args, &r);
      break;
    }
    case 22: { /* BAND5 lvl l1 l2 l3 l4 l5 */
      NEED(6);
      static int32_t lev[5];
      for (int i = 0; i < 5; i++) lev[i] = a[1 + i];
      g_sc_eax = (uint32_t)a[0];
      g_sc_ecx = (uint32_t)(uintptr_t)lev;
      f = sc(C(VA_BAND5), 0, NULL, &r);
      break;
    }
    case 30: { /* AR (player) */
      uint32_t args[1] = {(uint32_t)(uintptr_t)g_player};
      f = sc(C(VA_AR), 1, args, &r);
      break;
    }
    case 31: {
      uint32_t args[1] = {(uint32_t)(uintptr_t)g_player};
      f = sc(C(VA_DEF), 1, args, &r);
      break;
    }
    case 32: {
      NEED(1);
      uint32_t args[2] = {(uint32_t)(uintptr_t)g_player, (uint32_t)a[0]};
      f = sc(C(VA_BLOCK), 2, args, &r);
      break;
    }
    case 40: /* USETSTAT sel stat value (base, layer 0; first touch saved) */
      NEED(3);
      f = usave_set(a[0], a[1], a[2]);
      if (f == 2) return 2;
      r = 0;
      break;
    case 41: { /* URESTORE sel stat */
      NEED(2);
      if (a[0] < 0 || a[0] > 1 || a[1] < 0 || a[1] >= 1024 || !g_uorig_set[a[0]][a[1]]) return 2;
      f = uset(unit_sel(a[0]), a[1], g_uorig[a[0]][a[1]]);
      r = (uint32_t)g_uorig[a[0]][a[1]];
      break;
    }
    case 42: /* UGETSTAT sel stat layer (accrued) */
      NEED(3);
      if (!unit_sel(a[0])) return 2;
      f = ustat(0, unit_sel(a[0]), a[1], a[2], &r);
      break;
    case 43: { /* AR classOverride: #10621(player) */
      NEED(1);
      uint32_t args[1] = {(uint32_t)(uintptr_t)g_player};
      class_push(a[0]);
      f = sc(C(VA_AR), 1, args, &r);
      class_pop();
      break;
    }
    case 44: { /* DEF sel: #10672(unit) */
      NEED(1);
      if (!unit_sel(a[0])) return 2;
      uint32_t args[1] = {(uint32_t)(uintptr_t)unit_sel(a[0])};
      f = sc(C(VA_DEF), 1, args, &r);
      break;
    }
    case 45: { /* BLOCK bExpansion classOverride: #10212(player, bExp) */
      NEED(2);
      uint32_t args[2] = {(uint32_t)(uintptr_t)g_player, (uint32_t)a[0]};
      class_push(a[1]);
      f = sc(C(VA_BLOCK), 2, args, &r);
      class_pop();
      break;
    }
    case 46: { /* HIT extraPct bMissile: hit chance of player vs monster, 0..100.
                * Roll = (lo*0x6AC690C5 + hi) mod 2^32 mod 100 (0x6FCFE011..0x6FCFE031);
                * seeding {lo=0, hi=r} forces roll r, hit iff r < chance. */
      NEED(2);
      if (!g_monster) return 2;
      uint32_t slo = RD32(g_player, 0x20), shi = RD32(g_player, 0x24);
      int lo = 0, hi = 100; /* smallest r that misses; 100 = always hits */
      while (lo < hi && !f) {
        int mid = (lo + hi) / 2;
        uint32_t args[3] = {(uint32_t)(uintptr_t)g_monster, (uint32_t)a[0], (uint32_t)a[1]}, hit;
        RD32(g_player, 0x20) = 0;
        RD32(g_player, 0x24) = (uint32_t)mid;
        g_sc_eax = (uint32_t)(uintptr_t)g_player;
        f = sc(G(GVA_HIT), 3, args, &hit);
        if (hit) lo = mid + 1; else hi = mid;
      }
      RD32(g_player, 0x20) = slo;
      RD32(g_player, 0x24) = shi;
      r = (uint32_t)lo;
      break;
    }
    case 47: { /* RESIST row defSel penalty expansion difficulty */
      NEED(5);
      if (a[0] < 0 || a[0] > 11 || !g_monster) return 2;
      uint8_t *def = unit_sel(a[1]), *atk = unit_sel(a[1] ? 0 : 1);
      static uint32_t ctx[6];
      memset(g_fake_game, 0, sizeof g_fake_game);
      RD32(g_fake_game, 0x70) = (uint32_t)a[3];
      g_fake_game[0x6D] = (uint8_t)a[4];
      g_penalty = a[2];
      ctx[0] = (uint32_t)(uintptr_t)g_fake_game;
      ctx[1] = (uint32_t)(uintptr_t)&g_penalty;
      ctx[2] = (uint32_t)(uintptr_t)atk;
      ctx[3] = (uint32_t)(uintptr_t)def;
      ctx[4] = a[1] ? 0 : 1; /* attacker is the monster when the player defends */
      ctx[5] = a[1] ? 1 : 0;
      g_sc_ebx = (uint32_t)G(GVA_RESDESC + a[0] * 0x2C);
      g_sc_edi = (uint32_t)(uintptr_t)ctx;
      f = sc(G(GVA_RESIST), 0, NULL, &r);
      break;
    }
    case 48:
    case 49: { /* STEAL phys256 lifePct manaPct difficulty -> life (48) / mana (49) gained, 256ths */
      NEED(4);
      if (!g_monster || a[3] < 0 || a[3] > 2) return 2;
      static const int32_t ids[4] = {6, 7, 8, 9};
      uint32_t sv[4];
      for (int i = 0; i < 4; i++)
        if (ustat(1, g_player, ids[i], 0, &sv[i])) return 1;
      uset(g_player, 7, 0x3FFFFF00);
      uset(g_player, 9, 0x3FFFFF00);
      uset(g_player, 6, 256);
      uset(g_player, 8, 256);
      memset(g_dmg, 0, sizeof g_dmg);
      RD32(g_dmg, 0x08) = (uint32_t)a[0];
      RD32(g_dmg, 0x38) = (uint32_t)a[1];
      RD32(g_dmg, 0x3C) = (uint32_t)a[2];
      uint8_t sdiff = g_game[0x6D];
      g_game[0x6D] = (uint8_t)a[3];
      uint32_t args[1] = {(uint32_t)(uintptr_t)g_player}, ign;
      g_sc_eax = (uint32_t)(uintptr_t)g_dmg;
      g_sc_edx = (uint32_t)(uintptr_t)g_game;
      g_sc_ecx = (uint32_t)(uintptr_t)g_monster;
      f = sc(G(GVA_STEAL), 1, args, &ign);
      g_game[0x6D] = sdiff;
      uint32_t now = 0;
      if (!f) f = ustat(1, g_player, op == 48 ? 6 : 8, 0, &now);
      r = now - 256;
      for (int i = 0; i < 4; i++) uset(g_player, ids[i], (int32_t)sv[i]);
      break;
    }
    case 50: { /* MONDRAIN difficulty: MonStats Drain byte, [[monster+0x14]] + 0xA0 + diff (0x6FCFBA75..0x6FCFBA8E) */
      NEED(1);
      if (!g_monster || a[0] < 0 || a[0] > 2) return 2;
      uint8_t *md = (uint8_t *)(uintptr_t)RD32(g_monster, 0x14);
      uint8_t *ms = md ? (uint8_t *)(uintptr_t)RD32(md, 0) : NULL;
      if (!ms) return 2;
      r = ms[0xA0 + a[0]];
      break;
    }
    case 51: /* GMULDIV a b c (D2Game copy) */
      NEED(3);
      g_sc_edx = (uint32_t)a[0];
      g_sc_eax = (uint32_t)a[1];
      g_sc_ecx = (uint32_t)a[2];
      f = sc(G(GVA_MULDIV), 0, NULL, &r);
      break;
    case 52: { /* DIMINISH idx (stat set beforehand on the player) */
      NEED(1);
      if (a[0] < 0 || a[0] > 4) return 2;
      uint32_t args[1] = {(uint32_t)(uintptr_t)g_player};
      g_sc_eax = (uint32_t)a[0];
      f = sc(C(VA_DIMINISH), 1, args, &r);
      break;
    }
    case 53: /* EXPLVL clvl mlvl exp */
      NEED(3);
      g_sc_eax = (uint32_t)a[0];
      g_sc_ecx = (uint32_t)a[1];
      g_sc_edx = (uint32_t)a[2];
      f = sc(G(GVA_EXPLVL), 0, NULL, &r);
      break;
    case 54: { /* EXPRATIO exp clvl */
      NEED(2);
      uint32_t args[1] = {(uint32_t)a[1]};
      g_sc_eax = (uint32_t)a[0];
      f = sc(G(GVA_EXPRATIO), 1, args, &r);
      break;
    }
    case 55:
    case 56: { /* VITALLOC / ENEALLOC n class which -> delta of a vital (256ths)
                * which: vit 0 maxhp(7) 1 maxstamina(11); ene 0 maxmana(9) */
      NEED(3);
      static const int32_t ids[8] = {1, 3, 4, 6, 7, 8, 9, 10};
      static const int32_t ids2[1] = {11};
      uint32_t sv[9];
      for (int i = 0; i < 8; i++)
        if (ustat(1, g_player, ids[i], 0, &sv[i])) return 1;
      if (ustat(1, g_player, ids2[0], 0, &sv[8])) return 1;
      int32_t tgt = op == 55 ? (a[2] ? 11 : 7) : 9;
      uint32_t before = 0, after = 0;
      ustat(1, g_player, tgt, 0, &before);
      uset(g_player, 4, a[0] > 0 ? a[0] : 0);
      class_push(a[1]);
      g_sc_eax = (uint32_t)a[0];
      g_sc_esi = (uint32_t)(uintptr_t)g_player;
      uint32_t ign;
      f = sc(G(op == 55 ? GVA_VITALLOC : GVA_ENEALLOC), 0, NULL, &ign);
      class_pop();
      if (!f) f = ustat(1, g_player, tgt, 0, &after);
      r = after - before;
      for (int i = 0; i < 8; i++) uset(g_player, ids[i], (int32_t)sv[i]);
      uset(g_player, 11, (int32_t)sv[8]);
      break;
    }
    case 57: { /* LEVELUP levels class which -> delta (256ths) of maxhp(0) / maxmana(1) / maxstamina(2) / statpts(3) / newskills(4) */
      NEED(3);
      static const int32_t ids[11] = {4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 30};
      uint32_t sv[11];
      for (int i = 0; i < 11; i++)
        if (ustat(1, g_player, ids[i], 0, &sv[i])) return 1;
      static const int32_t tgts[5] = {7, 9, 11, 4, 5};
      if (a[2] < 0 || a[2] > 4) return 2;
      class_push(a[1]);
      uint32_t lvl0 = sv[8], thr = 0, before = 0, after = 0;
      /* #10399(class, L) = experience needed to reach level L+1 (D2Game 0x6FD0B0DC sets nextexp = #10399(class, newLvl)). */
      uint32_t targs[2] = {RD32(g_player, 4), lvl0 + (uint32_t)a[0] - 1};
      f = sc(C(VA_EXPTHRESH), 2, targs, &thr);
      if (!f) {
        ustat(1, g_player, tgts[a[2]], 0, &before);
        uset(g_player, 13, (int32_t)thr);
        uint32_t args[1] = {(uint32_t)(uintptr_t)g_game}, ign;
        g_sc_esi = (uint32_t)(uintptr_t)g_player;
        f = sc(G(GVA_LEVELUP), 1, args, &ign);
        if (!f) f = ustat(1, g_player, tgts[a[2]], 0, &after);
      }
      class_pop();
      r = after - before;
      for (int i = 0; i < 11; i++) uset(g_player, ids[i], (int32_t)sv[i]);
      break;
    }
    case 58: { /* DMGPIPE defSel diff phys fire ltng magic cold pois rate54 -> total (+0x4C) */
      NEED(9);
      if (!g_monster || a[1] < 0 || a[1] > 2) return 2;
      uint8_t *def = unit_sel(a[0]), *atk = unit_sel(a[0] ? 0 : 1);
      memset(g_dmgres, 0, sizeof g_dmgres);
      RD32(g_dmgres, 0x08) = (uint32_t)a[2];
      RD32(g_dmgres, 0x10) = (uint32_t)a[3];
      RD32(g_dmgres, 0x1C) = (uint32_t)a[4];
      RD32(g_dmgres, 0x20) = (uint32_t)a[5];
      RD32(g_dmgres, 0x24) = (uint32_t)a[6];
      RD32(g_dmgres, 0x28) = (uint32_t)a[7];
      RD32(g_dmgres, 0x54) = (uint32_t)a[8];
      uint8_t sdiff = g_game[0x6D];
      g_game[0x6D] = (uint8_t)a[1];
      uint32_t args[4] = {(uint32_t)(uintptr_t)g_game, (uint32_t)(uintptr_t)atk,
                          (uint32_t)(uintptr_t)def, (uint32_t)(uintptr_t)g_dmgres}, ign;
      f = sc(G(GVA_DMGRES), 4, args, &ign);
      g_game[0x6D] = sdiff;
      r = RD32(g_dmgres, 0x4C);
      break;
    }
    case 59: /* DMGFIELD off: dword of the last DMGPIPE damage struct */
      NEED(1);
      if (a[0] < 0 || a[0] > 0xFC || (a[0] & 3)) return 2;
      r = RD32(g_dmgres, a[0]);
      break;
    case 60: { /* ANIMSPEED mode class: #10819 on the player in `mode` (class override) -> unit+0x4C */
      NEED(2);
      uint32_t smode = RD32(g_player, 0x10), sv3c = RD32(g_player, 0x3C), sv50 = RD32(g_player, 0x50);
      uint16_t sv4c = *(uint16_t *)(g_player + 0x4C);
      class_push(a[1]);
      RD32(g_player, 0x10) = (uint32_t)a[0];
      uint32_t args[3] = {(uint32_t)(uintptr_t)g_player, 0, 0}, ign;
      f = sc(C(VA_ANIMRATE), 3, args, &ign);
      r = (uint32_t)(int32_t) * (int16_t *)(g_player + 0x4C);
      uint8_t *rec = (uint8_t *)(uintptr_t)RD32(g_player, 0x50);
      g_anim_last[0] = rec ? (int32_t)RD32(rec, 8) : -1;
      g_anim_last[1] = rec ? (int32_t)RD32(rec, 0xC) : -1;
      g_anim_last[2] = -1;
      if (rec) {
        uint32_t n = RD32(rec, 8), i;
        for (i = 0; i < n && i < 0x90 && !rec[0x10 + i]; i++) {}
        g_anim_last[2] = (int32_t)i;
      }
      class_pop();
      RD32(g_player, 0x10) = smode;
      sc(C(VA_ANIMRATE), 3, args, &ign); /* re-derive record/velocity for the real mode */
      RD32(g_player, 0x3C) = sv3c;
      RD32(g_player, 0x50) = sv50;
      *(uint16_t *)(g_player + 0x4C) = sv4c;
      break;
    }
    case 61: /* ANIMLAST which: 0 frames, 1 AnimData speed, 2 first event frame of the record used by op 60 */
      NEED(1);
      if (a[0] < 0 || a[0] > 2) return 2;
      r = (uint32_t)g_anim_last[a[0]];
      break;
    case 62: { /* ANIMDATA which c0..c6: #10385 on a 7-char COF name; which 0 found 1 frames 2 speed 3 event */
      NEED(8);
      static char name[16];
      static uint32_t fr, sp, ev;
      for (int i = 0; i < 7; i++) name[i] = (char)a[1 + i];
      name[7] = 0;
      uint32_t args[4] = {(uint32_t)(uintptr_t)name, (uint32_t)(uintptr_t)&fr, (uint32_t)(uintptr_t)&sp,
                          (uint32_t)(uintptr_t)&ev}, found;
      f = sc(C(VA_ANIMDATA), 4, args, &found);
      r = a[0] == 0 ? found : a[0] == 1 ? fr : a[0] == 2 ? sp : ev;
      break;
    }
    case 70: { /* UTOGSTATE sel stateId bSet -> 0 (calls D2Common 0x6FD88730) */
      NEED(3);
      if (a[0] < 0 || a[0] > 1 || a[1] < 0 || a[1] >= 185) return 2;
      uint8_t *u = unit_sel(a[0]);
      uint32_t *sf = unit_state_flags(u);
      if (!u || !sf) return 2;
      int w = a[1] >> 5;
      uint32_t mask = 1u << (a[1] & 31);
      if (!g_orig_state_saved[a[0]][a[1]]) {
        g_orig_state_saved[a[0]][a[1]] = 1;
        g_orig_state_act[a[0]][a[1]] = sf[w] & mask;
        g_orig_state_drt[a[0]][a[1]] = sf[w + 6] & mask;
      }
      if (!g_orig_uflags2_saved[a[0]]) {
        g_orig_uflags2_saved[a[0]] = 1;
        g_orig_uflags2[a[0]] = RD32(u, 0xC8);
      }
      uint32_t args[2] = {(uint32_t)(uintptr_t)u, a[2] ? 1u : 0u}, ign = 0;
      g_sc_ebx = (uint32_t)a[1];
      f = sc(C(VA_TOGSTATE), 2, args, &ign);
      r = 0;
      break;
    }
    case 71: { /* UCHKSTATE sel stateId -> #10494 STATES_CheckState */
      NEED(2);
      if (a[0] < 0 || a[0] > 1) return 2;
      uint8_t *u = unit_sel(a[0]);
      if (!u) return 2;
      uint32_t args[2] = {(uint32_t)(uintptr_t)u, (uint32_t)a[1]};
      f = sc(C(VA_CHKSTATE), 2, args, &r);
      break;
    }
    case 72: { /* UCHKGFXSTATE sel stateId -> dirty/gfx state bit (pStateFlags[(id>>5)+6] & mask) */
      NEED(2);
      if (a[0] < 0 || a[0] > 1 || a[1] < 0 || a[1] >= 185) return 2;
      uint32_t *sf = unit_state_flags(unit_sel(a[0]));
      if (!sf) return 2;
      r = sf[(a[1] >> 5) + 6] & (1u << (a[1] & 31));
      break;
    }
    case 73: { /* URESTORESTATE sel stateId -> restores active/dirty bits + dwFlags2 */
      NEED(2);
      if (a[0] < 0 || a[0] > 1 || a[1] < 0 || a[1] >= 185 || !g_orig_state_saved[a[0]][a[1]]) return 2;
      uint8_t *u = unit_sel(a[0]);
      uint32_t *sf = unit_state_flags(u);
      if (!u || !sf) return 2;
      int w = a[1] >> 5;
      uint32_t mask = 1u << (a[1] & 31);
      sf[w] = (sf[w] & ~mask) | g_orig_state_act[a[0]][a[1]];
      sf[w + 6] = (sf[w + 6] & ~mask) | g_orig_state_drt[a[0]][a[1]];
      if (g_orig_uflags2_saved[a[0]]) RD32(u, 0xC8) = g_orig_uflags2[a[0]];
      r = 0;
      break;
    }
    case 79: { /* UCLEARSTATEBITS sel stateId -> saves baseline then zeroes both active & dirty bits */
      NEED(2);
      if (a[0] < 0 || a[0] > 1 || a[1] < 0 || a[1] >= 185) return 2;
      uint8_t *u = unit_sel(a[0]);
      uint32_t *sf = unit_state_flags(u);
      if (!u || !sf) return 2;
      int w = a[1] >> 5;
      uint32_t mask = 1u << (a[1] & 31);
      if (!g_orig_state_saved[a[0]][a[1]]) {
        g_orig_state_act[a[0]][a[1]] = sf[w] & mask;
        g_orig_state_drt[a[0]][a[1]] = sf[w + 6] & mask;
        g_orig_state_saved[a[0]][a[1]] = 1;
      }
      if (!g_orig_uflags2_saved[a[0]]) {
        g_orig_uflags2[a[0]] = RD32(u, 0xC8);
        g_orig_uflags2_saved[a[0]] = 1;
      }
      sf[w] &= ~mask;
      sf[w + 6] &= ~mask;
      r = 0;
      break;
    }
    case 74: { /* UGETBASE sel stat layer -> #10587 STATLIST_GetUnitBaseStat */
      NEED(3);
      if (!unit_sel(a[0])) return 2;
      f = ustat(1, unit_sel(a[0]), a[1], a[2], &r);
      break;
    }
    case 75: { /* UGETSTAT_CLS classOverride stat layer -> player accrued stat under classOverride */
      NEED(3);
      class_push(a[0]);
      f = ustat(0, g_player, a[1], a[2], &r);
      class_pop();
      break;
    }
    case 76: { /* SUNIT_NEWID unitType preCounter -> calls D2Game 0x6FCFF9C0 and restores counter */
      NEED(2);
      if (a[0] < 0 || a[0] >= 6) return 2;
      uint32_t off = 0x90u + (uint32_t)a[0] * 4u;
      uint32_t saved = RD32(g_game, off);
      RD32(g_game, off) = (uint32_t)a[1];
      g_sc_edx = (uint32_t)(uintptr_t)g_game;
      g_sc_ecx = (uint32_t)a[0];
      f = sc(G(GVA_NEWUID), 0, NULL, &r);
      RD32(g_game, off) = saved;
      break;
    }
    case 77: { /* EVENT_PROBE sel evType targetFrame simGameFrame -> schedules via 0x6FCAEA80, reads 0x6FCAE490, deletes via 0x6FCAE8C0 */
      NEED(4);
      uint8_t *u = unit_sel(a[0]);
      if (!u || a[1] < 0 || a[1] >= 15) return 2;
      uint32_t saved_fr = RD32(g_game, 0xA8);
      uint32_t sentinel_fn = 0x77770001u;
      RD32(g_game, 0xA8) = (uint32_t)a[3];
      uint32_t sargs[5] = {(uint32_t)a[1], (uint32_t)a[2], sentinel_fn, 0x1111u, 0x2222u}, ign = 0;
      g_sc_ecx = (uint32_t)(uintptr_t)g_game;
      g_sc_edx = (uint32_t)(uintptr_t)u;
      f = sc(G(GVA_SETEVENT), 5, sargs, &ign);
      if (!f) {
        g_sc_eax = (uint32_t)(uintptr_t)u;
        g_sc_esi = (uint32_t)a[1];
        f = sc(G(GVA_NEXTEVFR), 0, NULL, &r);
      }
      uint32_t dargs[1] = {sentinel_fn};
      g_sc_ecx = (uint32_t)(uintptr_t)g_game;
      g_sc_eax = (uint32_t)(uintptr_t)u;
      g_sc_ebx = (uint32_t)a[1];
      sc(G(GVA_DELEVTYP), 1, dargs, &ign);
      RD32(g_game, 0xA8) = saved_fr;
      break;
    }
    case 78: { /* D2NET_SEND_PROBE queue clientId b0 b1 b2 b3 -> calls D2Game IAT 0x6FD18B64 under capture */
      NEED(6);
      uint8_t pkt[4] = {(uint8_t)a[2], (uint8_t)a[3], (uint8_t)a[4], (uint8_t)a[5]};
      g_s2c_count = 0;
      g_net_capture = 1;
      d2net_send_fn fn = *(d2net_send_fn *)G(GVA_IAT_SEND);
      int sent = fn(a[0], a[1], pkt, 4);
      g_net_capture = 0;
      r = ((uint32_t)g_s2c_count << 24) | ((uint32_t)(sent & 0xFF) << 16) |
          ((uint32_t)g_s2c_ring[0].bytes[0] << 8) | (uint32_t)g_s2c_ring[0].bytes[3];
      break;
    }
    default:
      return 2;
  }
#undef NEED
  *res = (int32_t)r;
  return f;
}

/* ------------------------------------------------------------- requests */
static FILE *g_req, *g_resp;
static long g_nreq, g_nfault, g_nbad;
static int g_done;
static char g_line[65536];

static uint32_t resolve_ptr_token(uint32_t v) {
  if (v == 0xDEAD0001u) return (uint32_t)(uintptr_t)g_game;
  if (v == 0xDEAD0002u) return (uint32_t)(uintptr_t)g_player;
  if (v == 0xDEAD0003u) return (uint32_t)(uintptr_t)g_monster;
  if (v == 0xDEAD0004u) return (uint32_t)(uintptr_t)g_snap_buf;
  return v;
}

static const char *json_find_key(const char *s, const char *key) {
  char pat[64];
  snprintf(pat, sizeof pat, "\"%s\"", key);
  const char *p = strstr(s, pat);
  if (!p) return NULL;
  p += strlen(pat);
  while (*p == ' ' || *p == '\t' || *p == ':') p++;
  return p;
}

static int json_get_i64(const char *s, const char *key, int64_t *out) {
  const char *p = json_find_key(s, key);
  if (!p) return 0;
  char *e;
  long long v = strtoll(p, &e, 0);
  if (e == p) return 0;
  *out = (int64_t)v;
  return 1;
}

static int json_get_flat_array(const char *s, const char *key, int32_t *out, int max) {
  const char *p = json_find_key(s, key);
  if (!p || *p != '[') return 0;
  int depth = 0, n = 0;
  while (*p) {
    if (*p == '[') {
      depth++;
      p++;
      continue;
    }
    if (*p == ']') {
      depth--;
      p++;
      if (depth <= 0) break;
      continue;
    }
    if (*p == ' ' || *p == ',' || *p == '\t') {
      p++;
      continue;
    }
    char *e;
    long long v = strtoll(p, &e, 0);
    if (e == p) break;
    if (n < max) out[n++] = (int32_t)v;
    p = e;
  }
  return n;
}

/*
 * JSON object op (`{"op":201,...}`): MULTILIST_STAT_CALL against real D2Common.dll.
 * Allocates isolated fake_player (`D2StatListExStrc`), optional child `D2StatListStrc`s
 * (`c1Stats`, `c2Stats`), optional equipped `fake_item` (`D2StatListExStrc` merged with `bType=0`),
 * optional `D2EnvironmentStrc` day/night overrides (`envTimeOfDay`, `envTicks`, `envTicksPerDeg`),
 * and optional temporary `ItemStatCostTxt` reverse-op patch (`patchOp`), then queries `qStats`,
 * `qItemStats`, and post-unlink `qStatsPost`, freeing and restoring all state cleanly.
 */
static void free_sl_ptr(uint32_t ptr) {
  if (!ptr) return;
  uint32_t r = 0;
  g_sc_ecx = ptr;
  sc(C(VA_FREE_SL), 0, NULL, &r);
}

static void handle_multilist_op(const char *line) {
  int64_t tmp = 0;
  int32_t u_type = (json_get_i64(line, "uType", &tmp) && tmp == 1) ? 1 : 0;
  int32_t p_cls = (json_get_i64(line, "pClass", &tmp) && tmp >= 0 && tmp <= 6) ? (int32_t)tmp : 0;

  uint32_t pool = RD32(g_player, 0x08);
  uint8_t *p_act = (uint8_t *)(uintptr_t)RD32(g_player, 0x1C);
  uint8_t *p_env = p_act ? (uint8_t *)(uintptr_t)RD32(p_act, 0x04) : NULL;

  /* Optional environment overrides for op 6 / op 7 (0x6FD87470 + 0x6FD96330) */
  uint32_t sv_env04 = p_env ? RD32(p_env, 0x04) : 0;
  uint32_t sv_env08 = p_env ? RD32(p_env, 0x08) : 0;
  uint32_t sv_env28 = p_env ? RD32(p_env, 0x28) : 0;
  if (p_env) {
    if (json_get_i64(line, "envTimeOfDay", &tmp)) RD32(p_env, 0x04) = (uint32_t)tmp;
    if (json_get_i64(line, "envTicks", &tmp)) RD32(p_env, 0x08) = (uint32_t)tmp;
    if (json_get_i64(line, "envTicksPerDeg", &tmp)) RD32(p_env, 0x28) = (uint32_t)tmp;
  }

  /* Optional temporary ItemStatCostTxt patch (`patchOp`: [targetStat, srcStat, bOp, bOpParam, wOpBase]) */
  int32_t pop[5];
  int has_pop = (json_get_flat_array(line, "patchOp", pop, 5) == 5) ? 1 : 0;
  uint8_t *isc_tgt = NULL, *isc_src = NULL;
  uint8_t sv_tgt[0x144], sv_src[0x144];
  if (has_pop) {
    uint8_t *dt = *(uint8_t **)C(0x6FDE9E1C);
    int32_t n_isc = dt ? (int32_t)RD32(dt, 0xBD4) : 0;
    uint8_t *p_isc = dt ? (uint8_t *)(uintptr_t)RD32(dt, 0xBCC) : NULL;
    if (p_isc && pop[0] >= 0 && pop[0] < n_isc && pop[1] >= 0 && pop[1] < n_isc && pop[0] != pop[1]) {
      isc_tgt = p_isc + pop[0] * 0x144;
      isc_src = p_isc + pop[1] * 0x144;
      memcpy(sv_tgt, isc_tgt, 0x144);
      memcpy(sv_src, isc_src, 0x144);
      /* Append reverse-op slot on targetStat (+0x52, +0xDE + k*6) */
      int k = 0;
      while (k < 15 && *(uint8_t *)(isc_tgt + 0xDE + k * 6 + 4) != 0) k++;
      *(uint16_t *)(isc_tgt + 0xDE + k * 6 + 0) = (uint16_t)(pop[4] & 0xFFFF);
      *(uint16_t *)(isc_tgt + 0xDE + k * 6 + 2) = (uint16_t)(pop[1] & 0xFFFF);
      *(uint8_t *)(isc_tgt + 0xDE + k * 6 + 4) = (uint8_t)(pop[2] & 0xFF);
      *(uint8_t *)(isc_tgt + 0xDE + k * 6 + 5) = (uint8_t)(pop[3] & 0xFF);
      isc_tgt[0x52] = 1;
      /* Set forward-op metadata on srcStat (+0x51..+0x5F) */
      isc_src[0x51] = 1;
      isc_src[0x53] = (pop[2] == 4 || pop[2] == 5) ? 1 : 0;
      isc_src[0x54] = (uint8_t)(pop[2] & 0xFF);
      isc_src[0x55] = (uint8_t)(pop[3] & 0xFF);
      *(uint16_t *)(isc_src + 0x56) = (uint16_t)(pop[4] & 0xFFFF);
      *(uint16_t *)(isc_src + 0x58) = (uint16_t)(pop[0] & 0xFFFF);
      *(uint16_t *)(isc_src + 0x5A) = 0xFFFF;
      *(uint16_t *)(isc_src + 0x5C) = 0xFFFF;
    } else {
      has_pop = 0;
    }
  }

  uint8_t fake_owner[0x100], fake_item[0x100];
  memset(fake_owner, 0, sizeof fake_owner);
  memset(fake_item, 0, sizeof fake_item);
  RD32(fake_owner, 0x00) = (uint32_t)u_type;
  RD32(fake_owner, 0x04) = (uint32_t)p_cls;
  RD32(fake_owner, 0x08) = pool;
  RD32(fake_owner, 0x0C) = 9001;
  RD32(fake_owner, 0x1C) = (uint32_t)(uintptr_t)p_act;

  int fault = 0;
  uint32_t p_owner_ex = 0, p_c1 = 0, p_c2 = 0, p_item_ex = 0, r = 0;
  {
    /* Note: STATLIST_AllocStatListEx (0x6FD8AF00) returns void (eax==0) and writes unit->pStatListEx (+0x5C) */
    uint32_t a[4] = {(uint32_t)(uintptr_t)fake_owner, 0, 0, (uint32_t)(uintptr_t)g_game};
    fault |= sc(C(VA_ALLOC_SLEX), 4, a, &r);
    p_owner_ex = RD32(fake_owner, 0x5C);
  }

  int32_t pstats[64];
  int np = json_get_flat_array(line, "pStats", pstats, 64) & ~1;
  for (int i = 0; i < np && !fault; i += 2) {
    uint32_t a[4] = {(uint32_t)(uintptr_t)fake_owner, (uint32_t)pstats[i], (uint32_t)pstats[i + 1], 0};
    fault |= sc(C(VA_SETSTAT), 4, a, &r);
  }

  int32_t c1stats[64];
  int nc1 = json_get_flat_array(line, "c1Stats", c1stats, 64) & ~1;
  if (nc1 > 0 && !fault) {
    uint32_t a[5] = {pool, 0, 0, (uint32_t)u_type, 9001};
    fault |= sc(C(VA_ALLOC_SL), 5, a, &p_c1);
    for (int i = 0; i < nc1 && !fault; i += 2) {
      uint32_t sa[4] = {p_c1, (uint32_t)c1stats[i], (uint32_t)c1stats[i + 1], 0};
      fault |= sc(C(VA_SETSLSTAT), 4, sa, &r);
    }
    if (!fault && p_c1) {
      uint32_t ma[3] = {(uint32_t)(uintptr_t)fake_owner, p_c1, 1};
      fault |= sc(C(VA_MERGE_SL), 3, ma, &r);
    }
  }

  int32_t c2stats[64];
  int nc2 = json_get_flat_array(line, "c2Stats", c2stats, 64) & ~1;
  if (nc2 > 0 && !fault) {
    uint32_t a[5] = {pool, 0, 0, (uint32_t)u_type, 9001};
    fault |= sc(C(VA_ALLOC_SL), 5, a, &p_c2);
    for (int i = 0; i < nc2 && !fault; i += 2) {
      uint32_t sa[4] = {p_c2, (uint32_t)c2stats[i], (uint32_t)c2stats[i + 1], 0};
      fault |= sc(C(VA_SETSLSTAT), 4, sa, &r);
    }
    if (!fault && p_c2) {
      uint32_t ma[3] = {(uint32_t)(uintptr_t)fake_owner, p_c2, 1};
      fault |= sc(C(VA_MERGE_SL), 3, ma, &r);
    }
  }

  int32_t istats[64];
  int ni = json_get_flat_array(line, "itemStats", istats, 64) & ~1;
  if (ni > 0 && !fault) {
    RD32(fake_item, 0x00) = 4; /* UNIT_ITEM */
    RD32(fake_item, 0x04) = 0;
    RD32(fake_item, 0x08) = pool;
    RD32(fake_item, 0x0C) = 9002;
    RD32(fake_item, 0x1C) = (uint32_t)(uintptr_t)p_act;
    uint32_t a[4] = {(uint32_t)(uintptr_t)fake_item, 0, 0, (uint32_t)(uintptr_t)g_game};
    fault |= sc(C(VA_ALLOC_SLEX), 4, a, &r);
    p_item_ex = RD32(fake_item, 0x5C);
    for (int i = 0; i < ni && !fault; i += 2) {
      uint32_t sa[4] = {(uint32_t)(uintptr_t)fake_item, (uint32_t)istats[i], (uint32_t)istats[i + 1], 0};
      fault |= sc(C(VA_SETSTAT), 4, sa, &r);
    }
    if (!fault && p_item_ex) {
      uint32_t ma[3] = {(uint32_t)(uintptr_t)fake_owner, p_item_ex, 0}; /* bType=0 -> item merge */
      fault |= sc(C(VA_MERGE_SL), 3, ma, &r);
    }
  }

  if (fault) g_nfault++;

  int32_t qstats[64], qistats[64];
  int nqs = json_get_flat_array(line, "qStats", qstats, 64);
  int nqis = json_get_flat_array(line, "qItemStats", qistats, 64);

  fprintf(g_resp, "{\"fault\":%d,\"qStats\":[", fault);
  for (int i = 0; i < nqs; i++) {
    uint32_t bv = 0, fv = 0;
    ustat(1, fake_owner, qstats[i], 0, &bv);
    ustat(0, fake_owner, qstats[i], 0, &fv);
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "[%ld,%ld,%ld]", (long)qstats[i], (long)(int32_t)bv, (long)(int32_t)fv);
  }
  fputs("],\"qItemStats\":[", g_resp);
  for (int i = 0; i < nqis; i++) {
    uint32_t bv = 0, fv = 0;
    if (p_item_ex) {
      ustat(1, fake_item, qistats[i], 0, &bv);
      ustat(0, fake_item, qistats[i], 0, &fv);
    }
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "[%ld,%ld,%ld]", (long)qistats[i], (long)(int32_t)bv, (long)(int32_t)fv);
  }
  fputc(']', g_resp);

  int64_t rmask = 0;
  json_get_i64(line, "removeMask", &rmask);
  int c1_unlinked = 0, c2_unlinked = 0, it_unlinked = 0;
  if (rmask != 0 && !fault) {
    if ((rmask & 1) && p_c1) {
      uint32_t ua[2] = {(uint32_t)(uintptr_t)fake_owner, p_c1};
      sc(C(VA_UNLINK_SL), 2, ua, &r);
      c1_unlinked = 1;
    }
    if ((rmask & 2) && p_c2) {
      uint32_t ua[2] = {(uint32_t)(uintptr_t)fake_owner, p_c2};
      sc(C(VA_UNLINK_SL), 2, ua, &r);
      c2_unlinked = 1;
    }
    if ((rmask & 4) && p_item_ex) {
      uint32_t ua[2] = {(uint32_t)(uintptr_t)fake_owner, p_item_ex};
      sc(C(VA_UNLINK_SL), 2, ua, &r);
      it_unlinked = 1;
    }
    fputs(",\"qStatsPost\":[", g_resp);
    for (int i = 0; i < nqs; i++) {
      uint32_t bv = 0, fv = 0;
      ustat(1, fake_owner, qstats[i], 0, &bv);
      ustat(0, fake_owner, qstats[i], 0, &fv);
      if (i > 0) fputc(',', g_resp);
      fprintf(g_resp, "[%ld,%ld,%ld]", (long)qstats[i], (long)(int32_t)bv, (long)(int32_t)fv);
    }
    fputc(']', g_resp);
  }
  fputs("}\n", g_resp);

  /* Clean up all allocated stat lists */
  if (p_item_ex && !it_unlinked) {
    uint32_t ua[2] = {(uint32_t)(uintptr_t)fake_owner, p_item_ex};
    sc(C(VA_UNLINK_SL), 2, ua, &r);
  }
  if (p_c2 && !c2_unlinked) {
    uint32_t ua[2] = {(uint32_t)(uintptr_t)fake_owner, p_c2};
    sc(C(VA_UNLINK_SL), 2, ua, &r);
  }
  if (p_c1 && !c1_unlinked) {
    uint32_t ua[2] = {(uint32_t)(uintptr_t)fake_owner, p_c1};
    sc(C(VA_UNLINK_SL), 2, ua, &r);
  }
  free_sl_ptr(p_item_ex);
  free_sl_ptr(p_c2);
  free_sl_ptr(p_c1);
  free_sl_ptr(p_owner_ex);

  if (has_pop && isc_tgt && isc_src) {
    memcpy(isc_tgt, sv_tgt, 0x144);
    memcpy(isc_src, sv_src, 0x144);
  }
  if (p_env) {
    RD32(p_env, 0x04) = sv_env04;
    RD32(p_env, 0x08) = sv_env08;
    RD32(p_env, 0x28) = sv_env28;
  }
}

/* --------------------------------------------------------------------------
 * Op 202 (`STATES_SEQ_CALL`): multi-step stateful D2Common STATES transitions.
 * Exercises 0x6FD88730 (STATES_ToggleState), 0x6FD83C20 (unit+0xC8 0x08 mask),
 * and #10494 0x6FD83CD0 (STATES_CheckState) across unit types 0..5, null
 * StatListEx, OOB state indices, and multi-state sequences.
 * -------------------------------------------------------------------------- */
static void handle_states_seq_op(const char *line) {
  int64_t tmp = 0;
  int32_t u_type = (json_get_i64(line, "uType", &tmp) && tmp >= 0 && tmp <= 5) ? (int32_t)tmp : 0;
  int32_t no_slex = (json_get_i64(line, "noStatList", &tmp) && tmp != 0) ? 1 : 0;
  uint32_t init_f2 = json_get_i64(line, "initFlags2", &tmp) ? (uint32_t)tmp : 0u;
  int32_t has_room = (json_get_i64(line, "hasRoom", &tmp) && tmp != 0) ? 1 : 0;
  uint32_t room_flags = json_get_i64(line, "roomFlags", &tmp) ? (uint32_t)tmp : 0u;

  uint32_t pool = RD32(g_player, 0x08);
  uint8_t fake_u[0x100];
  uint8_t fake_path[0x40];
  uint8_t fake_room[0x80];
  uint32_t act_flag = 0u;
  memset(fake_u, 0, sizeof fake_u);
  memset(fake_path, 0, sizeof fake_path);
  memset(fake_room, 0, sizeof fake_room);
  RD32(fake_u, 0x00) = (uint32_t)u_type;
  RD32(fake_u, 0x08) = pool;
  RD32(fake_u, 0x0C) = 9101u;
  RD32(fake_u, 0xC8) = init_f2;
  RD32(fake_u, 0x2C) = (uint32_t)(uintptr_t)fake_path;
  if (has_room) {
    RD32(fake_room, 0x2C) = (uint32_t)(uintptr_t)&act_flag;
    RD32(fake_room, 0x34) = room_flags;
    if (u_type == 2 || u_type == 4 || u_type == 5) {
      RD32(fake_path, 0x00) = (uint32_t)(uintptr_t)fake_room;
    } else {
      RD32(fake_path, 0x1C) = (uint32_t)(uintptr_t)fake_room;
    }
  }

  int fault = 0;
  uint32_t r = 0;
  if (!no_slex) {
    uint32_t a[4] = {(uint32_t)(uintptr_t)fake_u, 0, 0, (uint32_t)(uintptr_t)g_game};
    fault |= sc(C(VA_ALLOC_SLEX), 4, a, &r);
  }

  int32_t steps[192];
  int nraw = json_get_flat_array(line, "steps", steps, 192);
  int nsteps = nraw - (nraw % 3);

  uint32_t step_f2[64];
  int n_f2 = 0;
  int32_t checks[64];
  int n_chk = 0;

  for (int i = 0; i < nsteps && !fault; i += 3) {
    int32_t kind = steps[i];
    int32_t sid = steps[i + 1];
    int32_t arg = steps[i + 2];
    if (kind == 0) {
      /* 0x6FD88730 does not bounds-check stateId when pStatListEx != NULL;
       * when pStatListEx == NULL it returns immediately before indexing. */
      uint32_t has_ex = RD32(fake_u, 0x5C);
      if (!has_ex || (sid >= 0 && sid < 185)) {
        uint32_t ta[2] = {(uint32_t)(uintptr_t)fake_u, arg ? 1u : 0u};
        g_sc_ebx = (uint32_t)sid;
        fault |= sc(C(VA_TOGSTATE), 2, ta, &r);
      }
      if (n_f2 < 64) step_f2[n_f2++] = RD32(fake_u, 0xC8);
    } else if (kind == 1) {
      /* Call D2Common.#11039 (0x6FD84450 STATES_ToggleGfxStateFlag) directly */
      uint32_t ga[3] = {(uint32_t)(uintptr_t)fake_u, (uint32_t)sid, arg ? 1u : 0u};
      fault |= sc(C(VA_TOGGFXSTATE), 3, ga, &r);
    } else if (kind == 2) {
      uint32_t ca[2] = {(uint32_t)(uintptr_t)fake_u, (uint32_t)sid}, cv = 0;
      fault |= sc(C(VA_CHKSTATE), 2, ca, &cv);
      if (n_chk < 64) checks[n_chk++] = (int32_t)cv;
    } else if (kind == 3) {
      /* Call D2Common.#10945 (0x6FD84510 STATES_ToggleState + #10158 UNITROOM_RefreshUnit) directly */
      uint32_t ea[3] = {(uint32_t)(uintptr_t)fake_u, (uint32_t)sid, arg ? 1u : 0u};
      fault |= sc(C(VA_TOGSTATE_EXP), 3, ea, &r);
      if (n_f2 < 64) step_f2[n_f2++] = RD32(fake_u, 0xC8);
    } else if (kind == 4) {
      /* Call D2Common.#10866 (0x6FD83D10 STATES_CheckStateMask -> 0x6FD83C20) directly */
      uint32_t ma[2] = {(uint32_t)(uintptr_t)fake_u, (uint32_t)sid}, cv = 0;
      fault |= sc(C(VA_CHKSTATEMASK), 2, ma, &cv);
      if (n_chk < 64) checks[n_chk++] = (int32_t)cv;
    } else if (kind == 5) {
      /* Call D2Common.#10796 (0x6FDB63B0 UNITROOM_ClearUpdateQueue) directly */
      if (has_room) {
        uint32_t ra[1] = {(uint32_t)(uintptr_t)fake_room};
        fault |= sc(C(0x6FDB63B0u), 1, ra, &r);
      }
    }
  }

  if (fault) g_nfault++;

  uint32_t p_ex = RD32(fake_u, 0x5C);
  uint32_t *sf = unit_state_flags(fake_u);
  int room_updated = (has_room && RD32(fake_room, 0x1C) == (uint32_t)(uintptr_t)fake_u) ? 1 : 0;
  fprintf(g_resp,
          "{\"fault\":%d,\"hasStatList\":%d,\"unitFlags\":%lu,\"unitFlags2\":%lu,\"actFlag\":%lu,\"roomUpdated\":%d,\"stateFlags\":[",
          fault, p_ex ? 1 : 0, (unsigned long)RD32(fake_u, 0xC4), (unsigned long)RD32(fake_u, 0xC8),
          (unsigned long)act_flag, room_updated);
  for (int w = 0; w < 6; w++) {
    if (w > 0) fputc(',', g_resp);
    fprintf(g_resp, "%lu", (unsigned long)(sf ? sf[w] : 0u));
  }
  fputs("],\"gfxFlags\":[", g_resp);
  for (int w = 0; w < 6; w++) {
    if (w > 0) fputc(',', g_resp);
    fprintf(g_resp, "%lu", (unsigned long)(sf ? sf[w + 6] : 0u));
  }
  fputs("],\"stepFlags2\":[", g_resp);
  for (int i = 0; i < n_f2; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "%lu", (unsigned long)step_f2[i]);
  }
  fputs("],\"checks\":[", g_resp);
  for (int i = 0; i < n_chk; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "%ld", (long)checks[i]);
  }
  fputs("]}\n", g_resp);

  free_sl_ptr(p_ex);
}

/* --------------------------------------------------------------------------
 * Direct register-exact wrappers for D2Game/D2Common timer & SUNIT functions
 * (safe to invoke both inside sc() and re-entrantly from timer callbacks).
 * -------------------------------------------------------------------------- */
typedef void(__fastcall *fn_set_event_t)(void *game, void *unit, int32_t evType, uint32_t frame,
                                         void *pfn, uint32_t arg14, uint32_t arg18);
typedef uint32_t(__fastcall *fn_new_uid_t)(uint32_t uType, void *game);
typedef int32_t(__fastcall *fn_unit_xy_t)(void *unit);
typedef int32_t(__stdcall *fn_add_room_t)(void *unit, void *room, int32_t unused);
typedef void(__stdcall *fn_unit_room1_t)(void *unit);
typedef int32_t(__stdcall *fn_chk_state_t)(void *unit, int32_t stateId);

static void raw_init_tq(void *game) {
  uintptr_t fn = G(GVA_INITTQ);
  void *b = game;
  __asm__ volatile("call *%1" : "+b"(b) : "c"(fn) : "eax", "edx", "esi", "edi", "memory", "cc");
}

static void raw_free_tq(void *game) {
  uintptr_t fn = G(GVA_FREETQ);
  void *d = game;
  __asm__ volatile("call *%1" : "+D"(d) : "c"(fn) : "eax", "ebx", "edx", "esi", "memory", "cc");
}

static void raw_set_event(void *game, void *unit, int32_t evType, uint32_t frame, void *pfn,
                          uint32_t arg14, uint32_t arg18) {
  fn_set_event_t fn = (fn_set_event_t)G(GVA_SETEVENT);
  fn(game, unit, evType, frame, pfn, arg14, arg18);
}

static void raw_set_persist(void *game, void *unit, int32_t evType, void *pfn, uint32_t arg14,
                            uint32_t arg18) {
  uint32_t st[3] = {(uint32_t)(uintptr_t)pfn, arg14, arg18};
  uintptr_t fn = G(GVA_SETPERS);
  void *d_game = game;
  void *a_unit = unit;
  int32_t b_type = evType;
  uint32_t *c_st = st;
  __asm__ volatile("pushl 8(%3)\n\tpushl 4(%3)\n\tpushl 0(%3)\n\tcall *%4"
                   : "+D"(d_game), "+a"(a_unit), "+b"(b_type), "+c"(c_st), "+d"(fn)
                   :
                   : "esi", "memory", "cc");
}

static void raw_mon_clear(void *game, void *unit) {
  uintptr_t fn = G(GVA_MONCLR);
  void *a = game;
  void *b = unit;
  __asm__ volatile("call *%2" : "+a"(a), "+b"(b), "+c"(fn) : : "edx", "esi", "edi", "memory", "cc");
}

static void raw_del_by_type(void *game, void *unit, int32_t evType, void *pfn) {
  uintptr_t fn = G(GVA_DELEVTYP);
  void *c = game;
  void *a = unit;
  int32_t b = evType;
  void *d = pfn;
  __asm__ volatile("pushl %3\n\tcall *%4"
                   : "+c"(c), "+a"(a), "+b"(b), "+d"(d), "+S"(fn)
                   :
                   : "edi", "memory", "cc");
}

static void raw_del_by_arg14(void *game, void *unit, int32_t evType, uint32_t arg14Filter) {
  uintptr_t fn = G(GVA_DELEVARG);
  void *c = game;
  void *a = unit;
  uint32_t b = arg14Filter;
  int32_t d = evType;
  __asm__ volatile("pushl %3\n\tcall *%4"
                   : "+c"(c), "+a"(a), "+b"(b), "+d"(d), "+S"(fn)
                   :
                   : "edi", "memory", "cc");
}

static void raw_rem_unit_ev(void *game, void *unit) {
  uintptr_t fn = G(GVA_REMUEV);
  void *a = game;
  void *c = unit;
  __asm__ volatile("pushl %1\n\tcall *%2"
                   : "+a"(a), "+c"(c), "+d"(fn)
                   :
                   : "ebx", "esi", "edi", "memory", "cc");
}

static uint32_t raw_next_ev_fr(void *unit, int32_t evType) {
  uintptr_t fn = G(GVA_NEXTEVFR);
  uintptr_t a = (uintptr_t)unit;
  int32_t s = evType;
  __asm__ volatile("call *%2" : "+a"(a), "+S"(s), "+c"(fn) : : "ebx", "edx", "edi", "memory", "cc");
  return (uint32_t)a;
}

static void raw_upd_timers(void *game) {
  uintptr_t fn = G(GVA_UPDTIM);
  void *s = game;
  __asm__ volatile("call *%1" : "+S"(s), "+c"(fn) : : "eax", "ebx", "edx", "edi", "memory", "cc");
}

static void raw_tog_state(void *unit, int32_t sid, uint32_t bSet) {
  uintptr_t fn = C(VA_TOGSTATE);
  int32_t b = sid;
  void *c = unit;
  uint32_t d = bSet ? 1u : 0u;
  __asm__ volatile("pushl %3\n\tpushl %2\n\tcall *%0"
                   : "+a"(fn), "+b"(b), "+c"(c), "+d"(d)
                   :
                   : "esi", "edi", "memory", "cc");
}

static void raw_sunit_insert(void *game, void *unit) {
  uintptr_t fn = G(GVA_INSSUNIT);
  void *d = game;
  void *s = unit;
  __asm__ volatile("call *%2" : "+d"(d), "+S"(s), "+c"(fn) : : "eax", "ebx", "edi", "memory", "cc");
}

static void *raw_sunit_get(void *game, uint32_t uType, uint32_t uId) {
  uintptr_t fn = G(GVA_GETSUNIT);
  uintptr_t a = (uintptr_t)uType;
  void *c = game;
  uint32_t d = uId;
  __asm__ volatile("call *%3" : "+a"(a), "+c"(c), "+d"(d), "+S"(fn) : : "ebx", "edi", "memory", "cc");
  return (void *)a;
}

static void raw_sunit_remove(void *game, void *unit) {
  uintptr_t fn = G(GVA_REMSUNIT);
  void *d = game;
  void *s = unit;
  __asm__ volatile("call *%2" : "+d"(d), "+S"(s), "+c"(fn) : : "eax", "ebx", "edi", "memory", "cc");
}

/* --------------------------------------------------------------------------
 * Op 203 (`EVENT_TIMER_SEQ_CALL`): multi-operation stateful D2TimerStrc
 * execution, monster state 0x36 handler (0x6FD02240), 2-pass MONSTER_ClearModeEvents
 * (0x6FD00750), DeleteEventByType (0x6FCAE8C0), DeleteEventByArg14 (0x6FCAE900),
 * RemoveUnitEvents (0x6FCAE880), and multi-frame EVENT_UpdateTimers (0x6FCAF070)
 * callback firing & free-list order capture.
 * -------------------------------------------------------------------------- */
#define MAX_EV_FIRED 256
struct ev_fired_rec {
  uint32_t frame;
  int32_t ev_type;
  int32_t u_type;
  uint32_t u_id;
  int32_t arg14;
  int32_t arg18;
};

static uint8_t s_ev_game[0x1E00];
static uint8_t s_ev_units[8][0x100];
static struct ev_fired_rec s_ev_fired[MAX_EV_FIRED];
static int s_ev_nfired;
static int32_t s_ev_ops[256];
static int s_ev_nops;
static int32_t s_ev_nextf[64];
static int s_ev_nnextf;

static void __fastcall ev_seq_cb_a(uint8_t *game, uint8_t *unit, int32_t evType, uint32_t arg14,
                                   uint32_t arg18);
static void __fastcall ev_seq_cb_b(uint8_t *game, uint8_t *unit, int32_t evType, uint32_t arg14,
                                   uint32_t arg18);

static void ev_seq_cb_common(uint8_t *game, uint8_t *unit, int32_t evType, uint32_t arg14,
                             uint32_t arg18) {
  if (s_ev_nfired < MAX_EV_FIRED) {
    struct ev_fired_rec *f = &s_ev_fired[s_ev_nfired++];
    f->frame = RD32(game, 0xA8);
    f->ev_type = evType;
    f->u_type = unit ? (int32_t)RD32(unit, 0x00) : -1;
    f->u_id = unit ? RD32(unit, 0x0C) : 0u;
    f->arg14 = (int32_t)arg14;
    f->arg18 = (int32_t)arg18;
  }
  /* Optional re-entrant timer mutation encoded in arg18 (`0xA000 | (reCmd << 8) | reArg`) */
  if ((arg18 & 0xF000u) == 0xA000u) {
    uint32_t re_cmd = (arg18 >> 8) & 0x0Fu;
    uint32_t re_arg = arg18 & 0xFFu;
    if (re_cmd == 1 && unit) {
      raw_del_by_type(game, unit, (int32_t)(re_arg & 0x0Fu), (void *)ev_seq_cb_a);
    } else if (re_cmd == 2 && unit) {
      raw_del_by_arg14(game, unit, (int32_t)(re_arg & 0x0Fu), (re_arg & 0x80u) ? arg14 : 0u);
    } else if (re_cmd == 3 && unit) {
      raw_mon_clear(game, unit);
    } else if (re_cmd == 4 && unit) {
      raw_rem_unit_ev(game, unit);
    } else if (re_cmd == 5) {
      uint32_t delay = 1u + ((re_arg >> 4) & 0x07u);
      raw_set_event(game, unit, (int32_t)(re_arg & 0x0Fu), RD32(game, 0xA8) + delay,
                    (void *)ev_seq_cb_a, arg14 + 1000u, 0u);
    }
  }
}

static void __fastcall ev_seq_cb_a(uint8_t *game, uint8_t *unit, int32_t evType, uint32_t arg14,
                                   uint32_t arg18) {
  ev_seq_cb_common(game, unit, evType, arg14, arg18);
}

static void __fastcall ev_seq_cb_b(uint8_t *game, uint8_t *unit, int32_t evType, uint32_t arg14,
                                   uint32_t arg18) {
  ev_seq_cb_common(game, unit, evType, arg14, arg18);
}

static uint8_t *ev_unit_ptr(int32_t uIdx) {
  if (uIdx < 0 || uIdx >= 8) return NULL;
  return s_ev_units[uIdx];
}

static uint32_t __stdcall run_ev_seq_body(void) {
  raw_init_tq(s_ev_game);
  for (int i = 0; i < s_ev_nops; i += 6) {
    int32_t cmd = s_ev_ops[i + 0];
    int32_t u_idx = s_ev_ops[i + 1];
    int32_t p2 = s_ev_ops[i + 2];
    int32_t p3 = s_ev_ops[i + 3];
    uint32_t p4 = (uint32_t)s_ev_ops[i + 4];
    uint32_t p5 = (uint32_t)s_ev_ops[i + 5];
    uint8_t *u = ev_unit_ptr(u_idx);
    void *cb = (p5 & 0x10000u) ? (void *)ev_seq_cb_b : (void *)ev_seq_cb_a;
    uint32_t a18 = p5 & 0xFFFFu;

    if (cmd == 1) {
      if (p2 >= 0 && p2 < 15) {
        raw_set_event(s_ev_game, u, p2, (uint32_t)p3, cb, p4, a18);
      }
    } else if (cmd == 2) {
      if (p2 >= 0 && p2 < 15) {
        raw_set_persist(s_ev_game, u, p2, cb, p4, a18);
      }
    } else if (cmd == 3) {
      if (u) raw_mon_clear(s_ev_game, u);
    } else if (cmd == 4) {
      void *dcb = p3 == 2 ? (void *)ev_seq_cb_b : p3 == 1 ? (void *)ev_seq_cb_a : NULL;
      if (u) raw_del_by_type(s_ev_game, u, p2, dcb);
    } else if (cmd == 5) {
      if (u) raw_del_by_arg14(s_ev_game, u, p2, (uint32_t)p3);
    } else if (cmd == 6) {
      if (u) raw_rem_unit_ev(s_ev_game, u);
    } else if (cmd == 7) {
      if (u && RD32(u, 0x5C) && p2 >= 0 && p2 < 185) {
        raw_tog_state(u, p2, (uint32_t)p3);
      }
    } else if (cmd == 8) {
      uint32_t nf = u ? raw_next_ev_fr(u, p2) : 0u;
      if (s_ev_nnextf < 64) s_ev_nextf[s_ev_nnextf++] = (int32_t)nf;
    } else if (cmd == 9) {
      int steps = p2;
      if (steps < 0) steps = 0;
      if (steps > 80) steps = 80;
      for (int s = 0; s < steps; s++) {
        RD32(s_ev_game, 0xA8) += 1u;
        raw_upd_timers(s_ev_game);
      }
    } else if (cmd == 10) {
      /* Set or clear pUnit->pGame (+0x80) to test 0x6FD0227E early exit when pUnit+0x80 == 0 */
      if (u) {
        RD32(u, 0x80) = p2 ? (uint32_t)(uintptr_t)s_ev_game : 0u;
      }
    }
  }
  return 0;
}

static void handle_event_timer_seq_op(const char *line) {
  static const uint32_t k_types[8] = {1, 1, 0, 3, 2, 4, 1, 0};
  static const uint32_t k_ids[8] = {101, 102, 201, 301, 401, 501, 103, 202};

  int64_t tmp = 0;
  uint32_t init_frame = json_get_i64(line, "initFrame", &tmp) ? (uint32_t)tmp : 100u;
  uint32_t pool = RD32(g_player, 0x08);

  memset(s_ev_game, 0, sizeof s_ev_game);
  RD32(s_ev_game, 0xA8) = init_frame;
  memset(s_ev_units, 0, sizeof s_ev_units);

  int fault = 0;
  uint32_t r = 0;
  for (int i = 0; i < 8; i++) {
    RD32(s_ev_units[i], 0x00) = k_types[i];
    RD32(s_ev_units[i], 0x08) = pool;
    RD32(s_ev_units[i], 0x0C) = k_ids[i];
    RD32(s_ev_units[i], 0x80) = (uint32_t)(uintptr_t)s_ev_game;
    if (i == 0 || i == 1 || i == 2 || i == 6) {
      uint32_t a[4] = {(uint32_t)(uintptr_t)s_ev_units[i], 0, 0, (uint32_t)(uintptr_t)g_game};
      fault |= sc(C(VA_ALLOC_SLEX), 4, a, &r);
    }
  }

  int nraw = json_get_flat_array(line, "ops", s_ev_ops, 256);
  s_ev_nops = nraw - (nraw % 6);
  s_ev_nfired = 0;
  s_ev_nnextf = 0;

  if (!fault) {
    fault |= sc((uintptr_t)run_ev_seq_body, 0, NULL, &r);
  }
  if (fault) g_nfault++;

  uint32_t tq = RD32(s_ev_game, 0xB8);
  uint32_t chunk0 = tq ? RD32(tq, 0xA1C) : 0u;
  int32_t free_top[12];
  int n_free = 0;
  if (!fault && chunk0) {
    uint32_t cur = RD32(chunk0, 0x7080);
    while (cur && n_free < 12) {
      if (cur >= chunk0 && cur < chunk0 + 0x7080u) {
        free_top[n_free++] = (int32_t)((cur - chunk0) / 0x30u);
      } else {
        free_top[n_free++] = -1;
      }
      cur = RD32(cur, 0x1C);
    }
  }

  fn_chk_state_t p_chk = (fn_chk_state_t)C(VA_CHKSTATE);
  int32_t u0_st36 = (!fault && RD32(s_ev_units[0], 0x5C)) ? p_chk(s_ev_units[0], 0x36) : 0;
  int32_t u6_st36 = (!fault && RD32(s_ev_units[6], 0x5C)) ? p_chk(s_ev_units[6], 0x36) : 0;
  int32_t u0_st5c = (!fault && RD32(s_ev_units[0], 0x5C)) ? p_chk(s_ev_units[0], 0x5C) : 0;
  int32_t u6_st5c = (!fault && RD32(s_ev_units[6], 0x5C)) ? p_chk(s_ev_units[6], 0x5C) : 0;
  uint32_t u0_f2 = RD32(s_ev_units[0], 0xC8);

  fprintf(g_resp,
          "{\"fault\":%d,\"endFrame\":%lu,\"u0State36\":%ld,\"u6State36\":%ld,\"u0State5C\":%ld,\"u6State5C\":%ld,\"u0Flags2\":%lu,\"fired\":[",
          fault, (unsigned long)RD32(s_ev_game, 0xA8), (long)u0_st36, (long)u6_st36, (long)u0_st5c,
          (long)u6_st5c, (unsigned long)u0_f2);
  for (int i = 0; i < s_ev_nfired; i++) {
    const struct ev_fired_rec *f = &s_ev_fired[i];
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "[%lu,%ld,%ld,%lu,%ld,%ld]", (unsigned long)f->frame, (long)f->ev_type,
            (long)f->u_type, (unsigned long)f->u_id, (long)f->arg14, (long)f->arg18);
  }
  fputs("],\"nextFrames\":[", g_resp);
  for (int i = 0; i < s_ev_nnextf; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "%ld", (long)s_ev_nextf[i]);
  }
  fputs("],\"freeTop\":[", g_resp);
  for (int i = 0; i < n_free; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "%ld", (long)free_top[i]);
  }
  fputs("],\"u0Chain\":[", g_resp);
  if (!fault && chunk0) {
    uint32_t ev = RD32(s_ev_units[0], 0xDC);
    int k = 0;
    while (ev && k < 16) {
      int32_t nidx = (ev >= chunk0 && ev < chunk0 + 0x7080u) ? (int32_t)((ev - chunk0) / 0x30u) : -1;
      if (k > 0) fputc(',', g_resp);
      fprintf(g_resp, "[%u,%lu,%ld,%ld]", (unsigned)(*(uint8_t *)ev),
              (unsigned long)RD32(ev, 0x04), (long)(int32_t)RD32(ev, 0x14), (long)nidx);
      ev = RD32(ev, 0x24);
      k++;
    }
  }
  fputs("]}\n", g_resp);

  if (tq) raw_free_tq(s_ev_game);
  for (int i = 0; i < 8; i++) {
    free_sl_ptr(RD32(s_ev_units[i], 0x5C));
  }
}

/* --------------------------------------------------------------------------
 * Op 204 (`SUNIT_UNITROOM_CALL`): real-DLL SUNIT server hash table
 * (0x6FCFF9C0, 0x6FD00310, 0x6FD003A0, 0x6FD002A0), UNITS_GetX/Y
 * (0x6FD51050, 0x6FD51080), and UNITROOM (#10531 0x6FDB6800, #10158 0x6FDB65C0,
 * #11016 0x6FDB6700).
 * -------------------------------------------------------------------------- */
static uint8_t s_su_game[0x1E00];
static uint8_t s_su_room[0x80];
static uint32_t s_su_act_flag;
static uint8_t s_su_units[8][0x100];
static uint8_t s_su_paths[8][0x40];
static int s_su_nunits;
static int32_t s_su_ops[256];
static int s_su_nops;
static int32_t s_su_newids[32];
static int s_su_nnewids;
static int32_t s_su_found[64];
static int s_su_nfound;
static int32_t s_su_coords[64];
static int s_su_ncoords;

static int su_ptr_to_idx(const void *p) {
  if (!p) return -1;
  for (int i = 0; i < s_su_nunits; i++) {
    if (p == (const void *)s_su_units[i]) return i;
  }
  return -2;
}

static void su_set_unit_room_ptr(uint8_t *u, void *room) {
  uint32_t ut = RD32(u, 0x00);
  uint8_t *path = (uint8_t *)(uintptr_t)RD32(u, 0x2C);
  if (!path) return;
  if (ut == 2 || ut == 4 || ut == 5) {
    RD32(path, 0x00) = (uint32_t)(uintptr_t)room;
  } else {
    RD32(path, 0x1C) = (uint32_t)(uintptr_t)room;
  }
}

static uint32_t su_get_unit_room_ptr(uint8_t *u) {
  uint32_t ut = RD32(u, 0x00);
  uint8_t *path = (uint8_t *)(uintptr_t)RD32(u, 0x2C);
  if (!path) return 0u;
  return (ut == 2 || ut == 4 || ut == 5) ? RD32(path, 0x00) : RD32(path, 0x1C);
}

static int su_in_room_list(const void *u) {
  const uint8_t *cur = (const uint8_t *)(uintptr_t)RD32(s_su_room, 0x74);
  int guard = 0;
  while (cur && guard < 32) {
    if ((const void *)cur == u) return 1;
    cur = (const uint8_t *)(uintptr_t)RD32(cur, 0xE8);
    guard++;
  }
  return 0;
}

static uint32_t __stdcall run_sunit_room_body(void) {
  fn_new_uid_t fn_newid = (fn_new_uid_t)G(GVA_NEWUID);
  fn_unit_xy_t fn_getx = (fn_unit_xy_t)C(VA_GETX);
  fn_unit_xy_t fn_gety = (fn_unit_xy_t)C(VA_GETY);
  fn_add_room_t fn_add = (fn_add_room_t)C(VA_ADDROOM);
  fn_unit_room1_t fn_ref = (fn_unit_room1_t)C(VA_REFUNIT);
  fn_unit_room1_t fn_rem = (fn_unit_room1_t)C(VA_REMROOM);
  fn_unit_room1_t fn_clr_upd = (fn_unit_room1_t)C(0x6FDB63B0u);

  for (int i = 0; i < s_su_nops; i += 4) {
    int32_t cmd = s_su_ops[i + 0];
    int32_t a = s_su_ops[i + 1];
    int32_t b = s_su_ops[i + 2];
    if (cmd == 1) {
      if (a >= 0 && a < 6 && s_su_nnewids < 32) {
        s_su_newids[s_su_nnewids++] = (int32_t)fn_newid((uint32_t)a, s_su_game);
      }
    } else if (cmd == 2) {
      if (a >= 0 && a < s_su_nunits) {
        RD32(s_su_units[a], 0xE4) = 0u;
        raw_sunit_insert(s_su_game, s_su_units[a]);
      }
    } else if (cmd == 3) {
      if (s_su_nfound < 64) {
        void *got = raw_sunit_get(s_su_game, (uint32_t)a, (uint32_t)b);
        s_su_found[s_su_nfound++] = su_ptr_to_idx(got);
      }
    } else if (cmd == 4) {
      if (a >= 0 && a < s_su_nunits) {
        raw_sunit_remove(s_su_game, s_su_units[a]);
      }
    } else if (cmd == 5) {
      if (a >= 0 && a < s_su_nunits && s_su_ncoords + 1 < 64) {
        s_su_coords[s_su_ncoords++] = fn_getx(s_su_units[a]);
        s_su_coords[s_su_ncoords++] = fn_gety(s_su_units[a]);
      }
    } else if (cmd == 6) {
      if (a >= 0 && a < s_su_nunits && RD32(s_su_units[a], 0x2C) &&
          !su_in_room_list(s_su_units[a])) {
        fn_add(s_su_units[a], s_su_room, 0);
      }
    } else if (cmd == 7) {
      if (a >= 0 && a < s_su_nunits) {
        fn_ref(s_su_units[a]);
      }
    } else if (cmd == 8) {
      if (a >= 0 && a < s_su_nunits && su_in_room_list(s_su_units[a])) {
        fn_rem(s_su_units[a]);
      }
    } else if (cmd == 9) {
      if (b == 0) {
        fn_clr_upd(s_su_room);
      } else {
        RD32(s_su_room, 0x34) = (uint32_t)b;
      }
    }
  }
  return 0;
}

static void handle_sunit_unitroom_op(const char *line) {
  int64_t tmp = 0;
  uint32_t room_flags = json_get_i64(line, "roomFlags", &tmp) ? (uint32_t)tmp : 0u;
  uint32_t pool = RD32(g_player, 0x08);

  memset(s_su_game, 0, sizeof s_su_game);
  int32_t ctrs[6];
  int nctrs = json_get_flat_array(line, "initCounters", ctrs, 6);
  for (int i = 0; i < nctrs; i++) {
    RD32(s_su_game, 0x90 + i * 4) = (uint32_t)ctrs[i];
  }

  memset(s_su_room, 0, sizeof s_su_room);
  s_su_act_flag = 0u;
  RD32(s_su_room, 0x2C) = (uint32_t)(uintptr_t)&s_su_act_flag;
  RD32(s_su_room, 0x34) = room_flags;
  RD32(s_su_room, 0x4C) = 5000u;
  RD32(s_su_room, 0x50) = 5000u;
  RD32(s_su_room, 0x54) = 200u;
  RD32(s_su_room, 0x58) = 200u;

  memset(s_su_units, 0, sizeof s_su_units);
  memset(s_su_paths, 0, sizeof s_su_paths);
  uint32_t su_sublists[8] = {0};
  int fault = 0;
  uint32_t r = 0;
  int32_t udefs[48];
  int nud = json_get_flat_array(line, "units", udefs, 48);
  s_su_nunits = nud / 6;
  if (s_su_nunits > 8) s_su_nunits = 8;
  for (int i = 0; i < s_su_nunits; i++) {
    uint32_t ut = (uint32_t)udefs[i * 6 + 0];
    uint32_t cid = (uint32_t)udefs[i * 6 + 1];
    uint32_t uid = (uint32_t)udefs[i * 6 + 2];
    uint32_t x = (uint32_t)udefs[i * 6 + 3];
    uint32_t y = (uint32_t)udefs[i * 6 + 4];
    int32_t has_path = udefs[i * 6 + 5];
    RD32(s_su_units[i], 0x00) = ut;
    RD32(s_su_units[i], 0x04) = cid;
    RD32(s_su_units[i], 0x08) = pool;
    RD32(s_su_units[i], 0x0C) = uid;
    RD32(s_su_units[i], 0x80) = (uint32_t)(uintptr_t)s_su_game;
    RD32(s_su_units[i], 0xC8) = 0x02u | ((uint32_t)i << 4);
    if (has_path) {
      RD32(s_su_units[i], 0x2C) = (uint32_t)(uintptr_t)s_su_paths[i];
      if (ut == 2 || ut == 4 || ut == 5) {
        RD32(s_su_paths[i], 0x0C) = x;
        RD32(s_su_paths[i], 0x10) = y;
      } else {
        *(uint16_t *)(s_su_paths[i] + 0x02) = (uint16_t)(x & 0xFFFFu);
        *(uint16_t *)(s_su_paths[i] + 0x06) = (uint16_t)(y & 0xFFFFu);
      }
      /* Initialize pPath->pRoom ONLY at unit setup before commands run */
      su_set_unit_room_ptr(s_su_units[i], s_su_room);
    }
    if (has_path == 2 && ut == 1) {
      /* Alignment-2 converted monster: state 17 (conversion) + state 105 sublist stat 172 = 2 */
      uint32_t a_ex[4] = {(uint32_t)(uintptr_t)s_su_units[i], 0, 0, (uint32_t)(uintptr_t)g_game};
      fault |= sc(C(VA_ALLOC_SLEX), 4, a_ex, &r);
      uint32_t a_st[3] = {(uint32_t)(uintptr_t)s_su_units[i], 17u, 1u};
      fault |= sc(C(VA_TOGSTATE_EXP), 3, a_st, &r);
      uint32_t a_sl[5] = {pool, 0, 0, ut, uid};
      uint32_t p_sub = 0;
      fault |= sc(C(VA_ALLOC_SL), 5, a_sl, &p_sub);
      if (p_sub) {
        su_sublists[i] = p_sub;
        RD32((uint8_t *)(uintptr_t)p_sub, 0x14) = 0x69u;
        uint32_t a_ss[4] = {p_sub, 0xACu, 2u, 0u};
        fault |= sc(C(VA_SETSLSTAT), 4, a_ss, &r);
        uint32_t a_mg[3] = {(uint32_t)(uintptr_t)s_su_units[i], p_sub, 1u};
        fault |= sc(C(VA_MERGE_SL), 3, a_mg, &r);
      }
    }
  }

  int nraw = json_get_flat_array(line, "ops", s_su_ops, 256);
  s_su_nops = nraw - (nraw % 4);
  s_su_nnewids = 0;
  s_su_nfound = 0;
  s_su_ncoords = 0;

  if (!fault) {
    fault |= sc((uintptr_t)run_sunit_room_body, 0, NULL, &r);
  }
  if (fault) g_nfault++;

  fprintf(g_resp, "{\"fault\":%d,\"nPlayers\":%lu,\"actFlag\":%lu,\"newIds\":[",
          fault, (unsigned long)RD32(s_su_room, 0x28), (unsigned long)s_su_act_flag);
  for (int i = 0; i < s_su_nnewids; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "%ld", (long)s_su_newids[i]);
  }
  fputs("],\"found\":[", g_resp);
  for (int i = 0; i < s_su_nfound; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "%ld", (long)s_su_found[i]);
  }
  fputs("],\"coords\":[", g_resp);
  for (int i = 0; i < s_su_ncoords; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "%ld", (long)s_su_coords[i]);
  }
  fputs("],\"roomUnits\":[", g_resp);
  {
    uint8_t *cur = (uint8_t *)(uintptr_t)RD32(s_su_room, 0x74);
    int k = 0;
    while (cur && k < 16) {
      if (k > 0) fputc(',', g_resp);
      fprintf(g_resp, "%d", su_ptr_to_idx(cur));
      cur = (uint8_t *)(uintptr_t)RD32(cur, 0xE8);
      k++;
    }
  }
  fputs("],\"roomUpdates\":[", g_resp);
  {
    uint8_t *cur = (uint8_t *)(uintptr_t)RD32(s_su_room, 0x1C);
    int k = 0;
    while (cur && k < 16) {
      if (k > 0) fputc(',', g_resp);
      fprintf(g_resp, "%d", su_ptr_to_idx(cur));
      cur = (uint8_t *)(uintptr_t)RD32(cur, 0xE0);
      k++;
    }
  }
  fputs("],\"unitFlags\":[", g_resp);
  for (int i = 0; i < s_su_nunits; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "%lu", (unsigned long)RD32(s_su_units[i], 0xC4));
  }
  fputs("],\"unitFlags2\":[", g_resp);
  for (int i = 0; i < s_su_nunits; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "%lu", (unsigned long)RD32(s_su_units[i], 0xC8));
  }
  fputs("],\"unitHashNext\":[", g_resp);
  for (int i = 0; i < s_su_nunits; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "%d", su_ptr_to_idx((const void *)(uintptr_t)RD32(s_su_units[i], 0xE4)));
  }
  fputs("],\"unitRooms\":[", g_resp);
  for (int i = 0; i < s_su_nunits; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "%d", su_get_unit_room_ptr(s_su_units[i]) == (uint32_t)(uintptr_t)s_su_room ? 1 : 0);
  }
  fputs("]}\n", g_resp);

  for (int i = 0; i < s_su_nunits; i++) {
    if (su_sublists[i]) {
      uint32_t ua[2] = {(uint32_t)(uintptr_t)s_su_units[i], su_sublists[i]};
      sc(C(VA_UNLINK_SL), 2, ua, &r);
      free_sl_ptr(su_sublists[i]);
    }
    free_sl_ptr(RD32(s_su_units[i], 0x5C));
  }
}

/*
 * JSON object op (`{"op":200,...}`): SNAP_CALL stateful snapshot invocation.
 * Applies temporary pre-state on g_game / g_player / g_monster, invokes target VA
 * via VEH-protected `sc()`, captures return value, post-state stats/states/seeds
 * and outbound D2Net.#10002 S2C packets, then restores clean baseline state.
 */
static void handle_json_obj(const char *line) {
  g_nreq++;
  int64_t op = 0, mod = 0, va = 0, tmp = 0;
  if (!json_get_i64(line, "op", &op)) {
    g_nbad++;
    fputs("{\"error\":\"bad_request\"}\n", g_resp);
    return;
  }
  if (op == 201) {
    handle_multilist_op(line);
    return;
  }
  if (op == 202) {
    handle_states_seq_op(line);
    return;
  }
  if (op == 203) {
    handle_event_timer_seq_op(line);
    return;
  }
  if (op == 204) {
    handle_sunit_unitroom_op(line);
    return;
  }
  if (op != 200 || !json_get_i64(line, "va", &va)) {
    g_nbad++;
    fputs("{\"error\":\"bad_request\"}\n", g_resp);
    return;
  }
  json_get_i64(line, "mod", &mod);

  /* Save game pre-state */
  uint32_t sv_frame = RD32(g_game, 0xA8);
  uint32_t sv_gs0 = RD32(g_game, 0xD0), sv_gs1 = RD32(g_game, 0xD4);
  uint8_t sv_diff = g_game[0x6D];
  uint32_t sv_ps0 = RD32(g_player, 0x20), sv_ps1 = RD32(g_player, 0x24);
  uint32_t sv_pcls = RD32(g_player, 0x04);
  uint8_t *plex = (uint8_t *)(uintptr_t)RD32(g_player, 0x5C);
  uint8_t *mlex = g_monster ? (uint8_t *)(uintptr_t)RD32(g_monster, 0x5C) : NULL;
  uint32_t sv_pcb = (plex && (RD32(plex, 0x10) & 0x80000000u)) ? RD32(plex, 0x5C) : 0;
  uint32_t sv_mcb = (mlex && (RD32(mlex, 0x10) & 0x80000000u)) ? RD32(mlex, 0x5C) : 0;
  int no_stat_cb = (json_get_i64(line, "noStatCb", &tmp) && tmp != 0) ? 1 : 0;
  if (no_stat_cb) {
    if (plex && (RD32(plex, 0x10) & 0x80000000u)) RD32(plex, 0x5C) = 0;
    if (mlex && (RD32(mlex, 0x10) & 0x80000000u)) RD32(mlex, 0x5C) = 0;
  }

  if (json_get_i64(line, "frame", &tmp)) RD32(g_game, 0xA8) = (uint32_t)tmp;
  if (json_get_i64(line, "diff", &tmp)) g_game[0x6D] = (uint8_t)tmp;
  if (json_get_i64(line, "pClass", &tmp) && tmp >= 0 && tmp <= 6) RD32(g_player, 0x04) = (uint32_t)tmp;

  int32_t gs[2];
  if (json_get_flat_array(line, "gameSeed", gs, 2) == 2) {
    RD32(g_game, 0xD0) = (uint32_t)gs[0];
    RD32(g_game, 0xD4) = (uint32_t)gs[1];
  }
  if (json_get_flat_array(line, "pSeed", gs, 2) == 2) {
    RD32(g_player, 0x20) = (uint32_t)gs[0];
    RD32(g_player, 0x24) = (uint32_t)gs[1];
  }

  /* Apply player stats (`pStats`: [statId, val, statId, val, ...]).
   * First save and zero all `pStats` stats on `g_player`, then reset `wModStatCount = 0`
   * on `plex` so `pModStat` (`0x6FD88550` `STATLIST_RecordModStat`) records the exact same
   * modified stat keys as a fresh unit in `SparseMemory113c`! */
  int32_t pstats[128], pstats_orig[64];
  int np = json_get_flat_array(line, "pStats", pstats, 128) & ~1;
  for (int i = 0; i < np; i += 2) {
    uint32_t ov = 0;
    ustat(1, g_player, pstats[i], 0, &ov);
    pstats_orig[i / 2] = (int32_t)ov;
    uset(g_player, pstats[i], 0);
  }
  uint16_t sv_mod_cnt = (plex && (RD32(plex, 0x10) & 0x80000000u)) ? *(uint16_t *)(plex + 0x54) : 0;
  uint32_t sv_mod_words[64];
  if (plex && (RD32(plex, 0x10) & 0x80000000u)) {
    uint32_t *ms = (uint32_t *)(uintptr_t)RD32(plex, 0x50);
    int ncopy = sv_mod_cnt < 64 ? (int)sv_mod_cnt : 64;
    for (int i = 0; i < ncopy && ms; i++) sv_mod_words[i] = ms[i];
    *(uint16_t *)(plex + 0x54) = 0;
  }
  for (int i = 0; i < np; i += 2) {
    uset(g_player, pstats[i], pstats[i + 1]);
  }

  /* Apply monster stats (`mStats`: [statId, val, ...]) */
  int32_t mstats[128], mstats_orig[64];
  int nm = g_monster ? (json_get_flat_array(line, "mStats", mstats, 128) & ~1) : 0;
  for (int i = 0; i < nm; i += 2) {
    uint32_t ov = 0;
    ustat(1, g_monster, mstats[i], 0, &ov);
    mstats_orig[i / 2] = (int32_t)ov;
    uset(g_monster, mstats[i], mstats[i + 1]);
  }

  /* Apply player states (`pStates`: [stateId, bSet, ...]) */
  int32_t pstates[64];
  uint32_t pstate_act_orig[32], pstate_drt_orig[32];
  uint32_t sv_pf2 = RD32(g_player, 0xC8);
  uint32_t *psf = unit_state_flags(g_player);
  int nst = psf ? (json_get_flat_array(line, "pStates", pstates, 64) & ~1) : 0;
  for (int i = 0; i < nst; i += 2) {
    int sid = pstates[i];
    if (sid < 0 || sid >= 185) continue;
    int w = sid >> 5;
    uint32_t mask = 1u << (sid & 31);
    pstate_act_orig[i / 2] = psf[w] & mask;
    pstate_drt_orig[i / 2] = psf[w + 6] & mask;
    uint32_t targs[2] = {(uint32_t)(uintptr_t)g_player, pstates[i + 1] ? 1u : 0u}, ign = 0;
    g_sc_ebx = (uint32_t)sid;
    sc(C(VA_TOGSTATE), 2, targs, &ign);
  }

  /* Populate optional scratch buffer (`buf`: u32 dwords) */
  memset(g_snap_buf, 0, sizeof g_snap_buf);
  int32_t bwords[128];
  int nbuf = json_get_flat_array(line, "buf", bwords, 128);
  for (int i = 0; i < nbuf; i++) {
    RD32(g_snap_buf, i * 4) = resolve_ptr_token((uint32_t)bwords[i]);
  }

  /* Stage registers & stack arguments */
  int32_t raw_args[8];
  uint32_t call_args[8];
  int nargs = json_get_flat_array(line, "args", raw_args, 8);
  for (int i = 0; i < nargs; i++) call_args[i] = resolve_ptr_token((uint32_t)raw_args[i]);

  g_sc_eax = json_get_i64(line, "eax", &tmp) ? resolve_ptr_token((uint32_t)tmp) : 0;
  g_sc_ecx = json_get_i64(line, "ecx", &tmp) ? resolve_ptr_token((uint32_t)tmp) : 0;
  g_sc_edx = json_get_i64(line, "edx", &tmp) ? resolve_ptr_token((uint32_t)tmp) : 0;
  g_sc_ebx = json_get_i64(line, "ebx", &tmp) ? resolve_ptr_token((uint32_t)tmp) : 0;
  g_sc_esi = json_get_i64(line, "esi", &tmp) ? resolve_ptr_token((uint32_t)tmp) : 0;
  g_sc_edi = json_get_i64(line, "edi", &tmp) ? resolve_ptr_token((uint32_t)tmp) : 0;

  int no_stat_list = (json_get_i64(line, "noStatList", &tmp) && tmp != 0) ? 1 : 0;
  if (no_stat_list) {
    RD32(g_player, 0x5C) = 0u;
  }

  uintptr_t target_fn = mod == 0 ? G((uintptr_t)(uint32_t)va) : C((uintptr_t)(uint32_t)va);
  g_s2c_count = 0;
  g_net_capture = 1;
  uint32_t ret = 0;
  int fault = sc(target_fn, nargs, call_args, &ret);
  g_net_capture = 0;
  if (fault) g_nfault++;

  int post_has_slex = RD32(g_player, 0x5C) != 0 ? 1 : 0;

  /* Serialize post-call snapshot JSON */
  fprintf(g_resp,
          "{\"fault\":%d,\"eax\":%ld,\"hasStatList\":%d,\"gameSeed\":[%lu,%lu],\"pSeed\":[%lu,%lu]",
          fault, (long)(int32_t)ret, post_has_slex, (unsigned long)RD32(g_game, 0xD0),
          (unsigned long)RD32(g_game, 0xD4), (unsigned long)RD32(g_player, 0x20),
          (unsigned long)RD32(g_player, 0x24));

  fputs(",\"modStats\":[", g_resp);
  if (post_has_slex && plex && (RD32(plex, 0x10) & 0x80000000u)) {
    uint16_t mcnt = *(uint16_t *)(plex + 0x54);
    uint32_t *ms = (uint32_t *)(uintptr_t)RD32(plex, 0x50);
    for (int i = 0; i < (int)mcnt && ms; i++) {
      if (i > 0) fputc(',', g_resp);
      fprintf(g_resp, "%lu", (unsigned long)ms[i]);
    }
  }
  fputc(']', g_resp);

  int32_t qstats[64];
  int nqs = json_get_flat_array(line, "qStats", qstats, 64);
  fputs(",\"qStats\":[", g_resp);
  for (int i = 0; i < nqs; i++) {
    uint32_t bv = 0, fv = 0;
    ustat(1, g_player, qstats[i], 0, &bv);
    ustat(0, g_player, qstats[i], 0, &fv);
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "[%ld,%ld,%ld]", (long)qstats[i], (long)(int32_t)bv, (long)(int32_t)fv);
  }
  fputc(']', g_resp);

  int32_t qstates[64];
  int nqst = json_get_flat_array(line, "qStates", qstates, 64);
  fputs(",\"qStates\":[", g_resp);
  for (int i = 0; i < nqst; i++) {
    uint32_t ca[2] = {(uint32_t)(uintptr_t)g_player, (uint32_t)qstates[i]}, cv = 0;
    sc(C(VA_CHKSTATE), 2, ca, &cv);
    uint32_t gv = (psf && qstates[i] >= 0 && qstates[i] < 185)
                      ? (psf[(qstates[i] >> 5) + 6] & (1u << (qstates[i] & 31)))
                      : 0;
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "[%ld,%lu,%lu]", (long)qstates[i], (unsigned long)cv, (unsigned long)gv);
  }
  fputc(']', g_resp);

  fputs(",\"s2c\":[", g_resp);
  for (int i = 0; i < g_s2c_count; i++) {
    if (i > 0) fputc(',', g_resp);
    fprintf(g_resp, "{\"q\":%d,\"cid\":%d,\"hex\":\"", g_s2c_ring[i].queue, g_s2c_ring[i].client_id);
    for (int b = 0; b < g_s2c_ring[i].len; b++) {
      fprintf(g_resp, "%02x", g_s2c_ring[i].bytes[b]);
    }
    fputs("\"}", g_resp);
  }
  fputs("]}\n", g_resp);

  /* Restore pre-call state */
  if (no_stat_list) {
    RD32(g_player, 0x5C) = (uint32_t)(uintptr_t)plex;
  }
  for (int i = nst - 2; i >= 0; i -= 2) {
    int sid = pstates[i];
    if (sid < 0 || sid >= 185) continue;
    int w = sid >> 5;
    uint32_t mask = 1u << (sid & 31);
    psf[w] = (psf[w] & ~mask) | pstate_act_orig[i / 2];
    psf[w + 6] = (psf[w + 6] & ~mask) | pstate_drt_orig[i / 2];
  }
  RD32(g_player, 0xC8) = sv_pf2;
  for (int i = nm - 2; i >= 0; i -= 2) uset(g_monster, mstats[i], mstats_orig[i / 2]);
  for (int i = np - 2; i >= 0; i -= 2) uset(g_player, pstats[i], pstats_orig[i / 2]);
  if (plex && (RD32(plex, 0x10) & 0x80000000u)) {
    uint32_t *ms = (uint32_t *)(uintptr_t)RD32(plex, 0x50);
    int ncopy = sv_mod_cnt < 64 ? (int)sv_mod_cnt : 64;
    for (int i = 0; i < ncopy && ms; i++) ms[i] = sv_mod_words[i];
    *(uint16_t *)(plex + 0x54) = sv_mod_cnt;
  }
  if (no_stat_cb) {
    if (plex && (RD32(plex, 0x10) & 0x80000000u)) RD32(plex, 0x5C) = sv_pcb;
    if (mlex && (RD32(mlex, 0x10) & 0x80000000u)) RD32(mlex, 0x5C) = sv_mcb;
  }
  RD32(g_player, 0x04) = sv_pcls;
  RD32(g_player, 0x20) = sv_ps0;
  RD32(g_player, 0x24) = sv_ps1;
  RD32(g_game, 0xD0) = sv_gs0;
  RD32(g_game, 0xD4) = sv_gs1;
  g_game[0x6D] = sv_diff;
  RD32(g_game, 0xA8) = sv_frame;
}

static int parse_ints(const char *s, int32_t *v, int max) {
  int n = 0;
  while (*s && *s != '[') s++;
  if (*s == '[') s++;
  while (*s && n < max) {
    while (*s == ' ' || *s == ',') s++;
    if (*s == ']' || !*s) break;
    char *e;
    long long x = strtoll(s, &e, 10);
    if (e == s) break;
    v[n++] = (int32_t)x;
    s = e;
  }
  return n;
}

static void put_result(int st, int32_t v, int first) {
  if (!first) fputc(',', g_resp);
  if (st == 0)
    fprintf(g_resp, "%ld", (long)v);
  else if (st == 1) {
    fputs("\"fault\"", g_resp);
    g_nfault++;
  } else {
    fputs("\"bad\"", g_resp);
    g_nbad++;
  }
}

/*
 * Range op: [100, op, lo, hi, a0, a1] evaluates op(a0, lvl, a1) for
 * lvl = lo..hi (skill-eval ops take (skill, lvl, x)).
 * All-codes op: [101, skill, lo, hi] evaluates SKCALC(skill, lvl, code) for
 * lvl = lo..hi and code = 0..72 (lvl-major).
 */
static void handle_line(const char *line) {
  const char *p = line;
  while (*p == ' ' || *p == '\t') p++;
  if (*p == '{') {
    handle_json_obj(p);
    return;
  }
  int32_t v[64];
  int n = parse_ints(p, v, 64);
  if (n == 0) return;
  g_nreq++;
  fputc('[', g_resp);
  if (v[0] == 100 && n >= 6 && (int64_t)v[3] - v[2] < 4096) {
    for (int64_t l = v[2]; l <= v[3]; l++) {
      int32_t args[3] = {v[4], (int32_t)l, v[5]}, r = 0;
      int st = eval_op(v[1], args, 3, &r);
      put_result(st, r, l == v[2]);
    }
  } else if (v[0] == 101 && n >= 4 && (int64_t)v[3] - v[2] < 4096) {
    int first = 1;
    for (int64_t l = v[2]; l <= v[3]; l++)
      for (int32_t c = 0; c <= 72; c++) {
        int32_t args[3] = {v[1], (int32_t)l, c}, r = 0;
        int st = eval_op(1, args, 3, &r);
        put_result(st, r, first);
        first = 0;
      }
  } else {
    int32_t r = 0;
    int st = eval_op(v[0], v + 1, n - 1, &r);
    put_result(st, r, 1);
  }
  fputs("]\n", g_resp);
}

static uint8_t *first_unit(uint8_t *game, int type) {
  for (int b = 0; b < 128; b++) {
    uint8_t *u = (uint8_t *)(uintptr_t)RD32(game, 0x1120 + type * 0x200 + b * 4);
    if (u) return u;
  }
  return NULL;
}

/* Prefer a monster whose MonStats Drain (normal) is non-zero so the leech path
 * (0x6FCFBA8E) is exercised; fall back to the first monster in the hash. */
static uint8_t *pick_monster(uint8_t *game) {
  uint8_t *first = NULL;
  for (int b = 0; b < 128; b++) {
    for (uint8_t *u = (uint8_t *)(uintptr_t)RD32(game, 0x1120 + 0x200 + b * 4); u;
         u = (uint8_t *)(uintptr_t)RD32(u, 0xE4)) {
      if (!first) first = u;
      uint8_t *md = (uint8_t *)(uintptr_t)RD32(u, 0x14);
      uint8_t *ms = md ? (uint8_t *)(uintptr_t)RD32(md, 0) : NULL;
      if (ms && ms[0xA0] > 0) return u;
    }
  }
  return first;
}

static uint32_t g_ready_frame;

static void pump_messages(void) {
  MSG msg;
  while (PeekMessageA(&msg, NULL, 0, 0, PM_REMOVE)) {
    TranslateMessage(&msg);
    DispatchMessageA(&msg);
  }
}

static void run_daemon_loop(void) {
  CreateDirectoryA(ORACLE_DIR "spool", NULL);
  FILE *rdy = fopen(ORACLE_DIR "out\\daemon.ready", "w");
  if (rdy) {
    fprintf(rdy, "{\"pid\":%lu,\"game\":%lu,\"player\":%lu,\"monster\":%lu}\n",
            (unsigned long)GetCurrentProcessId(), (unsigned long)(uintptr_t)g_game,
            (unsigned long)(uintptr_t)g_player, (unsigned long)(uintptr_t)g_monster);
    fclose(rdy);
  }
  logf_("daemon ready: game=%p player=%p monster=%p", (void *)g_game, (void *)g_player,
        (void *)g_monster);

  for (;;) {
    pump_messages();
    if (GetFileAttributesA(ORACLE_DIR "spool\\shutdown") != INVALID_FILE_ATTRIBUTES) {
      DeleteFileA(ORACLE_DIR "spool\\shutdown");
      logf_("daemon shutdown after %ld requests (%ld faults, %ld bad)", g_nreq, g_nfault, g_nbad);
      FILE *d = fopen(ORACLE_DIR "out\\done", "w");
      if (d) fclose(d);
      g_done = 1;
      return;
    }
    if (GetFileAttributesA(ORACLE_DIR "spool\\req.ndjson") != INVALID_FILE_ATTRIBUTES) {
      g_req = fopen(ORACLE_DIR "spool\\req.ndjson", "r");
      g_resp = fopen(ORACLE_DIR "spool\\resp.tmp", "w");
      if (g_req && g_resp) {
        setvbuf(g_resp, NULL, _IOFBF, 1 << 20);
        while (fgets(g_line, sizeof g_line, g_req)) {
          handle_line(g_line);
        }
        fclose(g_req);
        fclose(g_resp);
        g_req = g_resp = NULL;
        DeleteFileA(ORACLE_DIR "spool\\req.ndjson");
        DeleteFileA(ORACLE_DIR "spool\\resp.ndjson");
        MoveFileA(ORACLE_DIR "spool\\resp.tmp", ORACLE_DIR "spool\\resp.ndjson");
      } else {
        if (g_req) fclose(g_req);
        if (g_resp) fclose(g_resp);
        g_req = g_resp = NULL;
        Sleep(1);
      }
      continue;
    }
    Sleep(1);
  }
}

void __cdecl on_frame(uint8_t *game) {
  InterlockedIncrement(&g_frames);
  if (g_done) return;
  uint8_t *pl = first_unit(game, 0);
  if (!pl) return;
  uint32_t fr = RD32(game, 0xA8);
  if (!g_ready_frame) {
    g_ready_frame = fr + 50; /* let the game settle for 2 s */
    logf_("player %p at frame %u", (void *)pl, fr);
    return;
  }
  if (fr < g_ready_frame) return;
  if (GetFileAttributesA(ORACLE_DIR "daemon.mode") != INVALID_FILE_ATTRIBUTES) {
    g_game = game;
    g_player = pl;
    g_monster = pick_monster(game);
    run_daemon_loop();
    return;
  }
  if (!g_req) {
    g_game = game;
    g_player = pl;
    g_monster = pick_monster(game);
    g_req = fopen(ORACLE_DIR "fn-req.ndjson", "r");
    g_resp = fopen(ORACLE_DIR "out\\fn-resp.ndjson", "w");
    if (!g_req || !g_resp) {
      logf_("cannot open request/response (%p %p)", (void *)g_req, (void *)g_resp);
      g_done = 1;
      FILE *d = fopen(ORACLE_DIR "out\\done", "w");
      if (d) fclose(d);
      return;
    }
    setvbuf(g_resp, NULL, _IOFBF, 1 << 20);
    logf_("start: player %p class %u monster %p class %u", (void *)pl, RD32(pl, 4), (void *)g_monster,
          g_monster ? RD32(g_monster, 4) : 0);
  }
  g_player = pl;
  DWORD t0 = GetTickCount();
  while (GetTickCount() - t0 < 400) {
    if (!fgets(g_line, sizeof g_line, g_req)) {
      fclose(g_req);
      fclose(g_resp);
      g_done = 1;
      logf_("finished: %ld requests, %ld faults, %ld bad", g_nreq, g_nfault, g_nbad);
      FILE *d = fopen(ORACLE_DIR "out\\done", "w");
      if (d) fclose(d);
      return;
    }
    handle_line(g_line);
  }
  logf_("progress: %ld requests", g_nreq);
}

__attribute__((naked)) static void frame_stub(void) {
  __asm__ volatile(
      "push %%eax\n\t"
      "call *%0\n\t"
      "pop %%eax\n\t"
      "pushal\n\t"
      "push %%eax\n\t"
      "call _on_frame\n\t"
      "add $4, %%esp\n\t"
      "popal\n\t"
      "ret\n\t" ::"m"(g_frame_fn));
}

static int patch_call(uintptr_t site, void *target, uintptr_t expect) {
  uint8_t *p = (uint8_t *)site;
  if (p[0] != 0xE8) return 0;
  uintptr_t cur = site + 5 + *(int32_t *)(p + 1);
  if (cur != expect) return 0;
  DWORD old;
  VirtualProtect(p, 5, PAGE_EXECUTE_READWRITE, &old);
  *(int32_t *)(p + 1) = (int32_t)((uintptr_t)target - (site + 5));
  VirtualProtect(p, 5, old, &old);
  FlushInstructionCache(GetCurrentProcess(), p, 5);
  return 1;
}

static DWORD WINAPI oracle_thread(LPVOID unused) {
  (void)unused;
  CreateDirectoryA(ORACLE_DIR "out", NULL);
  g_log = fopen(ORACLE_DIR "out\\log.txt", "w");
  logf_("fnharness loaded");
  AddVectoredExceptionHandler(1, veh);
  for (;;) {
    HMODULE m = GetModuleHandleA("D2Game.dll");
    HMODULE c = GetModuleHandleA("D2Common.dll");
    if (m && c) {
      g_d2game = m;
      g_d2common = c;
      break;
    }
    Sleep(1);
  }
  g_game_pref = pref_base(g_d2game);
  g_common_pref = pref_base(g_d2common);
  g_frame_fn = (void *)G(0x6FC4E050);
  int net_ok = install_net_hook();
  int ok = patch_call(G(0x6FC4E2DB), frame_stub, (uintptr_t)g_frame_fn) +
           patch_call(G(0x6FC72712), frame_stub, (uintptr_t)g_frame_fn);
  logf_("D2Game %p (pref %p) D2Common %p (pref %p): %d/2 frame hooks, net_hook=%d", (void *)g_d2game,
        (void *)g_game_pref, (void *)g_d2common, (void *)g_common_pref, ok, net_ok);
  for (;;) {
    Sleep(5000);
    logf_("frames=%ld", g_frames);
  }
  return 0;
}

BOOL WINAPI DllMain(HINSTANCE h, DWORD reason, LPVOID r) {
  (void)r;
  if (reason == DLL_PROCESS_ATTACH) {
    DisableThreadLibraryCalls(h);
    CreateThread(NULL, 0, oracle_thread, NULL, 0, NULL);
  }
  return TRUE;
}
