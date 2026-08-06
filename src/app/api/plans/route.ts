/**
 * API Route Handlers for /api/plans
 * GET: List plans with pagination (RLS-filtered)
 * POST: Create a new plan
 *
 * Validates: Requirements 2.1, 2.5, 2.7, 12.3, 12.4, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { sanitizeFields } from '@/lib/utils/sanitize'
import { handleRouteError } from '@/lib/utils/error-handler'
import * as planService from '@/services/plan.service'
import { PlanValidationError } from '@/services/plan.service'

/**
 * GET /api/plans
 * Returns a paginated list of plans. RLS ensures instructors only see their own.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page')
    const pageSize = searchParams.get('pageSize')

    const pagination = {
      ...(page && { page: parseInt(page, 10) }),
      ...(pageSize && { pageSize: parseInt(pageSize, 10) }),
    }

    const result = await planService.getPlans(
      Object.keys(pagination).length > 0 ? pagination : undefined
    )

    return NextResponse.json(
      { success: true, data: result },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'GET /api/plans',
      method: 'GET',
      path: '/api/plans',
    })
  }
}

/**
 * POST /api/plans
 * Creates a new plan. Validates input with Zod.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const body = await request.json()

    // Sanitize text fields to prevent XSS (Requirement 12.4)
    const sanitizedBody = sanitizeFields(body, ['name', 'description'])

    const plan = await planService.createPlan(sanitizedBody, user.id)

    return NextResponse.json(
      { success: true, data: plan },
      { status: 201 }
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

    return handleRouteError(error, {
      operation: 'POST /api/plans',
      method: 'POST',
      path: '/api/plans',
    })
  }
}
