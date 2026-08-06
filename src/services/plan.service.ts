/**
 * Plan service — business logic for plan management.
 * Handles validation, ownership checks, and enforces business rules
 * before delegating persistence to the repository layer.
 *
 * Validates: Requirements 2.1, 2.2, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10
 */

import * as planRepository from '@/repositories/plan.repository'
import {
  createPlanSchema,
  updatePlanSchema,
  type CreatePlanInput,
  type UpdatePlanInput,
} from '@/lib/validators/plan.validator'
import { assertPermission, type UserRole } from '@/lib/utils/permissions'
import type { PaginationParams, PaginatedResult, Plan } from '@/repositories/plan.repository'

/** Error thrown when a plan is not found */
export class PlanNotFoundError extends Error {
  public readonly statusCode = 404

  constructor(planId: string) {
    super(`Plan con ID '${planId}' no encontrado.`)
    this.name = 'PlanNotFoundError'
  }
}

/** Error thrown when an instructor tries to modify a plan they don't own */
export class PlanOwnershipError extends Error {
  public readonly statusCode = 403

  constructor() {
    super('No tiene permiso para modificar este plan. Solo puede modificar planes propios.')
    this.name = 'PlanOwnershipError'
  }
}

/** Error thrown when attempting to delete a plan that has active affiliates */
export class PlanHasActiveAffiliatesError extends Error {
  public readonly statusCode = 409

  constructor(count: number) {
    super(
      `No se puede eliminar el plan porque tiene ${count} afiliado(s) activo(s) asociado(s).`
    )
    this.name = 'PlanHasActiveAffiliatesError'
  }
}

/** Error thrown when validation fails */
export class PlanValidationError extends Error {
  public readonly statusCode = 400
  public readonly fieldErrors: Record<string, string[]>

  constructor(fieldErrors: Record<string, string[]>) {
    const firstError = Object.values(fieldErrors).flat()[0] ?? 'Error de validación.'
    super(firstError)
    this.name = 'PlanValidationError'
    this.fieldErrors = fieldErrors
  }
}

/**
 * Creates a new plan associated with the given instructor.
 *
 * @param input - Raw input data (will be validated)
 * @param instructorId - UUID of the instructor creating the plan
 * @returns The created plan
 * @throws PlanValidationError if input is invalid
 */
export async function createPlan(
  input: unknown,
  instructorId: string
): Promise<Plan> {
  const parsed = createPlanSchema.safeParse(input)

  if (!parsed.success) {
    const fieldErrors = formatZodErrors(parsed.error)
    throw new PlanValidationError(fieldErrors)
  }

  const data: CreatePlanInput = parsed.data

  return planRepository.create({
    name: data.name,
    allowed_days: data.allowed_days,
    vigency_weeks: data.vigency_weeks,
    price: data.price,
    status: data.status,
    description: data.description ?? null,
    instructor_id: instructorId,
  })
}

/**
 * Updates an existing plan.
 * - Instructors can only update their own plans.
 * - Admins can update any plan.
 *
 * @param planId - UUID of the plan to update
 * @param input - Raw input data (will be validated)
 * @param userId - UUID of the authenticated user
 * @param userRole - Role of the authenticated user
 * @returns The updated plan
 * @throws PlanNotFoundError if plan doesn't exist
 * @throws PlanOwnershipError if instructor tries to update another's plan
 * @throws PlanValidationError if input is invalid
 */
export async function updatePlan(
  planId: string,
  input: unknown,
  userId: string,
  userRole: UserRole
): Promise<Plan> {
  const parsed = updatePlanSchema.safeParse(input)

  if (!parsed.success) {
    const fieldErrors = formatZodErrors(parsed.error)
    throw new PlanValidationError(fieldErrors)
  }

  // Verify the plan exists and check ownership
  const existingPlan = await planRepository.findById(planId)

  if (!existingPlan) {
    throw new PlanNotFoundError(planId)
  }

  // Instructors can only modify their own plans
  if (userRole === 'instructor' && existingPlan.instructor_id !== userId) {
    throw new PlanOwnershipError()
  }

  const data: UpdatePlanInput = parsed.data

  return planRepository.update(planId, {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.allowed_days !== undefined && { allowed_days: data.allowed_days }),
    ...(data.vigency_weeks !== undefined && { vigency_weeks: data.vigency_weeks }),
    ...(data.price !== undefined && { price: data.price }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.description !== undefined && { description: data.description ?? null }),
  })
}

/**
 * Deletes a plan.
 * - Only admins can delete plans.
 * - A plan cannot be deleted if it has active affiliates.
 *
 * @param planId - UUID of the plan to delete
 * @param userId - UUID of the authenticated user
 * @param userRole - Role of the authenticated user
 * @throws PlanNotFoundError if plan doesn't exist
 * @throws PlanHasActiveAffiliatesError if plan has active affiliates
 */
export async function deletePlan(
  planId: string,
  userId: string,
  userRole: UserRole
): Promise<void> {
  // Only admins can delete
  assertPermission(userRole, 'delete')

  // Verify the plan exists
  const existingPlan = await planRepository.findById(planId)

  if (!existingPlan) {
    throw new PlanNotFoundError(planId)
  }

  // Check for active affiliates
  const activeCount = await planRepository.countActiveAffiliatesByPlan(planId)

  if (activeCount > 0) {
    throw new PlanHasActiveAffiliatesError(activeCount)
  }

  await planRepository.deletePlan(planId)
}

/**
 * Retrieves a paginated list of plans.
 * RLS handles scope (instructor sees own, admin sees all).
 *
 * @param pagination - Optional pagination params
 * @returns Paginated plans
 */
export async function getPlans(
  pagination?: PaginationParams
): Promise<PaginatedResult<Plan>> {
  return planRepository.findAll(pagination)
}

/**
 * Retrieves a single plan by ID.
 *
 * @param id - Plan UUID
 * @returns The plan
 * @throws PlanNotFoundError if not found
 */
export async function getPlanById(id: string): Promise<Plan> {
  const plan = await planRepository.findById(id)

  if (!plan) {
    throw new PlanNotFoundError(id)
  }

  return plan
}

/**
 * Retrieves only active plans (for registration/renewal dropdowns).
 *
 * @returns Array of active plans
 */
export async function getActivePlans(): Promise<Plan[]> {
  return planRepository.findActive()
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
