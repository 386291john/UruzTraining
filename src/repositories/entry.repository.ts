/**
 * Entry repository — encapsulates all database operations for the entries table.
 * Uses the authenticated Supabase server client so RLS policies apply automatically.
 *
 * Validates: Requirements 6.1, 6.6
 */

import { createClient } from '@/lib/supabase/server'
import { todayColombia } from '@/lib/utils/date.utils'
import type { Tables, TablesInsert } from '@/lib/types/database'

/** Row type returned from the entries table */
export type Entry = Tables<'entries'>

/** Insert type for creating an entry */
export type EntryInsert = TablesInsert<'entries'>

/** Date range filter for entry queries */
export interface DateRange {
  from: string
  to: string
}

/**
 * Checks if an affiliate already has an entry registered for today's date.
 * Used to enforce the one-entry-per-day rule.
 *
 * @param affiliateId - Affiliate UUID
 * @returns True if the affiliate already has an entry today
 */
export async function hasEntryToday(affiliateId: string): Promise<boolean> {
  const supabase = createClient()

  const today = todayColombia()

  const { data, error } = await supabase
    .from('entries')
    .select('id')
    .eq('affiliate_id', affiliateId)
    .eq('entry_date', today)
    .limit(1)

  if (error) {
    throw new Error(`Error al verificar ingreso del día: ${error.message}`)
  }

  return (data?.length ?? 0) > 0
}

/**
 * Creates a new entry record.
 *
 * @param data - The entry data to insert
 * @returns The created entry
 */
export async function create(data: EntryInsert): Promise<Entry> {
  const supabase = createClient()

  const { data: entry, error } = await supabase
    .from('entries')
    .insert(data)
    .select()
    .single()

  if (error) {
    // Handle unique constraint violation (duplicate entry for same day)
    if (error.code === '23505') {
      throw new Error('El afiliado ya registró ingreso hoy')
    }
    throw new Error(`Error al registrar ingreso: ${error.message}`)
  }

  return entry
}

/**
 * Retrieves entries for a specific affiliate, optionally filtered by date range.
 * Used for reports and entry history.
 *
 * @param affiliateId - Affiliate UUID
 * @param dateRange - Optional date range filter (from/to as ISO date strings)
 * @returns Array of entries for the affiliate
 */
export async function getEntriesByAffiliate(
  affiliateId: string,
  dateRange?: DateRange
): Promise<Entry[]> {
  const supabase = createClient()

  let query = supabase
    .from('entries')
    .select('*')
    .eq('affiliate_id', affiliateId)
    .order('entry_date', { ascending: false })

  if (dateRange) {
    query = query.gte('entry_date', dateRange.from).lte('entry_date', dateRange.to)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Error al obtener historial de ingresos: ${error.message}`)
  }

  return data ?? []
}
