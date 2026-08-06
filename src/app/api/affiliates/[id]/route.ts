/**
 * API Route Handlers for /api/affiliates/[id]
 * GET: Get affiliate profile with active membership and plan info
 * PUT: Update affiliate fields (admin or owning instructor)
 * DELETE: Delete affiliate (admin only)
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.6, 4.7, 4.8, 7.4, 12.3, 12.4, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/utils/api-helpers'
import { sanitizeFields } from '@/lib/utils/sanitize'
import { handleRouteError } from '@/lib/utils/error-handler'
import * as affiliateService from '@/services/affiliate.service'
import {
  AffiliateNotFoundError,
  AffiliateValidationError,
} from '@/services/affiliate.service'
import * as affiliateRepository from '@/repositories/affiliate.repository'
import { z } from 'zod'
import { FIELD_LIMITS } from '@/lib/utils/constants'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Schema for updating affiliate fields.
 * All fields are optional (partial update).
 */
const updateAffiliateSchema = z.object({
  full_name: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres.')
    .max(FIELD_LIMITS.NAME_MAX, `El nombre no puede exceder ${FIELD_LIMITS.NAME_MAX} caracteres.`)
    .optional(),
  phone: z
    .string()
    .min(FIELD_LIMITS.PHONE_MIN, `El teléfono debe tener al menos ${FIELD_LIMITS.PHONE_MIN} dígitos.`)
    .max(FIELD_LIMITS.PHONE_MAX, `El teléfono no puede exceder ${FIELD_LIMITS.PHONE_MAX} dígitos.`)
    .regex(/^\d+$/, 'Solo dígitos numéricos.')
    .optional(),
  birth_date: z
    .string()
    .refine(
      (val) => {
        const date = new Date(val)
        return !isNaN(date.getTime()) && date <= new Date()
      },
      'La fecha de nacimiento no puede ser futura.'
    )
    .optional(),
  observations: z
    .string()
    .max(FIELD_LIMITS.NOTES_MAX, `Las observaciones no pueden exceder ${FIELD_LIMITS.NOTES_MAX} caracteres.`)
    .nullable()
    .optional(),
})

/**
 * GET /api/affiliates/[id]
 * Returns the affiliate profile with active membership and plan info.
 * Returns 404 if affiliate not found.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const { id } = await context.params

    const profile = await affiliateService.getAffiliateProfile(id)

    return NextResponse.json(
      { success: true, data: profile },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof AffiliateNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        },
        { status: 404 }
      )
    }

    return handleRouteError(error, {
      operation: 'GET /api/affiliates/[id]',
      method: 'GET',
      path: '/api/affiliates/[id]',
    })
  }
}

/**
 * PUT /api/affiliates/[id]
 * Updates affiliate fields. Only admin or the owning instructor can update.
 * Validates body with Zod schema.
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const { id } = await context.params
    const body = await request.json()

    // Sanitize text fields to prevent XSS (Requirement 12.4)
    const sanitizedBody = sanitizeFields(body, ['full_name', 'observations'])

    // Validate the update body
    const parsed = updateAffiliateSchema.safeParse(sanitizedBody)

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.') || '_root'
        if (!fieldErrors[path]) {
          fieldErrors[path] = []
        }
        fieldErrors[path].push(issue.message)
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: Object.values(fieldErrors).flat()[0] ?? 'Error de validación.',
            fields: fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    // Check affiliate exists and verify ownership for instructors
    const existing = await affiliateRepository.findById(id)

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Afiliado con identificador '${id}' no encontrado.`,
          },
        },
        { status: 404 }
      )
    }

    // Instructors can only update their own affiliates
    if (user.role === 'instructor' && existing.instructor_id !== user.id) {
      return forbiddenResponse()
    }

    const updated = await affiliateRepository.update(id, parsed.data)

    return NextResponse.json(
      { success: true, data: updated },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof AffiliateValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            fields: error.fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    return handleRouteError(error, {
      operation: 'PUT /api/affiliates/[id]',
      method: 'PUT',
      path: '/api/affiliates/[id]',
    })
  }
}

/**
 * DELETE /api/affiliates/[id]
 * Deletes an affiliate. Only admins can perform this operation.
 * Returns 403 for instructors.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    // Only admins can delete affiliates
    if (user.role !== 'admin') {
      return forbiddenResponse()
    }

    const { id } = await context.params

    // Verify affiliate exists before deleting
    const existing = await affiliateRepository.findById(id)

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Afiliado con identificador '${id}' no encontrado.`,
          },
        },
        { status: 404 }
      )
    }

    await affiliateRepository.deleteAffiliate(id)

    return NextResponse.json(
      { success: true, data: { message: 'Afiliado eliminado exitosamente.' } },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'DELETE /api/affiliates/[id]',
      method: 'DELETE',
      path: '/api/affiliates/[id]',
    })
  }
}
