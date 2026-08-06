/**
 * Date/time utilities for UruzTraining.
 * All operations use Colombian timezone (America/Bogota, UTC-5).
 *
 * This ensures consistent behavior regardless of where the server runs
 * (e.g., Vercel edge functions in different regions).
 */

import { TIMEZONE } from '@/lib/utils/constants'

/**
 * Returns the current date/time in Colombian timezone as a Date object.
 * The Date is constructed from the Colombia-local components so that
 * .toISOString() and .getTime() reflect the actual wall-clock time in Colombia.
 */
export function nowColombia(): Date {
  const now = new Date()
  // Get the current time string in Colombia timezone
  const colombiaStr = now.toLocaleString('en-US', { timeZone: TIMEZONE })
  return new Date(colombiaStr)
}

/**
 * Returns today's date in Colombian timezone as YYYY-MM-DD string.
 */
export function todayColombia(): string {
  const now = new Date()
  // Format as YYYY-MM-DD using Colombia timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return parts // Returns YYYY-MM-DD
}

/**
 * Returns the current timestamp as ISO string adjusted to Colombian time.
 * Suitable for storing in timestamptz columns.
 */
export function nowColombiaISO(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: TIMEZONE }).replace(' ', 'T') + '-05:00'
}

/**
 * Returns the current time in Colombia as HH:MM:SS string.
 */
export function currentTimeColombia(): string {
  return new Date().toLocaleTimeString('en-GB', { timeZone: TIMEZONE, hour12: false })
}

/**
 * Gets the day of the week (0=Sunday, 6=Saturday) in Colombian timezone.
 */
export function dayOfWeekColombia(): number {
  return nowColombia().getDay()
}

/**
 * Checks if a given date is today in Colombian timezone.
 */
export function isToday(date: Date | string): boolean {
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0]
  return dateStr === todayColombia()
}
