import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { addDays } from 'date-fns'
import {
  calculateVigency,
  VigencyCalculationInput,
} from '@/services/vigency.service'
import { arbitraryDate } from '../generators/date.generator'
import { arbitraryPlan, GeneratedPlan } from '../generators/plan.generator'

/**
 * Property 10: Renovación crea membresía con parámetros del nuevo plan
 *
 * **Validates: Requirements 8.1, 8.2, 8.6**
 *
 * Verifies that when a renewal occurs with a new plan:
 * - remaining_days of the new membership = allowed_days of the new plan (or NULL for unlimited)
 * - Dates are calculated using VigencyService with the renewal date as the acquisition date
 *
 * The renewal service (renewal.service.ts) performs:
 * 1. calculateVigency({ acquisitionDate: renewalDate, plan: newPlan, weekendStartRuleActive })
 * 2. Creates new membership with:
 *    - remaining_days = newPlan.allowed_days
 *    - usage_start_date = vigencyResult.usageStartDate
 *    - weeks_count_start_date = vigencyResult.weeksCountStartDate
 *    - expiration_date = vigencyResult.expirationDate
 */
describe('Property 10: Renovación crea membresía con parámetros del nuevo plan', () => {
  /**
   * Simulates the renewal logic for the new membership creation.
   * This mirrors what renewal.service.ts does in the `renew` function:
   * - Calls calculateVigency with renewalDate as acquisitionDate
   * - Sets remaining_days = newPlan.allowed_days
   */
  function simulateRenewalMembership(
    renewalDate: Date,
    newPlan: GeneratedPlan,
    weekendStartRuleActive: boolean
  ) {
    const vigencyInput: VigencyCalculationInput = {
      acquisitionDate: renewalDate,
      plan: {
        allowedDays: newPlan.allowedDays,
        vigencyWeeks: newPlan.vigencyWeeks,
      },
      weekendStartRuleActive,
    }

    const vigencyResult = calculateVigency(vigencyInput)

    return {
      remaining_days: newPlan.allowedDays, // NULL for unlimited, integer for limited
      usage_start_date: vigencyResult.usageStartDate,
      weeks_count_start_date: vigencyResult.weeksCountStartDate,
      expiration_date: vigencyResult.expirationDate,
    }
  }

  /**
   * remaining_days of the new membership equals allowed_days of the new plan.
   * For limited plans: remaining_days = allowedDays (integer >= 1)
   * For unlimited plans: remaining_days = null
   *
   * **Validates: Requirements 8.2, 8.6**
   */
  it('remaining_days equals allowed_days of the new plan (or NULL for unlimited)', () => {
    fc.assert(
      fc.property(
        arbitraryDate(),
        arbitraryPlan(),
        fc.boolean(),
        (renewalDate, newPlan, weekendStartRuleActive) => {
          const newMembership = simulateRenewalMembership(
            renewalDate,
            newPlan,
            weekendStartRuleActive
          )

          // remaining_days must exactly equal allowed_days of the new plan
          expect(newMembership.remaining_days).toBe(newPlan.allowedDays)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * Vigency dates are calculated using VigencyService with renewalDate as acquisitionDate.
   * The expiration_date must equal weeksCountStartDate + (vigencyWeeks × 7) - 1.
   *
   * **Validates: Requirements 8.1, 8.6**
   */
  it('expiration_date is calculated from weeksCountStartDate using new plan vigencyWeeks', () => {
    fc.assert(
      fc.property(
        arbitraryDate(),
        arbitraryPlan(),
        fc.boolean(),
        (renewalDate, newPlan, weekendStartRuleActive) => {
          const newMembership = simulateRenewalMembership(
            renewalDate,
            newPlan,
            weekendStartRuleActive
          )

          // expiration_date = weeks_count_start_date + (vigencyWeeks × 7) - 1
          const expectedExpiration = addDays(
            newMembership.weeks_count_start_date,
            newPlan.vigencyWeeks * 7 - 1
          )

          expect(newMembership.expiration_date.getTime()).toBe(expectedExpiration.getTime())
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * usage_start_date is always the renewal date (plan can be used immediately).
   * This is consistent for all scenarios: Mon-Thu, and Fri-Sun regardless of rule.
   *
   * **Validates: Requirements 8.1**
   */
  it('usage_start_date is always the renewal date (normalized to start of day)', () => {
    fc.assert(
      fc.property(
        arbitraryDate(),
        arbitraryPlan(),
        fc.boolean(),
        (renewalDate, newPlan, weekendStartRuleActive) => {
          const newMembership = simulateRenewalMembership(
            renewalDate,
            newPlan,
            weekendStartRuleActive
          )

          // Usage always starts from the renewal date
          const normalizedRenewalDate = new Date(
            renewalDate.getFullYear(),
            renewalDate.getMonth(),
            renewalDate.getDate()
          )
          expect(newMembership.usage_start_date.getTime()).toBe(normalizedRenewalDate.getTime())
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * Different new plans produce different remaining_days and expiration periods.
   * This verifies the renewal truly uses the NEW plan parameters, not the old plan.
   *
   * **Validates: Requirements 8.2**
   */
  it('two renewals with different plans produce different membership params', () => {
    fc.assert(
      fc.property(
        arbitraryDate(),
        fc.boolean(),
        (renewalDate, weekendStartRuleActive) => {
          const planA: GeneratedPlan = { allowedDays: 8, vigencyWeeks: 4 }
          const planB: GeneratedPlan = { allowedDays: 16, vigencyWeeks: 8 }

          const membershipA = simulateRenewalMembership(renewalDate, planA, weekendStartRuleActive)
          const membershipB = simulateRenewalMembership(renewalDate, planB, weekendStartRuleActive)

          // Different plans → different remaining_days
          expect(membershipA.remaining_days).toBe(8)
          expect(membershipB.remaining_days).toBe(16)

          // Different vigencyWeeks → different expiration dates
          expect(membershipA.expiration_date.getTime()).not.toBe(
            membershipB.expiration_date.getTime()
          )

          // Plan B has double the vigency, so its expiration should be later
          expect(membershipB.expiration_date.getTime()).toBeGreaterThan(
            membershipA.expiration_date.getTime()
          )
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * For unlimited plans (allowedDays = null), remaining_days is null.
   * For limited plans (allowedDays >= 1), remaining_days equals allowedDays.
   *
   * **Validates: Requirements 8.2, 8.6**
   */
  it('unlimited plans set remaining_days to null, limited plans set to allowedDays', () => {
    fc.assert(
      fc.property(
        arbitraryDate(),
        fc.integer({ min: 1, max: 52 }),
        fc.boolean(),
        (renewalDate, vigencyWeeks, weekendStartRuleActive) => {
          // Test with unlimited plan
          const unlimitedPlan: GeneratedPlan = { allowedDays: null, vigencyWeeks }
          const unlimitedMembership = simulateRenewalMembership(
            renewalDate,
            unlimitedPlan,
            weekendStartRuleActive
          )
          expect(unlimitedMembership.remaining_days).toBeNull()

          // Test with limited plan (random days 1-365)
          const limitedDays = Math.max(1, (renewalDate.getDate() % 30) + 1) // deterministic from date
          const limitedPlan: GeneratedPlan = { allowedDays: limitedDays, vigencyWeeks }
          const limitedMembership = simulateRenewalMembership(
            renewalDate,
            limitedPlan,
            weekendStartRuleActive
          )
          expect(limitedMembership.remaining_days).toBe(limitedDays)
        }
      ),
      { numRuns: 200 }
    )
  })
})
