/**
 * Affiliate service — business logic for affiliate management.
 * Handles registration (with auto-assigned instructor, current date, vigency calculation),
 * search, PIN update, and profile retrieval.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.1, 4.2, 4.3, 4.8, 7.1, 7.2, 7.3
 */

import * as affiliateRepository from '@/repositories/affiliate.repository'
import * as membershipRepository from '@/repositories/membership.repository'
import * as planRepository from '@/repositories/plan.repository'
import {
  createAffiliateSchema,
  updatePinSchema,
  searchAffiliateSchema,
  type CreateAffiliateInput,
  type SearchAffiliateInput,
} from '@/lib/validators/affiliate.validator'
import { calculateVigency } from '@/services/vigency.service'
import { sendWelcomeNotification } from '@/services/notification.service'
import { nowColombia } from '@/lib/utils/date.utils'
import { createClient } from '@/lib/supabase/server'
import type { Affiliate } from '@/repositories/affiliate.repository'
import type { Membership } from '@/repositories/membership.repository'

// --- Custom Error Classes ---

/** Error thrown when validation fails */
export class AffiliateValidationError extends Error {
  public readonly statusCode = 400
  public readonly fieldErrors: Record<string, string[]>

  constructor(fieldErrors: Record<string, string[]>) {
    const firstError = Object.values(fieldErrors).flat()[0] ?? 'Error de validación.'
    super(firstError)
    this.name = 'AffiliateValidationError'
    this.fieldErrors = fieldErrors
  }
}

/** Error thrown when a duplicate document_id is found */
export class DuplicateDocumentError extends Error {
  public readonly statusCode = 409

  constructor(documentId: string) {
    super(`Ya existe un afiliado registrado con el documento '${documentId}'.`)
    this.name = 'DuplicateDocumentError'
  }
}

/** Error thrown when an affiliate is not found */
export class AffiliateNotFoundError extends Error {
  public readonly statusCode = 404

  constructor(identifier: string) {
    super(`Afiliado con identificador '${identifier}' no encontrado.`)
    this.name = 'AffiliateNotFoundError'
  }
}

/** Error thrown when the selected plan is not valid */
export class InvalidPlanError extends Error {
  public readonly statusCode = 400

  constructor(message: string) {
    super(message)
    this.name = 'InvalidPlanError'
  }
}

// --- Service Result Types ---

export interface RegisterAffiliateResult {
  affiliate: Affiliate
  membership: Membership
}

// --- Service Functions ---

/**
 * Registers a new affiliate with auto-assigned instructor and vigency calculation.
 *
 * Flow:
 * 1. Validate input (Zod)
 * 2. Check if document_id already exists → error
 * 3. Fetch the selected plan (must be active)
 * 4. Create affiliate record (auto-assign instructor, current date)
 * 5. Calculate vigency using VigencyService (fetch weekend_start_rule from system_config)
 * 6. Create membership with calculated dates
 * 7. Return affiliate + membership data
 *
 * @param input - Raw input data (will be validated)
 * @param instructorId - UUID of the authenticated instructor
 * @returns The created affiliate and membership
 */
export async function registerAffiliate(
  input: unknown,
  instructorId: string
): Promise<RegisterAffiliateResult> {
  // 1. Validate input
  const parsed = createAffiliateSchema.safeParse(input)

  if (!parsed.success) {
    const fieldErrors = formatZodErrors(parsed.error)
    throw new AffiliateValidationError(fieldErrors)
  }

  const data: CreateAffiliateInput = parsed.data

  // 2. Check for duplicate document_id
  const existing = await affiliateRepository.findByDocumentId(data.document_id)

  if (existing) {
    throw new DuplicateDocumentError(data.document_id)
  }

  // 3. Fetch the selected plan and verify it's active
  const plan = await planRepository.findById(data.plan_id)

  if (!plan) {
    throw new InvalidPlanError('El plan seleccionado no existe.')
  }

  if (plan.status !== 'active') {
    throw new InvalidPlanError('El plan seleccionado no está activo. Solo puede seleccionar planes activos.')
  }

  // 4. Create affiliate record
  const affiliate = await affiliateRepository.create({
    document_id: data.document_id,
    full_name: data.full_name,
    pin: data.pin,
    birth_date: data.birth_date,
    phone: data.phone,
    instructor_id: instructorId,
    observations: data.observations ?? null,
  })

  // 5. Calculate vigency (fetch weekend_start_rule from system_config)
  const weekendStartRuleActive = await getWeekendStartRule()

  const vigencyResult = calculateVigency({
    acquisitionDate: nowColombia(),
    plan: {
      allowedDays: plan.allowed_days,
      vigencyWeeks: plan.vigency_weeks,
    },
    weekendStartRuleActive,
  })

  // 6. Create membership with calculated dates
  const membership = await membershipRepository.create({
    affiliate_id: affiliate.id,
    plan_id: data.plan_id,
    usage_start_date: vigencyResult.usageStartDate.toISOString().split('T')[0],
    weeks_count_start_date: vigencyResult.weeksCountStartDate.toISOString().split('T')[0],
    expiration_date: vigencyResult.expirationDate.toISOString().split('T')[0],
    remaining_days: plan.allowed_days, // NULL for unlimited plans
    status: 'active',
  })

  // 7. Send welcome notification (fire-and-forget, won't block registration)
  void sendWelcomeNotification(
    affiliate.id,
    affiliate.full_name,
    affiliate.phone,
    plan.name,
    plan.allowed_days,
    plan.vigency_weeks,
    vigencyResult.expirationDate.toISOString().split('T')[0]
  )

  // 8. Return result
  return { affiliate, membership }
}

/**
 * Lists all affiliates with pagination (no search filter).
 * Maps data to the search result format (with plan, status, expiration).
 *
 * @param page - Page number (default 1)
 * @param pageSize - Page size (default 20)
 * @returns Paginated list of all affiliates in search result format
 */
export async function listAllAffiliates(
  page: number = 1,
  pageSize: number = 20
) {
  const result = await affiliateRepository.listAll(page, pageSize)

  // Map to the same format the frontend expects from search results
  const mappedData = result.data.map((affiliate: any) => {
    // Find the active membership (if any)
    const memberships = affiliate.memberships ?? []
    const activeMembership = memberships.find((m: any) => m.status === 'active')

    return {
      id: affiliate.id,
      document_id: affiliate.document_id,
      full_name: affiliate.full_name,
      phone: affiliate.phone,
      plan_name: activeMembership?.plans?.name ?? null,
      status: activeMembership ? activeMembership.status : 'no_membership',
      expiration_date: activeMembership?.expiration_date ?? null,
    }
  })

  return {
    data: mappedData,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  }
}

/**
 * Searches affiliates by field with partial matching and pagination.
 * Validates that the search term has at least 3 characters.
 *
 * @param params - Raw search parameters (will be validated)
 * @returns Paginated search results
 */
export async function searchAffiliates(
  params: unknown
) {
  const parsed = searchAffiliateSchema.safeParse(params)

  if (!parsed.success) {
    const fieldErrors = formatZodErrors(parsed.error)
    throw new AffiliateValidationError(fieldErrors)
  }

  const searchParams: SearchAffiliateInput = parsed.data

  const result = await affiliateRepository.search({
    field: searchParams.field,
    term: searchParams.term,
    page: searchParams.page,
    pageSize: searchParams.pageSize,
  })

  // Map to search result format with membership info
  const mappedData = result.data.map((affiliate: any) => {
    const memberships = affiliate.memberships ?? []
    const activeMembership = memberships.find((m: any) => m.status === 'active')

    return {
      id: affiliate.id,
      document_id: affiliate.document_id,
      full_name: affiliate.full_name,
      phone: affiliate.phone,
      plan_name: activeMembership?.plans?.name ?? null,
      status: activeMembership ? activeMembership.status : 'no_membership',
      expiration_date: activeMembership?.expiration_date ?? null,
    }
  })

  return {
    data: mappedData,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  }
}

/**
 * Updates the PIN of an affiliate.
 * Validates that the new PIN is exactly 4 numeric digits.
 *
 * @param affiliateId - UUID of the affiliate
 * @param input - Raw PIN update input (will be validated)
 * @returns The updated affiliate
 */
export async function updatePin(
  affiliateId: string,
  input: unknown
): Promise<Affiliate> {
  // Validate PIN format
  const parsed = updatePinSchema.safeParse(input)

  if (!parsed.success) {
    const fieldErrors = formatZodErrors(parsed.error)
    throw new AffiliateValidationError(fieldErrors)
  }

  // Verify affiliate exists
  const existing = await affiliateRepository.findById(affiliateId)

  if (!existing) {
    throw new AffiliateNotFoundError(affiliateId)
  }

  return affiliateRepository.updatePin(affiliateId, parsed.data.pin)
}

/**
 * Retrieves an affiliate's full profile including membership and plan info.
 * Returns a flat object matching the AffiliateProfile shape expected by the frontend.
 *
 * @param id - Affiliate UUID
 * @returns The affiliate profile with membership details in flat format
 */
export async function getAffiliateProfile(id: string) {
  const affiliate = await affiliateRepository.findById(id)

  if (!affiliate) {
    throw new AffiliateNotFoundError(id)
  }

  // Get active membership with plan details
  const activeMembership = await membershipRepository.findActiveByAffiliateId(id)

  // Get renewal history
  const renewalHistory = await getRenewalHistory(id)

  // Map to flat format expected by the frontend
  return {
    id: affiliate.id,
    document_id: affiliate.document_id,
    full_name: affiliate.full_name,
    phone: affiliate.phone,
    birth_date: affiliate.birth_date,
    observations: affiliate.observations,
    instructor_id: affiliate.instructor_id,
    created_at: affiliate.created_at,
    updated_at: affiliate.updated_at,
    membership: activeMembership
      ? {
          plan_name: activeMembership.plans?.name ?? '',
          allowed_days: activeMembership.plans?.allowed_days ?? null,
          days_remaining: activeMembership.remaining_days,
          expiration_date: activeMembership.expiration_date,
          status: activeMembership.status,
        }
      : null,
    renewal_history: renewalHistory,
  }
}

/**
 * Retrieves the renewal history for an affiliate.
 */
async function getRenewalHistory(affiliateId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('renewals')
    .select(`
      renewal_date,
      previous_plan_id,
      new_plan_id,
      performed_by,
      unused_days,
      observations,
      previous_plan:plans!renewals_previous_plan_id_fkey(name),
      new_plan:plans!renewals_new_plan_id_fkey(name)
    `)
    .eq('affiliate_id', affiliateId)
    .order('renewal_date', { ascending: false })

  if (error) {
    // Non-critical: return empty array if renewals query fails
    return []
  }

  return (data ?? []).map((r: any) => ({
    renewed_at: r.renewal_date,
    previous_plan_name: r.previous_plan?.name ?? '—',
    new_plan_name: r.new_plan?.name ?? '—',
    instructor_id: r.performed_by,
    unused_days: r.unused_days,
    observations: r.observations,
  }))
}

// --- Private Helpers ---

/**
 * Fetches the weekend_start_rule value from system_config.
 * Defaults to true (active) if not found.
 */
async function getWeekendStartRule(): Promise<boolean> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'weekend_start_rule')
    .single()

  if (error || !data) {
    // Default to active if config not found
    return true
  }

  const value = data.value as { active?: boolean }
  return value.active ?? true
}

/**
 * Formats Zod validation errors into a field-keyed error map.
 */
function formatZodErrors(
  error: import('zod').ZodError
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root'
    if (!fieldErrors[path]) {
      fieldErrors[path] = []
    }
    fieldErrors[path].push(issue.message)
  }

  return fieldErrors
}
