/**
 * API Route Handler for /api/affiliates/[id]/pin
 * PUT: Update affiliate PIN with 4-digit validation
 *
 * Validates: Requirements 3.6, 7.1, 7.2, 7.3, 12.3, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import * as affiliateService from '@/services/affiliate.service'
import {
  AffiliateValidationError,
  AffiliateNotFoundError,
} from '@/services/affiliate.service'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * PUT /api/affiliates/[id]/pin
 * Updates the PIN of an affiliate.
 * Body: { pin: "1234" } — must be exactly 4 numeric digits.
 * Returns 200 on success, 400 for validation errors, 404 if affiliate not found.
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

    const updatedAffiliate = await affiliateService.updatePin(id, body)

    return NextResponse.json(
      { success: true, data: updatedAffiliate },
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
      operation: 'PUT /api/affiliates/[id]/pin',
      method: 'PUT',
      path: '/api/affiliates/[id]/pin',
    })
  }
}
