/**
 * API Route Handler for /api/reports/expiring
 * GET: Retrieves affiliates whose memberships are about to expire.
 *
 * Query params: days (number of days to look ahead, defaults to 7)
 *
 * Validates: Requirements 11.5, 11.8, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import { getExpiringAffiliates } from '@/services/report.service'
import { expiringFiltersSchema } from '@/lib/validators/report.validator'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const daysParam = searchParams.get('days') ?? undefined

    const parsed = expiringFiltersSchema.safeParse({ days: daysParam })
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues.map((i) => i.message).join(', '),
          },
        },
        { status: 400 }
      )
    }

    const data = await getExpiringAffiliates(parsed.data.days)

    return NextResponse.json(
      {
        success: true,
        data,
        ...(data.length === 0 && {
          message: 'No se encontraron afiliados con membresía próxima a vencer.',
        }),
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'GET /api/reports/expiring',
      method: 'GET',
      path: '/api/reports/expiring',
    })
  }
}
