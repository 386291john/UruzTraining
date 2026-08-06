/**
 * Membership repository — encapsulates all database operations for the memberships table.
 * Uses the authenticated Supabase server client so RLS policies apply automatically.
 *
 * Validates: Requirements 3.7, 5.1, 5.2, 5.3, 5.4, 9.2, 14.1, 14.2
 */

import { createClient } from '@/lib/supabase/server'
import { todayColombia, nowColombia } from '@/lib/utils/date.utils'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/types/database'

/** Row type returned from the memberships table */
export type Membership = Tables<'memberships'>

/** Insert type for creating a membership */
export type MembershipInsert = TablesInsert<'memberships'>

/** Update type for modifying a membership */
export type MembershipUpdate = TablesUpdate<'memberships'>

/** Membership with plan details */
export interface MembershipWithPlan extends Membership {
  plans: Tables<'plans'> | null
}

/**
 * Retrieves the current active membership for an affiliate.
 *
 * @param affiliateId - Affiliate UUID
 * @returns The active membership or null if none found
 */
export async function findActiveByAffiliateId(
  affiliateId: string
): Promise<MembershipWithPlan | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('memberships')
    .select('*, plans(*)')
    .eq('affiliate_id', affiliateId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Error al obtener membresía activa: ${error.message}`)
  }

  return data as MembershipWithPlan
}

/**
 * Creates a new membership record.
 *
 * @param membershipData - The membership data to insert
 * @returns The created membership
 */
export async function create(membershipData: MembershipInsert): Promise<Membership> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('memberships')
    .insert(membershipData)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al crear la membresía: ${error.message}`)
  }

  return data
}

/**
 * Updates an existing membership.
 *
 * @param id - Membership UUID
 * @param membershipData - The fields to update
 * @returns The updated membership
 */
export async function update(id: string, membershipData: MembershipUpdate): Promise<Membership> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('memberships')
    .update({ ...membershipData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al actualizar la membresía: ${error.message}`)
  }

  return data
}

/**
 * Finds memberships expiring within a given number of days.
 * Used for notification scheduling and dashboard alerts.
 *
 * @param days - Number of days from now to check for expiration
 * @returns Array of memberships expiring within the threshold
 */
export async function findExpiringWithinDays(days: number): Promise<MembershipWithPlan[]> {
  const supabase = createClient()

  const today = nowColombia()
  const thresholdDate = new Date(today)
  thresholdDate.setDate(thresholdDate.getDate() + days)

  const todayStr = todayColombia()
  const thresholdStr = thresholdDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('memberships')
    .select('*, plans(*)')
    .eq('status', 'active')
    .gte('expiration_date', todayStr)
    .lte('expiration_date', thresholdStr)
    .order('expiration_date', { ascending: true })

  if (error) {
    throw new Error(`Error al buscar membresías por vencer: ${error.message}`)
  }

  return (data ?? []) as MembershipWithPlan[]
}
