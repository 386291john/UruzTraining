/**
 * API Route Handler for /api/auth/login
 * POST: Authenticate user with email and password.
 *
 * Validates: Requirements 1.1, 1.2, 12.6
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { handleRouteError } from '@/lib/utils/error-handler'

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.issues[0].message,
          },
        },
        { status: 400 }
      )
    }

    const { email, password } = validation.data
    const supabase = createClient()

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Credenciales inválidas',
          },
        },
        { status: 401 }
      )
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', authData.user.id)
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
            id: authData.user.id,
            email: authData.user.email,
            role: profile.role,
            fullName: profile.full_name,
          },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    return handleRouteError(error, {
      operation: 'POST /api/auth/login',
      method: 'POST',
      path: '/api/auth/login',
    })
  }
}
