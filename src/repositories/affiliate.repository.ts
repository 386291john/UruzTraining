/**
 * Affiliate repository — encapsulates all database operations for the affiliates table.
 * Uses the authenticated Supabase server client so RLS policies apply automatically.
 *
 * Validates: Requirements 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { createClient } from '@/lib/supabase/server'
import { PAGINATION } from '@/lib/utils/constants'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/types/database'

/** Row type returned from the affiliates table */
export type Affiliate = Tables<'affiliates'>

/** Insert type for creating an affiliate */
export type AffiliateInsert = TablesInsert<'affiliates'>

/** Update type for modifying an affiliate */
export type AffiliateUpdate = TablesUpdate<'affiliates'>

/** Search field options */
export type SearchField = 'document_id' | 'full_name' | 'phone'

/** Search parameters */
export interface SearchParams {
  field: SearchField
  term: string
  page?: number
  pageSize?: number
}

/** Paginated result wrapper */
export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** Affiliate with active membership info */
export interface AffiliateWithMembership extends Affiliate {
  memberships: Array<Tables<'memberships'>> | null
}

/**
 * Retrieves a single affiliate by ID, including their current active membership.
 *
 * @param id - Affiliate UUID
 * @returns The affiliate with active membership or null if not found
 */
export async function findById(id: string): Promise<AffiliateWithMembership | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('affiliates')
    .select('*, memberships(*)')
    .eq('id', id)
    .eq('memberships.status', 'active')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Error al obtener el afiliado: ${error.message}`)
  }

  return data as AffiliateWithMembership
}

/**
 * Finds an affiliate by exact document_id.
 * Used for duplicate checks during registration.
 *
 * @param documentId - The document ID to search for
 * @returns The affiliate or null if not found
 */
export async function findByDocumentId(documentId: string): Promise<Affiliate | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('affiliates')
    .select('*')
    .eq('document_id', documentId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Error al buscar afiliado por documento: ${error.message}`)
  }

  return data
}

/**
 * Lists all affiliates with pagination (no search filter).
 * Includes active membership info (plan name, status, expiration date).
 * RLS automatically filters by instructor for non-admin users.
 *
 * @param page - Page number
 * @param pageSize - Page size
 * @returns Paginated list of all affiliates with membership info
 */
export async function listAll(page: number = 1, pageSize: number = 20): Promise<PaginatedResult<Affiliate>> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = createClient()

  const { data, error, count } = await supabase
    .from('affiliates')
    .select('*, memberships(status, expiration_date, remaining_days, plans(name))', { count: 'exact' })
    .order('full_name', { ascending: true })
    .range(from, to)

  if (error) {
    throw new Error(`Error al listar afiliados: ${error.message}`)
  }

  const total = count ?? 0

  return {
    data: data ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * Searches affiliates with partial matching and pagination.
 * - For full_name: uses ILIKE for case-insensitive partial match (GIN trigram index supports this)
 * - For document_id/phone: uses ILIKE with %term%
 *
 * RLS automatically filters by instructor for non-admin users.
 *
 * @param params - Search field, term, and pagination
 * @returns Paginated search results
 */
export async function search(params: SearchParams): Promise<PaginatedResult<Affiliate>> {
  const page = params.page ?? PAGINATION.DEFAULT_PAGE
  const pageSize = Math.min(
    params.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE,
    PAGINATION.MAX_PAGE_SIZE
  )

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = createClient()

  let query = supabase
    .from('affiliates')
    .select('*, memberships(status, expiration_date, remaining_days, plans(name))', { count: 'exact' })

  // Apply partial search based on field
  const searchPattern = `%${params.term}%`

  switch (params.field) {
    case 'full_name':
      query = query.ilike('full_name', searchPattern)
      break
    case 'document_id':
      query = query.ilike('document_id', searchPattern)
      break
    case 'phone':
      query = query.ilike('phone', searchPattern)
      break
  }

  const { data, error, count } = await query
    .order('full_name', { ascending: true })
    .range(from, to)

  if (error) {
    throw new Error(`Error al buscar afiliados: ${error.message}`)
  }

  const total = count ?? 0

  return {
    data: data ?? [],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/**
 * Creates a new affiliate record.
 *
 * @param affiliateData - The affiliate data to insert
 * @returns The created affiliate
 */
export async function create(affiliateData: AffiliateInsert): Promise<Affiliate> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('affiliates')
    .insert(affiliateData)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al crear el afiliado: ${error.message}`)
  }

  return data
}

/**
 * Updates an existing affiliate.
 *
 * @param id - Affiliate UUID
 * @param affiliateData - The fields to update
 * @returns The updated affiliate
 */
export async function update(id: string, affiliateData: AffiliateUpdate): Promise<Affiliate> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('affiliates')
    .update({ ...affiliateData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al actualizar el afiliado: ${error.message}`)
  }

  return data
}

/**
 * Updates only the PIN field for an affiliate.
 *
 * @param id - Affiliate UUID
 * @param newPin - The new 4-digit PIN
 * @returns The updated affiliate
 */
export async function updatePin(id: string, newPin: string): Promise<Affiliate> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('affiliates')
    .update({ pin: newPin, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al actualizar el PIN: ${error.message}`)
  }

  return data
}

/**
 * Deletes an affiliate by ID. Only admins can perform this via RLS.
 *
 * @param id - Affiliate UUID
 */
export async function deleteAffiliate(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('affiliates').delete().eq('id', id)

  if (error) {
    throw new Error(`Error al eliminar el afiliado: ${error.message}`)
  }
}
