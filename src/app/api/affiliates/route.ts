/**
 * API Route Handlers for /api/affiliates
 * GET: Search affiliates with query params (search, field, page)
 * POST: Register a new affiliate
 *
 * Validates: Requirements 3.1, 3.2, 3.6, 4.1, 4.2, 4.3, 7.1, 7.2, 7.3, 12.3, 12.4, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { sanitizeFields } from '@/lib/utils/sanitize'
import { handleRouteError } from '@/lib/utils/error-handler'
import * as affiliateService from '@/services/affiliate.service'
import {
  AffiliateValidationError,
  DuplicateDocumentError,
  InvalidPlanError,
} from '@/services/affiliate.service'

/**
 * GET /api/affiliates
 * Search affiliates with query params: search (term), field (document_id|full_name|phone), page.
 * Requires minimum 3 characters for search term.
 * Returns paginated results (max 20 per page).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const field = searchParams.get('field')
    const page = searchParams.get('page')

    // If no search term or wildcard, list all affiliates
    const isListAll = !search || search === '*' || search === '%%%' || search.trim().length < 3

    if (isListAll) {
      // List all affiliates (paginated)
      const result = await affiliateService.listAllAffiliates(
        page ? parseInt(page, 10) : 1,
        20
      )
      return NextResponse.json(
        { success: true, data: result },
        { status: 200 }
      )
    }

    // Validate field for search
    if (!field) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'El parámetro field es obligatorio para búsqueda.',
          },
        },
        { status: 400 }
      )
    }

    const result = await affiliateService.searchAffiliates({
      term: search,
      field,
      page: page ? parseInt(page, 10) : 1,
      pageSize: 20,
    })

    return NextResponse.json(
      { success: true, data: result },
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
      operation: 'GET /api/affiliates',
      method: 'GET',
      path: '/api/affiliates',
    })
  }
}

/**
 * POST /api/affiliates
 * Registers a new affiliate. Validates input with Zod via the service layer.
 * Returns 201 on success, 409 for duplicate document_id, 400 for validation errors.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const body = await request.json()

    // Sanitize text fields to prevent XSS (Requirement 12.4)
    const sanitizedBody = sanitizeFields(body, ['full_name', 'observations'])

    const result = await affiliateService.registerAffiliate(sanitizedBody, user.id)

    return NextResponse.json(
      { success: true, data: result },
      { status: 201 }
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

    if (error instanceof DuplicateDocumentError) {
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

    if (error instanceof InvalidPlanError) {
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
      operation: 'POST /api/affiliates',
      userId: undefined,
      method: 'POST',
      path: '/api/affiliates',
    })
  }
}
