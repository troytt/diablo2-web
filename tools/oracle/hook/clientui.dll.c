/*
 * clientui.dll — client display-value oracle for original Diablo II 1.13c.
 *
 * Reuses the d2oracle frame-hook technique (GAME_UpdateGameFrame call sites
 * D2Game 0x6FC4E2DB / 0x6FC72712). In single player D2Client drives the
 * server from its own loop (D2Client 0x6FAF31ED / 0x6FAF4D00 call D2Game
 * #10008), so the hook runs on the client thread and may call D2Client code.
 *
 * Once the D2Client local player (D2Client global 0x6FBCBBFC, read by
 * UI_DrawCharSheet 0x6FB6CEA6) exists and the game has settled, it:
 *   - samples the client player's stat list (D2Common #10973 / #10587),
 *   - calls the D2Client / D2Common functions the character sheet uses for
 *     its computed values (defense, block, attack rating, hit chance, next
 *     level experience, displayed resistances),
 *   - calls the original draw functions (UI_DrawCharSheet 0x6FB6CEA0, the
 *     per-skill attack/damage block 0x6FADFD30, the skill tree tooltip
 *     builders 0x6FAE3B50 / 0x6FAE3550) with the D2Win text-draw imports
 *     redirected to recorders and the D2gfx draw imports to no-ops, so the
 *     exact strings the original displays are captured (no OCR),
 * writes C:\oracle\out\ui.ndjson and touches C:\oracle\out\done.
 *
 * Every address is a 1.13c preferred-base VA, rebased at runtime. Evidence:
 * kb/ui/oracle-client-display-113c.md.
 */
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#define ORACLE_DIR "C:\\oracle\\"

static FILE *g_log, *g_out;
static HMODULE g_d2game, g_d2common, g_d2client;
static uintptr_t g_game_pref, g_common_pref, g_client_pref;
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
static uintptr_t K(uintptr_t va) { return va - g_client_pref + (uintptr_t)g_d2client; }

#define RD32(p, o) (*(uint32_t *)((uint8_t *)(p) + (o)))

/* ------------------------------------------------------------ safe call */
/* Same fault-recovering generic call as fnharness.dll.c: up to 8 stack args
 * (pushed right-to-left) plus the six general registers; esp restored from
 * g_sc_esp so stdcall/cdecl/fastcall callees all work. */
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
    logf_("fault %08lx at %p", code, ep->ExceptionRecord->ExceptionAddress);
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

/* ------------------------------------------------------------ addresses */
/* D2Client (preferred base 0x6FAB0000). */
#define K_PLAYER 0x6FBCBBFC      /* client local player (UI_DrawCharSheet 0x6FB6CEA6) */
#define K_DIFF 0x6FBCC390        /* byte: client difficulty (0x6FB6D811 -> #10237) */
#define K_EXPANSION 0x6FBC9854   /* dword: expansion game (0x6FB6D8F5, 0x6FB6C7F0) */
#define K_MON_HIT 0x6FBA2188     /* MonStats row used by the AR hover (0x6FB6CBE0) */
#define K_MON_DEF 0x6FBA218C     /* MonStats row used by the defense hover (0x6FB6C57A) */
#define K_DRAWCHARSHEET 0x6FB6CEA0 /* UI_DrawCharSheet, no args */
#define K_SKILLAR 0x6FADE350     /* stdcall(unit, bRight) -> attack rating (descatt) */
#define K_HITPCT 0x6FB6CB90      /* stdcall(ar) -> hit chance vs K_MON_HIT row, 5..95 */
#define K_MONHITPCT 0x6FB6C520   /* () -> chance K_MON_DEF row hits the player */
#define K_WEAPONBLOCK 0x6FB6C430 /* eax=unit -> weapon block (no shield) */
#define K_SKILLBLOCK 0x6FADFD30  /* stdcall(unit, pSkill, slot): name + AR + damage */
#define K_TIP_LEVEL 0x6FAE3B50   /* ecx=skill; stdcall(unit, lvl, 0, x, y) */
#define K_TIP_NOLEVEL 0x6FAE3550 /* stdcall(unit, skill, lvl, 0, x, y) */
/* D2Client IAT slots. */
#define IAT_DRAWTEXT 0x6FB7EBC4  /* D2Win #10150 fastcall(text, x | y, color, flag) */
#define IAT_FRAMED 0x6FB7EBC8    /* D2Win #10085 fastcall(text, x | y, color, flag) */
#define IAT_TEXTEX 0x6FB7EBA4    /* D2Win #10013 fastcall(text, x | y, a, b, c) */
#define IAT_SETFONT 0x6FB7EBA8   /* D2Win #10184 fastcall(font) -> old font */
#define IAT_GFX41 0x6FB7EBF4     /* D2gfx #10041 stdcall 6 args (cel draw) */
#define IAT_GFX14 0x6FB7EC2C     /* D2gfx #10014 stdcall 6 args (rect draw) */
/* D2Common (preferred base 0x6FD50000). */
#define C_GETSTAT 0x6FD88B70     /* #10973 (unit, stat, layer) accrued */
#define C_GETBASE 0x6FD88C20     /* #10587 (unit, stat, layer) base */
#define C_DEFENSE 0x6FD82890     /* #10672 (unit) */
#define C_BLOCK 0x6FD81D20       /* #10212 (unit, bExpansion) */
#define C_EXPTHRESH 0x6FDAE810   /* #10399 (class, level) */
#define C_MAXLEVEL 0x6FDAE7E0    /* #10066 (class) */
#define C_DIFFREC 0x6FDB03C0     /* #10237 (difficulty) -> DifficultyLevels row */
#define C_DATATABLES 0x6FDE9E1C  /* sgptDataTables */

/* ------------------------------------------------------------ recorders */
#define MAXREC 512
typedef struct {
  int fn, x, y, color, font;
  char text[512];
} TextRec;
static TextRec g_rec[MAXREC];
static int g_nrec;
static int g_font = -1;
static uintptr_t g_real_setfont;

static void rec_add(int fn, const uint16_t *w, int x, int y, int color) {
  if (g_nrec >= MAXREC || !w) return;
  TextRec *r = &g_rec[g_nrec++];
  r->fn = fn;
  r->x = x;
  r->y = y;
  r->color = color;
  r->font = g_font;
  int n = WideCharToMultiByte(CP_UTF8, 0, (const wchar_t *)w, -1, r->text, sizeof r->text - 1, NULL, NULL);
  r->text[n > 0 ? n - 1 : 0] = 0;
}

static void __fastcall rec_drawtext(const uint16_t *s, int x, int y, int color, int flag) {
  (void)flag;
  rec_add(10150, s, x, y, color);
}
static void __fastcall rec_framed(const uint16_t *s, int x, int y, int color, int flag) {
  (void)flag;
  rec_add(10085, s, x, y, color);
}
static void __fastcall rec_textex(const uint16_t *s, int x, int y, int a, int b, int c) {
  (void)b;
  (void)c;
  rec_add(10013, s, x, y, a);
}
typedef int(__fastcall *SetFont_t)(int);
static int __fastcall rec_setfont(int font) {
  g_font = font;
  return ((SetFont_t)g_real_setfont)(font);
}
static int __stdcall nop6(int a, int b, int c, int d, int e, int f) {
  (void)a; (void)b; (void)c; (void)d; (void)e; (void)f;
  return 0;
}

typedef struct {
  uintptr_t slot;
  void *hook;
  uintptr_t saved;
} IatHook;
static IatHook g_hooks[] = {
    {IAT_DRAWTEXT, (void *)rec_drawtext, 0}, {IAT_FRAMED, (void *)rec_framed, 0},
    {IAT_TEXTEX, (void *)rec_textex, 0},     {IAT_SETFONT, (void *)rec_setfont, 0},
    {IAT_GFX41, (void *)nop6, 0},            {IAT_GFX14, (void *)nop6, 0},
};
#define NHOOKS (int)(sizeof g_hooks / sizeof g_hooks[0])

static void iat_set(uintptr_t slot, uintptr_t v) {
  DWORD old;
  VirtualProtect((void *)slot, 4, PAGE_READWRITE, &old);
  *(uintptr_t *)slot = v;
  VirtualProtect((void *)slot, 4, old, &old);
}
static void capture_begin(void) {
  g_nrec = 0;
  for (int i = 0; i < NHOOKS; i++) {
    uintptr_t s = K(g_hooks[i].slot);
    g_hooks[i].saved = *(uintptr_t *)s;
    if (g_hooks[i].slot == IAT_SETFONT) g_real_setfont = g_hooks[i].saved;
    iat_set(s, (uintptr_t)g_hooks[i].hook);
  }
}
static void capture_end(void) {
  for (int i = 0; i < NHOOKS; i++) iat_set(K(g_hooks[i].slot), g_hooks[i].saved);
}

/* ------------------------------------------------------------ output */
static void jstr(const char *s) {
  fputc('"', g_out);
  for (const unsigned char *p = (const unsigned char *)s; *p; p++) {
    if (*p == '"' || *p == '\\') {
      fputc('\\', g_out);
      fputc(*p, g_out);
    } else if (*p == '\n') {
      fputs("\\n", g_out);
    } else if (*p < 0x20) {
      fprintf(g_out, "\\u%04x", *p);
    } else {
      fputc(*p, g_out);
    }
  }
  fputc('"', g_out);
}
static void emit_texts(void) {
  fputs(",\"texts\":[", g_out);
  for (int i = 0; i < g_nrec; i++) {
    TextRec *r = &g_rec[i];
    fprintf(g_out, "%s[%d,%d,%d,%d,%d,", i ? "," : "", r->fn, r->x, r->y, r->color, r->font);
    jstr(r->text);
    fputc(']', g_out);
  }
  fputc(']', g_out);
}

/* ------------------------------------------------------------ helpers */
static uint8_t *g_pl;

static int32_t stat(int op, int id) {
  uint32_t a[3] = {(uint32_t)(uintptr_t)g_pl, (uint32_t)id, 0}, r = 0;
  if (sc(C(op ? C_GETBASE : C_GETSTAT), 3, a, &r)) return INT32_MIN;
  return (int32_t)r;
}
static int32_t call1(uintptr_t fn, uint32_t a0, int *fault) {
  uint32_t a[1] = {a0}, r = 0;
  *fault |= sc(fn, 1, a, &r);
  return (int32_t)r;
}
static int32_t call2(uintptr_t fn, uint32_t a0, uint32_t a1, int *fault) {
  uint32_t a[2] = {a0, a1}, r = 0;
  *fault |= sc(fn, 2, a, &r);
  return (int32_t)r;
}

/* Skill list: unit+0xA8 pSkills; +0x04 first, +0x08 left (#10828 0x6FD80460),
 * +0x0C right (#10507 0x6FD80420); skill +0x00 pSkillsTxt (word id), +0x04 next. */
static uint8_t *skills_list(void) { return (uint8_t *)(uintptr_t)RD32(g_pl, 0xA8); }
static int skill_id(uint8_t *s) {
  uint8_t *txt = s ? (uint8_t *)(uintptr_t)RD32(s, 0) : NULL;
  return txt ? *(int16_t *)txt : -1;
}
/* D2Common #10306 (D2Client thunk 0x6FABC718): stdcall(unit, pSkill, bTotal) -> level. */
static uintptr_t g_skilllevel_fn;
static int skill_level(uint8_t *s, int total) {
  uint32_t a[3] = {(uint32_t)(uintptr_t)g_pl, (uint32_t)(uintptr_t)s, (uint32_t)total}, r = 0;
  if (sc(g_skilllevel_fn, 3, a, &r)) return -1;
  return (int)r;
}

static int mon_row_ok(uint32_t idx) {
  uint8_t *dt = *(uint8_t **)C(C_DATATABLES);
  return dt && idx < RD32(dt, 0xA80);
}

/* ------------------------------------------------------------ capture */
static void dump_all(uint8_t *game) {
  int f = 0;
  uint8_t diff = *(uint8_t *)K(K_DIFF);
  uint32_t exp = RD32(K(K_EXPANSION), 0);
  uint32_t monHit = RD32(K(K_MON_HIT), 0), monDef = RD32(K(K_MON_DEF), 0);
  HWND h = FindWindowA("Diablo II", NULL);
  DWORD wtid = h ? GetWindowThreadProcessId(h, NULL) : 0;
  fprintf(g_out,
          "{\"kind\":\"meta\",\"frame\":%u,\"hookTid\":%lu,\"windowTid\":%lu,\"player\":%u,"
          "\"class\":%u,\"difficulty\":%u,\"expansion\":%u,\"monHitRow\":%d,\"monDefRow\":%d,"
          "\"mode\":%u}\n",
          RD32(game, 0xA8), GetCurrentThreadId(), wtid, RD32(g_pl, 0x0C), RD32(g_pl, 4), diff, exp,
          (int)monHit, (int)monDef, RD32(g_pl, 0x10));

  /* Client stat list (what the client knows from S2C), non-zero ids. */
  fputs("{\"kind\":\"stats\",\"accrued\":{", g_out);
  int first = 1;
  for (int id = 0; id < 359; id++) {
    int32_t v = stat(0, id);
    if (v == 0) continue;
    fprintf(g_out, "%s\"%d\":%ld", first ? "" : ",", id, (long)v);
    first = 0;
  }
  fputs("},\"base\":{", g_out);
  first = 1;
  for (int id = 0; id < 359; id++) {
    int32_t v = stat(1, id);
    if (v == 0) continue;
    fprintf(g_out, "%s\"%d\":%ld", first ? "" : ",", id, (long)v);
    first = 0;
  }
  fputs("}}\n", g_out);

  /* Computed char-sheet values (function VA per field in the KB doc). */
  uint32_t P = (uint32_t)(uintptr_t)g_pl;
  int32_t cls = (int32_t)RD32(g_pl, 4);
  int32_t level = stat(0, 12);
  int32_t defense = call1(C(C_DEFENSE), P, &f);
  int32_t block = call2(C(C_BLOCK), P, exp, &f);
  int32_t wblock = 0;
  {
    uint32_t r = 0;
    g_sc_eax = P;
    f |= sc(K(K_WEAPONBLOCK), 0, NULL, &r);
    wblock = (int32_t)r;
  }
  /* 0x6FADE350(unit, sel): sel != 0 -> D2Common #10828 (pSkills+0x08, left),
   * sel == 0 -> #10507 (pSkills+0x0C, right); see 0x6FADE36D..0x6FADE376. */
  int32_t arLeft = call2(K(K_SKILLAR), P, 1, &f);
  int32_t arRight = call2(K(K_SKILLAR), P, 0, &f);
  int32_t hitLeft = -1, hitRight = -1, monHitPct = -1;
  if (diff < 3 && mon_row_ok(monHit)) {
    hitLeft = call1(K(K_HITPCT), (uint32_t)arLeft, &f);
    hitRight = call1(K(K_HITPCT), (uint32_t)arRight, &f);
  }
  if (diff < 3 && mon_row_ok(monDef)) {
    uint32_t r = 0;
    f |= sc(K(K_MONHITPCT), 0, NULL, &r);
    monHitPct = (int32_t)r;
  }
  int32_t maxLevel = call1(C(C_MAXLEVEL), (uint32_t)cls, &f);
  int32_t nextExp = level == maxLevel ? -1 : call2(C(C_EXPTHRESH), (uint32_t)cls, (uint32_t)level, &f);
  /* Resistance penalty exactly as UI_DrawCharSheet 0x6FB6D8F5..0x6FB6D91C:
   * expansion -> DifficultyLevels.ResistPenalty ([#10237(diff)+0]); classic ->
   * -20 (nightmare) / -50 (hell). Max = min(75 + max-stat, 95); clamp -100. */
  int32_t penalty = 0;
  if (exp) {
    int32_t rec = call1(C(C_DIFFREC), diff, &f);
    if (rec) penalty = *(int32_t *)(uintptr_t)rec;
  } else {
    penalty = diff == 1 ? -20 : diff == 2 ? -50 : 0;
  }
  static const int resIds[4][2] = {{39, 40}, {43, 44}, {41, 42}, {45, 46}};
  static const char *resNames[4] = {"fire", "cold", "light", "poison"};
  fprintf(g_out,
          "{\"kind\":\"calc\",\"level\":%ld,\"maxLevel\":%ld,\"nextExp\":%ld,\"defense\":%ld,"
          "\"block\":%ld,\"weaponBlock\":%ld,\"arLeft\":%ld,\"arRight\":%ld,\"hitLeft\":%ld,"
          "\"hitRight\":%ld,\"monHitPct\":%ld,\"resPenalty\":%ld",
          (long)level, (long)maxLevel, (long)nextExp, (long)defense, (long)block, (long)wblock,
          (long)arLeft, (long)arRight, (long)hitLeft, (long)hitRight, (long)monHitPct, (long)penalty);
  for (int i = 0; i < 4; i++) {
    int32_t raw = stat(0, resIds[i][0]), mx = stat(0, resIds[i][1]);
    int32_t cap = mx + 75 < 95 ? mx + 75 : 95;
    int32_t v = raw + penalty;
    if (v < -100) v = -100;
    if (v > cap) v = cap;
    fprintf(g_out, ",\"%s\":{\"raw\":%ld,\"maxStat\":%ld,\"cap\":%ld,\"shown\":%ld}", resNames[i], (long)raw,
            (long)mx, (long)cap, (long)v);
  }
  uint8_t *sl = skills_list();
  uint8_t *sLeft = sl ? (uint8_t *)(uintptr_t)RD32(sl, 8) : NULL;
  uint8_t *sRight = sl ? (uint8_t *)(uintptr_t)RD32(sl, 0xC) : NULL;
  fprintf(g_out, ",\"leftSkill\":%d,\"rightSkill\":%d,\"fault\":%d}\n", skill_id(sLeft), skill_id(sRight), f);
  fflush(g_out);

  /* Full character sheet, as drawn. */
  uint32_t ign = 0;
  capture_begin();
  int cf = sc(K(K_DRAWCHARSHEET), 0, NULL, &ign);
  capture_end();
  fprintf(g_out, "{\"kind\":\"charsheet\",\"fault\":%d", cf);
  emit_texts();
  fputs("}\n", g_out);
  fflush(g_out);

  /* Per owned skill: char-sheet attack block (0x6FADFD30 with layout slot 0,
   * the top / left-hand block; UI_DrawCharSheet passes #10828 = left there)
   * and the attack rating with that skill placed on the left hand
   * (0x6FADE350(unit, 1) reads pSkills+0x08), then the skill tree tooltip. */
  for (uint8_t *s = sl ? (uint8_t *)(uintptr_t)RD32(sl, 4) : NULL; s; s = (uint8_t *)(uintptr_t)RD32(s, 4)) {
    int id = skill_id(s);
    int hard = skill_level(s, 0), total = skill_level(s, 1);
    int ff = 0;
    RD32(sl, 8) = (uint32_t)(uintptr_t)s;
    int32_t ar = call2(K(K_SKILLAR), P, 1, &ff);
    capture_begin();
    uint32_t a3[3] = {P, (uint32_t)(uintptr_t)s, 0};
    ff |= sc(K(K_SKILLBLOCK), 3, a3, &ign) << 1;
    capture_end();
    RD32(sl, 8) = (uint32_t)(uintptr_t)sLeft;
    fprintf(g_out, "{\"kind\":\"skill\",\"skill\":%d,\"hard\":%d,\"total\":%d,\"ar\":%ld,\"fault\":%d", id, hard,
            total, (long)ar, ff);
    emit_texts();
    fputs("}\n", g_out);

    capture_begin();
    int tf;
    const char *builder;
    if (total > 0) {
      uint32_t a5[5] = {P, (uint32_t)total, 0, 400, 300};
      g_sc_ecx = (uint32_t)id;
      tf = sc(K(K_TIP_LEVEL), 5, a5, &ign);
      builder = "0x6FAE3B50";
    } else {
      uint32_t a6[6] = {P, (uint32_t)id, (uint32_t)total, 0, 400, 300};
      tf = sc(K(K_TIP_NOLEVEL), 6, a6, &ign);
      builder = "0x6FAE3550";
    }
    capture_end();
    fprintf(g_out, "{\"kind\":\"tooltip\",\"skill\":%d,\"hard\":%d,\"total\":%d,\"builder\":\"%s\",\"fault\":%d", id,
            hard, total, builder, tf);
    emit_texts();
    fputs("}\n", g_out);
    fflush(g_out);
  }
}

/* ------------------------------------------------------------ frame */
/* ------------------------------------------------------------ inputs */
/* Scenario inputs, copied from d2oracle.c (same C:\oracle\scenario.txt "in F
 * hex" lines): C2S dispatcher D2Game 0x6FCEC550, ebx = packet, esi = player
 * unit, stack pGame, nSize (callee pops 8); an input tagged F is delivered
 * before GAME_UpdateGameFrame while dwGameFrame == F-1. */
void *g_c2s_dispatch;
void *g_cd_game, *g_cd_player, *g_cd_pkt; /* referenced from asm */
uint32_t g_cd_len, g_cd_ret;

typedef struct {
  uint32_t frame;
  uint32_t len;
  uint8_t data[64];
} Input;
static Input g_inputs[1024];
static int g_ninputs, g_next_input, g_ninjected;

/* "capture F LABEL": dump the display values at the end of game frame F.
 * Without capture lines: one dump 75 frames (settle) after the client player
 * appears, labelled "town". */
typedef struct {
  uint32_t frame;
  char label[32];
} Capture;
static Capture g_caps[16];
static int g_ncaps, g_next_cap;

static uint32_t c2s_dispatch(void *game, void *player, uint8_t *pkt, uint32_t len) {
  g_cd_game = game;
  g_cd_player = player;
  g_cd_pkt = pkt;
  g_cd_len = len;
  __asm__ volatile(
      "pushal\n\t"
      "mov _g_cd_pkt, %%ebx\n\t"
      "mov _g_cd_player, %%esi\n\t"
      "push _g_cd_len\n\t"
      "push _g_cd_game\n\t"
      "call *_g_c2s_dispatch\n\t"
      "mov %%eax, _g_cd_ret\n\t"
      "popal\n\t" ::: "memory");
  return g_cd_ret;
}

static void load_scenario(void) {
  FILE *f = fopen(ORACLE_DIR "scenario.txt", "r");
  if (!f) return;
  char line[512];
  while (fgets(line, sizeof line, f)) {
    char hex[256];
    unsigned fr;
    if (sscanf(line, "in %u %255s", &fr, hex) == 2 && g_ninputs < 1024) {
      Input *in = &g_inputs[g_ninputs];
      in->frame = fr;
      in->len = 0;
      for (char *h = hex; h[0] && h[1] && in->len < 64; h += 2) {
        unsigned b;
        sscanf(h, "%2x", &b);
        in->data[in->len++] = (uint8_t)b;
      }
      g_ninputs++;
    } else if (g_ncaps < 16 && sscanf(line, "capture %u %31s", &fr, g_caps[g_ncaps].label) == 2) {
      g_caps[g_ncaps++].frame = fr;
    }
  }
  fclose(f);
  logf_("scenario: %d inputs, %d captures", g_ninputs, g_ncaps);
}

static uint8_t *server_player(uint8_t *game) {
  for (int b = 0; b < 128; b++) {
    uint8_t *u = (uint8_t *)(uintptr_t)RD32(game, 0x1120 + b * 4);
    if (u) return u;
  }
  return NULL;
}

void __cdecl on_pre_frame(uint8_t *game) {
  uint32_t next = RD32(game, 0xA8) + 1;
  while (g_next_input < g_ninputs && g_inputs[g_next_input].frame <= next) {
    Input *in = &g_inputs[g_next_input++];
    uint8_t *pl = server_player(game);
    if (pl) {
      c2s_dispatch(game, pl, in->data, in->len);
      g_ninjected++;
    }
  }
}

/* ------------------------------------------------------------ frame */
static uint32_t g_ready_frame;
static int g_done;
static int g_settle = 75;

static void finish(void) {
  g_done = 1;
  if (g_out) fclose(g_out);
  g_out = NULL;
  FILE *d = fopen(ORACLE_DIR "out\\done", "w");
  if (d) fclose(d);
}

static void capture(uint8_t *game, uint8_t *pl, const char *label) {
  g_pl = pl;
  if (!g_out) g_out = fopen(ORACLE_DIR "out\\ui.ndjson", "wb");
  if (!g_out) return;
  fprintf(g_out, "{\"kind\":\"capture\",\"label\":\"%s\",\"frame\":%u,\"inputs\":%d}\n", label, RD32(game, 0xA8),
          g_ninjected);
  dump_all(game);
  fflush(g_out);
  logf_("capture %s at frame %u", label, RD32(game, 0xA8));
}

void __cdecl on_frame(uint8_t *game) {
  InterlockedIncrement(&g_frames);
  if (g_done) return;
  uint8_t *pl = (uint8_t *)(uintptr_t)RD32(K(K_PLAYER), 0);
  if (!pl) return;
  uint32_t fr = RD32(game, 0xA8);
  if (g_ncaps) {
    while (g_next_cap < g_ncaps && fr >= g_caps[g_next_cap].frame) {
      capture(game, pl, g_caps[g_next_cap].label);
      g_next_cap++;
    }
    if (g_next_cap >= g_ncaps) finish();
    return;
  }
  if (!g_ready_frame) {
    g_ready_frame = fr + (uint32_t)g_settle;
    logf_("client player %p class %u at frame %u", (void *)pl, RD32(pl, 4), fr);
    return;
  }
  if (fr < g_ready_frame) return;
  capture(game, pl, "town");
  finish();
}

/* Original: eax = pGame, no stack args, caller-saved regs clobbered. */
__attribute__((naked)) static void frame_stub(void) {
  __asm__ volatile(
      "pushal\n\t"
      "push %%eax\n\t"
      "call _on_pre_frame\n\t"
      "add $4, %%esp\n\t"
      "popal\n\t"
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

static void load_settings(void) {
  FILE *f = fopen(ORACLE_DIR "clientui.txt", "r");
  if (!f) return;
  char line[128];
  while (fgets(line, sizeof line, f)) {
    int v;
    if (sscanf(line, "settle %d", &v) == 1 && v > 0) g_settle = v;
  }
  fclose(f);
}

static DWORD WINAPI oracle_thread(LPVOID unused) {
  (void)unused;
  CreateDirectoryA(ORACLE_DIR "out", NULL);
  g_log = fopen(ORACLE_DIR "out\\log.txt", "w");
  logf_("clientui loaded");
  load_settings();
  load_scenario();
  AddVectoredExceptionHandler(1, veh);
  for (;;) {
    HMODULE m = GetModuleHandleA("D2Game.dll");
    HMODULE c = GetModuleHandleA("D2Common.dll");
    HMODULE k = GetModuleHandleA("D2Client.dll");
    if (m && c && k) {
      g_d2game = m;
      g_d2common = c;
      g_d2client = k;
      break;
    }
    Sleep(1);
  }
  g_game_pref = pref_base(g_d2game);
  g_common_pref = pref_base(g_d2common);
  g_client_pref = pref_base(g_d2client);
  /* #10306 through the D2Client import slot used by 0x6FABC718. */
  g_skilllevel_fn = *(uintptr_t *)K(0x6FB7E804);
  g_frame_fn = (void *)G(0x6FC4E050);
  g_c2s_dispatch = (void *)G(0x6FCEC550);
  int ok = patch_call(G(0x6FC4E2DB), frame_stub, (uintptr_t)g_frame_fn) +
           patch_call(G(0x6FC72712), frame_stub, (uintptr_t)g_frame_fn);
  logf_("D2Game %p D2Common %p D2Client %p: %d/2 frame hooks, settle %d", (void *)g_d2game, (void *)g_d2common,
        (void *)g_d2client, ok, g_settle);
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
