/**
 * Report repository — encapsulates all optimized database queries for report generation.
 * Uses the authenticated Supabase server client so RLS policies apply automatically,
 * scoping results to the instructor's affiliates or all data for admins.
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10
 */

import { createClient } from '@/lib/supabase/server'

/** Filters available for report queries */
export interface ReportFilters {
  dateFrom?: string
  dateTo?: string
  affiliateId?: string
  instructorId?: string
}

/** Row returned from entry history report */
export interface EntryHistoryRow {
  id: string
  entry_date: string
  entry_time: string
  affiliate_name: string
  document_id: string
  instructor_name: string
}

/** Row returned from renewal history report */
export interface RenewalHistoryRow {
  id: string
  renewal_date: string
  affiliate_name: string
  document_id: string
  previous_plan_name: string
  new_plan_name: string
  instructor_name: string
}

/** Row returned from affiliate status reports (expired, active, expiring) */
export interface AffiliateStatusRow {
  affiliate_id: string
  full_name: string
  document_id: string
  plan_name: string
  remaining_days: number | null
  expiration_date: string
  instructor_name: string
}

/** Row returned from entries-per-day report */
export interface DailyEntryCount {
  date: string
  count: number
}

/** Row returned from entries-per-month report */
export interface MonthlyEntryCount {
  month: string
  count: number
}

/**
 * Retrieves the entry history with affiliate and instructor details.
 * Filters: date range, affiliate, instructor.
 *
 * @param filters - Optional report filters
 * @returns Array of entry history rows
 */
export async function getEntryHistory(filters: ReportFilters): Promise<EntryHistoryRow[]> {
  const supabase = createClient()

  let query = supabase
    .from('entries')
    .select(`
      id,
      entry_date,
      entry_time,
      affiliate:affiliates!entries_affiliate_id_fkey(full_name, document_id),
      instructor:profiles!entries_registered_by_fkey(full_name)
    `)
    .order('entry_date', { ascending: false })
    .order('entry_time', { ascending: false })

  if (filters.dateFrom) {
    query = query.gte('entry_date', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('entry_date', filters.dateTo)
  }
  if (filters.affiliateId) {
    query = query.eq('affiliate_id', filters.affiliateId)
  }
  if (filters.instructorId) {
    query = query.eq('registered_by', filters.instructorId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Error al obtener historial de ingresos: ${error.message}`)
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const affiliate = row.affiliate as { full_name: string; document_id: string } | null
    const instructor = row.instructor as { full_name: string } | null
    return {
      id: row.id as string,
      entry_date: row.entry_date as string,
      entry_time: row.entry_time as string,
      affiliate_name: affiliate?.full_name ?? '',
      document_id: affiliate?.document_id ?? '',
      instructor_name: instructor?.full_name ?? '',
    }
  })
}

/**
 * Retrieves the renewal history with affiliate, plan, and instructor details.
 * Filters: date range, affiliate, instructor.
 *
 * @param filters - Optional report filters
 * @returns Array of renewal history rows
 */
export async function getRenewalHistory(filters: ReportFilters): Promise<RenewalHistoryRow[]> {
  const supabase = createClient()

  let query = supabase
    .from('renewals')
    .select(`
      id,
      renewal_date,
      affiliate:affiliates!renewals_affiliate_id_fkey(full_name, document_id),
      previous_plan:plans!renewals_previous_plan_id_fkey(name),
      new_plan:plans!renewals_new_plan_id_fkey(name),
      instructor:profiles!renewals_performed_by_fkey(full_name)
    `)
    .order('renewal_date', { ascending: false })

  if (filters.dateFrom) {
    query = query.gte('renewal_date', filters.dateFrom)
  }
  if (filters.dateTo) {
    query = query.lte('renewal_date', filters.dateTo)
  }
  if (filters.affiliateId) {
    query = query.eq('affiliate_id', filters.affiliateId)
  }
  if (filters.instructorId) {
    query = query.eq('performed_by', filters.instructorId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Error al obtener historial de renovaciones: ${error.message}`)
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const affiliate = row.affiliate as { full_name: string; document_id: string } | null
    const previousPlan = row.previous_plan as { name: string } | null
    const newPlan = row.new_plan as { name: string } | null
    const instructor = row.instructor as { full_name: string } | null
    return {
      id: row.id as string,
      renewal_date: row.renewal_date as string,
      affiliate_name: affiliate?.full_name ?? '',
      document_id: affiliate?.document_id ?? '',
      previous_plan_name: previousPlan?.name ?? '',
      new_plan_name: newPlan?.name ?? '',
      instructor_name: instructor?.full_name ?? '',
    }
  })
}

/**
 * Retrieves affiliates with expired memberships OR with 0 remaining days.
 * RLS handles instructor scoping automatically.
 *
 * @returns Array of affiliate status rows with expired/consumed memberships
 */
export async function getExpiredAffiliates(): Promise<AffiliateStatusRow[]> {
  const supabase = createClient()

  // Get memberships with status 'expired'
  const { data: expiredData, error: expiredError } = await supabase
    .from('memberships')
    .select(`
      affiliate_id,
      remaining_days,
      expiration_date,
      affiliate:affiliates!memberships_affiliate_id_fkey(full_name, document_id, instructor_id),
      plan:plans!memberships_plan_id_fkey(name)
    `)
    .eq('status', 'expired')
    .order('expiration_date', { ascending: false })

  if (expiredError) {
    throw new Error(`Error al obtener afiliados vencidos: ${expiredError.message}`)
  }

  // Get active memberships with 0 remaining days (consumed all days)
  const { data: consumedData, error: consumedError } = await supabase
    .from('memberships')
    .select(`
      affiliate_id,
      remaining_days,
      expiration_date,
      affiliate:affiliates!memberships_affiliate_id_fkey(full_name, document_id, instructor_id),
      plan:plans!memberships_plan_id_fkey(name)
    `)
    .eq('status', 'active')
    .eq('remaining_days', 0)
    .order('expiration_date', { ascending: false })

  if (consumedError) {
    throw new Error(`Error al obtener afiliados con días agotados: ${consumedError.message}`)
  }

  // Get active memberships whose expiration_date has already passed
  const todayStr = new Date().toISOString().split('T')[0]
  const { data: expiredByDateData, error: expiredByDateError } = await supabase
    .from('memberships')
    .select(`
      affiliate_id,
      remaining_days,
      expiration_date,
      affiliate:affiliates!memberships_affiliate_id_fkey(full_name, document_id, instructor_id),
      plan:plans!memberships_plan_id_fkey(name)
    `)
    .eq('status', 'active')
    .lt('expiration_date', todayStr)
    .order('expiration_date', { ascending: false })

  if (expiredByDateError) {
    throw new Error(`Error al obtener afiliados vencidos por fecha: ${expiredByDateError.message}`)
  }

  const allRows = [...(expiredData ?? []), ...(consumedData ?? []), ...(expiredByDateData ?? [])]

  // Deduplicate by affiliate_id (a user can match multiple conditions)
  const seen = new Set<string>()
  const uniqueRows = allRows.filter((row: Record<string, unknown>) => {
    const affiliateId = row.affiliate_id as string
    if (seen.has(affiliateId)) return false
    seen.add(affiliateId)
    return true
  })

  if (uniqueRows.length === 0) return []

  const instructorIdSet = new Set<string>()
  uniqueRows.forEach((r: Record<string, unknown>) => {
    const affiliate = r.affiliate as { instructor_id: string } | null
    if (affiliate?.instructor_id) instructorIdSet.add(affiliate.instructor_id)
  })
  const instructorIds = Array.from(instructorIdSet)

  // Fetch instructor names
  const { data: instructors } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', instructorIds)

  const instructorMap = new Map(
    (instructors ?? []).map((i: { id: string; full_name: string }) => [i.id, i.full_name])
  )

  return uniqueRows.map((row: Record<string, unknown>) => {
    const affiliate = row.affiliate as { full_name: string; document_id: string; instructor_id: string } | null
    const plan = row.plan as { name: string } | null
    return {
      affiliate_id: row.affiliate_id as string,
      full_name: affiliate?.full_name ?? '',
      document_id: affiliate?.document_id ?? '',
      plan_name: plan?.name ?? '',
      remaining_days: row.remaining_days as number | null,
      expiration_date: row.expiration_date as string,
      instructor_name: instructorMap.get(affiliate?.instructor_id ?? '') ?? '',
    }
  })
}

/**
 * Retrieves affiliates with active memberships.
 * RLS handles instructor scoping automatically.
 *
 * @returns Array of affiliate status rows with active memberships
 */
export async function getActiveAffiliates(): Promise<AffiliateStatusRow[]> {
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('memberships')
    .select(`
      affiliate_id,
      remaining_days,
      expiration_date,
      affiliate:affiliates!memberships_affiliate_id_fkey(full_name, document_id, instructor_id),
      plan:plans!memberships_plan_id_fkey(name)
    `)
    .eq('status', 'active')
    .gte('expiration_date', today)
    .order('expiration_date', { ascending: true })

  if (error) {
    throw new Error(`Error al obtener afiliados activos: ${error.message}`)
  }

  const rows = data ?? []
  if (rows.length === 0) return []

  const instructorIdSet = new Set<string>()
  rows.forEach((r: Record<string, unknown>) => {
    const affiliate = r.affiliate as { instructor_id: string } | null
    if (affiliate?.instructor_id) instructorIdSet.add(affiliate.instructor_id)
  })
  const instructorIds = Array.from(instructorIdSet)

  const { data: instructors } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', instructorIds)

  const instructorMap = new Map(
    (instructors ?? []).map((i: { id: string; full_name: string }) => [i.id, i.full_name])
  )

  return rows.map((row: Record<string, unknown>) => {
    const affiliate = row.affiliate as { full_name: string; document_id: string; instructor_id: string } | null
    const plan = row.plan as { name: string } | null
    return {
      affiliate_id: row.affiliate_id as string,
      full_name: affiliate?.full_name ?? '',
      document_id: affiliate?.document_id ?? '',
      plan_name: plan?.name ?? '',
      remaining_days: row.remaining_days as number | null,
      expiration_date: row.expiration_date as string,
      instructor_name: instructorMap.get(affiliate?.instructor_id ?? '') ?? '',
    }
  })
}

/**
 * Retrieves affiliates whose memberships expire within a given threshold
 * OR who have remaining_days <= threshold (for limited plans).
 * RLS handles instructor scoping automatically.
 *
 * @param thresholdDays - Number of days from today to look for expiring memberships
 * @returns Array of affiliate status rows about to expire
 */
export async function getExpiringAffiliates(thresholdDays: number): Promise<AffiliateStatusRow[]> {
  const supabase = createClient()

  const today = new Date()
  const thresholdDate = new Date(today)
  thresholdDate.setDate(thresholdDate.getDate() + thresholdDays)

  const todayStr = today.toISOString().split('T')[0]
  const thresholdStr = thresholdDate.toISOString().split('T')[0]

  // Query all active memberships (we'll filter in code for the dual condition)
  const { data, error } = await supabase
    .from('memberships')
    .select(`
      affiliate_id,
      remaining_days,
      expiration_date,
      affiliate:affiliates!memberships_affiliate_id_fkey(full_name, document_id, instructor_id),
      plan:plans!memberships_plan_id_fkey(name)
    `)
    .eq('status', 'active')
    .gte('expiration_date', todayStr)
    .order('expiration_date', { ascending: true })

  if (error) {
    throw new Error(`Error al obtener afiliados próximos a vencer: ${error.message}`)
  }

  // Filter: expiring by date OR by remaining days (but NOT already consumed with 0 days)
  const rows = (data ?? []).filter((m: Record<string, unknown>) => {
    const remainingDays = m.remaining_days as number | null
    
    // Exclude those with 0 remaining days — they belong in "Vencidos"
    if (remainingDays !== null && remainingDays <= 0) return false
    
    const expiringByDate = (m.expiration_date as string) <= thresholdStr
    const expiringByDays = remainingDays !== null && remainingDays <= thresholdDays
    return expiringByDate || expiringByDays
  })

  if (rows.length === 0) return []

  const instructorIdSet = new Set<string>()
  rows.forEach((r: Record<string, unknown>) => {
    const affiliate = r.affiliate as { instructor_id: string } | null
    if (affiliate?.instructor_id) instructorIdSet.add(affiliate.instructor_id)
  })
  const instructorIds = Array.from(instructorIdSet)

  const { data: instructors } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', instructorIds)

  const instructorMap = new Map(
    (instructors ?? []).map((i: { id: string; full_name: string }) => [i.id, i.full_name])
  )

  return rows.map((row: Record<string, unknown>) => {
    const affiliate = row.affiliate as { full_name: string; document_id: string; instructor_id: string } | null
    const plan = row.plan as { name: string } | null
    return {
      affiliate_id: row.affiliate_id as string,
      full_name: affiliate?.full_name ?? '',
      document_id: affiliate?.document_id ?? '',
      plan_name: plan?.name ?? '',
      remaining_days: row.remaining_days as number | null,
      expiration_date: row.expiration_date as string,
      instructor_name: instructorMap.get(affiliate?.instructor_id ?? '') ?? '',
    }
  })
}

/**
 * Retrieves entry counts grouped by day for a date range.
 * Max range enforced by service layer (90 days).
 *
 * @param dateFrom - Start date (ISO string)
 * @param dateTo - End date (ISO string)
 * @returns Array of daily entry counts
 */
export async function getEntriesByDay(dateFrom: string, dateTo: string): Promise<DailyEntryCount[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('entries')
    .select('entry_date')
    .gte('entry_date', dateFrom)
    .lte('entry_date', dateTo)
    .order('entry_date', { ascending: true })

  if (error) {
    throw new Error(`Error al obtener ingresos por día: ${error.message}`)
  }

  // Group entries by date
  const countMap = new Map<string, number>()
  for (const entry of data ?? []) {
    const date = entry.entry_date
    countMap.set(date, (countMap.get(date) ?? 0) + 1)
  }

  // Fill gaps with zero counts for all dates in range
  const result: DailyEntryCount[] = []
  const current = new Date(dateFrom)
  const end = new Date(dateTo)

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    result.push({
      date: dateStr,
      count: countMap.get(dateStr) ?? 0,
    })
    current.setDate(current.getDate() + 1)
  }

  return result
}

/**
 * Retrieves entry counts grouped by month for a date range.
 * Max range enforced by service layer (12 months).
 *
 * @param dateFrom - Start date (ISO string)
 * @param dateTo - End date (ISO string)
 * @returns Array of monthly entry counts
 */
export async function getEntriesByMonth(dateFrom: string, dateTo: string): Promise<MonthlyEntryCount[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('entries')
    .select('entry_date')
    .gte('entry_date', dateFrom)
    .lte('entry_date', dateTo)
    .order('entry_date', { ascending: true })

  if (error) {
    throw new Error(`Error al obtener ingresos por mes: ${error.message}`)
  }

  // Group entries by month (YYYY-MM)
  const countMap = new Map<string, number>()
  for (const entry of data ?? []) {
    const month = entry.entry_date.substring(0, 7) // "YYYY-MM"
    countMap.set(month, (countMap.get(month) ?? 0) + 1)
  }

  // Fill gaps with zero counts for all months in range
  const result: MonthlyEntryCount[] = []
  const current = new Date(dateFrom)
  current.setDate(1) // Normalize to first day of month
  const end = new Date(dateTo)

  while (current <= end) {
    const monthStr = current.toISOString().split('T')[0].substring(0, 7)
    result.push({
      month: monthStr,
      count: countMap.get(monthStr) ?? 0,
    })
    current.setMonth(current.getMonth() + 1)
  }

  return result
}
