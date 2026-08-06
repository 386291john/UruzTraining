import fc from 'fast-check'

/**
 * Membership generator for property-based testing of dual expiration logic.
 *
 * Generates memberships with various combinations of remaining_days and expiration_date
 * to test the dual expiration behavior:
 * - Limited plans (remaining_days != null): invalid if days=0 OR date > expiration
 * - Unlimited plans (remaining_days = null): invalid only if date > expiration
 */

export interface GeneratedMembership {
  remaining_days: number | null
  expiration_date: Date
  status: 'active' | 'expired' | 'renewed'
}

/**
 * Generates a membership with limited days (remaining_days is a non-negative integer).
 * Covers edge cases: 0 days, 1 day, and larger values.
 */
export function arbitraryLimitedMembership(): fc.Arbitrary<GeneratedMembership> {
  return fc.record({
    remaining_days: fc.integer({ min: 0, max: 365 }),
    expiration_date: fc
      .date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) })
      .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())),
    status: fc.constant('active' as const),
  })
}

/**
 * Generates a membership with unlimited days (remaining_days = null).
 */
export function arbitraryUnlimitedMembership(): fc.Arbitrary<GeneratedMembership> {
  return fc.record({
    remaining_days: fc.constant(null as null),
    expiration_date: fc
      .date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) })
      .map((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())),
    status: fc.constant('active' as const),
  })
}

/**
 * Generates any membership (limited or unlimited).
 */
export function arbitraryMembership(): fc.Arbitrary<GeneratedMembership> {
  return fc.oneof(arbitraryLimitedMembership(), arbitraryUnlimitedMembership())
}

/**
 * Generates a "current date" (now) relative to a membership's expiration_date.
 * Can be before, on, or after the expiration date.
 *
 * @param expirationDate - The membership's expiration date
 * @returns Arbitrary Date that may be before, on, or after the expiration
 */
export function arbitraryCurrentDateRelativeToExpiration(
  expirationDate: Date
): fc.Arbitrary<Date> {
  // Generate offset from -30 days (before) to +30 days (after) the expiration
  return fc.integer({ min: -30, max: 30 }).map((offset) => {
    const d = new Date(expirationDate)
    d.setDate(d.getDate() + offset)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  })
}

/**
 * Generates a limited membership that has expired by time but still has remaining days.
 * This is specifically for testing the days_lost scenario.
 */
export function arbitraryTimeExpiredWithDaysRemaining(): fc.Arbitrary<{
  membership: GeneratedMembership
  currentDate: Date
}> {
  return fc
    .tuple(
      fc.integer({ min: 1, max: 365 }),
      // Use integer timestamps to avoid Date(NaN) issues
      fc.integer({
        min: new Date(2020, 0, 1).getTime(),
        max: new Date(2028, 11, 31).getTime(),
      }),
      fc.integer({ min: 1, max: 60 })
    )
    .map(([remaining_days, expirationTs, daysAfter]) => {
      const expDate = new Date(expirationTs)
      const expirationDate = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate())

      // Calculate current date as days after expiration using millisecond arithmetic
      const currentDateTs = expirationDate.getTime() + daysAfter * 24 * 60 * 60 * 1000
      const curDate = new Date(currentDateTs)
      const currentDate = new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate())

      return {
        membership: {
          remaining_days,
          expiration_date: expirationDate,
          status: 'active' as const,
        },
        currentDate,
      }
    })
}
