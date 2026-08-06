/**
 * Zod validation schemas for affiliate CRUD operations.
 *
 * Validates: Requirements 3.1, 3.3, 3.6, 3.9, 7.1, 7.2, 7.3
 */

import { z } from 'zod'
import { FIELD_LIMITS } from '@/lib/utils/constants'

/**
 * Schema for creating a new affiliate.
 * - document_id: 5–15 numeric characters
 * - full_name: 3–100 characters
 * - pin: exactly 4 numeric digits
 * - birth_date: valid date, not in the future
 * - phone: 7–15 numeric characters
 * - plan_id: valid UUID
 * - observations: max 500 characters, nullable/optional
 */
export const createAffiliateSchema = z.object({
  document_id: z
    .string({ error: 'El documento de identidad es obligatorio.' })
    .min(5, 'El documento debe tener al menos 5 caracteres.')
    .max(15, 'El documento no puede exceder 15 caracteres.')
    .regex(/^\d+$/, 'Solo dígitos numéricos.'),
  full_name: z
    .string({ error: 'El nombre completo es obligatorio.' })
    .min(3, 'El nombre debe tener al menos 3 caracteres.')
    .max(FIELD_LIMITS.NAME_MAX, `El nombre no puede exceder ${FIELD_LIMITS.NAME_MAX} caracteres.`),
  pin: z
    .string({ error: 'El PIN es obligatorio.' })
    .length(FIELD_LIMITS.PIN_LENGTH, `El PIN debe tener exactamente ${FIELD_LIMITS.PIN_LENGTH} dígitos.`)
    .regex(/^\d{4}$/, 'Debe ser exactamente 4 dígitos numéricos.'),
  birth_date: z
    .string({ error: 'La fecha de nacimiento es obligatoria.' })
    .refine(
      (val) => {
        const date = new Date(val)
        return !isNaN(date.getTime()) && date <= new Date()
      },
      'La fecha de nacimiento no puede ser futura.'
    ),
  phone: z
    .string({ error: 'El número de celular es obligatorio.' })
    .min(FIELD_LIMITS.PHONE_MIN, `El teléfono debe tener al menos ${FIELD_LIMITS.PHONE_MIN} dígitos.`)
    .max(FIELD_LIMITS.PHONE_MAX, `El teléfono no puede exceder ${FIELD_LIMITS.PHONE_MAX} dígitos.`)
    .regex(/^\d+$/, 'Solo dígitos numéricos.'),
  plan_id: z
    .string({ error: 'El plan es obligatorio.' })
    .uuid('Plan requerido.'),
  observations: z
    .string()
    .max(FIELD_LIMITS.NOTES_MAX, `Las observaciones no pueden exceder ${FIELD_LIMITS.NOTES_MAX} caracteres.`)
    .nullable()
    .optional(),
})

/**
 * Schema for updating a PIN.
 * - pin: exactly 4 numeric digits
 */
export const updatePinSchema = z.object({
  pin: z
    .string({ error: 'El PIN es obligatorio.' })
    .length(FIELD_LIMITS.PIN_LENGTH, `El PIN debe tener exactamente ${FIELD_LIMITS.PIN_LENGTH} dígitos.`)
    .regex(/^\d{4}$/, 'Debe ser exactamente 4 dígitos numéricos.'),
})

/**
 * Schema for search parameters.
 * - field: one of 'document_id', 'full_name', 'phone'
 * - term: at least 3 characters
 */
export const searchAffiliateSchema = z.object({
  field: z.enum(['document_id', 'full_name', 'phone'], {
    error: 'Campo de búsqueda inválido.',
  }),
  term: z
    .string({ error: 'El término de búsqueda es obligatorio.' })
    .min(3, 'El término de búsqueda debe tener al menos 3 caracteres.'),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

/** Inferred type for affiliate creation input */
export type CreateAffiliateInput = z.infer<typeof createAffiliateSchema>

/** Inferred type for PIN update input */
export type UpdatePinInput = z.infer<typeof updatePinSchema>

/** Inferred type for search input */
export type SearchAffiliateInput = z.infer<typeof searchAffiliateSchema>
