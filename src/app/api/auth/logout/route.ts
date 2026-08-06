/**
 * API Route Handler for /api/auth/logout
 * POST: Signs out the current user session.
 *
 * Validates: Requirements 1.1, 12.6
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleRouteError } from '@/lib/utils/error-handler'

export async function POST() {
  try {
    const supabase = createClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LOGOUT_FAILED',
            message: 'No se pudo cerrar la sesión',
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: { message: 'Sesión cerrada exitosamente' },
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'POST /api/auth/logout',
      method: 'POST',
      path: '/api/auth/logout',
    })
  }
}
