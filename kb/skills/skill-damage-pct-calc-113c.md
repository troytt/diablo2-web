# Skill weapon-damage % calc column (1.13c)

`SrcDam` attack skills add "+X% damage" to the weapon strike through `D2DamageStrc+0x0C`
(`dwEnDmgPct`, filled before `SUNITDMG_RollDamage` `0x6FCBF210`) or, for thrown missiles, the
`damagepercent` stat (#25) on the missile. **Which `Skills.txt` calc column supplies that value is
decided by each srvstfunc/srvdofunc**, not by a global "calc1 = damage%" rule.

Skill record (`0x23C` bytes) calc offsets: `calc1 +0x138`, `calc2 +0x13C`, `calc3 +0x140`,
`calc4 +0x144`; evaluated through `0x6FC2AC9A` (D2Common skill calc import).
Tables in `samples/d2/D2Game.dll`: `g_apfnSkillSrvStFunc` `0x6FD27338`, `g_apfnSkillSrvDoFunc` `0x6FD274A8`.

## calc2 -> damage %

| func | VA | evidence |
|---|---|---|
| SrvDo012 Strafe (26) | `0x6FC6DCD0` | `mov edx,[ebp+0x13C]` @ `0x6FC6DE0B` -> eval -> per-arrow damage % |
| SrvDo013 Fend/Zeal/Fury (30/106/248) | `0x6FC6DAC0` | `mov edx,[ebp+0x13C]` @ `0x6FC6DBC7` -> `dwEnDmgPct` |

## calc1 -> damage %

| func | VA | skills |
|---|---|---|
| SrvSt006 | `0x6FC6C720` | Power Strike (14) |
| SrvSt007 | `0x6FC6CC50` | Impale (19) — calc1 passed to `0x6FCFC530` (eax) -> `dwEnDmgPct` |
| SrvSt016 | `0x6FC6F7D0` | Poison Dagger (73) |
| SrvSt029 | `0x6FCB8E90` | Sacrifice (96) |
| SrvSt032 | `0x6FC473C0` | Conversion (116), Bash (126), Stun (139), Concentrate (144), BearSmite (326); SrvDo070 Double Swing (133) reuses this body |
| SrvSt039 | `0x6FC489A0` | Berserk (152) |
| SrvSt056 | `0x6FC64D70` | Feral Rage (232), Maul (233) |
| SrvSt058 | `0x6FC64ED0` | Fire Claws (239) |
| SrvDo007 | `0x6FC6CB00` | Jab (10) |
| SrvDo009 | `0x6FC49600` -> `0x6FC47A10` | Frenzy (147) |
| SrvDo010 | `0x6FC6D270` | Guided Arrow (22) |
| SrvDo046 | `0x6FCB3270` -> `0x6FCB2A60` | Dragon Claw (260) |
| SrvDo067 | `0x6FCB9D20` | Charge (107) |
| SrvDo074 | `0x6FC47E30` | Double Throw (140) — `SetStat(missile, 25 damagepercent, calc1)` |
| SrvDo076 | `0x6FC48BE0` | Whirlwind (151) |
| SrvDo078 | `0x6FC493B0` -> `0x6FC47820` | Leap Attack (143) |
| SrvDo122 | `0x6FC65000` | Hunger (242) — `mov ecx,[ebx+0x138]` @ `0x6FC65114` -> `dwPhysDamage += dwPhysDamage * calc1 / 100` (`par5 = -75`) |

Note: SrvSt032 really uses Conversion's calc1 (`dm34`, "chance to convert") as the strike's
damage % in 1.13c (`mov eax,[ebx+0x138]` @ `0x6FC474BD` -> `dwEnDmgPct`), and SrvDo079 (`0x6FCB9830`)
then consumes that pre-rolled `D2DamageStrc` and rolls `rand(100) < calc1` in `0x6FCB88B0`.

## No calc damage %

- SrvDo008 Multiple Shot `0x6FC6D420`: calc1 = missile count, calc2 = activation frame, calc3 read for spread.
- SrvSt004 arrows/bolts with no damage srvdofunc (Immolation Arrow 27 calc1 = fire-disc radius,
  Freezing Arrow 31 calc1 = damage radius, Lightning Fury 35 calc1 = targets, MonFreezingArrow 343).
- SrvSt035 Vengeance `0x6FCB8BA0`: `0x6FCFC530` is called with skill% = 0 (`xor eax,eax` @ `0x6FCB8C69`);
  calc1/calc2/calc3 are fire/cold/lightning % of the rolled weapon damage.
- SrvDo034 (Tiger/Cobra/Phoenix Strike) and SrvDo035 (Fists of Fire/Claws of Thunder/Blades of Ice):
  no calc read on the charging hit.
- SrvDo044 (`0x6FCB6310` Blade Sentinel), SrvDo048 (`0x6FCB5560` Blade Fury), SrvDo054 (`0x6FCB35F0`
  Blade Shield), SrvDo116 (`0x6FC66210` Werewolf/Werebear): calc columns empty, no calc1..4 read.

Implemented in `src/server/skills/registry.ts` `resolveSkillDamagePctCalc`; pinned by
`tests/skills/skill-damage-pct-calc-1418.test.ts`.
