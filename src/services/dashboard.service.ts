/**
 * Dashboard service — queries all dashboard metrics.
 * Uses the authenticated Supabase server client so RLS applies automatically
 * (instructor sees only their affiliates, admin sees all).
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */

import { createClient } from '@/lib/supabase/server'
import { todayColombia, nowColombia } from '@/lib/utils/date.utils'

// --- Interfaces ---

/** Birthday affiliate info displayed on the dashboard */
export interface BirthdayAffiliate {
  id: string
  fullName: string
  birthDate: string
  phone: string
}

/** Top plan info displayed on the dashboard */
export interface TopPlan {
  planId: string
  planName: string
  activeCount: number
}

/** Complete dashboard metrics response */
export interface DashboardData {
  totalAffiliates: number
  activeAffiliates: number
  expiredAffiliates: number
  todayEntries: number
  pendingRenewals: number
  todayBirthdays: BirthdayAffiliate[]
  topPlans: TopPlan[]
}

// --- Default notification threshold ---
const DEFAULT_NOTIFICATION_THRESHOLD_DAYS = 2

// --- Service ---

/**
 * Retrieves all dashboard metrics. RLS automatically scopes data:
 * - Instructors see only their own affiliates' data
 * - Admins see all affiliates' data
 *
 * @returns Complete dashboard metrics
 */
export async function getDashboardMetrics(): Promise<DashboardData> {
  const supabase = createClient()

  // Get notification threshold from system_config
  const notificationThreshold = await getNotificationThreshold()

  const today = todayColombia()
  const todayDate = nowColombia()
  const todayMonth = todayDate.getMonth() + 1 // 1-indexed
  const todayDay = todayDate.getDate()

  // Calculate threshold date for pending renewals
  const thresholdDate = new Date(todayDate)
  thresholdDate.setDate(thresholdDate.getDate() + notificationThreshold)
  const thresholdStr = thresholdDate.toISOString().split('T')[0]

  // Execute all queries in parallel for better performance
  const [
    totalResult,
    activeResult,
    todayEntriesResult,
    pendingRenewalsResult,
    birthdaysResult,
    topPlansResult,
  ] = await Promise.all([
    // 1. Total affiliates count
    supabase.from('affiliates').select('id', { count: 'exact', head: true }),

    // 2. Active affiliates (have an active membership with expiration_date >= today)
    supabase
      .from('memberships')
      .select('affiliate_id', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('expiration_date', today),

    // 3. Today entries count
    supabase
      .from('entries')
      .select('id', { count: 'exact', head: true })
      .eq('entry_date', today),

    // 4. Pending renewals: memberships close to expiring by date OR by remaining days
    // Uses two queries and combines counts to avoid OR complexity in Supabase
    supabase
      .from('memberships')
      .select('id, affiliate_id, expiration_date, remaining_days', { count: 'exact', head: false })
      .eq('status', 'active')
      .gte('expiration_date', today),

    // 5. Today birthdays - get all affiliates and filter by month/day in code
    // (Supabase doesn't natively support extract month/day from date easily)
    supabase
      .from('affiliates')
      .select('id, full_name, birth_date, phone'),

    // 6. Top plans - get active memberships with plan info
    supabase
      .from('memberships')
      .select('plan_id, plans(id, name)')
      .eq('status', 'active')
      .gte('expiration_date', today),
  ])

  // Process total affiliates
  const totalAffiliates = totalResult.count ?? 0

  // Process active affiliates
  const activeAffiliates = activeResult.count ?? 0

  // Expired = total - active
  const expiredAffiliates = Math.max(0, totalAffiliates - activeAffiliates)

  // Process today entries
  const todayEntries = todayEntriesResult.count ?? 0

  // Process pending renewals — include memberships expiring by date OR by remaining days
  let pendingRenewals = 0
  if (pendingRenewalsResult.data) {
    for (const m of pendingRenewalsResult.data) {
      // Exclude those with 0 remaining days — they belong in "Vencidos"
      if (m.remaining_days !== null && m.remaining_days <= 0) continue
      
      const expiringByDate = m.expiration_date <= thresholdStr
      const expiringByDays = m.remaining_days !== null && m.remaining_days <= notificationThreshold
      if (expiringByDate || expiringByDays) {
        pendingRenewals++
      }
    }
  }

  // Process birthdays - filter by month and day
  const todayBirthdays: BirthdayAffiliate[] = []
  if (birthdaysResult.data) {
    for (const affiliate of birthdaysResult.data) {
      if (affiliate.birth_date) {
        const birthDate = new Date(affiliate.birth_date + 'T00:00:00')
        if (birthDate.getMonth() + 1 === todayMonth && birthDate.getDate() === todayDay) {
          todayBirthdays.push({
            id: affiliate.id,
            fullName: affiliate.full_name,
            birthDate: affiliate.birth_date,
            phone: affiliate.phone,
          })
        }
      }
    }
  }

  // Process top plans - count active memberships per plan
  const planCounts = new Map<string, { planName: string; count: number }>()
  if (topPlansResult.data) {
    for (const membership of topPlansResult.data) {
      const planId = membership.plan_id
      // plans comes as an object (single relation via FK) from Supabase
      const plan = membership.plans as unknown as { id: string; name: string } | null
      const planName = plan?.name ?? 'Plan desconocido'

      const existing = planCounts.get(planId)
      if (existing) {
        existing.count += 1
      } else {
        planCounts.set(planId, { planName, count: 1 })
      }
    }
  }

  // Sort by count descending and take top 5
  const topPlans: TopPlan[] = Array.from(planCounts.entries())
    .map(([planId, { planName, count }]) => ({
      planId,
      planName,
      activeCount: count,
    }))
    .sort((a, b) => b.activeCount - a.activeCount)
    .slice(0, 5)

  return {
    totalAffiliates,
    activeAffiliates,
    expiredAffiliates,
    todayEntries,
    pendingRenewals,
    todayBirthdays,
    topPlans,
  }
}

/**
 * Retrieves the notification threshold from system_config.
 * Falls back to the default (2 days) if not configured.
 */
async function getNotificationThreshold(): Promise<number> {
  const supabase = createClient()

  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'notification_threshold_days')
    .single()

  if (data?.value && typeof data.value === 'number') {
    return data.value
  }

  // Value might be stored as JSON object or direct number
  if (data?.value && typeof data.value === 'object' && 'days' in (data.value as object)) {
    return (data.value as { days: number }).days
  }

  return DEFAULT_NOTIFICATION_THRESHOLD_DAYS
}
