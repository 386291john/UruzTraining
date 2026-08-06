/**
 * API Route Handler for /api/reports/entries
 * GET: Retrieves entry history report with optional filters.
 *
 * Query params: dateFrom, dateTo, affiliateId, instructorId
 *
 * Validates: Requirements 11.1, 11.8, 11.10, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import { getEntryHistory } from '@/services/report.service'
import { reportFiltersSchema } from '@/lib/validators/report.validator'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const rawParams = {
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
      affiliateId: searchParams.get('affiliateId') ?? undefined,
      instructorId: searchParams.get('instructorId') ?? undefined,
    }

    const parsed = reportFiltersSchema.safeParse(rawParams)
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

    const data = await getEntryHistory(parsed.data)

    return NextResponse.json(
      {
        success: true,
        data,
        ...(data.length === 0 && {
          message: 'No se encontraron registros de ingreso para los filtros aplicados.',
        }),
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'GET /api/reports/entries',
      method: 'GET',
      path: '/api/reports/entries',
    })
  }
}
