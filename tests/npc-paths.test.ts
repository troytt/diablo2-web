import { test, expect } from 'vitest'
import { objectCofMember, objectSpriteMember } from '../src/common/units/objects.ts'

test('ordinary object art paths are unchanged (non-:m)', () => {
  expect(objectCofMember('D1', 0, false)).toBe('data\\global\\objects\\d1\\cof\\d1nuhth.cof')
  expect(objectSpriteMember('D1', 'TR', 0, false)).toBe('data\\global\\objects\\d1\\tr\\d1trlitnuhth.dcc')
  
  // Also verify that omission (default) preserves the old path
  expect(objectCofMember('D1', 0)).toBe('data\\global\\objects\\d1\\cof\\d1nuhth.cof')
  expect(objectSpriteMember('D1', 'TR', 0)).toBe('data\\global\\objects\\d1\\tr\\d1trlitnuhth.dcc')
})

test('NPC art paths resolve to monsters/ directory (:m)', () => {
  expect(objectCofMember('DC', 0, true)).toBe('data\\global\\monsters\\dc\\cof\\dcnuhth.cof')
  expect(objectSpriteMember('DC', 'TR', 0, true)).toBe('data\\global\\monsters\\dc\\tr\\dctrlitnuhth.dcc')
})
