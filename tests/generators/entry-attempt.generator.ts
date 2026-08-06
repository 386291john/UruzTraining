/**
 * Fast-check generators for entry validation priority property tests.
 *
 * Generates combinations of failure conditions to verify that the entry
 * validation service always returns the highest-priority error.
 *
 * Priority order:
 * 1. AFFILIATE_NOT_FOUND (highest)
 * 2. PIN_BLOCKED
 * 3. PIN_MISMATCH
 * 4. MEMBERSHIP_EXPIRED
 * 5. NO_DAYS_REMAINING
 * 6. ALREADY_ENTERED (lowest)
 */

import fc from 'fast-check'
import type { EntryErrorCode } from '@/services/entry.service'

/**
 * All possible failure conditions in priority order (highest first).
 */
export const PRIORITY_ORDER: EntryErrorCode[] = [
  'AFFILIATE_NOT_FOUND',
  'PIN_BLOCKED',
  'PIN_MISMATCH',
  'MEMBERSHIP_EXPIRED',
  'NO_DAYS_REMAINING',
  'ALREADY_ENTERED',
]

/**
 * Represents a set of active failure conditions for an entry attempt.
 */
export interface EntryFailureScenario {
  /** Which failure conditions are active in this scenario */
  activeFailures: Set<EntryErrorCode>
  /** The expected error code (highest priority among active failures) */
  expectedError: EntryErrorCode
}

/**
 * Generates a non-empty subset of failure conditions and determines
 * which error should be returned based on priority order.
 *
 * Generates at least 2 simultaneous failures to test priority resolution.
 */
export function arbitraryEntryFailureScenario(): fc.Arbitrary<EntryFailureScenario> {
  // Generate a boolean for each failure condition (at least 2 must be true)
  return fc
    .record({
      affiliateNotFound: fc.boolean(),
      pinBlocked: fc.boolean(),
      pinMismatch: fc.boolean(),
      membershipExpired: fc.boolean(),
      noDaysRemaining: fc.boolean(),
      alreadyEntered: fc.boolean(),
    })
    .filter((flags) => {
      // Ensure at least 2 failure conditions are active
      const count = Object.values(flags).filter(Boolean).length
      return count >= 2
    })
    .map((flags) => {
      const activeFailures = new Set<EntryErrorCode>()

      if (flags.affiliateNotFound) activeFailures.add('AFFILIATE_NOT_FOUND')
      if (flags.pinBlocked) activeFailures.add('PIN_BLOCKED')
      if (flags.pinMismatch) activeFailures.add('PIN_MISMATCH')
      if (flags.membershipExpired) activeFailures.add('MEMBERSHIP_EXPIRED')
      if (flags.noDaysRemaining) activeFailures.add('NO_DAYS_REMAINING')
      if (flags.alreadyEntered) activeFailures.add('ALREADY_ENTERED')

      // The expected error is the first in priority order that is active
      const expectedError = PRIORITY_ORDER.find((code) => activeFailures.has(code))!

      return { activeFailures, expectedError }
    })
}

/**
 * Generates a scenario where a specific error is NOT the highest priority,
 * to verify that lower-priority errors are masked by higher-priority ones.
 *
 * @param maskedError - The error code that should be masked (not returned)
 */
export function arbitraryMaskedErrorScenario(
  maskedError: EntryErrorCode
): fc.Arbitrary<EntryFailureScenario> {
  const maskedIndex = PRIORITY_ORDER.indexOf(maskedError)

  // We need at least one error with higher priority (lower index) than maskedError
  if (maskedIndex <= 0) {
    // AFFILIATE_NOT_FOUND can't be masked (it's highest priority)
    // Return a scenario with it active + another error
    return fc.constant({
      activeFailures: new Set<EntryErrorCode>(['AFFILIATE_NOT_FOUND', maskedError]),
      expectedError: 'AFFILIATE_NOT_FOUND' as EntryErrorCode,
    })
  }

  // Pick a random higher-priority error
  const higherPriorityErrors = PRIORITY_ORDER.slice(0, maskedIndex)

  return fc
    .constantFrom(...higherPriorityErrors)
    .map((higherError) => {
      const activeFailures = new Set<EntryErrorCode>([higherError, maskedError])
      return {
        activeFailures,
        expectedError: higherError,
      }
    })
}

/**
 * Generates valid document IDs for entry attempts.
 */
export function arbitraryDocumentId(): fc.Arbitrary<string> {
  return fc.stringMatching(/^\d{5,15}$/)
}

/**
 * Generates valid PINs (4 numeric digits).
 */
export function arbitraryPin(): fc.Arbitrary<string> {
  return fc.stringMatching(/^\d{4}$/)
}
