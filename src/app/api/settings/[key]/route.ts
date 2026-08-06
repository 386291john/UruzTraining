/**
 * API Route Handler for /api/settings/[key]
 * PUT: Update a specific system configuration entry (admin only).
 *
 * Validates: Requirements 7.1, 7.2, 12.4, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/utils/api-helpers'
import { sanitizeText } from '@/lib/utils/sanitize'
import { handleRouteError } from '@/lib/utils/error-handler'
import * as configRepository from '@/repositories/config.repository'

/** Zod schema for PUT body validation */
const updateSettingSchema = z.object({
  value: z.unknown().refine((val) => val !== undefined, {
    message: 'El campo "value" es requerido.',
  }),
})

/**
 * PUT /api/settings/[key]
 * Updates a system configuration entry by key.
 * Only admin users can update settings. Instructors receive 403.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const user = await getAuthenticatedUser()

    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'admin') {
      return forbiddenResponse()
    }

    const { key } = params

    // Verify the key exists
    const existing = await configRepository.getByKey(key)

    if (!existing) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Configuración '${key}' no encontrada.`,
          },
        },
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = updateSettingSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.issues[0]?.message ?? 'Datos inválidos.',
          },
        },
        { status: 400 }
      )
    }

    // Sanitize text values for keys that contain user-facing templates (Requirement 12.4)
    let sanitizedValue = validation.data.value
    if (key === 'notification_template' && typeof sanitizedValue === 'object' && sanitizedValue !== null) {
      const templateObj = sanitizedValue as Record<string, unknown>
      if (typeof templateObj.template === 'string') {
        sanitizedValue = { ...templateObj, template: sanitizeText(templateObj.template) }
      }
    }

    const updated = await configRepository.updateByKey(
      key,
      sanitizedValue as Parameters<typeof configRepository.updateByKey>[1],
      user.id
    )

    return NextResponse.json(
      { success: true, data: updated },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: `PUT /api/settings/${params.key}`,
      method: 'PUT',
      path: `/api/settings/${params.key}`,
    })
  }
}
