import { skillModule as s0 } from "./skill-000-attack.ts"
import { skillModule as s1 } from "./skill-001-kick.ts"
import { skillModule as s2 } from "./skill-002-throw.ts"
import { skillModule as s3 } from "./skill-003-unsummon.ts"
import { skillModule as s4 } from "./skill-004-left-hand-throw.ts"
import { skillModule as s5 } from "./skill-005-left-hand-swing.ts"
import { skillModule as s6 } from "./skill-217-scroll-of-identify.ts"
import { skillModule as s7 } from "./skill-218-book-of-identify.ts"
import { skillModule as s8 } from "./skill-219-scroll-of-townportal.ts"
import { skillModule as s9 } from "./skill-220-book-of-townportal.ts"
import { skillModule as s10 } from "./skill-350-delerium-change.ts"

export const SKILL_MODULES = {
  "./impl/uni/skill-000-attack.ts": { skillModule: s0 },
  "./impl/uni/skill-001-kick.ts": { skillModule: s1 },
  "./impl/uni/skill-002-throw.ts": { skillModule: s2 },
  "./impl/uni/skill-003-unsummon.ts": { skillModule: s3 },
  "./impl/uni/skill-004-left-hand-throw.ts": { skillModule: s4 },
  "./impl/uni/skill-005-left-hand-swing.ts": { skillModule: s5 },
  "./impl/uni/skill-217-scroll-of-identify.ts": { skillModule: s6 },
  "./impl/uni/skill-218-book-of-identify.ts": { skillModule: s7 },
  "./impl/uni/skill-219-scroll-of-townportal.ts": { skillModule: s8 },
  "./impl/uni/skill-220-book-of-townportal.ts": { skillModule: s9 },
  "./impl/uni/skill-350-delerium-change.ts": { skillModule: s10 },
} as const
