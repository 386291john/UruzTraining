import fc from 'fast-check'

export interface GeneratedPlan {
  allowedDays: number | null
  vigencyWeeks: number
}

/**
 * Generates a plan with:
 * - allowedDays: integer 1-365 or null (unlimited)
 * - vigencyWeeks: integer 1-52
 */
export function arbitraryPlan(): fc.Arbitrary<GeneratedPlan> {
  const allowedDaysArb = fc.oneof(
    fc.integer({ min: 1, max: 365 }),
    fc.constant(null as null)
  )

  return fc.record({
    allowedDays: allowedDaysArb,
    vigencyWeeks: fc.integer({ min: 1, max: 52 }),
  })
}

/**
 * Generates only the vigencyWeeks portion (1-52).
 */
export function arbitraryVigencyWeeks(): fc.Arbitrary<number> {
  return fc.integer({ min: 1, max: 52 })
}
