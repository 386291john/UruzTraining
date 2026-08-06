/**
 * API Route Handler for /api/notifications/check
 * POST: Triggers notification check for expiring memberships.
 * Admin only or CRON. Calls checkAndNotifyExpiringMemberships() + retryFailedNotifications().
 * Returns { sent, failed, skipped }.
 *
 * Validates: Requirements 9.1, 9.2, 9.5, 12.6
 */

import { NextResponse } from 'next/server'
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import * as notificationService from '@/services/notification.service'

/**
 * POST /api/notifications/check
 * Triggers the notification workflow:
 * 1. Checks for expiring memberships and sends notifications
 * 2. Retries previously failed notifications
 *
 * Access: Admin only or CRON (via Authorization header with CRON_SECRET).
 */
export async function POST(request: Request) {
  try {
    // Check for CRON secret authorization (for automated scheduled jobs)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    const isCronRequest = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isCronRequest) {
      // Fall back to authenticated user check (admin only)
      const user = await getAuthenticatedUser()

      if (!user) {
        return unauthorizedResponse()
      }

      if (user.role !== 'admin') {
        return forbiddenResponse()
      }
    }

    // 1. Check and notify expiring memberships
    const checkResult = await notificationService.checkAndNotifyExpiringMemberships()

    // 2. Retry previously failed notifications
    await notificationService.retryFailedNotifications()

    // 3. Auto-expire stale memberships (2 days grace period)
    const expired = await notificationService.expireStaleActiveMemberships()

    return NextResponse.json(
      {
        success: true,
        data: {
          sent: checkResult.sent,
          failed: checkResult.failed,
          skipped: checkResult.skipped,
          membershipsExpired: expired,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'POST /api/notifications/check',
      method: 'POST',
      path: '/api/notifications/check',
    })
  }
}
