/**
 * Zod validation schemas for plan CRUD operations.
 *
 * Validates: Requirements 2.1, 2.7
 */

import { z } from 'zod'
import { FIELD_LIMITS } from '@/lib/utils/constants'

/**
 * Schema for creating a new plan.
 * - name: required, 1–100 characters
 * - allowed_days: integer >= 1, or null for unlimited
 * - vigency_weeks: integer >= 1
 * - price: numeric >= 0
 * - status: 'active' | 'inactive', defaults to 'active'
 * - description: max 500 characters, nullable/optional
 */
export const createPlanSchema = z.object({
  name: z
    .string({ error: 'El nombre es obligatorio.' })
    .min(1, 'El nombre no puede estar vacío.')
    .max(FIELD_LIMITS.PLAN_NAME_MAX, `El nombre no puede exceder ${FIELD_LIMITS.PLAN_NAME_MAX} caracteres.`),
  allowed_days: z
    .number({ error: 'Los días permitidos deben ser un número.' })
    .int('Los días permitidos deben ser un entero.')
    .min(1, 'Los días permitidos deben ser al menos 1.')
    .nullable(),
  vigency_weeks: z
    .number({ error: 'Las semanas de vigencia son obligatorias.' })
    .int('Las semanas de vigencia deben ser un entero.')
    .min(1, 'Las semanas de vigencia deben ser al menos 1.'),
  price: z
    .number({ error: 'El precio es obligatorio.' })
    .min(0, 'El precio no puede ser negativo.'),
  status: z
    .enum(['active', 'inactive'], {
      error: 'El estado debe ser "active" o "inactive".',
    })
    .default('active'),
  description: z
    .string()
    .max(FIELD_LIMITS.PLAN_DESCRIPTION_MAX, `La descripción no puede exceder ${FIELD_LIMITS.PLAN_DESCRIPTION_MAX} caracteres.`)
    .nullable()
    .optional(),
})

/**
 * Schema for updating an existing plan.
 * All fields are optional (partial update).
 */
export const updatePlanSchema = createPlanSchema.partial()

/** Inferred type for plan creation input */
export type CreatePlanInput = z.infer<typeof createPlanSchema>

/** Inferred type for plan update input */
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>
