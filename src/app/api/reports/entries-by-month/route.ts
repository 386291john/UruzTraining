/**
 * API Route Handler for /api/reports/entries-by-month
 * GET: Retrieves monthly entry counts for a date range.
 *
 * Query params: dateFrom, dateTo
 * Max range: 12 months (enforced by service layer → returns 400)
 *
 * Validates: Requirements 11.7, 11.8, 11.10, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import { getEntriesByMonth } from '@/services/report.service'
import { dateRangeSchema } from '@/lib/validators/report.validator'

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
    }

    const parsed = dateRangeSchema.safeParse(rawParams)
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

    const data = await getEntriesByMonth(parsed.data.dateFrom, parsed.data.dateTo)

    return NextResponse.json(
      {
        success: true,
        data,
        ...(data.length === 0 && {
          message: 'No se encontraron ingresos para el rango de fechas indicado.',
        }),
      },
      { status: 200 }
    )
  } catch (error) {
    // Range exceeded errors thrown by service → return 400
    if (error instanceof Error && error.message.includes('rango máximo')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RANGE_EXCEEDED',
            message: error.message,
          },
        },
        { status: 400 }
      )
    }

    return handleRouteError(error, {
      operation: 'GET /api/reports/entries-by-month',
      method: 'GET',
      path: '/api/reports/entries-by-month',
    })
  }
}
