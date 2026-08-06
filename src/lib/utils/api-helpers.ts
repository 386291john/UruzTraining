/**
 * API helper utilities for Next.js Route Handlers.
 * Provides authenticated user retrieval and standard error responses.
 *
 * Validates: Requirements 1.3, 1.4, 1.5
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface AuthenticatedUser {
  id: string
  email: string
  role: 'admin' | 'instructor'
  fullName: string
}

/**
 * Gets the currently authenticated user from the Supabase session.
 * Returns null if no valid session exists or user has no profile/role.
 *
 * @returns The authenticated user with role, or null if unauthenticated
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return null
  }

  const role = profile.role as string
  if (role !== 'admin' && role !== 'instructor') {
    return null
  }

  return {
    id: user.id,
    email: user.email!,
    role: role as 'admin' | 'instructor',
    fullName: profile.full_name,
  }
}

/**
 * Returns a standard 401 Unauthorized JSON response.
 */
export function unauthorizedResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'No autenticado. Inicie sesión para acceder a este recurso.',
      },
    },
    { status: 401 }
  )
}

/**
 * Returns a standard 403 Forbidden JSON response.
 */
export function forbiddenResponse(): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Permisos insuficientes para realizar esta operación.',
      },
    },
    { status: 403 }
  )
}
