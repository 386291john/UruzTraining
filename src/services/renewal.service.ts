/**
 * Renewal service — business logic for membership renewal.
 * Handles the complete renewal flow: validates plan, marks previous membership,
 * creates new membership with vigency calculation, records immutable renewal history.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

import * as membershipRepository from '@/repositories/membership.repository'
import * as renewalRepository from '@/repositories/renewal.repository'
import * as planRepository from '@/repositories/plan.repository'
import * as affiliateRepository from '@/repositories/affiliate.repository'
import { calculateVigency } from '@/services/vigency.service'
import { sendWelcomeNotification } from '@/services/notification.service'
import { nowColombia } from '@/lib/utils/date.utils'
import { createClient } from '@/lib/supabase/server'

// --- Custom Error Classes ---

/** Error thrown when the selected plan is inactive or not found */
export class InactivePlanError extends Error {
  public readonly statusCode = 400

  constructor(message?: string) {
    super(message ?? 'El plan seleccionado no está activo. Solo puede renovar con planes activos.')
    this.name = 'InactivePlanError'
  }
}

/** Error thrown when the affiliate is not found */
export class AffiliateNotFoundError extends Error {
  public readonly statusCode = 404

  constructor(affiliateId: string) {
    super(`Afiliado con identificador '${affiliateId}' no encontrado.`)
    this.name = 'AffiliateNotFoundError'
  }
}

/** Error thrown when no active membership exists to renew */
export class NoActiveMembershipError extends Error {
  public readonly statusCode = 400

  constructor() {
    super('El afiliado no tiene una membresía activa para renovar.')
    this.name = 'NoActiveMembershipError'
  }
}

// --- Input/Output Types ---

export interface RenewalInput {
  affiliateId: string
  newPlanId: string
  newInstructorId?: string // optional change of instructor
  observations?: string
}

export interface RenewalResult {
  renewal: {
    id: string
    renewal_date: string
    unused_days: number
  }
  newMembership: {
    id: string
    remaining_days: number | null
    expiration_date: string
    plan_name: string
  }
}

// --- Service Functions ---

/**
 * Renews an affiliate's membership.
 *
 * Flow:
 * 1. Validate that newPlanId exists and is active → error if inactive
 * 2. Get current active membership (if any)
 * 3. Get weekend_start_rule from system_config
 * 4. Calculate vigency for new plan using today as acquisition date
 * 5. Mark current membership as 'renewed' (update status)
 * 6. Record unused_days = current remaining_days (or 0 if null/expired)
 * 7. Create new membership with: remaining_days = new plan's allowed_days,
 *    dates from vigency calculation, status='active'
 * 8. If newInstructorId provided, update affiliate's instructor_id
 * 9. Create renewal record (immutable) with all historical data
 * 10. Return renewal result
 *
 * @param input - Renewal input data
 * @param performedBy - UUID of the user performing the renewal
 * @returns The renewal result with new membership details
 */
export async function renew(input: RenewalInput, performedBy: string): Promise<RenewalResult> {
  const { affiliateId, newPlanId, newInstructorId, observations } = input

  // 1. Validate that newPlanId exists and is active
  const newPlan = await planRepository.findById(newPlanId)

  if (!newPlan) {
    throw new InactivePlanError('El plan seleccionado no existe.')
  }

  if (newPlan.status !== 'active') {
    throw new InactivePlanError()
  }

  // 2. Get current active membership
  const currentMembership = await membershipRepository.findActiveByAffiliateId(affiliateId)

  // If no active membership, allow renewal (expired or no plan)
  if (!currentMembership) {
    // Direct renewal — no previous membership to mark
    const weekendStartRuleActive = await getWeekendStartRule()
    const today = nowColombia()
    const vigencyResult = calculateVigency({
      acquisitionDate: today,
      plan: { allowedDays: newPlan.allowed_days, vigencyWeeks: newPlan.vigency_weeks },
      weekendStartRuleActive,
    })

    const newMembership = await membershipRepository.create({
      affiliate_id: affiliateId,
      plan_id: newPlanId,
      usage_start_date: vigencyResult.usageStartDate.toISOString().split('T')[0],
      weeks_count_start_date: vigencyResult.weeksCountStartDate.toISOString().split('T')[0],
      expiration_date: vigencyResult.expirationDate.toISOString().split('T')[0],
      remaining_days: newPlan.allowed_days,
      status: 'active',
    })

    if (newInstructorId) {
      await affiliateRepository.update(affiliateId, { instructor_id: newInstructorId })
    }

    const renewal = await renewalRepository.create({
      affiliate_id: affiliateId,
      previous_plan_id: newPlanId,
      new_plan_id: newPlanId,
      previous_membership_id: newMembership.id,
      new_membership_id: newMembership.id,
      performed_by: performedBy,
      unused_days: 0,
      observations: observations ?? null,
    })

    const affiliateData = await affiliateRepository.findById(affiliateId)
    if (affiliateData) {
      void sendWelcomeNotification(affiliateId, affiliateData.full_name, affiliateData.phone, newPlan.name, newPlan.allowed_days, newPlan.vigency_weeks, vigencyResult.expirationDate.toISOString().split('T')[0])
    }

    return {
      renewal: { id: renewal.id, renewal_date: renewal.renewal_date, unused_days: 0 },
      newMembership: { id: newMembership.id, remaining_days: newMembership.remaining_days, expiration_date: newMembership.expiration_date, plan_name: newPlan.name },
    }
  }

  // Validate: only allow renewal if membership is expired by date OR has 0 remaining days
  const isExpiredByDate = new Date(currentMembership.expiration_date) < nowColombia()
  const isExpiredByDays = currentMembership.remaining_days !== null && currentMembership.remaining_days <= 0

  if (!isExpiredByDate && !isExpiredByDays) {
    throw new Error('No se puede renovar un plan vigente. El afiliado aún tiene días o tiempo disponible.')
  }

  // 3. Get weekend_start_rule from system_config
  const weekendStartRuleActive = await getWeekendStartRule()

  // 4. Calculate vigency for new plan using today (Colombia) as acquisition date
  const today = nowColombia()
  const vigencyResult = calculateVigency({
    acquisitionDate: today,
    plan: {
      allowedDays: newPlan.allowed_days,
      vigencyWeeks: newPlan.vigency_weeks,
    },
    weekendStartRuleActive,
  })

  // 5. Mark current membership as 'renewed'
  await membershipRepository.update(currentMembership.id, {
    status: 'renewed',
  })

  // 6. Calculate unused_days from previous membership
  const unusedDays = currentMembership.remaining_days ?? 0

  // 7. Create new membership with new plan's parameters
  const newMembership = await membershipRepository.create({
    affiliate_id: affiliateId,
    plan_id: newPlanId,
    usage_start_date: vigencyResult.usageStartDate.toISOString().split('T')[0],
    weeks_count_start_date: vigencyResult.weeksCountStartDate.toISOString().split('T')[0],
    expiration_date: vigencyResult.expirationDate.toISOString().split('T')[0],
    remaining_days: newPlan.allowed_days, // NULL for unlimited plans
    status: 'active',
  })

  // 8. If newInstructorId provided, update affiliate's instructor_id
  if (newInstructorId) {
    await affiliateRepository.update(affiliateId, {
      instructor_id: newInstructorId,
    })
  }

  // 9. Create renewal record (immutable)
  const renewal = await renewalRepository.create({
    affiliate_id: affiliateId,
    previous_plan_id: currentMembership.plan_id,
    new_plan_id: newPlanId,
    previous_membership_id: currentMembership.id,
    new_membership_id: newMembership.id,
    performed_by: performedBy,
    unused_days: unusedDays,
    observations: observations ?? null,
  })

  // 10. Send welcome notification for renewal (fire-and-forget)
  const affiliateData = await affiliateRepository.findById(affiliateId)
  if (affiliateData) {
    void sendWelcomeNotification(
      affiliateId,
      affiliateData.full_name,
      affiliateData.phone,
      newPlan.name,
      newPlan.allowed_days,
      newPlan.vigency_weeks,
      vigencyResult.expirationDate.toISOString().split('T')[0]
    )
  }

  // 11. Return renewal result
  return {
    renewal: {
      id: renewal.id,
      renewal_date: renewal.renewal_date,
      unused_days: renewal.unused_days,
    },
    newMembership: {
      id: newMembership.id,
      remaining_days: newMembership.remaining_days,
      expiration_date: newMembership.expiration_date,
      plan_name: newPlan.name,
    },
  }
}

/**
 * Retrieves the renewal history for an affiliate.
 *
 * @param affiliateId - Affiliate UUID
 * @returns Array of renewal records with plan names
 */
export async function getRenewalHistory(affiliateId: string) {
  return renewalRepository.findByAffiliateId(affiliateId)
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
    return true
  }

  const value = data.value as { active?: boolean }
  return value.active ?? true
}
