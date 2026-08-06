/**
 * Report service — business logic for generating all 7 report types.
 * Applies default date ranges, enforces max range limits, and delegates
 * data retrieval to the report repository.
 *
 * RLS in Supabase automatically scopes results:
 * - Instructors see only their affiliates' data
 * - Admins see all data
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10
 */

import * as reportRepository from '@/repositories/report.repository'
import type {
  ReportFilters,
  EntryHistoryRow,
  RenewalHistoryRow,
  AffiliateStatusRow,
  DailyEntryCount,
  MonthlyEntryCount,
} from '@/repositories/report.repository'

// Re-export types for consumers
export type {
  ReportFilters,
  EntryHistoryRow,
  RenewalHistoryRow,
  AffiliateStatusRow,
  DailyEntryCount,
  MonthlyEntryCount,
}

/** Default date range: last 30 days */
const DEFAULT_RANGE_DAYS = 30

/** Max range for daily entries report: 90 days */
const MAX_DAILY_RANGE_DAYS = 90

/** Max range for monthly entries report: 12 months */
const MAX_MONTHLY_RANGE_MONTHS = 12

/** Default notification threshold for expiring affiliates report */
const DEFAULT_EXPIRATION_THRESHOLD_DAYS = 7

/**
 * Applies default date range (last 30 days) when no dates are specified.
 *
 * @param filters - Input filters
 * @returns Filters with dateFrom/dateTo guaranteed
 */
function applyDefaultDateRange(filters: ReportFilters): ReportFilters {
  const result = { ...filters }

  if (!result.dateTo) {
    result.dateTo = new Date().toISOString().split('T')[0]
  }

  if (!result.dateFrom) {
    const from = new Date(result.dateTo)
    from.setDate(from.getDate() - DEFAULT_RANGE_DAYS)
    result.dateFrom = from.toISOString().split('T')[0]
  }

  return result
}

/**
 * Calculates the number of days between two date strings.
 */
function daysBetween(dateFrom: string, dateTo: string): number {
  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Calculates the number of months between two date strings.
 */
function monthsBetween(dateFrom: string, dateTo: string): number {
  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

/**
 * Retrieves entry history report.
 * Default date range: last 30 days when not specified.
 *
 * @param filters - Optional filters (dateFrom, dateTo, affiliateId, instructorId)
 * @returns Entry history rows
 */
export async function getEntryHistory(filters: ReportFilters = {}): Promise<EntryHistoryRow[]> {
  const resolvedFilters = applyDefaultDateRange(filters)
  return reportRepository.getEntryHistory(resolvedFilters)
}

/**
 * Retrieves renewal history report.
 * Default date range: last 30 days when not specified.
 *
 * @param filters - Optional filters (dateFrom, dateTo, affiliateId, instructorId)
 * @returns Renewal history rows
 */
export async function getRenewalHistory(filters: ReportFilters = {}): Promise<RenewalHistoryRow[]> {
  const resolvedFilters = applyDefaultDateRange(filters)
  return reportRepository.getRenewalHistory(resolvedFilters)
}

/**
 * Retrieves all affiliates with expired memberships.
 * No date filters needed — returns current expired state.
 *
 * @returns Affiliate status rows for expired memberships
 */
export async function getExpiredAffiliates(): Promise<AffiliateStatusRow[]> {
  return reportRepository.getExpiredAffiliates()
}

/**
 * Retrieves all affiliates with active memberships.
 * No date filters needed — returns current active state.
 *
 * @returns Affiliate status rows for active memberships
 */
export async function getActiveAffiliates(): Promise<AffiliateStatusRow[]> {
  return reportRepository.getActiveAffiliates()
}

/**
 * Retrieves affiliates whose memberships will expire within the threshold.
 *
 * @param thresholdDays - Number of days to look ahead (defaults to 7)
 * @returns Affiliate status rows about to expire
 */
export async function getExpiringAffiliates(
  thresholdDays: number = DEFAULT_EXPIRATION_THRESHOLD_DAYS
): Promise<AffiliateStatusRow[]> {
  if (thresholdDays < 1) {
    thresholdDays = DEFAULT_EXPIRATION_THRESHOLD_DAYS
  }
  return reportRepository.getExpiringAffiliates(thresholdDays)
}

/**
 * Retrieves entry counts grouped by day.
 * Enforces max range of 90 days. Applies default last 30 days when no dates specified.
 *
 * @param dateFrom - Start date (ISO string, optional)
 * @param dateTo - End date (ISO string, optional)
 * @returns Daily entry counts
 * @throws Error if range exceeds 90 days
 */
export async function getEntriesByDay(dateFrom?: string, dateTo?: string): Promise<DailyEntryCount[]> {
  const resolvedTo = dateTo ?? new Date().toISOString().split('T')[0]

  let resolvedFrom: string
  if (!dateFrom) {
    const from = new Date(resolvedTo)
    from.setDate(from.getDate() - DEFAULT_RANGE_DAYS)
    resolvedFrom = from.toISOString().split('T')[0]
  } else {
    resolvedFrom = dateFrom
  }

  const days = daysBetween(resolvedFrom, resolvedTo)
  if (days > MAX_DAILY_RANGE_DAYS) {
    throw new Error(
      `El rango máximo para el informe diario es de ${MAX_DAILY_RANGE_DAYS} días. El rango solicitado es de ${days} días.`
    )
  }

  return reportRepository.getEntriesByDay(resolvedFrom, resolvedTo)
}

/**
 * Retrieves entry counts grouped by month.
 * Enforces max range of 12 months. Applies default last 30 days when no dates specified.
 *
 * @param dateFrom - Start date (ISO string, optional)
 * @param dateTo - End date (ISO string, optional)
 * @returns Monthly entry counts
 * @throws Error if range exceeds 12 months
 */
export async function getEntriesByMonth(dateFrom?: string, dateTo?: string): Promise<MonthlyEntryCount[]> {
  const resolvedTo = dateTo ?? new Date().toISOString().split('T')[0]

  let resolvedFrom: string
  if (!dateFrom) {
    const from = new Date(resolvedTo)
    from.setDate(from.getDate() - DEFAULT_RANGE_DAYS)
    resolvedFrom = from.toISOString().split('T')[0]
  } else {
    resolvedFrom = dateFrom
  }

  const months = monthsBetween(resolvedFrom, resolvedTo)
  if (months > MAX_MONTHLY_RANGE_MONTHS) {
    throw new Error(
      `El rango máximo para el informe mensual es de ${MAX_MONTHLY_RANGE_MONTHS} meses. El rango solicitado es de ${months} meses.`
    )
  }

  return reportRepository.getEntriesByMonth(resolvedFrom, resolvedTo)
}
