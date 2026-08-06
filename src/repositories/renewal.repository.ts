/**
 * Renewal repository — encapsulates all database operations for the renewals table.
 * The renewals table is IMMUTABLE: only INSERT and SELECT operations are allowed.
 * No UPDATE or DELETE operations exist by design.
 *
 * Validates: Requirements 8.4, 8.5
 */

import { createClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert } from '@/lib/types/database'

/** Row type returned from the renewals table */
export type Renewal = Tables<'renewals'>

/** Insert type for creating a renewal record */
export type RenewalInsert = TablesInsert<'renewals'>

/** Renewal with plan names for display */
export interface RenewalWithPlanNames extends Renewal {
  previous_plan: { name: string } | null
  new_plan: { name: string } | null
  performer: { full_name: string } | null
}

/**
 * Creates a new renewal record.
 * This is an immutable INSERT — no updates or deletions are permitted.
 *
 * @param renewalData - The renewal data to insert
 * @returns The created renewal record
 */
export async function create(renewalData: RenewalInsert): Promise<Renewal> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('renewals')
    .insert(renewalData)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al registrar la renovación: ${error.message}`)
  }

  return data
}

/**
 * Retrieves the renewal history for an affiliate, ordered by most recent first.
 * Includes previous and new plan names for display purposes.
 *
 * @param affiliateId - Affiliate UUID
 * @returns Array of renewal records with plan names
 */
export async function findByAffiliateId(
  affiliateId: string
): Promise<RenewalWithPlanNames[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('renewals')
    .select(`
      *,
      previous_plan:plans!renewals_previous_plan_id_fkey(name),
      new_plan:plans!renewals_new_plan_id_fkey(name),
      performer:profiles!renewals_performed_by_fkey(full_name)
    `)
    .eq('affiliate_id', affiliateId)
    .order('renewal_date', { ascending: false })

  if (error) {
    throw new Error(`Error al obtener historial de renovaciones: ${error.message}`)
  }

  return (data ?? []) as RenewalWithPlanNames[]
}
