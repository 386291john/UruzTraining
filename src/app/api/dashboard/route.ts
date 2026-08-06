/**
 * API Route Handler for /api/dashboard
 * GET: Returns all dashboard metrics (filtered by RLS based on user role).
 *
 * - Admin: sees metrics for ALL affiliates
 * - Instructor: sees metrics only for their own affiliates (RLS enforced)
 *
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 12.6
 */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import * as dashboardService from '@/services/dashboard.service'

/**
 * GET /api/dashboard
 * Returns all dashboard metrics calculated at request time.
 * RLS policies automatically scope data based on the authenticated user's role.
 */
export async function GET() {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const data = await dashboardService.getDashboardMetrics()

    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'GET /api/dashboard',
      method: 'GET',
      path: '/api/dashboard',
    })
  }
}
