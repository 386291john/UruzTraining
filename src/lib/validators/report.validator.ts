/**
 * Zod validation schemas for report query parameters.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.10
 */

import { z } from 'zod'

/** ISO date string format (YYYY-MM-DD) */
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'El formato de fecha debe ser YYYY-MM-DD.')
  .optional()

/** UUID v4 format for affiliate/instructor IDs */
const uuidString = z
  .string()
  .uuid('El ID debe ser un UUID válido.')
  .optional()

/**
 * Schema for entry history and renewal history filters.
 * Applies to /api/reports/entries and /api/reports/renewals
 */
export const reportFiltersSchema = z.object({
  dateFrom: dateString,
  dateTo: dateString,
  affiliateId: uuidString,
  instructorId: uuidString,
})

/**
 * Schema for expiring affiliates query.
 * "days" param: number of days to look ahead.
 */
export const expiringFiltersSchema = z.object({
  days: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1, 'Los días deben ser al menos 1.'))
    .optional(),
})

/**
 * Schema for entries-by-day and entries-by-month date range filters.
 */
export const dateRangeSchema = z.object({
  dateFrom: dateString,
  dateTo: dateString,
})

export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>
export type ExpiringFiltersInput = z.infer<typeof expiringFiltersSchema>
export type DateRangeInput = z.infer<typeof dateRangeSchema>
