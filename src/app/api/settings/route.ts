/**
 * API Route Handler for /api/settings
 * GET: Retrieve all system configuration entries.
 *
 * Accessible by any authenticated user (admin and instructors).
 *
 * Validates: Requirements 7.1, 12.6
 */

import { NextResponse } from 'next/server'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import * as configRepository from '@/repositories/config.repository'

/**
 * GET /api/settings
 * Returns all system configuration entries.
 * Both admin and instructor roles can read settings.
 */
export async function GET() {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    const settings = await configRepository.getAll()

    return NextResponse.json(
      { success: true, data: settings },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'GET /api/settings',
      method: 'GET',
      path: '/api/settings',
    })
  }
}
