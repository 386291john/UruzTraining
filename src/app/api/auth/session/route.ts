/**
 * API Route Handler for /api/auth/session
 * GET: Returns current user session with role info.
 *
 * Validates: Requirements 1.5, 1.6, 12.6
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleRouteError } from '@/lib/utils/error-handler'

export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'No hay sesión activa',
          },
        },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profileError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: 'No se pudo obtener el perfil del usuario',
          },
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: profile.role,
            fullName: profile.full_name,
          },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'GET /api/auth/session',
      method: 'GET',
      path: '/api/auth/session',
    })
  }
}
