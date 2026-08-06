import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { endOfDay, isAfter } from 'date-fns'
import { isExpired } from '@/services/vigency.service'
import {
  arbitraryLimitedMembership,
  arbitraryUnlimitedMembership,
  arbitraryCurrentDateRelativeToExpiration,
  arbitraryTimeExpiredWithDaysRemaining,
} from '../generators/membership.generator'

/**
 * Property 13: Expiración dual de membresía
 *
 * **Validates: Requirements 14.1, 14.2, 14.3, 14.4**
 *
 * Tests the dual expiration mechanism:
 * - Limited plans: invalid if remaining_days === 0 OR current date > expiration_date
 * - Unlimited plans: invalid only if current date > expiration_date
 * - When expired by time with days > 0, days_lost = remaining_days
 */

// --- Helper: replicate the dual validation logic as per requirements ---

/**
 * Determines if a membership is valid based on dual expiration rules.
 *
 * For LIMITED plans (remaining_days != null):
 *   Invalid if remaining_days === 0 OR isExpired(expiration_date, now)
 *   (The MORE RESTRICTIVE condition blocks access)
 *
 * For UNLIMITED plans (remaining_days === null):
 *   Invalid only if isExpired(expiration_date, now)
 */
function isMembershipValid(
  remainingDays: number | null,
  expirationDate: Date,
  now: Date
): boolean {
  const expired = isExpired(expirationDate, now)

  if (remainingDays === null) {
    // Unlimited plan: only time-based expiration matters
    return !expired
  }

  // Limited plan: both conditions matter (most restrictive blocks)
  if (remainingDays <= 0) return false
  if (expired) return false
  return true
}

/**
 * Calculates days_lost when a membership expires by time.
 * days_lost = remaining_days when the membership expires by time with days still available.
 */
function calculateDaysLost(
  remainingDays: number | null,
  expirationDate: Date,
  now: Date
): number {
  const expired = isExpired(expirationDate, now)

  if (expired && remainingDays !== null && remainingDays > 0) {
    return remainingDays
  }

  return 0
}

describe('Property 13: Expiración dual de membresía', () => {
  /**
   * LIMITED plan is invalid if remaining_days === 0, regardless of expiration date.
   * **Validates: Requirements 14.3**
   */
  it('limited plan with 0 remaining days is always invalid regardless of expiration date', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) }).map(
          (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
        ),
        fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) }).map(
          (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
        ),
        (expirationDate, now) => {
          // remaining_days = 0 → always invalid for limited plan
          const valid = isMembershipValid(0, expirationDate, now)
          expect(valid).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * LIMITED plan is invalid if current date exceeds expiration, even with days remaining.
   * **Validates: Requirements 14.1**
   */
  it('limited plan with days remaining is invalid when time-expired', () => {
    fc.assert(
      fc.property(
        arbitraryTimeExpiredWithDaysRemaining(),
        ({ membership, currentDate }) => {
          // membership has remaining_days > 0 and currentDate > expiration_date
          const valid = isMembershipValid(
            membership.remaining_days,
            membership.expiration_date,
            currentDate
          )
          expect(valid).toBe(false)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * LIMITED plan is valid when both conditions are met: days > 0 AND not time-expired.
   * **Validates: Requirements 14.3**
   */
  it('limited plan is valid only when remaining_days > 0 AND not time-expired', () => {
    fc.assert(
      fc.property(
        arbitraryLimitedMembership(),
        arbitraryCurrentDateRelativeToExpiration(new Date(2025, 5, 15)),
        (membership, now) => {
          // Use the membership's own expiration for relative date generation
          const adjustedNow = new Date(membership.expiration_date)
          adjustedNow.setDate(adjustedNow.getDate() - 5) // 5 days before expiration

          const valid = isMembershipValid(
            membership.remaining_days,
            membership.expiration_date,
            adjustedNow
          )

          const expired = isExpired(membership.expiration_date, adjustedNow)

          if (membership.remaining_days! > 0 && !expired) {
            expect(valid).toBe(true)
          } else {
            expect(valid).toBe(false)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * LIMITED plan: the MORE RESTRICTIVE condition blocks access.
   * Either days=0 OR time-expired is sufficient to block.
   * **Validates: Requirements 14.3**
   */
  it('limited plan: either zero days OR time-expired blocks access (most restrictive)', () => {
    fc.assert(
      fc.property(
        arbitraryLimitedMembership().chain((membership) =>
          arbitraryCurrentDateRelativeToExpiration(membership.expiration_date).map(
            (now) => ({ membership, now })
          )
        ),
        ({ membership, now }) => {
          const expired = isExpired(membership.expiration_date, now)
          const noDays = membership.remaining_days === 0

          const valid = isMembershipValid(
            membership.remaining_days,
            membership.expiration_date,
            now
          )

          // If either condition is true, membership must be invalid
          if (expired || noDays) {
            expect(valid).toBe(false)
          }

          // If neither condition is true (days > 0 AND not expired), must be valid
          if (!expired && !noDays) {
            expect(valid).toBe(true)
          }
        }
      ),
      { numRuns: 300 }
    )
  })

  /**
   * UNLIMITED plan is invalid ONLY when time-expired.
   * **Validates: Requirements 14.3**
   */
  it('unlimited plan is invalid only when time-expired', () => {
    fc.assert(
      fc.property(
        arbitraryUnlimitedMembership().chain((membership) =>
          arbitraryCurrentDateRelativeToExpiration(membership.expiration_date).map(
            (now) => ({ membership, now })
          )
        ),
        ({ membership, now }) => {
          const expired = isExpired(membership.expiration_date, now)
          const valid = isMembershipValid(
            membership.remaining_days,
            membership.expiration_date,
            now
          )

          if (expired) {
            expect(valid).toBe(false)
          } else {
            expect(valid).toBe(true)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * UNLIMITED plan never considers remaining_days (always null).
   * **Validates: Requirements 14.3**
   */
  it('unlimited plan validity depends solely on expiration date, not on days', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) }).map(
          (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
        ),
        fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) }).map(
          (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
        ),
        (expirationDate, now) => {
          // For unlimited plan, validity is purely time-based
          const validWithNull = isMembershipValid(null, expirationDate, now)
          const expired = isExpired(expirationDate, now)

          expect(validWithNull).toBe(!expired)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * When expired by time with days > 0, days_lost equals remaining_days.
   * **Validates: Requirements 14.2**
   */
  it('days_lost equals remaining_days when membership expires by time with days remaining', () => {
    fc.assert(
      fc.property(
        arbitraryTimeExpiredWithDaysRemaining(),
        ({ membership, currentDate }) => {
          const daysLost = calculateDaysLost(
            membership.remaining_days,
            membership.expiration_date,
            currentDate
          )

          // days_lost must equal the remaining days at the time of expiration
          expect(daysLost).toBe(membership.remaining_days)
          expect(daysLost).toBeGreaterThan(0)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * When NOT expired by time, days_lost is always 0 (no days are lost).
   * **Validates: Requirements 14.2**
   */
  it('days_lost is 0 when membership has not expired by time', () => {
    fc.assert(
      fc.property(
        arbitraryLimitedMembership().chain((membership) =>
          fc.integer({ min: -30, max: 0 }).map((offset) => {
            // Generate a date ON or BEFORE the expiration date
            const now = new Date(membership.expiration_date)
            now.setDate(now.getDate() + offset)
            return {
              membership,
              now: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            }
          })
        ),
        ({ membership, now }) => {
          const expired = isExpired(membership.expiration_date, now)

          if (!expired) {
            const daysLost = calculateDaysLost(
              membership.remaining_days,
              membership.expiration_date,
              now
            )
            expect(daysLost).toBe(0)
          }
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * For unlimited plans, days_lost is always 0 (unlimited plans don't lose days).
   * **Validates: Requirements 14.2, 14.3**
   */
  it('unlimited plans never have days_lost (always 0)', () => {
    fc.assert(
      fc.property(
        arbitraryUnlimitedMembership().chain((membership) =>
          arbitraryCurrentDateRelativeToExpiration(membership.expiration_date).map(
            (now) => ({ membership, now })
          )
        ),
        ({ membership, now }) => {
          const daysLost = calculateDaysLost(
            membership.remaining_days,
            membership.expiration_date,
            now
          )

          // Unlimited plans (remaining_days = null) never have days_lost
          expect(daysLost).toBe(0)
        }
      ),
      { numRuns: 200 }
    )
  })
})
