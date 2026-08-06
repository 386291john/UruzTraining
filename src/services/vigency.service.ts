import {
  getDay,
  addDays,
  differenceInCalendarDays,
  isAfter,
  startOfDay,
  endOfDay,
  nextMonday,
} from 'date-fns'
import { nowColombia } from '@/lib/utils/date.utils'

// --- Interfaces ---

export interface VigencyCalculationInput {
  acquisitionDate: Date
  plan: { allowedDays: number | null; vigencyWeeks: number }
  weekendStartRuleActive: boolean
}

export interface VigencyCalculationResult {
  usageStartDate: Date
  weeksCountStartDate: Date
  expirationDate: Date
}

// --- Helper Functions ---

/**
 * Returns true if the given date falls on Friday (5), Saturday (6), or Sunday (0).
 * Uses getDay() where 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday.
 */
export function isWeekend(date: Date): boolean {
  const day = getDay(date)
  return day === 0 || day === 5 || day === 6
}

/**
 * Returns the next Monday after the given date.
 * Uses date-fns nextMonday which returns the next Monday strictly after the given date.
 */
export function getNextMonday(date: Date): Date {
  return startOfDay(nextMonday(date))
}

/**
 * Returns true if the current time is past the end of the expiration date.
 * The expiration date is inclusive (valid until 23:59:59 of that day).
 */
export function isExpired(expirationDate: Date, now?: Date): boolean {
  const currentTime = now ?? nowColombia()
  const endOfExpirationDay = endOfDay(expirationDate)
  return isAfter(currentTime, endOfExpirationDay)
}

/**
 * Returns the number of calendar days remaining until expiration.
 * Returns 0 if already expired.
 */
export function getDaysUntilExpiration(expirationDate: Date, now?: Date): number {
  const currentTime = now ?? nowColombia()
  const expirationEnd = endOfDay(expirationDate)

  if (isAfter(currentTime, expirationEnd)) {
    return 0
  }

  return differenceInCalendarDays(startOfDay(expirationDate), startOfDay(currentTime))
}

// --- Main Calculation Function ---

/**
 * Calculates vigency (validity period) dates for a gym membership plan.
 *
 * Algorithm:
 * 1. If acquisition date is Mon-Thu:
 *    → weeksCountStartDate = acquisitionDate
 *    → usageStartDate = acquisitionDate
 *
 * 2. If acquisition date is Fri-Sun:
 *    a. If weekendStartRule is ACTIVE:
 *       → weeksCountStartDate = next Monday
 *       → usageStartDate = acquisitionDate (can use immediately)
 *    b. If weekendStartRule is INACTIVE:
 *       → weeksCountStartDate = acquisitionDate
 *       → usageStartDate = acquisitionDate
 *
 * 3. expirationDate = weeksCountStartDate + (vigencyWeeks × 7) - 1 day
 *    (Last day is inclusive until 23:59:59)
 */
export function calculateVigency(input: VigencyCalculationInput): VigencyCalculationResult {
  const { acquisitionDate, plan, weekendStartRuleActive } = input
  const normalizedAcquisition = startOfDay(acquisitionDate)

  let usageStartDate: Date
  let weeksCountStartDate: Date

  if (isWeekend(normalizedAcquisition)) {
    // Acquisition is on Friday, Saturday, or Sunday
    if (weekendStartRuleActive) {
      // Rule active: usage starts immediately, but weeks count from next Monday
      usageStartDate = normalizedAcquisition
      weeksCountStartDate = getNextMonday(normalizedAcquisition)
    } else {
      // Rule inactive: both dates equal acquisition date
      usageStartDate = normalizedAcquisition
      weeksCountStartDate = normalizedAcquisition
    }
  } else {
    // Acquisition is on Monday-Thursday: both dates equal acquisition date
    usageStartDate = normalizedAcquisition
    weeksCountStartDate = normalizedAcquisition
  }

  // Calculate expiration: weeksCountStartDate + (vigencyWeeks × 7) - 1 day
  const totalDays = plan.vigencyWeeks * 7
  const expirationDate = addDays(weeksCountStartDate, totalDays - 1)

  return {
    usageStartDate,
    weeksCountStartDate,
    expirationDate,
  }
}
