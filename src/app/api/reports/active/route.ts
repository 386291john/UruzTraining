/**
 * API Route Handler for /api/reports/active
 * GET: Retrieves affiliates with active memberships.
 *
 * Validates: Requirements 11.4, 11.8, 12.6
 */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import { getActiveAffiliates } from '@/services/report.service'

export async function GET() {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const data = await getActiveAffiliates()

    return NextResponse.json(
      {
        success: true,
        data,
        ...(data.length === 0 && {
          message: 'No se encontraron afiliados con membresía activa.',
        }),
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'GET /api/reports/active',
      method: 'GET',
      path: '/api/reports/active',
    })
  }
}
