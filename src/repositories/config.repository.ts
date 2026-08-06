/**
 * Config repository — encapsulates all database operations for the system_config table.
 * Uses the authenticated Supabase server client so RLS policies apply automatically.
 *
 * Validates: Requirements 7.1, 7.2
 */

import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/lib/types/database'
import type { Json } from '@/lib/types/database'

/** Row type returned from the system_config table */
export type SystemConfig = Tables<'system_config'>

/**
 * Retrieves all system configuration entries.
 *
 * @returns Array of all config entries
 */
export async function getAll(): Promise<SystemConfig[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .order('key', { ascending: true })

  if (error) {
    throw new Error(`Error al obtener configuraciones: ${error.message}`)
  }

  return data ?? []
}

/**
 * Retrieves a single config entry by its unique key.
 *
 * @param key - The config key to look up
 * @returns The config entry or null if not found
 */
export async function getByKey(key: string): Promise<SystemConfig | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .eq('key', key)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Error al obtener configuración '${key}': ${error.message}`)
  }

  return data
}

/**
 * Updates the value of a config entry identified by its key.
 *
 * @param key - The config key to update
 * @param value - The new JSON value
 * @param updatedBy - UUID of the user performing the update
 * @returns The updated config entry
 */
export async function updateByKey(
  key: string,
  value: Json,
  updatedBy: string
): Promise<SystemConfig> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('system_config')
    .update({
      value,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq('key', key)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(`Configuración '${key}' no encontrada.`)
    }
    throw new Error(`Error al actualizar configuración '${key}': ${error.message}`)
  }

  return data
}
