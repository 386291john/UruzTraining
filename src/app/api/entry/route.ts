/**
 * API Route Handler for /api/entry
 * POST: Validates affiliate identity and registers gym entry.
 *
 * Validates: Requirements 6.1, 6.7, 14.4, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/utils/api-helpers'
import { handleRouteError } from '@/lib/utils/error-handler'
import { validateAndRegisterEntry, type EntryErrorCode } from '@/services/entry.service'

// --- Input Validation Schema ---

const entrySchema = z.object({
  document_id: z.string().min(1, 'Documento es obligatorio'),
  pin: z.string().length(4, 'El PIN debe ser de 4 dígitos').regex(/^\d{4}$/, 'El PIN debe contener solo dígitos'),
})

// --- Error Code to HTTP Status Mapping ---

const errorCodeToStatus: Record<EntryErrorCode, number> = {
  AFFILIATE_NOT_FOUND: 404,
  PIN_MISMATCH: 401,
  PIN_BLOCKED: 429,
  MEMBERSHIP_EXPIRED: 403,
  NO_DAYS_REMAINING: 403,
  ALREADY_ENTERED: 409,
}

/**
 * POST /api/entry
 * Registers a gym entry for an affiliate after validating document_id and PIN.
 *
 * Request body:
 *   - document_id: string (affiliate government document ID)
 *   - pin: string (4-digit PIN)
 *
 * Responses:
 *   - 200: Entry registered successfully
 *   - 400: Validation error (invalid input)
 *   - 401: Unauthorized (not authenticated or PIN mismatch)
 *   - 403: Membership expired or no days remaining
 *   - 404: Affiliate not found
 *   - 409: Already entered today
 *   - 429: PIN blocked (too many failed attempts)
 *   - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    // Parse and validate request body
    const body = await request.json()
    const parsed = entrySchema.safeParse(body)

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de entrada inválidos.',
            fields: fieldErrors,
          },
        },
        { status: 400 }
      )
    }

    const { document_id, pin } = parsed.data

    // Delegate to EntryService
    const result = await validateAndRegisterEntry(document_id, pin, user.id)

    if (!result.success && result.error) {
      const status = errorCodeToStatus[result.error.code] ?? 500
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.error.code,
            message: result.error.message,
            ...(result.error.metadata && { metadata: result.error.metadata }),
          },
        },
        { status }
      )
    }

    // Success — return entry data
    return NextResponse.json(
      {
        success: true,
        data: {
          affiliateName: result.entry!.affiliateName,
          planName: result.entry!.planName,
          remainingDays: result.entry!.remainingDays,
          expirationDate: result.entry!.expirationDate,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'POST /api/entry',
      method: 'POST',
      path: '/api/entry',
    })
  }
}
