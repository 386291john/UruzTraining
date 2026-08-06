/**
 * API Route Handler for /api/notifications
 * GET: Lists notification log with pagination (admin only).
 * Query params: status (optional filter), page, pageSize.
 * Returns paginated notifications.
 *
 * Validates: Requirements 9.6, 9.7, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import * as notificationRepository from '@/repositories/notification.repository'
import type { NotificationStatus } from '@/repositories/notification.repository'
import { PAGINATION } from '@/lib/utils/constants'

/** Valid status values for filtering */
const VALID_STATUSES: NotificationStatus[] = ['pending', 'sent', 'delivered', 'failed', 'skipped']

/**
 * GET /api/notifications
 * Returns a paginated list of notification logs.
 * Admin only. Supports optional status filter.
 *
 * Query params:
 * - status: optional, one of 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped'
 * - page: optional, defaults to 1
 * - pageSize: optional, defaults to 20, max 100
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'admin') {
      return forbiddenResponse()
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const pageParam = searchParams.get('page')
    const pageSizeParam = searchParams.get('pageSize')

    // Validate status filter if provided
    if (statusParam && !VALID_STATUSES.includes(statusParam as NotificationStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Estado inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}.`,
          },
        },
        { status: 400 }
      )
    }

    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : PAGINATION.DEFAULT_PAGE
    const pageSize = pageSizeParam
      ? Math.min(Math.max(1, parseInt(pageSizeParam, 10)), PAGINATION.MAX_PAGE_SIZE)
      : PAGINATION.DEFAULT_PAGE_SIZE

    const offset = (page - 1) * pageSize

    const notifications = await notificationRepository.findAll({
      status: statusParam as NotificationStatus | undefined,
      limit: pageSize,
      offset,
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          notifications,
          page,
          pageSize,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'GET /api/notifications',
      method: 'GET',
      path: '/api/notifications',
    })
  }
}
