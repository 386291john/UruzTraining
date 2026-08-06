/**
 * API Route Handler for /api/reports/expired
 * GET: Retrieves affiliates with expired memberships.
 *
 * Validates: Requirements 11.3, 11.8, 12.6
 */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import { getExpiredAffiliates } from '@/services/report.service'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const data = await getExpiredAffiliates()

    return NextResponse.json(
      {
        success: true,
        data,
        ...(data.length === 0 && {
          message: 'No se encontraron afiliados con membresía vencida.',
        }),
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'GET /api/reports/expired',
      method: 'GET',
      path: '/api/reports/expired',
    })
  }
}
