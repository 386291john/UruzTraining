/**
 * API Route Handlers for /api/plans/[id]
 * GET: Get plan detail by ID
 * PUT: Update an existing plan
 * DELETE: Delete a plan (admin only, fails if active affiliates exist)
 *
 * Validates: Requirements 2.1, 2.5, 2.6, 2.7, 2.9, 2.10, 12.3, 12.4, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/utils/api-helpers'
import { sanitizeFields } from '@/lib/utils/sanitize'
import { handleRouteError } from '@/lib/utils/error-handler'
import * as planService from '@/services/plan.service'
import {
  PlanNotFoundError,
  PlanOwnershipError,
  PlanValidationError,
  PlanHasActiveAffiliatesError,
} from '@/services/plan.service'
import { PermissionDeniedError } from '@/lib/utils/permissions'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/plans/[id]
 * Returns a single plan by ID. Returns 404 if not found.
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

    const plan = await planService.getPlanById(id)

    return NextResponse.json(
      { success: true, data: plan },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof PlanNotFoundError) {
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
      operation: 'GET /api/plans/[id]',
      method: 'GET',
      path: '/api/plans/[id]',
    })
  }
}

/**
 * PUT /api/plans/[id]
 * Updates an existing plan. Validates input with Zod.
 * Returns 403 if instructor tries to modify another's plan.
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
    const sanitizedBody = sanitizeFields(body, ['name', 'description'])

    const plan = await planService.updatePlan(id, sanitizedBody, user.id, user.role)

    return NextResponse.json(
      { success: true, data: plan },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof PlanValidationError) {
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

    if (error instanceof PlanNotFoundError) {
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

    if (error instanceof PlanOwnershipError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message,
          },
        },
        { status: 403 }
      )
    }

    return handleRouteError(error, {
      operation: 'PUT /api/plans/[id]',
      method: 'PUT',
      path: '/api/plans/[id]',
    })
  }
}

/**
 * DELETE /api/plans/[id]
 * Deletes a plan. Only admins can delete. Returns 409 if plan has active affiliates.
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

    // Only admins can delete plans
    if (user.role !== 'admin') {
      return forbiddenResponse()
    }

    const { id } = await context.params

    await planService.deletePlan(id, user.id, user.role)

    return NextResponse.json(
      { success: true, data: { message: 'Plan eliminado exitosamente.' } },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof PlanNotFoundError) {
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

    if (error instanceof PlanHasActiveAffiliatesError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: error.message,
          },
        },
        { status: 409 }
      )
    }

    if (error instanceof PermissionDeniedError) {
      return forbiddenResponse()
    }

    return handleRouteError(error, {
      operation: 'DELETE /api/plans/[id]',
      method: 'DELETE',
      path: '/api/plans/[id]',
    })
  }
}
