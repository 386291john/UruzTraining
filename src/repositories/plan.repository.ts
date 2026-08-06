/**
 * Plan repository — encapsulates all database operations for the plans table.
 * Uses the authenticated Supabase server client so RLS policies apply automatically.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9
 */

import { createClient } from '@/lib/supabase/server'
import { PAGINATION } from '@/lib/utils/constants'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/types/database'

/** Row type returned from the plans table */
export type Plan = Tables<'plans'>

/** Insert type for creating a plan */
export type PlanInsert = TablesInsert<'plans'>

/** Update type for modifying a plan */
export type PlanUpdate = TablesUpdate<'plans'>

/** Pagination parameters accepted by list queries */
export interface PaginationParams {
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

/**
 * Retrieves a paginated list of plans.
 * RLS automatically filters by instructor for non-admin users.
 *
 * @param pagination - Optional page and pageSize
 * @returns Paginated plan results
 */
export async function findAll(
  pagination?: PaginationParams
): Promise<PaginatedResult<Plan>> {
  const page = pagination?.page ?? PAGINATION.DEFAULT_PAGE
  const pageSize = Math.min(
    pagination?.pageSize ?? PAGINATION.DEFAULT_PAGE_SIZE,
    PAGINATION.MAX_PAGE_SIZE
  )

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = createClient()

  const { data, error, count } = await supabase
    .from('plans')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    throw new Error(`Error al obtener planes: ${error.message}`)
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
 * Retrieves a single plan by ID.
 *
 * @param id - Plan UUID
 * @returns The plan or null if not found / not accessible
 */
export async function findById(id: string): Promise<Plan | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    // PGRST116 = no rows found
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Error al obtener el plan: ${error.message}`)
  }

  return data
}

/**
 * Retrieves all plans with status 'active'.
 * Used for dropdowns in affiliate registration and renewal.
 *
 * @returns Array of active plans
 */
export async function findActive(): Promise<Plan[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('status', 'active')
    .order('name', { ascending: true })

  if (error) {
    throw new Error(`Error al obtener planes activos: ${error.message}`)
  }

  return data ?? []
}

/**
 * Creates a new plan.
 *
 * @param planData - The plan data to insert
 * @returns The created plan
 */
export async function create(planData: PlanInsert): Promise<Plan> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('plans')
    .insert(planData)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al crear el plan: ${error.message}`)
  }

  return data
}

/**
 * Updates an existing plan.
 *
 * @param id - Plan UUID
 * @param planData - The fields to update
 * @returns The updated plan
 */
export async function update(id: string, planData: PlanUpdate): Promise<Plan> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('plans')
    .update({ ...planData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Error al actualizar el plan: ${error.message}`)
  }

  return data
}

/**
 * Deletes a plan by ID.
 *
 * @param id - Plan UUID
 */
export async function deletePlan(id: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.from('plans').delete().eq('id', id)

  if (error) {
    throw new Error(`Error al eliminar el plan: ${error.message}`)
  }
}

/**
 * Counts the number of active affiliates associated with a given plan.
 * An affiliate is considered "active" if they have a membership with status 'active'
 * referencing this plan.
 *
 * @param planId - Plan UUID
 * @returns The count of active affiliates using this plan
 */
export async function countActiveAffiliatesByPlan(planId: string): Promise<number> {
  const supabase = createClient()

  const { count, error } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .eq('status', 'active')

  if (error) {
    throw new Error(`Error al contar afiliados activos del plan: ${error.message}`)
  }

  return count ?? 0
}
