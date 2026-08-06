/**
 * API Route Handler for /api/affiliates/[id]/renew
 * POST: Renew an affiliate's membership with a new plan
 *
 * Validates: Requirements 8.1, 8.6, 8.7, 12.4, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAuthenticatedUser,
  unauthorizedResponse,
} from '@/lib/utils/api-helpers'
import { sanitizeFields } from '@/lib/utils/sanitize'
import { handleRouteError } from '@/lib/utils/error-handler'
import * as affiliateRepository from '@/repositories/affiliate.repository'
import * as planRepository from '@/repositories/plan.repository'
import * as renewalService from '@/services/renewal.service'
import { z } from 'zod'
import { FIELD_LIMITS } from '@/lib/utils/constants'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Zod schema for renewal request body.
 * - newPlanId: required UUID of the plan to assign
 * - newInstructorId: optional UUID of a new instructor
 * - observations: optional string (max 500 chars)
 */
const renewalBodySchema = z.object({
  newPlanId: z
    .string({ message: 'El plan es obligatorio.' })
    .uuid('El ID del plan debe ser un UUID válido.'),
  newInstructorId: z
    .string()
    .uuid('El ID del instructor debe ser un UUID válido.')
    .optional(),
  observations: z
    .string()
    .max(
      FIELD_LIMITS.NOTES_MAX,
      `Las observaciones no pueden exceder ${FIELD_LIMITS.NOTES_MAX} caracteres.`
    )
    .optional(),
})

/**
 * POST /api/affiliates/[id]/renew
 * Renews the affiliate's membership with a new plan.
 *
 * Body: { newPlanId: string, newInstructorId?: string, observations?: string }
 * Returns: { success: true, data: { renewal: {...}, newMembership: {...} } }
 * Errors: 400 (validation/inactive plan), 401, 404 (affiliate not found), 500
 */
export async function POST(
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
    const sanitizedBody = sanitizeFields(body, ['observations'])

    // Validate request body
    const parsed = renewalBodySchema.safeParse(sanitizedBody)

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

    // Verify affiliate exists
    const affiliate = await affiliateRepository.findById(id)

    if (!affiliate) {
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

    // Verify the selected plan is active (Requirement 8.7)
    const plan = await planRepository.findById(parsed.data.newPlanId)

    if (!plan) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'El plan seleccionado no fue encontrado.',
          },
        },
        { status: 400 }
      )
    }

    if (plan.status !== 'active') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'El plan seleccionado no está disponible. Solo se pueden asignar planes activos.',
          },
        },
        { status: 400 }
      )
    }

    // Call the renewal service
    const result = await renewalService.renew(
      {
        affiliateId: id,
        newPlanId: parsed.data.newPlanId,
        newInstructorId: parsed.data.newInstructorId,
        observations: parsed.data.observations,
      },
      user.id
    )

    return NextResponse.json(
      { success: true, data: result },
      { status: 200 }
    )
  } catch (error) {
    // Handle known service errors
    if (error instanceof Error && error.message.includes('no tiene membresía activa')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
          },
        },
        { status: 400 }
      )
    }

    return handleRouteError(error, {
      operation: 'POST /api/affiliates/[id]/renew',
      method: 'POST',
      path: '/api/affiliates/[id]/renew',
    })
  }
}
