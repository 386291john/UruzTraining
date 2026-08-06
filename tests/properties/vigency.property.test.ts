import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { getDay, addDays, differenceInCalendarDays } from 'date-fns'
import {
  calculateVigency,
  isWeekend,
  VigencyCalculationInput,
} from '@/services/vigency.service'
import { arbitraryDate, arbitraryWeekdayDate, arbitraryWeekendDate } from '../generators/date.generator'
import { arbitraryPlan } from '../generators/plan.generator'

/**
 * Property 1: Cálculo de vigencia correcto
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.7
 *
 * Verifies:
 * (a) Mon-Thu → usageStartDate = weeksCountStartDate = acquisitionDate
 * (b) Fri-Sun + rule active → usageStartDate = acquisitionDate, weeksCountStartDate = next Monday
 * (c) Fri-Sun + rule inactive → usageStartDate = weeksCountStartDate = acquisitionDate
 * (d) expirationDate = weeksCountStartDate + (vigencyWeeks × 7) - 1
 */
describe('Property 1: Cálculo de vigencia correcto', () => {
  /**
   * (a) WHEN acquisition is Mon-Thu → usage = weeks_count = acquisition
   * **Validates: Requirements 5.1**
   */
  it('Mon-Thu: usageStartDate and weeksCountStartDate equal acquisitionDate', () => {
    fc.assert(
      fc.property(
        arbitraryWeekdayDate(),
        arbitraryPlan(),
        fc.boolean(),
        (date, plan, ruleActive) => {
          const input: VigencyCalculationInput = {
            acquisitionDate: date,
            plan,
            weekendStartRuleActive: ruleActive,
          }

          const result = calculateVigency(input)

          // Verify the date is indeed Mon-Thu
          const day = getDay(date)
          expect(day).toBeGreaterThanOrEqual(1)
          expect(day).toBeLessThanOrEqual(4)

          // Both dates should equal the acquisition date
          expect(result.usageStartDate.getTime()).toBe(date.getTime())
          expect(result.weeksCountStartDate.getTime()).toBe(date.getTime())
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * (b) WHEN acquisition is Fri-Sun AND rule is active →
   *     usageStartDate = acquisitionDate, weeksCountStartDate = next Monday
   * **Validates: Requirements 5.2**
   */
  it('Fri-Sun + rule active: usageStartDate = acquisition, weeksCountStartDate = next Monday', () => {
    fc.assert(
      fc.property(
        arbitraryWeekendDate(),
        arbitraryPlan(),
        (date, plan) => {
          const input: VigencyCalculationInput = {
            acquisitionDate: date,
            plan,
            weekendStartRuleActive: true,
          }

          const result = calculateVigency(input)

          // Verify the date is indeed Fri/Sat/Sun
          expect(isWeekend(date)).toBe(true)

          // usageStartDate should equal acquisition
          expect(result.usageStartDate.getTime()).toBe(date.getTime())

          // weeksCountStartDate should be the next Monday
          const weeksCountDay = getDay(result.weeksCountStartDate)
          expect(weeksCountDay).toBe(1) // Monday

          // weeksCountStartDate should be strictly after acquisitionDate
          expect(result.weeksCountStartDate.getTime()).toBeGreaterThan(date.getTime())

          // weeksCountStartDate should be at most 3 days after (Fri→Mon=3, Sat→Mon=2, Sun→Mon=1)
          const diffDays = differenceInCalendarDays(result.weeksCountStartDate, date)
          expect(diffDays).toBeGreaterThanOrEqual(1)
          expect(diffDays).toBeLessThanOrEqual(3)
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * (c) WHEN acquisition is Fri-Sun AND rule is inactive →
   *     usageStartDate = weeksCountStartDate = acquisitionDate
   * **Validates: Requirements 5.3**
   */
  it('Fri-Sun + rule inactive: usageStartDate and weeksCountStartDate equal acquisitionDate', () => {
    fc.assert(
      fc.property(
        arbitraryWeekendDate(),
        arbitraryPlan(),
        (date, plan) => {
          const input: VigencyCalculationInput = {
            acquisitionDate: date,
            plan,
            weekendStartRuleActive: false,
          }

          const result = calculateVigency(input)

          // Verify the date is indeed Fri/Sat/Sun
          expect(isWeekend(date)).toBe(true)

          // Both dates should equal acquisition date
          expect(result.usageStartDate.getTime()).toBe(date.getTime())
          expect(result.weeksCountStartDate.getTime()).toBe(date.getTime())
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * (d) expirationDate = weeksCountStartDate + (vigencyWeeks × 7) - 1
   * **Validates: Requirements 5.4**
   */
  it('expirationDate = weeksCountStartDate + (vigencyWeeks × 7) - 1 for all inputs', () => {
    fc.assert(
      fc.property(
        arbitraryDate(),
        arbitraryPlan(),
        fc.boolean(),
        (date, plan, ruleActive) => {
          const input: VigencyCalculationInput = {
            acquisitionDate: date,
            plan,
            weekendStartRuleActive: ruleActive,
          }

          const result = calculateVigency(input)

          // Calculate expected expiration
          const expectedExpiration = addDays(
            result.weeksCountStartDate,
            plan.vigencyWeeks * 7 - 1
          )

          expect(result.expirationDate.getTime()).toBe(expectedExpiration.getTime())
        }
      ),
      { numRuns: 200 }
    )
  })

  /**
   * Combined property: For any valid input, the relationship between dates is consistent.
   * - usageStartDate <= weeksCountStartDate (usage can start before or at weeks count)
   * - expirationDate > weeksCountStartDate (expiration is always after start)
   * - expiration - weeksCountStart = (vigencyWeeks × 7) - 1 days
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.7**
   */
  it('date relationships are always consistent across all inputs', () => {
    fc.assert(
      fc.property(
        arbitraryDate(),
        arbitraryPlan(),
        fc.boolean(),
        (date, plan, ruleActive) => {
          const input: VigencyCalculationInput = {
            acquisitionDate: date,
            plan,
            weekendStartRuleActive: ruleActive,
          }

          const result = calculateVigency(input)

          // usageStartDate <= weeksCountStartDate
          expect(result.usageStartDate.getTime()).toBeLessThanOrEqual(
            result.weeksCountStartDate.getTime()
          )

          // expirationDate >= weeksCountStartDate (for vigencyWeeks >= 1)
          expect(result.expirationDate.getTime()).toBeGreaterThanOrEqual(
            result.weeksCountStartDate.getTime()
          )

          // The vigency period spans exactly vigencyWeeks * 7 days (inclusive)
          const vigencyDays = differenceInCalendarDays(
            result.expirationDate,
            result.weeksCountStartDate
          )
          expect(vigencyDays).toBe(plan.vigencyWeeks * 7 - 1)
        }
      ),
      { numRuns: 200 }
    )
  })
})
